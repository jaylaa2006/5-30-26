// senebty/lib/foundation-tjau.js
// Foundation 3 — Tjau (Extended Breath, BREATH_IRI, 4-7-8 pattern, 3 rounds).
// type:'foundation' — counts in foundationsCompleted (4th arg true on iri.record).
// Per M1 RT verdict NONE: text-only, no glyph in title, no Azure pron.
// M4 Task 9: render() delegates to window.Senebty.foundationRender.run().
// Bespoke 3-round breath iri relocated into _renderBreathIri().
(function(){
  if (typeof window === 'undefined') return;
  window.Senebty = window.Senebty || {};

  const LESSON_ID = 'foundation-3-tjau';
  const ROUNDS = 3; // 3 rounds of 4-7-8 (per M1 RT verdict NONE)

  function start(){
    if (typeof window.App !== 'undefined' && typeof window.App.nav === 'function'){
      window.App.nav('senebtyFoundation', { key: 'tjau' });
    }
  }

  function isCompleted(){
    const u = window.App && window.App.user;
    if (!u || !u.senebty || !u.senebty.iriCompletedByLesson) return false;
    return !!u.senebty.iriCompletedByLesson[LESSON_ID];
  }

  function recordIri(evidence){
    if (typeof window.App !== 'undefined' && window.App._iri && typeof window.App._iri.record === 'function'){
      return window.App._iri.record(LESSON_ID, 'BREATH_IRI', evidence, true);
    }
    const u = window.App && window.App.user;
    if (!u || !u.senebty) return null;
    u.senebty.iriCompletedByLesson = u.senebty.iriCompletedByLesson || {};
    u.senebty.iriCompletedByLesson[LESSON_ID] = { iriType: 'BREATH_IRI', evidence, timestamp: Date.now() };
    if (typeof window.App.saveUser === 'function') window.App.saveUser();
    return { accepted: true, fallback: true };
  }

  function _resolveSebaText(s, app){
    if (!s) return '';
    var name = (app && app.user && (app.user.name || app.user.displayName)) || 'friend';
    return String(s).replace(/\{name\}/g, name);
  }

  function render(app){
    if (!window.Senebty || !window.Senebty.foundationRender ||
        typeof window.Senebty.foundationRender.run !== 'function'){
      console.error('[foundation-tjau] foundationRender helper missing');
      return;
    }
    window.Senebty.foundationRender.run(app, {
      lessonId: LESSON_ID,
      foundationKey: 'tjau',
      glyph: undefined, // M1 RT verdict NONE — text-only
      story: (window.Senebty && window.Senebty.foundationTjauStory) || null,
      isCompleted: isCompleted,
      recordIri: recordIri,
      renderIri: _renderBreathIri,
    });
  }

  // BREATH_IRI — 3 rounds of 4-7-8 (tap-when-done per round).
  function _renderBreathIri(app, ctx){
    var story = ctx.story || {};
    var copy = ctx.copy, cta = ctx.cta, counter = ctx.counter;
    var phase = 'iri-intro'; // iri-intro | iri-round | complete
    var roundIdx = 0;
    var startedAt = 0;

    function step(){
      cta.style.display = '';
      if (phase === 'iri-intro'){
        copy.textContent = (story.iriCheckpoint && story.iriCheckpoint.prompt)
          || 'Three rounds. Breathe in 4. Hold 7. Out 8.';
        if (counter) counter.textContent = '';
        cta.textContent = 'Begin iri';
        cta.onclick = function(){ phase = 'iri-round'; roundIdx = 1; startedAt = Date.now(); step(); };
        return;
      }
      if (phase === 'iri-round'){
        if (roundIdx > ROUNDS){ phase = 'complete'; step(); return; }
        copy.textContent = 'Round ' + roundIdx + ' of ' + ROUNDS +
          '. Breathe in 4. Hold 7. Out 8. Tap when done.';
        if (counter) counter.textContent = roundIdx + ' / ' + ROUNDS;
        cta.textContent = 'Round ' + roundIdx + ' done';
        cta.onclick = function(){ roundIdx++; step(); };
        return;
      }
      if (phase === 'complete'){
        copy.textContent = (story.iriCheckpoint && story.iriCheckpoint.sebaPostIri)
          ? _resolveSebaText(story.iriCheckpoint.sebaPostIri, app)
          : 'You have iri. Tjau is in your chest now.';
        if (counter) counter.textContent = '';
        cta.textContent = 'Complete';
        cta.onclick = function(){
          ctx.finishIri({ rounds: ROUNDS, pattern: '4-7-8', durationMs: Date.now() - startedAt, patternHonored: true });
        };
        return;
      }
    }
    step();
  }

  window.Senebty.foundationTjau = { LESSON_ID, start, isCompleted, recordIri, render, };
})();
