// senebty/lib/foundation-mu-streak.js
// Foundation 4 — Mu Streak (STREAK_IRI, 21 consecutive days of water-tap).
// type:'foundation' — counts in foundationsCompleted.
// Power Word MU reused from F1 (M1 RT verdict HIGH — glyph 𓈗 retained on F4 card).
// "Memory becomes body" thematic anchor.
// Two-mode flow:
//   Pre-streak first visit: teach F4 story (chunks + comprehension) via the
//     foundationRender helper, then renderIri shows the streak-tracker.
//   Pre-streak repeat visit: skip story; render tracker directly.
//   Post-21-day: tracker enters seal-mode (recordIri).
// M4 Task 9: render() delegates to foundationRender helper on first visit only.
(function(){
  if (typeof window === 'undefined') return;
  window.Senebty = window.Senebty || {};

  const LESSON_ID = 'foundation-4-mu-streak';

  function start(){
    if (typeof window.App !== 'undefined' && typeof window.App.nav === 'function'){
      window.App.nav('senebtyFoundation', { key: 'mu-streak' });
    }
  }

  function isCompleted(){
    const u = window.App && window.App.user;
    if (!u || !u.senebty || !u.senebty.iriCompletedByLesson) return false;
    return !!u.senebty.iriCompletedByLesson[LESSON_ID];
  }

  function recordIri(evidence){
    if (typeof window.App !== 'undefined' && window.App._iri && typeof window.App._iri.record === 'function'){
      return window.App._iri.record(LESSON_ID, 'STREAK_IRI', evidence, true);
    }
    const u = window.App && window.App.user;
    if (!u || !u.senebty) return null;
    u.senebty.iriCompletedByLesson = u.senebty.iriCompletedByLesson || {};
    u.senebty.iriCompletedByLesson[LESSON_ID] = { iriType: 'STREAK_IRI', evidence, timestamp: Date.now() };
    if (typeof window.App.saveUser === 'function') window.App.saveUser();
    return { accepted: true, fallback: true };
  }

  function _resolveSebaText(s, app){
    if (!s) return '';
    var name = (app && app.user && (app.user.name || app.user.displayName)) || 'friend';
    return String(s).replace(/\{name\}/g, name);
  }

  function _waterStreakDays(app){
    if (!app || !app.user || !app.user.senebty || !Array.isArray(app.user.senebty.iriLog)) return 0;
    var log = app.user.senebty.iriLog;
    var days = {};
    for (var i = 0; i < log.length; i++){
      var e = log[i];
      if (!e || e.type !== 'WATER_IRI') continue;
      var d = new Date(e.ts);
      var key = d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
      days[key] = true;
    }
    var streak = 0;
    var cursor = new Date();
    for (var n = 0; n < 30; n++){
      var k = cursor.getFullYear() + '-' + (cursor.getMonth()+1) + '-' + cursor.getDate();
      if (days[k]){ streak++; }
      else if (n === 0){ /* allow today missing — count from yesterday */ }
      else { break; }
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  function _hasSeenIntro(){
    var u = window.App && window.App.user;
    if (!u || !u.senebty) return false;
    return !!u.senebty.foundationMuStreakIntroSeen;
  }
  function _markSeenIntro(app){
    var u = app && app.user;
    if (!u) return;
    u.senebty = u.senebty || {};
    u.senebty.foundationMuStreakIntroSeen = true;
    if (typeof app.saveUser === 'function') app.saveUser();
  }

  // Render the streak tracker directly (no helper). Used on repeat visits and
  // as the iri-handoff target on the first visit.
  function _renderTracker(app){
    var stage = document.querySelector('#senebtyFoundation .senebty-foundation-stage');
    var glyph = document.getElementById('senebtyFoundationGlyph');
    var copy = document.getElementById('senebtyFoundationCopy');
    var counter = document.getElementById('senebtyFoundationCounter');
    var cta = document.getElementById('senebtyFoundationCta');
    var vessel = document.getElementById('senebtyFoundationVessel');
    if (!stage || !copy || !cta) return;

    if (stage) stage.setAttribute('data-phase', 'mu-streak');
    if (glyph) glyph.textContent = '𓈗';
    if (vessel) vessel.style.display = 'none';

    var story = (window.Senebty && window.Senebty.foundationMuStreakStory) || null;
    var streak = _waterStreakDays(app);
    var TARGET = (story && story.iriCheckpoint && story.iriCheckpoint.daysRequired) || 21;
    if (counter) counter.textContent = streak + ' / ' + TARGET;
    cta.style.display = '';

    if (streak >= TARGET){
      copy.textContent = 'Twenty-one days of Mu. The streak holds. Tap to seal the iri.';
      cta.textContent = 'Seal STREAK_IRI';
      cta.onclick = function(){
        recordIri({ days: streak, target: TARGET });
        if (app && typeof app.saveUser === 'function') app.saveUser();
        if (app && typeof app._checkTierAdvancement === 'function') app._checkTierAdvancement();
        if (app && typeof app.nav === 'function') app.nav('senebty');
      };
      return;
    }

    var promptText = (story && story.iriCheckpoint && story.iriCheckpoint.prompt)
      || 'Drink one cup of water now. Then tomorrow. Twenty-one mornings in a row.';
    copy.textContent = 'Mu Streak: day ' + streak + ' of ' + TARGET + '. Memory becomes body.\n\n' + promptText;
    cta.textContent = 'Go to Mu (today\u2019s cup)';
    cta.onclick = function(){
      if (app && typeof app.nav === 'function') app.nav('senebtyFoundation', { key: 'mu' });
    };
  }

  function render(app){
    var copy = document.getElementById('senebtyFoundationCopy');
    var cta = document.getElementById('senebtyFoundationCta');
    if (!copy || !cta) return;

    if (isCompleted()){
      var story0 = (window.Senebty && window.Senebty.foundationMuStreakStory) || null;
      copy.textContent = (story0 && story0.iriCheckpoint && story0.iriCheckpoint.sebaPostIri)
        ? _resolveSebaText(story0.iriCheckpoint.sebaPostIri, app)
        : 'You have iri the 21-day Mu streak. Memory has become body.';
      cta.style.display = '';
      cta.textContent = 'Back to gate';
      cta.onclick = function(){ if (app && typeof app.nav === 'function') app.nav('senebty'); };
      return;
    }

    var story = (window.Senebty && window.Senebty.foundationMuStreakStory) || null;

    // First visit: run story + comp via helper, then hand off to tracker.
    if (story && !_hasSeenIntro()){
      if (!window.Senebty || !window.Senebty.foundationRender ||
          typeof window.Senebty.foundationRender.run !== 'function'){
        console.error('[foundation-mu-streak] foundationRender helper missing');
        return;
      }
      window.Senebty.foundationRender.run(app, {
        lessonId: LESSON_ID,
        foundationKey: 'mu-streak',
        glyph: '𓈗', // M1 RT HIGH
        story: story,
        isCompleted: isCompleted,
        recordIri: recordIri,
        renderIri: function(appRef, ctx){
          // Mark intro seen, then transition to tracker. The tracker handles
          // its own seal logic (foundationRender's ctx.finishIri is bypassed
          // because the streak iri is multi-day, not single-session).
          _markSeenIntro(appRef);
          _renderTracker(appRef);
        },
      });
      return;
    }

    // Repeat visit OR no story loaded: render tracker directly.
    _renderTracker(app);
  }

  window.Senebty.foundationMuStreak = { LESSON_ID, start, isCompleted, recordIri, render, };
})();
