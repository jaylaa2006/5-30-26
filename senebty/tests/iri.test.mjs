#!/usr/bin/env node
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const NS = fs.readFileSync(new URL('../lib/namespace.js', import.meta.url), 'utf8');
const TIERS = fs.readFileSync(new URL('../lib/tiers.js', import.meta.url), 'utf8');
const IRI = fs.readFileSync(new URL('../lib/iri.js', import.meta.url), 'utf8');

const ctx = { window: {}, Object };
vm.createContext(ctx);
vm.runInContext(NS, ctx);
vm.runInContext(TIERS, ctx);
vm.runInContext(IRI, ctx);

const iri = ctx.window.Senebty.iri;

let PASS = 0, FAIL = 0;
function check(name, fn){ try { fn(); console.log('PASS ' + name); PASS++; } catch(e){ console.error('FAIL ' + name + ' — ' + e.message); FAIL++; } }

check('iri.TYPES is frozen and contains 8 entries', () => {
  assert.ok(iri.TYPES, 'TYPES missing');
  assert.ok(Object.isFrozen(iri.TYPES), 'TYPES not frozen');
  assert.equal(Object.keys(iri.TYPES).length, 8);
});

check('iri.TYPES has the 8 canonical iri types', () => {
  for (const k of ['BREATH_IRI','VOICE_IRI','WATER_IRI','PHOTO_IRI','STREAK_IRI','CREATION_IRI','TEACHING_IRI','BODY_IRI']){
    assert.ok(iri.TYPES[k], 'missing ' + k);
  }
});

// Smoke test: record + isCompleted on a stub App
function makeStubApp(){
  return {
    user: { senebty: { tier:0, iriLog:[], iriCompletedByLesson:{}, pendingParentConfirmations:[], streakDays:0, longestStreak:0, lastRitualDate:null, streakPause:{ active:false, startedAt:null, endsAt:null, daysUsedThisMonth:0, monthCounterResetAt:null }, firstCrossSeen:false, firstReturnSeen:false } },
    saveUser(){ this._saveCount = (this._saveCount||0) + 1; },
    _iri: iri,
  };
}

check('record() appends to iriLog and saves', () => {
  const app = makeStubApp();
  app._iri.record.call(app, { lessonId:'foundation-1', type:'BREATH_IRI', payload:{} });
  assert.equal(app.user.senebty.iriLog.length, 1);
  assert.equal(app.user.senebty.iriLog[0].lessonId, 'foundation-1');
  assert.equal(app._saveCount, 1);
});

check('isCompleted() returns true after record()', () => {
  const app = makeStubApp();
  app._iri.record.call(app, { lessonId:'foundation-2', type:'BREATH_IRI', payload:{} });
  assert.equal(app._iri.isCompleted.call(app, 'foundation-2'), true);
  assert.equal(app._iri.isCompleted.call(app, 'foundation-99'), false);
});

check('record() throws on unknown iri type', () => {
  const app = makeStubApp();
  assert.throws(
    () => app._iri.record.call(app, { lessonId:'foundation-3', type:'BOGUS_IRI', payload:{} }),
    /unknown iri type/
  );
});

console.log(`\n${PASS} passing, ${FAIL} failing`);
process.exit(FAIL ? 1 : 0);
