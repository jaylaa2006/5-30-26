#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// send-pin-reset-notice.mjs
//
// Notifies the small cohort of parents whose accounts ended up in a half-setup
// state after a client-side PIN hashing regression: `email_verified = 1` but
// `pin_hash IS NULL`. The server-side fix is deployed; this script tells them
// to re-enter their PIN in the app so Seba Guardian features come back online.
//
// Usage:
//   node scripts/send-pin-reset-notice.mjs --dry-run                 # preview only
//   node scripts/send-pin-reset-notice.mjs                           # live cohort send
//   node scripts/send-pin-reset-notice.mjs --email someone@x.com     # single recipient
//
// Requires env:
//   SENDGRID_API_KEY    (API key, never hardcoded)
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

// Optional `--email foo@bar.com` filter — restricts the send to one recipient.
// Useful for one-off resends without mailing the whole cohort again.
function parseEmailFilter(argv) {
  const i = argv.indexOf('--email');
  if (i === -1) return null;
  const val = argv[i + 1];
  if (!val || val.startsWith('--')) {
    console.error('Error: --email requires an address');
    process.exit(1);
  }
  return val.toLowerCase();
}
const EMAIL_FILTER = parseEmailFilter(process.argv);
const FROM_EMAIL = 'seba@osiriscare.net';
const FROM_NAME = 'Per Ankh Reader';
const SUPPORT_EMAIL = 'seba@osiriscare.net';
const SEND_DELAY_MS = 1000; // 1s between sends for rate safety

// ─── Email content ──────────────────────────────────────────────────────────

const SUBJECT = 'Please re-set your Per Ankh parent PIN';

const PLAIN_BODY = (name) => `Hi${name ? ' ' + name : ''},

A recent update to Per Ankh Reader changed how parent PINs are saved. To keep
using Seba Guardian features — the AI elder dialogue with your child, and the
parent alerts that go with it — you'll need to re-set your 4-digit parent PIN
in the app.

It only takes a moment:

  1. Open Per Ankh Reader on your child's device and sign in.
  2. On the home screen, tap the "Parent" button (lock icon, top-right).
  3. Enter a new 4-digit PIN when prompted. That becomes your parent PIN.

Your child's reading progress, scores, and virtue history are safe — nothing
was lost. This only affects the parent-side PIN.

If anything doesn't work, reply to this email or write to ${SUPPORT_EMAIL}
and we'll sort it out personally.

Thank you for reading with us.

— The Per Ankh Reader team
${SUPPORT_EMAIL}
`;

const HTML_BODY = (name) => `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f6f2e8;">
  <div style="font-family:Georgia,'Times New Roman',serif;max-width:580px;margin:0 auto;background:#ffffff;color:#222;padding:32px 28px;border-radius:8px;line-height:1.55;">
    <h2 style="color:#1a237e;font-family:Georgia,serif;margin:0 0 20px;font-size:1.35em;border-bottom:2px solid #C4A347;padding-bottom:10px;">Please re-set your parent PIN</h2>
    <p style="margin:0 0 14px;">Hi${name ? ' ' + escapeHtml(name) : ''},</p>
    <p style="margin:0 0 14px;">A recent update to Per Ankh Reader changed how parent PINs are saved. To keep using <strong>Seba Guardian</strong> features — the AI elder dialogue with your child, and the parent alerts that go with it — you'll need to re-set your 4-digit parent PIN in the app.</p>
    <p style="margin:0 0 10px;"><strong style="color:#1a237e;">It only takes a moment:</strong></p>
    <ol style="margin:0 0 18px;padding-left:22px;">
      <li style="margin-bottom:8px;">Open Per Ankh Reader on your child's device and sign in.</li>
      <li style="margin-bottom:8px;">On the home screen, tap the <strong>Parent</strong> button (lock icon, top-right).</li>
      <li style="margin-bottom:8px;">Enter a new 4-digit PIN when prompted. That becomes your parent PIN.</li>
    </ol>
    <div style="background:#fbf6e7;border-left:3px solid #C4A347;padding:14px 16px;margin:18px 0;border-radius:0 6px 6px 0;">
      <p style="margin:0;font-size:0.95em;color:#4a3b1a;">Your child's reading progress, scores, and virtue history are safe — nothing was lost. This only affects the parent-side PIN.</p>
    </div>
    <p style="margin:0 0 14px;">If anything doesn't work, reply to this email or write to <a href="mailto:${SUPPORT_EMAIL}" style="color:#1a237e;">${SUPPORT_EMAIL}</a> and we'll sort it out personally.</p>
    <p style="margin:0 0 22px;">Thank you for reading with us.</p>
    <p style="margin:0;color:#1a237e;font-weight:700;">— The Per Ankh Reader team</p>
    <p style="margin:2px 0 0;color:#888;font-size:0.85em;"><a href="mailto:${SUPPORT_EMAIL}" style="color:#888;">${SUPPORT_EMAIL}</a></p>
  </div>
</body>
</html>`;

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ─── Main ───────────────────────────────────────────────────────────────────

function fetchRecipients() {
  const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  try {
    // Schema note: the `users` table uses `parent_email` and `child_name`
    // (the task brief referred to these conceptually as `email` and `name`).
    const rows = db.prepare(`
      SELECT parent_email AS email, child_name AS name
      FROM users
      WHERE email_verified = 1
        AND pin_hash IS NULL
        AND parent_email IS NOT NULL
        AND parent_email != ''
    `).all();
    return rows;
  } finally {
    db.close();
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ts() {
  return new Date().toISOString();
}

async function main() {
  console.log(`[${ts()}] send-pin-reset-notice — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`[${ts()}] DB: ${DB_PATH}`);
  if (EMAIL_FILTER) console.log(`[${ts()}] Filter: --email ${EMAIL_FILTER}`);

  let recipients;
  try {
    recipients = fetchRecipients();
  } catch (err) {
    console.error(`[${ts()}] Failed to read DB: ${err.message}`);
    process.exit(1);
  }

  if (EMAIL_FILTER) {
    const before = recipients.length;
    recipients = recipients.filter(r => (r.email || '').toLowerCase() === EMAIL_FILTER);
    console.log(`[${ts()}] Filtered ${before} → ${recipients.length} recipient(s) for ${EMAIL_FILTER}`);
    if (recipients.length === 0) {
      console.error(`[${ts()}] No user matches ${EMAIL_FILTER} with email_verified=1 AND pin_hash IS NULL. Aborting.`);
      process.exit(1);
    }
  }

  console.log(`\n=== Affected users: ${recipients.length} ===`);
  recipients.forEach((r, i) => {
    console.log(`  ${String(i + 1).padStart(2, ' ')}. ${r.email}${r.name ? ` (${r.name})` : ''}`);
  });
  console.log('');

  if (recipients.length === 0) {
    console.log(`[${ts()}] No affected users found. Nothing to do.`);
    return;
  }

  if (DRY_RUN) {
    console.log('=== Rendered email (preview) ===');
    console.log(`From:    ${FROM_NAME} <${FROM_EMAIL}>`);
    console.log(`Subject: ${SUBJECT}`);
    console.log('');
    console.log('--- PLAIN TEXT ---');
    console.log(PLAIN_BODY(recipients[0].name));
    console.log('--- HTML ---');
    console.log(HTML_BODY(recipients[0].name));
    console.log('');
    console.log(`[${ts()}] DRY RUN complete — no emails sent.`);
    return;
  }

  // Live send: require API key only now (dry-run must work without it).
  if (!process.env.SENDGRID_API_KEY) {
    console.error(`[${ts()}] SENDGRID_API_KEY is not set. Aborting.`);
    process.exit(1);
  }
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);

  let sent = 0;
  let failed = 0;
  for (let i = 0; i < recipients.length; i++) {
    const { email, name } = recipients[i];
    const msg = {
      to: email,
      from: { name: FROM_NAME, email: FROM_EMAIL },
      replyTo: SUPPORT_EMAIL,
      subject: SUBJECT,
      text: PLAIN_BODY(name),
      html: HTML_BODY(name)
    };
    try {
      const [response] = await sgMail.send(msg);
      const messageId = response?.headers?.['x-message-id'] || 'unknown';
      console.log(`[${ts()}] SENT  ${email}  message-id=${messageId}`);
      sent++;
    } catch (err) {
      const code = err?.code || err?.response?.statusCode || 'ERR';
      const detail = err?.response?.body?.errors?.[0]?.message || err.message;
      console.error(`[${ts()}] FAIL  ${email}  ${code}: ${detail}`);
      failed++;
    }
    if (i < recipients.length - 1) {
      await sleep(SEND_DELAY_MS);
    }
  }

  console.log('');
  console.log(`[${ts()}] Done. Sent: ${sent}. Failed: ${failed}.`);
  if (failed > 0) process.exit(2);
}

main().catch((err) => {
  console.error(`[${ts()}] Unhandled error:`, err);
  process.exit(1);
});
