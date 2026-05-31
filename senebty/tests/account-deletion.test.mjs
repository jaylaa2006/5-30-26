#!/usr/bin/env node
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const NS  = fs.readFileSync(new URL('../lib/namespace.js',      import.meta.url), 'utf8');
const MIG = fs.readFileSync(new URL('../lib/user-migration.js', import.meta.url), 'utf8');

const ctx = { window: {}, Object };
vm.createContext(ctx);
vm.runInContext(NS,  ctx);
vm.runInContext(MIG, ctx);

let PASS = 0, FAIL = 0;
function check(name, fn){ try { fn(); console.log('PASS ' + name); PASS++; } catch(e){ console.error('FAIL ' + name + ' — ' + e.message); FAIL++; } }

check('after wipe + re-migrate, senebty is fresh', () => {
  // Simulate account deletion: drop everything, start fresh (mirrors localStorage.removeItem + re-init)
  const fresh = {};
  ctx.window.Senebty.migrate(fresh);
  assert.equal(fresh.senebty.tier, 0);
  assert.equal(fresh.senebty.iriLog.length, 0);
  assert.equal(fresh.senebty.streakDays, 0);
});

check('wipe discards all non-default senebty fields', () => {
  // Spot-check one non-headline field to confirm full shape is reset
  const fresh = {};
  ctx.window.Senebty.migrate(fresh);
  assert.equal(fresh.senebty.longestStreak, 0);
  assert.equal(fresh.senebty.streakPause.active, false);
});

check('fresh senebty object is reference-independent from a previously migrated user', () => {
  // Migrate two separate users and verify their senebty objects are fully independent
  const user = {};
  ctx.window.Senebty.migrate(user);
  user.senebty.tier = 5;
  user.senebty.iriLog.push({ lessonId: 'iri-1' });

  const fresh = {};
  ctx.window.Senebty.migrate(fresh);

  // Objects must be distinct references
  assert.ok(user.senebty !== fresh.senebty, 'senebty objects share the same reference');
  // Mutating fresh must not affect user
  fresh.senebty.iriLog.push({ lessonId: 'iri-fresh' });
  assert.equal(user.senebty.iriLog.length, 1, 'push to fresh.iriLog leaked into user.iriLog');
  // User tier should still be 5; fresh should start at 0
  assert.equal(user.senebty.tier, 5);
  assert.equal(fresh.senebty.tier, 0);
});

check('maat-reader.html clearAccount path includes glossary.recent wipe', () => {
  // Verify the account deletion code wipes glossary recent-lookups
  const maatrReaderHtml = fs.readFileSync(new URL('../../maat-reader.html', import.meta.url), 'utf8');

  // Find the perankh_user removal and verify glossary.recent removal is nearby
  const userRemovalIdx = maatrReaderHtml.indexOf("removeItem('perankh_user')");
  assert.ok(userRemovalIdx >= 0, 'perankh_user removal site not found in maat-reader.html');

  // Check within 500 chars after first occurrence (should cover clearAccount)
  const contextAfter = maatrReaderHtml.slice(userRemovalIdx, userRemovalIdx + 500);
  assert.ok(contextAfter.includes("perankh.senebty.glossary.recent"),
    'glossary.recent wipe not found adjacent to first perankh_user removal');
});

console.log(`\n${PASS} passing, ${FAIL} failing`);
process.exit(FAIL ? 1 : 0);
