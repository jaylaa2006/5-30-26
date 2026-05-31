#!/usr/bin/env node
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const NS  = fs.readFileSync(new URL('../lib/namespace.js',      import.meta.url), 'utf8');
const SRC = fs.readFileSync(new URL('../lib/user-migration.js', import.meta.url), 'utf8');

const ctx = { window: {}, Object };
vm.createContext(ctx);
vm.runInContext(NS,  ctx);
vm.runInContext(SRC, ctx);

const migrate = ctx.window.Senebty.migrate;

let PASS = 0, FAIL = 0;
function check(name, fn){ try { fn(); console.log('PASS ' + name); PASS++; } catch(e){ console.error('FAIL ' + name + ' — ' + e.message); FAIL++; } }

check('migrate exists as function', () => assert.equal(typeof migrate, 'function'));

check('fresh user gets full senebty namespace', () => {
  const u = {};
  migrate(u);
  assert.ok(u.senebty);
  assert.equal(u.senebty.tier, 0);
  assert.ok(Array.isArray(u.senebty.iriLog) && u.senebty.iriLog.length === 0);
  assert.ok(u.senebty.iriCompletedByLesson && typeof u.senebty.iriCompletedByLesson === 'object' && !Array.isArray(u.senebty.iriCompletedByLesson));
  assert.equal(u.senebty.streakDays, 0);
  assert.equal(u.senebty.longestStreak, 0);
  assert.equal(u.senebty.lastRitualDate, null);
  assert.ok(Array.isArray(u.senebty.fourTreasuresLog) && u.senebty.fourTreasuresLog.length === 0);
  assert.ok(Array.isArray(u.senebty.pendingParentConfirmations) && u.senebty.pendingParentConfirmations.length === 0);
  assert.ok(Array.isArray(u.senebty.giftsUnlocked) && u.senebty.giftsUnlocked.length === 0);
  assert.equal(u.senebty.hekaPhrasePersonal, null);
  assert.equal(u.senebty.hekaPhraseSetAt, null);
  assert.equal(u.senebty.hekaPhraseEditableByChild, true);
  assert.equal(u.senebty.introViewed, false);
  assert.equal(u.senebty.enteredAt, null);
  assert.ok(u.senebty.streakPause);
  assert.equal(u.senebty.streakPause.active, false);
  assert.equal(u.senebty.streakPause.startedAt, null);
  assert.equal(u.senebty.streakPause.endsAt, null);
  assert.equal(u.senebty.streakPause.daysUsedThisMonth, 0);
  assert.equal(u.senebty.streakPause.monthCounterResetAt, null);
  assert.equal(u.senebty.firstCrossSeen, false);
  assert.equal(u.senebty.firstReturnSeen, false);
  assert.equal(u.gradeSource, null);
});

check('returning user with existing senebty data is NOT overwritten', () => {
  const u = { senebty: { tier:3, iriLog:[{lessonId:'x'}], streakDays:14 } };
  migrate(u);
  assert.equal(u.senebty.tier, 3);
  assert.equal(u.senebty.iriLog.length, 1);
  assert.equal(u.senebty.streakDays, 14);
});

check('else-branch: missing fields get defaults (hekaPhraseEditableByChild)', () => {
  const u = { senebty: { tier:7, iriLog:[{type:'BREATH_IRI'}] } };
  migrate(u);
  assert.equal(u.senebty.hekaPhraseEditableByChild, true);
  assert.ok(Array.isArray(u.senebty.fourTreasuresLog) && u.senebty.fourTreasuresLog.length === 0);
});

check('else-branch: missing firstCrossSeen/firstReturnSeen get false defaults', () => {
  const u = { senebty: { tier:2, iriLog:[] } };
  migrate(u);
  assert.equal(u.senebty.firstCrossSeen, false);
  assert.equal(u.senebty.firstReturnSeen, false);
});

check('else-branch: existing firstCrossSeen/firstReturnSeen values are preserved', () => {
  const u = { senebty: { tier:2, iriLog:[], firstCrossSeen:true, firstReturnSeen:true } };
  migrate(u);
  assert.equal(u.senebty.firstCrossSeen, true);
  assert.equal(u.senebty.firstReturnSeen, true);
});

check('else-branch: missing streakPause gets default shape', () => {
  const u = { senebty: { tier:1 } };
  migrate(u);
  assert.ok(u.senebty.streakPause && typeof u.senebty.streakPause === 'object');
  assert.equal(u.senebty.streakPause.active, false);
  assert.equal(u.senebty.streakPause.daysUsedThisMonth, 0);
});

check('user with custom gradeSource is preserved', () => {
  const u = { gradeSource: 'parent-confirmed' };
  migrate(u);
  assert.equal(u.gradeSource, 'parent-confirmed');
});

// Phase v3.33.0 — Seba audio parent toggle (default on, opt-out).
check('fresh user gets settings.sebaVoice defaulted to true', () => {
  const u = {};
  migrate(u);
  assert.ok(u.settings && typeof u.settings === 'object');
  assert.equal(u.settings.sebaVoice, true);
});

check('existing user without settings gets settings.sebaVoice = true', () => {
  const u = { senebty: { tier: 4 } };
  migrate(u);
  assert.equal(u.settings.sebaVoice, true);
});

check('user with settings.sebaVoice = false is preserved (opt-out respected)', () => {
  const u = { settings: { sebaVoice: false } };
  migrate(u);
  assert.equal(u.settings.sebaVoice, false);
});

check('user with settings.sebaVoice = true is preserved', () => {
  const u = { settings: { sebaVoice: true } };
  migrate(u);
  assert.equal(u.settings.sebaVoice, true);
});

check('user with non-boolean settings.sebaVoice gets coerced to true default', () => {
  const u = { settings: { sebaVoice: 'on' } };
  migrate(u);
  assert.equal(u.settings.sebaVoice, true);
});

check('migrate preserves other settings keys', () => {
  const u = { settings: { foo: 'bar' } };
  migrate(u);
  assert.equal(u.settings.foo, 'bar');
  assert.equal(u.settings.sebaVoice, true);
});

check('idempotent — second call does not overwrite existing data', () => {
  const u = {};
  migrate(u);
  u.senebty.tier = 5;
  migrate(u);
  assert.equal(u.senebty.tier, 5);
});

console.log(`\n${PASS} passing, ${FAIL} failing`);
process.exit(FAIL ? 1 : 0);
