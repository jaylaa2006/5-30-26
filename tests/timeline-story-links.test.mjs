#!/usr/bin/env node
// tests/timeline-story-links.test.mjs
// 2026-05-15 (v3.46.7) — pin the timeline event→story mapping.
//
// Bug fixed: the old resolver matched STORIES titles against the FIRST
// word of evt.tag, so any evt.tag starting with "the" (most of them)
// matched every story containing "the". Clicking "Read related story"
// under Imhotep's card opened an unrelated story.
//
// Fix: explicit `_timelineStoryMap` keyed by event title. Each entry is
// either `{ storyId: '...' }` (existing story) or `{ queued: '...' }`
// (queued for future generation; rendered as a "coming soon" chip).
//
// Run: node --test tests/timeline-story-links.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// STORIES was extracted to public/js/stories.js for perf (2026-05-23); read both so
// the _timelineStoryMap (HTML) + story-id literals (stories.js) both resolve.
const HTML = fs.readFileSync('maat-reader.html', 'utf8')
  + '\n' + fs.readFileSync('public/js/stories.js', 'utf8');

function extractAppLiteralValue(name) {
  const re = new RegExp('^\\s+' + name + ':\\s*', 'm');
  const m = HTML.match(re);
  if (!m) throw new Error('App property not found: ' + name);
  const start = m.index + m[0].length;
  let depth = 0, end = -1, inString = null, escaped = false;
  for (let i = start; i < HTML.length; i++) {
    const c = HTML[i];
    if (escaped) { escaped = false; continue; }
    if (inString) {
      if (c === '\\') escaped = true;
      else if (c === inString) inString = null;
      continue;
    }
    if (c === '"' || c === "'") { inString = c; continue; }
    if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  if (end < 0) throw new Error('could not extract value for: ' + name);
  return HTML.slice(start, end);
}

// ─── Map exists + has reasonable shape ────────────────────────────────────

test('_timelineStoryMap exists with storyId / queued entries', () => {
  assert.match(HTML, /_timelineStoryMap:\s*\{/,
    'must define _timelineStoryMap as an App property');
  const mapSrc = extractAppLiteralValue('_timelineStoryMap');
  // Spot-checks for KEEP-verdict mappings (story actually tells the event):
  assert.match(mapSrc, /'Nabta Playa Stone Circle Built':\s*\{\s*storyId:\s*'star-watchers-nabta-playa'/);
  assert.match(mapSrc, /'Hannibal Crosses the Mountains':\s*\{\s*storyId:\s*'hannibal-mountain-snow'/);
  assert.match(mapSrc, /'Kandake Amanirenas Defeats Rome':\s*\{\s*storyId:\s*'kandake-rome'/);
  // Post-v3.46.15: alexandria-library-founded story is now shipped — a
  // purpose-built story about the founding of the Library of Alexandria
  // and the Maat principle of correct attribution. Mapping flipped from
  // queued → storyId.
  assert.match(mapSrc, /'Library of Alexandria Founded':\s*\{\s*storyId:\s*'alexandria-library-founded'/,
    'Library of Alexandria event must now link to the shipped alexandria-library-founded story');
  assert.match(mapSrc, /'Aksum Shelters Early Muslims':\s*\{\s*storyId:\s*'aksum-shelters-early-muslims'/,
    'Aksum-shelters-early-muslims now links to the shipped story (Tier-1 #3)');
  // Post-v3.46.11: imhotep-first-genius story is now shipped. Mapping
  // flipped from queued → storyId. This was the first Tier-1 story
  // produced from the creation-queue spec.
  assert.match(mapSrc, /'Imhotep — First Genius in History':\s*\{\s*storyId:\s*'imhotep-first-genius'/,
    'Imhotep event must now link to the shipped imhotep-first-genius story');
  // Post-v3.46.15: Nok Culture + Wagadu Falls stories shipped. Mappings
  // flipped from queued → storyId.
  assert.match(mapSrc, /'Nok Culture Masters Iron in West Africa':\s*\{\s*storyId:\s*'nok-iron-masters'/,
    'Nok Culture event must now link to the shipped nok-iron-masters story');
  assert.match(mapSrc, /'Wagadu Falls, New Empires Rise':\s*\{\s*storyId:\s*'wagadu-falls-mali-rises'/,
    'Wagadu Falls event must now link to the shipped wagadu-falls-mali-rises story');
});

// ─── Every event title is in the map (no silent regression) ───────────────

test('every _timelineData event title has a _timelineStoryMap entry', () => {
  const dataSrc = extractAppLiteralValue('_timelineData');
  const titles = [...dataSrc.matchAll(/title:'((?:[^'\\]|\\.)+)'/g)]
    .map(m => m[1].replace(/\\'/g, "'"));
  assert.ok(titles.length >= 60, 'expected at least 60 timeline events, got ' + titles.length);

  const mapSrc = extractAppLiteralValue('_timelineStoryMap');
  const missing = [];
  for (const title of titles) {
    const esc = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Map keys may be single- or double-quoted (titles with straight
    // apostrophes use "double-quoted" keys to avoid escape pain).
    const re = new RegExp("['\"]" + esc + "['\"]:\\s*\\{");
    if (!re.test(mapSrc)) missing.push(title);
  }
  assert.deepEqual(missing, [],
    'every event title must be in _timelineStoryMap. Missing: ' + JSON.stringify(missing, null, 2));
});

// ─── Every storyId in the map points to a real STORIES entry ──────────────

test('every storyId in _timelineStoryMap points to a real story', () => {
  const mapSrc = extractAppLiteralValue('_timelineStoryMap');
  const storyIds = new Set(
    [...mapSrc.matchAll(/storyId:\s*'([a-z0-9-]+)'/g)].map(m => m[1])
  );
  // Floor lowered post-v3.46.9 audit: 10 loose mappings were flipped to
  // queued, leaving 18 verified-correct storyId links.
  assert.ok(storyIds.size >= 15, 'expected at least 15 mapped storyIds, got ' + storyIds.size);

  // Match story-literal entries; tolerate whitespace variants in the
  // source — `{id:'foo',title:`, `{id:'foo', title:`, etc.
  const existingIds = new Set(
    [...HTML.matchAll(/\{id:\s*'([a-z0-9-]+)'\s*,\s*title:/g)].map(m => m[1])
  );
  assert.ok(existingIds.size >= 100, 'expected ≥100 STORIES, got ' + existingIds.size);

  const orphans = [...storyIds].filter(id => !existingIds.has(id));
  assert.deepEqual(orphans, [],
    'every mapped storyId must resolve to a real story. Orphans: ' + JSON.stringify(orphans));
});

// ─── The broken first-word match is GONE ──────────────────────────────────

test('showTimelineDetail no longer uses the broken first-word match', () => {
  assert.doesNotMatch(HTML, /evt\.tag\.toLowerCase\(\)\.split\(' '\)\[0\]/,
    'the broken first-word substring match must be removed');
  assert.match(HTML, /this\._timelineStoryMap\[evt\.title\]/,
    'showTimelineDetail must look up _timelineStoryMap[evt.title]');
});

// ─── Render uses pure DOM construction (Rule 4) ───────────────────────────

test("showTimelineDetail render does NOT use linkDiv.innerHTML write (Rule 4)", () => {
  const idx = HTML.indexOf("showTimelineDetail(idx)");
  assert.ok(idx > 0, 'showTimelineDetail handler must exist');
  const next = HTML.indexOf('\n  closeTimelineDetail(', idx);
  const body = HTML.slice(idx, next > 0 ? next : idx + 4000);
  assert.doesNotMatch(body, /linkDiv\.innerHTML\s*=/,
    "linkDiv must be populated via createElement / appendChild, not innerHTML (Rule 4)");
  assert.match(body, /document\.createElement\('button'\)/,
    'must construct the Read-related-story button via createElement');
});

console.log('[timeline-story-links] all assertions passed');
