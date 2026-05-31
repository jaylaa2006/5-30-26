// senebty/lib/threshold-khaemwaset.js
// Khaemwaset Threshold orchestration. type:'threshold', NOT counted in foundationsCompleted.
// On BREATH_IRI completion → fires iri.record() → tier advances Hem-Sba → Seba en Seneb (new users).
// For migrated users (already at tier ≥ 1), the Threshold is optional re-walk;
//   iri logs but tier doesn't change.
// Surface: senebtyFoundation, key 'khaemwaset' (foundation scaffold).
// M4 Task 9: render() delegates to foundationRender helper.
(function(){
  if (typeof window === 'undefined') return;
  window.Senebty = window.Senebty || {};

  const LESSON_ID = 'threshold-khaemwaset';

  function start(){
    if (typeof window.App !== 'undefined' && typeof window.App.nav === 'function'){
      window.App.nav('senebtyFoundation', { key: 'khaemwaset' });
    }
  }

  function isCompleted(){
    const u = window.App && window.App.user;
    if (!u || !u.senebty || !u.senebty.iriCompletedByLesson) return false;
    return !!u.senebty.iriCompletedByLesson[LESSON_ID];
  }

  function recordIri(evidence){
    if (typeof window.App !== 'undefined' && window.App._iri && typeof window.App._iri.record === 'function'){
      // 4th arg false: Threshold does NOT count in foundationsCompleted tally.
      return window.App._iri.record(LESSON_ID, 'BREATH_IRI', evidence, false);
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
      console.error('[threshold-khaemwaset] foundationRender helper missing');
      return;
    }
    window.Senebty.foundationRender.run(app, {
      lessonId: LESSON_ID,
      foundationKey: 'khaemwaset',
      glyph: undefined,
      story: (window.Senebty && window.Senebty.khaemwasetThresholdStory) || null,
      isCompleted: isCompleted,
      recordIri: recordIri,
      renderIri: _renderBreathIri,
    });
  }

  // BREATH_IRI — 60s timer, "breathe with Ra".
  function _renderBreathIri(app, ctx){
    var story = ctx.story || {};
    var copy = ctx.copy, cta = ctx.cta, counter = ctx.counter;
    var DURATION_MS = ((story.iriCheckpoint && story.iriCheckpoint.durationSeconds) || 60) * 1000;
    var phase = 'iri-intro'; // iri-intro | iri-run | complete
    var startedAt = 0;
    var iriTimer = null;

    function step(){
      cta.style.display = '';
      if (phase === 'iri-intro'){
        copy.textContent = (story.iriCheckpoint && story.iriCheckpoint.prompt)
          || 'Khaemwaset breathed with Ra. Now you. One minute. Ra rises with you.';
        if (counter) counter.textContent = '';
        cta.textContent = 'Begin';
        cta.disabled = false;
        cta.onclick = function(){ phase = 'iri-run'; startedAt = Date.now(); step(); };
        return;
      }
      if (phase === 'iri-run'){
        var elapsed = Date.now() - startedAt;
        var remaining = Math.max(0, Math.ceil((DURATION_MS - elapsed) / 1000));
        copy.textContent = 'Breathe with Ra. Slow in. Slow out.';
        if (counter) counter.textContent = remaining + 's remaining';
        cta.textContent = remaining > 0 ? 'Breathing…' : 'Complete';
        cta.disabled = remaining > 0;
        if (remaining > 0){
          if (iriTimer) clearTimeout(iriTimer);
          iriTimer = setTimeout(step, 500);
        } else {
          cta.disabled = false;
          cta.onclick = function(){ phase = 'complete'; step(); };
        }
        return;
      }
      if (phase === 'complete'){
        copy.textContent = (story.iriCheckpoint && story.iriCheckpoint.sebaPostIri)
          ? _resolveSebaText(story.iriCheckpoint.sebaPostIri, app)
          : 'You have iri. Welcome inside the Per Ankh.';
        if (counter) counter.textContent = '';
        cta.disabled = false;
        cta.textContent = 'Complete';
        cta.onclick = function(){
          ctx.finishIri({ breathsCounted: Math.floor(DURATION_MS / 6000), durationMs: DURATION_MS });
        };
        return;
      }
    }
    step();
  }

  window.Senebty.thresholdKhaemwaset = { LESSON_ID, start, isCompleted, recordIri, render, };
})();
