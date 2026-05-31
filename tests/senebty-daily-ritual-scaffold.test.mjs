// tests/senebty-daily-ritual-scaffold.test.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';

let pass = 0, fail = 0;
function check(name, fn){
  try { fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e){ console.error(`  FAIL  ${name}\n        ${e.message}`); fail++; }
}

const html = fs.readFileSync('maat-reader.html', 'utf8');
const css = fs.readFileSync('senebty/styles/senebty.css', 'utf8');
const ritualSrc = fs.readFileSync('senebty/lib/daily-ritual.js', 'utf8');

check('#senebtyDaily screen block present', () => {
  assert.match(html, /<div id="senebtyDaily"[^>]*class="screen"/);
});

check('Header band "Daily Senebty Ritual" present', () => {
  assert.match(html, /Daily Senebty Ritual/);
});

check('Step containers exist in order (1, 2, 3, 4)', () => {
  const idx = html.indexOf('id="senebtyDaily"');
  const slice = html.slice(idx, idx + 8000);
  const stepRe = /data-ritual-step="([1-4])"/g;
  const sliceMatches = [...slice.matchAll(stepRe)].map(m => m[1]);
  assert.deepEqual(sliceMatches.slice(0, 4), ['1','2','3','4']);
});

check('Canonical seal phrase exact match', () => {
  assert.match(html, /Senebty\. I iri today\./);
  assert.doesNotMatch(html, /Senebty! I iri today!/);
});

check('Seal button has WCAG 2.2 ≥44×44 hit area', () => {
  // v3.51.24 — accept any min-width/height ≥ 44px (current spec: 280×64).
  // Same regression class as v3.51.6/14a/17/19: over-strict literal-44px
  // regex breaks when source meets-or-exceeds the invariant. Security/UX
  // invariant preserved: seal-btn declares min-width AND min-height in px,
  // both ≥ 44.
  const blockRe = /\.senebty-ritual-seal-btn\s*\{([^}]+)\}/;
  const m = css.match(blockRe);
  assert.ok(m, '.senebty-ritual-seal-btn block must exist');
  const block = m[1];
  const minW = block.match(/min-width:\s*(\d+)px/);
  const minH = block.match(/min-height:\s*(\d+)px/);
  assert.ok(minW, 'seal-btn must declare min-width in px');
  assert.ok(minH, 'seal-btn must declare min-height in px');
  assert.ok(parseInt(minW[1], 10) >= 44, `seal-btn min-width ${minW[1]}px < 44 (WCAG 2.2)`);
  assert.ok(parseInt(minH[1], 10) >= 44, `seal-btn min-height ${minH[1]}px < 44 (WCAG 2.2)`);
});

check('Four-treasures rating uses 3-state, not 1-5', () => {
  const idx = html.indexOf('id="senebtyDaily"');
  const slice = html.slice(idx, idx + 8000);
  assert.doesNotMatch(slice, /value="1"[^>]*data-treasure-rating/);
  assert.match(slice, /data-treasure-rating="(weak|holding|strong)"/);
});

check('Ritual flips tier-modal._activeRitual on entry/exit', () => {
  assert.match(ritualSrc, /Senebty\.tierModal\._activeRitual\s*=\s*true/);
  assert.match(ritualSrc, /Senebty\.tierModal\._activeRitual\s*=\s*false/);
  assert.match(ritualSrc, /Senebty\.tierModal\.flushQueue\(\)/);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
