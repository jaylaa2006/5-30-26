// v3.51.74 — SW deploy-path contract.
//
// v3.51.73 deploy initially missed the SW APP_VERSION bump on prod because
// the rsync target matched a DEAD route handler, not the actual serving
// path. Root cause:
//
//   server.js:123  app.use(express.static('public'))   // intercepts /sw.js
//   server.js:151  app.get('/sw.js', sendFile('sw.js')) // UNREACHABLE
//
// Two files on disk: `./sw.js` (matched dead route) + `./public/sw.js`
// (served by static mount). Rsync to `./sw.js` looked like success but
// nothing on the live wire changed. Express.static is mounted FIRST so
// it always wins. Verified by:
//   - file at /var/www/perankh/sw.js had v32 (today, by rsync)
//   - curl http://localhost:3456/sw.js returned v31 (from public/sw.js)
//
// This test locks the canonical contract:
//   1. There is exactly ONE `/sw.js`-serving path in server.js (the
//      static mount).
//   2. The dead `app.get('/sw.js', ...)` route does not return.
//   3. The canonical file on disk is `public/sw.js`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const server = fs.readFileSync('server.js', 'utf8');
// Strip line comments only so the assertion doesn't false-positive on
// documentation that legitimately mentions the old route pattern (e.g. the
// v3.51.74 comment explaining WHY we deleted it). Block-comment stripping is
// deliberately omitted — `/\*[\s\S]*?\*\//g` would also match `//*` in URL
// strings (e.g. `https://*.googleusercontent.com`) and greedily eat the
// rest of server.js until the next `*/`, hiding the real static mount.
const serverCode = server.replace(/^\s*\/\/[^\n]*/gm, '');

test('Rule 1 — explicit /sw.js route sets Cache-Control: no-cache', () => {
  // The /sw.js route MUST exist (placed BEFORE the express.static mount, see
  // Rule 4) AND must set Cache-Control: no-cache directly on the response.
  // Reason: express.static would default to `max-age=3600`, which Cloudflare
  // then rewrites upward to its 4h default — defeating SW updates at the edge
  // for up to 4 hours. nginx's `add_header Cache-Control "no-cache"` only
  // *adds* a second header rather than overriding the upstream one; CF picks
  // the max-age variant and drops no-cache. The fix is to control the
  // upstream header itself.
  const routeIdx = serverCode.search(/app\.get\s*\(\s*['"`]\/sw\.js['"`]/);
  assert.ok(routeIdx > 0,
    'app.get("/sw.js", ...) route must exist in server.js — required for explicit no-cache header');
  // Walk ~600 chars after the route opener to find the handler body.
  const handlerBody = serverCode.slice(routeIdx, routeIdx + 600);
  assert.match(handlerBody, /setHeader\s*\(\s*['"`]Cache-Control['"`]\s*,\s*['"`]no-cache['"`]/,
    '/sw.js route must explicitly set Cache-Control: no-cache (else CF caches the SW for ~4h)');
  assert.match(handlerBody, /['"`]Service-Worker-Allowed['"`]\s*,\s*['"`]\/['"`]/,
    '/sw.js route must set Service-Worker-Allowed: / (required for SW scope = root in dev where nginx is absent)');
  assert.match(handlerBody, /path\.join\s*\(\s*__dirname\s*,\s*['"`]public['"`]\s*,\s*['"`]sw\.js['"`]/,
    '/sw.js route must read from path.join(__dirname,"public","sw.js") — the canonical file');
});

test('Rule 2 — canonical SW file lives at public/sw.js', () => {
  assert.ok(fs.existsSync('public/sw.js'),
    'public/sw.js must exist — that is the file express.static serves at /sw.js');
});

test('Rule 3 — no shadow sw.js at repo root', () => {
  // If a contributor copies public/sw.js back to repo root "for clarity"
  // they re-create the drift surface. Fail the test if root sw.js reappears.
  assert.ok(!fs.existsSync('sw.js'),
    'sw.js must NOT exist at repo root — the canonical file is public/sw.js. ' +
    'A root-level sw.js is the v3.51.73 shadow-path surface; delete it.');
});

test('Rule 4 — /sw.js route is registered BEFORE express.static("public")', () => {
  // The /sw.js route MUST win over the static mount so the explicit
  // Cache-Control: no-cache header (Rule 1) lands on the response. If the
  // static mount comes first, it intercepts and sets max-age=3600 which
  // Cloudflare rewrites to its 4h default — the regression that prompted
  // this rule (caught in the v3.51.74 deploy verification chain).
  const staticIdx = serverCode.search(/app\.use\s*\(\s*express\.static\s*\(\s*path\.join\s*\(\s*__dirname\s*,\s*['"`]public['"`]/);
  assert.ok(staticIdx > 0, 'express.static("public") mount must exist in server.js');
  const swRouteIdx = serverCode.search(/app\.(get|all|use)\s*\(\s*['"`]\/sw\.js['"`]/);
  assert.ok(swRouteIdx > 0, '/sw.js route must exist (per Rule 1)');
  assert.ok(swRouteIdx < staticIdx,
    'the /sw.js route MUST be registered BEFORE the express.static("public") mount — ' +
    'otherwise the static mount intercepts and Cache-Control: no-cache (Rule 1) never lands. ' +
    'See v3.51.74 deploy verification: max-age=3600 from static + CF rewrite → 4h SW stickiness at the edge.');
});
