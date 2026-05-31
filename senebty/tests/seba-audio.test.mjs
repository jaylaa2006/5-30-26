#!/usr/bin/env node
// senebty/tests/seba-audio.test.mjs
// Phase v3.33.0 — Seba audio robustness.
// Validates the 9 quip pools (extracted from maat-reader.html) and
// that every quip has a corresponding MP3 asset on disk.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const HTML = fs.readFileSync(new URL('../../maat-reader.html', import.meta.url), 'utf8');

// Brace-balancing object-literal extractor (handles strings + escapes).
function extractObjectLiteral(html, startMarker){
  const i = html.indexOf(startMarker);
  if (i === -1) throw new Error(`marker not found: ${startMarker}`);
  let j = html.indexOf('{', i);
  if (j === -1) throw new Error(`no { after ${startMarker}`);
  let depth = 0, k = j;
  while (k < html.length){
    const c = html[k];
    if (c === '{') depth++;
    else if (c === '}'){ depth--; if (depth === 0) break; }
    else if (c === "'" || c === '"' || c === '`'){
      const q = c; k++;
      while (k < html.length && html[k] !== q){
        if (html[k] === '\\') k++;
        k++;
      }
    }
    k++;
  }
  return html.slice(j, k + 1);
}

const YOUNG_SRC = extractObjectLiteral(HTML, 'YOUNG_SEBA_QUIPS:');
const ELDER_SRC = extractObjectLiteral(HTML, 'ELDER_SEBA_QUIPS:');
const ctx = { YOUNG: null, ELDER: null };
vm.createContext(ctx);
vm.runInContext(`YOUNG = ${YOUNG_SRC};`, ctx);
vm.runInContext(`ELDER = ${ELDER_SRC};`, ctx);

let PASS = 0, FAIL = 0;
function check(name, fn){
  try { fn(); console.log('PASS ' + name); PASS++; }
  catch(e){ console.error('FAIL ' + name + ' — ' + e.message); FAIL++; }
}

// 9 pools — keys must match the future on-disk directory naming convention
// public/audio/seba/<poolKey>/<idx>.mp3 (Task 5).
const POOLS = [
  ['young-mer', ctx.YOUNG.mer],
  ['young-sedjm', ctx.YOUNG.sedjm],
  ['young-rekh', ctx.YOUNG.rekh],
  ['young-celebration', ctx.YOUNG.celebration],
  ['young-achievement', ctx.YOUNG.achievement],
  ['elder-sema', ctx.ELDER.sema],
  ['elder-sema-daily', ctx.ELDER.semaDaily],
  ['elder-sema-redirect', ctx.ELDER.semaRedirect],
  ['elder-sema-approval', ctx.ELDER.semaApproval],
];

for (const [poolKey, arr] of POOLS){
  check(`pool ${poolKey} exists and is non-empty`, () => {
    assert.ok(Array.isArray(arr), `${poolKey} must be an array`);
    assert.ok(arr.length > 0, `${poolKey} is empty`);
  });
  check(`pool ${poolKey} every entry is a non-empty string`, () => {
    for (const q of arr){
      assert.ok(typeof q === 'string' && q.length > 0, `${poolKey} has empty/non-string entry`);
    }
  });
  check(`pool ${poolKey} every entry has a corresponding MP3 on disk`, () => {
    for (let i = 0; i < arr.length; i++){
      const mp3 = new URL(`../../public/audio/seba/${poolKey}/${i}.mp3`, import.meta.url);
      assert.ok(fs.existsSync(mp3), `missing audio asset: public/audio/seba/${poolKey}/${i}.mp3`);
    }
  });
}

// ── Phase B behaviour tests ─────────────────────────────────────────────────
// Stub Audio + DOM, run senebty/lib/seba-voice.js in a vm context, exercise
// the public API (Senebty.sebaVoice.play / buildTelemetryPayload). The module
// gets created in Seba Task 7; until then these tests FAIL with "not yet created".

class StubAudio {
  constructor(src){ this.src = src; this.playbackRate = 1.0; this.played = false; this.paused = false; }
  play(){ this.played = true; return Promise.resolve(); }
  pause(){ this.paused = true; }
  addEventListener(){}; removeEventListener(){};
}

function makeStubElement(){
  return {
    children: [], firstElementChild: null, textContent: '', innerHTML: '',
    appendChild(c){ this.children.push(c); this.firstElementChild = this.children[0]; return c; },
    setAttribute(k, v){ this['_attr_' + k] = v; },
    getAttribute(k){ return this['_attr_' + k]; },
    replaceChildren(){ this.children.length = 0; this.firstElementChild = null; this.textContent = ''; },
  };
}

let sebaVoiceSrc = null;
try { sebaVoiceSrc = fs.readFileSync(new URL('../lib/seba-voice.js', import.meta.url), 'utf8'); } catch(e){}

if (!sebaVoiceSrc){
  check('seba-voice module exists at senebty/lib/seba-voice.js', () => {
    assert.fail('senebty/lib/seba-voice.js not yet created — implement in Seba Task 7');
  });
} else {
  const sebaCtx = {
    window: { Senebty: {} },
    document: {
      createElement: (tag) => { const el = makeStubElement(); el.tagName = String(tag).toUpperCase(); return el; },
      addEventListener(){}, removeEventListener(){},
    },
    Audio: StubAudio,
    navigator: { sendBeacon: () => true },
    fetch: () => Promise.resolve({ ok: true }),
    Math, Date, Blob: function(){},
  };
  sebaCtx.Senebty = sebaCtx.window.Senebty;
  vm.createContext(sebaCtx);
  vm.runInContext(sebaVoiceSrc, sebaCtx);
  const sv = sebaCtx.window.Senebty.sebaVoice;

  check('Senebty.sebaVoice exposes play() and buildTelemetryPayload()', () => {
    assert.ok(typeof sv?.play === 'function', 'play missing');
    assert.ok(typeof sv?.buildTelemetryPayload === 'function', 'buildTelemetryPayload missing');
    assert.ok(typeof sv?.primeFirstGesture === 'function', 'primeFirstGesture missing');
  });

  check('play() renders caption text into containerEl regardless of audio result', () => {
    const container = makeStubElement();
    sv.play({ pool: 'young-mer', idx: 0, quip: 'I see you trying, young one.', persona: 'young' }, { containerEl: container, voiceMutedByUser: false });
    function findText(el){
      if (!el) return '';
      let s = el.textContent || '';
      for (const c of (el.children || [])) s += findText(c);
      return s;
    }
    const captionText = findText(container);
    assert.ok(captionText.includes('I see you'), 'caption not rendered, found: ' + JSON.stringify(captionText));
  });

  check('play() respects voiceMutedByUser=true (caption renders, audio does NOT play)', () => {
    let audioConstructed = false;
    const oldAudio = sebaCtx.Audio;
    sebaCtx.Audio = class { constructor(src){ this.src = src; this.playbackRate = 1.0; audioConstructed = true; } play(){ return Promise.resolve(); } pause(){} };
    const container = makeStubElement();
    sv.play({ pool: 'young-mer', idx: 0, quip: 'X', persona: 'young' }, { containerEl: container, voiceMutedByUser: true });
    assert.equal(audioConstructed, false, 'audio constructor must NOT be called when muted');
    sebaCtx.Audio = oldAudio;
  });

  check('play() sets playbackRate=0.85 for elder persona', () => {
    let captured = null;
    const oldAudio = sebaCtx.Audio;
    sebaCtx.Audio = class { constructor(src){ this.src = src; this.playbackRate = 1.0; captured = this; } play(){ return Promise.resolve(); } pause(){} };
    const container = makeStubElement();
    sv.play({ pool: 'elder-sema', idx: 0, quip: 'Y', persona: 'elder' }, { containerEl: container, voiceMutedByUser: false });
    assert.equal(captured?.playbackRate, 0.85);
    sebaCtx.Audio = oldAudio;
  });

  check('play() sets playbackRate=1.0 for young persona', () => {
    let captured = null;
    const oldAudio = sebaCtx.Audio;
    sebaCtx.Audio = class { constructor(src){ this.src = src; this.playbackRate = 1.0; captured = this; } play(){ return Promise.resolve(); } pause(){} };
    const container = makeStubElement();
    sv.play({ pool: 'young-mer', idx: 0, quip: 'Z', persona: 'young' }, { containerEl: container, voiceMutedByUser: false });
    assert.equal(captured?.playbackRate, 1.0);
    sebaCtx.Audio = oldAudio;
  });

  check('buildTelemetryPayload() shape matches schema', () => {
    const p = sv.buildTelemetryPayload({ tag:'t', pool:'young-mer', persona:'young', fired:true, captionRendered:true, voiceMutedByUser:false, errorClass:null });
    assert.equal(typeof p.tag, 'string');
    assert.equal(typeof p.pool, 'string');
    assert.equal(typeof p.persona, 'string');
    assert.equal(typeof p.fired, 'boolean');
    assert.equal(typeof p.captionRendered, 'boolean');
    assert.equal(typeof p.voiceMutedByUser, 'boolean');
    assert.ok(p.errorClass === null || typeof p.errorClass === 'string');
    assert.ok(typeof p.ts === 'number');
  });

  check('buildTelemetryPayload() coerces errorClass non-null to truncated string', () => {
    const long = 'x'.repeat(200);
    const p = sv.buildTelemetryPayload({ tag:'t', pool:'young-mer', persona:'young', fired:false, captionRendered:true, voiceMutedByUser:false, errorClass: long });
    assert.equal(typeof p.errorClass, 'string');
    assert.ok(p.errorClass.length <= 80, `errorClass should be truncated to ≤80, got ${p.errorClass.length}`);
  });
}

console.log(`\n${PASS} passing, ${FAIL} failing`);
process.exit(FAIL ? 1 : 0);
