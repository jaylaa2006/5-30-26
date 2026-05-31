// senebty/lib/foundation-heka.js
// Foundation 8 — Heka (TEACHING_IRI: child teaches one Power Word to a parent
// at home; parent confirms via dashboard. 14-day auto-advance scheduler in M3).
// type:'foundation' — counts in foundationsCompleted.
// Power Word HEKA — M1 RT HIGH per Karenga. Glyph 𓎛𓂓𓄿 retained.
// On iri-completion: child + parent invited to compose personal Heka phrase
//   via window.Senebty.hekaPhrase.openComposeModal (M4 Task 10).
// M4 Task 9: render() delegates to foundationRender helper.
(function(){
  if (typeof window === 'undefined') return;
  window.Senebty = window.Senebty || {};

  const LESSON_ID = 'foundation-8-heka';

  function start(){
    if (typeof window.App !== 'undefined' && typeof window.App.nav === 'function'){
      window.App.nav('senebtyFoundation', { key: 'heka' });
    }
  }

  function isCompleted(){
    const u = window.App && window.App.user;
    if (!u || !u.senebty || !u.senebty.iriCompletedByLesson) return false;
    return !!u.senebty.iriCompletedByLesson[LESSON_ID];
  }

  function recordIri(evidence){
    if (typeof window.App !== 'undefined' && window.App._iri && typeof window.App._iri.record === 'function'){
      return window.App._iri.record(LESSON_ID, 'TEACHING_IRI', evidence, true);
    }
    const u = window.App && window.App.user;
    if (!u || !u.senebty) return null;
    u.senebty.iriCompletedByLesson = u.senebty.iriCompletedByLesson || {};
    u.senebty.iriCompletedByLesson[LESSON_ID] = { iriType: 'TEACHING_IRI', evidence, timestamp: Date.now() };
    if (typeof window.App.saveUser === 'function') window.App.saveUser();
    return { accepted: true, fallback: true };
  }

  function _invokeHekaPhraseComposition(){
    var hp = window.Senebty && window.Senebty.hekaPhrase;
    if (!hp || typeof hp.set !== 'function') return null;
    if (typeof hp.get === 'function' && hp.get()) return hp.get();
    if (typeof hp.openComposeModal !== 'function') return null;
    var u = window.App && window.App.user;
    var name = (u && u.name) || 'friend';
    hp.openComposeModal({ childName: name, onSave: null, onCancel: null });
    return null;
  }

  function _resolveSebaText(s, app){
    if (!s) return '';
    var name = (app && app.user && (app.user.name || app.user.displayName)) || 'friend';
    return String(s).replace(/\{name\}/g, name);
  }

  function render(app){
    if (!window.Senebty || !window.Senebty.foundationRender ||
        typeof window.Senebty.foundationRender.run !== 'function'){
      console.error('[foundation-heka] foundationRender helper missing');
      return;
    }
    window.Senebty.foundationRender.run(app, {
      lessonId: LESSON_ID,
      foundationKey: 'heka',
      glyph: '𓎛𓂓𓄿', // M1 RT HIGH — Karenga binding
      story: (window.Senebty && window.Senebty.foundationHekaStory) || null,
      isCompleted: isCompleted,
      recordIri: recordIri,
      renderIri: _renderTeachingIri,
    });
  }

  // TEACHING_IRI — 3-step capture (who/word/parent line) + Heka phrase composition.
  function _renderTeachingIri(app, ctx){
    var story = ctx.story || {};
    var copy = ctx.copy, cta = ctx.cta, counter = ctx.counter;
    var teaching = { taughtTo: '', wordTaught: '', parentDescription: '' };
    var phase = 'iri-intro'; // iri-intro | capture-who | capture-word | capture-parent | review | iri-seal

    function step(){
      cta.style.display = '';
      if (phase === 'iri-intro'){
        copy.textContent = (story.iriCheckpoint && story.iriCheckpoint.prompt)
          || 'Teach one Power Word to someone in your house. Tell them what it means. Show them how you say it. Then come back and tell me who listened.';
        if (counter) counter.textContent = '';
        cta.textContent = 'Begin teaching';
        cta.onclick = function(){ phase = 'capture-who'; step(); };
        return;
      }
      if (phase === 'capture-who'){
        var who = (typeof window.prompt === 'function')
          ? (window.prompt('Who did you teach? (parent, sibling, grandfather, etc.)') || '')
          : '';
        teaching.taughtTo = String(who || '').slice(0, 80);
        phase = 'capture-word'; step(); return;
      }
      if (phase === 'capture-word'){
        var word = (typeof window.prompt === 'function')
          ? (window.prompt('Which Power Word did you teach? (SENEB, KHAT, SENEDJEM, etc.)') || '')
          : '';
        teaching.wordTaught = String(word || '').slice(0, 40);
        phase = 'capture-parent'; step(); return;
      }
      if (phase === 'capture-parent'){
        var desc = (typeof window.prompt === 'function')
          ? (window.prompt('In one sentence, what did the person say back when you taught them?') || '')
          : '';
        teaching.parentDescription = String(desc || '').slice(0, 280);
        phase = 'review'; step(); return;
      }
      if (phase === 'review'){
        copy.textContent = 'You taught ' + (teaching.wordTaught || 'a Power Word')
          + ' to ' + (teaching.taughtTo || 'someone at home') + '.';
        if (counter) counter.textContent = '';
        cta.textContent = 'Continue';
        cta.onclick = function(){ phase = 'iri-seal'; step(); };
        return;
      }
      if (phase === 'iri-seal'){
        copy.textContent = (story.iriCheckpoint && story.iriCheckpoint.sebaPostIri)
          ? _resolveSebaText(story.iriCheckpoint.sebaPostIri, app)
          : 'You have iri. The voice has gone out into the world.';
        if (counter) counter.textContent = '';
        cta.textContent = 'Compose Heka phrase';
        cta.onclick = function(){
          try { _invokeHekaPhraseComposition(); } catch (_){ /* non-fatal */ }
          ctx.finishIri(teaching);
        };
        return;
      }
    }
    step();
  }

  window.Senebty.foundationHeka = { LESSON_ID, start, isCompleted, recordIri, render, };
})();
