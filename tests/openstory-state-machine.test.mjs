#!/usr/bin/env node
// v3.43.4 — openStory state-machine regression test (Voice 8 Test-coverage
// binding from the v3.43.x round-table).
//
// The v3.43.2 hotfix closed a re-entry race in the openStory state machine.
// The fix has FOUR coordinated parts; this test locks each in via source
// pattern matching so a future refactor can't quietly regress one part:
//
//   1. `_readerActive` latch — set in enterReader AFTER render, blocks re-entry
//   2. `pointerEvents = 'none'` on fading overlay — blocks ghost-clicks
//   3. Latch cleared on nav() to any non-reader screen
//   4. `_provocationOnceCalled` idempotent guard in _showSemaProvocation
//
// A jsdom integration test would be stronger, but the file is ~37k lines
// with side-effectful inline scripts that don't load cleanly in jsdom.
// Source-pattern lock catches structural regression with O(ms) test runtime.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('maat-reader.html', 'utf8');

test('openStory has _readerActive guard at top', () => {
  // Guard must come BEFORE the provocation-shown branch — otherwise a tap
  // during ghost-click window would still go through provocation.
  const m = html.match(/openStory\(idx\)\{[\s\S]{0,600}?if\s*\(this\._readerActive\)\s*\{[^}]*return;[^}]*\}/);
  assert.ok(m, '_readerActive guard must appear at top of openStory(idx) — before _provocationShown branch');
});

test('enterReader sets _readerActive = true AFTER render', () => {
  // The latch must be set AFTER renderChunk()/renderFullStory()/renderComicPage()
  // so a re-entry during the render itself is still blocked.
  const enterReaderIdx = html.indexOf('const enterReader = ()=>{');
  assert.notEqual(enterReaderIdx, -1, 'enterReader arrow function present');
  const enterReaderBody = html.slice(enterReaderIdx, enterReaderIdx + 1500);
  const renderIdx = enterReaderBody.search(/this\.(renderChunk|renderFullStory|renderComicPage)\(\)/);
  const latchIdx = enterReaderBody.indexOf('this._readerActive = true');
  assert.notEqual(renderIdx, -1, 'enterReader contains a render call');
  assert.notEqual(latchIdx, -1, 'enterReader sets _readerActive = true');
  assert.ok(latchIdx > renderIdx, 'latch must be set AFTER render — found latch at ' + latchIdx + ', render at ' + renderIdx);
});

test('nav() clears _readerActive when leaving reader', () => {
  // Match: in `nav(screen, payload){...}`, an early branch must clear the latch
  // when navigating to a non-reader screen.
  const navIdx = html.indexOf('nav(screen, payload){');
  assert.notEqual(navIdx, -1, 'nav(screen, payload) function present');
  const navBody = html.slice(navIdx, navIdx + 800);
  assert.match(navBody, /screen\s*!==?\s*['"]reader['"]\s*\)\s*this\._readerActive\s*=\s*false/,
    'nav() must clear _readerActive on non-reader screens');
});

test('finish() sets overlay.style.pointerEvents = "none" before fade', () => {
  // Locate the video-overlay finish closure
  const finishIdx = html.indexOf('const finish = ()=>{');
  assert.notEqual(finishIdx, -1, 'finish() closure present');
  // v3.51.68 — widened from 600 to 1600: the F1 graceful-transition reorder added
  // an explanatory comment block before overlay.remove(); the ordering invariant
  // below (pointerEvents disabled before the remove) is unchanged.
  const finishBody = html.slice(finishIdx, finishIdx + 1600);
  assert.match(finishBody, /overlay\.style\.pointerEvents\s*=\s*['"]none['"]/,
    'finish() must set pointer-events: none on the fading overlay');
  // Order: pointer-events disable BEFORE the 350ms setTimeout(remove)
  const peIdx = finishBody.indexOf("pointerEvents = 'none'");
  const removeIdx = finishBody.indexOf('overlay.remove()');
  assert.ok(peIdx !== -1 && removeIdx !== -1 && peIdx < removeIdx,
    'pointerEvents must be set BEFORE the setTimeout(overlay.remove)');
});

test('_showSemaProvocation has idempotent onComplete (_provocationOnceCalled)', () => {
  const provIdx = html.indexOf('async _showSemaProvocation(storyIdx, onComplete)');
  assert.notEqual(provIdx, -1, '_showSemaProvocation present');
  // Slice through the function body — locate next sibling method as the end.
  // Use `},\n  openStory(idx){` as the boundary marker — _showSemaProvocation's
  // next sibling on the App object.
  const provEnd = html.indexOf('openStory(idx){', provIdx);
  const provBody = html.slice(provIdx, provEnd > provIdx ? provEnd : provIdx + 5000);
  assert.match(provBody, /_provocationOnceCalled\s*=\s*false/,
    'idempotent guard variable initialised');
  assert.match(provBody, /safeOnComplete\s*=\s*\(\)\s*=>\s*\{[^}]*_provocationOnceCalled/,
    'safeOnComplete wrapper checks the guard');
  // Both the click handler and the autoTimer must use safeOnComplete.
  // Find the line containing each binding and assert it includes safeOnComplete.
  const btnLine = provBody.split('\n').find(l => /btn\.onclick\s*=/.test(l));
  const timerLine = provBody.split('\n').find(l => /setTimeout\(.*?overlay\.remove/.test(l));
  assert.ok(btnLine, 'btn.onclick assignment line found');
  assert.ok(timerLine, 'setTimeout(...) autoTimer line found');
  assert.match(btnLine, /safeOnComplete/, 'btn.onclick must call safeOnComplete (not raw onComplete)');
  assert.match(timerLine, /safeOnComplete/, 'autoTimer must call safeOnComplete (not raw onComplete)');
});

test('openStory blocks re-entry with structured warn log', () => {
  // The block path must console.warn — silent return is the v3.43.0
  // anti-pattern that prevented diagnosis.
  const m = html.match(/openStory\(idx\)\{[\s\S]{0,800}?if\s*\(this\._readerActive\)\s*\{([^}]+)\}/);
  assert.ok(m, 'reader-active guard block matched');
  assert.match(m[1], /console\.warn/,
    'guard must console.warn — silent return prohibited (v3.43.0 anti-pattern)');
});
