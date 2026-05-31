#!/usr/bin/env node
// tests/parent-pin-self-heal.test.mjs
// 2026-05-24 (v3.51.71) — symmetric PIN self-heal.
//
// Bug: parentPin is NEVER cloud-synced (by design). The client used the
// server's authoritative `hasPin` flag only to CLEAR a stale '__set__' sentinel
// (hasPin === false). It never RESTORED the sentinel when hasPin === true but
// the local marker was missing — so a fresh device/browser (or any user_data
// restored without the sentinel) prompted the parent to CREATE a PIN that
// already exists. Reported on jbouey2006@gmail.com (account has pin_hash=1).
//
// Fix: both reconcile sites (_syncUserProfile + the cloud-load) now self-heal
// symmetrically — hasPin true & no local sentinel → restore '__set__' so the
// gate prompts for PIN ENTRY, not creation. '__set__' is a UI sentinel only;
// the real PIN is still verified server-side.
//
// Run: node --test tests/parent-pin-self-heal.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const HTML = fs.readFileSync('maat-reader.html', 'utf8');

test('clear direction preserved: hasPin===false drops the stale sentinel', () => {
  assert.match(HTML, /data\.hasPin === false && this\.user\.parentPin/,
    '_syncUserProfile must still clear a stale sentinel when server reports no PIN');
  assert.match(HTML, /if\(data\.hasPin === false\) this\.user\.parentPin = null;/,
    'cloud-load must still clear a stale sentinel when server reports no PIN');
});

test('restore direction added: hasPin===true restores the sentinel (the fix)', () => {
  // _syncUserProfile site — guarded branch; the assignment + pinRestored flag
  // follow the condition (a long explanatory comment sits between, so allow a
  // generous window).
  assert.match(HTML, /else if\(data\.hasPin === true && !this\.user\.parentPin\)\{[\s\S]{0,900}this\.user\.parentPin = '__set__';[\s\S]{0,120}pinRestored = true;/,
    '_syncUserProfile must restore the __set__ sentinel + set pinRestored when server reports a PIN exists');
  // cloud-load site — exact one-liner.
  assert.match(HTML, /else if\(data\.hasPin === true && !this\.user\.parentPin\) this\.user\.parentPin = '__set__';/,
    'cloud-load must restore the __set__ sentinel when server reports a PIN exists');
});

test('restored sentinel is the UI marker, never a real PIN (no access granted)', () => {
  // Both reconcile sites must restore the literal '__set__' sentinel — never a
  // numeric PIN or server hash. Count the restore assignments.
  const restores = HTML.match(/data\.hasPin === true && !this\.user\.parentPin\)[\s\S]{0,900}?this\.user\.parentPin = '__set__'/g) || [];
  assert.ok(restores.length >= 2, `both reconcile sites must restore '__set__' (found ${restores.length})`);
  for (const r of restores) {
    assert.doesNotMatch(r, /pin_hash|pinH\b|data\.pin\b/,
      'restore branch must not reference any real PIN/hash value');
  }
});

test('parent gate re-renders when the PIN state is restored (create⇄enter flip)', () => {
  assert.match(HTML, /let pinRestored = false;/,
    'must track a pinRestored flag');
  assert.match(HTML, /if\(pinCleared \|\| pinRestored\)\{/,
    'gate must re-render on either clear OR restore so create/enter mode flips live');
});

console.log('[parent-pin-self-heal] all assertions passed');
