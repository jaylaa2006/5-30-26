// senebty/lib/foundation-mu.js
// Foundation 1 — Mu (Water). The FIRST foundation: a young child's first
// encounter with mu at the Per Ankh.
//
// v3.49.0 — ported to foundationRender helper (parity with F2/F3/F4/F6/F7/F8).
// First-visit flow: 4-chunk story + comprehension via foundationRender,
//   then renderIri hands off to the 4-phase body-ritual timer (preserved
//   verbatim from the legacy _mountFoundationMu inline path).
// Repeat-visit flow: skip story, render the body-ritual directly (daily
//   user does a cup, not the story again).
//
// WATER_IRI record contract preserved — App._iri.record is still called
// at ritual completion. F4 mu-streak depends on WATER_IRI entries in
// iriLog to compute the 21-day streak (see foundation-mu-streak.js
// _waterStreakDays). Do NOT break that contract.
//
// Spec-gate RT 2026-05-16 APPROVE-WITH-BINDINGS (top-3):
//   1. 4 L1 chunks matching F4 mu-streak shape.
//   2. iri preserves existing 4-phase WATER_IRI timer (renderIri callback).
//   3. Sitra protagonist + elite-pipeline hero + 4 chunk illustrations.

(function () {
  if (typeof window === 'undefined') return;
  window.Senebty = window.Senebty || {};

  var LESSON_ID = 'foundation-1';

  // 4-phase body-ritual (preserved verbatim from pre-v3.49.0 legacy path).
  var PHASES = [
    { id: 'arrival', durationMs: 3000,  copy: 'Mu is the Nile in your khat. One cup. One iri.', cta: 'Begin' },
    { id: 'pour',    durationMs: 4000,  copy: 'Pour the water you will drink.',                  cta: 'Pour'  },
    { id: 'drink',   durationMs: 12000, copy: 'Now drink the water you poured.',                 cta: 'Skip'  },
    { id: 'rest',    durationMs: 3000,  copy: 'You have iri once. The body remembers.',          cta: null    },
  ];

  function _sameCalendarDay(a, b) {
    var da = new Date(a), db = new Date(b);
    return da.getFullYear() === db.getFullYear() &&
           da.getMonth() === db.getMonth() &&
           da.getDate() === db.getDate();
  }

  function isCompletedToday(app) {
    if (!app || !app.user || !app.user.senebty) return false;
    var log = app.user.senebty.iriLog;
    if (!Array.isArray(log)) return false;
    for (var i = log.length - 1; i >= 0; i--) {
      var entry = log[i];
      if (entry && entry.lessonId === LESSON_ID) {
        return _sameCalendarDay(entry.ts, Date.now());
      }
    }
    return false;
  }

  function complete(app) {
    if (!app || !app._iri || typeof app._iri.record !== 'function') return false;
    if (isCompletedToday(app)) return false; // idempotent same-day guard
    app._iri.record.call(app, {
      type: 'WATER_IRI',
      lessonId: LESSON_ID,
      ts: Date.now(),
      payload: { cups: 1 },
    });
    if (typeof app.saveUser === 'function') app.saveUser();
    if (typeof app._checkTierAdvancement === 'function') app._checkTierAdvancement();
    return true;
  }

  function _hasSeenIntro() {
    var u = window.App && window.App.user;
    if (!u || !u.senebty) return false;
    return !!u.senebty.foundationMuIntroSeen;
  }
  function _markSeenIntro(app) {
    var u = app && app.user;
    if (!u) return;
    u.senebty = u.senebty || {};
    u.senebty.foundationMuIntroSeen = true;
    if (typeof app.saveUser === 'function') app.saveUser();
  }

  function _resolveSebaText(s, app) {
    if (!s) return '';
    var name = (app && app.user && (app.user.name || app.user.displayName)) || 'friend';
    return String(s).replace(/\{name\}/g, name.charAt(0).toUpperCase() + name.slice(1));
  }

  // _renderWaterRitual — the 4-phase body-ritual UI, ported verbatim from
  // the legacy App._mountFoundationMu but scoped here. Same timing, same
  // copy, same complete() at the end.
  function _renderWaterRitual(app) {
    if (!app) return;
    // Cleanup any timers from a previous invocation
    if (typeof app._cleanupFoundationMuTimers === 'function') app._cleanupFoundationMuTimers();
    app._cleanupFoundationMuTimers = function () {
      if (app._foundationDrinkInterval) { clearInterval(app._foundationDrinkInterval); app._foundationDrinkInterval = null; }
      if (app._foundationSkipTimeout)   { clearTimeout(app._foundationSkipTimeout);    app._foundationSkipTimeout = null; }
      if (app._foundationRestTimeout)   { clearTimeout(app._foundationRestTimeout);    app._foundationRestTimeout = null; }
    };

    if (isCompletedToday(app)) {
      var stage0 = document.querySelector('#senebtyFoundation .senebty-foundation-stage');
      if (stage0) stage0.setAttribute('data-phase', 'already');
      var copy0 = document.getElementById('senebtyFoundationCopy');
      if (copy0) copy0.textContent = 'You have already iri this morning. Return tomorrow for streak.';
      var cta0 = document.getElementById('senebtyFoundationCta');
      if (cta0) {
        cta0.style.display = '';
        cta0.textContent = 'Back to gate';
        cta0.onclick = function () { app.nav('senebty'); };
      }
      return;
    }

    var phaseIdx = 0;
    var SKIP_AFTER_MS = 4000; // skip button revealed 4s into drink phase

    function renderPhase() {
      if (typeof app._cleanupFoundationMuTimers === 'function') app._cleanupFoundationMuTimers();
      var phase = PHASES[phaseIdx];
      if (!phase) return;
      var stage = document.querySelector('#senebtyFoundation .senebty-foundation-stage');
      var copy = document.getElementById('senebtyFoundationCopy');
      var cta = document.getElementById('senebtyFoundationCta');
      var counter = document.getElementById('senebtyFoundationCounter');
      if (!stage || !copy || !cta || !counter) return;
      stage.setAttribute('data-phase', phase.id);
      copy.textContent = phase.copy;
      counter.textContent = '';
      if (phase.cta) { cta.style.display = ''; cta.textContent = phase.cta; cta.onclick = advancePhase; }
      else           { cta.style.display = 'none'; cta.onclick = null; }
      if (phase.id === 'drink') {
        var remaining = Math.floor(phase.durationMs / 1000);
        counter.textContent = String(remaining);
        app._foundationDrinkInterval = setInterval(function () {
          remaining--;
          counter.textContent = remaining > 0 ? String(remaining) : '';
          if (remaining <= 0) {
            clearInterval(app._foundationDrinkInterval);
            app._foundationDrinkInterval = null;
            advancePhase();
          }
        }, 1000);
        cta.style.display = 'none';
        app._foundationSkipTimeout = setTimeout(function () {
          cta.style.display = '';
          cta.textContent = phase.cta || 'Skip';
        }, SKIP_AFTER_MS);
      } else if (phase.id === 'rest') {
        app._foundationRestTimeout = setTimeout(function () {
          complete(app);
          app.nav('senebty');
        }, phase.durationMs);
      }
    }
    function advancePhase() {
      phaseIdx++;
      if (phaseIdx >= PHASES.length) { complete(app); app.nav('senebty'); return; }
      renderPhase();
    }
    renderPhase();
  }

  // start() — entry point used by external callers (Senebty rings, etc.)
  function start() {
    if (typeof window.App !== 'undefined' && typeof window.App.nav === 'function') {
      window.App.nav('senebtyFoundation', { key: 'mu' });
    }
  }

  function render(app) {
    var copy = document.getElementById('senebtyFoundationCopy');
    var cta = document.getElementById('senebtyFoundationCta');
    if (!copy || !cta) return;

    var story = (window.Senebty && window.Senebty.foundationMuStory) || null;

    // Already-completed-today done-state
    if (isCompletedToday(app)) {
      copy.textContent = (story && story.iriCheckpoint && story.iriCheckpoint.sebaPostIri)
        ? _resolveSebaText(story.iriCheckpoint.sebaPostIri, app)
        : 'You have iri today. The body remembers. Return tomorrow for streak.';
      cta.style.display = '';
      cta.textContent = 'Back to gate';
      cta.onclick = function () { if (app && typeof app.nav === 'function') app.nav('senebty'); };
      return;
    }

    // First visit: run story + comp via helper, then hand off to ritual.
    if (story && !_hasSeenIntro()) {
      if (!window.Senebty || !window.Senebty.foundationRender ||
          typeof window.Senebty.foundationRender.run !== 'function') {
        console.error('[foundation-mu] foundationRender helper missing — falling back to ritual');
        _renderWaterRitual(app);
        return;
      }
      window.Senebty.foundationRender.run(app, {
        lessonId: LESSON_ID,
        foundationKey: 'mu',
        glyph: '𓈗',
        story: story,
        isCompleted: function () { return isCompletedToday(app); },
        recordIri: function () { return complete(app); },
        renderIri: function (appRef) {
          _markSeenIntro(appRef);
          _renderWaterRitual(appRef);
        },
      });
      return;
    }

    // Repeat visit OR no story loaded: render the body-ritual directly.
    _renderWaterRitual(app);
  }

  window.Senebty.foundationMu = {
    LESSON_ID: LESSON_ID,
    PHASES: PHASES,
    start: start,
    isCompleted: isCompletedToday,
    isCompletedToday: isCompletedToday,
    complete: complete,
    recordIri: function () { return complete(window.App); },
    render: render,
  };
})();
