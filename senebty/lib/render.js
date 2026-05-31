// senebty/lib/render.js
// DOM rendering for Senebty section. Reads from window.Senebty.tiers + App.user.senebty.
// All copy is tone-canon-locked (statements of fact, no celebration patter).
// Task #202: Veo background video integration (gate-ambient, threshold, tier-stings, home-CTA).
(function(){
  if (typeof window === 'undefined') return;
  window.Senebty = window.Senebty || {};

  const RING_DEFS = [
    { key:'foundations', title:'Foundations', desc:'Eight teachings. The first hall.', unlockTier:0 },
    { key:'rekh',        title:'Rekh Domains', desc:'Plants. Anatomy. Channels. Seasons. Heka. Diagnosis.', unlockTier:2, lockMsg:'Open after the eight Foundations and the gates of Sesh en Per Ankh.' },
    { key:'trials',      title:'Imhotep\u2019s Trials', desc:'Cases the Sunu Sba may take.', unlockTier:4, lockMsg:'Open after Wabau and the diagnostic gates.' },
  ];

  // Phase 1.2 round-table follow-up (Khepri/Maya): truncate multi-codepoint
  // mdwNtr to the first 2 hieroglyphs at tier-badge size (1.4rem in a 50px
  // column). Uses spread-iterate so each surrogate-pair codepoint counts as
  // one "glyph" — naive .slice(0,2) would split a hieroglyph mid-surrogate.
  // Tier modal + threshold-intro contexts render the full string.
  function tierBadgeGlyph(mdwNtr){
    if (!mdwNtr) return '';
    const codepoints = [...mdwNtr];
    return codepoints.length <= 2 ? mdwNtr : codepoints.slice(0, 2).join('');
  }

  function gate(app){
    // Render at tier 0 even when there's no signed-in user — visitors landing
    // on /#senebty directly should still see the rings + Seba copy.
    const tierIdx = (app && app.user && app.user.senebty && app.user.senebty.tier) || 0;
    const tier = window.Senebty.tiers[tierIdx] || window.Senebty.tiers[0];
    const glyphEl = document.getElementById('senebtyTierGlyph');
    const nameEl  = document.getElementById('senebtyTierName');
    const sebaEl  = document.getElementById('senebtyGateSeba');
    const ringsEl = document.getElementById('senebtyRings');
    // Tier-badge truncates 3+ sign strings (T2 sesh-en-per-ankh = 4 signs) to
    // the first 2 codepoints. The full mdwNtr renders elsewhere (tier modal,
    // threshold intro) where size accommodates the longer string.
    // Phase 1.3 — sigil render branch using createElement (no innerHTML).
    // Tiers with no mdwNtr but a sigilSrc render an <img>; otherwise fall back to
    // truncated glyph text. T2/T3 keep text path.
    if (glyphEl) {
      glyphEl.replaceChildren();
      if (tier.mdwNtr == null && tier.sigilSrc) {
        var img = document.createElement('img');
        img.setAttribute('class', 'senebty-tier-sigil');
        img.setAttribute('loading', 'lazy');
        img.setAttribute('alt', (tier.displayName || tier.key) + ' sigil');
        img.setAttribute('src', tier.sigilSrc);
        // v3.44.5 — Voice 3 v3.43.x bundle binding: sigil 404 fallback.
        // If the PNG fails to load (CDN miss, asset removed), hide the
        // broken-image icon and fall back to the tier display name as
        // text. Without this, a 404 leaves a tiny broken-image rectangle
        // in place of the tier badge — surfaced during the v3.43.x review.
        img.addEventListener('error', function () {
          img.style.display = 'none';
          if (img.parentNode && !img.parentNode.querySelector('.senebty-tier-sigil-fallback')) {
            var fallback = document.createElement('span');
            fallback.className = 'senebty-tier-sigil-fallback';
            fallback.textContent = tier.displayName || tier.key || '';
            img.parentNode.appendChild(fallback);
          }
          console.warn('[senebty/render] tier sigil 404 — fallback to text', { tier: tier.key, src: tier.sigilSrc });
        }, { once: true });
        glyphEl.appendChild(img);
      } else if (tier.mdwNtr) {
        glyphEl.textContent = tierBadgeGlyph(tier.mdwNtr);
      }
    }
    if (nameEl)  nameEl.textContent  = tier.displayName;
    if (sebaEl)  sebaEl.textContent  = sebaForTier(tierIdx);
    if (ringsEl) {
      // Rule 4 — pure DOM construction; replace innerHTML with createElement.
      ringsEl.replaceChildren(...RING_DEFS.map(r => buildRingElement(r, tierIdx)));
      _wireRingClicks(ringsEl, tierIdx);
    }
  }

  // Idempotent: each ring container gets its handler exactly once.
  function _wireRingClicks(ringsEl, tierIdx){
    if (ringsEl.dataset.senebtyRingClicks === '1') return;
    ringsEl.dataset.senebtyRingClicks = '1';
    function activate(target, openerEl){
      var card = target.closest('.senebty-ring');
      if (!card || !ringsEl.contains(card)) return;
      var key = card.getAttribute('data-ring');
      var def = RING_DEFS.find(function(r){ return r.key === key; });
      if (!def) return;
      var locked = tierIdx < def.unlockTier;
      // Foundations ring (unlocked) navigates to the Foundations INDEX
      // overview (King walkthrough binding 2026-05-01: jumping straight
      // into Foundation 1 hid the rest of the path; the index makes all
      // eight visible with their treasure + status).
      // Other unlocked rings + locked rings keep the modal.
      if (!locked && key === 'foundations'){
        if (window.App && typeof window.App.nav === 'function'){
          window.App.nav('senebtyFoundationsIndex');
          return;
        }
      }
      // Pass the ring card as opener so the modal can restore focus on close.
      _showSebaRingModal(def, locked, openerEl || card);
    }
    ringsEl.addEventListener('click', function(e){
      var card = e.target.closest('.senebty-ring');
      activate(e.target, card);
    });
    ringsEl.addEventListener('keydown', function(e){
      if (e.key === 'Enter' || e.key === ' '){
        if (e.target && e.target.classList && e.target.classList.contains('senebty-ring')){
          e.preventDefault();
          activate(e.target, e.target);
        }
      }
    });
  }

  // Pending content for unlocked rings — Foundations exists at tier 0 but the
  // inner screen is Phase 2 work (#173). Until then Seba speaks plainly.
  var COMING_SOON_MSG = 'Soon. The eight Foundations are being prepared. Return when the path opens.';

  // Built entirely with createElement + textContent — no innerHTML, no XSS surface.
  // a11y (v3.51.23): openerEl arg records the ring card that opened the modal
  // so dismiss() can restore focus back to it (WCAG 2.4.3 Focus Order).
  // Focus trap (WCAG 2.1.2): Tab/Shift-Tab cycle inside the single focusable close btn.
  function _showSebaRingModal(ring, locked, openerEl){
    var existing = document.getElementById('senebtyRingModal');
    if (existing) existing.remove();
    var msg = locked ? (ring.lockMsg || 'Not yet open.') : COMING_SOON_MSG;

    var overlay = document.createElement('div');
    overlay.id = 'senebtyRingModal';
    overlay.className = 'senebty-ring-modal';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'senebtyRingModalTitle');

    var card = document.createElement('div');
    card.className = 'senebty-ring-modal__card';

    var title = document.createElement('h3');
    title.id = 'senebtyRingModalTitle';
    title.className = 'senebty-ring-modal__title';
    title.textContent = ring.title;

    var seba = document.createElement('p');
    seba.className = 'senebty-ring-modal__seba';
    seba.textContent = msg;

    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'senebty-ring-modal__close';
    close.setAttribute('aria-label', 'Close ' + ring.title + ' dialog');
    close.textContent = 'Close';

    card.appendChild(title);
    card.appendChild(seba);
    card.appendChild(close);
    overlay.appendChild(card);

    function dismiss(){
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      document.removeEventListener('keydown', onKey);
      // Restore focus to the ring card that opened this modal.
      try { if (openerEl && typeof openerEl.focus === 'function') openerEl.focus(); } catch(e){}
    }
    function onKey(e){
      if (e.key === 'Escape'){ e.preventDefault(); dismiss(); return; }
      // Focus trap: cycle Tab/Shift-Tab within the dialog's one focusable element.
      if (e.key === 'Tab'){
        e.preventDefault();
        close.focus(); // single focusable — always lands here
      }
    }
    overlay.addEventListener('click', function(e){ if (e.target === overlay) dismiss(); });
    close.addEventListener('click', dismiss);
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    // First focus: move to the close button (WCAG 2.4.3).
    setTimeout(function(){ try { close.focus(); } catch(e){} }, 0);
  }

  function sebaForTier(tierIdx){
    if (tierIdx === 0) return 'Senebty, young one. The path is long. We do not pretend. We iri \u2014 we do.';
    return 'You return. The path remembers.';
  }

  // Rule 4 — pure DOM construction. buildRingElement replaces the old ringHtml
  // template-literal helper. All values set via textContent / setAttribute (never
  // innerHTML), so no XSS surface even if ring data were ever user-supplied.
  function buildRingElement(ring, tierIdx){
    const locked = tierIdx < ring.unlockTier;
    const div = document.createElement('div');
    div.className = 'senebty-ring' + (locked ? ' senebty-ring--locked' : '');
    div.setAttribute('data-ring', ring.key);
    div.setAttribute('role', 'button');
    div.setAttribute('tabindex', '0');
    if (locked) {
      div.setAttribute('aria-disabled', 'false');
      div.setAttribute('aria-label', ring.title + ' — locked, tap to learn more');
    } else {
      div.setAttribute('aria-label', ring.title);
    }

    const h3 = document.createElement('h3');
    h3.className = 'senebty-ring__title';
    h3.textContent = ring.title;
    div.appendChild(h3);

    const desc = document.createElement('p');
    desc.className = 'senebty-ring__desc';
    desc.textContent = ring.desc;
    div.appendChild(desc);

    if (locked) {
      const lockP = document.createElement('p');
      lockP.className = 'senebty-ring__lock';
      lockP.textContent = ring.lockMsg || 'Not yet open.';
      div.appendChild(lockP);
    }

    return div;
  }

  // ── Task #202: Video helpers ────────────────────────────────────────────

  // Home CTA hero video path — stable filename, bytes may update.
  const HOME_CTA_VIDEO_SRC = '/videos/senebty/home-cta-hero.mp4';

  // Tier sting video paths. Phase 1.3 ships stings for all 4 dropped-glyph tiers.
  const TIER_STING_MAP = {
    0: '/videos/senebty/tier-sting-hem-sba.mp4',
    1: '/videos/senebty/tier-sting-seba-en-seneb.mp4',
    4: '/videos/senebty/tier-sting-sunu-sba.mp4',
    5: '/videos/senebty/tier-sting-shemes-imhotep.mp4'
  };

  // Threshold video paths for inbound/outbound first-crossings.
  const THRESHOLD_VIDEO_MAP = {
    inbound:  '/videos/senebty/threshold-inbound.mp4',
    outbound: '/videos/senebty/threshold-outbound.mp4'
  };

  /**
   * Returns the sting video src for a given tier index, or null if none exists.
   * @param {number} tierIdx — 0-based tier index from SENEBTY_TIERS
   * @returns {string|null}
   */
  function stingVideoFor(tierIdx){
    return TIER_STING_MAP[tierIdx] || null;
  }

  /**
   * Returns the threshold video src for 'inbound' or 'outbound', or null.
   * @param {string} direction — 'inbound' | 'outbound'
   * @returns {string|null}
   */
  function thresholdVideoFor(direction){
    return THRESHOLD_VIDEO_MAP[direction] || null;
  }

  /**
   * Creates and returns a <video> element ready to be inserted as the gate screen
   * ambient background. Caller is responsible for appending it to the gate container.
   * CSS class `senebty-bg` is applied so reduced-motion rule in senebty.css can hide it.
   * Only call this when the Senebty section becomes visible (first nav-to-senebty).
   * @returns {HTMLVideoElement}
   */
  function mountGateVideo(){
    const vid = document.createElement('video');
    vid.setAttribute('src', '/videos/senebty/gate-ambient.mp4');
    vid.setAttribute('autoplay', '');
    vid.setAttribute('muted', '');
    vid.setAttribute('loop', '');
    vid.setAttribute('playsinline', '');
    vid.setAttribute('preload', 'metadata');
    vid.setAttribute('aria-hidden', 'true');
    vid.classList.add('senebty-bg');
    return vid;
  }

  window.Senebty.render = {
    gate,
    tierBadgeGlyph,
    mountGateVideo,
    stingVideoFor,
    thresholdVideoFor,
    HOME_CTA_VIDEO_SRC
  };
})();
