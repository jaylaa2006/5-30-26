// senebty-teaching-iri-scheduler.test.mjs
// Validates the 14-day TEACHING_IRI scheduler semantics (M3 Task 8):
// - SQLite schema matches spec
// - Day-7 reminder query selects rows >= 7d old & not yet reminded
// - Day-14 auto-advance query selects rows >= 14d old still pending
// - status enum is enforced
// - confirm_token is UNIQUE
// - Scheduler scaffolding present in seba-story-api.mjs (setInterval 6h, etc.)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const apiSrc = fs.readFileSync(path.join(repoRoot, 'seba-story-api.mjs'), 'utf8');

let pass = 0, fail = 0;
function check(name, fn){
  try { fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e){ console.error(`  FAIL  ${name}\n        ${e.message}`); fail++; }
}

// In-memory sqlite: replicate scheduler queries against the schema
const db = new Database(':memory:');
const SCHEMA_SQL = `
  CREATE TABLE pending_teaching_iri (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    lesson_id TEXT NOT NULL,
    evidence_text TEXT NOT NULL,
    submitted_at INTEGER NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('pending','confirmed','auto_advanced')),
    last_reminder_sent_at INTEGER,
    confirm_token TEXT NOT NULL UNIQUE
  )
`;
db.prepare(SCHEMA_SQL).run();

const NOW = 1_700_000_000_000;
const DAY = 86400 * 1000;

const insert = db.prepare(`
  INSERT INTO pending_teaching_iri
    (user_id, lesson_id, evidence_text, submitted_at, status, last_reminder_sent_at, confirm_token)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

insert.run('u-1', 'foundation-8-heka', 'evidence one two three four five six', NOW - 1 * DAY,  'pending', null, 'tok-1');
insert.run('u-2', 'foundation-8-heka', 'evidence one two three four five six', NOW - 8 * DAY,  'pending', null, 'tok-2');
insert.run('u-3', 'foundation-8-heka', 'evidence one two three four five six', NOW - 9 * DAY,  'pending', NOW - 1 * DAY, 'tok-3');
insert.run('u-4', 'foundation-8-heka', 'evidence one two three four five six', NOW - 15 * DAY, 'pending', NOW - 8 * DAY, 'tok-4');
insert.run('u-5', 'foundation-8-heka', 'evidence one two three four five six', NOW - 20 * DAY, 'confirmed', null, 'tok-5');
insert.run('u-6', 'foundation-8-heka', 'evidence one two three four five six', NOW - 30 * DAY, 'auto_advanced', null, 'tok-6');

const day7Q = db.prepare(`
  SELECT * FROM pending_teaching_iri
  WHERE status='pending' AND last_reminder_sent_at IS NULL
    AND (? - submitted_at) >= ?
`);
const day14Q = db.prepare(`
  SELECT * FROM pending_teaching_iri
  WHERE status='pending' AND (? - submitted_at) >= ?
`);

check('Day-7 query selects only pending rows >=7d with no prior reminder', () => {
  const rows = day7Q.all(NOW, 7 * DAY);
  const ids = rows.map(r => r.user_id).sort();
  assert.deepEqual(ids, ['u-2']);
});

check('Day-14 query selects all pending rows >=14d', () => {
  const rows = day14Q.all(NOW, 14 * DAY);
  const ids = rows.map(r => r.user_id).sort();
  assert.deepEqual(ids, ['u-4']);
});

check('Day-14 query ignores confirmed and auto-advanced rows', () => {
  const rows = day14Q.all(NOW, 14 * DAY);
  for (const r of rows) assert.equal(r.status, 'pending');
});

check('Status CHECK constraint rejects invalid status', () => {
  let threw = false;
  try {
    insert.run('u-bad', 'foundation-8-heka', 'evidence one two three four five six', NOW, 'bogus', null, 'tok-bad');
  } catch (e) { threw = /CHECK constraint/i.test(e.message); }
  assert.ok(threw, 'CHECK constraint should reject status="bogus"');
});

check('confirm_token UNIQUE constraint enforced', () => {
  let threw = false;
  try {
    insert.run('u-dup', 'foundation-8-heka', 'evidence one two three four five six', NOW, 'pending', null, 'tok-1');
  } catch (e) { threw = /UNIQUE constraint/i.test(e.message); }
  assert.ok(threw, 'UNIQUE confirm_token should be enforced');
});

check('Day-7 query returns no rows when threshold not yet reached', () => {
  const rows = day7Q.all(NOW - 5 * DAY, 7 * DAY);
  assert.equal(rows.length, 0);
});

// Static-pattern checks against actual server source
check('Schema in seba-story-api.mjs matches spec', () => {
  assert.match(apiSrc, /CREATE TABLE IF NOT EXISTS pending_teaching_iri/);
  assert.match(apiSrc, /confirm_token TEXT NOT NULL UNIQUE/);
  assert.match(apiSrc, /CHECK\(status IN \('pending','confirmed','auto_advanced'\)\)/);
});

check('Scheduler runs every 6 hours via setInterval', () => {
  assert.match(apiSrc, /setInterval\(\s*checkPendingTeachingIri\s*,\s*6\s*\*\s*60\s*\*\s*60\s*\*\s*1000\s*\)/);
});

check('Scheduler runs once at boot', () => {
  assert.match(apiSrc, /setTimeout\(\s*checkPendingTeachingIri/);
});

check('POST /api/senebty/teaching-iri endpoint present', () => {
  assert.match(apiSrc, /app\.post\(\s*['"]\/api\/senebty\/teaching-iri['"]/);
});

check('Evidence text >=8-word validation present', () => {
  assert.match(apiSrc, /wordCount\s*<\s*8/);
});

check('GET /api/senebty/teaching-iri/pending endpoint present', () => {
  assert.match(apiSrc, /app\.get\(\s*['"]\/api\/senebty\/teaching-iri\/pending['"]/);
});

check('Web Push first, SendGrid fallback in sendParentReminder', () => {
  const idx = apiSrc.indexOf('async function sendParentReminder');
  assert.ok(idx > 0);
  const fn = apiSrc.slice(idx, idx + 3000);
  const pushIdx = fn.indexOf('webpush.sendNotification');
  const mailIdx = fn.indexOf('sgMail.send');
  assert.ok(pushIdx > 0 && mailIdx > 0 && pushIdx < mailIdx, 'Push must be attempted before email');
});

check('TZ-semantics binding comment present', () => {
  assert.match(apiSrc, /UTC/);
  assert.match(apiSrc, /Parent-TZ display is client-side ONLY/i);
  assert.match(apiSrc, /QA-DA binding/);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
