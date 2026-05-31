import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encryptBytes, decryptBytes } from '../senebty/photo-store.js';

// Use a deterministic 32-byte key for tests
const TEST_KEY = Buffer.alloc(32, 7);

test('encryptBytes/decryptBytes round-trip identity', () => {
  const plaintext = Buffer.from('hello kemet, this is a test photo payload', 'utf8');
  const encrypted = encryptBytes(plaintext, TEST_KEY);
  assert.ok(Buffer.isBuffer(encrypted));
  assert.ok(encrypted.length > plaintext.length, 'ciphertext longer (iv + auth tag)');
  const decrypted = decryptBytes(encrypted, TEST_KEY);
  assert.deepEqual(decrypted, plaintext);
});

test('decryptBytes throws on wrong key', () => {
  const plaintext = Buffer.from('test', 'utf8');
  const encrypted = encryptBytes(plaintext, TEST_KEY);
  const wrongKey = Buffer.alloc(32, 9);
  assert.throws(() => decryptBytes(encrypted, wrongKey));
});

test('decryptBytes throws on corrupted ciphertext (bad auth tag)', () => {
  const plaintext = Buffer.from('test', 'utf8');
  const encrypted = encryptBytes(plaintext, TEST_KEY);
  encrypted[encrypted.length - 1] ^= 0xff; // flip last byte of auth tag
  assert.throws(() => decryptBytes(encrypted, TEST_KEY));
});

test('encryptBytes produces unique IV each call', () => {
  const plaintext = Buffer.from('same', 'utf8');
  const a = encryptBytes(plaintext, TEST_KEY);
  const b = encryptBytes(plaintext, TEST_KEY);
  // IV is first 16 bytes
  assert.notDeepEqual(a.subarray(0, 16), b.subarray(0, 16));
});
