// senebty/lib/parent-dashboard.js
// Parent dashboard senebty card orchestration.
// Per docs/superpowers/specs/2026-05-04-senebty-v1-finish-design.md Section 3c
// Tone canon: skills/docs/project/seba-voice-senebty.md — factual parent copy,
//   never praise; "[Child] iri once today" not "[Child] did great!".
//
// Imani binding: child-side dashboard hides "unreachable Sesh" language;
// parent-side surfaces it factually ("Foundation 5 Wedeha is being prepared").
//
// Tehuti binding: tier-progress bar uses role="progressbar" + aria-valuenow/min/max +
// aria-valuetext.
//
// Task 1 ships the scaffold only. Tasks 2-6 fill in:
//   2 — four-treasures canvas-2D graph
//   3 — streak-pause control wiring
//   4 — heka phrase view+delete wiring
//   5 — pending parent confirms list (fetch GET /api/senebty/teaching-iri/pending)
//   6 — auto-advance log inline chronological
//
// SECURITY: All values rendered are internally controlled (tier display names from
// tiers.js, integer counts from senebty state). No user-supplied strings reach the
// template — child name etc. are not rendered here.
(function(){
  if (typeof window === 'undefined') return;
  window.Senebty = window.Senebty || {};

  function findTier(user){
    const tiers = (window.Senebty.tiers || []);
    const tierIdx = (user && user.senebty && typeof user.senebty.tier === 'number') ? user.senebty.tier : 0;
    return tiers[tierIdx] || tiers[0] || null;
  }

  function tierProgressCopy(user, tier){
    if (!tier) return '';
    const sb = (user && user.senebty) || {};
    switch (tier.key) {
      case 'hem-sba':
        return 'Iri the Threshold to enter.';
      case 'seba-en-seneb': {
        const completed = Object.keys(sb.iriCompletedByLesson || {})
          .filter(k => k.startsWith('foundation-')).length;
        return completed + ' of 8 Foundations walked. Foundation 5 Wedeha is being prepared.';
      }
      case 'sesh-en-per-ankh':
        return (sb.streakDays || 0) + ' of 21 mornings.';
      case 'wabau':
        return '1 teaching iri to advance.';
      case 'sunu-sba':
        return 'Wabau and Sunu Sba together open Shemes Imhotep.';
      case 'shemes-imhotep':
        return 'The path opens. Walk freely.';
      default:
        return '';
    }
  }

  function iriTallyThisWeek(user){
    const log = (user && user.senebty && user.senebty.iriLog) || [];
    const oneWeekMs = 7 * 86400 * 1000;
    const cutoff = Date.now() - oneWeekMs;
    return log.filter(function(entry){ return entry && entry.timestamp && entry.timestamp >= cutoff; }).length;
  }

  function escAttr(s){
    return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function escText(s){
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // Imani 3-state binding: weak=1, holding=2, strong=3.
  function ratingToValue(r){
    if (r === 'weak') return 1;
    if (r === 'holding') return 2;
    if (r === 'strong') return 3;
    return null;
  }

  function trendDescriptor(values){
    const valid = values.filter(function(v){ return typeof v === 'number'; });
    if (valid.length === 0) return 'no data';
    if (valid.length === 1) {
      const v = valid[0];
      return v === 3 ? 'strong' : v === 2 ? 'holding' : 'weak';
    }
    const first = valid[0];
    const last = valid[valid.length - 1];
    if (last > first) return 'rising';
    if (last < first) return 'falling';
    if (last === 3) return 'stable strong';
    if (last === 2) return 'holding';
    return 'stable';
  }

  function clearChildren(node){
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function buildTrendSummary(rows){
    const treasures = ['khat','ib','ka','ba'];
    const labels = { khat: 'Khat', ib: 'Ib', ka: 'Ka', ba: 'Ba' };
    const parts = treasures.map(function(t){
      const vals = rows.map(function(r){ return ratingToValue(r[t]); });
      return labels[t] + ': ' + trendDescriptor(vals);
    });
    return parts.join('. ') + ' over the last ' + rows.length + ' days.';
  }

  function highContrastActive(){
    try {
      return !!(window.matchMedia && window.matchMedia('(prefers-contrast: more)').matches);
    } catch (e) { return false; }
  }
  function reducedMotionActive(){
    try {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { return false; }
  }

  function paletteFor(highContrast){
    // Per senebty-art-direction.md §4. High-contrast variant uses saturated tokens.
    if (highContrast) {
      return {
        khat: '#2E7D32',
        ib:   '#0d1660',
        ka:   '#FFD166',
        ba:   '#B8412B',
        stroke: 3,
      };
    }
    return {
      khat: '#2E7D32',
      ib:   '#1a237e',
      ka:   '#C4A347',
      ba:   '#B8412B',
      stroke: 2,
    };
  }

  function drawGraph(canvas, rows){
    const ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    const padL = 28, padR = 12, padT = 12, padB = 24;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const palette = paletteFor(highContrastActive());

    // Background
    ctx.fillStyle = '#F2E4CC';
    ctx.fillRect(0, 0, W, H);

    // Y grid + labels (W=1, H=2, S=3)
    ctx.strokeStyle = 'rgba(196,163,71,0.25)';
    ctx.lineWidth = 1;
    ctx.font = '10px sans-serif';
    ctx.fillStyle = '#5a4a2a';
    const ys = [
      { v: 1, label: 'W' },
      { v: 2, label: 'H' },
      { v: 3, label: 'S' },
    ];
    ys.forEach(function(row){
      const y = padT + plotH - ((row.v - 1) / 2) * plotH;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(W - padR, y);
      ctx.stroke();
      ctx.fillText(row.label, 6, y + 3);
    });

    // X axis baseline
    ctx.strokeStyle = 'rgba(17,13,8,0.35)';
    ctx.beginPath();
    ctx.moveTo(padL, padT + plotH);
    ctx.lineTo(W - padR, padT + plotH);
    ctx.stroke();

    const n = rows.length;
    function xFor(i){
      if (n <= 1) return padL + plotW / 2;
      return padL + (i / (n - 1)) * plotW;
    }
    function yFor(v){
      return padT + plotH - ((v - 1) / 2) * plotH;
    }

    const treasures = [
      { key: 'khat', color: palette.khat },
      { key: 'ib',   color: palette.ib },
      { key: 'ka',   color: palette.ka },
      { key: 'ba',   color: palette.ba },
    ];

    ctx.lineWidth = palette.stroke;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    treasures.forEach(function(t){
      ctx.strokeStyle = t.color;
      ctx.fillStyle = t.color;
      ctx.beginPath();
      let started = false;
      rows.forEach(function(r, i){
        const v = ratingToValue(r[t.key]);
        if (v == null) return;
        const x = xFor(i);
        const y = yFor(v);
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      // Plot points
      rows.forEach(function(r, i){
        const v = ratingToValue(r[t.key]);
        if (v == null) return;
        const x = xFor(i);
        const y = yFor(v);
        ctx.beginPath();
        ctx.arc(x, y, palette.stroke + 0.5, 0, Math.PI * 2);
        ctx.fill();
      });
    });
  }

  function buildTable(doc, rows){
    const table = doc.createElement('table');
    table.className = 'senebty-four-treasures-graph__table';
    const thead = doc.createElement('thead');
    const trh = doc.createElement('tr');
    ['Date','Khat','Ib','Ka','Ba'].forEach(function(label){
      const th = doc.createElement('th');
      th.textContent = label;
      trh.appendChild(th);
    });
    thead.appendChild(trh);
    table.appendChild(thead);
    const tbody = doc.createElement('tbody');
    rows.forEach(function(r){
      const tr = doc.createElement('tr');
      const td0 = doc.createElement('td');
      td0.textContent = r.date || '';
      tr.appendChild(td0);
      ['khat','ib','ka','ba'].forEach(function(k){
        const td = doc.createElement('td');
        const v = ratingToValue(r[k]);
        td.textContent = v == null ? '—' : String(v);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    return table;
  }

  function renderFourTreasuresGraph(host, log){
    if (!host) return;
    const doc = host.ownerDocument || (typeof document !== 'undefined' ? document : null);
    if (!doc) return;
    clearChildren(host);

    if (!log || log.length === 0) {
      const p = doc.createElement('p');
      p.className = 'senebty-four-treasures-graph__empty';
      p.textContent = 'Sweet things take time. Keep walking the path.';
      host.appendChild(p);
      return;
    }

    // Last 30 entries (or fewer)
    const rows = log.length > 30 ? log.slice(log.length - 30) : log.slice();

    const wrap = doc.createElement('div');
    wrap.className = 'senebty-four-treasures-graph';

    const canvas = doc.createElement('canvas');
    canvas.className = 'senebty-four-treasures-graph__canvas';
    canvas.width = 520;
    canvas.height = 220;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', buildTrendSummary(rows));
    if (reducedMotionActive()) {
      canvas.setAttribute('data-reduced-motion', '1');
    }

    const toggleBtn = doc.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'senebty-four-treasures-graph__toggle btn-secondary';
    toggleBtn.textContent = 'View as numbers';

    let mode = 'graph';
    let table = null;
    toggleBtn.addEventListener('click', function(){
      if (mode === 'graph') {
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        table = buildTable(doc, rows);
        wrap.insertBefore(table, toggleBtn);
        toggleBtn.textContent = 'View as graph';
        mode = 'table';
      } else {
        if (table && table.parentNode) table.parentNode.removeChild(table);
        wrap.insertBefore(canvas, toggleBtn);
        toggleBtn.textContent = 'View as numbers';
        mode = 'graph';
      }
    });

    wrap.appendChild(canvas);
    wrap.appendChild(toggleBtn);
    host.appendChild(wrap);

    // Draw after attached so the canvas context is live.
    try { drawGraph(canvas, rows); } catch (e) { /* canvas unsupported in test env */ }
  }

  // ---------------------------------------------------------------------------
  // Task 3 — Streak-pause section
  // ---------------------------------------------------------------------------
  // Wires the M1 streak-pause module's openModal() + renderHistoryPanel(host)
  // into the parent dashboard. Reads user.senebty.streakPause shape from M1
  // user-migration: {active, startedAt, endsAt, daysUsedThisMonth, monthCounterResetAt}.
  function renderStreakPauseSection(host, user){
    if (!host) return;
    const doc = host.ownerDocument || (typeof document !== 'undefined' ? document : null);
    if (!doc) return;
    clearChildren(host);
    const sb = (user && user.senebty) || {};
    const sp = sb.streakPause || { active:false, daysUsedThisMonth:0 };
    const wrap = doc.createElement('div');
    wrap.className = 'senebty-parent-card__streak-pause';

    const status = doc.createElement('p');
    status.className = 'senebty-parent-card__streak-pause-status';
    if (sp.active && sp.startedAt && sp.endsAt) {
      status.textContent = 'Paused ' + sp.startedAt + ' – ' + sp.endsAt
        + ' (' + (sp.daysUsedThisMonth || 0) + ' of 3 days used this month).';
    } else {
      const days = (typeof sb.streakDays === 'number') ? sb.streakDays : 0;
      status.textContent = 'Streak: ' + days + ' days.';
    }
    wrap.appendChild(status);

    const btn = doc.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-secondary senebty-parent-card__streak-pause-btn';
    btn.textContent = 'Pause streak';
    btn.addEventListener('click', function(){
      if (window.Senebty && window.Senebty.streakPause && typeof window.Senebty.streakPause.openModal === 'function') {
        window.Senebty.streakPause.openModal();
      }
    });
    wrap.appendChild(btn);
    host.appendChild(wrap);

    // History audit panel below (QA-DA binding)
    if (window.Senebty && window.Senebty.streakPause && typeof window.Senebty.streakPause.renderHistoryPanel === 'function') {
      try { window.Senebty.streakPause.renderHistoryPanel(host); }
      catch (e) { console.warn('[parent-dashboard] streakPause.renderHistoryPanel failed (M1 module may need App.user)', e); }
    }
  }

  // ---------------------------------------------------------------------------
  // Task 4 — Heka phrase view + delete section
  // ---------------------------------------------------------------------------
  function formatDateFromMs(ms){
    try {
      const d = new Date(ms);
      return d.toISOString().slice(0, 10);
    } catch (e) { return String(ms); }
  }

  function renderHekaSection(host, user){
    if (!host) return;
    const doc = host.ownerDocument || (typeof document !== 'undefined' ? document : null);
    if (!doc) return;
    clearChildren(host);
    const sb = (user && user.senebty) || {};
    const phrase = sb.hekaPhrasePersonal;
    const setAt = sb.hekaPhraseSetAt;

    const wrap = doc.createElement('div');
    wrap.className = 'senebty-parent-card__heka';

    if (!phrase) {
      const p = doc.createElement('p');
      p.className = 'senebty-parent-card__heka-empty';
      p.textContent = 'Heka phrase: not yet composed. Foundation 8 unlocks the composition.';
      wrap.appendChild(p);
      host.appendChild(wrap);
      return;
    }

    // Phrase quoted block
    const quote = doc.createElement('blockquote');
    quote.className = 'senebty-parent-card__heka-phrase';
    quote.textContent = '“' + phrase + '”';
    wrap.appendChild(quote);

    // Italic note: "Set by [child name] on [parent-TZ date]"
    const note = doc.createElement('p');
    note.className = 'senebty-parent-card__heka-note';
    const childName = (user && user.name) || 'your child';
    const dateStr = setAt ? formatDateFromMs(setAt) : '';
    const em = doc.createElement('em');
    em.textContent = 'Set by ' + childName + (dateStr ? ' on ' + dateStr : '') + '.';
    note.appendChild(em);
    wrap.appendChild(note);

    const btn = doc.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-secondary senebty-parent-card__heka-delete-btn';
    btn.textContent = 'Delete phrase';
    btn.addEventListener('click', function(){
      if (window.Senebty && window.Senebty.hekaPhrase && typeof window.Senebty.hekaPhrase.openParentDeleteModal === 'function') {
        window.Senebty.hekaPhrase.openParentDeleteModal();
      }
    });
    wrap.appendChild(btn);
    host.appendChild(wrap);
  }

  // ---------------------------------------------------------------------------
  // Tasks 5+6 shared: fetch teaching-iri rows once per render-pass
  // ---------------------------------------------------------------------------
  function _fetchTeachingIriRows(opts){
    const f = (opts && opts.fetch) || (typeof fetch === 'function' ? fetch : null);
    if (!f) return Promise.resolve([]);
    return Promise.resolve()
      .then(function(){ return f('/api/senebty/teaching-iri/pending', { credentials: 'same-origin' }); })
      .then(function(res){
        if (!res || !res.ok) return { pending: [] };
        return res.json();
      })
      .then(function(json){ return (json && json.pending) || []; })
      .catch(function(){ return []; });
  }

  function lessonIdToFoundationN(lessonId){
    const m = String(lessonId || '').match(/foundation-(\d+)/i);
    return m ? m[1] : '?';
  }

  // ---------------------------------------------------------------------------
  // Task 5 — Pending parent confirmations list
  // ---------------------------------------------------------------------------
  function renderPendingConfirmsSection(host, user, opts){
    if (!host) return Promise.resolve();
    const doc = host.ownerDocument || (typeof document !== 'undefined' ? document : null);
    if (!doc) return Promise.resolve();
    clearChildren(host);

    return _fetchTeachingIriRows(opts).then(function(allRows){
      const rows = allRows.filter(function(r){ return r && r.status === 'pending'; });
      const childName = (user && user.name) || 'Your child';
      const wrap = doc.createElement('div');
      wrap.className = 'senebty-parent-card__pending';

      if (rows.length === 0) {
        const p = doc.createElement('p');
        p.className = 'senebty-parent-card__pending-empty';
        p.textContent = 'Nothing awaiting your eye. The path moves freely.';
        wrap.appendChild(p);
        host.appendChild(wrap);
        return;
      }

      rows.forEach(function(row){
        const item = doc.createElement('div');
        item.className = 'senebty-parent-card__pending-row';
        item.setAttribute('data-pending-id', String(row.id));

        const fnum = lessonIdToFoundationN(row.lesson_id);
        const header = doc.createElement('p');
        header.className = 'senebty-parent-card__pending-header';
        header.textContent = childName + ' reports iri on Foundation ' + fnum + '. Awaiting your confirmation.';
        item.appendChild(header);

        const detail = doc.createElement('p');
        detail.className = 'senebty-parent-card__pending-detail';
        detail.textContent = 'Type a sentence describing what was done — at least 8 words.';
        item.appendChild(detail);

        const ta = doc.createElement('textarea');
        ta.className = 'senebty-parent-card__pending-textarea';
        ta.setAttribute('rows', '3');
        item.appendChild(ta);

        const btn = doc.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-secondary senebty-parent-card__pending-confirm';
        btn.textContent = 'Confirm iri';
        btn.disabled = true;
        item.appendChild(btn);

        function countWords(s){
          return String(s || '').trim().split(/\s+/).filter(Boolean).length;
        }
        ta.addEventListener('input', function(){
          btn.disabled = countWords(ta.value) < 8;
        });

        btn.addEventListener('click', function(){
          if (countWords(ta.value) < 8) return;
          btn.disabled = true;
          const f = (opts && opts.fetch) || (typeof fetch === 'function' ? fetch : null);
          if (!f) return;
          const url = '/api/senebty/teaching-iri/confirm?token=' + encodeURIComponent(row.confirm_token || '');
          Promise.resolve()
            .then(function(){
              return f(url, {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ evidence: ta.value.trim() }),
              });
            })
            .then(function(res){
              if (res && res.ok) {
                if (item.parentNode) item.parentNode.removeChild(item);
                // If no more rows, surface empty state.
                if (!wrap.querySelector('.senebty-parent-card__pending-row')) {
                  const p = doc.createElement('p');
                  p.className = 'senebty-parent-card__pending-empty';
                  p.textContent = 'Nothing awaiting your eye. The path moves freely.';
                  wrap.appendChild(p);
                }
              } else {
                btn.disabled = false;
              }
            })
            .catch(function(){ btn.disabled = false; });
        });

        wrap.appendChild(item);
      });

      host.appendChild(wrap);
    });
  }

  // ---------------------------------------------------------------------------
  // Task 12 — F5 Wedeha upload panel
  // ---------------------------------------------------------------------------
  // Fetches /api/senebty/wedeha/pending and renders:
  //   a) If no pending photo AND panel is in "choose" state → file picker + upload flow.
  //   b) If pending photo exists → thumbnail + Confirm + Retake buttons.
  //   c) If pending:false and no client-side trigger → renders nothing.
  function _renderWedehaUploadPanel(host, opts) {
    if (!host) return Promise.resolve();
    var doc = host.ownerDocument || (typeof document !== 'undefined' ? document : null);
    if (!doc) return Promise.resolve();
    clearChildren(host);

    var f = (opts && opts.fetch) || (typeof fetch === 'function' ? fetch : null);
    if (!f) return Promise.resolve(); // test env without opts.fetch

    function showError(wrap, msg) {
      var existing = wrap.querySelector('.senebty-wedeha-upload-panel__error');
      if (existing) { existing.textContent = msg; return; }
      var err = doc.createElement('p');
      err.className = 'senebty-wedeha-upload-panel__error';
      err.textContent = msg;
      wrap.appendChild(err);
    }

    function renderChooseState(wrap) {
      clearChildren(wrap);

      var title = doc.createElement('h3');
      title.className = 'senebty-wedeha-upload-panel__title';
      title.textContent = 'Foundation 5 — Wedeha Photo';
      wrap.appendChild(title);

      var copy = doc.createElement('p');
      copy.className = 'senebty-wedeha-upload-panel__copy';
      copy.textContent = 'Upload a photo of the prepared plate. The photo is encrypted and viewable only by you.';
      wrap.appendChild(copy);

      var fileInput = doc.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      fileInput.style.display = 'none';

      var chooseBtn = doc.createElement('button');
      chooseBtn.type = 'button';
      chooseBtn.className = 'senebty-wedeha-upload-panel__choose';
      chooseBtn.textContent = 'Choose photo';
      wrap.appendChild(chooseBtn);
      wrap.appendChild(fileInput);

      var progress = doc.createElement('div');
      progress.className = 'senebty-wedeha-upload-panel__progress';
      progress.style.display = 'none';
      var bar = doc.createElement('div');
      bar.className = 'senebty-wedeha-upload-panel__progress-bar';
      progress.appendChild(bar);
      wrap.appendChild(progress);

      chooseBtn.addEventListener('click', function () { fileInput.click(); });

      fileInput.addEventListener('change', function () {
        var file = fileInput.files && fileInput.files[0];
        if (!file) return;
        chooseBtn.disabled = true;
        progress.style.display = '';
        bar.style.width = '0%';

        var xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/senebty/photo');
        xhr.withCredentials = true;

        xhr.upload.addEventListener('progress', function (ev) {
          if (ev.lengthComputable) {
            bar.style.width = Math.round((ev.loaded / ev.total) * 100) + '%';
          }
        });

        xhr.addEventListener('load', function () {
          if (xhr.status === 200 || xhr.status === 201) {
            // Re-fetch pending and re-render to show thumbnail state
            _renderWedehaUploadPanel(host, opts).catch(function (e) {
              console.error('[wedeha-upload] re-render after upload failed', e);
            });
          } else {
            console.error('[wedeha-upload] XHR upload failed', xhr.status, xhr.responseText);
            chooseBtn.disabled = false;
            progress.style.display = 'none';
            showError(wrap, 'Upload failed (' + xhr.status + '). Please try again.');
          }
        });

        xhr.addEventListener('error', function () {
          console.error('[wedeha-upload] XHR network error');
          chooseBtn.disabled = false;
          progress.style.display = 'none';
          showError(wrap, 'Network error during upload. Please try again.');
        });

        var formData = new FormData();
        formData.append('file', file);
        formData.append('foundationId', 'foundation-5-wedeha');
        xhr.send(formData);
      });
    }

    function renderPendingState(wrap, photoId, signedUrl) {
      clearChildren(wrap);

      var title = doc.createElement('h3');
      title.className = 'senebty-wedeha-upload-panel__title';
      title.textContent = 'Foundation 5 — Wedeha Photo';
      wrap.appendChild(title);

      if (signedUrl) {
        var thumb = doc.createElement('img');
        thumb.className = 'senebty-wedeha-upload-panel__thumbnail';
        thumb.src = signedUrl;
        thumb.alt = 'Uploaded plate photo';
        wrap.appendChild(thumb);
      }

      var actions = doc.createElement('div');
      actions.className = 'senebty-wedeha-upload-panel__actions';

      var confirmBtn = doc.createElement('button');
      confirmBtn.type = 'button';
      confirmBtn.className = 'senebty-wedeha-upload-panel__confirm';
      confirmBtn.textContent = 'Confirm iri';

      var retakeBtn = doc.createElement('button');
      retakeBtn.type = 'button';
      retakeBtn.className = 'senebty-wedeha-upload-panel__retake';
      retakeBtn.textContent = 'Retake photo';

      actions.appendChild(confirmBtn);
      actions.appendChild(retakeBtn);
      wrap.appendChild(actions);

      confirmBtn.addEventListener('click', function () {
        confirmBtn.disabled = true;
        Promise.resolve()
          .then(function () {
            return f('/api/senebty/photo/' + encodeURIComponent(photoId) + '/confirm-iri', {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({}),
            });
          })
          .then(function (res) {
            if (res && res.ok) {
              // Confirmed — clear the panel
              clearChildren(host);
              var done = doc.createElement('p');
              done.className = 'senebty-wedeha-upload-panel__copy';
              done.textContent = 'Photo confirmed and deleted. Iri recorded.';
              host.appendChild(done);
            } else {
              console.error('[wedeha-confirm] confirm-iri failed', res && res.status);
              confirmBtn.disabled = false;
              showError(wrap, 'Confirmation failed. Please try again.');
            }
          })
          .catch(function (e) {
            console.error('[wedeha-confirm] fetch error', e);
            confirmBtn.disabled = false;
            showError(wrap, 'Network error. Please try again.');
          });
      });

      retakeBtn.addEventListener('click', function () {
        // Let user pick a new file — re-render as choose state
        renderChooseState(wrap);
      });
    }

    return Promise.resolve()
      .then(function () {
        return f('/api/senebty/wedeha/pending', { credentials: 'same-origin' });
      })
      .then(function (res) {
        if (!res || !res.ok) {
          console.error('[wedeha-upload] pending fetch failed', res && res.status);
          return { pending: false, photoId: null, signedUrl: null };
        }
        return res.json();
      })
      .then(function (json) {
        var wrap = doc.createElement('div');
        wrap.className = 'senebty-wedeha-upload-panel';

        if (json && json.pending && json.photoId) {
          renderPendingState(wrap, json.photoId, json.signedUrl);
          host.appendChild(wrap);
        } else {
          // Show choose-state panel for parents to upload
          renderChooseState(wrap);
          host.appendChild(wrap);
        }
      })
      .catch(function (e) {
        console.error('[wedeha-upload] panel render error', e);
      });
  }

  // ---------------------------------------------------------------------------
  // Task 6 — Auto-advance log surface
  // ---------------------------------------------------------------------------
  function renderAutoAdvanceLogSection(host, user, opts){
    if (!host) return Promise.resolve();
    const doc = host.ownerDocument || (typeof document !== 'undefined' ? document : null);
    if (!doc) return Promise.resolve();
    clearChildren(host);

    return _fetchTeachingIriRows(opts).then(function(allRows){
      const rows = allRows.filter(function(r){ return r && r.status === 'auto_advanced'; });
      if (rows.length === 0) return; // No placeholder — auto-advances are exception events.

      const wrap = doc.createElement('div');
      wrap.className = 'senebty-parent-card__auto-advance-log';
      // Sort chronologically by submitted_at ascending
      rows.sort(function(a, b){ return (a.submitted_at || 0) - (b.submitted_at || 0); });
      rows.forEach(function(row){
        const line = doc.createElement('p');
        line.className = 'senebty-parent-card__auto-advance-entry';
        const em = doc.createElement('em');
        const fnum = lessonIdToFoundationN(row.lesson_id);
        const when = row.submitted_at ? formatDateFromMs(row.submitted_at) : '';
        em.textContent =
          'Auto-confirmed after 14 days; parent did not respond. The path moved on.'
          + ' — Foundation ' + fnum + (when ? ' on ' + when : '');
        line.appendChild(em);
        wrap.appendChild(line);
      });
      host.appendChild(wrap);
    });
  }

  // tierProgressValue: returns 0–100 integer for aria-valuenow based on tier key.
  // Tehuti binding: progressbar must expose aria-valuenow (ARIA 1.2 §5.3.18).
  function tierProgressValue(tier){
    if (!tier) return 0;
    const map = {
      'hem-sba':        0,
      'seba-en-seneb':  20,
      'sesh-en-per-ankh': 40,
      'wabau':          60,
      'sunu-sba':       80,
      'shemes-imhotep': 100,
    };
    return (map[tier.key] != null) ? map[tier.key] : 0;
  }

  // v3.51.66 — Daily-ritual opt-out toggle (default ON). Mirrors the bridge-mode
  // toggle pattern: explicit label-for, native checkbox (keyboard-operable),
  // persists via App.saveUser. The gate in maat-reader.html reads the same key
  // (user.preferences.senebtyDailyRitual === false → suppressed).
  function renderDailyRitualToggle(host, user){
    if (!host || !user) return;
    const doc = host.ownerDocument || (typeof document !== 'undefined' ? document : null);
    if (!doc) return;
    user.preferences = user.preferences || {};

    const section = doc.createElement('div');
    section.className = 'senebty-parent-card__daily-ritual-toggle';

    // Non-"senebty-" id prefix on purpose: the class-coverage scanner treats any
    // senebty-* string literal as a CSS class needing a rule; this is just a DOM id.
    const checkboxId = 'dfr-toggle-' + Math.random().toString(36).slice(2, 9);

    const label = doc.createElement('label');
    label.className = 'senebty-daily-ritual-toggle-label';
    label.setAttribute('for', checkboxId);

    const cb = doc.createElement('input');
    cb.type = 'checkbox';
    cb.id = checkboxId;
    cb.className = 'senebty-daily-ritual-toggle-input';
    // Default ON: checked unless the preference is explicitly false.
    cb.checked = (user.preferences.senebtyDailyRitual !== false);
    cb.addEventListener('change', function(){
      user.preferences.senebtyDailyRitual = !!cb.checked;
      try { if (window.App && typeof window.App.saveUser === 'function') window.App.saveUser(); }
      catch (e) { console.error('[parent-dashboard] daily-ritual toggle save failed', e); }
    });
    label.appendChild(cb);

    const titleSpan = doc.createElement('span');
    titleSpan.className = 'senebty-daily-ritual-toggle-title';
    titleSpan.textContent = 'Daily Ritual for ' + (user.name || 'this learner');
    label.appendChild(titleSpan);
    section.appendChild(label);

    const desc = doc.createElement('p');
    desc.className = 'senebty-daily-ritual-toggle-desc';
    desc.textContent = 'When on, entering the Senebty wing opens a short daily foundation ritual — a greeting, a gesture, and a blessing — before the foundations. Turn off to go straight to the foundations. Default: on.';
    section.appendChild(desc);

    host.appendChild(section);
  }

  function renderSenebtyCard(host, user){
    if (!host || !user) return;
    const doc = host.ownerDocument || (typeof document !== 'undefined' ? document : null);
    if (!doc) return;
    const tier = findTier(user);
    const tierName = tier ? tier.displayName : 'Hem-Sba';
    const tierCopy = tierProgressCopy(user, tier);
    const tally = iriTallyThisWeek(user);

    // Rule 4 — pure DOM construction; no innerHTML template injection.
    host.replaceChildren();
    // Cinematic parity: card fades in on mount (matching daily-ritual showStep double-rAF).
    // Guard: requestAnimationFrame is unavailable in Node/jsdom test env — instant reveal.
    host.style.opacity = '0';
    var _reducedMotion = reducedMotionActive();
    if (_reducedMotion || typeof requestAnimationFrame !== 'function') {
      host.style.opacity = '1';
    } else {
      requestAnimationFrame(function(){
        requestAnimationFrame(function(){ host.style.opacity = '1'; });
      });
    }

    // <h3 class="senebty-parent-card__title">Senebty — Path of Health</h3>
    const title = doc.createElement('h3');
    title.className = 'senebty-parent-card__title';
    title.textContent = 'Senebty — Path of Health';
    host.appendChild(title);

    // v3.51.66 — Daily-ritual opt-out toggle. The daily ritual is default-ON for
    // logged-in users (gate flipped in maat-reader.html); this is the discoverable
    // parent control to turn it off (writes user.preferences.senebtyDailyRitual).
    try { renderDailyRitualToggle(host, user); }
    catch (e) { console.error('[parent-dashboard] daily-ritual toggle render failed', e); }

    // Tier block
    const tierDiv = doc.createElement('div');
    tierDiv.className = 'senebty-parent-card__tier';

    const tierNameDiv = doc.createElement('div');
    tierNameDiv.className = 'senebty-parent-card__tier-name';
    tierNameDiv.textContent = tierName;
    tierDiv.appendChild(tierNameDiv);

    const tierProgressDiv = doc.createElement('div');
    tierProgressDiv.className = 'senebty-parent-card__tier-progress';
    tierProgressDiv.setAttribute('role', 'progressbar');
    tierProgressDiv.setAttribute('aria-valuemin', '0');
    tierProgressDiv.setAttribute('aria-valuemax', '100');
    tierProgressDiv.setAttribute('aria-valuenow', String(tierProgressValue(tier)));
    tierProgressDiv.setAttribute('aria-valuetext', tierCopy);

    const tierTextSpan = doc.createElement('span');
    tierTextSpan.className = 'senebty-parent-card__tier-text';
    tierTextSpan.textContent = tierCopy;
    tierProgressDiv.appendChild(tierTextSpan);
    tierDiv.appendChild(tierProgressDiv);
    host.appendChild(tierDiv);

    // Iri tally
    const tallyDiv = doc.createElement('div');
    tallyDiv.className = 'senebty-parent-card__tally';
    tallyDiv.textContent = 'Iri completed this week: ' + tally;
    host.appendChild(tallyDiv);

    // Graph host
    const graphHost = doc.createElement('div');
    graphHost.className = 'senebty-parent-card__graph-host';
    graphHost.id = 'senebtyParentGraphHost';
    graphHost.setAttribute('aria-label', 'Four Treasures self-rating over the last thirty days');
    host.appendChild(graphHost);

    // Streak-pause host
    const streakPauseHost = doc.createElement('div');
    streakPauseHost.className = 'senebty-parent-card__streak-pause-host';
    streakPauseHost.id = 'senebtyParentStreakPauseHost';
    host.appendChild(streakPauseHost);

    // Heka host
    const hekaHost = doc.createElement('div');
    hekaHost.className = 'senebty-parent-card__heka-host';
    hekaHost.id = 'senebtyParentHekaHost';
    host.appendChild(hekaHost);

    // Pending confirms host — aria-live so screen readers announce new confirmations.
    const pendingHost = doc.createElement('div');
    pendingHost.className = 'senebty-parent-card__pending-host';
    pendingHost.id = 'senebtyParentPendingHost';
    pendingHost.setAttribute('aria-live', 'polite');
    pendingHost.setAttribute('aria-atomic', 'false');
    host.appendChild(pendingHost);

    // Wedeha upload panel host — aria-live so upload/error states are announced.
    const wedehaUploadHost = doc.createElement('div');
    wedehaUploadHost.className = 'senebty-wedeha-upload-panel-host';
    wedehaUploadHost.id = 'senebtyParentWedehaUploadHost';
    wedehaUploadHost.setAttribute('aria-live', 'polite');
    wedehaUploadHost.setAttribute('aria-atomic', 'false');
    host.appendChild(wedehaUploadHost);

    // Auto-advance log host
    const autoAdvanceHost = doc.createElement('div');
    autoAdvanceHost.className = 'senebty-parent-card__auto-advance-host';
    autoAdvanceHost.id = 'senebtyParentAutoAdvanceHost';
    host.appendChild(autoAdvanceHost);

    // Wire child sections directly — no getElementById re-lookup needed since
    // we hold direct references from the createElement block above.
    const log = (user.senebty && user.senebty.fourTreasuresLog) || [];
    renderFourTreasuresGraph(graphHost, log);

    renderStreakPauseSection(streakPauseHost, user);

    renderHekaSection(hekaHost, user);

    try { renderPendingConfirmsSection(pendingHost, user); }
    catch (e) { console.error('[parent-dashboard] renderPendingConfirmsSection failed', e); }

    try { _renderWedehaUploadPanel(wedehaUploadHost, {}); }
    catch (e) { console.error('[parent-dashboard] wedeha upload panel render failed', e); }

    try { renderAutoAdvanceLogSection(autoAdvanceHost, user); }
    catch (e) { console.error('[parent-dashboard] renderAutoAdvanceLogSection failed', e); }
  }

  window.Senebty.parentDashboard = {
    renderSenebtyCard: renderSenebtyCard,
    renderDailyRitualToggle: renderDailyRitualToggle,
    renderFourTreasuresGraph: renderFourTreasuresGraph,
    renderStreakPauseSection: renderStreakPauseSection,
    renderHekaSection: renderHekaSection,
    renderPendingConfirmsSection: renderPendingConfirmsSection,
    renderAutoAdvanceLogSection: renderAutoAdvanceLogSection,
    _renderWedehaUploadPanel: _renderWedehaUploadPanel,
    _findTier: findTier,
    _tierProgressCopy: tierProgressCopy,
    _tierProgressValue: tierProgressValue,
    _iriTallyThisWeek: iriTallyThisWeek,
    _ratingToValue: ratingToValue,
    _trendDescriptor: trendDescriptor,
    _fetchTeachingIriRows: _fetchTeachingIriRows,
  };
})();
