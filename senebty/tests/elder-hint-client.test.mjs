#!/usr/bin/env node
// senebty/tests/elder-hint-client.test.mjs
// Phase v3.34.0 — Elder hint client dispatcher pure-function unit tests.
// Targets senebty/lib/elder-hint-dispatcher.js (created in EH-2.2).
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

let dispatcherSrc = null;
try {
  dispatcherSrc = fs.readFileSync(new URL('../lib/elder-hint-dispatcher.js', import.meta.url), 'utf8');
} catch(e){}

let PASS=0, FAIL=0;
function check(name, fn){ try { fn(); console.log('PASS '+name); PASS++; } catch(e){ console.error('FAIL '+name+' — '+e.message); FAIL++; } }

if (!dispatcherSrc){
  check('dispatcher module exists at senebty/lib/elder-hint-dispatcher.js', () => {
    assert.fail('senebty/lib/elder-hint-dispatcher.js not yet created — implement in EH-2.2');
  });
} else {
  // Run module in vm sandbox
  const ctx = { window: {}, Senebty: {} };
  vm.createContext(ctx);
  vm.runInContext(dispatcherSrc, ctx);
  const D = ctx.window.Senebty?.elderHintDispatcher || ctx.Senebty?.elderHintDispatcher;

  check('dispatcher exposes pickElderHint, resolveOverride, buildPoolKey, buildHintId', () => {
    assert.ok(D, 'dispatcher object missing');
    assert.equal(typeof D.pickElderHint, 'function');
    assert.equal(typeof D.resolveOverride, 'function');
    assert.equal(typeof D.buildPoolKey, 'function');
    assert.equal(typeof D.buildHintId, 'function');
  });

  // buildPoolKey
  check('buildPoolKey composes pool/<persona>/<register>.<virtue>.<slot>', () => {
    assert.equal(D.buildPoolKey('elder', 'reflection', 'Truth', 'first'),
                 'pool/elder/reflection.Truth.first');
    assert.equal(D.buildPoolKey('young', 'comprehension', null, 'second'),
                 'pool/young/comprehension.second');
  });

  // buildHintId
  check('buildHintId for pool returns pool/<key>/<index>', () => {
    assert.equal(D.buildHintId('pool', 'pool/elder/reflection.Truth.first', 3),
                 'pool/elder/reflection.Truth.first/3');
  });
  check('buildHintId for ai returns ai/<requestId-prefix>', () => {
    assert.equal(D.buildHintId('ai', '76b004b77166b7ec'),
                 'ai/76b004b7');
  });
  check('buildHintId for curated returns curated/<storyId>/<key>/<index>', () => {
    assert.equal(D.buildHintId('curated', 'boundary-stone', 'reflection.Truth.first', 0),
                 'curated/boundary-stone/reflection.Truth.first/0');
  });

  // pickElderHint — Fisher-Yates with no-repeat
  check('pickElderHint returns first hint when seen set is empty', () => {
    const pool = ['a', 'b', 'c'];
    const seen = new Set();
    const picked = D.pickElderHint(pool, 'pool/test/key', seen);
    assert.ok(picked.text === 'a' || picked.text === 'b' || picked.text === 'c');
    assert.ok(picked.id.startsWith('pool/test/key/'));
    assert.ok(seen.has(picked.id));
  });
  check('pickElderHint avoids repeating across calls (no-repeat-until-exhausted)', () => {
    const pool = ['a', 'b', 'c'];
    const seen = new Set();
    const p1 = D.pickElderHint(pool, 'pool/test/key', seen);
    const p2 = D.pickElderHint(pool, 'pool/test/key', seen);
    const p3 = D.pickElderHint(pool, 'pool/test/key', seen);
    const ids = [p1.id, p2.id, p3.id];
    assert.equal(new Set(ids).size, 3, 'expected 3 distinct picks before exhaustion, got duplicates: ' + JSON.stringify(ids));
  });
  check('pickElderHint resets seen set when pool exhausted', () => {
    const pool = ['a', 'b'];
    const seen = new Set();
    const p1 = D.pickElderHint(pool, 'pool/test/key', seen);
    const p2 = D.pickElderHint(pool, 'pool/test/key', seen);
    // Pool exhausted — third call should reset and pick freshly
    const p3 = D.pickElderHint(pool, 'pool/test/key', seen);
    assert.ok(p3.text === 'a' || p3.text === 'b');
    // After exhaustion+reset+pick, seen should contain only the third pick
    assert.equal(seen.size, 1, 'seen should be cleared then re-populated; got ' + seen.size);
  });

  // resolveOverride — precedence: chunk-specific > story-array > null
  check('resolveOverride returns chunk-specific string when present', () => {
    const story = {
      elderHintOverrides: {
        'reflection.Truth.first.chunk-7': 'Specific chunk hint',
        'reflection.Truth.first': ['array hint 1', 'array hint 2']
      }
    };
    const result = D.resolveOverride(story, 'reflection', 'Truth', 'first', 7);
    assert.deepEqual(result, { type: 'chunk', text: 'Specific chunk hint', sourceTag: 'curated' });
  });
  check('resolveOverride falls back to story-array when no chunk match', () => {
    const story = {
      elderHintOverrides: {
        'reflection.Truth.first': ['array hint 1', 'array hint 2']
      }
    };
    const result = D.resolveOverride(story, 'reflection', 'Truth', 'first', 7);
    assert.equal(result.type, 'array');
    assert.deepEqual(result.pool, ['array hint 1', 'array hint 2']);
    assert.equal(result.sourceTag, 'curated');
  });
  check('resolveOverride returns null when no override matches', () => {
    const story = { elderHintOverrides: { 'comprehension.first': ['x'] } };
    const result = D.resolveOverride(story, 'reflection', 'Truth', 'first', 7);
    assert.equal(result, null);
  });
  check('resolveOverride returns null when story has no overrides field', () => {
    const story = { id: 'no-overrides-here' };
    const result = D.resolveOverride(story, 'reflection', 'Truth', 'first', 7);
    assert.equal(result, null);
  });
}

console.log(`\n${PASS} passing, ${FAIL} failing`);
process.exit(FAIL ? 1 : 0);
