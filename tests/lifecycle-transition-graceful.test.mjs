// Lifecycle transition gracefulness contract (v3.51.68, audit F1-F6 + R2).
//
// The story lifecycle (intro video → reader → outro video → questions →
// weighing of the heart) used to "blink crudely" between stages. This suite
// locks in the graceful-transition contract so it cannot silently regress:
//
//   F1  — the video overlay (and the completion-card fallback) navigate to the
//         next stage WHILE the overlay is still opaque, THEN fade out to reveal
//         the correct destination — never fade out first to expose the old screen.
//   F2  — nav() crossfades the incoming screen even on non-View-Transition
//         browsers (iOS Safari <18 / Firefox) instead of a raw classList swap.
//   F3  — questions render with an entry animation (.q-card).
//   F4  — the sema→scale handoff crossfades (judg-enter) instead of a display snap.
//   F5  — the judgment score fades in WITH the scale tip, not before it.
//   R2  — every one of the above has a prefers-reduced-motion → instant path.
//
// These are source-contract assertions (the project idiom for inline-HTML
// behavior, cf. landing-video-efficiency.test.mjs / *-html-wiring.test.mjs):
// they verify the code/CSS that produces the behavior is present, ordered
// correctly, and reduced-motion-guarded.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HTML = readFileSync(join(__dirname, '..', 'maat-reader.html'), 'utf8');

// Extract a brace-balanced-ish window starting at a marker (best-effort: from the
// marker to the Nth following close that returns to the start column is overkill;
// for these contracts a generous fixed window after the marker is sufficient and
// robust, since each marker is unique and the asserted tokens live close by).
function regionAfter(marker, len = 1400) {
  const i = HTML.indexOf(marker);
  assert.notEqual(i, -1, `marker not found in maat-reader.html: ${marker}`);
  return HTML.slice(i, i + len);
}

test('F1: video overlay finish() navigates BEFORE fading out (no reveal-then-snap)', () => {
  const finish = regionAfter('const finish = ()=>{', 1500);
  const iDone = finish.indexOf('onDone()');
  const iFade = finish.indexOf("overlay.style.opacity = '0'");
  assert.ok(iDone !== -1, 'finish() must call onDone()');
  assert.ok(iFade !== -1, "finish() must fade overlay opacity to '0'");
  assert.ok(iDone < iFade, 'onDone() (the nav) must run BEFORE the overlay fade-out');
  // onDone must be guarded + logged (Rule 1, no silent catch)
  assert.match(finish, /try\s*\{\s*onDone\(\);?\s*\}\s*catch\s*\(e\)\s*\{\s*console\.error/);
});

test('F1: completion-card fallback also navigates before fade-out', () => {
  const card = regionAfter('_showCompletionCard(labelText, onDone){', 2000);
  // the final hold→fade block
  const tail = card.slice(card.indexOf('}, 2200)') - 400, card.indexOf('}, 2200)') + 12);
  const iDone = tail.indexOf('onDone()');
  const iFade = tail.indexOf("overlay.style.opacity = '0'");
  assert.ok(iDone !== -1 && iFade !== -1, 'completion card must call onDone() and fade');
  assert.ok(iDone < iFade, 'completion-card onDone() must run before the fade-out');
  assert.match(tail, /try\s*\{\s*onDone\(\);?\s*\}\s*catch\s*\(e\)\s*\{\s*console\.error/);
});

test('F2 + R2: nav() is reduced-motion-guarded with a non-View-Transition fallback', () => {
  const nav = regionAfter('const doSwap = ()=>{', 1700);
  // reduced-motion is checked and short-circuits to an instant swap (no VT, no fade)
  assert.match(nav, /_navPrefersRM\s*=\s*window\.matchMedia\('\(prefers-reduced-motion:reduce\)'\)\.matches/);
  assert.match(nav, /if\(_navPrefersRM\)\{\s*doSwap\(\);/, 'RM users get an instant swap');
  // non-VT browsers get a CSS crossfade via screen-enter
  assert.match(nav, /document\.startViewTransition/);
  assert.match(nav, /classList\.add\('screen-enter'\)/, 'non-VT fallback must apply screen-enter crossfade');
  // the VT path must be INSIDE the !RM branch (RM must not get the unguarded VT crossfade)
  const iRM = nav.indexOf('if(_navPrefersRM)');
  const iVT = nav.indexOf('document.startViewTransition(doSwap)');
  assert.ok(iRM !== -1 && iVT !== -1 && iRM < iVT, 'View Transition must be gated behind the RM check');
});

test('F4: proceedToJudgment crossfades sema→scale and is reduced-motion-guarded', () => {
  const fn = regionAfter('proceedToJudgment(){', 700);
  assert.match(fn, /prefersRM\s*=\s*window\.matchMedia\('\(prefers-reduced-motion:reduce\)'\)\.matches/);
  assert.match(fn, /classList\.add\('judg-enter'\)/, 'must crossfade the judgment scene in');
  assert.match(fn, /if\(!prefersRM\)/, 'crossfade must be skipped under reduced motion');
});

test('F5: judgment score is hidden then revealed WITH the scale tip (RM = instant)', () => {
  const fn = regionAfter('_runJudgment(){', 3200);
  assert.match(fn, /_judgPrefersRM\s*=\s*window\.matchMedia\('\(prefers-reduced-motion:reduce\)'\)\.matches/);
  // hidden instantly (transition:none) unless RM (then shown)
  assert.match(fn, /el\.style\.opacity\s*=\s*_judgPrefersRM\s*\?\s*'1'\s*:\s*'0'/);
  // revealed inside the 800ms tilt/krackle timeout
  const iHide = fn.indexOf("_judgPrefersRM ? '1' : '0'");
  const iReveal = fn.indexOf("el.style.opacity = '1'");
  assert.ok(iHide !== -1 && iReveal !== -1 && iHide < iReveal, 'score must be hidden first, then revealed');
  assert.ok(fn.indexOf('}, 800)') > iReveal, 'the reveal must live inside the 800ms timeout');
});

test('CSS: graceful classes exist and are all prefers-reduced-motion-guarded (R2)', () => {
  assert.match(HTML, /\.screen\.screen-enter\{animation:fadeIn/);
  assert.match(HTML, /\.q-card\{animation:fadeUp/);
  assert.match(HTML, /#judgmentWrap\.judg-enter\{animation:fadeIn/);
  // a reduced-motion block neutralizes all three
  const rm = HTML.match(/@media\(prefers-reduced-motion:reduce\)\{[^}]*\.screen\.screen-enter[^}]*\}/);
  assert.ok(rm, 'a prefers-reduced-motion block must disable the new entry animations');
  assert.match(rm[0], /\.q-card/);
  assert.match(rm[0], /#judgmentWrap\.judg-enter/);
});

test('DRY: the new entry animations reuse existing keyframes (no duplicate definitions)', () => {
  // fadeIn / fadeUp are defined exactly once each; the new rules consume them.
  assert.equal((HTML.match(/@keyframes fadeIn\b/g) || []).length, 1, 'fadeIn defined once');
  assert.equal((HTML.match(/@keyframes fadeUp\b/g) || []).length, 1, 'fadeUp defined once');
});
