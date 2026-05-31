// senebty/photo-store.js
// Photo storage primitives for F5 Wedeha PHOTO_IRI.
// Pure helpers — no Express coupling. Called from server.js endpoints
// and from scripts/senebty-photo-cleanup.mjs.
//
// Encryption: AES-256-GCM with per-photo IV. On-disk layout:
//   [iv (16 bytes)] || [ciphertext (N bytes)] || [authTag (16 bytes)]
// Key from PHOTO_ENCRYPTION_KEY env (32 hex bytes / 64 hex chars).
// See docs/superpowers/specs/2026-05-16-senebty-f5-wedeha-photo-iri-design.md

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const IV_LEN = 16;
const AUTH_TAG_LEN = 16;
const ALGO = 'aes-256-gcm';

function encryptBytes(plaintext, key) {
  if (!Buffer.isBuffer(plaintext)) throw new Error('encryptBytes: plaintext must be Buffer');
  if (!Buffer.isBuffer(key) || key.length !== 32) throw new Error('encryptBytes: key must be 32-byte Buffer');
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, ciphertext, authTag]);
}

function decryptBytes(envelope, key) {
  if (!Buffer.isBuffer(envelope)) throw new Error('decryptBytes: envelope must be Buffer');
  if (!Buffer.isBuffer(key) || key.length !== 32) throw new Error('decryptBytes: key must be 32-byte Buffer');
  if (envelope.length < IV_LEN + AUTH_TAG_LEN) throw new Error('decryptBytes: envelope too short');
  const iv = envelope.subarray(0, IV_LEN);
  const authTag = envelope.subarray(envelope.length - AUTH_TAG_LEN);
  const ciphertext = envelope.subarray(IV_LEN, envelope.length - AUTH_TAG_LEN);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

async function stripExif(buf) {
  if (!Buffer.isBuffer(buf)) throw new Error('stripExif: buf must be Buffer');
  // sharp strips all metadata (EXIF/GPS/ICC/XMP) by default when withMetadata() is NOT called.
  // .rotate() auto-applies EXIF orientation so the pixels come out right-side-up before we
  // discard the orientation tag.
  return sharp(buf)
    .rotate()   // apply EXIF orientation, then drop all metadata
    .toBuffer();
}

function signPhotoUrl(userId, photoId, opts) {
  opts = opts || {};
  const ttlSec = typeof opts.ttlSec === 'number' ? opts.ttlSec : 300;
  const secret = opts.secret;
  if (!secret) throw new Error('signPhotoUrl: secret required');
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSec;
  const payload = `${userId}|${photoId}|${expiresAt}`;
  const t = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `/api/senebty/photo/${encodeURIComponent(photoId)}?t=${t}&u=${encodeURIComponent(userId)}&e=${expiresAt}`;
}

function verifyPhotoUrl(query, opts) {
  opts = opts || {};
  const secret = opts.secret;
  if (!secret) throw new Error('verifyPhotoUrl: secret required');
  const { photoId, t, u, e } = query;
  if (!photoId || !t || !u || !e) return { valid: false, reason: 'missing_params' };
  const expiresAt = parseInt(e, 10);
  if (isNaN(expiresAt)) return { valid: false, reason: 'bad_expiry' };
  if (Date.now() / 1000 > expiresAt) return { valid: false, reason: 'expired' };
  const payload = `${u}|${photoId}|${expiresAt}`;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const tBuf = Buffer.from(t, 'hex');
  const expBuf = Buffer.from(expected, 'hex');
  if (tBuf.length !== expBuf.length || !crypto.timingSafeEqual(tBuf, expBuf)) {
    return { valid: false, reason: 'bad_signature' };
  }
  return { valid: true, userId: u, photoId };
}

function hashUserId(userId, salt) {
  if (!userId) throw new Error('hashUserId: userId required');
  if (!salt) throw new Error('hashUserId: salt required');
  return crypto.createHash('sha256').update(userId + salt).digest('hex').slice(0, 16);
}

function photoPath(rootDir, userId, foundationId, photoId, salt) {
  // SECURITY (audit L1, 2026-05-23): foundationId + photoId flow into a filesystem
  // path; a value like '../../etc' would traverse out of the photo root. Reject
  // anything outside a strict safe charset before constructing the path. (The photo
  // routes are currently unauthenticated→401, so this is latent — but the guard
  // makes the sink safe the moment auth is wired on.)
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(String(foundationId || ''))) throw new Error('photoPath: invalid foundationId');
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(String(photoId || ''))) throw new Error('photoPath: invalid photoId');
  const userHash = hashUserId(userId, salt);
  return path.join(rootDir, userHash, foundationId, photoId + '.enc');
}

module.exports = {
  encryptBytes, decryptBytes, stripExif,
  signPhotoUrl, verifyPhotoUrl,
  hashUserId, photoPath,
};
