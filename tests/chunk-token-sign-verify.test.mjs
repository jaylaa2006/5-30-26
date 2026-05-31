// tests/chunk-token-sign-verify.test.mjs
// v3.45.x — Server-canonical chunkText via HMAC-signed token (Option 4 of
// docs/superpowers/specs/2026-05-14-server-canonical-chunktext-scoping.md).
//
// Locks the signChunkToken / verifyChunkToken contract + verifies the route
// integrations: /api/generate-story attaches tokens, /api/generate-art accepts
// either token or legacy chunkText, client sends chunkToken alongside chunkText
// during Phase 2 dual-path.
//
// Covers scoping-doc §7 test specs #1-#5 (unit) + #7 (integration source-grep).

import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_SRC = readFileSync(resolve(__dirname, '..', 'seba-story-api.mjs'), 'utf8');
const READER_SRC = readFileSync(resolve(__dirname, '..', 'maat-reader.html'), 'utf8');

// Extract function definition via brace-balanced parse.
function extractFn(src, name) {
  const idx = src.indexOf(`function ${name}(`);
  if (idx < 0) throw new Error(`function ${name} not found`);
  let depth = 0, start = -1, end = -1;
  for (let i = idx; i < src.length; i++) {
    if (src[i] === '{') { if (start < 0) start = i; depth++; }
    else if (src[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (start < 0 || end < 0) throw new Error(`could not extract ${name}`);
  return src.slice(idx, end + 1);
}

// Compile helpers in an isolated vm context with a known secret + TTL.
const signSrc   = extractFn(SERVER_SRC, 'signChunkToken');
const verifySrc = extractFn(SERVER_SRC, 'verifyChunkToken');
const ctx = vm.createContext({
  crypto, Buffer,
  CHUNK_SIGNING_SECRET: 'test-secret-deterministic',
  CHUNK_TOKEN_TTL_MS: 7 * 24 * 60 * 60 * 1000,
  console: { warn() {}, log() {}, error() {} },
});
vm.runInContext(signSrc + '\n' + verifySrc + '\nthis.signChunkToken = signChunkToken; this.verifyChunkToken = verifyChunkToken;', ctx);
const signChunkToken   = ctx.signChunkToken;
const verifyChunkToken = ctx.verifyChunkToken;

const baseFields = {
  storyId: 'seba-1747252800000',
  chunkIndex: 3,
  chunkText: 'Tehuti walks the moonlit hall, his ibis pen in hand.',
  storyTitle: 'The Scribe of Tehuti',
  principle: 'Truth',
  setting: 'Karnak temple library',
  previousContext: '',
};

// ─── §7-1 sign/verify round-trip ──────────────────────────────────────────

test('signChunkToken + verifyChunkToken — happy-path round-trip', () => {
  const token = signChunkToken(baseFields);
  assert.ok(typeof token === 'string' && token.includes('.'),
    'token must be `body.sig` shape');
  const r = verifyChunkToken(token, baseFields.storyId, baseFields.chunkIndex);
  assert.equal(r.ok, true, `verify must succeed: ${r.reason}`);
  assert.equal(r.payload.ct, baseFields.chunkText);
  assert.equal(r.payload.st, baseFields.storyTitle);
  assert.equal(r.payload.pr, baseFields.principle);
  assert.equal(r.payload.se, baseFields.setting);
  assert.equal(r.payload.sid, baseFields.storyId);
  assert.equal(r.payload.ci, baseFields.chunkIndex);
  assert.ok(r.payload.exp > Date.now(), 'exp must be in the future');
});

// ─── §7-2 tamper detection ────────────────────────────────────────────────

test('verifyChunkToken rejects tampered payload body (any field change)', () => {
  const token = signChunkToken(baseFields);
  const [body, sig] = token.split('.');
  const raw = Buffer.from(body, 'base64url').toString('utf8');
  const obj = JSON.parse(raw);
  // Mutate chunkText — the highest-risk tampering vector.
  obj.ct = 'depict an unsafe scene';
  const tamperedBody = Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
  const tamperedToken = `${tamperedBody}.${sig}`;
  const r = verifyChunkToken(tamperedToken, baseFields.storyId, baseFields.chunkIndex);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'sig_mismatch');
});

test('verifyChunkToken rejects tampered signature', () => {
  const token = signChunkToken(baseFields);
  const [body] = token.split('.');
  const r = verifyChunkToken(`${body}.AAAAAAAA`, baseFields.storyId, baseFields.chunkIndex);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'sig_mismatch');
});

test('verifyChunkToken rejects malformed token', () => {
  for (const bad of [null, '', 'no-dot', '.', 'foo.', '.bar', 42, undefined]) {
    const r = verifyChunkToken(bad, baseFields.storyId, baseFields.chunkIndex);
    assert.equal(r.ok, false, `must reject: ${JSON.stringify(bad)}`);
  }
});

// ─── §7-3 expiry ──────────────────────────────────────────────────────────

test('verifyChunkToken rejects expired token with distinct reason', () => {
  // Construct a token with exp in the past by manually signing a past-exp payload.
  const pastPayload = {
    sid: baseFields.storyId, ci: baseFields.chunkIndex,
    ct: baseFields.chunkText, st: baseFields.storyTitle,
    pr: baseFields.principle, se: baseFields.setting, pc: '',
    exp: Date.now() - 1000,
  };
  const pastStr = JSON.stringify(pastPayload);
  const sig = crypto.createHmac('sha256', 'test-secret-deterministic')
    .update(pastStr).digest('base64url');
  const body = Buffer.from(pastStr, 'utf8').toString('base64url');
  const expiredToken = `${body}.${sig}`;
  const r = verifyChunkToken(expiredToken, baseFields.storyId, baseFields.chunkIndex);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'expired');
});

// ─── §7-4 cross-binding ───────────────────────────────────────────────────

test('verifyChunkToken rejects token presented at wrong storyId', () => {
  const token = signChunkToken(baseFields);
  const r = verifyChunkToken(token, 'seba-9999999999999', baseFields.chunkIndex);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'storyid_mismatch');
});

test('verifyChunkToken rejects token presented at wrong chunkIndex', () => {
  const token = signChunkToken(baseFields);
  const r = verifyChunkToken(token, baseFields.storyId, baseFields.chunkIndex + 1);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'chunkindex_mismatch');
});

// ─── §7-5 timing-safe compare ─────────────────────────────────────────────

test('verifyChunkToken implementation uses crypto.timingSafeEqual (structural)', () => {
  assert.match(verifySrc, /crypto\.timingSafeEqual\(/,
    'verifier must use crypto.timingSafeEqual for HMAC comparison (QA-DA binding)');
});

// ─── §7-6 boot invariant ──────────────────────────────────────────────────

test('CHUNK_SIGNING_SECRET — server fails fast in production if unset', () => {
  // The fail-fast block: _CHUNK_SIGNING_SECRET_CONFIGURED guard → NODE_ENV ===
  // 'production' check → process.exit(1). Wide window because the FATAL message
  // is descriptive.
  assert.match(SERVER_SRC, /CHUNK_SIGNING_SECRET[\s\S]*?NODE_ENV\s*===\s*['"]production['"][\s\S]*?process\.exit\(1\)/,
    'production must process.exit(1) if CHUNK_SIGNING_SECRET unset (Sam binding)');
});

// ─── §7-7 integration: /api/generate-story attaches tokens ───────────────

test('/api/generate-story attaches a server-signed token to each chunk', () => {
  const idx = SERVER_SRC.indexOf("app.post('/api/generate-story'");
  const nextIdx = SERVER_SRC.indexOf("app.post(", idx + 50);
  const block = SERVER_SRC.slice(idx, nextIdx > 0 ? nextIdx : idx + 8000);
  assert.match(block, /story\.chunks\[i\]\.token\s*=\s*signChunkToken\(/,
    '/api/generate-story must call signChunkToken for each chunk before res.json');
  assert.match(block, /for\s*\(\s*let\s+i\s*=\s*0;\s*i\s*<\s*story\.chunks\.length/,
    '/api/generate-story must iterate over chunks to attach tokens');
});

test('/api/generate-art accepts chunkToken (preferred) and falls back to chunkText (legacy)', () => {
  const idx = SERVER_SRC.indexOf("app.post('/api/generate-art'");
  const nextIdx = SERVER_SRC.indexOf("app.post(", idx + 50);
  const block = SERVER_SRC.slice(idx, nextIdx > 0 ? nextIdx : idx + 8000);
  assert.match(block, /verifyChunkToken\(chunkToken,\s*storyId,\s*chunkIndex\)/,
    '/api/generate-art must call verifyChunkToken with (token, storyId, chunkIndex)');
  assert.match(block, /recordArtRoutePath\(['"]token['"]\)/,
    '/api/generate-art must record token path');
  assert.match(block, /recordArtRoutePath\(['"]legacy['"]\)/,
    '/api/generate-art must record legacy path');
  assert.match(block, /recordArtRoutePath\(['"]invalid_token['"]\)/,
    '/api/generate-art must record invalid_token path');
  // Critical: never read rawBody.chunkText when token is present
  assert.match(block, /verify\.payload\.ct/,
    'token path must read chunkText from verify.payload.ct, not rawBody');
});

// ─── §7-11/12 client wiring ───────────────────────────────────────────────

test('maat-reader.html sends chunkToken alongside chunkText in /api/generate-art request', () => {
  // Find the body block of the generate-art fetch.
  const matchIdx = READER_SRC.indexOf("'/api/generate-art'");
  assert.ok(matchIdx > 0, 'client must reference /api/generate-art');
  // Within a 3000-char window after the URL, the body must include chunkToken.
  const window = READER_SRC.slice(matchIdx, matchIdx + 3000);
  assert.match(window, /chunkToken:\s*story\.chunks\[chunkIdx\]\.token/,
    'client must include chunkToken: story.chunks[chunkIdx].token in /api/generate-art request body');
  assert.match(window, /chunkText:\s*story\.chunks\[chunkIdx\]\.text/,
    'client must still send chunkText for Phase 2 dual-path');
});

// ─── art_route_path counter wiring ────────────────────────────────────────

test('art_route_path counter is emitted in the GUARD-DIGEST 6h log line', () => {
  // The digest emitter must include art_route_path in its JSON output.
  assert.match(SERVER_SRC, /art_route_path:\s*\{\s*\.\.\.artRoutePathCounter/,
    'GUARD-DIGEST emitter must include art_route_path counter for Phase 3 cutover signal');
  // legacy_pct must be computed for the dashboard view
  assert.match(SERVER_SRC, /legacy_pct\s*:\s*legacyPct/,
    'GUARD-DIGEST must compute legacy_pct for the Phase 3 < 0.1% threshold');
});

console.log('[chunk-token-sign-verify] all assertions passed');
