// senebty/lib/foundation-four-treasures.js
// Foundation 2 — The Four Treasures (Khat / Ib / Ka / Ba).
// type:'foundation' — DOES count toward foundationsCompleted (4th arg true on iri.record).
// Per Cultural Consensus M1 binding: BODY_IRI is the tap-each-treasure-card-and-recite
// pattern, NOT body-locations (forehead/abdomen/chest pattern was REJECTED).
// M4 Task 9: render() now delegates to window.Senebty.foundationRender.run().
// The bespoke BODY_IRI tap-each-treasure logic is relocated into _renderBodyIri().
(function(){
  if (typeof window === 'undefined') return;
  window.Senebty = window.Senebty || {};

  const LESSON_ID = 'foundation-2-four-treasures';

  function start(){
    if (typeof window.App !== 'undefined' && typeof window.App.nav === 'function'){
      window.App.nav('senebtyFoundation', { key: 'four-treasures' });
    }
  }

  function isCompleted(){
    const u = window.App && window.App.user;
    if (!u || !u.senebty || !u.senebty.iriCompletedByLesson) return false;
    return !!u.senebty.iriCompletedByLesson[LESSON_ID];
  }

  function recordIri(evidence){
    if (typeof window.App !== 'undefined' && window.App._iri && typeof window.App._iri.record === 'function'){
      // 4th arg true: this Foundation IRI counts toward foundationsCompleted tally.
      return window.App._iri.record(LESSON_ID, 'BODY_IRI', evidence, true);
    }
    const u = window.App && window.App.user;
    if (!u || !u.senebty) return null;
    u.senebty.iriCompletedByLesson = u.senebty.iriCompletedByLesson || {};
    u.senebty.iriCompletedByLesson[LESSON_ID] = {
      iriType: 'BODY_IRI',
      evidence,
      timestamp: Date.now(),
    };
    if (typeof window.App.saveUser === 'function') window.App.saveUser();
    return { accepted: true, fallback: true };
  }

  function _resolveSebaText(s, app){
    if (!s) return '';
    var name = (app && app.user && (app.user.name || app.user.displayName)) || 'friend';
    return String(s).replace(/\{name\}/g, name);
  }

  // M4 Task 9 — render() now delegates the illustrated chunk-reading + MCQ
  // comprehension flow to the shared foundationRender helper, and supplies the
  // bespoke BODY_IRI tap-each-treasure checkpoint as the renderIri callback.
  function render(app){
    if (!window.Senebty || !window.Senebty.foundationRender ||
        typeof window.Senebty.foundationRender.run !== 'function'){
      console.error('[foundation-four-treasures] foundationRender helper missing');
      return;
    }
    window.Senebty.foundationRender.run(app, {
      lessonId: LESSON_ID,
      foundationKey: 'four-treasures',
      glyph: undefined,  // M1 Cultural Consensus verdict: F2 — no glyph.
      story: (window.Senebty && window.Senebty.foundationFourTreasuresStory) || null,
      isCompleted: isCompleted,
      recordIri: recordIri,
      renderIri: _renderBodyIri,
    });
  }

  // BODY_IRI — tap each of the four treasures, recite its name. Relocated
  // from the M3 state machine's iri-intro / iri-tap / complete phases.
  // Cultural Consensus M1 binding: tap-each-card pattern (NOT body-locations).
  function _renderBodyIri(app, ctx){
    var story = ctx.story || {};
    var copy = ctx.copy, cta = ctx.cta, counter = ctx.counter;
    var TREASURES = [
      { name: 'Khat', meaning: 'the body' },
      { name: 'Ib', meaning: 'the heart-mind' },
      { name: 'Ka', meaning: 'the vital essence' },
      { name: 'Ba', meaning: 'the personality' },
    ];
    var treasureIdx = 0;
    var tapped = [];
    var phase = 'iri-intro';  // iri-intro | iri-tap | complete

    function step(){
      cta.style.display = '';
      if (phase === 'iri-intro'){
        copy.textContent = (story.iriCheckpoint && story.iriCheckpoint.prompt)
          || 'Tap each of the four treasures. Say its name. The Per Ankh master listens.';
        if (counter) counter.textContent = '';
        cta.textContent = 'Begin iri';
        cta.onclick = function(){ phase = 'iri-tap'; treasureIdx = 0; tapped = []; step(); };
        return;
      }
      if (phase === 'iri-tap'){
        if (treasureIdx >= TREASURES.length){ phase = 'complete'; step(); return; }
        var t = TREASURES[treasureIdx];
        copy.textContent = 'Treasure ' + (treasureIdx + 1) + ' of 4: ' + t.name +
          ' — ' + t.meaning + '. Tap to name it.';
        if (counter) counter.textContent = (treasureIdx + 1) + ' / 4';
        cta.textContent = 'Tap ' + t.name;
        cta.onclick = function(){
          tapped.push({ treasure: t.name, recited: true });
          treasureIdx++;
          step();
        };
        return;
      }
      if (phase === 'complete'){
        copy.textContent = (story.iriCheckpoint && story.iriCheckpoint.sebaPostIri)
          ? _resolveSebaText(story.iriCheckpoint.sebaPostIri, app)
          : 'You have iri. The four treasures are in your voice now.';
        if (counter) counter.textContent = '';
        cta.textContent = 'Complete';
        cta.onclick = function(){ ctx.finishIri({ taps: tapped }); };
        return;
      }
    }
    step();
  }

  window.Senebty.foundationFourTreasures = {
    LESSON_ID,
    start, isCompleted, recordIri, render,
  };
})();
