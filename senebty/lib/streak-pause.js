// senebty/lib/streak-pause.js
// Streak-pause parent control (3 days/calendar-month cap, future-dated only).
// QA-DA binding: pause-history audit panel below the control.
// Tehuti binding: focus-trap + ESC + first-focus-on-Cancel; secondary "Confirm".
// Parent-Voice binding: "N of 3 used this month" displayed in modal AND dashboard.
// Spec literal: pause is future-dated; the path does not rewrite the past.
(function(){
  if (typeof window === 'undefined') return;
  const document = window.document;
  window.Senebty = window.Senebty || {};

  function currentMonthKey(d){ d = d || new Date(); return d.toISOString().slice(0,7); }

  function maybeResetMonthlyCounter(d){
    const u = window.App && window.App.user;
    if (!u || !u.senebty || !u.senebty.streakPause) return;
    const key = currentMonthKey(d);
    const sp = u.senebty.streakPause;
    if (sp.monthCounterResetAt && sp.monthCounterResetAt !== key){
      sp.daysUsedThisMonth = 0;
      sp.monthCounterResetAt = key;
      if (typeof window.App.saveUser === 'function') window.App.saveUser();
    } else if (!sp.monthCounterResetAt){
      sp.monthCounterResetAt = key;
      if (typeof window.App.saveUser === 'function') window.App.saveUser();
    }
  }

  function openModal(){
    maybeResetMonthlyCounter();
    const u = window.App.user.senebty.streakPause;
    const used = u.daysUsedThisMonth || 0;
    const remaining = Math.max(0, 3 - used);

    const overlay = document.createElement('div');
    overlay.className = 'senebty-streak-pause-modal-overlay';
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-modal','true');

    // Rule 4 — pure DOM construction; no innerHTML template injection.
    const modal = document.createElement('div');
    modal.className = 'senebty-streak-pause-modal';

    const heading = document.createElement('h2');
    heading.textContent = 'Pause streak';
    modal.appendChild(heading);

    const intro = document.createElement('p');
    intro.textContent = 'Pause future days. The path does not rewrite the past.';
    modal.appendChild(intro);

    const budget = document.createElement('p');
    budget.className = 'senebty-streak-pause-modal__budget';
    budget.textContent = used + ' of 3 pause days used this month.';
    modal.appendChild(budget);

    const fieldset = document.createElement('fieldset');
    fieldset.className = 'senebty-streak-pause-modal__days';

    const legend = document.createElement('legend');
    legend.textContent = 'How many days?';
    fieldset.appendChild(legend);

    [1, 2, 3].forEach(function(n) {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'senebty-streak-pause-days';
      input.value = String(n);
      if (n > remaining) input.disabled = true;
      label.appendChild(input);
      label.appendChild(document.createTextNode(' ' + n + ' day' + (n > 1 ? 's' : '')));
      fieldset.appendChild(label);
    });
    modal.appendChild(fieldset);

    const actions = document.createElement('div');
    actions.className = 'senebty-streak-pause-modal__actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-secondary senebty-streak-pause-modal__cancel';
    cancelBtn.textContent = 'Cancel';
    actions.appendChild(cancelBtn);

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'btn btn-secondary senebty-streak-pause-modal__confirm';
    confirmBtn.textContent = 'Confirm pause.';
    actions.appendChild(confirmBtn);

    modal.appendChild(actions);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // cancelBtn and confirmBtn are direct references from the createElement block above.
    cancelBtn.addEventListener('click', () => closeModal(overlay));
    confirmBtn.addEventListener('click', () => {
      const checked = modal.querySelector('input[name="senebty-streak-pause-days"]:checked');
      if (!checked) return;
      const days = parseInt(checked.value, 10);
      const startedAt = new Date(); startedAt.setDate(startedAt.getDate() + 1);
      const endsAt = new Date(startedAt); endsAt.setDate(endsAt.getDate() + days - 1);
      const sp = window.App.user.senebty.streakPause;
      sp.active = true;
      sp.startedAt = startedAt.toISOString().slice(0,10);
      sp.endsAt = endsAt.toISOString().slice(0,10);
      sp.daysUsedThisMonth = (sp.daysUsedThisMonth || 0) + days;
      sp.monthCounterResetAt = currentMonthKey();
      window.App.user.streakPauseHistory = window.App.user.streakPauseHistory || [];
      window.App.user.streakPauseHistory.push({ startedAt: sp.startedAt, endsAt: sp.endsAt, days });
      if (typeof window.App.saveUser === 'function') window.App.saveUser();
      closeModal(overlay);
    });

    cancelBtn.focus();
    overlay.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const focusables = overlay.querySelectorAll('button, input:not([disabled])');
      if (focusables.length === 0) return;
      const first = focusables[0], last = focusables[focusables.length-1];
      if (e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
    });
    const escHandler = (e) => { if (e.key === 'Escape') closeModal(overlay); };
    overlay._escHandler = escHandler;
    document.addEventListener('keydown', escHandler);
  }

  function closeModal(overlay){
    if (overlay && overlay._escHandler){
      document.removeEventListener('keydown', overlay._escHandler);
      overlay._escHandler = null;
    }
    if (overlay) overlay.remove();
  }

  function renderHistoryPanel(host){
    const u = window.App && window.App.user;
    const hist = (u && u.streakPauseHistory) || [];
    if (!host) return;
    // Rule 4 — pure DOM construction; no innerHTML template injection.
    const panel = document.createElement('div');
    panel.className = 'senebty-streak-pause-history';

    const h3 = document.createElement('h3');
    h3.textContent = 'Pause history';
    panel.appendChild(h3);

    if (hist.length === 0) {
      const p = document.createElement('p');
      p.textContent = 'No pauses yet.';
      panel.appendChild(p);
    } else {
      const ul = document.createElement('ul');
      hist.forEach(function(h) {
        const li = document.createElement('li');
        li.textContent = h.startedAt + ' – ' + h.endsAt + ' (' + h.days + ' day' + (h.days > 1 ? 's' : '') + ')';
        ul.appendChild(li);
      });
      panel.appendChild(ul);
    }

    host.appendChild(panel);
  }

  window.Senebty.streakPause = {
    openModal,
    closeModal,
    renderHistoryPanel,
    maybeResetMonthlyCounter,
  };
})();
