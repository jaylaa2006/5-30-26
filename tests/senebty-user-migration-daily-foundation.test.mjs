// tests/senebty-user-migration-daily-foundation.test.mjs
// Task 16 (F1 Mu Daily Ritual) — verifies user-shape backfill of
// `user.senebty.dailyFoundationLog = {}` for legacy users.
//
// Backfill is additive: existing logs must not be clobbered, and the
// migration must defensively create `user.senebty` itself if missing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

function loadMigration() {
  const src = fs.readFileSync('senebty/lib/user-migration.js', 'utf8');
  const sandbox = { window: { Senebty: {} }, console };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox.window;
}

test('migrate adds empty dailyFoundationLog to user without it', () => {
  const win = loadMigration();
  const migrate = win.Senebty && win.Senebty.migrate;
  assert.ok(migrate, 'window.Senebty.migrate must exist');
  const user = { id: 'u1', senebty: {} };
  migrate(user);
  assert.ok(user.senebty.dailyFoundationLog, 'dailyFoundationLog must be created');
  assert.equal(typeof user.senebty.dailyFoundationLog, 'object');
  assert.deepEqual(Object.keys(user.senebty.dailyFoundationLog), [], 'must default to empty object');
});

test('migrate preserves existing dailyFoundationLog data', () => {
  const win = loadMigration();
  const migrate = win.Senebty.migrate;
  const existing = { '2026-05-10': { slug: 'mu', completed: true, micro: 3 } };
  const user = { id: 'u1', senebty: { dailyFoundationLog: existing } };
  migrate(user);
  assert.deepEqual(user.senebty.dailyFoundationLog, existing, 'existing log not clobbered');
});

test('migrate creates user.senebty if missing entirely (defensive)', () => {
  const win = loadMigration();
  const migrate = win.Senebty.migrate;
  const user = { id: 'u1' };
  migrate(user);
  assert.ok(user.senebty, 'user.senebty must be created if absent');
  assert.ok(user.senebty.dailyFoundationLog);
});
