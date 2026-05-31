// senebty/lib/foundation-render.js
// Shared comic-page render helper for senebty foundation modules (M4 Task 9).
// Owns: illustrated chunk-reading + one-try-reveal MCQ comprehension. Hands off
// to a per-foundation renderIri(app, ctx) callback for the bespoke iri
// checkpoint. Late-binding installer per enterprise-patterns.md Rule 2.
(function(){
  if (typeof window === 'undefined') return;
  window.Senebty = window.Senebty || {};

  // Impl-gate RT binding B1 (Imani/pedagogy): cap comprehension at 5 questions.
  // The M3 per-module code capped at slice(0,4); the uncapped helper showed 8
  // for F2 — too many for ages 5-12. 5 balances real-MCQ engagement against
  // attention span. The cap lives here so all foundations inherit it (not
  // re-introduced per-module).
  // v3.51.40 — cap retained for back-compat with B1 test (pool→5 still
  // governs how many questions enter the per-chunk distribution), but the
  // pulse phase now shows AT MOST MAX_PULSES_PER_CHUNK per chunk-after
  // beat. PM (priority) binding: 1-2 per chunk respects working memory
  // for ages 5-12; aggregate ≤8 across a 4-chunk foundation.
  var MAX_COMPREHENSION = 5;
  // v3.51.40 — per-chunk pulse cap. User binding 2026-05-17 ("multiple
  // choice is fine but not too much — this is for health"). Hilliard
  // (pedagogy) RT: cognitive-load principle — 2 quick pulses per chunk
  // keeps the reading flow as the primary text, with MCQ as a check-in.
  var MAX_PULSES_PER_CHUNK = 2;

  // v3.51.0 — Veo ritual map. Chunks with an entry here render as <video>
  // (with the static PNG as poster) instead of <img>. Body-holds binding:
  // figure is static; one element moves per loop. Source files live at
  // /videos/senebty-rituals/<value>.mp4.
  var VEO_AVAILABLE = {
    // Khaemwaset Threshold (batch 1, v3.51.0)
    'khaemwaset-0': 'khaemwaset-chunk-0-pre-dawn',
    'khaemwaset-1': 'khaemwaset-chunk-1-river-kneel',
    'khaemwaset-2': 'khaemwaset-chunk-2-six-breaths-with-ra',
    // F3 Tjau 4-7-8 breath cycle (batch 2, v3.51.2)
    'tjau-0': 'tjau-chunk-0-gather-breath',
    'tjau-2': 'tjau-chunk-2-hold-full',
    'tjau-3': 'tjau-chunk-3-release-slow',
    // F1 / F4 / F5 / F8 ritual-iri moments (batch 2)
    'mu-3': 'mu-chunk-3-first-cup',
    'mu-streak-3': 'mu-streak-chunk-3-morning-cup',
    'wedeha-3': 'wedeha-chunk-3-offering',
    'heka-3': 'heka-chunk-3-heka-spoken',
    // ── batch 4 (v3.51.14) — 24 new ritual-chunk Veos ────────────────────
    // Stage-1 RT (8 per-foundation panels) + Stage-2 Consistency Coach audit
    // F1 Mu (Sitra) — chunks 0-2
    'mu-0': 'mu-chunk-0-arrival',
    'mu-1': 'mu-chunk-1-cup-named',
    'mu-2': 'mu-chunk-2-iri-named',
    // F2 Four Treasures (Tanu) — chunks 0-3
    'four-treasures-0': 'four-treasures-chunk-0-measure-khat',
    'four-treasures-1': 'four-treasures-chunk-1-listen-ib',
    'four-treasures-2': 'four-treasures-chunk-2-name-ba',
    'four-treasures-3': 'four-treasures-chunk-3-gather-tools',
    // F3 Tjau (Senka) — chunk 1
    'tjau-1': 'tjau-chunk-1-chest-expand',
    // F4 Mu Streak (Nubia) — chunks 0-2
    'mu-streak-0': 'mu-streak-chunk-0-hold-cup',
    'mu-streak-1': 'mu-streak-chunk-1-long-river',
    'mu-streak-2': 'mu-streak-chunk-2-twenty-one',
    // F5 Wedeha (Bener) — chunks 0-2
    'wedeha-0': 'wedeha-chunk-0-arrival',
    'wedeha-1': 'wedeha-chunk-1-whole-foods',
    'wedeha-2': 'wedeha-chunk-2-proportion',
    // F6 Hesi (Ahmose) — chunks 0-3
    'hesi-0': 'hesi-chunk-0-hand-on-throat',
    'hesi-1': 'hesi-chunk-1-sunu-models',
    'hesi-2': 'hesi-chunk-2-careful-disclose',
    'hesi-3': 'hesi-chunk-3-first-hesi',
    // F7 Senedjem (Iry) — chunks 0-3
    'senedjem-0': 'senedjem-chunk-0-evening-question',
    'senedjem-1': 'senedjem-chunk-1-set-bowl',
    'senedjem-2': 'senedjem-chunk-2-choosing',
    'senedjem-3': 'senedjem-chunk-3-show-sweet',
    // F8 Heka (Kahotep) — chunks 0, 1, 2, 4
    'heka-0': 'heka-chunk-0-sit-up',
    'heka-1': 'heka-chunk-1-tameri-lifts-face',
    'heka-2': 'heka-chunk-2-now-you',
    'heka-4': 'heka-chunk-4-compose-together',
  };

  // v3.51.4 — display-time capitalize delegated to shared helper
  // (window.SenebtyDisplayName). Replaces the inline _capName from v3.48.9
  // to establish a single source of truth across server-side templates and
  // all frontend renderers. _capName is kept as a thin alias so any module
  // that still calls _capName directly continues to work during the
  // transitional deploy window.
  var _capName = (window.SenebtyDisplayName && window.SenebtyDisplayName.capitalizeName)
    ? window.SenebtyDisplayName.capitalizeName
    : function(n){ if (!n) return n; return String(n).charAt(0).toUpperCase() + String(n).slice(1); };

  // v3.49.3 — progress-dot indicator (●●○○). Replaces "Chunk N / M" /
  // "Question N / M" implementation-vocab in the counter element. Readable
  // by ages 5+; no developer word leaked into UX copy.
  function _progressDots(currentIdx, total){
    if (!total || total < 1) return '';
    var s = '';
    for (var i = 0; i < total; i++) s += (i <= currentIdx ? '●' : '○') + (i + 1 < total ? ' ' : '');
    return s;
  }

  function _resolveSebaText(s, app){
    if (!s) return '';
    var rawName = (app && app.user && (app.user.name || app.user.displayName)) || '';
    var helper = window.SenebtyDisplayName;
    // display-name.js loads before foundation-render.js (v3.51.4 wiring), so
    // helper is always available. The _capName alias above provides belt-and-
    // suspenders capitalization if the helper is somehow absent at call time.
    if (helper && helper.substituteName) return helper.substituteName(String(s), rawName);
    return String(s).replace(/\{name\}/g, _capName(rawName) || 'friend'); // NOCHECK: _capName is the helper alias
  }

  // v3.51.18 — vocab-aware text rendering. Builds pure-DOM span tree where
  // glossary-matched words get .vocab tap-targets that open App.wordTap.
  // Parallel to the main reader's buildRefAwareHTML, but Rule-4-compliant
  // (createElement + textContent + appendChild — no template-literal HTML).
  // Per the project-law two-stage protocol (Stage-1 RT + Stage-2 Coach).
  function _isVocabWord(clean) {
    if (!clean) return false;
    var GLOSSARY = window.GLOSSARY || {};
    // Match the reader's _resolveVocab logic: exact, hyphen-to-space, trailing-s strip.
    if (typeof window._resolveVocab === 'function') {
      return !!window._resolveVocab(clean);
    }
    return !!(GLOSSARY[clean] || GLOSSARY[clean.replace(/-/g, ' ')] || GLOSSARY[clean.replace(/s$/, '')]);
  }

  // Coach #1 — multi-word phrase support. The reader's _PHRASE_REFS handles
  // 'Per Ankh' etc.; we mirror that here. List of multi-word glossary terms
  // is derived from window.GLOSSARY keys at lookup time; longest-first
  // matching avoids 'Per' matching before 'Per Ankh'.
  function _multiWordPhrases() {
    var GLOSSARY = window.GLOSSARY || {};
    var phrases = [];
    for (var k in GLOSSARY) {
      if (k.indexOf(' ') >= 0) phrases.push(k);
    }
    return phrases.sort(function (a, b) { return b.length - a.length; });
  }

  function _appendVocabSpan(parent, displayText, lookupTerm) {
    var btn = document.createElement('span');
    btn.className = 'word vocab';
    btn.setAttribute('role', 'button');
    btn.setAttribute('tabindex', '0');
    btn.setAttribute('aria-label', 'glossary term: ' + lookupTerm);
    btn.dataset.word = lookupTerm;
    btn.textContent = displayText;
    btn.addEventListener('click', function () {
      try { window.App.wordTap(lookupTerm); } catch (e) { console.error('[foundation-render] vocab tap failed', e); }
    });
    btn.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        try { window.App.wordTap(lookupTerm); } catch (e2) { console.error('[foundation-render] vocab keydown failed', e2); }
      }
    });
    parent.appendChild(btn);
  }

  // Vocab lookup precedence (Coach #5 documentation):
  //   1. Exact lowercase match in GLOSSARY
  //   2. Hyphen-to-space substitution
  //   3. Trailing-s singular strip
  //   4. Multi-word phrase greedy-longest-first (handled separately in
  //      _renderWithVocab via _multiWordPhrases)
  function _renderWithVocab(copyEl, text, app) {
    copyEl.replaceChildren();
    if (!text) return;
    var resolved = _resolveSebaText(text, app);
    var hasApp = typeof window.App !== 'undefined' && typeof window.App.wordTap === 'function';
    if (!hasApp) {
      // Graceful degradation — render plain text node.
      copyEl.appendChild(document.createTextNode(resolved));
      return;
    }

    // Pass 1: substitute multi-word phrases with placeholder markers so the
    // word-tokenizer doesn't split them. Encode as PHRASE <idx> .
    var phrases = _multiWordPhrases();
    var phraseMatches = [];
    var working = resolved;
    if (phrases.length) {
      for (var pi = 0; pi < phrases.length; pi++) {
        var phrase = phrases[pi];
        var phraseRe = new RegExp('\\b' + phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
        working = working.replace(phraseRe, function (match) {
          var idx = phraseMatches.length;
          phraseMatches.push({ display: match, lookup: phrase });
          return ' PHRASE_' + idx + ' ';
        });
      }
    }

    var parts = working.split(/(\s+)/);
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i];
      if (!part) continue;
      if (/^\s+$/.test(part)) {
        copyEl.appendChild(document.createTextNode(part));
        continue;
      }
      // Phrase marker?
      var pm = part.match(/^ PHRASE_(\d+) $/);
      if (pm) {
        var info = phraseMatches[parseInt(pm[1], 10)];
        _appendVocabSpan(copyEl, info.display, info.lookup);
        continue;
      }
      // Single word lookup.
      var clean = part.replace(/[^a-zA-Z'-]/g, '').toLowerCase();
      if (clean && _isVocabWord(clean)) {
        _appendVocabSpan(copyEl, part, clean);
      } else {
        copyEl.appendChild(document.createTextNode(part));
      }
    }
  }

  // Grabs the #senebtyFoundation DOM refs once. Returns null if the host is
  // absent (caller bails — never throws on a missing screen).
  function _grabRefs(){
    var stage = document.querySelector('#senebtyFoundation .senebty-foundation-stage');
    var copy = document.getElementById('senebtyFoundationCopy');
    var cta = document.getElementById('senebtyFoundationCta');
    if (!stage || !copy || !cta) return null;
    return {
      stage: stage,
      copy: copy,
      cta: cta,
      counter: document.getElementById('senebtyFoundationCounter'),
      glyph: document.getElementById('senebtyFoundationGlyph'),
      vessel: document.getElementById('senebtyFoundationVessel'),
    };
  }

  // Returns the /videos/senebty-rituals/<slug>.mp4?v=<cache-bust> URL if this
  // chunk has a Veo, or null if not. Callers use the result to decide <video>
  // vs <img>. v3.51.39 — cache-buster appended so Cloudflare CDN serves fresh
  // content after a Veo regen (previously stale-locked for the CF TTL).
  // App.ART_CACHE_VERSION is the wing-wide cache key; bump it on every regen.
  function _veoUrl(foundationKey, chunkIdx, app){
    var key = foundationKey + '-' + chunkIdx;
    var slug = VEO_AVAILABLE[key];
    if (!slug) return null;
    var v = (app && app.ART_CACHE_VERSION) || '0';
    return '/videos/senebty-rituals/' + slug + '.mp4?v=' + v;
  }

  // Builds the per-chunk art URL. The helper builds its own URL — app._artUrl()
  // hardcodes the main-reader /art/<storyId>/ path and cannot produce this one.
  function _artUrl(app, foundationKey, chunkIdx){
    var v = (app && app.ART_CACHE_VERSION) || '0';
    return '/art/senebty/foundations/' + foundationKey + '/chunk-' + chunkIdx + '.png?v=' + v;
  }

  // Builds the lapis-field fallback div — config.glyph centered if present,
  // field alone if not (glyph-verdict constraint — most foundations have NO
  // glyph). Pure DOM construction (Rule 4). The CSS gives .senebty-fc-art-fallback
  // the lapis radial gradient.
  function _buildLapisFallback(glyph){
    var fb = document.createElement('div');
    fb.className = 'senebty-fc-art-fallback';
    if (glyph){
      var g = document.createElement('span');
      g.className = 'senebty-fc-art-glyph';
      g.textContent = glyph;
      fb.appendChild(g);
    }
    return fb;
  }

  // Renders the lapis-field anchor directly into a slot — no <img>, no network
  // request. Used by the comprehension phase. Impl-gate RT binding (QA-DA): the
  // old code abused _renderArtSlot with chunkIdx=-1 to force a 404, firing a
  // doomed network request on every comprehension question.
  function _renderLapisAnchor(slotEl, glyph){
    slotEl.replaceChildren();
    slotEl.className = 'senebty-fc-art';
    slotEl.appendChild(_buildLapisFallback(glyph));
  }

  // Renders the static <img> into slotEl. On load failure swaps to the
  // lapis-field fallback. Pure DOM construction (Rule 4).
  function _renderImgFallback(slotEl, imgUrl, config){
    var img = document.createElement('img');
    img.className = 'senebty-fc-art-img';
    img.setAttribute('loading', 'lazy');
    img.setAttribute('alt', '');  // decorative — teaching is in the text
    img.setAttribute('src', imgUrl);
    img.addEventListener('error', function(){
      img.style.display = 'none';
      if (slotEl.querySelector('.senebty-fc-art-fallback')) return;
      slotEl.appendChild(_buildLapisFallback(config.glyph));
      console.warn('[foundation-render] art 404 — lapis-field fallback',
        { foundationKey: config.foundationKey, chunkIdx: -1 });
    }, { once: true });
    slotEl.appendChild(img);
  }

  // Renders the art slot for a chunk. If a Veo exists and prefers-reduced-motion
  // is not active, renders a looping <video> with the PNG as poster. On video
  // error falls back to static <img>. prefers-reduced-motion users always get
  // the static poster as a still. Pure DOM construction (Rule 4).
  function _renderArtSlot(slotEl, app, config, chunkIdx){
    slotEl.replaceChildren();
    slotEl.className = 'senebty-fc-art';
    var imgUrl = _artUrl(app, config.foundationKey, chunkIdx);
    var veoUrl = _veoUrl(config.foundationKey, chunkIdx, app);
    var reducedMotion = (typeof window !== 'undefined' && window.matchMedia)
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;

    if (veoUrl && !reducedMotion) {
      var video = document.createElement('video');
      video.className = 'senebty-fc-art-video';
      video.setAttribute('autoplay', '');
      video.setAttribute('muted', '');
      video.setAttribute('loop', '');
      video.setAttribute('playsinline', '');
      video.setAttribute('preload', 'auto');
      video.setAttribute('aria-hidden', 'true');
      video.setAttribute('poster', imgUrl);  // static PNG shows while video loads
      video.setAttribute('src', veoUrl);
      video.addEventListener('error', function(){
        // Veo failed to load — fall back to static <img>
        console.warn('[foundation-render] veo load error — fallback to static',
          { foundationKey: config.foundationKey, chunkIdx: chunkIdx });
        slotEl.replaceChildren();
        _renderImgFallback(slotEl, imgUrl, config);
      }, { once: true });
      slotEl.appendChild(video);
      return;
    }

    _renderImgFallback(slotEl, imgUrl, config);
  }

  // Deterministic shuffle seeded by a string — same question text → same
  // option order across re-renders (nav-back stability for ages 5-12).
  function _seededShuffle(arr, seedStr){
    var seed = 0;
    for (var i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) | 0;
    var a = arr.slice();
    for (var j = a.length - 1; j > 0; j--){
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      var k = seed % (j + 1);
      var t = a[j]; a[j] = a[k]; a[k] = t;
    }
    return a;
  }

  // v3.51.40 — _renderPulse: parchment-context MCQ pulse used by the new
  // per-chunk comprehension beat. Renders identically to _renderMcq in
  // contract (one-try-reveal, aria-live, pure DOM) but wraps the markup
  // in the .senebty-fc-pulse parchment card so the affordance pattern
  // parallels the main reader's .comprehension-pulse without the dark-theme
  // palette (the senebty side is parchment cream). Reader-Pattern Guardian
  // RT binding: same affordance, different palette.
  //
  // Stage-1 RT — Maya (a11y): role/aria mirror reader pattern; aria-live
  // polite feedback line populated on answer; ≥44px tap targets via CSS.
  // Stage-2 Coach — Reader-Pattern Guardian: cp-label / cp-question /
  // cp-option / cp-feedback class shape mirrors the reader's
  // .comprehension-pulse so screen-reader users hear identical structure
  // across the two sides of the app.
  function _renderPulse(host, app, question, onAnswered){
    host.replaceChildren();
    var pulse = document.createElement('div');
    pulse.className = 'senebty-fc-pulse';

    var label = document.createElement('div');
    label.className = 'senebty-fc-pulse-label';
    label.textContent = 'Quick Check';
    pulse.appendChild(label);

    var qEl = document.createElement('p');
    qEl.className = 'senebty-fc-pulse-q';
    qEl.textContent = _resolveSebaText(question.q || '', app);
    pulse.appendChild(qEl);

    var options = _seededShuffle(
      [question.a].concat(Array.isArray(question.distractors) ? question.distractors : []),
      question.q || ''
    );
    var answered = false;
    var correctBtn = null;
    var feedback = document.createElement('p');
    feedback.className = 'senebty-fc-pulse-feedback';
    feedback.setAttribute('aria-live', 'polite');

    var list = document.createElement('div');
    list.className = 'senebty-fc-pulse-list';
    options.forEach(function(optText){
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'senebty-fc-pulse-option';
      btn.textContent = optText;
      if (optText === question.a) correctBtn = btn;
      btn.addEventListener('click', function(){
        if (answered) return;
        answered = true;
        var wasCorrect = (optText === question.a);
        [].forEach.call(list.children, function(b){ b.disabled = true; });
        if (correctBtn) correctBtn.classList.add('senebty-fc-pulse-correct');
        if (!wasCorrect) btn.classList.add('senebty-fc-pulse-wrong');
        feedback.textContent = wasCorrect
          ? 'Yes — that is it.'
          : 'Not quite. The answer is: ' + question.a;
        onAnswered(wasCorrect);
      });
      list.appendChild(btn);
    });
    pulse.appendChild(list);
    pulse.appendChild(feedback);
    host.appendChild(pulse);
  }

  // v3.51.40 — _renderSebaReflection: end-of-foundation open-text
  // reflection in the sunu's (F1) or Aset's (F2) voice. Parallels the
  // main reader's _renderMaatReflection (mr-* class shape) but wrapped in
  // the parchment .senebty-fc-reflection card. Pure DOM construction.
  //
  // Stage-1 RT — PM/UX: API integration uses existing /api/seba-evaluate
  // (no new server route needed). Africana scholar: voice attribution
  // (Sunu Merytamun for F1, Aset for F2) is declared in data.speaker;
  // the rendered dialogue bubble shows the speaker's name so the child
  // hears the right voice. Character-Continuity Editor: speaker name
  // and {name} token substitution match the chunk-dialogue conventions.
  // Maya: textarea has aria-label, word-count is aria-live polite,
  // submit button is keyboard-reachable.
  //
  // Stage-2 Coach — Reader-Pattern Guardian: textarea + word-count +
  // Seba reply pattern mirrors the reader; minimumWords floor (15)
  // matches the reader's default. Edge case (Coach #3): API failure
  // shows a graceful inline message and unblocks the iri — never
  // strands the child on a hung Promise. Coach #5: AbortController
  // 30s timeout matches the reader's pattern.
  function _renderSebaReflection(host, app, reflection, foundationKey, onDone){
    host.replaceChildren();
    if (!reflection || typeof reflection !== 'object' || !reflection.prompt){
      // No reflection data — graceful skip (don't break the iri handoff).
      if (typeof onDone === 'function') onDone();
      return;
    }
    var card = document.createElement('div');
    card.className = 'senebty-fc-reflection';

    // Speaker dialogue bubble.
    var dialogue = document.createElement('div');
    dialogue.className = 'senebty-fc-seba-dialogue';
    var avatar = document.createElement('div');
    avatar.className = 'senebty-fc-seba-avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = reflection.speakerGlyph || '𓋹';
    dialogue.appendChild(avatar);
    var bubble = document.createElement('div');
    bubble.className = 'senebty-fc-seba-bubble';
    var speakerName = document.createElement('div');
    speakerName.className = 'senebty-fc-seba-name';
    speakerName.textContent = reflection.speaker || 'Sunu';
    bubble.appendChild(speakerName);
    var intro = document.createElement('p');
    intro.className = 'senebty-fc-seba-intro';
    intro.textContent = _resolveSebaText(reflection.sebaIntro || '', app);
    bubble.appendChild(intro);
    dialogue.appendChild(bubble);
    card.appendChild(dialogue);

    // Prompt heading + body.
    var label = document.createElement('div');
    label.className = 'senebty-fc-reflection-label';
    label.textContent = reflection.principle || 'Reflection';
    card.appendChild(label);
    var prompt = document.createElement('p');
    prompt.className = 'senebty-fc-reflection-prompt';
    prompt.textContent = _resolveSebaText(reflection.prompt, app);
    card.appendChild(prompt);

    // Textarea + word count.
    var ta = document.createElement('textarea');
    ta.className = 'senebty-fc-reflection-textarea';
    var rawName = (app && app.user && (app.user.name || app.user.displayName)) || 'friend';
    ta.setAttribute('placeholder', 'Write to ' + (reflection.speaker || 'the sunu') + ' honestly, ' + rawName + '...');
    ta.setAttribute('aria-label', 'Your reflection for ' + (reflection.speaker || 'the sunu'));
    card.appendChild(ta);

    var wc = document.createElement('div');
    wc.className = 'senebty-fc-reflection-wordcount';
    wc.setAttribute('aria-live', 'polite');
    var minW = reflection.minimumWords || 15;
    wc.textContent = (reflection.speaker || 'The sunu') + ' asks for at least ' + minW + ' words of honest reflection';
    card.appendChild(wc);

    // Submit row.
    var submitRow = document.createElement('div');
    submitRow.className = 'senebty-fc-reflection-submit';
    var submitBtn = document.createElement('button');
    submitBtn.type = 'button';
    submitBtn.className = 'senebty-fc-reflection-btn';
    submitBtn.textContent = 'Share with ' + (reflection.speaker || 'the sunu');
    submitRow.appendChild(submitBtn);
    card.appendChild(submitRow);

    // Reply slot (populated after submit).
    var replyEl = document.createElement('div');
    replyEl.className = 'senebty-fc-reflection-reply';
    replyEl.setAttribute('aria-live', 'polite');
    card.appendChild(replyEl);

    host.appendChild(card);

    // Word-count tracking.
    ta.addEventListener('input', function(){
      var count = ta.value.trim().split(/\s+/).filter(function(w){ return w; }).length;
      wc.textContent = count < minW
        ? count + ' of ' + minW + ' words — keep reflecting, ' + rawName
        : count + ' words — your reflection has weight';
    });

    // Submit handler — POSTs to /api/seba-evaluate. The route returns a
    // sebaResponse string (in Seba Khafre's voice); we render it inline as
    // the sunu's listening response. Open follow-up: if user feedback says
    // the reply tone clashes with the sunu voice, add a `mode:'senebty-
    // foundation'` discriminator to the route and a sunu-voiced system
    // prompt branch in buildSebaEvaluatorPrompt.
    var submitted = false;
    submitBtn.addEventListener('click', function(){
      if (submitted) return;
      var answer = ta.value.trim();
      var wordCount = answer.split(/\s+/).filter(function(w){ return w; }).length;
      if (wordCount < minW){
        ta.focus();
        ta.style.outline = '2px solid #B8412B';
        setTimeout(function(){ ta.style.outline = ''; }, 1500);
        return;
      }
      submitted = true;
      submitBtn.disabled = true;
      submitBtn.textContent = (reflection.speaker || 'The sunu') + ' is listening...';
      replyEl.textContent = '';

      var apiUrl = (typeof window !== 'undefined' && window.location && window.location.hostname === 'localhost')
        ? 'http://localhost:3847/api/seba-evaluate'
        : '/api/seba-evaluate';
      var ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
      var timeoutId = setTimeout(function(){ if (ctrl) ctrl.abort(); }, 30000);

      var headers = { 'Content-Type': 'application/json' };
      // Best-effort auth header (the reader uses _authHeaders; senebty side
      // doesn't have a parallel helper, so we look for the conventional
      // JWT in user state). Rule 1: log if absent (not silent).
      try {
        if (app && app.user && app.user.token){
          headers['Authorization'] = 'Bearer ' + app.user.token;
        }
      } catch(e){ console.warn('[foundation-render] auth header gather failed', e); }

      fetch(apiUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          answer: answer,
          prompt: _resolveSebaText(reflection.prompt, app),
          principle: reflection.principle || 'Maat',
          storyContext: reflection.storyContext || '',
          storyTitle: 'Senebty Foundation: ' + (foundationKey || ''),
          childName: rawName,
          childLevel: 1,
          // v3.51.40 — discriminator hint for future server-side branching.
          // Server today ignores unknown keys; presence is forward-compatible.
          mode: 'senebtyFoundation',
          foundationKey: foundationKey || '',
        }),
        signal: ctrl ? ctrl.signal : undefined,
      }).then(function(resp){
        clearTimeout(timeoutId);
        if (!resp.ok) throw new Error('eval HTTP ' + resp.status);
        return resp.json();
      }).then(function(evaluation){
        var reply = (evaluation && evaluation.sebaResponse) ||
          ((reflection.speaker || 'The sunu') + ' hears you, ' + rawName + '. Your words have weight.');
        replyEl.textContent = reply;
        // sebaAfter from data closes the loop in the sunu/aset voice
        // (server reply is Seba's; sebaAfter restores the wing speaker).
        var after = _resolveSebaText(reflection.sebaAfter || '', app);
        if (after){
          var afterP = document.createElement('p');
          afterP.className = 'senebty-fc-reflection-after';
          afterP.textContent = after;
          replyEl.appendChild(document.createElement('br'));
          replyEl.appendChild(afterP);
        }
        submitBtn.textContent = 'On to iri';
        submitBtn.disabled = false;
        // Second click of the same button advances to iri.
        submitBtn.onclick = function(){ if (typeof onDone === 'function') onDone(); };
      }).catch(function(err){
        clearTimeout(timeoutId);
        // Rule 1: log, never swallow. Graceful UX: render the sunu's
        // sebaAfter as a fallback so the child still hears the wing voice
        // and can proceed to iri.
        console.error('[foundation-render] reflection eval failed', err);
        var fallback = _resolveSebaText(reflection.sebaAfter || '', app) ||
          ((reflection.speaker || 'The sunu') + ' hears you, ' + rawName + '. The body remembers.');
        replyEl.textContent = fallback;
        submitBtn.textContent = 'On to iri';
        submitBtn.disabled = false;
        submitBtn.onclick = function(){ if (typeof onDone === 'function') onDone(); };
      });
    });
  }

  // v3.51.40 — _distributePulses: take the comprehensionPool and assign
  // up to MAX_PULSES_PER_CHUNK questions to each chunk, in pool order.
  // Vocabulary-kind questions are deprioritized (now redundant with the
  // v3.51.38 majestic vocab gold treatment); plot questions
  // (character/setting/sequence/inference/maat) are preferred.
  // Deterministic — no randomization, so a back-button does not change
  // the question order (Hilliard spatial-constancy binding).
  function _distributePulses(pool, chunkCount){
    var safePool = Array.isArray(pool) ? pool.slice() : [];
    // Stable partition: non-vocab first, vocab last.
    var nonVocab = safePool.filter(function(q){ return q && q.kind !== 'vocabulary'; });
    var vocab = safePool.filter(function(q){ return q && q.kind === 'vocabulary'; });
    var ordered = nonVocab.concat(vocab);
    var byChunk = [];
    var idx = 0;
    for (var c = 0; c < chunkCount; c++){
      var bucket = [];
      for (var p = 0; p < MAX_PULSES_PER_CHUNK && idx < ordered.length; p++){
        bucket.push(ordered[idx]);
        idx++;
      }
      byChunk.push(bucket);
    }
    return byChunk;
  }

  // Renders one MCQ question into `host`. One-try-reveal: first click locks
  // all options, marks correct + the chosen wrong one, then calls onAnswered
  // (boolean wasCorrect). Pure DOM construction (Rule 4).
  function _renderMcq(host, app, question, onAnswered){
    host.replaceChildren();
    var qEl = document.createElement('p');
    qEl.className = 'senebty-fc-mcq-q';
    qEl.textContent = _resolveSebaText(question.q || '', app);
    host.appendChild(qEl);

    var options = _seededShuffle(
      [question.a].concat(Array.isArray(question.distractors) ? question.distractors : []),
      question.q || ''
    );
    var answered = false;
    var correctBtn = null;
    // Impl-gate RT binding (Tehuti/a11y): aria-live feedback line. The ✓/✗
    // ::after glyphs on the option buttons are not reliably announced by
    // screen readers — this line gives a screen-reader child the correct/wrong
    // result, and is visible copy that helps every child.
    var feedback = document.createElement('p');
    feedback.className = 'senebty-fc-mcq-feedback';
    feedback.setAttribute('aria-live', 'polite');

    var list = document.createElement('div');
    list.className = 'senebty-fc-mcq-list';
    options.forEach(function(optText){
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'senebty-fc-mcq-option';
      btn.textContent = optText;
      if (optText === question.a) correctBtn = btn;
      btn.addEventListener('click', function(){
        if (answered) return;
        answered = true;
        var wasCorrect = (optText === question.a);
        [].forEach.call(list.children, function(b){ b.disabled = true; });
        if (correctBtn) correctBtn.classList.add('senebty-fc-mcq-correct');
        if (!wasCorrect) btn.classList.add('senebty-fc-mcq-wrong');
        feedback.textContent = wasCorrect
          ? 'Yes — that is it.'
          : 'Not quite. The answer is: ' + question.a;
        onAnswered(wasCorrect);
      });
      list.appendChild(btn);
    });
    host.appendChild(list);
    host.appendChild(feedback);
  }

  // L1 chunk filter — foundations have leveled chunks; the foundation flow
  // uses L1 (preserved verbatim from the per-module M3 code).
  function _l1Chunks(story){
    if (!story || !Array.isArray(story.chunks)) return [];
    var l1 = story.chunks.filter(function(c){ return c.level === 1 || c.level == null; });
    return l1.length ? l1 : story.chunks;
  }

  // ── run() — implemented incrementally across Tasks 2-6 ──────────────────
  function run(app, config){
    var refs = _grabRefs();
    if (!refs) {
      console.warn('[foundation-render] run(): #senebtyFoundation host absent — nothing to render');
      return;
    }
    var copy = refs.copy, cta = refs.cta, counter = refs.counter;
    if (refs.glyph) refs.glyph.textContent = '';
    if (refs.vessel) refs.vessel.style.display = 'none';
    if (counter) counter.textContent = '';

    var story = config && config.story;

    // Already-completed done-state — centralizes the per-foundation copy.
    if (config && typeof config.isCompleted === 'function' && config.isCompleted()){
      var donePost = (story && story.iriCheckpoint && story.iriCheckpoint.sebaPostIri)
        ? _resolveSebaText(story.iriCheckpoint.sebaPostIri, app)
        : 'You have iri this foundation today. The ancestors see.';
      copy.textContent = donePost;
      cta.style.display = '';
      cta.textContent = 'Back to gate';
      cta.onclick = function(){ if (app && typeof app.nav === 'function') app.nav('senebty'); };
      return;
    }

    if (!story){
      copy.textContent = 'Story data not loaded. Please refresh.';
      cta.style.display = 'none';
      return;
    }

    // v3.51.64 — Daily-ritual / legacy-reader separation (NARROWED).
    //
    // History: v3.51.41 added an early-return here `if (story.dailyFoundation)
    // { copy=''; return; }` on the premise (true at the time) that ONLY F1 Mu
    // had story.dailyFoundation and "F2-F8 do NOT yet." Phase 2 (v3.51.44-63)
    // then gave ALL EIGHT foundations a dailyFoundation block — so that gate
    // began firing for every foundation and blanked the entire legacy
    // chunk-reader (story + comprehension + iri), not just the v3.51.40b
    // pulse+reflection it was meant to skip. Net: clicking any foundation in
    // the Eight-Foundations index rendered an empty parchment.
    //
    // Fix (user decision 2026-05-20, verified via live Chrome audit): the
    // legacy comic-page reader (story + comprehension + iri) is the intended
    // content for the index ("eight teachings — a thing you do"). The
    // daily-ritual (daily-foundation-screen) remains a SEPARATE opt-in daily
    // touch, NOT a replacement for the reader. So we do NOT early-return;
    // instead we suppress ONLY the pulse+reflection layer for foundations that
    // have a dailyFoundation block (the daily-ritual owns that interaction),
    // while letting the chunk-story + comprehension + iri render normally.
    // The suppression is applied at the reflectionData computation below.

    var chunks = _l1Chunks(story);
    // Impl-gate RT binding B1 — comprehension capped at MAX_COMPREHENSION.
    // Computed once here so chunk-after routing, the comp phase, and the
    // handoff `total` all agree.
    var compPool = (story.comprehensionPool || []).slice(0, MAX_COMPREHENSION);

    // v3.51.40 — per-chunk pulse distribution + end-of-foundation reflection.
    // Mode is "pulse-mode" when the foundation supplies a reflection object
    // (story.sunuReflection or story.asetReflection). Otherwise we keep the
    // legacy bulk-comp phase so F3-F8 continue to render unchanged until
    // their wing pattern lands. Per user binding: "F1 Mu + F2 Four
    // Treasures only" for v3.51.40.
    // v3.51.64 — suppress pulse+reflection for daily-ritual foundations: the
    // daily-foundation-screen owns that interaction, so the legacy reader
    // renders story + comprehension + iri only (no pulse, no end reflection).
    // Foundations WITHOUT a dailyFoundation block keep the original behavior.
    var reflectionData = story.dailyFoundation ? null : (story.sunuReflection || story.asetReflection || null);
    var pulseMode = !!reflectionData;
    var pulsesByChunk = pulseMode ? _distributePulses(story.comprehensionPool || [], chunks.length) : [];
    // Remove a stale art slot from a prior run() call — run() is called fresh
    // on every (re-)entry of the foundation screen; without this, orphaned
    // .senebty-fc-art divs accumulate in the stage on re-render.
    var staleArt = refs.stage.querySelector('.senebty-fc-art');
    if (staleArt && staleArt.parentNode) staleArt.parentNode.removeChild(staleArt);
    var artSlot = document.createElement('div');
    artSlot.className = 'senebty-fc-art';
    refs.stage.insertBefore(artSlot, refs.copy);

    // v3.51.40 — added 'pulse' (per-chunk MCQ) + 'reflection' (end of
    // foundation open-text) phases for pulse-mode foundations.
    var phase = 'chunk-intro';  // chunk-intro|chunk-text|chunk-after|pulse|reflection|comp|handoff
    var chunkIdx = 0;
    var compIdx = 0;
    var compCorrect = 0;
    // v3.51.40 — per-chunk pulse cursor (reset each chunk).
    var pulseIdx = 0;

    // v3.51.9 — the --reading modifier (v3.51.5 wide-screen open-book spread)
    // is removed. The chunk surface is now a single vertical picture-book
    // stack at all viewports. Kept the toggle as a no-op so external code
    // expecting the class doesn't break; CSS no longer reads it.
    function _setReadingClass(active){
      if (!refs.stage || !refs.stage.classList) return;
      refs.stage.classList.toggle('senebty-foundation-stage--reading', !!active);
    }

    // v3.51.16 — CINEMATIC fade-out → swap → fade-in transition between
    // phases (user binding "stylistically cinematic; fade in fade out").
    // Stage-1 RT: 180ms fade-out + 100ms hold at 0 + 220ms fade-in =
    // 500ms total transition. prefers-reduced-motion → instant swap.
    // aria-live="polite" on the copy element makes screen readers
    // re-announce after the swap.
    // Coach #5 — cleanup guard. If the user navs away mid-fade the
    // setTimeout chain shouldn't try to mutate a stale element.
    var _fadeTimers = [];
    function _clearFadeTimers(){
      while (_fadeTimers.length) { clearTimeout(_fadeTimers.pop()); }
    }
    var _isFirstRender = true;
    var _phaseRunInProgress = false;
    function _stepWithFade(renderFn){
      if (_phaseRunInProgress) return; // rapid re-click guard
      _phaseRunInProgress = true;
      var reducedMotion = (typeof window !== 'undefined' && window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      // Coach #1 — skip fade-out on initial render for responsiveness.
      if (reducedMotion || !copy || _isFirstRender) {
        _isFirstRender = false;
        try { renderFn(); } catch (e) { console.error('[foundation-render] step renderFn threw', e); }
        if (copy) copy.scrollTop = 0;
        // Still fade-in on first render for cinematic entry, just no fade-out.
        if (copy && !reducedMotion) {
          copy.style.opacity = '0';
          var rafId = requestAnimationFrame(function(){
            if (copy) copy.style.opacity = '1';
          });
          _fadeTimers.push(rafId);
        } else if (copy) {
          copy.style.opacity = '1';
        }
        _phaseRunInProgress = false;
        return;
      }
      // Coach #6 — fade the counter element together with the copy.
      // Phase 1: fade-out (180ms)
      copy.style.opacity = '0';
      if (counter) counter.style.opacity = '0';
      _fadeTimers.push(setTimeout(function(){
        try { renderFn(); } catch (e) { console.error('[foundation-render] step renderFn threw', e); }
        if (copy) copy.scrollTop = 0;
        // Phase 2: 100ms hold at zero, then fade-in (220ms via CSS)
        _fadeTimers.push(setTimeout(function(){
          if (copy) copy.style.opacity = '1';
          if (counter) counter.style.opacity = '1';
          _phaseRunInProgress = false;
        }, 100));
      }, 180));
    }

    function step(){
      // Defer the actual phase render through the cinematic fade.
      _stepWithFade(_stepCore);
    }

    function _stepCore(){
      _setReadingClass(phase === 'chunk-intro' || phase === 'chunk-text' || phase === 'chunk-after');
      // v3.51.12 Coach #4 — reset scroll position on phase transition.
      // The static parchment can scroll internally for long chunks; on the
      // next chunk's render the previous scroll-state shouldn't persist.
      // The new content's first line MUST be visible at the top of the card.
      if (copy) copy.scrollTop = 0;
      cta.style.display = '';
      if (phase === 'chunk-intro'){
        _renderArtSlot(artSlot, app, config, chunkIdx);
        var c = chunks[chunkIdx] || {};
        _renderWithVocab(copy, c.sebaIntro || '', app);
        // v3.49.3 PM/UX RT — drop "Chunk N / M" implementation-vocab leak.
        // Show filled+open dots instead; readable by 5yo, no developer word.
        if (counter) counter.textContent = _progressDots(chunkIdx, chunks.length);
        cta.textContent = 'Read';
        cta.onclick = function(){ phase = 'chunk-text'; step(); };
        return;
      }
      if (phase === 'chunk-text'){
        var c2 = chunks[chunkIdx] || {};
        _renderWithVocab(copy, c2.text || '', app);
        cta.textContent = 'Continue';
        cta.onclick = function(){ phase = 'chunk-after'; step(); };
        return;
      }
      if (phase === 'chunk-after'){
        var c3 = chunks[chunkIdx] || {};
        _renderWithVocab(copy, c3.sebaAfter || '', app);
        var hasComp = compPool.length > 0;
        // v3.51.40 — pulse-mode routes: chunk-after → pulse (per-chunk
        // 1-2 MCQ pulses) → next chunk; after the last chunk, on to the
        // sunu/aset reflection (replaces the legacy bulk-comp phase).
        if (pulseMode){
          var thisChunkPulses = pulsesByChunk[chunkIdx] || [];
          var hasPulse = thisChunkPulses.length > 0;
          var isLastChunk = (chunkIdx + 1 >= chunks.length);
          cta.textContent = hasPulse
            ? 'Quick check'
            : (isLastChunk ? 'On to reflection' : 'Next chunk');
          cta.onclick = function(){
            if (hasPulse){ phase = 'pulse'; pulseIdx = 0; }
            else if (isLastChunk){ phase = reflectionData ? 'reflection' : 'handoff'; }
            else { chunkIdx++; phase = 'chunk-intro'; }
            step();
          };
          return;
        }
        // Legacy bulk-comp path (F3-F8 until their wing pattern lands).
        cta.textContent = (chunkIdx + 1 < chunks.length) ? 'Next chunk' : 'On to comprehension';
        cta.onclick = function(){
          chunkIdx++;
          if (chunkIdx < chunks.length){ phase = 'chunk-intro'; }
          else { phase = hasComp ? 'comp' : 'handoff'; }
          step();
        };
        return;
      }
      // v3.51.40 — pulse phase. Per-chunk 1-2 MCQ pulses on the parchment
      // .senebty-fc-pulse card. After the chunk's pulses are exhausted,
      // route to the next chunk OR (if last chunk) to reflection/handoff.
      if (phase === 'pulse'){
        var thisChunkPulses = pulsesByChunk[chunkIdx] || [];
        var q = thisChunkPulses[pulseIdx];
        if (!q){
          // Defensive: empty pulse bucket should not have entered this
          // phase. Route forward without stalling. Rule 1: log, not silent.
          console.warn('[foundation-render] pulse phase reached with no question — advancing', { chunkIdx: chunkIdx, pulseIdx: pulseIdx });
          var isLastChunk = (chunkIdx + 1 >= chunks.length);
          phase = isLastChunk ? (reflectionData ? 'reflection' : 'handoff') : 'chunk-intro';
          if (!isLastChunk) chunkIdx++;
          step();
          return;
        }
        var pulseHost = document.createElement('div');
        pulseHost.className = 'senebty-fc-pulse-host';
        copy.replaceChildren(pulseHost);
        // Pulse phase shares the lapis-anchor art treatment with legacy
        // comp — no <img>, no doomed network request (QA-DA carry-forward).
        _renderLapisAnchor(artSlot, config.glyph);
        if (counter) counter.textContent = _progressDots(pulseIdx, thisChunkPulses.length);
        cta.style.display = 'none';
        _renderPulse(pulseHost, app, q, function(wasCorrect){
          if (wasCorrect) compCorrect++;
          cta.style.display = '';
          var moreInChunk = (pulseIdx + 1 < thisChunkPulses.length);
          var isLastChunk = (chunkIdx + 1 >= chunks.length);
          if (moreInChunk){
            cta.textContent = 'Next check';
            cta.onclick = function(){ pulseIdx++; phase = 'pulse'; step(); };
          } else if (isLastChunk){
            cta.textContent = reflectionData ? 'On to reflection' : 'On to iri';
            cta.onclick = function(){ phase = reflectionData ? 'reflection' : 'handoff'; step(); };
          } else {
            cta.textContent = 'Next chunk';
            cta.onclick = function(){ chunkIdx++; pulseIdx = 0; phase = 'chunk-intro'; step(); };
          }
        });
        return;
      }
      // v3.51.40 — end-of-foundation Sunu/Aset reflection (open text).
      // Single contemplative moment after all chunks + pulses; reads
      // reflection data, posts to /api/seba-evaluate, shows reply, then
      // hands off to iri. Hilliard binding: reflection at END, not between
      // chunks — one contemplation moment, not many.
      if (phase === 'reflection'){
        _renderLapisAnchor(artSlot, config.glyph);
        if (counter) counter.textContent = '';
        cta.style.display = 'none';
        var reflectionHost = document.createElement('div');
        reflectionHost.className = 'senebty-fc-reflection-host';
        copy.replaceChildren(reflectionHost);
        _renderSebaReflection(reflectionHost, app, reflectionData, config.foundationKey, function(){
          phase = 'handoff';
          step();
        });
        return;
      }
      if (phase === 'comp'){
        var pool = compPool;
        var q = pool[compIdx];
        var mcqHost = document.createElement('div');
        mcqHost.className = 'senebty-fc-mcq';
        copy.replaceChildren(mcqHost);
        // Comprehension art slot shows the lapis-field anchor directly — no
        // <img>, no doomed network request (impl-gate RT binding, QA-DA).
        _renderLapisAnchor(artSlot, config.glyph);
        if (counter) counter.textContent = _progressDots(compIdx, pool.length);
        cta.style.display = 'none';  // CTA hidden until the child answers
        _renderMcq(mcqHost, app, q, function(wasCorrect){
          if (wasCorrect) compCorrect++;
          cta.style.display = '';
          cta.textContent = (compIdx + 1 < pool.length) ? 'Next question' : 'On to iri';
          cta.onclick = function(){
            compIdx++;
            phase = (compIdx < pool.length) ? 'comp' : 'handoff';
            step();
          };
        });
        return;
      }
      if (phase === 'handoff'){
        var ctx = {
          stage: refs.stage,
          copy: copy,
          counter: counter,  // may be null — renderIri callers must null-guard
          cta: cta,
          story: story,
          comprehension: {
            correct: compCorrect,
            // v3.51.40 — total reflects pulse-mode (per-chunk pulse sum) vs
            // legacy bulk-comp (capped pool length).
            total: pulseMode
              ? pulsesByChunk.reduce(function(s, b){ return s + b.length; }, 0)
              : compPool.length,
          },
          finishIri: function(evidence){
            if (config && typeof config.recordIri === 'function') config.recordIri(evidence);
            if (app && typeof app.saveUser === 'function') app.saveUser();
            if (app && typeof app._checkTierAdvancement === 'function') app._checkTierAdvancement();
            if (app && typeof app.nav === 'function') app.nav('senebty');
          },
        };
        try {
          if (config && typeof config.renderIri === 'function') config.renderIri(app, ctx);
        } catch (e) {
          console.error('[foundation-render] renderIri threw for ' + (config && config.lessonId), e);
          copy.textContent = 'Something went wrong. Please return to the gate.';
          cta.style.display = '';
          cta.textContent = 'Back to gate';
          cta.onclick = function(){ if (app && typeof app.nav === 'function') app.nav('senebty'); };
        }
        return;
      }
    }
    step();
  }

  // v3.51.14 — _VEO_AVAILABLE exposed for test inspection. Underscore prefix
  // marks it as test-surface, not public API. Mutations are not safe (the
  // closure var is the source of truth; this is a reference for reading).
  var foundationRenderApi = { run: run, _renderArtSlot: _renderArtSlot, _VEO_AVAILABLE: VEO_AVAILABLE };

  // Public installer — maat-reader.html MUST call this after its
  // `window.App = App;` reassignment. Idempotent, fails loud (Rule 1 + Rule 2).
  window.__InstallFoundationRender__ = function (targetApp) {
    if (!targetApp || typeof targetApp !== 'object') {
      console.error('[foundation-render] __InstallFoundationRender__: invalid target App', { targetApp: targetApp });
      return false;
    }
    if (targetApp.foundationRender === foundationRenderApi) return true;
    targetApp.foundationRender = foundationRenderApi;
    console.log('[foundation-render] installed on App namespace (M4 Task 9 late-binding)');
    return true;
  };

  // Best-effort early-attach — covers test harnesses where window.App is a real
  // object at load time. The maat-reader.html installer call is authoritative.
  if (window.App && typeof window.App === 'object' && !window.App.foundationRender) {
    window.App.foundationRender = foundationRenderApi;
  }

  window.Senebty.foundationRender = foundationRenderApi;
})();
