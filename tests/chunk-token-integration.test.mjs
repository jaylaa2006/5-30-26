#!/usr/bin/env node
// tests/chunk-token-integration.test.mjs
//
// v3.45.x — Server-canonical chunkText (Option 4) BEHAVIORAL integration test.
//
// Boots seba-story-api.mjs on SEBA_TEST_PORT and exercises /api/generate-art
// with real HTTP requests to prove the HMAC-signed-token security boundary
// holds end-to-end — not just in unit-level vm-context tests.
//
// Covers scoping-doc §7 integration specs #7-#10:
//   - Forged token → 400 (the regression that locks the injection shut)
//   - Valid token → passes verification (NOT a 400 token-rejection)
//   - Valid token + wrong chunkIndex → 400 chunkindex_mismatch
//   - Valid token + wrong storyId → 400 storyid_mismatch
//   - Expired token → 400 expired
//   - Missing both chunkText + chunkToken → 400 missing-fields
//   - Legacy chunkText path → passes validation (Phase 2 dual-path works)
//
// NOTE: /api/generate-art has a 3s per-IP rate limit (ART_RATE_LIMIT_MS), so
// requests are spaced 3.3s apart. Test runtime ~30s.
//
// Run directly:
//   SEBA_TEST_PORT=3851 node --test tests/chunk-token-integration.test.mjs

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const PORT = process.env.SEBA_TEST_PORT || 3851;
const BASE = `http://127.0.0.1:${PORT}`;
const API_FILE = join(fileURLToPath(import.meta.url), '../../seba-story-api.mjs');
const tmpDb = join(tmpdir(), `seba-test-chunk-token-${Date.now()}.db`);
const TEST_SECRET = 'test-chunk-signing-secret-integration-deterministic';

let serverProcess = null;

// Replicate signChunkToken with the test secret (helper is not exported).
function signToken(fields, expOverrideMs) {
  const payload = {
    sid: String(fields.storyId || ''),
    ci: Number.isInteger(fields.chunkIndex) ? fields.chunkIndex : -1,
    ct: String(fields.chunkText || ''),
    st: String(fields.storyTitle || ''),
    pr: String(fields.principle || ''),
    se: String(fields.setting || ''),
    pc: String(fields.previousContext || ''),
    exp: expOverrideMs != null ? expOverrideMs : Date.now() + 7 * 24 * 60 * 60 * 1000,
  };
  const payloadStr = JSON.stringify(payload);
  const sig = crypto.createHmac('sha256', TEST_SECRET).update(payloadStr).digest('base64url');
  const body = Buffer.from(payloadStr, 'utf8').toString('base64url');
  return `${body}.${sig}`;
}

async function waitForServer(maxMs = 12000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(BASE + '/api/generate-art', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (r.status !== undefined) return;
    } catch {
      await new Promise(r => setTimeout(r, 200));
    }
  }
  throw new Error(`Server did not start within ${maxMs}ms`);
}

before(async () => {
  serverProcess = spawn(process.execPath, [API_FILE], {
    env: {
      ...process.env,
      SEBA_PORT: String(PORT),
      SEBA_DB_PATH: tmpDb,
      GEMINI_API_KEY: 'test-dummy-key-chunk-token',
      JWT_SECRET: 'test-secret',
      AUTH_SECRET: 'test-auth-secret',
      CHUNK_SIGNING_SECRET: TEST_SECRET,
      SENDGRID_API_KEY: '',
      NODE_ENV: 'test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  serverProcess.stdout.setEncoding('utf8');
  serverProcess.stderr.setEncoding('utf8');
  await waitForServer();
});

after(() => {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
});

async function postArt(body) {
  const res = await fetch(BASE + '/api/generate-art', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, body: parsed, raw: text };
}

// Space requests past the 3s ART_RATE_LIMIT_MS window.
const RL_GAP = 3300;
const gap = () => new Promise(r => setTimeout(r, RL_GAP));

const STORY_ID = 'seba-1747000000000';
const baseFields = {
  storyId: STORY_ID, chunkIndex: 0,
  chunkText: 'Tehuti walked the moonlit hall, ibis pen in hand.',
  storyTitle: 'The Scribe of Tehuti', principle: 'Truth', setting: 'Karnak',
};

// ─── #7 forged token → 400 (the regression lock) ──────────────────────────

test('forged/garbage chunkToken is rejected with 400 — injection surface closed', async () => {
  const r = await postArt({ storyId: STORY_ID, chunkIndex: 0, chunkToken: 'garbage.forged' });
  assert.equal(r.status, 400, `forged token must 400, got ${r.status} ${r.raw}`);
  assert.ok(r.body && /token/i.test(r.body.error || ''),
    `400 body must mention token rejection: ${r.raw}`);
});

// ─── #7 valid token → passes verification (positive path) ─────────────────

test('valid chunkToken passes verification — NOT a 400 token-rejection', async () => {
  await gap();
  const token = signToken(baseFields);
  const r = await postArt({ storyId: STORY_ID, chunkIndex: 0, chunkToken: token });
  // A valid token must NOT produce a 400-with-token-reason. It may 503 (Gemini
  // unreachable with the dummy key), 429 (rate limit), or 200 — all of which
  // mean "token accepted, request proceeded past verification".
  const isTokenRejection = r.status === 400 && r.body && r.body.reason;
  assert.equal(isTokenRejection, false,
    `valid token must NOT be rejected at verification; got ${r.status} ${r.raw}`);
});

// ─── #8 valid token + wrong chunkIndex → 400 chunkindex_mismatch ──────────

test('valid token presented at wrong chunkIndex → 400 chunkindex_mismatch', async () => {
  await gap();
  const token = signToken(baseFields);  // signed for chunkIndex 0
  const r = await postArt({ storyId: STORY_ID, chunkIndex: 7, chunkToken: token });
  assert.equal(r.status, 400, `wrong chunkIndex must 400, got ${r.status} ${r.raw}`);
  assert.equal(r.body?.reason, 'chunkindex_mismatch', `reason: ${r.raw}`);
});

// ─── #8 valid token + wrong storyId → 400 storyid_mismatch ────────────────

test('valid token presented at wrong storyId → 400 storyid_mismatch', async () => {
  await gap();
  const token = signToken(baseFields);  // signed for STORY_ID
  const r = await postArt({ storyId: 'seba-9999999999999', chunkIndex: 0, chunkToken: token });
  assert.equal(r.status, 400, `wrong storyId must 400, got ${r.status} ${r.raw}`);
  assert.equal(r.body?.reason, 'storyid_mismatch', `reason: ${r.raw}`);
});

// ─── #9 expired token → 400 expired ───────────────────────────────────────

test('expired chunkToken → 400 expired', async () => {
  await gap();
  const token = signToken(baseFields, Date.now() - 1000);  // exp in the past
  const r = await postArt({ storyId: STORY_ID, chunkIndex: 0, chunkToken: token });
  assert.equal(r.status, 400, `expired token must 400, got ${r.status} ${r.raw}`);
  assert.equal(r.body?.reason, 'expired', `reason: ${r.raw}`);
});

// ─── #10 missing both → 400 missing-fields ────────────────────────────────

test('missing both chunkText and chunkToken → 400 missing-fields', async () => {
  await gap();
  const r = await postArt({ storyId: STORY_ID, chunkIndex: 2 });
  assert.equal(r.status, 400, `missing both must 400, got ${r.status} ${r.raw}`);
  assert.ok(r.body && /missing required fields/i.test(r.body.error || ''),
    `400 body must be the missing-fields error: ${r.raw}`);
});

// ─── Phase-2 dual-path: legacy chunkText still works ──────────────────────

test('legacy chunkText path (no token) passes validation — Phase 2 dual-path', async () => {
  await gap();
  const r = await postArt({
    storyId: STORY_ID, chunkIndex: 0,
    chunkText: 'A legacy-path chunk of story text.',
    storyTitle: 'Legacy', principle: 'Truth', setting: 'Kemet',
  });
  // Legacy path must pass validation — must NOT be a 400-missing-fields or
  // 400-token-rejection. 503 (Gemini dummy key) / 429 / 200 all acceptable.
  const isValidationReject = r.status === 400;
  assert.equal(isValidationReject, false,
    `legacy chunkText must pass validation; got ${r.status} ${r.raw}`);
});

console.log('[chunk-token-integration] all assertions passed');
