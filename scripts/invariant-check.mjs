#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// invariant-check.mjs
//
// Nightly data-integrity check. Queries the users table for accounts in broken
// "half-setup" state (email_verified = 1 AND pin_hash IS NULL) and — if any
// are found older than the 24h grace window — emails a summary to the ops
// alias so we catch regressions the day they ship, not the week a parent
// complains.
//
// Intended to run from cron. Exit code: 0 always (cron shouldn't page on
// expected non-zero counts — the email is the signal). Crashes still exit 1.
//
// Usage:
//   node scripts/invariant-check.mjs --dry-run   # query + preview, no email
//   node scripts/invariant-check.mjs             # live cron run
//
// Requires env:
//   SENDGRID_API_KEY    (live mode only; dry-run works without it)
//
// Reads DB from ./data/users.db (prod path: /var/www/perankh/data/users.db)
// ─────────────────────────────────────────────────────────────────────────────

import Database from 'better-sqlite3';
import sgMail from '@sendgrid/mail';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DRY_RUN = process.argv.includes('--dry-run');
const DB_PATH = path.resolve(__dirname, '..', 'data', 'users.db');
const ALERT_TO = 'seba@osiriscare.net';
const FROM_EMAIL = 'seba@osiriscare.net';
const FROM_NAME = 'Per Ankh Invariant Check';

// Grace window: a freshly signed-up user may legitimately sit with no pin_hash
// for a few minutes while they walk through email-verify → PIN-create. Only
// flag accounts that have been in the broken state long enough that it isn't
// just "mid-setup".
const GRACE_HOURS = 24;

function ts() { return new Date().toISOString(); }

function checkInvariant() {
  const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  try {
    const rows = db.prepare(`
      SELECT google_id, child_name, parent_email, created_at, last_seen
      FROM users
      WHERE email_verified = 1
        AND pin_hash IS NULL
        AND parent_email IS NOT NULL
        AND parent_email != ''
        AND datetime(created_at) < datetime('now', '-${GRACE_HOURS} hours')
      ORDER BY created_at ASC
    `).all();
    return rows;
  } finally {
    db.close();
  }
}

function buildEmail(violations) {
  const n = violations.length;
  const subject = `[Per Ankh] ${n} user${n === 1 ? '' : 's'} in half-setup state`;

  const rows = violations.map((v, i) => {
    const days = Math.floor((Date.now() - new Date(v.created_at).getTime()) / 86400000);
    return `  ${String(i + 1).padStart(2, ' ')}. ${v.parent_email} (${v.child_name || '—'}) — stuck ${days}d, last seen ${v.last_seen}`;
  }).join('\n');

  const text = `Invariant violation: email_verified=1 AND pin_hash IS NULL
Generated: ${ts()}
Count: ${n}

Affected users:
${rows}

What this means:
These accounts verified their email but have no pin_hash on the server. They
cannot access the parent portal until they re-enter a PIN. Expected causes:

  - Legacy client bug (pre-v3.24) that cleared pin_hash during reset flow.
  - New regression in the PIN-create / PIN-update code path.

What to do:
  1. If the count is stable (same users as yesterday), they probably need a
     reminder email. Run:
       node scripts/send-pin-reset-notice.mjs --dry-run
     then without --dry-run to send.
  2. If the count grew by >0 today, investigate recent deploys touching
     /api/seba-verify-code, /api/seba-update-pin, or /api/seba-reset-pin.
  3. To resolve one user manually, they can open the app — the self-heal
     client code (v3.24+) routes them to PIN-create on next open.

Details endpoint (requires ADMIN_API_KEY):
  curl -H "X-Admin-Key: $ADMIN_API_KEY" https://withouthistory.osiriscare.net/api/admin/health-pin-consistency

— invariant-check.mjs (automated, nightly)
`;

  const htmlRows = violations.map((v, i) => {
    const days = Math.floor((Date.now() - new Date(v.created_at).getTime()) / 86400000);
    return `<tr>
      <td style="padding:6px 10px;color:#888;">${i + 1}</td>
      <td style="padding:6px 10px;"><strong>${escapeHtml(v.parent_email)}</strong></td>
      <td style="padding:6px 10px;">${escapeHtml(v.child_name || '—')}</td>
      <td style="padding:6px 10px;color:#B8412B;">${days}d stuck</td>
      <td style="padding:6px 10px;color:#666;font-size:.8em;">${escapeHtml(v.last_seen)}</td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html><body style="font-family:Georgia,serif;background:#f6f2e8;padding:20px;">
<div style="max-width:640px;margin:0 auto;background:#fff;padding:28px;border-radius:8px;">
  <h2 style="color:#1a237e;margin:0 0 8px;border-bottom:2px solid #C4A347;padding-bottom:8px;">
    ${n} user${n === 1 ? '' : 's'} in half-setup state
  </h2>
  <p style="color:#666;margin:0 0 20px;font-size:.85em;">Generated ${escapeHtml(ts())}</p>
  <p><strong>Invariant:</strong> <code>email_verified=1 AND pin_hash IS NULL</code></p>
  <p>These users verified their email but have no pin_hash on the server. They cannot access the parent portal until they re-set a PIN.</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:.9em;">
    <thead>
      <tr style="background:#fbf6e7;">
        <th style="text-align:left;padding:6px 10px;">#</th>
        <th style="text-align:left;padding:6px 10px;">Email</th>
        <th style="text-align:left;padding:6px 10px;">Child</th>
        <th style="text-align:left;padding:6px 10px;">Duration</th>
        <th style="text-align:left;padding:6px 10px;">Last seen</th>
      </tr>
    </thead>
    <tbody>${htmlRows}</tbody>
  </table>
  <div style="background:#fbf6e7;border-left:3px solid #C4A347;padding:14px 16px;margin:18px 0;border-radius:0 6px 6px 0;">
    <p style="margin:0 0 8px;"><strong>If count is stable:</strong> run <code>node scripts/send-pin-reset-notice.mjs --email &lt;addr&gt;</code> per user.</p>
    <p style="margin:0;"><strong>If count grew today:</strong> investigate recent deploys to <code>/api/seba-verify-code</code>, <code>/api/seba-update-pin</code>, or <code>/api/seba-reset-pin</code>.</p>
  </div>
  <p style="color:#888;font-size:.8em;margin:22px 0 0;">— invariant-check.mjs (automated, nightly)</p>
</div>
</body></html>`;

  return { subject, text, html };
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

async function main() {
  console.log(`[${ts()}] invariant-check — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`[${ts()}] DB: ${DB_PATH}`);

  let violations;
  try {
    violations = checkInvariant();
  } catch (err) {
    console.error(`[${ts()}] DB error: ${err.message}`);
    process.exit(1);
  }

  console.log(`[${ts()}] Invariant: email_verified=1 AND pin_hash IS NULL (grace ${GRACE_HOURS}h)`);
  console.log(`[${ts()}] Violations: ${violations.length}`);

  if (violations.length === 0) {
    console.log(`[${ts()}] All clear. No alert.`);
    return;
  }

  violations.forEach((v, i) => {
    const days = Math.floor((Date.now() - new Date(v.created_at).getTime()) / 86400000);
    console.log(`[${ts()}]   ${i + 1}. ${v.parent_email} (${v.child_name || '—'}) — ${days}d stuck`);
  });

  const { subject, text, html } = buildEmail(violations);

  if (DRY_RUN) {
    console.log('\n=== Email preview (dry run) ===');
    console.log(`To:      ${ALERT_TO}`);
    console.log(`Subject: ${subject}`);
    console.log('\n--- TEXT ---');
    console.log(text);
    console.log(`[${ts()}] DRY RUN complete — no email sent.`);
    return;
  }

  if (!process.env.SENDGRID_API_KEY) {
    console.error(`[${ts()}] SENDGRID_API_KEY is not set. Cannot send alert.`);
    process.exit(1);
  }
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);

  try {
    const [response] = await sgMail.send({
      to: ALERT_TO,
      from: { name: FROM_NAME, email: FROM_EMAIL },
      subject,
      text,
      html,
    });
    const messageId = response?.headers?.['x-message-id'] || 'unknown';
    console.log(`[${ts()}] Alert sent to ${ALERT_TO}  message-id=${messageId}`);
  } catch (err) {
    const code = err?.code || err?.response?.statusCode || 'ERR';
    const detail = err?.response?.body?.errors?.[0]?.message || err.message;
    console.error(`[${ts()}] SendGrid failure: ${code}: ${detail}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`[${ts()}] Unhandled error:`, err);
  process.exit(1);
});
