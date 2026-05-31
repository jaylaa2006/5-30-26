// senebty/lib/foundation-senedjem.js
// Foundation 7 — Senedjem (CREATION_IRI: child writes/draws one "sweet thing tonight").
// type:'foundation' — counts in foundationsCompleted.
// Per Phase 1.2 verdict: SENEDJEM text-only (no glyph).
// Karenga binding: senedjem as the causative "to make sweet" — daily making at day's close.
// M4 Task 9: render() delegates to foundationRender helper.
(function(){
  if (typeof window === 'undefined') return;
  window.Senebty = window.Senebty || {};

  const LESSON_ID = 'foundation-7-senedjem';

  function start(){
    if (typeof window.App !== 'undefined' && typeof window.App.nav === 'function'){
      window.App.nav('senebtyFoundation', { key: 'senedjem' });
    }
  }

  function isCompleted(){
    const u = window.App && window.App.user;
    if (!u || !u.senebty || !u.senebty.iriCompletedByLesson) return false;
    return !!u.senebty.iriCompletedByLesson[LESSON_ID];
  }

  function recordIri(evidence){
    if (typeof window.App !== 'undefined' && window.App._iri && typeof window.App._iri.record === 'function'){
      return window.App._iri.record(LESSON_ID, 'CREATION_IRI', evidence, true);
    }
    const u = window.App && window.App.user;
    if (!u || !u.senebty) return null;
    u.senebty.iriCompletedByLesson = u.senebty.iriCompletedByLesson || {};
    u.senebty.iriCompletedByLesson[LESSON_ID] = { iriType: 'CREATION_IRI', evidence, timestamp: Date.now() };
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
      console.error('[foundation-senedjem] foundationRender helper missing');
      return;
    }
    window.Senebty.foundationRender.run(app, {
      lessonId: LESSON_ID,
      foundationKey: 'senedjem',
      glyph: undefined, // Phase 1.2 NONE — text-only
      story: (window.Senebty && window.Senebty.foundationSenedjemStory) || null,
      isCompleted: isCompleted,
      recordIri: recordIri,
      renderIri: _renderCreationIri,
    });
  }

  // CREATION_IRI — child writes (or draws via dataURL shim) one sweet thing.
  function _renderCreationIri(app, ctx){
    var story = ctx.story || {};
    var copy = ctx.copy, cta = ctx.cta, counter = ctx.counter;
    var creation = { text: '', dataURL: '' };
    var phase = 'iri-intro'; // iri-intro | iri-make | iri-seal

    function step(){
      cta.style.display = '';
      if (phase === 'iri-intro'){
        copy.textContent = (story.iriCheckpoint && story.iriCheckpoint.prompt)
          || 'Make one sweet thing tonight. Write it. Or draw it. Show me, and I will see it.';
        if (counter) counter.textContent = '';
        cta.textContent = 'Begin making';
        cta.onclick = function(){ phase = 'iri-make'; step(); };
        return;
      }
      if (phase === 'iri-make'){
        var entered = '';
        if (typeof window.Senebty.creationIriCapture === 'function'){
          entered = window.Senebty.creationIriCapture() || '';
        } else if (typeof window.prompt === 'function'){
          entered = window.prompt('Write one sweet thing you made tonight. Or describe what you drew.') || '';
        }
        creation.text = String(entered || '').slice(0, 280);
        copy.textContent = creation.text
          ? 'You wrote: ' + creation.text
          : 'You made one sweet thing.';
        cta.textContent = 'Continue';
        cta.onclick = function(){ phase = 'iri-seal'; step(); };
        return;
      }
      if (phase === 'iri-seal'){
        copy.textContent = (story.iriCheckpoint && story.iriCheckpoint.sebaPostIri)
          ? _resolveSebaText(story.iriCheckpoint.sebaPostIri, app)
          : 'You have iri. The sweet is in your hands now. The night holds you.';
        if (counter) counter.textContent = '';
        cta.textContent = 'Seal CREATION_IRI';
        cta.onclick = function(){ ctx.finishIri({ text: creation.text, dataURL: creation.dataURL }); };
        return;
      }
    }
    step();
  }

  window.Senebty.foundationSenedjem = { LESSON_ID, start, isCompleted, recordIri, render, };
})();
