// Cloud-sync reliability fix (v3.51.x sync audit).
// Locks the monotonic deep-merge that replaced the blind-overwrite in
// /api/seba-sync, plus the client flush wiring (keepalive on tab-close) and the
// server flush rate-limit bypass. Root cause: progress never accumulated in the
// SQLite user_data blob because (a) a 30s debounce was cleared not flushed on
// tab-close, and (b) the server blind-overwrote, so a thin client clobbered it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  mergeUserData, unionArray, mergeMaxMap, mergeStoryTimes, maxNumOrRicher,
  capLogArrays, LOG_ARRAY_CAP,
} from '../lib/merge-user-data.mjs';

// ── Behavioral: the merge itself ────────────────────────────────────────────
test('accumulated counters never regress (the core anti-clobber guarantee)', () => {
  const existing = { name: 'A', wordsRead: 5000, ankhs: 40, scarabs: 12 };
  const thin     = { name: 'A', wordsRead: 0, ankhs: 0, scarabs: 0 }; // stale/fresh-device push
  const m = mergeUserData(existing, thin);
  assert.equal(m.wordsRead, 5000);
  assert.equal(m.ankhs, 40);
  assert.equal(m.scarabs, 12);
});

test('a near-empty client payload cannot wipe rich cloud progress', () => {
  const cloud = { name: 'A', storiesRead: ['s1','s2','s3'], grade: 5,
                  storyTimes: { s1: [{durationMs: 100}] }, scores: { s1: 90 } };
  const empty = { name: 'A' }; // fresh device, nothing read yet
  const m = mergeUserData(cloud, empty);
  assert.deepEqual(m.storiesRead, ['s1','s2','s3']);
  assert.equal(m.grade, 5);
  assert.equal(m.scores.s1, 90);
  assert.deepEqual(m.storyTimes.s1, [{durationMs: 100}]);
});

test('storiesRead unions without loss or duplication', () => {
  assert.deepEqual(unionArray(['a','b'], ['b','c']).sort(), ['a','b','c']);
  assert.deepEqual(unionArray([], ['x']), ['x']);
  assert.deepEqual(unionArray(['x'], []), ['x']);
});

test('scores / checkpointScores keep the best (max) per key', () => {
  const m = mergeMaxMap({ s1: 70, s2: 80 }, { s1: 95, s3: 50 });
  assert.equal(m.s1, 95); // improved
  assert.equal(m.s2, 80); // preserved
  assert.equal(m.s3, 50); // added
});

test('storyTimes keeps the richer per-story history', () => {
  const a = { s1: [{d:1}], s2: [{d:1},{d:2}] };
  const b = { s1: [{d:1},{d:2},{d:3}], s3: [{d:9}] };
  const m = mergeStoryTimes(a, b);
  assert.equal(m.s1.length, 3); // richer wins
  assert.equal(m.s2.length, 2); // preserved
  assert.equal(m.s3.length, 1); // added
});

test('a null/absent grade never wipes a known grade; a real grade updates', () => {
  assert.equal(mergeUserData({ grade: 4 }, { grade: null }).grade, 4);
  assert.equal(mergeUserData({ grade: 4 }, {}).grade, 4);
  assert.equal(mergeUserData({ grade: 4 }, { grade: 6 }).grade, 6);
});

test('powerWords as an array is unioned, not zeroed to 0', () => {
  // Defends the type-ambiguous field: array form must not collapse via Math.max.
  const m = mergeUserData({ powerWords: ['ankh','maat'] }, { powerWords: ['maat','ra'] });
  assert.ok(Array.isArray(m.powerWords));
  assert.deepEqual([...m.powerWords].sort(), ['ankh','maat','ra']);
  // numeric form still takes the max
  assert.equal(maxNumOrRicher(7, 3), 7);
});

test('mutable state is last-write-wins (lockout/settings/name)', () => {
  const m = mergeUserData(
    { name: 'Old', settings: { theme: 'a' }, lockout: { active: true } },
    { name: 'New', settings: { theme: 'b' }, lockout: { active: false } });
  assert.equal(m.name, 'New');
  assert.deepEqual(m.settings, { theme: 'b' });
  assert.equal(m.lockout.active, false);
});

test('resetProgress:true replaces wholesale (legitimate reset escape hatch)', () => {
  const m = mergeUserData({ wordsRead: 9999, storiesRead: ['a','b'] },
                          { wordsRead: 0, storiesRead: [], resetProgress: true });
  assert.equal(m.wordsRead, 0);
  assert.deepEqual(m.storiesRead, []);
});

test('a brand-new user (no existing row) writes their full state, still capped', () => {
  const big = Array.from({ length: LOG_ARRAY_CAP + 100 }, (_, i) => i);
  const m = mergeUserData(null, { name: 'A', wordsRead: 100, responseLog: big });
  assert.equal(m.name, 'A');
  assert.equal(m.wordsRead, 100);
  assert.equal(m.responseLog.length, LOG_ARRAY_CAP, 'new-user path must also cap logs');
});

// ── Blob-growth ceiling: cap non-analytics logs, preserve analytics fields ──
test('log arrays are capped to the most-recent tail; analytics fields are not', () => {
  const big = Array.from({ length: LOG_ARRAY_CAP + 250 }, (_, i) => i);
  const m = mergeUserData(
    { storiesRead: ['a'] },
    { responseLog: big, storyTimes: { s1: big.map(d => ({ d })) }, storiesRead: ['a','b'] });
  assert.equal(m.responseLog.length, LOG_ARRAY_CAP, 'responseLog capped');
  assert.equal(m.responseLog[0], 250, 'kept the most-recent tail (dropped oldest)');
  // storyTimes is analytics-critical → never capped.
  assert.equal(m.storyTimes.s1.length, LOG_ARRAY_CAP + 250, 'storyTimes must NOT be capped');
  assert.deepEqual(m.storiesRead.sort(), ['a','b']);
});

test('capLogArrays leaves object-shaped fields and small arrays alone', () => {
  const o = { responseLog: [1,2,3], questionHistory: { story1: [1,2] } };
  capLogArrays(o);
  assert.equal(o.responseLog.length, 3, 'small array untouched');
  assert.deepEqual(o.questionHistory, { story1: [1,2] }, 'object field untouched');
});

// ── Wiring: server route uses merge + flush bypass + strips transport flags ──
test('server /api/seba-sync merges (not overwrites) and honors flush bypass', () => {
  const api = fs.readFileSync('seba-story-api.mjs', 'utf8');
  assert.match(api, /import \{ mergeUserData \} from '\.\/lib\/merge-user-data\.mjs'/);
  assert.match(api, /mergeUserData\(existing, safeData\)/, 'must merge against existing, not overwrite');
  assert.match(api, /stmt\.updateUserData\.run\(JSON\.stringify\(merged\)/, 'must persist the merged blob');
  assert.match(api, /const isFlush = req\.body && req\.body\.flush === true/);
  // Deploy-gate hardening: flush skips the 10s limit but keeps a short floor.
  assert.match(api, /SYNC_FLUSH_FLOOR_MS = 2000/, 'flush must keep a 2s anti-abuse floor');
  assert.match(api, /const floor = isFlush \? SYNC_FLUSH_FLOOR_MS : SYNC_RATE_MS/,
    'flush must use the shorter floor, not bypass the limit entirely');
  assert.match(api, /if \(lastSync && Date\.now\(\) - lastSync < floor\)/, 'floor must be enforced');
  assert.match(api, /delete safeData\.flush/, 'flush flag must never be persisted');
  assert.match(api, /delete merged\.resetProgress/, 'resetProgress flag must never be persisted');
  // Blob-growth headroom: sync limit raised to 5mb.
  assert.match(api, /app\.post\('\/api\/seba-sync', express\.json\(\{ limit: '5mb' \}\)/,
    'seba-sync body limit must be 5mb');
});

// ── File-path removal: single source of truth (SQLite) ───────────────────────
test('server.js no longer defines the legacy file-progress endpoints', () => {
  const server = fs.readFileSync('server.js', 'utf8');
  assert.doesNotMatch(server, /app\.post\(['"]\/api\/user\/save/, '/api/user/save route removed');
  assert.doesNotMatch(server, /app\.get\(['"]\/api\/user\/load/, '/api/user/load route removed');
  assert.doesNotMatch(server, /USERS_DIR/, 'USERS_DIR + .user-data wiring removed');
});

test('client no longer dual-writes/reads the file path (single SQLite source)', () => {
  const html = fs.readFileSync('maat-reader.html', 'utf8');
  // The legacy methods + their callers are gone (only the explanatory comment remains).
  assert.doesNotMatch(html, /this\._googleSaveProgress\(\)/, 'no _googleSaveProgress calls');
  assert.doesNotMatch(html, /this\._googleLoadProgress\(\)/, 'no _googleLoadProgress calls');
  assert.doesNotMatch(html, /async _googleSaveProgress\(\)\{/, 'method definition removed');
  assert.doesNotMatch(html, /async _googleLoadProgress\(\)\{/, 'method definition removed');
  // _save still drives the SQLite sync.
  assert.match(html, /this\._syncToServer\(\);/, '_save must still call _syncToServer');
});

// ── Wiring: client debounce + keepalive flush on hide/unload ────────────────
test('client lowers debounce and flushes on tab-close via keepalive', () => {
  const html = fs.readFileSync('maat-reader.html', 'utf8');
  assert.match(html, /_SYNC_DEBOUNCE_MS:\s*8000/, 'debounce must drop from 30s to 8s');
  assert.match(html, /keepalive:\s*immediate/, 'flush must use keepalive (not sendBeacon — needs auth header)');
  assert.match(html, /flush:\s*immediate/, 'flush payload must be tagged for the server bypass');
  assert.match(html, /_syncFlush\(\)\s*\{/, 'must define a terminal _syncFlush');
  // Coach C4: dedup the visibilitychange:hidden → pagehide double-fire.
  assert.match(html, /now - this\._lastFlushAt\)\s*<\s*1500/, 'flush must dedup the hidden→pagehide pair');
  assert.match(html, /pagehide['"],\s*\(\)=>\{\s*if\(App\._syncFlush\)/, 'pagehide must flush');
  assert.match(html, /visibilitychange['"],\s*\(\)=>\{\s*if\(document\.hidden && App\._syncFlush\)/, 'hidden must flush');
  // beforeunload must flush BEFORE clearing the debounce timer.
  const idxFlush = html.indexOf('if(App._syncFlush) App._syncFlush();');
  const idxClear = html.indexOf('if(App._syncDebounceTimer) clearTimeout(App._syncDebounceTimer);');
  assert.ok(idxFlush > 0 && idxClear > 0 && idxFlush < idxClear,
    'beforeunload must flush before clearing the sync timer');
});
