// senebty/lib/seba-voice.js — Phase v3.33.0
// Pre-recorded Seba audio playback with mandatory caption parity, parent-toggle
// gate, telemetry emission, cancel-race guard, and aria-live caption container.
// Architecture-gate verdict: docs/superpowers/round-tables/2026-04-28-seba-audio-architecture-gate.md
(function(){
  if (typeof window === 'undefined') return;
  window.Senebty = window.Senebty || {};

  var AUDIO_BASE = '/audio/seba';
  var SILENT_PRIME_URL = '/audio/silent.mp3?v=20260428a';
  var TELEMETRY_URL = '/api/telemetry/seba-voice';
  var TELEMETRY_SAMPLE_RATE = 0.1;  // 1 in 10 — Tom's recommended addition
  var CACHE_BUST = '?v=20260428a';

  // Sam's cancel-race guard — single in-flight audio per session.
  var _currentAudio = null;
  // Imani's first-of-session avatar pulse flag.
  var _firstQuipThisSession = true;
  // Sam's first-gesture prime — one-shot only.
  var _primed = false;

  function buildAudioUrl(pool, idx){
    return AUDIO_BASE + '/' + pool + '/' + idx + '.mp3' + CACHE_BUST;
  }

  // Render the Seba caption bubble synchronously into containerEl.
  // Reuses the existing .guide-bubble class. aria-live="polite" — Nia's a11y.
  // Uses createElement + setAttribute exclusively (no HTML-string writes).
  function renderCaption(containerEl, quip){
    if (!containerEl) return false;
    try {
      // replaceChildren is supported on Chrome 86+/Safari 14+/Firefox 78+ — fine for this app's audience.
      if (typeof containerEl.replaceChildren === 'function') containerEl.replaceChildren();
      else containerEl.textContent = '';

      var wrap = document.createElement('div');
      wrap.setAttribute('class', 'guide-wrap compact guide-intro seba-quip-bubble');

      var avatarClass = 'guide-avatar guide-sm seba-quip-avatar';
      if (_firstQuipThisSession) avatarClass += ' seba-avatar-pulse';
      var avatar = document.createElement('div');
      avatar.setAttribute('class', avatarClass);

      var bubble = document.createElement('div');
      bubble.setAttribute('class', 'guide-bubble');
      bubble.setAttribute('aria-live', 'polite');
      bubble.setAttribute('aria-atomic', 'true');

      var name = document.createElement('div');
      name.setAttribute('class', 'guide-name');
      name.textContent = 'Seba Khafre';

      var text = document.createElement('span');
      text.textContent = quip;

      bubble.appendChild(name);
      bubble.appendChild(text);
      wrap.appendChild(avatar);
      wrap.appendChild(bubble);
      containerEl.appendChild(wrap);

      _firstQuipThisSession = false;
      return true;
    } catch (e){
      return false;
    }
  }

  function buildTelemetryPayload(o){
    o = o || {};
    return {
      tag: String(o.tag || 'seba-voice').slice(0, 64),
      pool: String(o.pool || ''),
      persona: String(o.persona || ''),
      fired: Boolean(o.fired),
      captionRendered: Boolean(o.captionRendered),
      voiceMutedByUser: Boolean(o.voiceMutedByUser),
      errorClass: o.errorClass == null ? null : String(o.errorClass).slice(0, 80),
      ts: Date.now()
    };
  }

  function emitTelemetry(payload){
    // 1-in-10 sample rate — Tom's recommended addition for quota discipline.
    if (Math.random() > TELEMETRY_SAMPLE_RATE) return;
    try {
      var body = JSON.stringify(payload);
      if (typeof navigator !== 'undefined' && navigator.sendBeacon){
        navigator.sendBeacon(TELEMETRY_URL, new Blob([body], { type: 'application/json' }));
      } else if (typeof fetch === 'function'){
        fetch(TELEMETRY_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: body,
          keepalive: true
        }).catch(function(){});
      }
    } catch (e){}
  }

  function play(quipMeta, opts){
    quipMeta = quipMeta || {};
    opts = opts || {};
    var pool = quipMeta.pool;
    var idx = quipMeta.idx;
    var quip = quipMeta.quip;
    var persona = quipMeta.persona;
    var containerEl = opts.containerEl || null;
    var voiceMutedByUser = !!opts.voiceMutedByUser;
    var tag = opts.tag || 'seba-voice';

    var captionRendered = renderCaption(containerEl, quip);
    var fired = false;
    var errorClass = null;

    if (!voiceMutedByUser){
      try {
        // Cancel-race guard — Sam's recommendation.
        if (_currentAudio && !_currentAudio.paused){
          try { _currentAudio.pause(); } catch (_){}
        }
        var audio = new Audio(buildAudioUrl(pool, idx));
        audio.playbackRate = persona === 'elder' ? 0.85 : 1.0;
        audio.preload = 'auto';
        _currentAudio = audio;
        var pr = audio.play();
        fired = true;
        if (pr && typeof pr.catch === 'function'){
          pr.catch(function(err){
            errorClass = (err && err.name) ? err.name : 'PlayRejected';
            emitTelemetry(buildTelemetryPayload({
              tag: tag, pool: pool, persona: persona,
              fired: false, captionRendered: captionRendered,
              voiceMutedByUser: voiceMutedByUser, errorClass: errorClass
            }));
          });
        }
      } catch (e){
        errorClass = (e && e.name) ? e.name : 'PlayThrown';
        fired = false;
      }
    }

    emitTelemetry(buildTelemetryPayload({
      tag: tag, pool: pool, persona: persona,
      fired: fired, captionRendered: captionRendered,
      voiceMutedByUser: voiceMutedByUser, errorClass: errorClass
    }));

    return { fired: fired, captionRendered: captionRendered, errorClass: errorClass };
  }

  // First-user-gesture audio prime — Sam's Critical fix.
  // Plays a 1-frame silent MP3 to unlock the audio queue on Chrome/iOS Safari.
  function primeFirstGesture(){
    if (_primed) return;
    if (typeof document === 'undefined') return;
    var handler = function(){
      _primed = true;
      try { new Audio(SILENT_PRIME_URL).play().catch(function(){}); } catch (e){}
      document.removeEventListener('pointerdown', handler, true);
    };
    document.addEventListener('pointerdown', handler, true);
  }

  window.Senebty.sebaVoice = {
    play: play,
    buildTelemetryPayload: buildTelemetryPayload,
    primeFirstGesture: primeFirstGesture
  };
})();
