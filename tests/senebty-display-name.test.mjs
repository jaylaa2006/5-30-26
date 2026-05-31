import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { capitalizeName, normalizeStoredName, substituteName } = require('../senebty/lib/display-name.js');

test('capitalizeName basic', () => {
  assert.equal(capitalizeName('ing'), 'Ing');
  assert.equal(capitalizeName('King'), 'King');
  assert.equal(capitalizeName('alex'), 'Alex');
});
test('capitalizeName preserves multi-char names', () => {
  assert.equal(capitalizeName('mary jane'), 'Mary jane'); // only first char (full-word title-case is separate concern)
});
test('capitalizeName handles empty/null/whitespace', () => {
  assert.equal(capitalizeName(''), '');
  assert.equal(capitalizeName(null), null);
  assert.equal(capitalizeName(undefined), undefined);
  assert.equal(capitalizeName('  '), '');
  assert.equal(capitalizeName('  ing  '), 'Ing');
});
test('normalizeStoredName same shape', () => {
  assert.equal(normalizeStoredName('ing'), 'Ing');
  assert.equal(normalizeStoredName('Ing'), 'Ing');
  assert.equal(normalizeStoredName(' ing '), 'Ing');
});
test('substituteName replaces all {name}', () => {
  assert.equal(substituteName('Hotep {name}, are you {name}?', 'ing'), 'Hotep Ing, are you Ing?');
});
test('substituteName falls back to "friend" for empty name', () => {
  assert.equal(substituteName('Hotep {name}', null), 'Hotep friend');
  assert.equal(substituteName('Hotep {name}', ''), 'Hotep friend');
});
test('substituteName returns "" for empty template', () => {
  assert.equal(substituteName('', 'ing'), '');
  assert.equal(substituteName(null, 'ing'), '');
});
