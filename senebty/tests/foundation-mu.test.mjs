#!/usr/bin/env node
// senebty/tests/foundation-mu.test.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const NS  = fs.readFileSync(new URL('../lib/namespace.js', import.meta.url), 'utf8');
const FM  = fs.readFileSync(new URL('../lib/foundation-mu.js', import.meta.url), 'utf8');

const ctx = { window: {}, Object, Date };
vm.createContext(ctx);
vm.runInContext(NS, ctx);
vm.runInContext(FM, ctx);

const M = ctx.window.Senebty.foundationMu;

let PASS = 0, FAIL = 0;
function check(name, fn){ try { fn(); console.log('PASS ' + name); PASS++; } catch(e){ console.error('FAIL ' + name + ' — ' + e.message); FAIL++; } }

check('exports phases array of length 4', () => {
  assert.ok(Array.isArray(M.PHASES));
  assert.equal(M.PHASES.length, 4);
});

check('phase 0 = Arrival, 1 = Pour, 2 = Drink, 3 = Rest', () => {
  assert.equal(M.PHASES[0].id, 'arrival');
  assert.equal(M.PHASES[1].id, 'pour');
  assert.equal(M.PHASES[2].id, 'drink');
  assert.equal(M.PHASES[3].id, 'rest');
});

check('drink phase is 12 seconds', () => {
  assert.equal(M.PHASES[2].durationMs, 12000);
});

check('isCompletedToday false when no iri yet', () => {
  const app = { user: { senebty: { iriLog: [] } } };
  assert.equal(M.isCompletedToday(app), false);
});

check('isCompletedToday true when foundation-1 was done today', () => {
  const app = { user: { senebty: { iriLog: [{ type:'WATER_IRI', lessonId:'foundation-1', ts: Date.now() }] } } };
  assert.equal(M.isCompletedToday(app), true);
});

check('isCompletedToday false when foundation-1 was done yesterday', () => {
  const yesterday = Date.now() - 26 * 60 * 60 * 1000;
  const app = { user: { senebty: { iriLog: [{ type:'WATER_IRI', lessonId:'foundation-1', ts: yesterday }] } } };
  assert.equal(M.isCompletedToday(app), false);
});

check('complete() calls App._iri.record with WATER_IRI / foundation-1 / cups:1', () => {
  let recorded = null;
  const app = {
    user: { senebty: { iriCompletedByLesson: {}, iriLog: [], tier: 0 } },
    _iri: { record: (payload) => { recorded = payload; } },
    saveUser(){ this._saved = true; },
    _checkTierAdvancement(){ this._advanced = true; }
  };
  M.complete(app);
  assert.ok(recorded, 'record was not called');
  assert.equal(recorded.type, 'WATER_IRI');
  assert.equal(recorded.lessonId, 'foundation-1');
  assert.equal(recorded.payload.cups, 1);
});

check('complete() is idempotent — second call same day does not double-record', () => {
  let calls = 0;
  const app = {
    user: { senebty: { iriLog: [{ type:'WATER_IRI', lessonId:'foundation-1', ts: Date.now() }], tier: 1 } },
    _iri: { record: () => { calls++; } },
    saveUser(){}, _checkTierAdvancement(){}
  };
  M.complete(app);
  assert.equal(calls, 0, 'should NOT call record on already-completed-today');
});

check('arrival copy matches tone canon (statement of fact, no exclam)', () => {
  const arrival = M.PHASES[0];
  assert.ok(/Mu is the Nile/.test(arrival.copy), 'arrival copy missing canonical line');
  assert.ok(!/!/.test(arrival.copy), 'no exclamation points allowed in Seba register');
});

console.log(`\n${PASS} passing, ${FAIL} failing`);
process.exit(FAIL ? 1 : 0);
