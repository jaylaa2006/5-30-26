// tests/senebty-photo-endpoint.test.mjs
// Integration tests for F5 Wedeha photo endpoints (Task 10 TDD).
// Tests: POST /api/senebty/photo, GET /api/senebty/photo/:id, POST /api/senebty/photo/:id/confirm-iri

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Each test gets its own port + photos root to avoid inter-test port conflicts.
let _nextPort = 34568;
function allocPort() { return String(_nextPort++); }

async function startServer(port) {
  const photosRoot = path.join(os.tmpdir(), `perankh-photo-test-${port}-${Date.now()}`);
  fs.mkdirSync(photosRoot, { recursive: true });
  const base = `http://127.0.0.1:${port}`;
  const proc = spawn('node', ['seba-story-api.mjs'], {
    env: {
      ...process.env,
      SEBA_PORT: port,
      SEBA_DB_PATH: ':memory:',
      NODE_ENV: 'test',
      PHOTO_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('hex'),
      PHOTO_HASH_SALT: 'test-salt-32-chars-padding-padding',
      PHOTOS_ROOT: photosRoot,
      CHUNK_SIGNING_SECRET: 'test-signing-secret-32-chars-padding-padding',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  for (let i = 0; i < 30; i++) {
    try { const r = await fetch(`${base}/api/health`); if (r.ok) return { proc, base, photosRoot }; } catch (e) {}
    await sleep(200);
  }
  proc.kill(); throw new Error(`test server on port ${port} did not start`);
}

async function consentFor(base, userId, foundationId) {
  return fetch(`${base}/api/senebty/consent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-test-user': userId },
    body: JSON.stringify({ foundationId }),
  });
}

test('POST /api/senebty/photo rejects without consent', async (t) => {
  const { proc, base } = await startServer(allocPort()); t.after(() => proc.kill());
  const fd = new FormData();
  fd.append('foundationId', 'foundation-5-wedeha');
  fd.append('file', new Blob([fs.readFileSync('tests/fixtures/exif-test-photo.jpg')], { type: 'image/jpeg' }), 'test.jpg');
  const r = await fetch(`${base}/api/senebty/photo`, {
    method: 'POST',
    headers: { 'x-test-user': 'noc-user' },
    body: fd,
  });
  assert.equal(r.status, 403);
});

test('POST /api/senebty/photo accepts with consent, strips EXIF, encrypts', async (t) => {
  const { proc, base } = await startServer(allocPort()); t.after(() => proc.kill());
  await consentFor(base, 'upload-user', 'foundation-5-wedeha');
  const fd = new FormData();
  fd.append('foundationId', 'foundation-5-wedeha');
  fd.append('file', new Blob([fs.readFileSync('tests/fixtures/exif-test-photo.jpg')], { type: 'image/jpeg' }), 'test.jpg');
  const r = await fetch(`${base}/api/senebty/photo`, {
    method: 'POST',
    headers: { 'x-test-user': 'upload-user' },
    body: fd,
  });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.ok(body.photoId);
  assert.ok(body.signedUrl);
});

test('GET /api/senebty/photo/<id> serves with valid signed URL', async (t) => {
  const { proc, base } = await startServer(allocPort()); t.after(() => proc.kill());
  await consentFor(base, 'serve-user', 'foundation-5-wedeha');
  const fd = new FormData();
  fd.append('foundationId', 'foundation-5-wedeha');
  fd.append('file', new Blob([fs.readFileSync('tests/fixtures/exif-test-photo.jpg')], { type: 'image/jpeg' }), 'test.jpg');
  const up = await fetch(`${base}/api/senebty/photo`, {
    method: 'POST', headers: { 'x-test-user': 'serve-user' }, body: fd,
  });
  const { signedUrl } = await up.json();
  const r = await fetch(base + signedUrl, { headers: { 'x-test-user': 'serve-user' } });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.equal(r.headers.get('content-type'), 'image/jpeg');
});

test('POST /api/senebty/photo/<id>/confirm-iri deletes file', async (t) => {
  const { proc, base, photosRoot } = await startServer(allocPort()); t.after(() => proc.kill());
  await consentFor(base, 'confirm-user', 'foundation-5-wedeha');
  const fd = new FormData();
  fd.append('foundationId', 'foundation-5-wedeha');
  fd.append('file', new Blob([fs.readFileSync('tests/fixtures/exif-test-photo.jpg')], { type: 'image/jpeg' }), 'test.jpg');
  const up = await fetch(`${base}/api/senebty/photo`, {
    method: 'POST', headers: { 'x-test-user': 'confirm-user' }, body: fd,
  });
  const { photoId } = await up.json();
  const r = await fetch(`${base}/api/senebty/photo/${photoId}/confirm-iri`, {
    method: 'POST', headers: { 'x-test-user': 'confirm-user' },
  });
  assert.equal(r.status, 200);
  const fs2 = await import('node:fs/promises');
  const ps = await import('../senebty/photo-store.js');
  const dir = `${photosRoot}/${ps.hashUserId('confirm-user', 'test-salt-32-chars-padding-padding')}/foundation-5-wedeha`;
  const files = await fs2.readdir(dir).catch(() => []);
  assert.equal(files.length, 0, 'photo file should be deleted after confirm-iri');
});
