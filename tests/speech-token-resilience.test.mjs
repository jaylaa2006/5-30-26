// Azure speech-token resilience (2026-05-20 error-sweep hardening).
// Locks the retry + timeout + stale-fallback added after a transient
// `[speech-token] Error: fetch failed` killed TTS for a request. The route
// boots a server on import, so we assert against source (project convention).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const server = fs.readFileSync('server.js', 'utf8');
// Isolate the /api/speech-token handler body.
const start = server.indexOf("app.get('/api/speech-token'");
const end = server.indexOf('app.', start + 10);
const route = server.slice(start, end > start ? end : start + 4000);

test('speech-token fetch has an AbortController timeout (no hang)', () => {
  assert.match(route, /new AbortController\(\)/, 'must use AbortController');
  assert.match(route, /setTimeout\(\(\) => ctrl\.abort\(\), 6000\)/, 'must abort after 6s');
  assert.match(route, /signal: ctrl\.signal/, 'fetch must pass the abort signal');
  assert.match(route, /finally \{ clearTimeout\(timer\); \}/, 'timer must always be cleared');
});

test('speech-token retries once on transient failure, never on 4xx', () => {
  assert.match(route, /for \(let attempt = 1; attempt <= 2; attempt\+\+\)/, 'must allow 2 attempts');
  assert.match(route, /tokenRes\.status === 429 \|\| tokenRes\.status >= 500\)\) continue/,
    'retry only on 429 / 5xx (transient)');
  assert.match(route, /break; \/\/ 4xx/, '4xx (e.g. bad key) must NOT be retried');
});

test('speech-token serves a stale-but-valid cached token before failing', () => {
  assert.match(route, /fetchedAt: Date\.now\(\)/, 'cache must record fetchedAt');
  assert.match(route, /Date\.now\(\) - \(cached\.fetchedAt \|\| 0\)\) < 9 \* 60 \* 1000/,
    'stale fallback must only serve tokens still within Azure validity (~9 min)');
  assert.match(route, /stale: true/, 'stale response must be flagged');
});
