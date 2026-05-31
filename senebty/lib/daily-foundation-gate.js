// senebty/lib/daily-foundation-gate.js
// Senebty Foundations daily-ritual gate — picks today's foundation per the
// daily-ritual redesign spec (2026-05-17). Late-binding installer per
// enterprise-patterns.md Rule 2.
//
// State model: user.senebty.dailyFoundationLog[YYYY-MM-DD] = {
//   slug, completed, completedAt, swappedFrom, micro
// }
//
// Algorithm:
//   First-N-days intro phase: pick by sequence (mu → four-treasures → …)
//   across the COMPLETE foundations only (those with dailyFoundation block +
//   non-empty microTeachings). Data-less slugs would be excluded until they
//   ship; this is the A3 never-strand fix (Consistency Coach 2026-05-20).
//   NOTE (F8 Stage-2 Coach 2026-05-20): ALL 8 foundations (mu … heka) now ship
//   21 microTeachings each, so _isComplete is true for every slug and the full
//   rotation spans all 8 — no slug is excluded. F8 heka completed the wing
//   (COMPLETE_SLUGS 7→8); the filter remains in place for safety so any future
//   slug added with empty microTeachings is still kept out until it ships.
//   Day-(N+1)+ practice phase: weighted least-recent, same candidate set.
//
// Slug → window.Senebty property mapping (foundation<CamelSlug>Story):
//   mu          → foundationMuStory
//   four-treasures → foundationFourTreasuresStory
//   tjau        → foundationTjauStory
//   mu-streak   → foundationMuStreakStory
//   wedeha      → foundationWedehaStory
//   hesi        → foundationHesiStory
//   senedjem    → foundationSenedjemStory
//   heka        → foundationHekaStory
(function(){
  if (typeof window === 'undefined') return;

  const FOUNDATION_ORDER = ['mu', 'four-treasures', 'tjau', 'mu-streak', 'wedeha', 'hesi', 'senedjem', 'heka'];
  const INTRO_DAYS = 8;

  // ── Slug → camelCase property name ──────────────────────────────────────────
  // Converts a hyphen-slug to the `foundation<CamelSlug>Story` key on
  // window.Senebty. E.g. 'four-treasures' → 'foundationFourTreasuresStory'.
  function _slugToStoryKey(slug) {
    const camel = slug.split('-').map(function(w) {
      return w.charAt(0).toUpperCase() + w.slice(1);
    }).join('');
    return 'foundation' + camel + 'Story';
  }

  // Returns true iff the foundation has a dailyFoundation block with a
  // non-empty microTeachings array. This is the "complete" definition:
  //   - dailyFoundation block present → the data was authored
  //   - microTeachings.length > 0    → the teaching content shipped (not mid-build)
  function _isComplete(slug) {
    var senebty = window.Senebty;
    if (!senebty) return false;
    var storyKey = _slugToStoryKey(slug);
    var story = senebty[storyKey];
    if (!story) return false;
    var df = story.dailyFoundation;
    if (!df) return false;
    return Array.isArray(df.microTeachings) && df.microTeachings.length > 0;
  }

  // Returns the ordered subset of FOUNDATION_ORDER whose foundations are
  // complete (dailyFoundation + non-empty microTeachings). Preserves order.
  // Returns [] if none are complete — callers must handle null-slug gracefully.
  function _completeFoundations() {
    return FOUNDATION_ORDER.filter(_isComplete);
  }

  function _ensureLog(user) {
    if (!user.senebty) user.senebty = {};
    if (!user.senebty.dailyFoundationLog) user.senebty.dailyFoundationLog = {};
    return user.senebty.dailyFoundationLog;
  }

  function _dayCount(log) {
    return Object.keys(log).length;
  }

  function _seededRandom(seed) {
    // Cyrb53-lite: deterministic hash-to-[0,1) for (userId + today) seeding.
    let h = 1779033703 ^ seed.length;
    for (let i = 0; i < seed.length; i++) {
      h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return ((h >>> 0) % 1_000_000) / 1_000_000;
  }

  function _yesterdaySlug(log, today) {
    // "Yesterday" = the most recent COMPLETED foundation strictly before today.
    // Skipping incomplete picks (write-on-pick rows) keeps the exclusion stable
    // across same-day retries / test trial-suffix iterations.
    const dates = Object.keys(log).filter(d => d < today && log[d].completed).sort();
    if (!dates.length) return null;
    return log[dates[dates.length - 1]].slug;
  }

  function _datePart(s) {
    // Tolerate test-only suffixes like '2026-05-18:trial-1' by taking the
    // leading YYYY-MM-DD slice for Date parsing.
    return (s || '').slice(0, 10);
  }

  function _daysSinceLastCompletion(log, slug, today) {
    const dates = Object.keys(log).filter(d => d < today && log[d].slug === slug && log[d].completed).sort();
    if (!dates.length) return 1_000_000;
    const last = dates[dates.length - 1];
    return (new Date(_datePart(today)) - new Date(_datePart(last))) / (1000 * 60 * 60 * 24);
  }

  // `completeFounds` is the pre-computed complete foundation list — callers pass
  // it in so we don't recompute inside the hot loop.
  function _pickWeightedLeastRecent(log, today, userId, completeFounds) {
    const yesterday = _yesterdaySlug(log, today);
    const candidates = completeFounds.filter(s => s !== yesterday);
    // If somehow every complete foundation was yesterday (single-foundation edge
    // case), allow yesterday back rather than returning nothing.
    const pool = candidates.length > 0 ? candidates : completeFounds;
    const weights = pool.map(slug => {
      const d = Math.max(1, _daysSinceLastCompletion(log, slug, today));
      return d * d;  // square: bias strongly toward least-recent
    });
    const total = weights.reduce((a, b) => a + b, 0);
    const seed = userId + ':' + today;
    const roll = _seededRandom(seed) * total;
    let running = 0;
    for (let i = 0; i < pool.length; i++) {
      running += weights[i];
      if (roll < running) return pool[i];
    }
    return pool[pool.length - 1];
  }

  function getTodaysFoundation(user, today) {
    const log = _ensureLog(user);
    if (log[today]) return log[today].slug;

    // A3 never-strand fix (Consistency Coach 2026-05-20): only rotate across
    // foundations that have a complete dailyFoundation block (non-empty
    // microTeachings). Any data-less slug stays out until it ships its data.
    // (F8 Stage-2 Coach 2026-05-20: F8 heka shipped 21 microTeachings — all 8
    // foundations (mu … heka) now rotate; no slug is currently excluded. The
    // filter is retained for safety against future empty-microTeachings slugs.)
    const complete = _completeFoundations();
    if (complete.length === 0) {
      // Graceful degradation: no complete foundation data available.
      // Return null so the wing-entry hook falls through to legacy rings.
      console.error('[daily-foundation-gate] getTodaysFoundation: no complete foundation data found — returning null (fallthrough to legacy rings)');
      return null;
    }

    const count = _dayCount(log);
    let slug;
    if (count < INTRO_DAYS) {
      // Intro phase: sequence through complete foundations in order.
      // Wrap with modulo so the sequence cycles if count >= complete.length,
      // avoiding an out-of-bounds access when INTRO_DAYS > complete.length.
      slug = complete[count % complete.length];
    } else {
      slug = _pickWeightedLeastRecent(log, today, user.id || 'anon', complete);
    }
    log[today] = { slug, completed: false, swappedFrom: null, completedAt: null, micro: null };
    return slug;
  }

  function pickMicroIdx(user, slug, today, poolSize) {
    if (poolSize <= 0) return 0;
    const log = _ensureLog(user);
    const sortedDates = Object.keys(log).filter(d => d < today && log[d].slug === slug && log[d].micro != null).sort();
    const lastMicro = sortedDates.length ? log[sortedDates[sortedDates.length - 1]].micro : -1;
    const seed = (user.id || 'anon') + ':' + slug + ':' + today;
    const roll = _seededRandom(seed);
    let idx = Math.floor(roll * poolSize);
    if (idx === lastMicro) idx = (idx + 1) % poolSize;
    return idx;
  }

  function recordCompletion(user, today, microIdx) {
    const log = _ensureLog(user);
    if (!log[today]) return false;
    log[today].completed = true;
    log[today].completedAt = Date.now();
    log[today].micro = microIdx;
    return true;
  }

  function getStreak(user, today) {
    const log = _ensureLog(user);
    const sortedDates = Object.keys(log).filter(d => d <= today).sort().reverse();
    if (!sortedDates.length) return 0;
    let streak = 0;
    let cursor = new Date(today);
    let graceUsed = false;
    for (const date of sortedDates) {
      const entryDate = new Date(date);
      const gap = Math.round((cursor - entryDate) / (1000 * 60 * 60 * 24));
      if (gap === 0 || gap === 1) {
        if (log[date].completed) streak++;
        else break;
        cursor = entryDate;
      } else if (gap === 2 && !graceUsed && log[date].completed) {
        graceUsed = true;
        streak++;
        cursor = entryDate;
      } else {
        break;
      }
    }
    return streak;
  }

  const api = {
    getTodaysFoundation,
    recordCompletion,
    getStreak,
    pickMicroIdx,
    // _FOUNDATION_ORDER: the full declared order (all 8 slugs, including pending).
    // At runtime, only _completeFoundations() are reachable via getTodaysFoundation.
    _FOUNDATION_ORDER: FOUNDATION_ORDER,
    _INTRO_DAYS: INTRO_DAYS,
    // Exposed for tests and debugging — returns the live complete-foundation set.
    _completeFoundations,
    _isComplete,
  };

  window.__InstallDailyFoundationGate__ = function(targetApp) {
    if (!targetApp || typeof targetApp !== 'object') {
      console.error('[daily-foundation-gate] __InstallDailyFoundationGate__: invalid target App');
      return false;
    }
    if (targetApp.dailyFoundationGate === api) return true;
    targetApp.dailyFoundationGate = api;
    console.log('[daily-foundation-gate] installed on App namespace');
    return true;
  };
})();
