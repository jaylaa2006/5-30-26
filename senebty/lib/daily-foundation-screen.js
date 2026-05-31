// senebty/lib/daily-foundation-screen.js — v3.51.42
// Renders the daily-foundation 7-step flow. Late-binding installer (Rule 2).
// Pure DOM construction (Rule 4). No silent catches (Rule 1).
(function(){
  if (typeof window === 'undefined') return;

  function _resolveName(app) {
    try {
      const helper = window.SenebtyDisplayName;
      const raw = (app && app.user && app.user.name) || '';
      return (helper && helper.capitalizeName) ? helper.capitalizeName(raw) || 'friend' : raw || 'friend';
    } catch (e) {
      console.warn('[daily-foundation-screen] name resolve failed', e);
      return 'friend';
    }
  }

  // v3.51.43 — data path resolution. Stage-1 RT bug #2: F1 Mu data lives at
  // window.Senebty.foundationMuStory (per the per-foundation singular pattern
  // established by foundation-mu.js / foundation-tjau.js / etc). The original
  // screen code only looked at Senebty.foundations[slug] — a collection that
  // does not exist anywhere — and silently returned null, rendering a blank
  // screen. The fix: check both shapes. Per-foundation singular FIRST (today's
  // canonical data layout), generic collection SECOND (forward-compat for
  // F2-F8 rollout if it adopts a collection layout).
  // See .agent/TODO.md "F2-F8 data-shape choice" for the policy decision.
  const SLUG_TO_SINGULAR = {
    'mu': 'foundationMuStory',
    'four-treasures': 'foundationFourTreasuresStory',
    'tjau': 'foundationTjauStory',
    'mu-streak': 'foundationMuStreakStory',
    'wedeha': 'foundationWedehaStory',
    'hesi': 'foundationHesiStory',
    'senedjem': 'foundationSenedjemStory',
    'heka': 'foundationHekaStory',
  };
  function _resolveStoryDailyFoundation(slug) {
    try {
      const Senebty = window.Senebty;
      if (!Senebty) return null;
      // 1. Per-foundation singular (canonical layout today)
      const singularKey = SLUG_TO_SINGULAR[slug];
      if (singularKey && Senebty[singularKey] && Senebty[singularKey].dailyFoundation) {
        return Senebty[singularKey].dailyFoundation;
      }
      // 2. Generic collection (forward-compat, also used by unit tests)
      if (Senebty.foundations && Senebty.foundations[slug] && Senebty.foundations[slug].dailyFoundation) {
        return Senebty.foundations[slug].dailyFoundation;
      }
      return null;
    } catch (e) {
      console.warn('[daily-foundation-screen] story resolve failed', e);
      return null;
    }
  }

  function _renderGreeting(container, dailyFoundation, name) {
    const card = document.createElement('div');
    card.className = 'senebty-df-greeting';
    card.setAttribute('aria-live', 'polite');
    const title = document.createElement('h1');
    title.className = 'senebty-df-greeting__title';
    title.textContent = (dailyFoundation.greeting.title || 'Today') + ', ' + name;
    card.appendChild(title);
    const sub = document.createElement('p');
    sub.className = 'senebty-df-greeting__subtitle';
    sub.textContent = dailyFoundation.greeting.subtitle || '';
    card.appendChild(sub);
    const pw = document.createElement('div');
    pw.className = 'senebty-df-greeting__powerword';
    pw.textContent = dailyFoundation.greeting.powerWord || '';
    card.appendChild(pw);
    container.appendChild(card);
  }

  function _renderMicro(container, microEntry) {
    if (!microEntry) return;
    const card = document.createElement('div');
    card.className = 'senebty-df-micro';
    const sch = document.createElement('div');
    sch.className = 'senebty-df-micro__scholar';
    sch.textContent = microEntry.scholar + ' teaches';
    card.appendChild(sch);
    const q = document.createElement('p');
    q.className = 'senebty-df-micro__quote';
    q.textContent = microEntry.quote;
    card.appendChild(q);
    container.appendChild(card);
  }

  function _renderGestureInstructions(container, dailyFoundation) {
    if (!dailyFoundation || !dailyFoundation.dailyGesture) return;
    const card = document.createElement('div');
    card.className = 'senebty-df-gesture';
    const text = document.createElement('p');
    // Multi-line gesture text uses the --multiline modifier (white-space: pre-wrap, body font).
    // Single-line gesture text uses the base subtitle class for typographic consistency with F1.
    const isMultiline = dailyFoundation.dailyGesture.indexOf('\n') !== -1;
    text.className = isMultiline
      ? 'senebty-df-greeting__subtitle senebty-df-greeting__subtitle--multiline'
      : 'senebty-df-greeting__subtitle';
    text.textContent = dailyFoundation.dailyGesture;
    card.appendChild(text);
    container.appendChild(card);
  }

  function _prefersReducedMotion() {
    try {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) {
      console.warn('[daily-foundation-screen] matchMedia probe failed', e);
      return false;
    }
  }

  function _renderDoingVeo(container, dailyFoundation, slug) {
    const card = document.createElement('div');
    card.className = 'senebty-df-doing';
    // Stage-2 Coach C2: when the gesture card is rendered (it owns the
    // dailyGesture prose), do NOT repeat the full multi-line gesture in
    // the doing-Veo aria-label/alt — SR users would hear it twice. Use a
    // concise label. The legacy path (no gesture card rendering) falls
    // back to dailyGesture for back-compat with any consumer that calls
    // _renderDoingVeo directly without a preceding gesture card.
    const hasGestureCard = !!(dailyFoundation && dailyFoundation.dailyGesture);
    const accessibleLabel = hasGestureCard
      ? 'Ritual demonstration — see instructions above'
      : (dailyFoundation && dailyFoundation.dailyGesture) || 'Ritual demonstration';
    if (_prefersReducedMotion()) {
      const img = document.createElement('img');
      const posterUrl = dailyFoundation.doingPoster || ('/art/senebty/foundations/' + slug + '/chunk-3.png');
      img.setAttribute('src', posterUrl);
      img.setAttribute('alt', accessibleLabel);
      img.addEventListener('error', function() {
        console.warn('[daily-foundation-screen] doing-veo poster 404:', posterUrl);
        img.style.display = 'none';
      });
      card.appendChild(img);
    } else {
      const url = dailyFoundation.doingVeo || ('/videos/senebty-foundations/' + slug + '-doing.mp4');
      const video = document.createElement('video');
      video.setAttribute('src', url);
      video.setAttribute('autoplay', '');
      video.setAttribute('muted', '');
      video.setAttribute('loop', '');
      video.setAttribute('playsinline', '');
      video.setAttribute('aria-label', accessibleLabel);
      video.muted = true;
      card.appendChild(video);
    }
    container.appendChild(card);
  }

  function _renderBreathChamber(container, df, slug) {
    const card = document.createElement('div');
    card.className = 'senebty-df-breath';
    const reduced = _prefersReducedMotion();
    const ambientUrl = df.breathAmbientVeo || ('/videos/senebty-foundations/' + slug + '-breath-ambient.mp4');
    const poster = df.breathAmbientPoster || df.doingPoster || ('/art/senebty/foundations/' + slug + '/chunk-3.png');

    const bg = document.createElement('div');
    bg.className = 'senebty-df-breath__bg';
    if (reduced) {
      const img = document.createElement('img');
      img.className = 'senebty-df-breath__poster';
      img.setAttribute('src', poster);
      img.setAttribute('alt', '');
      img.addEventListener('error', function () { console.warn('[daily-foundation-screen] breath poster 404:', poster); img.style.display = 'none'; });
      bg.appendChild(img);
    } else {
      const video = document.createElement('video');
      video.setAttribute('src', ambientUrl);
      video.setAttribute('poster', poster);
      video.setAttribute('preload', 'metadata');   // R3: avoid auto-promotion to preload=auto
      video.setAttribute('autoplay', '');   // muted backdrop video (NOT audio) — allowed
      video.setAttribute('muted', '');
      video.setAttribute('loop', '');
      video.setAttribute('playsinline', '');
      video.setAttribute('aria-hidden', 'true');
      video.muted = true;
      video.addEventListener('error', function () { console.warn('[daily-foundation-screen] breath ambient 404:', ambientUrl); video.style.display = 'none'; });
      bg.appendChild(video);
    }
    card.appendChild(bg);

    const pattern = (Array.isArray(df.breathPattern) && df.breathPattern.length >= 3) ? df.breathPattern : [4, 7, 8];
    const rounds = (typeof df.breathRounds === 'number' && df.breathRounds > 0) ? df.breathRounds : 3;
    const guide = document.createElement('div');
    guide.className = 'senebty-df-breath__guide' + (reduced ? ' senebty-df-breath__guide--static' : '');
    guide.setAttribute('role', 'img');
    guide.setAttribute('aria-label', 'Breathing guide: breathe in ' + pattern[0] + ' seconds, hold ' + pattern[1] + ' seconds, out ' + pattern[2] + ' seconds');
    guide.dataset.rounds = String(rounds);
    // custom props via cssText (works in browser; safe under the test stub's plain style object)
    guide.style.cssText = '--breath-in:' + pattern[0] + 's;--breath-hold:' + pattern[1] + 's;--breath-out:' + pattern[2] + 's;';
    card.appendChild(guide);

    const phase = document.createElement('p');
    phase.className = 'senebty-df-breath__phase';
    phase.setAttribute('aria-live', 'polite');
    phase.textContent = reduced
      ? ('Breathe in ' + pattern[0] + ' · hold ' + pattern[1] + ' · out ' + pattern[2])
      : 'Breathe with the light';
    card.appendChild(phase);

    container.appendChild(card);
  }

  function _renderVoiceDemo(container, df, slug) {
    const card = document.createElement('div');
    card.className = 'senebty-df-voicedemo';
    const reduced = _prefersReducedMotion();
    const audioUrl = df.voiceDemoAudio || ('/audio/senebty/' + slug + '-voice-demo.mp3');

    const audio = document.createElement('audio');
    audio.setAttribute('src', audioUrl);
    audio.setAttribute('preload', 'none');   // NO autoplay — tap to play (Critical Rule)
    card.appendChild(audio);

    const viz = document.createElement('div');
    viz.className = 'senebty-df-voicedemo__viz' + (reduced ? ' senebty-df-voicedemo__viz--static' : '');
    viz.setAttribute('aria-hidden', 'true');
    card.appendChild(viz);

    const play = document.createElement('button');
    play.type = 'button';
    play.className = 'senebty-df-voicedemo__play';
    play.textContent = '🔊 Hear it';
    play.setAttribute('aria-label', 'Hear the voice demonstration');
    play.addEventListener('click', function () {
      try {
        const p = audio.play && audio.play();
        if (p && typeof p.then === 'function') {
          p.then(function () { if (viz.classList && viz.classList.add) viz.classList.add('is-playing'); })
           .catch(function (e) {
             console.warn('[daily-foundation-screen] voice play rejected', e);
             if (viz.classList && viz.classList.remove) viz.classList.remove('is-playing');
           });
        } else if (viz.classList && viz.classList.add) {
          viz.classList.add('is-playing');   // stub / no-promise path
        }
      } catch (e) { console.error('[daily-foundation-screen] voice demo play failed', e); }
    });
    card.appendChild(play);

    function _clearPlayingViz() { if (viz.classList && viz.classList.remove) viz.classList.remove('is-playing'); }
    audio.addEventListener('ended', _clearPlayingViz);
    audio.addEventListener('pause', _clearPlayingViz);

    audio.addEventListener('error', function () {
      console.warn('[daily-foundation-screen] voice-demo audio missing:', audioUrl);
      play.style.display = 'none';   // hide the affordance until the asset lands
      viz.style.display = 'none';    // EC5: don't leave an orphaned dead viz bar
    });

    const aff = document.createElement('p');
    aff.className = 'senebty-df-voicedemo__affirm';
    aff.textContent = df.voiceAffirmation || 'Your voice is yours. Speak it steady.';
    card.appendChild(aff);

    container.appendChild(card);
  }

  // Partial MurmurHash3 body-mix (no avalanche finalizer) — deterministic and
  // flat-enough for daily UI word rotation; NOT for anything security-sensitive.
  function _hash(str) {
    let h = 1779033703 ^ str.length;
    for (let k = 0; k < str.length; k++) {
      h = Math.imul(h ^ str.charCodeAt(k), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return (h >>> 0);
  }
  function _pickTwo(pool, seed) {
    if (!pool.length) return [];
    if (pool.length === 1) return [pool[0]];
    const h = _hash(seed);
    const i = h % pool.length;
    let j = (i + 1 + (Math.floor(h / pool.length) % (pool.length - 1))) % pool.length;
    if (j === i) j = (i + 1) % pool.length;
    return [pool[i], pool[j]];
  }
  // Store the child's true word RAW (whitespace-normalized + length-capped).
  // Display is always via textContent (Rule 4), which neutralizes HTML — so we
  // do NOT entity-escape here (escaping then textContent-rendering would corrupt
  // legitimate apostrophes/dashes in both pool words and custom words). Any
  // future surface that renders this via innerHTML (e.g. the parent dashboard)
  // MUST escape on output.
  function _capWord(s) {
    return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, 120);
  }
  function _commitTrueWord(app, word) {
    try {
      const user = app && app.user;
      if (!user) {
        // EC1: anon users don't reach the daily ritual (wing-entry hook gates on
        // App.user.id → legacy rings); defensive — log, don't silently drop.
        console.warn('[daily-foundation-screen] true word not persisted — no app.user');
        return;
      }
      if (!user.senebty) user.senebty = {};
      user.senebty.hekaTrueWord = _capWord(word);
      if (typeof app.saveUser === 'function') {
        try { app.saveUser(); } catch (e) { console.error('[daily-foundation-screen] saveUser failed', e); }
      }
    } catch (e) { console.error('[daily-foundation-screen] commit true word failed', e); }
  }

  function _renderAffirmationChoice(container, app, df, slug, today) {
    const card = document.createElement('div');
    card.className = 'senebty-df-affirm';
    const pool = Array.isArray(df.hekaTrueWords) ? df.hekaTrueWords : [];
    const user = (app && app.user) || {};

    if (user.senebty && user.senebty.hekaTrueWord) {
      const prev = document.createElement('p');
      prev.className = 'senebty-df-affirm__prev';
      prev.textContent = 'Your word: ' + user.senebty.hekaTrueWord;
      card.appendChild(prev);
    }

    const prompt = document.createElement('p');
    prompt.className = 'senebty-df-affirm__prompt';
    prompt.textContent = 'Choose a true word to carry today — or write your own.';
    card.appendChild(prompt);

    const status = document.createElement('p');
    status.className = 'senebty-df-affirm__status';
    status.setAttribute('aria-live', 'polite');

    const two = _pickTwo(pool, (user.id || 'anon') + ':' + slug + ':' + (today || ''));
    const list = document.createElement('div');
    list.className = 'senebty-df-affirm__choices';
    two.forEach(function (word) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'senebty-df-affirm__choice';
      b.textContent = word;
      b.setAttribute('aria-label', 'Choose this true word: ' + word);
      b.addEventListener('click', function () { _commitTrueWord(app, word); status.textContent = 'Carried today: ' + word; });
      list.appendChild(b);
    });
    card.appendChild(list);
    card.appendChild(status);

    if (df.hekaAllowCustom !== false) {
      const input = document.createElement('input');
      input.className = 'senebty-df-affirm__input';
      input.setAttribute('type', 'text');
      input.setAttribute('maxlength', '120');
      input.setAttribute('aria-label', 'Write your own true word');
      input.setAttribute('placeholder', 'Write your own true word…');
      card.appendChild(input);

      const save = document.createElement('button');
      save.type = 'button';
      save.className = 'senebty-df-affirm__save';
      save.textContent = 'Make it mine';
      save.setAttribute('aria-label', 'Save my own true word');
      save.addEventListener('click', function () {
        try {
          const v = (input.value || '').trim();
          if (v) { _commitTrueWord(app, v); status.textContent = 'Carried today: ' + v; }
        } catch (e) { console.error('[daily-foundation-screen] save true word failed', e); }
      });
      card.appendChild(save);
    }

    container.appendChild(card);
  }

  function _renderExperience(container, app, df, slug, today) {
    const type = (df && df.experienceType) || 'veo';
    try {
      if (type === 'breath') return _renderBreathChamber(container, df, slug);
      if (type === 'voice-demo') return _renderVoiceDemo(container, df, slug);
      // today forwarded to the affirmation renderer (Task 4)
      if (type === 'affirmation') return _renderAffirmationChoice(container, app, df, slug, today);
      return _renderDoingVeo(container, df, slug);
    } catch (e) {
      console.error('[daily-foundation-screen] experience render failed (' + type + ') — falling back to doing-veo', e);
      // Only fall back from a non-default branch; the 'veo' branch already IS
      // _renderDoingVeo, so re-calling it on its own failure would just rethrow.
      if (type !== 'veo') {
        try { return _renderDoingVeo(container, df, slug); }
        catch (e2) { console.error('[daily-foundation-screen] doing-veo fallback also failed', e2); }
      }
      // EC6: never leave an empty experience slot — render a minimal text note.
      const note = document.createElement('p');
      note.className = 'senebty-df-doing';
      note.textContent = 'Ritual demonstration unavailable.';
      container.appendChild(note);
    }
  }

  function _renderBlessing(container, app, dailyFoundation, slug) {
    const name = _resolveName(app);
    const card = document.createElement('div');
    card.className = 'senebty-df-blessing';
    card.setAttribute('aria-live', 'polite');

    const vidWrap = document.createElement('div');
    vidWrap.className = 'senebty-df-blessing__video';
    if (_prefersReducedMotion()) {
      const img = document.createElement('img');
      const posterUrl = dailyFoundation.blessingPoster || ('/art/senebty/foundations/' + slug + '/sage-blessing.png');
      img.setAttribute('src', posterUrl);
      img.setAttribute('alt', 'Sage blessing for the daily ' + (slug || 'foundation') + ' practice');
      img.addEventListener('error', function() {
        console.warn('[daily-foundation-screen] blessing poster 404:', posterUrl);
        img.style.display = 'none';
      });
      vidWrap.appendChild(img);
    } else {
      const url = dailyFoundation.blessingVeo || ('/videos/senebty-foundations/' + slug + '-blessing-sunu.mp4');
      const video = document.createElement('video');
      video.setAttribute('src', url);
      video.setAttribute('autoplay', '');
      video.setAttribute('muted', '');
      video.setAttribute('loop', '');
      video.setAttribute('playsinline', '');
      video.setAttribute('aria-label', 'Sage blessing for the daily ' + (slug || 'foundation') + ' practice');
      video.muted = true;
      vidWrap.appendChild(video);
    }
    card.appendChild(vidWrap);

    const line = document.createElement('p');
    line.className = 'senebty-df-blessing__line';
    const raw = dailyFoundation.blessingLine || '';
    line.textContent = raw.replace(/\{name\}/g, name);
    card.appendChild(line);

    const continueBtn = document.createElement('button');
    continueBtn.type = 'button';
    continueBtn.className = 'senebty-df-continue';
    continueBtn.textContent = 'Continue to Senebty';
    continueBtn.setAttribute('aria-label', 'Done — return to Senebty home');
    continueBtn.addEventListener('click', function() {
      try {
        if (app && typeof app.nav === 'function') {
          app.nav('senebty');
        } else {
          console.warn('[daily-foundation-screen] continue: App.nav unavailable');
        }
      } catch (e) {
        console.error('[daily-foundation-screen] continue click failed', e);
      }
    });
    card.appendChild(continueBtn);

    container.appendChild(card);
  }

  function _renderHonorCheck(container, app, dailyFoundation, slug, microIdx) {
    const btn = document.createElement('button');
    btn.className = 'senebty-df-honor';
    btn.type = 'button';
    // Stage-2 Coach C1 (F2 spec §5 verbatim): per-foundation honor-check
    // copy reads from dailyFoundation.honorCheckLabel. Falls back to F1's
    // generic phrasing when absent (F1 Mu does not override).
    btn.textContent = (dailyFoundation && dailyFoundation.honorCheckLabel) || '✓ I did this today';
    btn.setAttribute('aria-label', 'Mark today\'s ' + (slug || 'foundation') + ' practice complete');
    btn.addEventListener('click', function() {
      try {
        const today = new Date().toISOString().slice(0, 10);
        if (app && app.dailyFoundationGate && typeof app.dailyFoundationGate.recordCompletion === 'function') {
          app.dailyFoundationGate.recordCompletion(app.user, today, microIdx);
        } else {
          console.warn('[daily-foundation-screen] honor click: gate.recordCompletion unavailable');
        }
        // Transition to blessing phase (Task 12). Wrap in defensive try-catch
        // since _renderBlessing may not exist yet at the time of the click
        // in test scaffolds. Rule 1: log, don't swallow.
        if (typeof _renderBlessing === 'function') {
          container.replaceChildren();
          _renderBlessing(container, app, dailyFoundation, slug);
        }
        // Persist user record (defer to App.saveUser if available — same pattern
        // as other senebty modules).
        if (app && typeof app.saveUser === 'function') {
          try { app.saveUser(); } catch (e) { console.error('[daily-foundation-screen] saveUser failed', e); }
        }
      } catch (e) {
        console.error('[daily-foundation-screen] honor click handler failed', e);
      }
    });
    container.appendChild(btn);
  }

  function render(app, container, slug) {
    if (!container) {
      console.error('[daily-foundation-screen] render: missing container');
      return;
    }
    container.replaceChildren();
    container.className = 'senebty-daily-foundation';
    const name = _resolveName(app);
    const df = _resolveStoryDailyFoundation(slug);
    if (!df) {
      console.error('[daily-foundation-screen] no dailyFoundation data for slug:', slug);
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const microIdx = app.dailyFoundationGate
      ? app.dailyFoundationGate.pickMicroIdx(app.user, slug, today, (df.microTeachings || []).length)
      : 0;
    _renderGreeting(container, df, name);
    _renderMicro(container, (df.microTeachings || [])[microIdx]);
    _renderGestureInstructions(container, df);
    _renderExperience(container, app, df, slug, today);
    _renderHonorCheck(container, app, df, slug, microIdx);
    container._sessionContext = { slug, microIdx, app };
  }

  const api = { render };

  window.__InstallDailyFoundationScreen__ = function(targetApp) {
    if (!targetApp || typeof targetApp !== 'object') {
      console.error('[daily-foundation-screen] invalid target App');
      return false;
    }
    if (targetApp.dailyFoundationScreen === api) return true;
    targetApp.dailyFoundationScreen = api;
    console.log('[daily-foundation-screen] installed on App namespace');
    return true;
  };
})();
