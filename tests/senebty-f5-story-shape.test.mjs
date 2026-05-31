// tests/senebty-f5-story-shape.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FOUNDATION_WEDEHA } from '../senebty/data/foundations/05-wedeha/story.js';

test('FOUNDATION_WEDEHA shape', () => {
  assert.equal(FOUNDATION_WEDEHA.id, 'foundation-5-wedeha');
  assert.equal(FOUNDATION_WEDEHA.powerWord, 'WEDEHA');
  assert.equal(FOUNDATION_WEDEHA.type, 'foundation');
  assert.equal(FOUNDATION_WEDEHA.level, 1);
  const l1 = FOUNDATION_WEDEHA.chunks.filter(c => c.level === 1 || c.level == null);
  assert.equal(l1.length, 4, 'must have exactly 4 L1 chunks');
  assert.ok(FOUNDATION_WEDEHA.comprehensionPool.length >= 8, '>= 8 comprehension Qs');
  assert.equal(FOUNDATION_WEDEHA.iriCheckpoint.iriType, 'WEDEHA_PHOTO_IRI');
  assert.ok(Array.isArray(FOUNDATION_WEDEHA.citations));
  assert.ok(FOUNDATION_WEDEHA.citations.length >= 3, '>= 3 Africana citations');
});

test('FOUNDATION_WEDEHA chunks have Diop/Karenga/Finch citations across them', () => {
  const allText = FOUNDATION_WEDEHA.chunks.map(c => c.text).join(' ');
  assert.match(allText, /Diop/, 'cite Diop in at least one chunk');
  assert.match(allText, /Karenga/, 'cite Karenga');
  assert.match(allText, /Finch/, 'cite Finch');
});
