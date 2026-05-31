// Bridge Mode — Phase 1 (sentence-completion hints)
// Reader-centric module — hangs off App, NOT window.Senebty.
// Spec: docs/superpowers/specs/2026-05-06-bridge-mode-phase-1-design.md
//
// LOAD-ORDER NOTE (v3.43.1): maat-reader.html declares `const App = {...}`
// inside its main inline <script> block, then sets `window.App = App` at the
// end. If we attach to `window.App` at load time (script in <head>), the
// later `window.App = App` reassignment OVERWRITES our addition silently.
//
// Fix: expose `window.__InstallBridgeMode__(App)` and require maat-reader to
// call it AFTER its own `window.App = App;`. Robust to load order, idempotent,
// fails loudly (explicit installer + structured log on host-side wiring miss).
(function () {
  if (typeof window === 'undefined') return;

  var ENDPOINT = (window.location && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
    ? 'http://localhost:3847/api/seba-bridge-hint'
    : '/api/seba-bridge-hint';

  var IDLE_MS = 15000;                 // Imani binding: 15s (NOT 30s)
  var PARTIAL_INPUT_PAUSE_MS = 5000;
  var PARTIAL_INPUT_MIN_CHARS = 5;
  var FETCH_TIMEOUT_MS = 15000;

  // ── isEnabled ──────────────────────────────────────────────────────────────

  function isEnabled(user) {
    return !!(user && user.preferences && user.preferences.bridgeMode === true);
  }

  // ── renderToggle ───────────────────────────────────────────────────────────

  function renderToggle(host, user) {
    if (!host || !user) return;
    user.preferences = user.preferences || {};

    var card = document.createElement('section');
    card.className = 'parent-card reading-prefs-card';
    card.id = 'parentReadingPrefsCard';

    var heading = document.createElement('h3');
    heading.className = 'parent-card-heading';
    heading.textContent = 'Reading Preferences';
    card.appendChild(heading);

    // v3.43.4 — explicit label-for association. Earlier shape relied on the
    // implicit-label-wraps-input pattern, which works in modern browsers but
    // some assistive tech (older NVDA, JAWS profiles) require the explicit
    // for-id link to announce the toggle's label correctly.
    var checkboxId = 'bridge-toggle-' + Math.random().toString(36).slice(2, 9);

    var label = document.createElement('label');
    label.className = 'bridge-toggle-label';
    label.setAttribute('for', checkboxId);

    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.id = checkboxId;
    cb.className = 'bridge-toggle-input';
    cb.checked = !!user.preferences.bridgeMode;
    cb.addEventListener('change', function () {
      user.preferences.bridgeMode = !!cb.checked;
      try { if (window.App && window.App.saveUser) window.App.saveUser(); } catch (_) {}
    });
    label.appendChild(cb);

    var titleSpan = document.createElement('span');
    titleSpan.className = 'bridge-toggle-title';
    titleSpan.textContent = 'Bridge Mode for ' + (user.name || 'this learner');
    label.appendChild(titleSpan);

    var desc = document.createElement('p');
    desc.className = 'bridge-toggle-desc';
    desc.textContent = 'Helps with organizing reflection answers. Seba offers gentle sentence-starters when ' + (user.name || 'this learner') + ' pauses on a question. Default: off.';
    label.appendChild(desc);

    card.appendChild(label);
    host.appendChild(card);
  }

  // ── Telemetry ──────────────────────────────────────────────────────────────
  // emitTelemetry must be defined before fetchHint + showHintOverlay which call it.

  function emitTelemetry(event, ctx, extra) {
    try {
      var payload = Object.assign({
        schema: 'v1',
        event: event,
        session_id: (window.App && window.App.user && window.App.user.id) || 'anon',
        story_id: ctx.storyId,
        question_kind: ctx.questionKind,
        level: ctx.level,
        ts: Date.now()
      }, extra || {});
      // Two-arg form so tests can assert args[0] === '[BRIDGE-HINT]' and JSON.parse(args[1])
      console.log('[BRIDGE-HINT]', JSON.stringify(payload));
    } catch (_) { /* defensive */ }
  }

  // ── Sequence guard ─────────────────────────────────────────────────────────
  // Monotonically increasing sequence number. fetchHint callers pass their own
  // mySeq; responses where mySeq < currentSeq are discarded as stale.

  var currentSeq = 0;

  // ── fetchHint ──────────────────────────────────────────────────────────────

  function fetchHint(ctx, mySeq) {
    // Record this as the most-recent outstanding request.
    if (mySeq > currentSeq) currentSeq = mySeq;
    var ctrl = new AbortController();
    // v3.44.5 — fetch-timeout telemetry. Without this log, a hung origin
    // produces a silent UI hang (AbortController fires at FETCH_TIMEOUT_MS,
    // overlay never opens, no diagnosable signal in dev console). Voice 3
    // QA-DA binding from v3.43.0 2nd-eyes deploy-gate.
    var timedOut = false;
    var timeoutId = setTimeout(function () {
      timedOut = true;
      ctrl.abort();
      emitTelemetry('bridge_fetch_timeout', ctx, { timeout_ms: FETCH_TIMEOUT_MS });
    }, FETCH_TIMEOUT_MS);
    return fetch(ENDPOINT, {
      method: 'POST',
      headers: Object.assign(
        { 'Content-Type': 'application/json' },
        (window.App && typeof window.App._authHeaders === 'function' ? window.App._authHeaders.call(window.App) : {})
      ),
      body: JSON.stringify({
        storyId: ctx.storyId,
        storyTitle: ctx.storyTitle,
        storyPrinciple: ctx.storyPrinciple,
        questionText: ctx.questionText,
        questionKind: ctx.questionKind,
        level: ctx.level,
        learnerInputSoFar: ctx.learnerInputSoFar || ''
      }),
      signal: ctrl.signal
    }).then(function (resp) {
      clearTimeout(timeoutId);
      if (!resp.ok) return null;
      // Always consume the response body so mock counters advance correctly,
      // then guard for staleness after the async json() resolves.
      return resp.json().then(function (data) {
        if (mySeq !== currentSeq) return null;       // stale guard (post-json)
        if (!data || !Array.isArray(data.starters) || data.starters.length !== 3) return null;
        return data;
      });
    }).catch(function (e) {
      clearTimeout(timeoutId);
      // Re-throw with timedOut flag so callers can distinguish timeout
      // from generic network error if needed for telemetry context.
      if (timedOut && e && e.name === 'AbortError') e._bridgeTimedOut = true;
      throw e;
    });
  }

  // ── attachToTextarea ───────────────────────────────────────────────────────

  function attachToTextarea(textarea, ctx, user) {
    if (!isEnabled(user)) return null;
    if (!textarea || textarea.tagName !== 'TEXTAREA') return null;

    var idleTimer = null;
    var pauseTimer = null;
    var affordanceEl = null;

    function clearTimers() {
      if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
      if (pauseTimer) { clearTimeout(pauseTimer); pauseTimer = null; }
    }

    function showAffordance() {
      if (affordanceEl && affordanceEl.parentNode) return;

      affordanceEl = document.createElement('button');
      affordanceEl.type = 'button';
      affordanceEl.className = 'bridge-affordance';
      affordanceEl.setAttribute('aria-label', 'A whisper from Seba — get sentence-starter help');

      var glyph = document.createElement('span');
      glyph.className = 'bridge-affordance-glyph';
      glyph.textContent = '\u{132F9}';   // ankh U+132F9 (Imani+Khepri binding)
      affordanceEl.appendChild(glyph);

      var labelEl = document.createElement('span');
      labelEl.className = 'bridge-affordance-label';
      labelEl.textContent = 'A whisper from Seba';
      affordanceEl.appendChild(labelEl);

      affordanceEl.addEventListener('click', onAffordanceClick);

      if (textarea.parentNode) {
        textarea.parentNode.insertBefore(affordanceEl, textarea.nextSibling);
      } else {
        document.body.appendChild(affordanceEl);
      }

      emitTelemetry('bridge_affordance_shown', ctx);
    }

    function onAffordanceClick() {
      emitTelemetry('bridge_affordance_tapped', ctx);
      var mySeq = ++currentSeq;
      var ctxNow = Object.assign({}, ctx, { learnerInputSoFar: textarea.value || '' });
      fetchHint(ctxNow, mySeq).then(function (data) {
        if (!data || !Array.isArray(data.starters) || data.starters.length !== 3) return;
        showHintOverlay(textarea, data.starters, ctx);
      }).catch(function (e) {
        emitTelemetry('bridge_affordance_tapped', ctx, { error: e && e.name === 'AbortError' ? 'timeout' : 'network' });
      });
    }

    function onInput() {
      clearTimers();
      var len = (textarea.value || '').length;
      if (len >= PARTIAL_INPUT_MIN_CHARS) {
        pauseTimer = setTimeout(showAffordance, PARTIAL_INPUT_PAUSE_MS);
      } else {
        idleTimer = setTimeout(showAffordance, IDLE_MS);
      }
    }

    function onFocus() {
      if (!idleTimer && !pauseTimer && !affordanceEl) {
        idleTimer = setTimeout(showAffordance, IDLE_MS);
      }
    }

    textarea.addEventListener('input', onInput);
    textarea.addEventListener('focus', onFocus);
    if (document.activeElement === textarea) onFocus();

    return {
      detach: function () {
        clearTimers();
        textarea.removeEventListener('input', onInput);
        textarea.removeEventListener('focus', onFocus);
        if (affordanceEl && affordanceEl.parentNode) affordanceEl.parentNode.removeChild(affordanceEl);
        affordanceEl = null;
      },
      _fireIdleTimer: showAffordance
    };
  }

  // ── showHintOverlay ────────────────────────────────────────────────────────

  function showHintOverlay(textarea, starters, ctx) {
    if (!Array.isArray(starters) || starters.length !== 3) return;

    // Remove any existing overlay first (idempotent)
    var prior = document.querySelector('.bridge-hint-overlay');
    if (prior && prior.parentNode) prior.parentNode.removeChild(prior);

    var overlay = document.createElement('div');
    overlay.className = 'bridge-hint-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'bridge-hint-title');

    // Title — locked verbatim (Cultural Consensus binding)
    var titleEl = document.createElement('h3');
    titleEl.id = 'bridge-hint-title';
    titleEl.className = 'bridge-hint-title';
    titleEl.textContent = 'Try starting with one of these:';
    overlay.appendChild(titleEl);

    // Starter list
    var list = document.createElement('div');
    list.className = 'bridge-hint-starter-list';
    overlay.appendChild(list);

    var starterButtons = [];
    starters.forEach(function (s, idx) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bridge-hint-starter';
      btn.textContent = String(s);    // textContent — pure DOM, NOT innerHTML (Sam binding)
      btn.dataset.idx = String(idx);
      btn.addEventListener('click', function () { onPick(idx); });
      list.appendChild(btn);
      starterButtons.push(btn);
    });

    // Close button
    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'bridge-hint-close';
    closeBtn.setAttribute('aria-label', 'Dismiss');
    closeBtn.textContent = '×';  // ×
    closeBtn.addEventListener('click', function () { dismiss('no_pick'); });
    overlay.appendChild(closeBtn);

    // Insert after textarea
    if (textarea.parentNode) {
      textarea.parentNode.insertBefore(overlay, textarea.nextSibling);
    } else {
      document.body.appendChild(overlay);
    }

    emitTelemetry('bridge_hint_shown', ctx);

    // First focus on first starter (Tehuti binding)
    starterButtons[0].focus();

    // Focus trap (Tehuti binding — Tab/Shift+Tab cycles through focusables)
    var focusables = starterButtons.concat([closeBtn]);

    function trapHandler(e) {
      if (e.key !== 'Tab') return;
      var idx = focusables.indexOf(document.activeElement);
      if (idx === -1) return;
      e.preventDefault();
      var next = e.shiftKey
        ? (idx - 1 + focusables.length) % focusables.length
        : (idx + 1) % focusables.length;
      focusables[next].focus();
    }
    overlay.addEventListener('keydown', trapHandler);

    // ESC handler on document (Tehuti binding — removes self on dismiss)
    function escHandler(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        dismiss('no_pick');
      }
    }
    document.addEventListener('keydown', escHandler);

    function onPick(idx) {
      var selStart = (typeof textarea.selectionStart === 'number') ? textarea.selectionStart : (textarea.value || '').length;
      var selEnd   = (typeof textarea.selectionEnd   === 'number') ? textarea.selectionEnd   : selStart;
      var before = textarea.value.slice(0, selStart);
      var after  = textarea.value.slice(selEnd);
      var insert = (before && !before.endsWith(' ') ? ' ' : '') + starters[idx];
      textarea.value = before + insert + after;
      var newPos = (before + insert).length;
      try { textarea.setSelectionRange(newPos, newPos); } catch (_) {}
      emitTelemetry('bridge_hint_starter_picked', ctx, { starter_idx: idx });
      dismiss('picked');
    }

    function dismiss(reason) {
      document.removeEventListener('keydown', escHandler);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (reason === 'no_pick') emitTelemetry('bridge_hint_dismissed_no_pick', ctx);
      try { textarea.focus(); } catch (_) {}
    }
  }

  // ── Namespace assembly (late-binding install) ─────────────────────────────

  var bridgeModeApi = {
    isEnabled: isEnabled,
    renderToggle: renderToggle,
    attachToTextarea: attachToTextarea,
    fetchHint: fetchHint,
    showHintOverlay: showHintOverlay,
    _emitTelemetry: emitTelemetry,
    _config: {
      IDLE_MS: IDLE_MS,
      PARTIAL_INPUT_PAUSE_MS: PARTIAL_INPUT_PAUSE_MS,
      PARTIAL_INPUT_MIN_CHARS: PARTIAL_INPUT_MIN_CHARS,
      FETCH_TIMEOUT_MS: FETCH_TIMEOUT_MS,
      ENDPOINT: ENDPOINT
    }
  };

  // Public installer — maat-reader.html MUST call this after its
  // `window.App = App;` reassignment. Idempotent. Logs structured success
  // beacon so missing installation is visible in console (no silent failure).
  window.__InstallBridgeMode__ = function (targetApp) {
    if (!targetApp || typeof targetApp !== 'object') {
      console.error('[bridge-mode] __InstallBridgeMode__: invalid target App', { targetApp: targetApp });
      return false;
    }
    if (targetApp.bridgeMode === bridgeModeApi) return true;  // already installed
    targetApp.bridgeMode = bridgeModeApi;
    console.log('[bridge-mode] installed on App namespace (v3.43.1 late-binding)');
    return true;
  };

  // Best-effort early-attach — covers the case where window.App is already a
  // real object at load time (e.g., test harness, future inline-attach pattern).
  // The maat-reader.html installer call remains the authoritative attachment.
  if (window.App && typeof window.App === 'object' && !window.App.bridgeMode) {
    window.App.bridgeMode = bridgeModeApi;
  }
})();
