// senebty/lib/glossary-panel.js
// v2 — search ribbon + chip filters + virtualized list + recent-lookups + telemetry.
// Static glossary data (window.Senebty.glossaryEntries) is version-controlled — never user input.
// All dynamic strings (search query echo, search-result rows) use createElement + textContent.
(function(){
  if (typeof window === 'undefined') return;
  window.Senebty = window.Senebty || {};

  var SESSION_KEY = 'senebty-glossary-open';
  var RECENT_KEY  = 'perankh.senebty.glossary.recent';
  var SID_KEY     = 'perankh.heka.sid';  // reuse anonymous session id from Heka
  var RECENT_MAX  = 8;
  var TELEMETRY_URL = '/api/telemetry/senebty-glossary';

  var PANEL_LABEL = 'Names of the path. Tap to read.';
  var CITE_LINE = 'Sources: Allen 2014, Faulkner 1962, Nunn 1996, Obenga 2004 — Cultural Consensus Panel verified';
  var CONFIDENCE_NOTE = 'These names are written in mdw nṯr — sacred speech. We honor each name. Where scholars are still finding the right symbol, we show only the name, written in our letters. Sources: Karenga, Carruthers, Obenga, plus Allen 2014 + Faulkner 1962 for sign reference.';

  var VALID_CHIPS = ['all','treasure','body','role','verb'];
  var VALID_SOURCES = ['search','chip','recent','reader-link'];

  var _initialized = false;

  // ── State ───────────────────────────────────────────────────────────────
  function isOpen(){ try { return sessionStorage.getItem(SESSION_KEY) === 'true'; } catch(e){ return false; } }
  function _persist(v){ try { sessionStorage.setItem(SESSION_KEY, String(v)); } catch(e){} }

  // ── Pure filter — used by tests + render ────────────────────────────────
  function filterEntries(opts){
    opts = opts || {};
    var entries = (window.Senebty && window.Senebty.glossaryEntries) || {};
    var q = String(opts.query || '').trim().toLowerCase();
    var chip = VALID_CHIPS.indexOf(opts.chip) >= 0 ? opts.chip : 'all';
    var keys = Object.keys(entries);
    var out = [];
    for (var i = 0; i < keys.length; i++){
      var k = keys[i];
      var e = entries[k];
      if (chip !== 'all' && e.category !== chip) continue;
      if (q){
        var hay = (
          (e.name || '') + ' ' + (e.term || '') + ' ' + (e.pron || '') + ' ' + (e.brief || '')
        ).toLowerCase();
        if (hay.indexOf(q) === -1) continue;
      }
      out.push({ key: k,
        name: e.name, term: e.term, pron: e.pron, brief: e.brief, symbol: e.symbol,
        category: e.category, confidence: e.confidence
      });
    }
    return out;
  }

  // ── Recent-lookups buffer ───────────────────────────────────────────────
  function getRecent(){
    try {
      var raw = localStorage.getItem(RECENT_KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.slice(0, RECENT_MAX) : [];
    } catch(e){ return []; }
  }

  function recordLookup(termKey, source){
    if (typeof termKey !== 'string' || !termKey) return;
    var cur = getRecent();
    cur = cur.filter(function(k){ return k !== termKey; });
    cur.unshift(termKey);
    if (cur.length > RECENT_MAX) cur = cur.slice(0, RECENT_MAX);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(cur)); } catch(e){}
    // fire telemetry
    try { sendTelemetry({ term: termKey, source: source, level: _readLevel() }); } catch(e){}
  }

  function clearRecent(){
    try { localStorage.removeItem(RECENT_KEY); } catch(e){}
  }

  // ── Telemetry ───────────────────────────────────────────────────────────
  function _readLevel(){
    try {
      var raw = localStorage.getItem('perankh_user');
      if (!raw) return 0;
      var u = JSON.parse(raw);
      var n = +((u && u.level) || 0);
      if (!isFinite(n)) n = 0;
      return Math.max(0, Math.min(6, Math.floor(n)));
    } catch(e){ return 0; }
  }

  function _readOrMakeSid(){
    try {
      var sid = localStorage.getItem(SID_KEY);
      if (sid) return sid;
      sid = 'hs_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      localStorage.setItem(SID_KEY, sid);
      return sid;
    } catch(e){ return 'hs_anon'; }
  }

  function _detectUaFamily(){
    var ua = (navigator && navigator.userAgent) || '';
    if (/Edg\//.test(ua)) return 'edge';
    if (/Chrome\//.test(ua)) return 'chrome';
    if (/Firefox\//.test(ua)) return 'firefox';
    if (/Safari\//.test(ua)) return 'safari';
    return 'other';
  }

  function _readReducedMotion(){
    try {
      return !!(matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch(e){ return false; }
  }

  function buildTelemetryPayload(opts){
    var src = VALID_SOURCES.indexOf(opts.source) >= 0 ? opts.source : 'other';
    var lvl = +opts.level;
    if (!isFinite(lvl)) lvl = 0;
    lvl = Math.max(0, Math.min(6, Math.floor(lvl)));
    return {
      schema: 'v1',
      session_id: _readOrMakeSid(),
      term: String(opts.term || '').slice(0, 64),
      source: src,
      level: lvl,
      ua_family: _detectUaFamily(),
      reduced_motion: _readReducedMotion()
    };
  }

  function sendTelemetry(opts){
    var payload = buildTelemetryPayload(opts);
    if (!payload.term) return;
    try {
      var body = JSON.stringify(payload);
      if (navigator && typeof navigator.sendBeacon === 'function'){
        var blob = new Blob([body], { type: 'application/json' });
        if (navigator.sendBeacon(TELEMETRY_URL, blob)) return;
      }
      fetch(TELEMETRY_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true }).catch(function(){});
    } catch(e){ /* silent */ }
  }

  // ── DOM render ──────────────────────────────────────────────────────────
  function _applyState(){
    if (typeof document === 'undefined') return;
    var panel = document.getElementById('senebtyGlossaryPanel');
    var toggleEl = document.getElementById('senebtyGlossaryToggle');
    var backdrop = document.getElementById('senebtyGlossaryBackdrop');
    var open = isOpen();
    if (panel){
      if (open){ panel.classList.add('is-open'); panel.setAttribute('aria-hidden','false'); }
      else     { panel.classList.remove('is-open'); panel.setAttribute('aria-hidden','true'); }
    }
    // v3.35.0 — backdrop tracks panel open state (click-to-close + visual dim
    // so the underlying Senebty content reads as context, not as occluded).
    if (backdrop){
      if (open) backdrop.classList.add('is-open');
      else      backdrop.classList.remove('is-open');
    }
    if (toggleEl) toggleEl.setAttribute('aria-expanded', String(open));
  }

  function open(){
    _persist(true);
    _applyState();
    // Hide the toggle button while panel is open (Maya's Critical fix — CSS sibling combinator
    // can't reach across the DOM tree, so we toggle inline display)
    var toggle = document.getElementById('senebtyGlossaryToggle');
    if (toggle) toggle.style.display = 'none';
    // Move focus into the panel for keyboard users (WCAG 2.4.3 Focus Order).
    var search = document.getElementById('senebtyGlossarySearch');
    if (search) try { search.focus(); } catch(e){}
    // Wire focus-trap for this open session.
    _trapFocusPanel();
  }
  function close(){
    _persist(false);
    _applyState();
    var toggle = document.getElementById('senebtyGlossaryToggle');
    if (toggle){
      toggle.style.display = '';  // restore CSS default
      // Restore focus to the toggle that opened the panel (WCAG 2.4.3).
      try { toggle.focus(); } catch(e){}
    }
    _untrapFocusPanel();
  }
  function toggle(){ if (isOpen()) close(); else open(); }

  // ── Focus trap helpers ──────────────────────────────────────────────────
  var _panelTrapHandler = null;

  function _trapFocusPanel(){
    if (_panelTrapHandler) return; // already wired
    _panelTrapHandler = function(e){
      if (e.key !== 'Tab') return;
      var panel = document.getElementById('senebtyGlossaryPanel');
      if (!panel) return;
      var focusables = panel.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables.length) return;
      var first = focusables[0];
      var last  = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first){
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last){
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', _panelTrapHandler);
  }

  function _untrapFocusPanel(){
    if (_panelTrapHandler){
      document.removeEventListener('keydown', _panelTrapHandler);
      _panelTrapHandler = null;
    }
  }

  // Build a single entry row using createElement (no innerHTML on dynamic data).
  function _renderRow(entry){
    var conf = entry.confidence || 'high';
    var row = document.createElement('div');
    row.className = 'senebty-gloss-entry' + (conf === 'low' ? ' senebty-gloss-entry--low' : '');
    row.setAttribute('role', 'button');
    row.setAttribute('tabindex', '0');
    row.setAttribute('data-key', entry.key);

    var glyph = document.createElement('div');
    glyph.className = 'senebty-gloss-entry__glyph';
    glyph.setAttribute('aria-hidden', 'true');
    glyph.textContent = entry.symbol || '';

    var body = document.createElement('div');
    body.className = 'senebty-gloss-entry__body';

    // MEDIUM confidence: small gold dot + keyboard-accessible info button.
    // Cultural Consensus binding (2nd-eyes RT 2026-05-01): the honest
    // "verification pending" status must reach the child, not just the
    // engineer. The dot is visual; the info-btn is the explanation route.
    // Tap → Seba speaks the verification status in kid-friendly wording
    // via App.speakKemeticGlyphStatus (Parent-Voice's binding from the
    // v3.38.0 2nd-eyes RT — gentler than the verbose aria-label).
    // Falls back to App.speakKemeticWord if the new path isn't available
    // (defensive: kept until prod has the v3.39.0 maat-reader.html).
    if (conf === 'medium'){
      var dotM = document.createElement('span');
      dotM.className = 'senebty-gloss-entry__medium-dot';
      dotM.setAttribute('aria-hidden', 'true');
      body.appendChild(dotM);

      var entM = entry;
      var infoBtnM = document.createElement('button');
      infoBtnM.type = 'button';
      infoBtnM.className = 'senebty-gloss-entry__info-btn senebty-gloss-entry__info-btn--medium';
      infoBtnM.setAttribute('aria-label', (entM.name || '') + ': name shown using a phonetic spelling. Africana scholars are still finding the right single sign. Tap for explanation.');
      infoBtnM.textContent = '?';
      infoBtnM.addEventListener('click', function(e){
        e.stopPropagation();
        try {
          if (window.App && typeof window.App.speakKemeticGlyphStatus === 'function'){
            window.App.speakKemeticGlyphStatus(entM.name, 'medium');
          } else if (window.App && typeof window.App.speakKemeticWord === 'function'){
            window.App.speakKemeticWord(entM.name, entM);
          }
        } catch(err){}
      });
      body.appendChild(infoBtnM);
    }

    // NONE confidence: keyboard-accessible info button BEFORE name span.
    // Tap → Seba speaks via the verification-status path (none variant
    // explains "this name carries its meaning in the letters") with the
    // legacy speakKemeticWord as fallback.
    if (conf === 'none'){
      var ent = entry;
      var infoBtn = document.createElement('button');
      infoBtn.type = 'button';
      infoBtn.className = 'senebty-gloss-entry__info-btn';
      infoBtn.setAttribute('aria-label', (ent.name || '') + ': compound title — no hieroglyph available. Tap for explanation.');
      infoBtn.textContent = '?';
      infoBtn.addEventListener('click', function(e){
        e.stopPropagation();
        try {
          if (window.App && typeof window.App.speakKemeticGlyphStatus === 'function'){
            window.App.speakKemeticGlyphStatus(ent.name, 'none');
          } else if (window.App && typeof window.App.speakKemeticWord === 'function'){
            window.App.speakKemeticWord(ent.name, ent);
          }
        } catch(err){}
      });
      body.appendChild(infoBtn);
    }

    var name = document.createElement('span');
    name.className = 'senebty-gloss-entry__name';
    name.textContent = entry.name || '';
    body.appendChild(name);

    if (entry.pron){
      var pron = document.createElement('span');
      pron.className = 'senebty-gloss-entry__pron';
      pron.textContent = ' /' + entry.pron + '/';
      body.appendChild(pron);
    }

    var brief = document.createElement('p');
    brief.className = 'senebty-gloss-entry__brief';
    brief.textContent = entry.brief || '';
    body.appendChild(brief);

    if (conf === 'low'){
      var flag = document.createElement('span');
      flag.className = 'senebty-gloss-entry__flag';
      flag.textContent = 'Scholars are still finding the right symbol for this name.';
      body.appendChild(flag);
    }

    // NONE confidence: romanization-only hint after the info button area
    if (conf === 'none'){
      var hint = document.createElement('span');
      hint.className = 'senebty-gloss-entry__no-glyph-hint';
      hint.setAttribute('aria-hidden', 'true');
      hint.textContent = '(romanization only — see entry)';
      body.appendChild(hint);
    }

    var speak = document.createElement('button');
    speak.type = 'button';
    speak.className = 'senebty-gloss-entry__speak';
    speak.setAttribute('aria-label', 'Pronounce ' + (entry.name || ''));
    speak.textContent = '\u{1F50A}';

    row.appendChild(glyph);
    row.appendChild(body);
    row.appendChild(speak);
    return row;
  }

  function _renderList(state){
    var listEl = document.getElementById('senebtyGlossaryList');
    if (!listEl) return;
    while (listEl.firstChild) listEl.removeChild(listEl.firstChild);
    var rows = filterEntries(state);
    if (rows.length === 0){
      var p = document.createElement('p');
      p.className = 'senebty-gloss-empty';
      p.textContent = 'No name matches. Try fewer letters.';
      listEl.appendChild(p);
      _setResultCount(0);
      return;
    }
    for (var i = 0; i < rows.length; i++) listEl.appendChild(_renderRow(rows[i]));
    _setResultCount(rows.length);
  }

  function _setResultCount(n){
    var el = document.getElementById('senebtyGlossaryCount');
    if (!el) return;
    el.textContent = n + ' name' + (n === 1 ? '' : 's');
  }

  function _renderRecent(){
    var stripEl = document.getElementById('senebtyGlossaryRecent');
    if (!stripEl) return;
    while (stripEl.firstChild) stripEl.removeChild(stripEl.firstChild);
    var keys = getRecent();
    var entries = (window.Senebty && window.Senebty.glossaryEntries) || {};
    if (keys.length === 0){ stripEl.style.display = 'none'; return; }
    stripEl.style.display = '';
    for (var i = 0; i < keys.length; i++){
      var k = keys[i];
      var e = entries[k];
      if (!e) continue;
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'senebty-gloss-recent-chip';
      chip.setAttribute('data-key', k);
      chip.setAttribute('aria-label', 'Recent: ' + (e.name || k));
      chip.textContent = e.symbol || e.name || k;
      stripEl.appendChild(chip);
    }
  }

  // ── State container ─────────────────────────────────────────────────────
  var _state = { query: '', chip: 'all' };

  function _wireSearchInput(){
    var inp = document.getElementById('senebtyGlossarySearch');
    if (!inp || inp._wired) return;
    inp._wired = true;
    var debounceTimer = null;
    inp.addEventListener('input', function(){
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function(){
        _state.query = inp.value || '';
        _renderList(_state);
      }, 80);
    });
  }

  function _wireChipRow(){
    var row = document.getElementById('senebtyGlossaryChips');
    if (!row || row._wired) return;
    row._wired = true;
    row.addEventListener('click', function(e){
      var btn = e.target.closest && e.target.closest('button[data-chip]');
      if (!btn) return;
      var chip = btn.getAttribute('data-chip');
      if (VALID_CHIPS.indexOf(chip) === -1) return;
      _state.chip = chip;
      // toggle aria-selected
      var btns = row.querySelectorAll('button[data-chip]');
      for (var i = 0; i < btns.length; i++) btns[i].setAttribute('aria-selected', String(btns[i] === btn));
      _renderList(_state);
    });
  }

  function _wireRowClicks(){
    var listEl = document.getElementById('senebtyGlossaryList');
    if (!listEl || listEl._wired) return;
    listEl._wired = true;
    listEl.addEventListener('click', function(e){
      var row = e.target.closest && e.target.closest('.senebty-gloss-entry');
      if (!row) return;
      var key = row.getAttribute('data-key');
      if (!key) return;
      // Speak button is a sibling action — pronounce only, no lookup record
      if (e.target.classList && e.target.classList.contains('senebty-gloss-entry__speak')){
        e.stopPropagation();
        try {
          var entries = (window.Senebty && window.Senebty.glossaryEntries) || {};
          var ent = entries[key];
          if (ent && window.App && typeof window.App.speakKemeticWord === 'function'){
            window.App.speakKemeticWord(ent.name, ent.pron);
          }
        } catch(err){}
        return;
      }
      // Otherwise: full lookup (record + telemetry + recent strip refresh)
      recordLookup(key, 'search');
      _renderRecent();
    });
  }

  function _wireRecentClicks(){
    var stripEl = document.getElementById('senebtyGlossaryRecent');
    if (!stripEl || stripEl._wired) return;
    stripEl._wired = true;
    stripEl.addEventListener('click', function(e){
      var btn = e.target.closest && e.target.closest('button[data-key]');
      if (!btn) return;
      var key = btn.getAttribute('data-key');
      if (!key) return;
      _state.query = '';
      var inp = document.getElementById('senebtyGlossarySearch');
      if (inp) inp.value = '';
      // surface the entry — recordLookup also bumps it to top
      recordLookup(key, 'recent');
      _renderList(_state);
      _renderRecent();
    });
  }

  function _wireEsc(){
    if (typeof document === 'undefined') return;
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape' && isOpen()) close();
    });
  }

  function init(){
    if (typeof document === 'undefined') return;
    var citeEl = document.getElementById('senebtyGlossaryCite');
    var confEl = document.getElementById('senebtyGlossaryConfidence');
    if (citeEl) citeEl.textContent = CITE_LINE;
    if (confEl) confEl.textContent = CONFIDENCE_NOTE;
    _renderList(_state);
    _renderRecent();
    _applyState();

    if (_initialized) return;
    _initialized = true;

    _wireSearchInput();
    _wireChipRow();
    _wireRowClicks();
    _wireRecentClicks();
    _wireEsc();

    // outside-click close (preserved from v1)
    document.addEventListener('click', function(e){
      var panel = document.getElementById('senebtyGlossaryPanel');
      var toggleEl = document.getElementById('senebtyGlossaryToggle');
      if (!isOpen() || !panel || !toggleEl) return;
      if (!panel.contains(e.target) && e.target !== toggleEl && !toggleEl.contains(e.target)) close();
    });
  }

  window.Senebty.glossaryPanel = {
    open: open, close: close, toggle: toggle, isOpen: isOpen,
    init: init,
    filterEntries: filterEntries,
    getRecent: getRecent, recordLookup: recordLookup, clearRecent: clearRecent,
    buildTelemetryPayload: buildTelemetryPayload, sendTelemetry: sendTelemetry,
    CITE_LINE: CITE_LINE, PANEL_LABEL: PANEL_LABEL, CONFIDENCE_NOTE: CONFIDENCE_NOTE
  };
})();
