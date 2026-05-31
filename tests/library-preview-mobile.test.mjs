// Library intro-preview mobile/iPad contract (v3.51.69).
//
// Audit found the "YouTube-style" library intro preview was dead on iOS:
//   M2 (iPad/iPhone) — _loadLibraryFeaturedVideo gated play() SOLELY on the
//      'canplay' event, which iOS Safari does not reliably fire with
//      preload="metadata"; the preview never played (poster only).
//   M1 (phone) — a phone tap (≤600px) called openStory() directly and never
//      invoked featureStory(), so the preview never even rendered on phones.
//
// Source-contract assertions (project idiom): verify the iOS-robust play
// trigger and the phone feature-then-open behavior are present.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HTML = readFileSync(join(__dirname, '..', 'maat-reader.html'), 'utf8');

function regionAfter(marker, len) {
  const i = HTML.indexOf(marker);
  assert.notEqual(i, -1, `marker not found: ${marker}`);
  return HTML.slice(i, i + len);
}

test('M2: library featured video keeps the iOS-required inline-autoplay attrs', () => {
  const fn = regionAfter('_loadLibraryFeaturedVideo(story, storyIdx){', 4600);
  assert.match(fn, /vid\.muted\s*=\s*true/);
  assert.match(fn, /vid\.playsInline\s*=\s*true/);
  assert.match(fn, /setAttribute\('webkit-playsinline'/);
});

test('M2: play() is NOT gated solely on canplay (iOS fix)', () => {
  const fn = regionAfter('_loadLibraryFeaturedVideo(story, storyIdx){', 4600);
  // a reusable tryPlay() exists and is wired to loadeddata (not just canplay)
  assert.match(fn, /const tryPlay\s*=\s*\(\)=>/, 'tryPlay() helper must exist');
  assert.match(fn, /addEventListener\('loadeddata',\s*tryPlay\)/, 'must listen on loadeddata, not just canplay');
  assert.match(fn, /addEventListener\('canplay',\s*tryPlay\)/);
  // a direct play attempt + load() that does not depend on canplay firing
  assert.match(fn, /vid\.load\(\)/, 'must call vid.load() to kick iOS buffering');
  // the standalone direct tryPlay() call comes AFTER append + load()
  const iAppend = fn.indexOf('thumb.appendChild(vid)');
  const iLoad = fn.indexOf('try { vid.load()');  // real call site, not the comment mention
  assert.ok(iAppend !== -1 && iLoad !== -1, 'append + load() present');
  assert.ok(iAppend < iLoad, 'order: append → load()');
  // a standalone tryPlay(); follows load() (whitespace-robust)
  assert.match(fn, /vid\.load\(\);[\s\S]{0,160}\n\s*tryPlay\(\);/, 'a direct tryPlay() must follow vid.load()');
  // idempotency guard so the direct call + events do not double-play
  assert.match(fn, /let _played\s*=\s*false/);
  assert.match(fn, /if\(_played\)\s*return/);
});

test('M1: phone tap previews first (featureStory), opens only when already featured', () => {
  const fn = regionAfter('App._tapWithDebounce(card, () => {', 1400);
  // phone, not-yet-featured → featureStory + scroll the panel into view
  assert.match(fn, /if \(isMobile && App\._libraryFeaturedIdx !== i\)/);
  assert.match(fn, /App\.featureStory\(i\)/);
  assert.match(fn, /getElementById\('libraryFeatured'\)[\s\S]*scrollIntoView/);
  // phone, already-featured → openStory
  assert.match(fn, /else if \(isMobile\)\s*\{\s*App\.openStory\(i\)/);
  // telemetry distinguishes feature vs open
  assert.match(fn, /action:\s*willOpen\s*\?\s*'open'\s*:\s*'feature'/);
});

test('M1: desktop behavior unchanged (tap features)', () => {
  const fn = regionAfter('App._tapWithDebounce(card, () => {', 1400);
  // the trailing else (desktop) features
  assert.match(fn, /\}\s*else\s*\{\s*App\.featureStory\(i\);\s*\}/);
});
