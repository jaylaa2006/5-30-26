// senebty/lib/foundation-wedeha.js
// Foundation 5 — Wedeha (The Plate of Kemet). PHOTO_IRI: parent uploads
// one photo of the plate prepared with the child.
//
// v3.50.0 — initial ship. Closes the 8-foundation set.
// See docs/superpowers/specs/2026-05-16-senebty-f5-wedeha-photo-iri-design.md

(function () {
  if (typeof window === 'undefined') return;
  window.Senebty = window.Senebty || {};

  var LESSON_ID = 'foundation-5-wedeha';
  var FOUNDATION_ID = 'foundation-5-wedeha';

  function isCompleted() {
    var u = window.App && window.App.user;
    if (!u || !u.senebty || !u.senebty.iriCompletedByLesson) return false;
    return !!u.senebty.iriCompletedByLesson[LESSON_ID];
  }

  function recordIri(evidence) {
    if (typeof window.App !== 'undefined' && window.App._iri && typeof window.App._iri.record === 'function') {
      return window.App._iri.record(LESSON_ID, 'WEDEHA_PHOTO_IRI', evidence, true);
    }
    return null;
  }

  function start() {
    if (typeof window.App !== 'undefined' && typeof window.App.nav === 'function') {
      window.App.nav('senebtyFoundation', { key: 'wedeha' });
    }
  }

  function _resolveSebaText(s, app) {
    if (!s) return '';
    var n = (app && app.user && (app.user.name || app.user.displayName)) || 'friend';
    return String(s).replace(/\{name\}/g, n.charAt(0).toUpperCase() + n.slice(1));
  }

  async function _hasActiveConsent(app) {
    try {
      var res = await fetch('/api/senebty/consent/state?foundationId=' + encodeURIComponent(FOUNDATION_ID), {
        credentials: 'same-origin',
      });
      if (!res.ok) return false;
      var data = await res.json();
      return !!(data && data.active);
    } catch (e) {
      console.error('[foundation-wedeha] consent state fetch failed', e);
      return false;
    }
  }

  function _renderGateMessage(app) {
    var copy = document.getElementById('senebtyFoundationCopy');
    var cta = document.getElementById('senebtyFoundationCta');
    if (!copy || !cta) return;
    copy.textContent = 'This lesson needs your parent’s permission first. Show this to your parent.';
    cta.style.display = '';
    cta.textContent = 'Hand to parent';
    cta.onclick = function () {
      if (window.App && typeof window.App._promptParentPin === 'function') {
        window.App._promptParentPin(function () {
          if (window.Senebty && window.Senebty.consentDialog && typeof window.Senebty.consentDialog.openFor === 'function') {
            window.Senebty.consentDialog.openFor(FOUNDATION_ID, function (consented) {
              if (consented) render(app);
            });
          } else {
            console.error('[foundation-wedeha] consent dialog module missing');
          }
        });
      } else {
        console.error('[foundation-wedeha] _promptParentPin missing on App');
      }
    };
  }

  function _renderWaitingForParent(app) {
    var copy = document.getElementById('senebtyFoundationCopy');
    var cta = document.getElementById('senebtyFoundationCta');
    if (!copy || !cta) return;
    copy.textContent = 'Now prepare the plate with your parent. When the plate is ready, your parent will upload a photo from their dashboard. The iri waits.';
    cta.style.display = '';
    cta.textContent = 'Back to gate';
    cta.onclick = function () { if (app && typeof app.nav === 'function') app.nav('senebty'); };
  }

  function render(app) {
    var copy = document.getElementById('senebtyFoundationCopy');
    if (!copy) return;
    var story = (window.Senebty && window.Senebty.foundationWedehaStory) || null;

    if (isCompleted()) {
      copy.textContent = (story && story.iriCheckpoint && story.iriCheckpoint.sebaPostIri)
        ? _resolveSebaText(story.iriCheckpoint.sebaPostIri, app)
        : 'You have iri. The plate is sealed.';
      var cta = document.getElementById('senebtyFoundationCta');
      if (cta) {
        cta.style.display = '';
        cta.textContent = 'Back to gate';
        cta.onclick = function () { if (app && typeof app.nav === 'function') app.nav('senebty'); };
      }
      return;
    }

    _hasActiveConsent(app).then(function (consented) {
      if (!consented) { _renderGateMessage(app); return; }
      if (!story) { copy.textContent = 'Story data not loaded. Please refresh.'; return; }
      if (!window.Senebty.foundationRender || typeof window.Senebty.foundationRender.run !== 'function') {
        console.error('[foundation-wedeha] foundationRender helper missing');
        return;
      }
      window.Senebty.foundationRender.run(app, {
        lessonId: LESSON_ID,
        foundationKey: 'wedeha',
        glyph: '𓀚',
        story: story,
        isCompleted: isCompleted,
        recordIri: recordIri,
        renderIri: function (appRef) { _renderWaitingForParent(appRef); },
      });
    });
  }

  window.Senebty.foundationWedeha = {
    LESSON_ID: LESSON_ID,
    FOUNDATION_ID: FOUNDATION_ID,
    start: start,
    isCompleted: isCompleted,
    recordIri: recordIri,
    render: render,
  };
})();
