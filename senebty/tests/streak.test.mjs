#!/usr/bin/env node
// Structural + behavioural validator for Senebty streak engine.
// Loads namespace.js + tiers.js + iri.js + streak.js via runInContext,
// then exercises the streak/pause methods on window.Senebty.iri.

import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const NS = fs.readFileSync(new URL('../lib/namespace.js', import.meta.url), 'utf8');
const TIERS = fs.readFileSync(new URL('../lib/tiers.js', import.meta.url), 'utf8');
const IRI = fs.readFileSync(new URL('../lib/iri.js', import.meta.url), 'utf8');
const STREAK = fs.readFileSync(new URL('../lib/streak.js', import.meta.url), 'utf8');

const ctx = { window: {}, Object };
vm.createContext(ctx);
vm.runInContext(NS, ctx);
vm.runInContext(TIERS, ctx);
vm.runInContext(IRI, ctx);
vm.runInContext(STREAK, ctx);

const iriObject = ctx.window.Senebty.iri;

// ─── stub App factory ─────────────────────────────────────────────────────────

function makeApp() {
  const App = {
    user: {
      senebty: {
        tier: 0,
        iriLog: [],
        iriCompletedByLesson: {},
        pendingParentConfirmations: [],
        streakDays: 0,
        longestStreak: 0,
        lastRitualDate: null,
        fourTreasuresLog: [],
        giftsUnlocked: [],
        hekaPhrasePersonal: null,
        hekaPhraseSetAt: null,
        hekaPhraseEditableByChild: true,
        introViewed: false,
        enteredAt: null,
        streakPause: {
          active: false,
          startedAt: null,
          endsAt: null,
          daysUsedThisMonth: 0,
          monthCounterResetAt: null
        }
      }
    },
    saveUser() { /* no-op stub */ }
  };
  App._iri = iriObject;
  return App;
}

// ─── date helper ─────────────────────────────────────────────────────────────

function dayMs(yyyy, mm, dd) {
  return Date.UTC(yyyy, mm - 1, dd, 12, 0, 0);
}

// ─── check helper ─────────────────────────────────────────────────────────────

let PASS = 0, FAIL = 0;
function check(name, fn) {
  try { fn(); console.log('PASS ' + name); PASS++; }
  catch (e) { console.error('FAIL ' + name + ' — ' + e.message); FAIL++; }
}

// ─── Test 1: first ritual sets streakDays=1, longestStreak=1 ─────────────────

check('first ritual sets streakDays===1 and longestStreak===1', () => {
  const A = makeApp();
  const result = A._iri.recordRitualToday.call(A, { now: dayMs(2026, 4, 25) });
  assert.equal(A.user.senebty.streakDays, 1,
    `streakDays should be 1, got ${A.user.senebty.streakDays}`);
  assert.equal(A.user.senebty.longestStreak, 1,
    `longestStreak should be 1, got ${A.user.senebty.longestStreak}`);
  assert.equal(result.streakDays, 1, `result.streakDays should be 1, got ${result.streakDays}`);
});

// ─── Test 2: three consecutive days → streakDays=3, longestStreak=3 ──────────

check('three consecutive UTC days → streakDays===3, longestStreak===3', () => {
  const A = makeApp();
  A._iri.recordRitualToday.call(A, { now: dayMs(2026, 4, 25) });
  A._iri.recordRitualToday.call(A, { now: dayMs(2026, 4, 26) });
  A._iri.recordRitualToday.call(A, { now: dayMs(2026, 4, 27) });
  assert.equal(A.user.senebty.streakDays, 3,
    `streakDays should be 3, got ${A.user.senebty.streakDays}`);
  assert.equal(A.user.senebty.longestStreak, 3,
    `longestStreak should be 3, got ${A.user.senebty.longestStreak}`);
});

// ─── Test 3: skipping a day resets streak to 1 ───────────────────────────────

check('skipping a day (Apr 25 then Apr 27) → streakDays===1', () => {
  const A = makeApp();
  A._iri.recordRitualToday.call(A, { now: dayMs(2026, 4, 25) });
  A._iri.recordRitualToday.call(A, { now: dayMs(2026, 4, 27) });
  assert.equal(A.user.senebty.streakDays, 1,
    `streakDays should be 1 after skip, got ${A.user.senebty.streakDays}`);
});

// ─── Test 4: same-day double-call is idempotent ───────────────────────────────

check('same-day double-call is idempotent → streakDays===1', () => {
  const A = makeApp();
  A._iri.recordRitualToday.call(A, { now: dayMs(2026, 4, 25) });
  // second call 60s later, still same UTC day
  A._iri.recordRitualToday.call(A, { now: dayMs(2026, 4, 25) + 60000 });
  assert.equal(A.user.senebty.streakDays, 1,
    `streakDays should be 1 (idempotent), got ${A.user.senebty.streakDays}`);
});

// ─── Test 5: streak pause covers the gap ─────────────────────────────────────

check('streak pause covers gap (Apr 25 → pause Apr 26-28 → record Apr 28) → streakDays===2', () => {
  const A = makeApp();
  // Record Apr 25
  A._iri.recordRitualToday.call(A, { now: dayMs(2026, 4, 25) });
  // Set up pause window covering Apr 26–28
  A.user.senebty.streakPause.active = true;
  A.user.senebty.streakPause.startedAt = dayMs(2026, 4, 26);
  A.user.senebty.streakPause.endsAt = dayMs(2026, 4, 28);
  // Record Apr 28 (gap covered by pause)
  A._iri.recordRitualToday.call(A, { now: dayMs(2026, 4, 28) });
  assert.equal(A.user.senebty.streakDays, 2,
    `streakDays should be 2 (pause covered gap), got ${A.user.senebty.streakDays}`);
});

// ─── Test 6: monthly pause counter resets on month change ────────────────────

check('monthly pause counter resets on month change (Apr→May)', () => {
  const A = makeApp();
  A.user.senebty.streakPause.daysUsedThisMonth = 3;
  A.user.senebty.streakPause.monthCounterResetAt = dayMs(2026, 4, 1);
  // Record on May 1 — month changed, so daysUsedThisMonth should reset to 0
  A._iri.recordRitualToday.call(A, { now: dayMs(2026, 5, 1) });
  assert.equal(A.user.senebty.streakPause.daysUsedThisMonth, 0,
    `daysUsedThisMonth should be 0 after month change, got ${A.user.senebty.streakPause.daysUsedThisMonth}`);
});

// ─── Test 7: computeStreakDelta returns {delta:1, willResetTo:null} next day ──

check('computeStreakDelta after first ritual on next day → {delta:1, willResetTo:null}', () => {
  const A = makeApp();
  A._iri.recordRitualToday.call(A, { now: dayMs(2026, 4, 25) });
  const result = A._iri.computeStreakDelta.call(A, { now: dayMs(2026, 4, 26) });
  assert.equal(result.delta, 1, `delta should be 1, got ${result.delta}`);
  assert.equal(result.willResetTo, null,
    `willResetTo should be null, got ${result.willResetTo}`);
});

// ─── Test 8: computeStreakDelta after skip returns {willResetTo:1} ────────────

check('computeStreakDelta after skip (2 days later) → {delta:0, willResetTo:1}', () => {
  const A = makeApp();
  A._iri.recordRitualToday.call(A, { now: dayMs(2026, 4, 25) });
  // 2 days after = skip day
  const result = A._iri.computeStreakDelta.call(A, { now: dayMs(2026, 4, 27) });
  assert.equal(result.willResetTo, 1,
    `willResetTo should be 1, got ${result.willResetTo}`);
  assert.equal(result.delta, 0, `delta should be 0, got ${result.delta}`);
});

// ─── Test 9: stale pause does NOT bridge gap weeks later (regression for I1) ─

check('stale pause does NOT bridge gap weeks later', () => {
  const A = makeApp();
  A.user.senebty.lastRitualDate = dayMs(2026, 4, 10);
  A.user.senebty.streakDays = 5;
  A.user.senebty.streakPause = {
    active: false,
    startedAt: dayMs(2026, 4, 11),
    endsAt: dayMs(2026, 4, 13),
    daysUsedThisMonth: 2,
    monthCounterResetAt: dayMs(2026, 4, 1)
  };
  A._iri.recordRitualToday.call(A, { now: dayMs(2026, 5, 15) });
  assert.equal(A.user.senebty.streakDays, 1,
    `streakDays should reset to 1 (stale pause must not bridge), got ${A.user.senebty.streakDays}`);
});

// ─── Test 10: incrementPauseDays adds and caps at 3 ──────────────────────────

check('incrementPauseDays adds and caps at 3', () => {
  const A = makeApp();
  const r1 = A._iri.incrementPauseDays.call(A, 2, dayMs(2026, 4, 5));
  assert.equal(r1, 2, `first call should return 2, got ${r1}`);
  assert.equal(A.user.senebty.streakPause.daysUsedThisMonth, 2,
    `daysUsedThisMonth should be 2, got ${A.user.senebty.streakPause.daysUsedThisMonth}`);
  const r2 = A._iri.incrementPauseDays.call(A, 1, dayMs(2026, 4, 6));
  assert.equal(r2, 3, `second call should return 3, got ${r2}`);
  const r3 = A._iri.incrementPauseDays.call(A, 1, dayMs(2026, 4, 7));
  assert.equal(r3, 3, `third call should still return 3 (capped), got ${r3}`);
  const r4 = A._iri.incrementPauseDays.call(A, 1, dayMs(2026, 5, 1));
  assert.equal(r4, 1, `month rollover should return 1, got ${r4}`);
});

// ─── summary ─────────────────────────────────────────────────────────────────

console.log(`\n${PASS} passing, ${FAIL} failing`);
process.exit(FAIL ? 1 : 0);
