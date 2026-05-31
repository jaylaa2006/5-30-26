// tests/senebty-foundation-screen-dispatch.test.mjs
// M3 Task 1: senebtyFoundation screen-dispatch fix.
// Verifies App.nav threads payload, screen handler branches on payload.key,
// and dispatch wires to each foundation module's namespace.
import fs from 'node:fs';
import assert from 'node:assert/strict';

let pass = 0, fail = 0;
function check(name, fn){
  try { fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e){ console.error(`  FAIL  ${name}\n        ${e.message}`); fail++; }
}

const html = fs.readFileSync('maat-reader.html', 'utf8');

check('App.nav signature accepts payload (second arg)', () => {
  // Match either fn-style or method-style with at least 2 params
  assert.match(html, /(nav\s*\(\s*\w+\s*,\s*\w+|nav\s*:\s*function\s*\(\s*\w+\s*,\s*\w+)/,
    'App.nav must accept (screenId, payload)');
});

// Find the dispatch handler block: the senebtyFoundation conditional that
// references _navPayload + branches on payload.key. Multiple
// `screen === 'senebtyFoundation'` conditionals exist (e.g., v3.51.43's
// backdrop-setup line); we want the dispatch handler specifically.
//
// Stage-2 Coach C3: the prior implementation returned the FIRST block
// containing both `_navPayload` and `.key`. Today exactly one such block
// exists (verified 2026-05-20: 2 needle matches, only the dispatch handler at
// ~6011697 carries both markers). But "return first of N" is a latent
// false-pass risk: if a future edit produced a SECOND `_navPayload`+`.key`
// block (e.g. a partial copy during a refactor), the test could silently
// validate the wrong block. Collect ALL matches and fail loud on ambiguity so
// the contract stays honest.
function findDispatchHandlerBlock() {
  const needle = "screen === 'senebtyFoundation'";
  const matches = [];
  let cursor = 0;
  while (cursor < html.length) {
    const idx = html.indexOf(needle, cursor);
    if (idx < 0) break;
    const block = html.slice(idx, idx + 5000);
    if (block.includes('_navPayload') && block.includes('.key')) {
      matches.push(block);
    }
    cursor = idx + needle.length;
  }
  if (matches.length === 0) {
    throw new Error('No senebtyFoundation dispatch handler (with _navPayload.key) found in maat-reader.html');
  }
  if (matches.length > 1) {
    throw new Error(
      `Ambiguous senebtyFoundation dispatch: ${matches.length} blocks carry _navPayload+.key. ` +
      'Expected exactly one dispatch handler — a refactor may have duplicated it. ' +
      'Disambiguate the test or de-duplicate the handler.',
    );
  }
  return matches[0];
}

check('senebtyFoundation handler branches on key payload', () => {
  const block = findDispatchHandlerBlock();
  for (const key of ['four-treasures', 'tjau', 'mu-streak']) {
    assert.ok(block.includes(key), `Handler must reference key '${key}'`);
  }
});

check('Each foundation module is referenced from the dispatch path', () => {
  const block = findDispatchHandlerBlock();
  for (const mod of ['foundationFourTreasures', 'foundationTjau', 'foundationMuStreak']) {
    assert.ok(block.includes(mod), `Dispatch must wire to ${mod}`);
  }
});

// Module-level: each F2/F3/F4 module must expose a render() method.
for (const [path, ns] of [
  ['senebty/lib/foundation-four-treasures.js', 'foundationFourTreasures'],
  ['senebty/lib/foundation-tjau.js', 'foundationTjau'],
  ['senebty/lib/foundation-mu-streak.js', 'foundationMuStreak'],
]){
  check(`${ns} module exposes render()`, () => {
    const src = fs.readFileSync(path, 'utf8');
    assert.match(src, /render\s*[:,]/, `${ns} must export render`);
    assert.match(src, new RegExp(`window\\.Senebty\\.${ns}\\s*=`));
  });
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
