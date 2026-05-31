// senebty/lib/consent-dialog.js
// Per-foundation consent dialog modal. Late-binding installer per Rule 2.
//
// Usage: Senebty.consentDialog.openFor(foundationId, callback(consented:boolean))
(function () {
  if (typeof window === 'undefined') return;

  var COPY = {
    'foundation-5-wedeha':
      'This lesson collects a photo of the prepared plate. The photo is stored encrypted, viewable only by you, auto-deleted on your confirmation or 30 days, whichever first. Do you consent?',
  };

  function openFor(foundationId, callback) {
    var overlay = document.createElement('div');
    overlay.className = 'senebty-consent-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'senebty-consent-heading');

    var modal = document.createElement('div');
    modal.className = 'senebty-consent-modal';
    var heading = document.createElement('h2');
    heading.id = 'senebty-consent-heading';
    heading.className = 'senebty-consent-heading';
    heading.textContent = 'Photo permission';

    var copy = document.createElement('p');
    copy.className = 'senebty-consent-copy';
    copy.textContent = COPY[foundationId] || 'This lesson collects a photo. Do you consent?';

    var policyLink = document.createElement('a');
    policyLink.className = 'senebty-consent-policy-link';
    policyLink.href = '/photo-policy.html';
    policyLink.target = '_blank';
    policyLink.rel = 'noopener';
    policyLink.textContent = 'Read the photo policy';

    var actions = document.createElement('div');
    actions.className = 'senebty-consent-actions';
    var consentBtn = document.createElement('button');
    consentBtn.type = 'button';
    consentBtn.className = 'senebty-consent-consent';
    consentBtn.textContent = 'I consent';
    var notNowBtn = document.createElement('button');
    notNowBtn.type = 'button';
    notNowBtn.className = 'senebty-consent-not-now';
    notNowBtn.textContent = 'Not now';

    function close(consented) {
      overlay.remove();
      document.removeEventListener('keydown', _escHandler);
      document.removeEventListener('keydown', _trapHandler);
      if (typeof callback === 'function') callback(consented);
    }

    consentBtn.addEventListener('click', function () {
      fetch('/api/senebty/consent', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ foundationId: foundationId }),
      }).then(function (r) {
        if (!r.ok) { console.error('[consent-dialog] post failed', r.status); close(false); return; }
        close(true);
      }).catch(function (e) { console.error('[consent-dialog] fetch error', e); close(false); });
    });
    notNowBtn.addEventListener('click', function () { close(false); });

    actions.appendChild(consentBtn);
    actions.appendChild(notNowBtn);
    modal.appendChild(heading);
    modal.appendChild(copy);
    modal.appendChild(policyLink);
    modal.appendChild(actions);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    consentBtn.focus();

    // ESC closes (a11y v3.51.23 — WCAG 2.1.2 No Keyboard Trap).
    var _escHandler = function(e){
      if (e.key === 'Escape'){ e.preventDefault(); close(false); }
    };
    document.addEventListener('keydown', _escHandler);

    // Focus trap — Tab/Shift-Tab cycle: policyLink → consentBtn → notNowBtn (WCAG 2.1.2).
    var _trapHandler = function(e){
      if (e.key !== 'Tab') return;
      var focusables = overlay.querySelectorAll('a, button:not([disabled])');
      if (!focusables.length) return;
      var first = focusables[0];
      var last  = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first){
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last){
        e.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', _trapHandler);
  }

  window.__InstallConsentDialog__ = function (targetApp) {
    if (!targetApp || typeof targetApp !== 'object') return false;
    targetApp.Senebty = targetApp.Senebty || {};
    targetApp.Senebty.consentDialog = { openFor: openFor };
    return true;
  };
  // Also install on window.Senebty directly so foundation-wedeha.js can find it
  window.Senebty = window.Senebty || {};
  window.Senebty.consentDialog = { openFor: openFor };
})();
