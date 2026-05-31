#!/usr/bin/env node
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const SRC = fs.readFileSync(new URL('../data/sources/maxims-of-ptahhotep.js', import.meta.url), 'utf8');
const ctx = { module: { exports: null } };
vm.createContext(ctx);
vm.runInContext(SRC, ctx);
const maxims = ctx.module.exports;

let PASS = 0, FAIL = 0;
function check(name, fn){ try { fn(); console.log('PASS '+name); PASS++; } catch(e){ console.error('FAIL '+name+' — '+e.message); FAIL++; } }

check('exports an array', () => assert.ok(Array.isArray(maxims)));
check('at least 12 maxims', () => assert.ok(maxims.length >= 12, `expected ≥12, got ${maxims.length}`));

const VIRTUES = ['Truth', 'Justice', 'Harmony', 'Balance', 'Reciprocity', 'Propriety', 'Righteous Order'];
for (const v of VIRTUES){
  check(`virtue '${v}' has at least one maxim`, () => {
    const matches = maxims.filter(m => m.themes.includes(v));
    assert.ok(matches.length > 0, `no maxim covers virtue ${v}`);
  });
}

for (const m of maxims){
  check(`maxim ${m.id} required fields`, () => {
    assert.equal(typeof m.id, 'number');
    assert.ok(m.id >= 1 && m.id <= 37);
    assert.equal(m.source, 'Maxims of Ptahhotep');
    assert.equal(m.primarySource, 'Prisse Papyrus');
    assert.ok(typeof m.attribution === 'string' && m.attribution.length > 0);
    assert.ok(Array.isArray(m.scholarlyTranslations) && m.scholarlyTranslations.length > 0);
    for (const t of m.scholarlyTranslations){
      assert.ok(typeof t.translator === 'string');
      assert.ok(Number.isInteger(t.year));
      assert.ok(typeof t.text === 'string' && t.text.length > 5);
    }
    assert.ok(Array.isArray(m.themes) && m.themes.length > 0);
    assert.ok(m.childAccessible);
    assert.ok(typeof m.childAccessible.YOUNG === 'string' && m.childAccessible.YOUNG.length > 5);
    assert.ok(typeof m.childAccessible.ELDER === 'string' && m.childAccessible.ELDER.length > 5);
    assert.ok(Array.isArray(m.hintRegisters) && m.hintRegisters.length > 0);
    assert.ok(['high', 'medium'].includes(m.confidence));
  });
}

check('IDs are unique', () => {
  const ids = maxims.map(m => m.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate maxim IDs');
});

console.log(`\n${PASS} passing, ${FAIL} failing`);
process.exit(FAIL ? 1 : 0);
