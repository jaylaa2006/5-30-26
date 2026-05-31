// senebty/lib/hero-thumb.js — v3.51.21
// Wires hover-Veo hero portrait thumbnails to foundations index cards
// and the Khaemwaset threshold-entry panel.
//
// Pattern: Senebty late-binding installer (Rule 2 — enterprise-patterns.md).
// Attaches to App via __InstallHeroThumb__(App) called AFTER window.App = App.
//
// Behavior:
//   • Each .senebty-foundation-card[data-hero-key] gets a hero thumb overlay.
//   • PNG (static poster) is always visible.
//   • VIDEO is opacity:0 by default; opacity:1 on hover (fine pointer) or focus-within.
//   • On prefers-reduced-motion OR coarse pointer: video stays opacity:0 (CSS handles it).
//   • play() on mouseenter/focusin; pause()+reset on mouseleave/focusout.
//   • Khaemwaset threshold-entry gets the same treatment via .senebty-threshold-entry[data-hero-key].
//
// Rule 1 — no silent catches on render paths.
// Rule 4 — pure DOM construction, no innerHTML template literals.

(function () {
  if (typeof window === 'undefined') return;
  window.Senebty = window.Senebty || {};

  // Foundation key → { png, veo, glyph }
  var HERO_MAP = {
    'mu':             { png: 'sitra-f1-mu',            veo: 'hero-sitra',   glyph: '𓈗' },
    'four-treasures': { png: 'tanu-f2-four-treasures', veo: 'hero-tanu',    glyph: '' },
    'tjau':           { png: 'senka-f3-tjau',          veo: 'hero-senka',   glyph: '' },
    'mu-streak':      { png: 'nubia-f4-mu-streak',     veo: 'hero-nubia',   glyph: '𓈗' },
    'wedeha':         { png: 'bener-f5-wedeha',        veo: 'hero-bener',   glyph: '𓅢' },
    'hesi':           { png: 'ahmose-f6-hesi',         veo: 'hero-ahmose',  glyph: '' },
    'senedjem':       { png: 'iry-f7-senedjem',        veo: 'hero-iry',     glyph: '' },
    'heka':           { png: 'kahotep-f8-heka',        veo: 'hero-kahotep', glyph: '𓎛𓂓𓄿' },
    // Khaemwaset threshold
    'khaemwaset':     { png: 'khaemwaset-threshold',   veo: 'hero-khaemwaset', glyph: '𓉐' },
  };

  // Build the hero thumb container (PNG + video overlay + glyph badge).
  // Returns a <div class="senebty-foundation-card__hero"> element.
  function buildHeroContainer(heroKey) {
    var hero = HERO_MAP[heroKey];
    if (!hero) return null;

    var container = document.createElement('div');
    container.className = 'senebty-foundation-card__hero';
    // flex-shrink applies only in flex containers; this container lives in a CSS
    // grid — the property is harmless but removed for clarity (Stage-1 RT v3.51.21).

    // Static PNG poster — always visible
    var img = document.createElement('img');
    img.className = 'senebty-foundation-card__hero-png';
    img.src = '/art/heroes/' + hero.png + '.png';
    img.alt = '';               // decorative — card aria-label names the foundation
    // Stage-1 RT (v3.51.21): use eager loading — foundations index shows all 8
    // cards simultaneously; lazy-loading causes visible flicker as user views the list.
    img.loading = 'eager';
    img.decoding = 'async';
    container.appendChild(img);

    // Video overlay — opacity controlled by CSS hover/focus-within, hidden on
    // coarse pointer and prefers-reduced-motion (both enforced in CSS, not JS).
    var video = document.createElement('video');
    video.className = 'senebty-foundation-card__hero-veo';
    video.muted = true;
    video.loop = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('preload', 'none');
    video.setAttribute('aria-hidden', 'true');
    // pointer-events:none is set in CSS so video cannot intercept card clicks.
    var source = document.createElement('source');
    source.src = '/videos/senebty-rituals/' + hero.veo + '.mp4';
    source.type = 'video/mp4';
    video.appendChild(source);
    container.appendChild(video);

    // Glyph badge — overlaid bottom-right; empty string = no text, still renders
    // the element (zero-width, invisible) so CSS targeting is stable.
    if (hero.glyph) {
      var badge = document.createElement('span');
      badge.className = 'senebty-foundation-card__hero-glyph';
      badge.setAttribute('aria-hidden', 'true');
      badge.textContent = hero.glyph;
      container.appendChild(badge);
    }

    return container;
  }

  // Wire play/pause events to a card element + its contained video.
  // Handles both mouse (fine pointer) and keyboard (focus-within).
  // JS-level hover events are skipped on coarse-pointer devices
  // (touch) — the video is hidden via CSS anyway, so no-op is correct.
  //
  // Stage-2 Coach (v3.51.21): _playPending flag removed — it was set but never
  // read to gate any decision, making it dead state that added confusion.
  function wireHoverEvents(cardEl, video) {
    function doPlay() {
      video.play().catch(function () {
        // Autoplay policy: user hasn't interacted yet, or browser blocked it.
        // PNG fallback is visible; this is expected and non-fatal.
      });
    }

    function doPause() {
      video.pause();
      video.currentTime = 0;
    }

    cardEl.addEventListener('mouseenter', doPlay);
    cardEl.addEventListener('mouseleave', doPause);
    // Keyboard: focusin = a descendant (or the card itself) gained focus
    cardEl.addEventListener('focusin', doPlay);
    // focusout fires when focus leaves the card subtree
    cardEl.addEventListener('focusout', function (e) {
      // Only pause if focus moved outside this card entirely
      if (!cardEl.contains(e.relatedTarget)) {
        doPause();
      }
    });
  }

  // Main wiring function. Called from installer after App is ready.
  // Stage-2 Coach (v3.51.21): guards against double-wiring — if a card already
  // has a .senebty-foundation-card__hero child, skip it. Prevents duplicated
  // DOM if wireAllCards() is called more than once (e.g. App.heroThumb.wire()).
  function wireAllCards() {
    // Foundation index cards (8 cards, each has data-hero-key attribute)
    var cards = document.querySelectorAll('.senebty-foundation-card[data-hero-key]');
    cards.forEach(function (card) {
      var heroKey = card.getAttribute('data-hero-key');
      if (!heroKey) return;
      // Idempotency guard — skip if already wired
      if (card.querySelector('.senebty-foundation-card__hero')) return;
      try {
        var container = buildHeroContainer(heroKey);
        if (!container) {
          console.error('[hero-thumb] buildHeroContainer returned null for key:', heroKey);
          return;
        }
        // Stage-1 RT (v3.51.21) CRITICAL FIX — grid column order is:
        //   36px(__num)  72px(__hero)  1fr(__body)  auto(__status)
        // Inserting as firstChild placed __hero in the 36px col, squishing the
        // portrait. Must insert AFTER __num so CSS grid places it in col 2.
        var numEl = card.querySelector('.senebty-foundation-card__num');
        if (numEl) {
          card.insertBefore(container, numEl.nextSibling);
        } else {
          // Fallback: no __num found — prepend and warn (should never happen)
          console.error('[hero-thumb] __num not found in card for key:', heroKey, '— prepending as fallback');
          card.insertBefore(container, card.firstChild);
        }
        var video = container.querySelector('.senebty-foundation-card__hero-veo');
        if (video) wireHoverEvents(card, video);
      } catch (e) {
        console.error('[hero-thumb] failed to wire card:', heroKey, e);
      }
    });

    // Khaemwaset threshold-entry panel (optional; same hero-Veo treatment)
    var thresholdEntry = document.querySelector('.senebty-threshold-entry[data-hero-key="khaemwaset"]');
    if (thresholdEntry) {
      // Idempotency guard — skip if already wired
      if (thresholdEntry.querySelector('.senebty-foundation-card__hero')) return;
      try {
        var tContainer = buildHeroContainer('khaemwaset');
        if (!tContainer) {
          console.error('[hero-thumb] buildHeroContainer returned null for khaemwaset threshold');
          return;
        }
        // Prepend to threshold-entry panel — hero appears above the title (centered)
        thresholdEntry.insertBefore(tContainer, thresholdEntry.firstChild);
        var tVideo = tContainer.querySelector('.senebty-foundation-card__hero-veo');
        if (tVideo) wireHoverEvents(thresholdEntry, tVideo);
      } catch (e) {
        console.error('[hero-thumb] failed to wire threshold-entry (khaemwaset):', e);
      }
    }
  }

  var heroThumbApi = {
    wire: wireAllCards,
    buildHeroContainer: buildHeroContainer,
    HERO_MAP: HERO_MAP,
  };

  window.Senebty.heroThumb = heroThumbApi;

  window.__InstallHeroThumb__ = function (targetApp) {
    if (!targetApp || typeof targetApp !== 'object') {
      console.error('[hero-thumb] __InstallHeroThumb__: invalid target App');
      return false;
    }
    if (targetApp.heroThumb === heroThumbApi) return true; // idempotent
    targetApp.heroThumb = heroThumbApi;
    // Wire cards after DOM is ready (DOMContentLoaded may have already fired)
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', wireAllCards);
    } else {
      // DOM already ready — wire immediately
      wireAllCards();
    }
    console.log('[hero-thumb] installed on App namespace');
    return true;
  };
})();
