#!/usr/bin/env node
// v3.44.5 — Source-pattern locks for the 3 forward bindings closed in this hotfix.
//   1. Tier sigil 404 fallback (senebty/lib/render.js)
//   2. Bridge Mode fetch-timeout telemetry (senebty/lib/bridge-mode.js)
//   3. Learn-more in-flight promise dedup (server.js — covered by
//      tests/learn-more-feed-resilience.test.mjs)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const renderSrc = fs.readFileSync('senebty/lib/render.js', 'utf8');
const bridgeSrc = fs.readFileSync('senebty/lib/bridge-mode.js', 'utf8');

test('v3.44.5 — tier sigil img has 404 onerror fallback to text', () => {
  // The img.addEventListener('error', ...) must hide the broken-image icon
  // and render a text fallback span. This is the surviving binding from the
  // v3.43.x consistency-coach RT (Voice 3 QA-DA finding).
  assert.match(renderSrc, /img\.addEventListener\(['"]error['"]/,
    'sigil img has error listener');
  assert.match(renderSrc, /senebty-tier-sigil-fallback/,
    'fallback span class defined');
  // Logged on 404 so prod regressions are diagnosable
  assert.match(renderSrc, /\[senebty\/render\][^']*tier sigil 404/,
    'structured warn log on sigil 404');
  // once:true so the fallback only renders once even if the browser fires
  // multiple error events
  assert.match(renderSrc, /\{\s*once:\s*true\s*\}/,
    'error listener uses { once: true }');
});

test('v3.44.5 — bridge fetch timeout emits bridge_fetch_timeout telemetry', () => {
  // setTimeout that aborts the fetch must also emit a structured telemetry
  // event so a hung origin is diagnosable.
  assert.match(bridgeSrc, /bridge_fetch_timeout/,
    'bridge_fetch_timeout event name emitted');
  // The timeout setter wraps emitTelemetry in addition to ctrl.abort().
  // Use a narrowly anchored grep against the multi-line setTimeout body.
  const m = bridgeSrc.match(/setTimeout\(function\s*\(\)\s*\{[\s\S]+?\},\s*FETCH_TIMEOUT_MS\)/);
  assert.ok(m, 'AbortController setTimeout setter found');
  assert.match(m[0], /emitTelemetry\(['"]bridge_fetch_timeout['"]/,
    'timeout setter calls emitTelemetry("bridge_fetch_timeout"...)');
  assert.match(m[0], /ctrl\.abort\(\)/,
    'timeout setter still calls ctrl.abort()');
  assert.match(m[0], /timedOut\s*=\s*true/,
    'timedOut flag set so caller can distinguish from generic abort');
});
