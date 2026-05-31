// tests/senebty-photo-consent.test.mjs
// Task 9 — F5 Wedeha PHOTO_IRI: consent endpoints integration test
// Spawns seba-story-api.mjs on TEST_PORT, exercises POST/GET/POST consent cycle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const TEST_PORT = '34567';
const BASE = `http://127.0.0.1:${TEST_PORT}`;

async function startServer() {
  const proc = spawn('node', ['seba-story-api.mjs'], {
    env: {
      ...process.env,
      SEBA_PORT: TEST_PORT,
      NODE_ENV: 'test',
      // Use an in-memory DB for each test run so tests don't clobber each other
      SEBA_DB_PATH: ':memory:',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) return proc;
    } catch (e) { /* not up yet */ }
    await sleep(200);
  }
  proc.kill();
  throw new Error('test server did not start within 6s');
}

test('POST /api/senebty/consent writes a row; state returns active=true', async (t) => {
  const proc = await startServer();
  t.after(() => proc.kill());

  const r = await fetch(`${BASE}/api/senebty/consent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-test-user': 'test-user-1' },
    body: JSON.stringify({ foundationId: 'foundation-5-wedeha' }),
  });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.ok, true);

  const s = await fetch(
    `${BASE}/api/senebty/consent/state?foundationId=foundation-5-wedeha`,
    { headers: { 'x-test-user': 'test-user-1' } }
  );
  assert.equal(s.status, 200);
  const data = await s.json();
  assert.equal(data.active, true);
});

test('POST /api/senebty/consent/withdraw clears consent', async (t) => {
  const proc = await startServer();
  t.after(() => proc.kill());

  // First give consent
  await fetch(`${BASE}/api/senebty/consent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-test-user': 'test-user-2' },
    body: JSON.stringify({ foundationId: 'foundation-5-wedeha' }),
  });

  // Then withdraw
  const w = await fetch(`${BASE}/api/senebty/consent/withdraw`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-test-user': 'test-user-2' },
    body: JSON.stringify({ foundationId: 'foundation-5-wedeha' }),
  });
  assert.equal(w.status, 200);
  const wBody = await w.json();
  assert.equal(wBody.ok, true);

  // State should now be inactive
  const s = await fetch(
    `${BASE}/api/senebty/consent/state?foundationId=foundation-5-wedeha`,
    { headers: { 'x-test-user': 'test-user-2' } }
  );
  assert.equal(s.status, 200);
  const data = await s.json();
  assert.equal(data.active, false);
});
