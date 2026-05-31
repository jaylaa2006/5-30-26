import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runCleanup } from '../scripts/senebty-photo-cleanup.mjs';

const ROOT = path.join(os.tmpdir(), 'perankh-cleanup-test-' + Date.now());

function setupFixture() {
  fs.mkdirSync(`${ROOT}/userhash1/foundation-5-wedeha`, { recursive: true });
  const now = Date.now();
  // Fresh (1 hour old)
  fs.writeFileSync(`${ROOT}/userhash1/foundation-5-wedeha/fresh.enc`, Buffer.alloc(16+16));
  fs.utimesSync(`${ROOT}/userhash1/foundation-5-wedeha/fresh.enc`, (now - 3600*1000)/1000, (now - 3600*1000)/1000);
  // 25 days old
  fs.writeFileSync(`${ROOT}/userhash1/foundation-5-wedeha/midage.enc`, Buffer.alloc(16+16));
  const t25 = (now - 25*86400*1000)/1000;
  fs.utimesSync(`${ROOT}/userhash1/foundation-5-wedeha/midage.enc`, t25, t25);
  // 31 days old
  fs.writeFileSync(`${ROOT}/userhash1/foundation-5-wedeha/old.enc`, Buffer.alloc(16+16));
  const t31 = (now - 31*86400*1000)/1000;
  fs.utimesSync(`${ROOT}/userhash1/foundation-5-wedeha/old.enc`, t31, t31);
}

test('runCleanup deletes only files older than 30 days', async () => {
  setupFixture();
  const summary = await runCleanup({ rootDir: ROOT, ttlDays: 30 });
  assert.equal(summary.deleted_30d, 1);
  assert.deepEqual(fs.readdirSync(`${ROOT}/userhash1/foundation-5-wedeha`).sort(), ['fresh.enc', 'midage.enc']);
});
