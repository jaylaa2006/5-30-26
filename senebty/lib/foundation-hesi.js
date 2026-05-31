// senebty/lib/foundation-hesi.js
// Foundation 6 — Hesi (VOICE_IRI, 3× HESI recitation, score-only Azure pron).
// type:'foundation' — counts in foundationsCompleted.
// Per M1 RT NONE: text-only (no glyph). NO audio retention.
// Finch binding: modern voice-training disclosed as contemporary adaptation.
// M4 Task 9: render() delegates to foundationRender helper.
(function(){
  if (typeof window === 'undefined') return;
  window.Senebty = window.Senebty || {};

  const LESSON_ID = 'foundation-6-hesi';

  function start(){
    if (typeof window.App !== 'undefined' && typeof window.App.nav === 'function'){
      window.App.nav('senebtyFoundation', { key: 'hesi' });
    }
  }

  function isCompleted(){
    const u = window.App && window.App.user;
    if (!u || !u.senebty || !u.senebty.iriCompletedByLesson) return false;
    return !!u.senebty.iriCompletedByLesson[LESSON_ID];
  }

  function recordIri(evidence){
    if (typeof window.App !== 'undefined' && window.App._iri && typeof window.App._iri.record === 'function'){
      return window.App._iri.record(LESSON_ID, 'VOICE_IRI', evidence, true);
    }
    const u = window.App && window.App.user;
    if (!u || !u.senebty) return null;
    u.senebty.iriCompletedByLesson = u.senebty.iriCompletedByLesson || {};
    u.senebty.iriCompletedByLesson[LESSON_ID] = { iriType: 'VOICE_IRI', evidence, timestamp: Date.now() };
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
      console.error('[foundation-hesi] foundationRender helper missing');
      return;
    }
    window.Senebty.foundationRender.run(app, {
      lessonId: LESSON_ID,
      foundationKey: 'hesi',
      glyph: undefined, // M1 RT NONE — text-only
      story: (window.Senebty && window.Senebty.foundationHesiStory) || null,
      isCompleted: isCompleted,
      recordIri: recordIri,
      renderIri: _renderVoiceIri,
    });
  }

  // VOICE_IRI — 3× HESI recitation, Azure score-only (no audio retention).
  function _renderVoiceIri(app, ctx){
    var story = ctx.story || {};
    var copy = ctx.copy, cta = ctx.cta, counter = ctx.counter;
    var REPS = (story.iriCheckpoint && story.iriCheckpoint.repetitions) || 3;
    var phase = 'iri-intro'; // iri-intro | iri-rep | iri-seal
    var repIdx = 0;
    var recitations = [];

    function step(){
      cta.style.display = '';
      if (phase === 'iri-intro'){
        copy.textContent = (story.iriCheckpoint && story.iriCheckpoint.prompt)
          || 'Speak HESI three times. Slow. Full breath. The Per Ankh master listens.';
        if (counter) counter.textContent = '';
        cta.textContent = 'Begin recitation';
        cta.onclick = function(){ phase = 'iri-rep'; step(); };
        return;
      }
      if (phase === 'iri-rep'){
        copy.textContent = 'Recitation ' + (repIdx + 1) + ' of ' + REPS +
          '.\n\nSpeak HESI. Slow. Full breath.';
        if (counter) counter.textContent = (repIdx + 1) + ' / ' + REPS;
        cta.textContent = 'Tap when spoken';
        cta.onclick = function(){
          var score = (typeof window.Senebty.azureScoreVoice === 'function')
            ? window.Senebty.azureScoreVoice('HESI') : null;
          recitations.push({ score: score });
          repIdx++;
          if (repIdx >= REPS){ phase = 'iri-seal'; }
          step();
        };
        return;
      }
      if (phase === 'iri-seal'){
        copy.textContent = (story.iriCheckpoint && story.iriCheckpoint.sebaPostIri)
          ? _resolveSebaText(story.iriCheckpoint.sebaPostIri, app)
          : 'You have iri. The voice is in your chest now. The ancestors hear.';
        if (counter) counter.textContent = '';
        cta.textContent = 'Seal VOICE_IRI';
        cta.onclick = function(){ ctx.finishIri({ recitations: recitations }); };
        return;
      }
    }
    step();
  }

  window.Senebty.foundationHesi = { LESSON_ID, start, isCompleted, recordIri, render, };
})();
