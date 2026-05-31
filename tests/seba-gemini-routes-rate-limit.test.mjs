#!/usr/bin/env node
// tests/seba-gemini-routes-rate-limit.test.mjs
//
// v3.44.x — Carry-forward CRITICAL bindings lock-in test.
//
// Bindings:
//   1. /api/seba-evaluate previously had no per-IP daily cap → wallet-drain.
//   2. Other 6 Gemini routes (dialogue, sema, prescribe, challenge,
//      provocation, maat-teaching) lacked per-IP defense-in-depth limits.
//
// This test asserts for each of the 7 routes:
//   - First request from a clean IP succeeds (or fails at validation, NOT 429).
//   - Rapid second request returns 429 from the new checkGeminiRouteIPLimits
//     guard.
//   - The 429 response carries Retry-After header.
//   - Structured telemetry event 'rate_limited_per_ip' is emitted with
//     route, reason, ip_hash, ts — never a raw IP.
//   - SEBA_<ROUTE>_DISABLED killswitches are structurally present in source
//     and emit killswitch_active telemetry.
//
// Boots seba-story-api.mjs on SEBA_TEST_PORT (default 3849) so it doesn't
// collide with elder-hint (3847) or bridge-hint (3848).
//
// Run directly:
//   SEBA_TEST_PORT=3849 node --test tests/seba-gemini-routes-rate-limit.test.mjs

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync } from 'node:fs';

const PORT = process.env.SEBA_TEST_PORT || 3849;
const BASE = `http://127.0.0.1:${PORT}`;
const API_FILE = join(fileURLToPath(import.meta.url), '../../seba-story-api.mjs');
const tmpDb = join(tmpdir(), `seba-test-routes-rl-${Date.now()}.db`);

let serverProcess = null;
const logLines = [];

async function waitForServer(maxMs = 12000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(BASE + '/api/seba-elder-hint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (r.status !== undefined) return;
    } catch {
      await new Promise(r => setTimeout(r, 200));
    }
  }
  throw new Error(`Server did not start within ${maxMs}ms`);
}

before(async () => {
  mkdirSync(tmpdir(), { recursive: true });
  serverProcess = spawn(process.execPath, [API_FILE], {
    env: {
      ...process.env,
      SEBA_PORT: String(PORT),
      SEBA_DB_PATH: tmpDb,
      GEMINI_API_KEY: 'test-dummy-key-routes-rl',
      SEBA_TEST_MOCK: '1',
      JWT_SECRET: 'test-secret',
      SENDGRID_API_KEY: '',
      NODE_ENV: 'test'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  serverProcess.stdout.setEncoding('utf8');
  serverProcess.stdout.on('data', (chunk) => {
    for (const line of chunk.split('\n')) {
      if (line.trim()) logLines.push(line);
    }
  });

  serverProcess.on('error', (err) => {
    console.error('[test-boot] server spawn error:', err.message);
  });

  await waitForServer();
});

after(() => {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
});

async function post(path, body, headers = {}) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, body: parsed, raw: text, retryAfter: res.headers.get('retry-after') };
}

// ─── Routes under test ─────────────────────────────────────────────────
// Each route has a tag (log prefix) and a minimal body. Bodies are intentionally
// minimal so the test runs fast — the per-IP rate-limit fires BEFORE budget /
// per-user / validation checks, so even empty bodies are sufficient to drive
// the 2nd-request-is-429 assertion.
//
// Per-IP rate-limit window is GEMINI_PER_IP_RATE_MS = 5000ms — we send 2
// requests back-to-back with no delay → 2nd hits the window.
const ROUTES = [
  { route: '/api/seba-evaluate',      tag: '[EVAL]',        ks: 'SEBA_EVALUATE_DISABLED' },
  { route: '/api/seba-dialogue',      tag: '[DIALOGUE]',    ks: 'SEBA_DIALOGUE_DISABLED' },
  { route: '/api/seba-provocation',   tag: '[PROVOCATION]', ks: 'SEBA_PROVOCATION_DISABLED' },
  { route: '/api/seba-sema',          tag: '[SEMA]',        ks: 'SEBA_SEMA_DISABLED' },
  { route: '/api/seba-maat-teaching', tag: '[TEACHING]',    ks: 'SEBA_MAAT_TEACHING_DISABLED' },
  { route: '/api/seba-prescribe',     tag: '[PRESCRIBE]',   ks: 'SEBA_PRESCRIBE_DISABLED' },
  { route: '/api/seba-challenge',     tag: '[CHALLENGE]',   ks: 'SEBA_CHALLENGE_DISABLED' },
];

// ── Test 1: 429 emission on rapid 2nd request per route ──────────────────
// One sub-test per route so a failure pinpoints which route regressed.
for (const { route, tag } of ROUTES) {
  test(`${route}: rapid 2nd request returns 429 with Retry-After + rate_limited_per_ip telemetry`, async () => {
    const before = logLines.length;
    const r1 = await post(route, {});
    // First request: must NOT be 429 from OUR new guard (it's a clean IP for
    // this route). It may still be 400/200/etc from validation/budget.
    assert.notEqual(r1.status, 429, `first request from clean IP must not 429 (got ${r1.status}): ${r1.raw}`);

    // Second request fired immediately — within the 5s rate window.
    const r2 = await post(route, {});
    assert.equal(r2.status, 429, `expected 429 on rapid 2nd request to ${route}, got ${r2.status}: ${r2.raw}`);
    assert.ok(r2.retryAfter, `Retry-After header must be set on 429 from ${route}`);
    assert.ok(r2.body && r2.body.reason, `429 body must carry .reason for ${route}: ${r2.raw}`);
    assert.match(r2.body.reason, /rate_limit|daily_cap/);

    // Wait briefly for stdout flush — short delays were flaky in CI for
    // similar bridge-hint telemetry tests.
    await new Promise(r => setTimeout(r, 600));

    const newLines = logLines.slice(before);
    const rlLine = newLines.find(l =>
      l.startsWith(tag) && l.includes('rate_limited_per_ip') && l.includes(route));
    assert.ok(rlLine, `expected ${tag} rate_limited_per_ip log for ${route}. Captured: ` +
      JSON.stringify(newLines.filter(l => l.startsWith(tag)).slice(0, 8)));

    const json = JSON.parse(rlLine.replace(new RegExp('^' + tag.replace(/[\[\]]/g, '\\$&') + '\\s*'), ''));
    assert.equal(json.schema, 'v1', `telemetry schema must be v1 for ${route}`);
    assert.equal(json.event, 'rate_limited_per_ip');
    assert.equal(json.route, route);
    assert.match(json.reason, /rate_limit|daily_cap/);
    assert.equal(typeof json.ip_hash, 'string', 'ip_hash must be a string');
    assert.equal(json.ip_hash.length, 16, 'ip_hash must be 16 hex chars');
    assert.equal(typeof json.ts, 'number', 'ts must be a number');

    // No raw IP anywhere in the line.
    assert.ok(
      !/(?:^|[^\d])(?:\d{1,3}\.){3}\d{1,3}(?:[^\d]|$)/.test(rlLine),
      'no raw dotted-quad IP in telemetry line: ' + rlLine
    );

    // Wait for the rate window to clear before the next route's first
    // request so cross-route isolation is preserved (each route has its
    // own pool, so this is belt-and-suspenders).
    await new Promise(r => setTimeout(r, 100));
  });
}

// ── Test 2: killswitch structural presence per route ─────────────────────
// We can't easily test the runtime behavior (requires respawn with env var)
// without rewriting the test harness. Structural lock-in prevents removal —
// same pattern as senebty-bridge-hint-endpoint.test.mjs killswitch test.
test('all 7 routes have SEBA_<ROUTE>_DISABLED killswitch with killswitch_active telemetry', () => {
  const apiSrc = readFileSync(API_FILE, 'utf8');
  for (const { route, ks } of ROUTES) {
    const routeIdx = apiSrc.indexOf(`app.post('${route}'`);
    assert.notEqual(routeIdx, -1, `route ${route} must be mounted`);
    const window = apiSrc.slice(routeIdx, routeIdx + 1500);
    assert.match(window, new RegExp(ks), `killswitch ${ks} must be checked in ${route}`);
    assert.match(window, /killswitch_active/, `killswitch_active telemetry must be emitted in ${route}`);
    assert.match(window, /res\.status\(503\)/, `killswitch must return 503 in ${route}`);
    // Killswitch must precede the per-IP rate-limit so a malformed-probe-during-incident
    // returns 503 (the route is OFF), not 429 (you're rate-limited).
    const ksIdx = window.indexOf(ks);
    const ipCheckIdx = window.indexOf('checkGeminiRouteIPLimits');
    assert.ok(ksIdx > 0, `${ks} must appear in ${route} window`);
    assert.ok(ipCheckIdx > 0, `checkGeminiRouteIPLimits must appear in ${route} window`);
    assert.ok(ksIdx < ipCheckIdx,
      `killswitch must precede checkGeminiRouteIPLimits in ${route} (got ks at ${ksIdx}, ip-check at ${ipCheckIdx})`);
  }
});

// ── Test 3: shared helper presence (lint-style, lock the design choice) ─
test('checkGeminiRouteIPLimits helper exists and is the single shared rate-limit gate', () => {
  const apiSrc = readFileSync(API_FILE, 'utf8');
  // Function declared exactly once.
  const decls = apiSrc.match(/function checkGeminiRouteIPLimits\b/g) || [];
  assert.equal(decls.length, 1, 'checkGeminiRouteIPLimits must be declared exactly once');
  // Used by each of the 7 routes (call site grep, not import-time).
  for (const { route } of ROUTES) {
    const routeIdx = apiSrc.indexOf(`app.post('${route}'`);
    const window = apiSrc.slice(routeIdx, routeIdx + 1500);
    assert.match(window, /checkGeminiRouteIPLimits\s*\(/,
      `${route} must call checkGeminiRouteIPLimits`);
  }
});
