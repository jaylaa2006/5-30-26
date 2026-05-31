// senebty-account-deletion.test.mjs
// Static-pattern assertions that the account-deletion handler in
// seba-story-api.mjs wipes senebty server-side data and that a portability
// export endpoint exists (M3 Task 10).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const apiSrc = fs.readFileSync(path.join(repoRoot, 'seba-story-api.mjs'), 'utf8');

let pass = 0, fail = 0;
function check(name, fn){
  try { fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e){ console.error(`  FAIL  ${name}\n        ${e.message}`); fail++; }
}

check('Account-deletion handler wipes pending_teaching_iri', () => {
  assert.match(apiSrc, /DELETE\s+FROM\s+pending_teaching_iri\s+WHERE\s+user_id/i);
});

check('Account-deletion attempts senebty data wipes (defensive future-table refs)', () => {
  const hasWipeAttempt = apiSrc.includes('senebty_iri_log') || apiSrc.includes('senebty_four_treasures_log');
  assert.ok(hasWipeAttempt, 'Handler should reference senebty data wipe paths');
});

check('Senebty wipes are try/catch-wrapped (deploy-order safety)', () => {
  // Find the deletion section and assert try/catch presence around the senebty deletes
  const idx = apiSrc.indexOf("DELETE FROM pending_teaching_iri");
  assert.ok(idx > 0);
  const window = apiSrc.slice(Math.max(0, idx - 200), idx + 800);
  assert.match(window, /try\s*\{[^}]*pending_teaching_iri/);
});

check('Portability export endpoint present', () => {
  assert.match(apiSrc, /\/api\/senebty\/export/);
});

check('Export endpoint requires auth (parent JWT)', () => {
  // Find /api/senebty/export route and confirm requireAuth is used
  const m = apiSrc.match(/app\.get\(\s*['"]\/api\/senebty\/export['"]\s*,\s*requireAuth/);
  assert.ok(m, 'export endpoint should use requireAuth');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
