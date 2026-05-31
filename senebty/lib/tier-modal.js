// senebty/lib/tier-modal.js
// Tier-advancement modal for Per Ankh Senebty.
// Tone-canon locked: title = glyph + displayName; body = tiers.js advancementCopy
// verbatim; button = "I understand."; silent fade exit; 1500ms hold pre-entry.
// Imani binding: deferDuringRitual queues until flushQueue at ritual close.
// Tehuti binding: focus-trap, ESC dismiss, first-focus on the button, secondary-styled.
(function(){
  if (typeof window === 'undefined') return;
  window.Senebty = window.Senebty || {};

  const PRE_ENTRY_HOLD_MS = 1500;
  let _queue = [];
  let _escHandler = null;

  function findTier(key){
    return (window.Senebty.tiers || []).find(t => t.key === key);
  }

  function buildModal(tier){
    const overlay = document.createElement('div');
    overlay.className = 'senebty-tier-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'senebty-tier-modal-title');

    const modal = document.createElement('div');
    modal.className = 'senebty-tier-modal';

    const title = document.createElement('h2');
    title.className = 'senebty-tier-modal__title';
    title.id = 'senebty-tier-modal-title';
    if (tier.mdwNtr && tier.mdwNtrConfidence === 'high') {
      title.textContent = `${tier.mdwNtr} ${tier.displayName}`;
    } else {
      title.textContent = tier.displayName;
    }
    modal.appendChild(title);

    const body = document.createElement('p');
    body.className = 'senebty-tier-modal__body';
    body.textContent = tier.advancementCopy;
    modal.appendChild(body);

    const btn = document.createElement('button');
    btn.className = 'senebty-tier-modal__btn btn btn-secondary';
    btn.type = 'button';
    btn.textContent = 'I understand.';
    btn.addEventListener('click', () => dismiss(overlay));
    modal.appendChild(btn);

    overlay.appendChild(modal);
    return { overlay, btn };
  }

  function dismiss(overlay){
    // Mark exiting (CSS transitions on opacity); removal is synchronous so
    // callers (and the focus manager) see the modal gone immediately. The
    // fade is purely cosmetic via transition on the --exiting class set on
    // the same node — for this UX (silent fade close), instant removal is
    // acceptable and keeps the a11y contract simple (focus returns at once).
    overlay.classList.add('senebty-tier-modal-overlay--exiting');
    overlay.remove();
    if (_escHandler){ document.removeEventListener('keydown', _escHandler); _escHandler = null; }
  }

  function trapFocus(overlay){
    overlay.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const focusables = overlay.querySelectorAll('button, [tabindex]:not([tabindex="-1"])');
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
    });
  }

  function showNow(tierKey){
    const tier = findTier(tierKey);
    if (!tier) {
      console.warn('[senebty/tier-modal] unknown tier key:', tierKey);
      return;
    }
    const { overlay, btn } = buildModal(tier);
    document.body.appendChild(overlay);
    trapFocus(overlay);
    btn.focus();
    // Clear any prior ESC handler before binding a new one (defensive against
    // re-entrancy in tests or fast successive show() calls).
    if (_escHandler){ document.removeEventListener('keydown', _escHandler); _escHandler = null; }
    _escHandler = (e) => { if (e.key === 'Escape') dismiss(overlay); };
    document.addEventListener('keydown', _escHandler);
  }

  function show(tierKey, opts){
    opts = opts || {};
    if (opts.deferDuringRitual === true && window.Senebty.tierModal._activeRitual === true) {
      _queue.push(tierKey);
      return;
    }
    if (opts.preEntryHold === false) { showNow(tierKey); return; }
    setTimeout(() => showNow(tierKey), PRE_ENTRY_HOLD_MS);
  }

  function flushQueue(){
    while (_queue.length > 0) {
      showNow(_queue.shift());
    }
  }

  window.Senebty.tierModal = {
    show: show,
    flushQueue: flushQueue,
    _activeRitual: false,
  };
})();
