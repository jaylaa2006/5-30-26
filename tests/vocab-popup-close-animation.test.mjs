// tests/vocab-popup-close-animation.test.mjs — v3.51.33
//
// Contract: vocab popup CLOSE has symmetric animation to OPEN, with
// prefers-reduced-motion respected and a fallback for animationend
// non-fire (tab background, detached element).
//
// The OPEN side (`.vocab-popup.show` → `popIn` 250ms spring) shipped in
// v3.40.x. The CLOSE side was jump-cut until v3.51.33 — this test locks
// the new behavior so a future "simplification" doesn't re-introduce
// the jump-cut.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('maat-reader.html', 'utf8');

test('CSS: popOut keyframe defined', () => {
  assert.match(html, /@keyframes\s+popOut\s*\{/);
});

test('CSS: .vocab-popup.show.closing applies popOut animation', () => {
  assert.match(
    html,
    /\.vocab-popup\.show\.closing\s*\{[^}]*animation:\s*popOut/,
    'expected .vocab-popup.show.closing to use popOut animation'
  );
});

test('CSS: .vocab-popup.show.closing disables pointer-events during close', () => {
  assert.match(
    html,
    /\.vocab-popup\.show\.closing\s*\{[^}]*pointer-events:\s*none/,
    'closing popup must not accept further interaction'
  );
});

test('CSS: prefers-reduced-motion disables both popIn and popOut', () => {
  // Spec is permissive: any @media (prefers-reduced-motion:reduce) block
  // that selects .vocab-popup.show and includes animation:none.
  const reducedRe = /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[^}]*\.vocab-popup\.show[^}]*animation:\s*none/;
  assert.match(html, reducedRe, 'prefers-reduced-motion must set animation:none on vocab popup');
});

test('JS: closeVocab adds .closing class (not just removes .show)', () => {
  // Locate the closeVocab function body; assert it references .closing.
  const fnRe = /closeVocab\s*\(\)\s*\{[\s\S]*?\n\s{2,4}\},/;
  const m = html.match(fnRe);
  assert.ok(m, 'closeVocab() function body not found');
  assert.match(m[0], /classList\.add\(['"]closing['"]\)/, 'closeVocab must add .closing for the animation');
});

test('JS: closeVocab listens for animationend to clean up classes', () => {
  const fnRe = /closeVocab\s*\(\)\s*\{[\s\S]*?\n\s{2,4}\},/;
  const m = html.match(fnRe);
  assert.ok(m);
  assert.match(m[0], /animationend/, 'closeVocab must listen for animationend');
  assert.match(m[0], /classList\.remove\(['"]show['"],\s*['"]closing['"]\)/, 'must clear both .show and .closing on finish');
});

test('JS: closeVocab honors prefers-reduced-motion (instant close)', () => {
  const fnRe = /closeVocab\s*\(\)\s*\{[\s\S]*?\n\s{2,4}\},/;
  const m = html.match(fnRe);
  assert.ok(m);
  assert.match(m[0], /prefers-reduced-motion/, 'closeVocab must check prefers-reduced-motion');
});

test('JS: closeVocab has setTimeout fallback for animationend non-fire', () => {
  const fnRe = /closeVocab\s*\(\)\s*\{[\s\S]*?\n\s{2,4}\},/;
  const m = html.match(fnRe);
  assert.ok(m);
  assert.match(m[0], /setTimeout\(/, 'closeVocab must have setTimeout fallback');
});

test('JS: closeVocab runs focus + handler cleanup BEFORE animation (a11y)', () => {
  // Focus restore + ESC/trap handler removal must appear before the
  // animation block, so keyboard users don't lose ESC during the 180ms.
  const fnRe = /closeVocab\s*\(\)\s*\{[\s\S]*?\n\s{2,4}\},/;
  const m = html.match(fnRe);
  assert.ok(m);
  const body = m[0];
  const focusIdx = body.indexOf('_vocabOpener');
  const escIdx = body.indexOf('_vocabEscHandler');
  const closingIdx = body.indexOf("'closing'");
  assert.ok(focusIdx >= 0 && focusIdx < closingIdx, 'focus restore must precede .closing add');
  assert.ok(escIdx >= 0 && escIdx < closingIdx, 'ESC handler cleanup must precede .closing add');
});

test('JS: showVocabPopup clears .closing on re-open (re-entry safety)', () => {
  // If user clicks vocab again while a previous close is animating, the
  // new open must clear the .closing residue so pointer-events come back.
  // Look for the function definition (showVocabPopup followed by `(` then
  // `{`), not the comment reference at line 5267.
  const fnRe = /\bshowVocabPopup\s*\([^)]*\)\s*\{/;
  const m = html.match(fnRe);
  assert.ok(m, 'showVocabPopup function definition not found');
  // Look at the next ~3000 chars from the function body for the residue-clear.
  const slice = html.slice(m.index, m.index + 3000);
  assert.match(slice, /classList\.remove\(['"]closing['"]\)/, 'showVocabPopup must clear .closing on re-open');
});
