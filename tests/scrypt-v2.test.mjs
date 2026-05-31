#!/usr/bin/env node
// Integration test for Fix #9: explicit scrypt-v2 params + backward-compat.
//
// Asserts:
//   1. A freshly-registered PIN is stored in s2: format (new params).
//   2. A legacy-format hash (installed directly into SQLite) still verifies
//      under default params (backward compat).
//   3. After a successful verify against a legacy hash, the stored hash is
//      silently upgraded to s2: format (opportunistic re-hash).
//
// Requires ALLOW_TEST_ENDPOINTS=true so /api/seba-user-profile exposes
// pinHashFormat, and direct access to the SQLite file pointed at by SEBA_DB_PATH.
//
// Usage:
//   SEBA_DB_PATH=/tmp/perankh-audit-test.db ALLOW_TEST_ENDPOINTS=true \
//     AUTH_BASE=http://localhost:3456 API_BASE=http://localhost:3847 \
//     node tests/scrypt-v2.test.mjs

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';

const AUTH_BASE = process.env.AUTH_BASE || 'http://localhost:3456';
const API_BASE  = process.env.API_BASE  || 'http://localhost:3847';
const DB_PATH   = process.env.SEBA_DB_PATH;

if (!DB_PATH) {
  console.error('SEBA_DB_PATH is required so the test can install a legacy hash.');
  process.exit(2);
}

const unique = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const TEST_EMAIL_LOGIN = `scrypt-${unique}@local.test`;
const TEST_EMAIL_PARENT = `scrypt-parent-${unique}@local.test`;
const TEST_PASSWORD = 'TestPassword123X';
const TEST_NAME = 'Scrypt Child';
const LEGACY_PIN = '4242';

let PASS = 0, FAIL = 0;
function log(ok, name, detail) {
  (ok ? console.log : console.error)(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  ok ? PASS++ : FAIL++;
}

// Produces a legacy-format hash ('salt:hash') using Node's default scrypt
// params, matching how the server used to hash before this fix.
function hashLegacyPin(pin) {
  const salt = crypto.randomBytes(16).toString('hex');
  return new Promise((resolve, reject) => {
    crypto.scrypt(String(pin), salt, 32, (err, key) => {
      if (err) return reject(err);
      resolve(salt + ':' + key.toString('hex'));
    });
  });
}

async function getProfile(hdrs) {
  const r = await fetch(`${API_BASE}/api/seba-user-profile`, { headers: hdrs });
  return r.ok ? r.json() : { ok: false, status: r.status };
}

async function main(){
  const regResp = await fetch(`${AUTH_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL_LOGIN, password: TEST_PASSWORD, name: TEST_NAME })
  });
  assert.equal(regResp.status, 200, `auth/register status ${regResp.status}`);
  const reg = await regResp.json();
  const jwt = reg.jwt;
  const authId = reg.userId;
  assert.ok(jwt && authId, 'registration must return jwt + userId');

  const hdrs = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + jwt, 'X-Auth-ChildName': TEST_NAME };

  // 1. Register a PIN normally — expect s2: format to land in the DB.
  {
    const r = await fetch(`${API_BASE}/api/seba-register-parent`, {
      method: 'POST', headers: hdrs,
      body: JSON.stringify({ email: TEST_EMAIL_PARENT, pin: '1111', childName: TEST_NAME })
    });
    const body = await r.json().catch(() => ({}));
    log(r.ok && body.registered === true, 'register-parent creates PIN hash', `status ${r.status}`);

    const profile = await getProfile(hdrs);
    log(profile.pinHashFormat === 's2',
        'new PIN hash uses s2: (scrypt-v2) format',
        `pinHashFormat=${profile.pinHashFormat}`);
  }

  // 2. Install a legacy-format hash directly in SQLite, then verify.
  //    The server must accept it (old users aren't locked out) AND silently
  //    upgrade it on the way out.
  {
    const legacyHash = await hashLegacyPin(LEGACY_PIN);
    assert.equal(legacyHash.split(':').length, 2, 'legacy hash should be salt:hash');
    assert.ok(!legacyHash.startsWith('s2:'), 'legacy hash must not start with s2:');

    const db = new Database(DB_PATH);
    try {
      const update = db.prepare('UPDATE users SET pin_hash = ? WHERE google_id = ?');
      const result = update.run(legacyHash, authId);
      assert.equal(result.changes, 1, 'legacy hash install updated 1 row');
    } finally { db.close(); }

    // Confirm via profile before verify
    const preProfile = await getProfile(hdrs);
    log(preProfile.pinHashFormat === 'legacy',
        'legacy hash installed in DB for backward-compat test',
        `pinHashFormat=${preProfile.pinHashFormat}`);

    // Verify with the correct legacy PIN — must return verified:true.
    const r = await fetch(`${API_BASE}/api/seba-verify-pin`, {
      method: 'POST', headers: hdrs, body: JSON.stringify({ pin: LEGACY_PIN })
    });
    const body = await r.json().catch(() => ({}));
    log(r.ok && body.verified === true,
        'legacy-format hash still verifies (backward compat)',
        `status ${r.status} verified=${body.verified}`);

    // Upgrade runs via setImmediate — poll until we see s2: or bail after 2s.
    let upgraded = false;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 100));
      const p = await getProfile(hdrs);
      if (p.pinHashFormat === 's2') { upgraded = true; break; }
    }
    log(upgraded, 'legacy hash opportunistically upgraded to s2 after verify');
  }

  console.log(`\n${PASS} passing, ${FAIL} failing`);
  process.exit(FAIL ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
