// tests/senebty-daily-foundation-gate.test.mjs — v3.51.43
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';

// ── Senebty data helpers ──────────────────────────────────────────────────────
// Loads a foundation story.js into a sandbox and returns the window.Senebty
// namespace it populates. Used to build a realistic Senebty fixture for the
// strand-prevention tests without requiring a browser.
function _loadStoryIntoSenebty(relPath, senebtyObj, moduleObj) {
  const src = fs.readFileSync(relPath, 'utf8');
  const sandbox = {
    window: { Senebty: senebtyObj },
    module: moduleObj || {},
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
}

// Builds a window.Senebty fixture that mirrors the real browser state:
//   - F1-F8: all foundations have full dailyFoundation with non-empty microTeachings
//     (F7 senedjem shipped 21 microTeachings 2026-05-20 — Task 3)
//     (F8 heka shipped 21 microTeachings 2026-05-20 — Task 3)
// The fixture loads the REAL story.js files, so it tracks the live data.
function _buildSenebtyFixture() {
  const senebty = {};
  const complete = ['01-mu', '02-four-treasures', '03-tjau', '04-mu-streak', '05-wedeha', '06-hesi', '07-senedjem', '08-heka'];

  for (const dir of complete) {
    const storyPath = `senebty/data/foundations/${dir}/story.js`;
    _loadStoryIntoSenebty(storyPath, senebty, { exports: {} });
  }
  return senebty;
}

function loadGateModule() {
  const src = fs.readFileSync('senebty/lib/daily-foundation-gate.js', 'utf8');
  const sandbox = { window: { Senebty: {} }, console };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox.window;
}

// Gate loaded with a fully-populated window.Senebty (mirrors the real browser).
function loadGateModuleWithSenebty() {
  const src = fs.readFileSync('senebty/lib/daily-foundation-gate.js', 'utf8');
  const senebty = _buildSenebtyFixture();
  const sandbox = { window: { Senebty: senebty }, console };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox.window;
}

const FOUNDATION_ORDER = ['mu', 'four-treasures', 'tjau', 'mu-streak', 'wedeha', 'hesi', 'senedjem', 'heka'];

test('getTodaysFoundation: first session (empty log) returns F1 mu', () => {
  const win = loadGateModuleWithSenebty();
  assert.ok(win.__InstallDailyFoundationGate__, 'installer must exist');
  const App = { user: { id: 'u1', senebty: { dailyFoundationLog: {} } } };
  win.__InstallDailyFoundationGate__(App);
  const today = '2026-05-17';
  const slug = App.dailyFoundationGate.getTodaysFoundation(App.user, today);
  assert.equal(slug, 'mu', 'day 1 with empty log must be mu (F1)');
});

test('getTodaysFoundation: day N of first-8 sequenced phase returns the Nth slug in order', () => {
  const win = loadGateModuleWithSenebty();
  const App = { user: { id: 'u1', senebty: { dailyFoundationLog: {
    '2026-05-10': { slug: 'mu', completed: true },
    '2026-05-11': { slug: 'four-treasures', completed: true },
    '2026-05-12': { slug: 'tjau', completed: true },
  } } } };
  win.__InstallDailyFoundationGate__(App);
  const today = '2026-05-13';
  const slug = App.dailyFoundationGate.getTodaysFoundation(App.user, today);
  // complete set = [mu, four-treasures, tjau, mu-streak, wedeha]; count=3 → complete[3] = mu-streak
  assert.equal(slug, 'mu-streak', 'day 4 of intro phase must be mu-streak (F4, index 3 in complete set)');
});

test('getTodaysFoundation: deterministic per (user, date) — same call returns same result', () => {
  const win = loadGateModuleWithSenebty();
  const App = { user: { id: 'u1', senebty: { dailyFoundationLog: {} } } };
  win.__InstallDailyFoundationGate__(App);
  const today = '2026-05-17';
  const a = App.dailyFoundationGate.getTodaysFoundation(App.user, today);
  const b = App.dailyFoundationGate.getTodaysFoundation(App.user, today);
  assert.equal(a, b, 'idempotent same-day call');
});

test('getTodaysFoundation: day-N pick is RECORDED in dailyFoundationLog (write-on-pick)', () => {
  const win = loadGateModuleWithSenebty();
  const App = { user: { id: 'u1', senebty: { dailyFoundationLog: {} } } };
  win.__InstallDailyFoundationGate__(App);
  const today = '2026-05-17';
  App.dailyFoundationGate.getTodaysFoundation(App.user, today);
  assert.ok(App.user.senebty.dailyFoundationLog[today], `log entry for ${today} must be created on pick`);
  assert.equal(App.user.senebty.dailyFoundationLog[today].slug, 'mu');
  assert.equal(App.user.senebty.dailyFoundationLog[today].completed, false);
});

test('day 9+ phase: excludes yesterday from selection', () => {
  const win = loadGateModuleWithSenebty();
  const log = {};
  // Use only complete foundations in the log so yesterday is a complete slug (wedeha).
  // All 8 slugs are now complete (Task 3 F8, 2026-05-20); this test validates
  // the within-complete-set yesterday-exclusion (yesterday = wedeha, must not be picked).
  // NOTE: senedjem (F7) and heka (F8) are now complete with 21 microTeachings each.
  COMPLETE_SLUGS.forEach((slug, i) => {
    const date = `2026-05-${String(10 + i).padStart(2, '0')}`;
    log[date] = { slug, completed: true };
  });
  // Add 3 more to push firmly into practice phase (count >= INTRO_DAYS=8)
  ['mu', 'four-treasures', 'wedeha'].forEach((slug, i) => {
    const date = `2026-05-${String(15 + i).padStart(2, '0')}`;
    log[date] = { slug, completed: true };
  });
  // Last completed before today (2026-05-18:*) is 2026-05-17 → wedeha
  const App = { user: { id: 'u1', senebty: { dailyFoundationLog: log } } };
  win.__InstallDailyFoundationGate__(App);
  for (let i = 0; i < 50; i++) {
    const today = `2026-05-18:${i}`;
    delete App.user.senebty.dailyFoundationLog[today];
    const slug = App.dailyFoundationGate.getTodaysFoundation(App.user, today);
    assert.notEqual(slug, 'wedeha', `yesterday (wedeha) must not be picked; got ${slug}`);
  }
});

test('day 9+ phase: prefers least-recent foundation (weighted)', () => {
  const win = loadGateModuleWithSenebty();
  const log = {};
  // First pass: all 5 complete foundations completed in April (oldest entries).
  COMPLETE_SLUGS.forEach((slug, i) => {
    const date = `2026-04-${String(10 + i).padStart(2, '0')}`;
    log[date] = { slug, completed: true };
  });
  // Second pass: F2-F5 completed again in May, but NOT mu (F1) — making mu the
  // least-recently completed complete foundation, so the weighted picker strongly
  // favors mu.
  COMPLETE_SLUGS.slice(1).forEach((slug, i) => {
    const date = `2026-05-${String(10 + i).padStart(2, '0')}`;
    log[date] = { slug, completed: true };
  });
  const App = { user: { id: 'u1', senebty: { dailyFoundationLog: log } } };
  win.__InstallDailyFoundationGate__(App);

  let muCount = 0;
  for (let i = 0; i < 100; i++) {
    const today = `2026-05-18:trial-${i}`;
    delete App.user.senebty.dailyFoundationLog[today];
    const slug = App.dailyFoundationGate.getTodaysFoundation(App.user, today);
    if (slug === 'mu') muCount++;
  }
  assert.ok(muCount >= 40, `weighted toward least-recent: mu should land >=40/100, got ${muCount}`);
});

test('day 9+ phase: deterministic per (user.id, today) when explicitly seeded', () => {
  const win = loadGateModuleWithSenebty();
  const log = {};
  // Use complete foundations only for a clean practice-phase log
  COMPLETE_SLUGS.forEach((slug, i) => {
    const date = `2026-05-${String(10 + i).padStart(2, '0')}`;
    log[date] = { slug, completed: true };
  });
  // 3 more for practice phase
  ['mu', 'four-treasures', 'tjau'].forEach((slug, i) => {
    const date = `2026-05-${String(15 + i).padStart(2, '0')}`;
    log[date] = { slug, completed: true };
  });
  const A1 = { user: { id: 'user-A', senebty: { dailyFoundationLog: JSON.parse(JSON.stringify(log)) } } };
  const A2 = { user: { id: 'user-A', senebty: { dailyFoundationLog: JSON.parse(JSON.stringify(log)) } } };
  win.__InstallDailyFoundationGate__(A1);
  win.__InstallDailyFoundationGate__(A2);
  const today = '2026-05-18';
  assert.equal(
    A1.dailyFoundationGate.getTodaysFoundation(A1.user, today),
    A2.dailyFoundationGate.getTodaysFoundation(A2.user, today),
    'same user.id + same today must produce same slug'
  );
});

test('recordCompletion: marks today complete + sets completedAt + micro', () => {
  const win = loadGateModuleWithSenebty();
  const App = { user: { id: 'u1', senebty: { dailyFoundationLog: {} } } };
  win.__InstallDailyFoundationGate__(App);
  const today = '2026-05-17';
  App.dailyFoundationGate.getTodaysFoundation(App.user, today);
  App.dailyFoundationGate.recordCompletion(App.user, today, 7);
  const entry = App.user.senebty.dailyFoundationLog[today];
  assert.equal(entry.completed, true);
  assert.ok(entry.completedAt > 0, 'completedAt timestamp set');
  assert.equal(entry.micro, 7);
});

test('getStreak: continuous completed days', () => {
  const win = loadGateModule();
  const App = { user: { id: 'u1', senebty: { dailyFoundationLog: {
    '2026-05-13': { slug: 'mu', completed: true },
    '2026-05-14': { slug: 'four-treasures', completed: true },
    '2026-05-15': { slug: 'tjau', completed: true },
    '2026-05-16': { slug: 'mu-streak', completed: true },
    '2026-05-17': { slug: 'wedeha', completed: true },
  } } } };
  win.__InstallDailyFoundationGate__(App);
  assert.equal(App.dailyFoundationGate.getStreak(App.user, '2026-05-17'), 5);
});

test('getStreak: 1-day grace (1 missed day in middle does NOT reset)', () => {
  const win = loadGateModule();
  const App = { user: { id: 'u1', senebty: { dailyFoundationLog: {
    '2026-05-13': { slug: 'mu', completed: true },
    '2026-05-14': { slug: 'four-treasures', completed: true },
    '2026-05-16': { slug: 'mu-streak', completed: true },
    '2026-05-17': { slug: 'wedeha', completed: true },
  } } } };
  win.__InstallDailyFoundationGate__(App);
  assert.equal(App.dailyFoundationGate.getStreak(App.user, '2026-05-17'), 4, '1-day gap = grace; streak continues');
});

test('getStreak: 2+ consecutive missed days RESETS to current run only', () => {
  const win = loadGateModule();
  const App = { user: { id: 'u1', senebty: { dailyFoundationLog: {
    '2026-05-13': { slug: 'mu', completed: true },
    '2026-05-14': { slug: 'four-treasures', completed: true },
    '2026-05-17': { slug: 'wedeha', completed: true },
  } } } };
  win.__InstallDailyFoundationGate__(App);
  assert.equal(App.dailyFoundationGate.getStreak(App.user, '2026-05-17'), 1, '2-day gap = reset; only today counted');
});

test('pickMicroIdx: returns valid index in [0, poolSize)', () => {
  const win = loadGateModule();
  const App = { user: { id: 'u1', senebty: { dailyFoundationLog: {} } } };
  win.__InstallDailyFoundationGate__(App);
  const idx = App.dailyFoundationGate.pickMicroIdx(App.user, 'mu', '2026-05-17', 21);
  assert.ok(idx >= 0 && idx < 21, `pickMicroIdx returned ${idx} outside [0, 21)`);
});

test('pickMicroIdx: does NOT repeat the most-recent micro for the same foundation', () => {
  const win = loadGateModule();
  const App = { user: { id: 'u1', senebty: { dailyFoundationLog: {
    '2026-05-10': { slug: 'mu', completed: true, micro: 5 },
  } } } };
  win.__InstallDailyFoundationGate__(App);
  for (let trial = 0; trial < 50; trial++) {
    const idx = App.dailyFoundationGate.pickMicroIdx(App.user, 'mu', `2026-05-${11+trial}`, 21);
    assert.notEqual(idx, 5, `pickMicroIdx returned 5 (last-used); got ${idx}`);
  }
});

// ── Rotation / dailyFoundation-data coverage guard ───────────────────────────
// Consistency Coach system-wide audit (2026-05-20). The gate's FOUNDATION_ORDER
// includes all 8 slugs (mu … heka). F1-F7 now ship a dailyFoundation block with
// microTeachings; F8 heka has none yet. The wing-entry hook in maat-reader.html
// commits to the daily screen (hides legacy rings) BEFORE checking whether the
// picked slug has data — so a user routed to a data-less slug is stranded on a
// blank screen, breaking the hook's own "NEVER strand the user" promise.
//
// This guard converts that latent gap into a tripwire: it maps each slug to its
// story.js dailyFoundation presence and asserts the set of built (data-backed)
// vs. pending (no-data) slugs matches the documented expectation. When F8 gets
// dailyFoundation data, move it to BUILT and the test stays green. If anyone flips
// the A/B gate ON (task #8) while F8 is still data-less, this test plus the
// FLAGGED engine fix (exclude pending slugs from FOUNDATION_ORDER, or guard the
// hook) are the reminder that the strand-the-user path is still open.
// Updated: F7 senedjem moved from EXPECTED_PENDING to EXPECTED_BUILT (Task 3, 2026-05-20).
// Updated: F8 heka moved from EXPECTED_PENDING to EXPECTED_BUILT (Task 2, 2026-05-20 — shape stub shipped).
//   Note: microTeachings are empty stub (Task 3 fills them); the dailyFoundation block is present.
//   The strand-the-user guard is preserved: the gate engine already filters on non-empty
//   microTeachings (COMPLETE_SLUGS check), so heka stays OUT of rotation until Task 3 ships.
test('rotation/data coverage: F1-F8 have dailyFoundation data; EXPECTED_PENDING empty (strand-the-user guard)', () => {
  const SLUG_TO_DIR = {
    'mu': '01-mu',
    'four-treasures': '02-four-treasures',
    'tjau': '03-tjau',
    'mu-streak': '04-mu-streak',
    'wedeha': '05-wedeha',
    'hesi': '06-hesi',
    'senedjem': '07-senedjem',
    'heka': '08-heka',
  };
  const EXPECTED_BUILT = ['mu', 'four-treasures', 'tjau', 'mu-streak', 'wedeha', 'hesi', 'senedjem', 'heka'];
  const EXPECTED_PENDING = [];

  const built = [];
  const pending = [];
  for (const slug of FOUNDATION_ORDER) {
    const dir = SLUG_TO_DIR[slug];
    assert.ok(dir, `FOUNDATION_ORDER slug "${slug}" must map to a known foundation dir`);
    const storySrc = fs.readFileSync(`senebty/data/foundations/${dir}/story.js`, 'utf8');
    if (/dailyFoundation\s*:\s*\{/.test(storySrc)) built.push(slug);
    else pending.push(slug);
  }

  assert.deepEqual(built, EXPECTED_BUILT,
    'built (data-backed) foundations drifted — all 8 (F1-F8) should have dailyFoundation data; update EXPECTED_BUILT if the set changes');
  assert.deepEqual(pending, EXPECTED_PENDING,
    'pending (no dailyFoundation data) foundations drifted — should be empty (all 8 have data). If a slug appears here while the A/B gate is ON, the wing-entry hook may strand the user on a blank screen — guard the hook before flipping the gate (Consistency Coach 2026-05-20).');
});

// ── Strand-prevention tests (A3 fix) ─────────────────────────────────────────
// The gate now filters FOUNDATION_ORDER to only slugs whose dailyFoundation
// block exists AND has a non-empty microTeachings array. These tests assert:
//   1. getTodaysFoundation returns only complete slugs across both intro and
//      practice phases, for many (user, date) seeds.
//      NOTE: senedjem (F7) is now complete (Task 3, 2026-05-20).
//      NOTE: heka (F8) is now complete (Task 3, 2026-05-20 — 21 microTeachings shipped).
//            All 8 foundations are complete; heka is now in rotation.
//   2. The filter includes F1-F8 (all complete) — the selection algorithm is
//      preserved, and all 8 slugs are candidates.
//   3. Graceful degradation: if window.Senebty has NO complete foundations
//      (edge case — should never happen in prod), getTodaysFoundation returns
//      null rather than crashing.

// Helper: the complete foundation slugs (F1-F8 — F8 heka 21 microTeachings
// populated in Task 3, 2026-05-20, so it is now in the rotation alongside F1-F7).
// All 8 foundations are complete; COMPLETE_SLUGS now includes 'heka'.
const COMPLETE_SLUGS = ['mu', 'four-treasures', 'tjau', 'mu-streak', 'wedeha', 'hesi', 'senedjem', 'heka'];

test('[A3] getTodaysFoundation never returns a data-less or empty-microTeachings slug (intro phase)', () => {
  const win = loadGateModuleWithSenebty();
  // Simulate a brand-new user going through the 8-day intro phase.
  // All 8 slugs are now complete; every day must return one of the 8 complete slugs.
  // F7 senedjem complete (Task 3, 2026-05-20); F8 heka complete (Task 3, 2026-05-20).
  for (let dayOffset = 0; dayOffset < 15; dayOffset++) {
    // Build a log with `dayOffset` prior completed entries so we hit every
    // intro-phase index (0 through INTRO_DAYS-1) and a few practice-phase ones.
    const log = {};
    for (let i = 0; i < dayOffset; i++) {
      const date = `2026-05-${String(10 + i).padStart(2, '0')}`;
      // Use only complete slugs in the log (simulating that prior days were also filtered)
      log[date] = { slug: COMPLETE_SLUGS[i % COMPLETE_SLUGS.length], completed: true };
    }
    const App = { user: { id: 'u-introtest', senebty: { dailyFoundationLog: log } } };
    win.__InstallDailyFoundationGate__(App);
    const today = `2026-06-${String(10 + dayOffset).padStart(2, '0')}`;
    const slug = App.dailyFoundationGate.getTodaysFoundation(App.user, today);
    assert.ok(
      COMPLETE_SLUGS.includes(slug),
      `day-offset ${dayOffset}: getTodaysFoundation returned "${slug}" which is not in the complete set. Data-less slugs must be filtered.`
    );
  }
});

test('[A3] getTodaysFoundation never returns a data-less slug (practice phase, many seeds)', () => {
  const win = loadGateModuleWithSenebty();
  // Build a log with 8+ completed entries (practice phase) and exercise many seeds.
  const log = {};
  const BASE_COMPLETE = ['mu', 'four-treasures', 'tjau', 'mu-streak', 'wedeha', 'mu', 'four-treasures', 'tjau'];
  BASE_COMPLETE.forEach((slug, i) => {
    const date = `2026-04-${String(10 + i).padStart(2, '0')}`;
    log[date] = { slug, completed: true };
  });
  const App = { user: { id: 'u-practicetest', senebty: { dailyFoundationLog: log } } };
  win.__InstallDailyFoundationGate__(App);

  for (let trial = 0; trial < 100; trial++) {
    const today = `2026-05-20:trial-${trial}`;
    delete App.user.senebty.dailyFoundationLog[today];
    const slug = App.dailyFoundationGate.getTodaysFoundation(App.user, today);
    assert.ok(
      COMPLETE_SLUGS.includes(slug),
      `practice trial ${trial}: getTodaysFoundation returned "${slug}" which is not in the complete set [${COMPLETE_SLUGS.join(', ')}].`
    );
  }
});

test('[A3] complete foundation set still contains all 8 expected slugs (filter does not over-exclude)', () => {
  const win = loadGateModuleWithSenebty();
  // Run the practice-phase picker across many (user, date) pairs, where each
  // user has a different "most recently completed" foundation so that no single
  // complete slug is permanently excluded as "yesterday" across all iterations.
  // This confirms the filter includes all 8 complete foundations (F1-F8 all complete
  // as of Task 3, 2026-05-20 — F8 heka now in rotation).
  const seen = new Set();
  // Build one distinct log history per complete slug (now 8: F1-F8) as the
  // "last completed", iterating over COMPLETE_SLUGS so this stays correct as
  // more foundations ship.
  for (const lastSlug of COMPLETE_SLUGS) {
    const log = {};
    // 8 prior entries (practice phase), all completed, last one is `lastSlug`
    COMPLETE_SLUGS.forEach((slug, i) => {
      const date = `2026-03-${String(10 + i).padStart(2, '0')}`;
      log[date] = { slug, completed: true };
    });
    // Add 3 more with the target lastSlug at the final position
    ['mu', 'four-treasures', lastSlug].forEach((slug, i) => {
      const date = `2026-04-${String(10 + i).padStart(2, '0')}`;
      log[date] = { slug, completed: true };
    });
    // 200 trials × multiple users per log to sample the weighted distribution
    for (let trial = 0; trial < 200; trial++) {
      for (const userId of ['user-A', 'user-B', 'user-C', 'user-D', 'user-E']) {
        const App = { user: { id: userId, senebty: { dailyFoundationLog: JSON.parse(JSON.stringify(log)) } } };
        win.__InstallDailyFoundationGate__(App);
        const today = `2026-05-20:trial-${trial}`;
        const slug = App.dailyFoundationGate.getTodaysFoundation(App.user, today);
        assert.ok(
          COMPLETE_SLUGS.includes(slug),
          `over-exclude check: getTodaysFoundation returned non-complete slug "${slug}"`
        );
        seen.add(slug);
      }
    }
  }
  for (const expected of COMPLETE_SLUGS) {
    assert.ok(seen.has(expected), `complete slug "${expected}" never appeared across 5000 picks — filter may be over-excluding`);
  }
});

test('[A3] graceful degradation: returns null when no complete foundations exist (empty Senebty)', () => {
  // Simulate an extreme edge case where window.Senebty has no data at all.
  // The gate must return null rather than crashing or routing to a bad slug.
  const src = fs.readFileSync('senebty/lib/daily-foundation-gate.js', 'utf8');
  const sandbox = { window: { Senebty: {} }, console }; // totally empty Senebty
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  const win = sandbox.window;
  const App = { user: { id: 'u-empty', senebty: { dailyFoundationLog: {} } } };
  win.__InstallDailyFoundationGate__(App);
  const slug = App.dailyFoundationGate.getTodaysFoundation(App.user, '2026-05-20');
  assert.equal(slug, null, 'empty Senebty: getTodaysFoundation must return null (graceful degradation), not crash');
});
