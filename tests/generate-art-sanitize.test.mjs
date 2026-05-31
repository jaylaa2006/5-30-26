// tests/generate-art-sanitize.test.mjs
// v3.44.x D3 hotfix regression — verifies /api/generate-art route sanitizes
// all user-controlled text fields (chunkText, storyTitle, principle, setting,
// previousContext) before they flow into the Imagen prompt.
//
// Per Agent C (Cultural Consensus voice): kid-safety is the highest-severity
// dimension — an attacker-supplied chunkText that gets baked into an Imagen
// prompt could produce kid-unsafe imagery saved to disk.
//
// This test is structural (source-grep) — it asserts the destructure pattern
// + sanitize call shape. A behavioral test would require booting seba-api +
// mocking Gemini Image, which is heavier than this fix warrants.

import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_SRC = readFileSync(resolve(__dirname, '..', 'seba-story-api.mjs'), 'utf8');

test('/api/generate-art — sanitizeUserInput applied to chunkText with cap 1000 (legacy path)', () => {
  // Post-v3.45.x Option-4 refactor: chunkText is assigned in two branches —
  // the token branch reads from verify.payload.ct (server-trusted), and the
  // legacy branch sanitizes rawBody.chunkText. Either form satisfies the
  // injection-defense contract.
  const pat = /chunkText\s*=\s*sanitizeUserInput\(\s*String\(rawBody\.chunkText[^)]*\)\s*,\s*1000\s*,/;
  assert.match(SERVER_SRC, pat,
    'legacy path of /api/generate-art must sanitize rawBody.chunkText with cap 1000');
});

test('/api/generate-art — sanitizeUserInput applied to storyTitle, principle, setting, previousContext', () => {
  // Accepts both `const X = sanitizeUserInput(...)` (old single-path form) and
  // `X = sanitizeUserInput(...)` (new dual-path reassign form).
  assert.match(SERVER_SRC, /\bstoryTitle\s*=\s*sanitizeUserInput\(/,
    'storyTitle must be sanitized');
  assert.match(SERVER_SRC, /\bprinciple\s*=\s*sanitizeUserInput\(/,
    'principle must be sanitized');
  assert.match(SERVER_SRC, /\bsetting\s*=\s*sanitizeUserInput\(/,
    'setting must be sanitized');
  assert.match(SERVER_SRC, /\bpreviousContext\s*=\s*sanitizeUserInput\(/,
    'previousContext must be sanitized');
});

test('/api/generate-art — no bare req.body.chunkText reference flows into buildArtPrompt', () => {
  // After destructure + sanitize, the call to buildArtPrompt must use the
  // sanitized local `chunkText`, never the raw rawBody.chunkText.
  // Find the buildArtPrompt call site and assert no rawBody / req.body chunkText
  // is passed.
  const m = SERVER_SRC.match(/buildArtPrompt\(([\s\S]*?)\);/);
  assert(m, 'buildArtPrompt call site must be findable');
  const argBlob = m[1];
  assert.doesNotMatch(argBlob, /rawBody\.chunkText/,
    'buildArtPrompt must NOT receive rawBody.chunkText (unsanitized)');
  assert.doesNotMatch(argBlob, /req\.body\.chunkText/,
    'buildArtPrompt must NOT receive req.body.chunkText (unsanitized)');
});

test('GEMINI_PER_IP_DAILY_CAP bumped from 40 to 80 (D2 classroom NAT)', () => {
  assert.match(SERVER_SRC, /const\s+GEMINI_PER_IP_DAILY_CAP\s*=\s*80\b/,
    'GEMINI_PER_IP_DAILY_CAP must be 80 (classroom NAT 2nd-eyes binding D2)');
});

console.log('[generate-art-sanitize] all assertions passed');
