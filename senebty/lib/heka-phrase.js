// senebty/lib/heka-phrase.js
// Heka phrase CRUD for Foundation 8.
// Parent-Voice binding: storage keyed on user.id (rename-safe), never name.
// QA-DA binding: parent delete requires parentPin re-entry; tier demotes (4→3).
// Tehuti binding: focus-trap + ESC + first-focus-on-Cancel.
(function(){
  if (typeof window === 'undefined') return;
  window.Senebty = window.Senebty || {};
  const document = window.document;

  function get(){
    const u = window.App && window.App.user;
    if (!u || !u.id || !u.senebty) return null;
    return u.senebty.hekaPhrasePersonal;
  }

  function set(phrase){
    const u = window.App && window.App.user;
    if (!u || !u.id || !u.senebty) return;
    u.senebty.hekaPhrasePersonal = phrase;
    u.senebty.hekaPhraseSetAt = Date.now();
    if (typeof window.App.saveUser === 'function') window.App.saveUser();
  }

  function clear(){
    const u = window.App && window.App.user;
    if (!u || !u.id || !u.senebty) return;
    u.senebty.hekaPhrasePersonal = null;
    u.senebty.hekaPhraseSetAt = null;
    if (typeof window.App.saveUser === 'function') window.App.saveUser();
  }

  function makeEl(tag, opts){
    const el = document.createElement(tag);
    if (!opts) return el;
    if (opts.className) el.className = opts.className;
    if (opts.text != null) el.textContent = opts.text;
    if (opts.attrs){
      for (const k of Object.keys(opts.attrs)) el.setAttribute(k, opts.attrs[k]);
    }
    if (opts.children){
      for (const c of opts.children) el.appendChild(c);
    }
    return el;
  }

  function openParentDeleteModal(){
    const u = window.App && window.App.user;
    if (!u || !u.id || !u.senebty) return;
    // Close any existing parent-delete modal so only one is live at a time.
    const existing = document.querySelectorAll('.senebty-heka-parent-delete-overlay');
    for (const ex of existing) closeModal(ex);
    // Display name lookup — DISPLAY ONLY. Storage is keyed on user.id via the
    // App.user object and persisted via App.saveUser(); name is rendered into
    // the modal copy so the parent sees which child's phrase is being deleted.
    const childName = u.name || 'your child';
    const tier = u.senebty.tier;
    const tiers = window.Senebty.tiers || [];
    const currentTier = tiers[tier];
    const previousTier = tiers[Math.max(0, tier - 1)];
    const currentLabel = currentTier ? currentTier.displayName : 'current';
    const previousLabel = previousTier ? previousTier.displayName : 'previous';

    const overlay = makeEl('div', {
      className: 'senebty-heka-parent-delete-overlay',
      attrs: { role: 'dialog', 'aria-modal': 'true' },
    });

    const heading = makeEl('h2', { text: `Delete ${childName}'s Heka phrase` });
    const tierLine = makeEl('p', { text: `Tier returns from ${currentLabel} to ${previousLabel}.` });
    const pathLine = makeEl('p', { text: 'The path waits.' });

    const pinInput = makeEl('input', {
      attrs: { type: 'password', name: 'senebty-heka-parent-pin', autocomplete: 'off' },
    });
    const label = makeEl('label', {
      children: [document.createTextNode('Re-enter parent PIN to confirm:'), pinInput],
    });

    const errEl = makeEl('p', {
      className: 'senebty-heka-parent-delete-error',
      text: 'Parent PIN incorrect.',
    });
    errEl.hidden = true;

    const cancel = makeEl('button', {
      className: 'btn btn-secondary senebty-heka-parent-delete-cancel',
      text: 'Cancel',
      attrs: { type: 'button' },
    });
    const confirm = makeEl('button', {
      className: 'btn btn-secondary senebty-heka-parent-delete-confirm',
      text: 'Confirm delete.',
      attrs: { type: 'button' },
    });
    const actions = makeEl('div', {
      className: 'senebty-heka-parent-delete-actions',
      children: [cancel, confirm],
    });

    const modal = makeEl('div', {
      className: 'senebty-heka-parent-delete-modal',
      children: [heading, tierLine, pathLine, label, errEl, actions],
    });
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    cancel.addEventListener('click', () => closeModal(overlay));
    confirm.addEventListener('click', async () => {
      const pin = pinInput.value;
      const verifier = window.App && window.App._verifyPinServerSide;
      const ok = (typeof verifier === 'function') ? await verifier.call(window.App, pin) : false;
      if (!ok){ errEl.hidden = false; return; }
      // Clear phrase
      u.senebty.hekaPhrasePersonal = null;
      u.senebty.hekaPhraseSetAt = null;
      // Clear F8 iri completion
      if (u.senebty.iriCompletedByLesson && u.senebty.iriCompletedByLesson['foundation-8-heka']){
        delete u.senebty.iriCompletedByLesson['foundation-8-heka'];
      }
      // Tier demotion: sunu-sba (4) → wabau (3)
      if (u.senebty.tier === 4){ u.senebty.tier = 3; }
      if (typeof window.App.saveUser === 'function') window.App.saveUser();
      closeModal(overlay);
    });

    // First-focus on Cancel (Tehuti binding)
    cancel.focus();

    // Focus-trap (Tehuti binding)
    overlay.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const focusables = overlay.querySelectorAll('button, input');
      if (!focusables.length) return;
      const first = focusables[0], last = focusables[focusables.length-1];
      if (e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
    });
    // ESC closes (Tehuti binding)
    overlay._escHandler = (e) => { if (e.key === 'Escape') closeModal(overlay); };
    document.addEventListener('keydown', overlay._escHandler);
  }

  function closeModal(overlay){
    if (overlay._escHandler){
      document.removeEventListener('keydown', overlay._escHandler);
      overlay._escHandler = null;
    }
    overlay.remove();
  }

  // M4 Task 10 — composition modal at F8 iri-completion. Replaces the
  // browser window.prompt() shim with a styled, accessible modal.
  // Tone-canon copy + Tehuti a11y bindings (focus-trap, ESC, first-focus).
  function openComposeModal(opts){
    opts = opts || {};
    const u = window.App && window.App.user;
    if (!u || !u.id || !u.senebty) return null;
    // Close any existing compose modal so only one is live at a time.
    const existing = document.querySelectorAll('.senebty-heka-compose-overlay');
    for (const ex of existing) closeModal(ex);

    const childName = (opts.childName || u.name || 'friend');
    const MAX_LEN = 280;
    const MIN_LEN = 6;

    const overlay = makeEl('div', {
      className: 'senebty-heka-compose-overlay',
      attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'senebty-heka-compose-heading' }
    });

    const heading = makeEl('h2', { text: 'Compose your Heka phrase' });
    heading.id = 'senebty-heka-compose-heading';

    // Tone-canon — locked verbatim from spec ("One sentence, your own, said
    // true — for your house"). Cultural Consensus Panel binding from M1.
    const intro = makeEl('p', {
      className: 'senebty-heka-compose-intro',
      text: 'One sentence. Your own. Said true — for ' + childName + '\'s house.'
    });
    const sub = makeEl('p', {
      className: 'senebty-heka-compose-sub',
      text: 'Compose with your parent. The Per Ankh listens.'
    });

    const ta = makeEl('textarea', {
      className: 'senebty-heka-compose-textarea',
      attrs: { rows: '3', maxlength: String(MAX_LEN), 'aria-label': 'Your Heka phrase' }
    });

    const counter = makeEl('div', {
      className: 'senebty-heka-compose-counter',
      text: '0 / ' + MAX_LEN
    });

    const cancel = makeEl('button', {
      className: 'btn btn-secondary senebty-heka-compose-cancel',
      text: 'Cancel',
      attrs: { type: 'button' }
    });
    const save = makeEl('button', {
      className: 'btn btn-primary senebty-heka-compose-save',
      text: 'Speak it',
      attrs: { type: 'button', disabled: '' }
    });
    save.disabled = true;
    const actions = makeEl('div', {
      className: 'senebty-heka-compose-actions',
      children: [cancel, save]
    });

    const modal = makeEl('div', {
      className: 'senebty-heka-compose-modal',
      children: [heading, intro, sub, ta, counter, actions]
    });
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    function update(){
      const v = ta.value.trim();
      counter.textContent = v.length + ' / ' + MAX_LEN;
      save.disabled = (v.length < MIN_LEN);
    }
    ta.addEventListener('input', update);

    cancel.addEventListener('click', () => {
      closeModal(overlay);
      if (typeof opts.onCancel === 'function') opts.onCancel();
    });
    save.addEventListener('click', () => {
      const phrase = ta.value.trim().slice(0, MAX_LEN);
      if (phrase.length < MIN_LEN) return;
      set(phrase);
      closeModal(overlay);
      if (typeof opts.onSave === 'function') opts.onSave(phrase);
    });

    // First-focus on textarea (Tehuti binding — primary action target)
    ta.focus();

    // Focus-trap (Tehuti binding)
    overlay.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const focusables = overlay.querySelectorAll('textarea, button:not([disabled])');
      if (!focusables.length) return;
      const first = focusables[0], last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
    });
    // ESC closes (Tehuti binding)
    overlay._escHandler = (e) => {
      if (e.key === 'Escape'){
        closeModal(overlay);
        if (typeof opts.onCancel === 'function') opts.onCancel();
      }
    };
    document.addEventListener('keydown', overlay._escHandler);

    return overlay;
  }

  window.Senebty.hekaPhrase = { get, set, clear, openParentDeleteModal, openComposeModal };
})();
