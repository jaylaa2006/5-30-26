# Enterprise Patterns — bindings from v3.43.x post-mortem

These rules are project-wide. They were established after the v3.43.0
production regression where Bridge Mode shipped with the toggle silently
invisible. Three anti-patterns conspired to mask the bug; this file
codifies the corrective patterns so they can't regress.

## Rule 1 — No silent `try { ... } catch(e) {}` on user-facing paths

**Bad:**
```js
try { this._renderReadingPreferencesCard(host); } catch(e) {}
```

**Good (enterprise):**
```js
try { this._renderReadingPreferencesCard(host); }
catch(e) { console.error('[parent] reading preferences card render failed', e); }
```

**Rationale:** Silent catches make UI regressions invisible. v3.43.0 shipped
because the Bridge Mode render-site catch swallowed a `TypeError` ("Cannot
read property 'renderToggle' of undefined"). The toggle did not appear, no
error surfaced, all unit tests passed.

**Where to apply:** any catch that wraps a render method, an async fetch, a
state mutation, an auth check. Defensive catches around truly-unimportant
work (e.g., a sound-effect that fails on muted devices) may stay silent
provided they are documented inline.

**Lint:** `tests/no-silent-catch-on-render-paths.test.mjs` (TODO v3.43.5)
will grep `_render*` callsites and assert each `try { _render*(...) }
catch(e)` block contains a `console.error` or `console.warn` call.

**Baseline (2026-05-06):** 95 silent catches grandfathered in
`maat-reader.html`. New code must not add to this count. Tracked tech
debt: triage and remediate by category over future hotfix slots.

## Rule 2 — Late-binding installer pattern for browser modules

A `<script src="senebty/lib/X.js">` in `<head>` runs BEFORE
`maat-reader.html`'s inline `const App = {...}; window.App = App;` block.
Anything attached directly to `window.App` at script-load is
**silently overwritten** by the later assignment.

**Pattern:** the module exposes `window.__InstallX__(targetApp)`.
maat-reader.html calls it after `window.App = App;`.

```js
// senebty/lib/X.js
(function () {
  if (typeof window === 'undefined') return;

  // … module internals …

  var moduleApi = { /* methods */ };

  window.__InstallX__ = function (targetApp) {
    if (!targetApp || typeof targetApp !== 'object') {
      console.error('[X] __InstallX__: invalid target App');
      return false;
    }
    if (targetApp.X === moduleApi) return true;  // idempotent
    targetApp.X = moduleApi;
    console.log('[X] installed on App namespace');
    return true;
  };
})();
```

```js
// In maat-reader.html, AFTER `window.App = App;`:
if (typeof window.__InstallX__ === 'function') {
  if (!window.__InstallX__(App)) {
    console.error('[X] installer returned false');
  }
} else {
  console.error('[X] __InstallX__ missing');
}
```

**Test:** any new browser module that follows this pattern needs an
HTML-wiring test asserting the installer call comes AFTER
`window.App = App;` (see `tests/senebty-bridge-mode-html-wiring.test.mjs`
for reference).

## Rule 3 — Manual browser smoke is non-negotiable for UI-rendering changes

**Pre-deploy gate:** before deploying any change that affects what the
user sees on the screen, run `node server.js` locally, open the affected
screen in the browser, and confirm the rendered DOM matches expectations.

**Why:** v3.43.0 had 31 passing unit tests. The bug was load-order between
`<head>` script and the body inline script — jsdom + `runScripts:
'dangerously'` runs scripts in the opposite order from real browsers, so
the test harness gave false confidence. Only a real-browser smoke could
have caught this.

**Carry-forward:** the v3.43.0 2nd-eyes deploy-gate (Voice 8) explicitly
listed manual smoke as a pending check. The deploy proceeded without it
on the user's "deploy" instruction. v3.43.1 was the consequence. Future
deploy approvals from the user are NOT a waiver of this rule — the
gate-keeper (this assistant or whoever drafts the hotfix) must surface
the manual-smoke status separately and explicitly.

## Rule 4 — Pure DOM construction; never template-literal HTML injection in module code

**Bad pattern (do not use):** assigning a template-literal string built
from variables into the `.innerHTML` setter.

**Good (enterprise):**
```js
const div = document.createElement('div');
div.className = 'x';
div.textContent = userText;
container.appendChild(div);
```

**Why:** XSS-by-template-injection. The Bridge Mode spec-gate Sam binding
made this explicit; it should apply to all new module code.

**Tests:** module tests should grep their own source for the
`innerHTML\s*=` write pattern and fail if found in writable contexts.
RHS reads are fine.

## Rule 5 — Cache-buster discipline (carry-forward from art-pipeline §7)

Any modification to a `/senebty/lib/*.js`, `/senebty/styles/*.css`, or
`/art/*` asset MUST bump the `?v=YYYYMMDD<letter>` cache-buster on its
`<script>` / `<link>` / `<img>` tag, OR App.ART_CACHE_VERSION (for art).

Without a bump:
- nginx serves with `Cache-Control: max-age=2592000, immutable` — even
  hard-refresh won't fetch the new asset.
- Service worker `cacheFirst` adds another stale layer.
- Cmd+Shift+R does NOT bypass `immutable`.

**Locked in by:** `tests/senebty-bridge-mode-html-wiring.test.mjs` asserts
the cache-buster matches a `\d{8}[a-z]?` pattern.

## Rule 6 — No `defer` / `async` on late-binding installer scripts

Any `<script src="...">` that exposes a `window.__InstallX__` function consumed
by the inline App-bootstrap block at the end of `<body>` MUST load **synchronously**
(no `defer`, no `async`).

**Bad pattern (caused v3.51.41/42 prod breakage of the daily-ritual feature):**
```html
<script src="/senebty/lib/daily-foundation-gate.js?v=20260518b" defer></script>
```

**Good:**
```html
<script src="/senebty/lib/daily-foundation-gate.js?v=20260519a"></script>
```

**Why:** `defer` postpones execution until AFTER the DOM is fully parsed. The inline
installer block (e.g. `window.__InstallDailyFoundationGate__(App)`) is a plain
`<script>` block that runs synchronously as the parser hits it — BEFORE the
defer'd script has loaded. The installer call sees `__InstallX__` as `undefined`,
the silent fall-through logs an error nobody reads, and the feature ships dead.

**Test:** every new late-binding installer's html-wiring test MUST assert no
`defer`/`async` on the tag (see
`tests/senebty-daily-foundation-html-wiring.test.mjs` for the canonical
assertion). Add the same pattern to any new installer-driven module.

**Carry-forward:** if a script MUST defer (rare — e.g. a non-installer optional
enhancement), put the call site inside `DOMContentLoaded` so it runs after the
defer'd script has loaded. Never call an `__InstallX__` from a plain inline
`<script>` block when the module is defer'd.

## Rule 7 — Backdrop / hero videos: viewport-gated, poster-backed, bitrate-budgeted

Any `<video>` rendered as a landing-page or marketing-surface backdrop MUST satisfy:

1. **`preload="none"`** (deferred-load videos) OR **`preload="metadata"`** (hero / above-the-fold). Never `preload="auto"`.
2. **`poster="…"`** attribute resolving to a static still (≤300 KB JPEG at 1280×720). Carries the cinematic identity when the video stalls, is `display:none`'d on reduced-motion, or hasn't arrived yet.
3. **Viewport-gated load** via `IntersectionObserver` (`rootMargin: '300px 0px'`). The lazy-loader IIFE at `maat-reader.html:39113-…` is the canonical implementation — copy that pattern, don't reinvent.
4. **Re-entry safety**: the `App.nav()` handler MUST NOT re-attach `src` / re-fire `load()` on backdrop videos. Let the IntersectionObserver handle byte-pull on scroll. Nav-handler may only `play()`/`pause()` already-buffered videos.
5. **Bitrate budget**: ≤4 Mbps H.264 at 1080p, ≤2 Mbps at 720p. Source assets that exceed this MUST be re-encoded (`scripts/encode-landing-videos.sh` is the canonical recipe — `-c:v libx264 -preset slow -crf 23 -an -movflags +faststart`). Audio MUST be stripped (`-an`) on muted videos — `muted` attribute doesn't strip the audio track, just suppresses playback.
6. **Cache-buster** (`?v=YYYYMMDD<letter>`) on every video URL. Rule 5 applies.
7. **Connection-aware tier** at the loader IIFE: `saveData` / `2g` / `slow-2g` / `prefers-reduced-data` / `prefers-reduced-motion` all short-circuit to posters-only.
8. **No `autoplay` attribute** on backdrop videos. Browsers may auto-promote `preload="metadata"` to `auto` when `autoplay` is present, defeating point #1. Use JS-triggered `.play()` from the IntersectionObserver instead.

**Bad pattern (caused v3.51.44 mobile-throughput regression — Built on African Scholarship, Why Per Ankh, and Karnak sign-in panels all dead on mobile):**
```html
<video class="intro-backdrop-video" autoplay muted loop playsinline preload="auto" src="videos/sets/battle-intro.mp4" oncanplay="..."></video>
```
…paired with a `setTimeout(2000)` that unconditionally fires `data-src → src` swap on every deferred video. Net effect: ~118 MB of bandwidth committed at the 2-second mark on every page-load, every nav-back, regardless of scroll position. Mobile cwnd cannot drain 6 concurrent ~20MB HTTP/2 streams plus a 22MB hero; tail streams stall past attention window.

**Good (v3.51.45):**
```html
<video class="intro-backdrop-video" muted loop playsinline preload="metadata"
       poster="/images/landing/battle-intro.jpg"
       oncanplay="this.classList.add('loaded')">
  <source src="videos/sets/battle-intro.mp4?v=20260519c" type="video/mp4">
</video>
```

**Test:** `tests/landing-video-efficiency.test.mjs` (added v3.51.45; iPad coverage extended v3.51.46) asserts every `<video class="intro-backdrop-video">` carries a `poster=`, a non-`auto` `preload`, no `autoplay`, a `webkit-playsinline` attr, and a cache-busted source URL. Also asserts the IIFE pattern (IntersectionObserver, posters-only short-circuit, no setTimeout-blanket-load) and the v3.51.46 auto-degrade machinery (play-rejection threshold, stall threshold, hero-canplay budget watchdog, iOS NotAllowedError fast-path, visibilitychange + offline/online event listeners).

**iPad / Safari coverage (v3.51.46):** Safari does not expose `navigator.connection`, so `effectiveType` / `saveData` signals don't fire for iOS users. The IIFE compensates with **auto-degrade machinery** — 2 `.play()` rejections OR 2 stalls (10s no canplay) OR hero canplay > 5s OR a single iOS `NotAllowedError` (Low Power Mode) → immediate switch to posters-only for remaining videos. Sticky-degraded for the session; never auto-undegrades on `online` event (Coach C5 — safer default). All seven landing videos carry `webkit-playsinline` for iPad belt-and-suspenders.

**Why:** Mobile landing-page first-paint is the conversion funnel. A single ~20 MB video stalling above-the-fold loses the visit. Posters give immediate cinematic content; viewport-gating means a user who bounces after the hero pays 14 MB not 118 MB; the budget ensures the long-tail user on a slow connection still completes the scroll.

**Carry-forward:** when adding any new backdrop video (Senebty wing interior backdrops, governance/timeline/map ambient rotators), apply the same pattern from the start. The Senebty interior `screen-backdrop-video` elements (`maat-reader.html:4602-…`) already use `preload="none"` + viewport-gated swap via `_setupSenebtyInteriorBackdrop` — they were enterprise-correct before this rule existed.
