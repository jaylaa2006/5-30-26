// lib/email-retry.mjs
// Bounded retry-with-backoff wrapper for transient SendGrid send failures.
//
// Extracted as a PURE module (the send function is injected) so it is fully
// unit-testable without booting the API server or hitting SendGrid — same
// pattern as lib/heka-stats.mjs.
//
// WHY THIS EXISTS (2026-05-23 audit, the "DEMETRIS" incident):
//   A single transient SendGrid "Unauthorized" (401) THROW landed at the exact
//   moment a user signed up. Their access-code email never went out, so they
//   never verified, so they were stranded (account exists, email_verified=0,
//   never returned). The sends immediately before and after that one succeeded
//   — proving the 401 was transient, not a dead key. One blip = one lost user,
//   silently. A bounded retry self-heals this entire class of failure.
//
// Contract: callers pass `sendFn(msg)` which resolves to the SendGrid result
// (either `[response, body]` or `response`) or throws. The wrapper returns a
// structured outcome — it never throws — so call sites stay branch-on-result.

export const EMAIL_SEND_MAX_ATTEMPTS = 3;

// Status codes worth retrying.
//   - 5xx / 502 / 503 / 504 — classic transient upstream failures.
//   - 429 — rate limited; backoff then retry.
//   - 408 / 425 — request timeout / too-early; transient.
//   - 401 / 403 — NORMALLY permanent auth errors, included DELIBERATELY because
//     the audited incident was a *transient* 401 (the key was briefly
//     unauthorized and recovered within seconds). Bounded attempts + short
//     backoff mean a genuinely-revoked key still fails fast (~1.2s of added
//     latency total) and loudly — we don't hang the request on a dead key.
export const EMAIL_RETRYABLE_STATUS = new Set([401, 403, 408, 425, 429, 500, 502, 503, 504]);

// Pull an HTTP status out of a thrown SendGrid error. @sendgrid/mail throws a
// ResponseError carrying `.code` (the numeric status) and `.response`. Network
// errors (ECONNRESET/ETIMEDOUT) carry a STRING `.code` — those return null here
// and are classified as retryable network throws.
export function statusFromError(err) {
  if (!err) return null;
  if (typeof err.code === 'number') return err.code;
  if (err.response && typeof err.response.statusCode === 'number') return err.response.statusCode;
  return null;
}

// Should this failure be retried?
//   thrown=true  → a throw. With a known non-retryable status (e.g. 400/413) it
//                  is permanent; with no status (network throw) it is transient.
//   thrown=false → a resolved-but-non-2xx response; retry only on listed codes.
export function isRetryableSend({ thrown, statusCode }) {
  if (typeof statusCode === 'number') return EMAIL_RETRYABLE_STATUS.has(statusCode);
  // No status: a network-level throw is transient; a non-2xx with no code is not.
  return !!thrown;
}

const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));
// 400ms, then 800ms before attempts 2 and 3 → ≤1.2s total added latency.
const defaultBackoff = (attempt) => 400 * attempt;

// Per-attempt timeout. The access-code + reset sends BLOCK the HTTP response, so
// a *hung* SendGrid connection (not a throw) must not stall the request. A
// timeout rejects with a string-coded error → statusFromError returns null →
// classified as a retryable network throw. Default 8s/attempt (worst case on a
// total hang: 3×8s + 1.2s backoff ≈ 25s, well under nginx's 60s proxy_read).
const DEFAULT_ATTEMPT_TIMEOUT_MS = 8000;
function withTimeout(promise, ms) {
  if (!ms || ms <= 0) return promise;
  return new Promise((resolve, reject) => {
    // NB: do NOT .unref() this timer. unref() lets the event loop go idle while a
    // send is in-flight, which (a) cancels isolated unit tests with "Promise
    // resolution is still pending but the event loop has already resolved" on CI,
    // and (b) buys nothing in production — the HTTP server already keeps the loop
    // alive, the timer always clears within `ms` (≤8s) on resolve/reject, and pm2
    // SIGKILLs on restart regardless. So a ref'd timer is both correct and
    // deterministic. (CI caught this; local passed non-deterministically.)
    const t = setTimeout(() => {
      const e = new Error('email send timed out after ' + ms + 'ms');
      e.code = 'ETIMEDOUT'; // string code → treated as a transient network throw
      reject(e);
    }, ms);
    Promise.resolve(promise).then(
      (v) => { clearTimeout(t); resolve(v); },
      (err) => { clearTimeout(t); reject(err); }
    );
  });
}

// sendEmailWithRetry(sendFn, msg, opts) → Promise<{ ok, statusCode, attempts, reason?, error? }>
//   reason is one of: 'sendgrid_non2xx' | 'sendgrid_throw' (matches the existing
//   AUTH-FUNNEL telemetry vocabulary).
//   opts.onRetry({ attempt, statusCode, reason, error }) is called before each
//   backoff so callers can emit a [AUTH-FUNNEL] *_send_retry breadcrumb.
export async function sendEmailWithRetry(sendFn, msg, opts = {}) {
  const maxAttempts = opts.maxAttempts || EMAIL_SEND_MAX_ATTEMPTS;
  const sleep = opts.sleep || defaultSleep;
  const backoff = opts.backoff || defaultBackoff;
  const onRetry = typeof opts.onRetry === 'function' ? opts.onRetry : () => {};
  const attemptTimeoutMs = opts.attemptTimeoutMs !== undefined ? opts.attemptTimeoutMs : DEFAULT_ATTEMPT_TIMEOUT_MS;

  let last = { ok: false, reason: 'unknown', statusCode: null, attempts: 0 };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await withTimeout(sendFn(msg), attemptTimeoutMs);
      const resp = Array.isArray(result) ? result[0] : result;
      const status = resp && typeof resp.statusCode === 'number' ? resp.statusCode : null;

      if (status !== null && (status < 200 || status >= 300)) {
        last = { ok: false, reason: 'sendgrid_non2xx', statusCode: status, attempts: attempt };
        if (isRetryableSend({ thrown: false, statusCode: status }) && attempt < maxAttempts) {
          onRetry({ attempt, statusCode: status, reason: 'sendgrid_non2xx' });
          await sleep(backoff(attempt));
          continue;
        }
        return last;
      }
      return { ok: true, statusCode: status, attempts: attempt };
    } catch (err) {
      const status = statusFromError(err);
      const error = err && err.message ? String(err.message).slice(0, 200) : String(err).slice(0, 200);
      last = { ok: false, reason: 'sendgrid_throw', statusCode: status, error, attempts: attempt };
      if (isRetryableSend({ thrown: true, statusCode: status }) && attempt < maxAttempts) {
        onRetry({ attempt, statusCode: status, reason: 'sendgrid_throw', error });
        await sleep(backoff(attempt));
        continue;
      }
      return last;
    }
  }
  return last;
}
