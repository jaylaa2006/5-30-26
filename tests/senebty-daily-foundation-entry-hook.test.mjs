// tests/senebty-daily-foundation-entry-hook.test.mjs — v3.51.66
// Wing-entry hook bindings: presence + DEFAULT-ON opt-OUT gating + legacy fallback.
// (v3.51.43 shipped opt-in/default-off; v3.51.66 flipped the default to ON now
// that all 8 Phase-2 foundations ship. Suppressed only by explicit opt-out:
// localStorage senebtyDailyRitualOptOut, URL senebtyDaily=0, or
// preferences.senebtyDailyRitual === false.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('maat-reader.html', 'utf8');

// Slice out the senebty case block once so all assertions test the same region.
function senebtyCaseSlice() {
  const start = html.indexOf("if (screen === 'senebty')");
  assert.ok(start > 0, "senebty case block must exist");
  // Find the closing brace of this case — approximate by locating the next top-level `if (screen === '...'` line.
  const nextCase = html.indexOf("if (screen === '", start + 30);
  return html.slice(start, nextCase > 0 ? nextCase : start + 6000);
}

test('senebty nav case references dailyFoundationGate', () => {
  assert.match(html, /dailyFoundationGate/, 'wing-entry hook must reference dailyFoundationGate');
});

test('senebty nav case references getTodaysFoundation', () => {
  assert.match(html, /getTodaysFoundation/, 'wing-entry hook must call getTodaysFoundation');
});

test('senebty nav case references dailyFoundationScreen.render', () => {
  assert.match(html, /dailyFoundationScreen\.render/, 'wing-entry hook must call dailyFoundationScreen.render');
});

test('senebty nav case references senebtyDailyFoundation screen id', () => {
  assert.match(html, /['"]senebtyDailyFoundation['"]/, 'wing-entry hook must show senebtyDailyFoundation screen');
});

test('hook gates on log[today].completed (not unconditional gate)', () => {
  assert.match(html, /dailyFoundationLog\[[^\]]+\][^;]*\.completed/, 'must check log[today].completed flag for fallthrough');
});

// v3.51.66 gating assertions — DEFAULT ON, opt-OUT model (was opt-in/default-off in v3.51.43)
test('gate DEFAULTS ON (let _dfGateEnabled = true)', () => {
  const slice = senebtyCaseSlice();
  assert.match(slice, /let\s+_dfGateEnabled\s*=\s*true/, 'gate must default to ON (Phase 2 complete — daily ritual is the default wing experience)');
  assert.doesNotMatch(slice, /let\s+_dfGateEnabled\s*=\s*false/, 'gate must NOT default to OFF (the v3.51.43 opt-in default was flipped in v3.51.66)');
});

test('opt-out gate: checks localStorage senebtyDailyRitualOptOut', () => {
  const slice = senebtyCaseSlice();
  assert.match(slice, /senebtyDailyRitualOptOut/, 'gate must read localStorage flag senebtyDailyRitualOptOut');
});

test('opt-out gate: checks URLSearchParams senebtyDaily', () => {
  const slice = senebtyCaseSlice();
  assert.match(slice, /senebtyDaily/, 'gate must read URLSearchParams senebtyDaily');
});

test('opt-out gate: WRITES opt-out localStorage when senebtyDaily=0 URL param present', () => {
  const slice = senebtyCaseSlice();
  assert.match(slice, /localStorage\.setItem\(\s*['"]senebtyDailyRitualOptOut['"]\s*,\s*['"]1['"]\s*\)/, 'senebtyDaily=0 must persist an opt-OUT flag to localStorage');
});

test('opt-out gate: CLEARS opt-out localStorage when senebtyDaily=1 URL param present', () => {
  const slice = senebtyCaseSlice();
  assert.match(slice, /localStorage\.removeItem\(\s*['"]senebtyDailyRitualOptOut['"]\s*\)/, 'senebtyDaily=1 must clear the opt-out flag (opt back in)');
});

test('opt-out gate: parent preference is authoritative (=== false suppresses, === true forces on)', () => {
  const slice = senebtyCaseSlice();
  assert.match(slice, /senebtyDailyRitual/, 'gate must read the senebtyDailyRitual preference (parent-dashboard toggle key)');
  assert.match(slice, /_dfPref\s*===\s*false/, 'pref === false must suppress the gate (parent opt-out)');
  assert.match(slice, /_dfPref\s*===\s*true/, 'pref === true must force the gate ON — authoritative over the per-device localStorage opt-out (Coach C5)');
});

test('A/B gate: emits console.log when gate evaluation runs', () => {
  const slice = senebtyCaseSlice();
  assert.match(slice, /console\.log\([^)]*senebty-entry[^)]*daily-ritual gate/, 'gate must log enabled-state for QA visibility');
});

test('A/B gate: logs error (not silent catch) when dailyFoundationGate undefined while gate enabled', () => {
  const slice = senebtyCaseSlice();
  assert.match(slice, /console\.error\([^)]*App\.dailyFoundationGate undefined/, 'must log when gate enabled but module missing — no silent fallthrough (Rule 1)');
});

test('A/B gate: logs error when dailyFoundationScreen undefined while gate enabled', () => {
  const slice = senebtyCaseSlice();
  assert.match(slice, /console\.error\([^)]*App\.dailyFoundationScreen undefined/, 'must log when gate enabled but screen module missing — Rule 1');
});

test('A/B gate: a11y — focuses first interactive element after gate render', () => {
  const slice = senebtyCaseSlice();
  // Match across multi-line setTimeout(() => { ... querySelector('button, ...') ... .focus(); }, 0)
  assert.match(slice, /querySelector\(['"`]button[^'"`]*['"`]\)[\s\S]{0,60}\.focus\(\)/, 'gate render path must focus a button/a/[tabindex] for keyboard users');
});
