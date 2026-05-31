// tests/senebty-glyph-verdicts.test.mjs
// Asserts the M1 glyph verdicts are applied to glossary-entries.js per the M1 RT verdict doc.
import fs from 'node:fs';
import assert from 'node:assert/strict';

const src = fs.readFileSync('senebty/lib/glossary-entries.js', 'utf8');
const rt = fs.readFileSync('docs/superpowers/round-tables/2026-05-04-senebty-m1-cultural-consensus-glyph-verdicts.md', 'utf8');
let pass = 0, fail = 0;

function check(name, fn){
  try { fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e){ console.error(`  FAIL  ${name}\n        ${e.message}`); fail++; }
}

const verdictTjau = /## Tjau[\s\S]*?\*\*Verdict:\*\*\s*(HIGH|NONE)/i.exec(rt)?.[1];
const verdictHesi = /## Hesi[\s\S]*?\*\*Verdict:\*\*\s*(HIGH|NONE)/i.exec(rt)?.[1];
const verdictHeka = /## Heka[\s\S]*?\*\*Verdict:\*\*\s*(HIGH|NONE)/i.exec(rt)?.[1];

check('M1 RT verdicts parsed', () => {
  assert.ok(verdictTjau, 'Tjau verdict not found in M1 RT doc');
  assert.ok(verdictHesi, 'Hesi verdict not found in M1 RT doc');
  assert.ok(verdictHeka, 'Heka verdict not found in M1 RT doc');
});

function entryConfidence(slug){
  const re = new RegExp(`['"]?${slug}['"]?\\s*:\\s*\\{[^}]*?confidence\\s*:\\s*['"]([a-z]+)['"]`, 'm');
  const m = re.exec(src);
  return m ? m[1] : null;
}

check('Tjau glossary confidence matches M1 verdict', () => {
  const expected = verdictTjau === 'HIGH' ? 'high' : 'none';
  assert.equal(entryConfidence('tjau'), expected, `Expected ${expected}, got ${entryConfidence('tjau')}`);
});

check('Hesi glossary confidence matches M1 verdict', () => {
  const expected = verdictHesi === 'HIGH' ? 'high' : 'none';
  assert.equal(entryConfidence('hesi'), expected);
});

check('Heka glossary confidence matches M1 verdict', () => {
  const expected = verdictHeka === 'HIGH' ? 'high' : 'none';
  assert.equal(entryConfidence('heka'), expected);
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
