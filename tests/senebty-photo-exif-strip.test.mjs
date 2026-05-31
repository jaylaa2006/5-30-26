// tests/senebty-photo-exif-strip.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import sharp from 'sharp';
import { stripExif } from '../senebty/photo-store.js';

const FIXTURE = 'tests/fixtures/exif-test-photo.jpg';

test('stripExif removes EXIF/GPS/camera-make metadata', async () => {
  const inputBuf = fs.readFileSync(FIXTURE);

  // Sanity check: fixture HAS metadata before strip
  const inMeta = await sharp(inputBuf).metadata();
  assert.ok(inMeta.exif, 'fixture should have EXIF block before strip');

  const stripped = await stripExif(inputBuf);
  const outMeta = await sharp(stripped).metadata();
  assert.equal(outMeta.exif, undefined, 'no EXIF after strip');

  // Pixel dimensions preserved
  assert.equal(outMeta.width, inMeta.width);
  assert.equal(outMeta.height, inMeta.height);
});

test('stripExif returns a Buffer', async () => {
  const stripped = await stripExif(fs.readFileSync(FIXTURE));
  assert.ok(Buffer.isBuffer(stripped));
});
