// Lint: every server-side or frontend path that substitutes {name} into a
// user-facing string MUST go through senebty/lib/display-name.js helpers.
// Prevents the regression where new code uses raw user.name in template
// interpolation, causing lowercase names to render awkwardly.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FILES_TO_CHECK = [
  'server.js',
  'seba-story-api.mjs',
  'senebty/lib/foundation-render.js',
  // Add other files that historically substitute {name}
];

// Lines that legitimately use raw .replace(/{name}/g, ...) can be exempted
// with an inline // NOCHECK: comment explaining why. The lint still records
// them so they remain visible in grep — they simply don't fail the test.
// Current exemptions:
//   foundation-render.js fallback branch — _capName is itself the helper
//   alias (capitalizeName or inline fallback); path is unreachable after
//   v3.51.4 load-order wiring.
const ALLOWLIST_LINE_RE = [
  /\/\/ NOCHECK:/,
];

function isAllowlisted(line) {
  return ALLOWLIST_LINE_RE.some(re => re.test(line));
}

test('no raw user.name interpolation into {name} template paths', () => {
  const violations = [];
  for (const file of FILES_TO_CHECK) {
    const p = path.join(ROOT, file);
    if (!fs.existsSync(p)) continue;
    const lines = fs.readFileSync(p, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Look for `.replace(/\{name\}/g, ...)` (the old pattern)
      const replaceMatch = line.match(/\.replace\(\s*\/\\\{name\\\}\/g\s*,\s*([^)]+)\)/);
      if (replaceMatch) {
        const replacementArg = replaceMatch[1];
        // The replacement must reference `capitalizeName` or `substituteName`
        // or be the helper's own definition. Otherwise it's a raw substitution.
        if (!/capitalizeName|substituteName|SenebtyDisplayName/.test(replacementArg) && !isAllowlisted(line)) {
          violations.push(`${file}:${i+1}: raw .replace(/{name}/g, ${replacementArg.slice(0,40)}…) — must use helper`);
        }
      }
    }
  }
  if (violations.length) {
    assert.fail('\n' + violations.length + ' raw {name} substitution(s) found — convert to senebty/lib/display-name.js helper:\n  - ' + violations.join('\n  - '));
  }
});

test('renderHome in maat-reader.html uses helper for greeting', () => {
  const html = fs.readFileSync(path.join(ROOT, 'maat-reader.html'), 'utf8');
  // Find the renderHome `homeGreeting.textContent = ...` line and verify it
  // goes through the helper, not raw u.name.
  const m = html.match(/homeGreeting'\)\.textContent\s*=\s*([^;]+);/);
  if (!m) assert.fail('homeGreeting assignment not found');
  const expr = m[1];
  if (!/capitalizeName|SenebtyDisplayName|_displayName|_capName/.test(expr)) {
    assert.fail('homeGreeting uses raw name interpolation: ' + expr.slice(0, 80));
  }
});
