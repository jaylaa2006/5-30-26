#!/usr/bin/env node
// tests/senebty-foundation-reflection.test.mjs
// v3.51.40 — End-of-foundation Sunu / Aset reflection card.
// User binding 2026-05-17: full system = "1-2 MCQ pulses per chunk + Sunu
// reflection at end of foundation + Seba dialogue voice". This suite
// asserts the reflection card renders correctly, the textarea word-count
// works, the dialogue bubble shows the right speaker (Sunu Merytamun for
// F1, Aset for F2), and the submit hits /api/seba-evaluate with the
// foundation context payload.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import fs from 'node:fs';

const src = fs.readFileSync('senebty/lib/foundation-render.js', 'utf8');

function bootDom(appStub) {
  return new JSDOM(
    `<!doctype html><html><body>
       <section id="senebtyFoundation">
         <div class="senebty-foundation-stage">
           <div id="senebtyFoundationGlyph"></div>
           <div id="senebtyFoundationCopy"></div>
           <div id="senebtyFoundationCounter"></div>
           <div id="senebtyFoundationVessel"></div>
           <button id="senebtyFoundationCta"></button>
         </div>
       </section>
       <script>
         window.matchMedia = function(q){ return { matches: /reduced-motion/.test(q), media: q, addEventListener: function(){}, removeEventListener: function(){}, addListener: function(){}, removeListener: function(){} }; };
         window.App = ${JSON.stringify(appStub || {})};
       </script>
       <script>${src}</script>
     </body></html>`,
    { url: 'http://localhost/', runScripts: 'dangerously' }
  );
}

function singleChunkPulseStory(reflectionOverrides) {
  return {
    chunks: [{ level: 1, sebaIntro: 'i0', text: 't0', sebaAfter: 'a0' }],
    comprehensionPool: [
      { kind: 'character', q: 'Q0?', a: 'A0', distractors: ['x', 'y', 'z'] },
      { kind: 'character', q: 'Q1?', a: 'A1', distractors: ['x', 'y', 'z'] },
    ],
    iriCheckpoint: {},
    sunuReflection: Object.assign({
      speaker: 'Sunu Merytamun',
      speakerGlyph: '𓋹',
      principle: 'Greeting the Body',
      storyContext: 'Sitra context',
      sebaIntro: 'Hello {name}, the sunu listens.',
      prompt: 'Tell {name} about your body.',
      sebaAfter: 'Goodbye {name}.',
      minimumWords: 15,
    }, reflectionOverrides || {}),
  };
}

// Drive the state machine to the reflection phase.
function toReflection(dom) {
  const w = dom.window, doc = w.document;
  let iriReached = false;
  w.Senebty.foundationRender.run(w.App, {
    lessonId: 'x', foundationKey: 'mu', story: singleChunkPulseStory(),
    isCompleted: () => false, recordIri: () => {},
    renderIri: () => { iriReached = true; },
  });
  const cta = doc.getElementById('senebtyFoundationCta');
  // chunk 0: intro → text → after → pulse 1
  cta.onclick(); cta.onclick(); cta.onclick();
  // answer pulse 1
  doc.querySelectorAll('.senebty-fc-pulse-option')[0].click();
  cta.onclick(); // → pulse 2
  doc.querySelectorAll('.senebty-fc-pulse-option')[0].click();
  cta.onclick(); // → reflection
  return { w, doc, cta, getIriReached: () => iriReached };
}

test('reflection card renders with Sunu dialogue bubble + textarea + word-count', () => {
  const dom = bootDom({ user: { name: 'Ted' } });
  const { doc } = toReflection(dom);
  const card = doc.querySelector('.senebty-fc-reflection');
  assert.ok(card, '.senebty-fc-reflection card present');
  // Dialogue bubble
  const dialogue = doc.querySelector('.senebty-fc-seba-dialogue');
  assert.ok(dialogue, 'sunu/aset dialogue bubble present');
  const name = doc.querySelector('.senebty-fc-seba-name');
  assert.equal(name.textContent, 'Sunu Merytamun', 'speaker name is Sunu Merytamun for F1');
  const intro = doc.querySelector('.senebty-fc-seba-intro');
  assert.match(intro.textContent, /Ted/, 'sebaIntro {name} token resolved to child name');
  assert.equal(doc.querySelector('.senebty-fc-seba-avatar').textContent, '𓋹',
    'ankh glyph placeholder rendered');
  // Prompt + textarea
  const prompt = doc.querySelector('.senebty-fc-reflection-prompt');
  assert.match(prompt.textContent, /Ted/, 'prompt {name} token resolved');
  const ta = doc.querySelector('.senebty-fc-reflection-textarea');
  assert.ok(ta, 'textarea present');
  assert.ok(ta.getAttribute('aria-label'), 'textarea has aria-label');
  // Word count
  const wc = doc.querySelector('.senebty-fc-reflection-wordcount');
  assert.ok(wc, 'word-count element present');
  assert.equal(wc.getAttribute('aria-live'), 'polite', 'word-count is aria-live polite');
  assert.match(wc.textContent, /15 words/, 'minimum-words floor (15) announced');
  // Submit button
  const btn = doc.querySelector('.senebty-fc-reflection-btn');
  assert.ok(btn, 'submit button present');
  assert.match(btn.textContent, /Sunu Merytamun/, 'submit names the speaker');
});

test('word-count input updates on textarea input', () => {
  const dom = bootDom({ user: { name: 'Ted' } });
  const { doc, w } = toReflection(dom);
  const ta = doc.querySelector('.senebty-fc-reflection-textarea');
  const wc = doc.querySelector('.senebty-fc-reflection-wordcount');
  ta.value = 'one two three';
  ta.dispatchEvent(new w.Event('input'));
  assert.match(wc.textContent, /3 of 15/, 'below-floor word count shows progress');
  ta.value = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen';
  ta.dispatchEvent(new w.Event('input'));
  assert.match(wc.textContent, /16 words/, 'at-or-above floor word count drops the "of N" copy');
});

test('Aset speaker variant renders for asetReflection (F2)', () => {
  const dom = bootDom({ user: { name: 'Ted' } });
  const w = dom.window, doc = w.document;
  const story = {
    chunks: [{ level: 1, sebaIntro: 'i', text: 't', sebaAfter: 'a' }],
    comprehensionPool: [],
    iriCheckpoint: {},
    asetReflection: {
      speaker: 'Aset',
      speakerGlyph: '𓋹',
      principle: 'Daily check across khat, ib, ka, and ba',
      storyContext: 'Tanu context',
      sebaIntro: '{name}, Aset listens.',
      prompt: 'Tell Aset, {name}.',
      sebaAfter: 'Aset hears you, {name}.',
      minimumWords: 15,
    },
  };
  w.Senebty.foundationRender.run(w.App, {
    lessonId: 'x', foundationKey: 'four-treasures', story,
    isCompleted: () => false, recordIri: () => {}, renderIri: () => {},
  });
  const cta = doc.getElementById('senebtyFoundationCta');
  cta.onclick(); cta.onclick(); cta.onclick(); // intro → text → after → reflection (no pulse pool)
  const name = doc.querySelector('.senebty-fc-seba-name');
  assert.equal(name.textContent, 'Aset', 'speaker is Aset for F2');
});

test('submit blocked when word-count below minimum (focus restored)', () => {
  const dom = bootDom({ user: { name: 'Ted' } });
  const { doc, w } = toReflection(dom);
  const ta = doc.querySelector('.senebty-fc-reflection-textarea');
  const btn = doc.querySelector('.senebty-fc-reflection-btn');
  ta.value = 'too short';
  ta.dispatchEvent(new w.Event('input'));
  btn.click();
  // Submit must not have fired the fetch (button still shows submit label).
  assert.match(btn.textContent, /Share with/, 'button label unchanged when word-count below floor');
  assert.equal(btn.disabled, false, 'button not disabled when submit was rejected');
});

test('submit fires fetch to /api/seba-evaluate with foundation payload', async () => {
  const dom = bootDom({ user: { name: 'Ted' } });
  const { doc, w } = toReflection(dom);
  // Stub fetch in the JSDOM window.
  let lastCall = null;
  w.fetch = async function (url, opts) {
    lastCall = { url, opts };
    return {
      ok: true,
      json: async () => ({ sebaResponse: 'The sunu hears you, Ted. The body remembers.' }),
    };
  };
  const ta = doc.querySelector('.senebty-fc-reflection-textarea');
  const btn = doc.querySelector('.senebty-fc-reflection-btn');
  ta.value = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen';
  ta.dispatchEvent(new w.Event('input'));
  btn.click();
  // Wait a tick for the promise chain to resolve.
  await new Promise(r => setTimeout(r, 30));
  assert.ok(lastCall, 'fetch was called');
  assert.match(String(lastCall.url), /\/api\/seba-evaluate$/, 'POSTs to /api/seba-evaluate');
  const body = JSON.parse(lastCall.opts.body);
  assert.equal(body.principle, 'Greeting the Body', 'F1 principle sent');
  assert.equal(body.foundationKey, 'mu', 'foundationKey sent');
  assert.equal(body.mode, 'senebtyFoundation', 'forward-compatible mode discriminator sent');
  assert.match(body.storyTitle, /Senebty Foundation/, 'storyTitle is namespaced for the Senebty side');
  assert.equal(body.childName, 'Ted', 'childName from app.user.name');
  // Reply rendered.
  const reply = doc.querySelector('.senebty-fc-reflection-reply');
  assert.match(reply.textContent, /sunu hears you/i, 'sebaResponse rendered in the reply slot');
  // Button now advances to iri (second click).
  assert.match(btn.textContent, /On to iri/i, 'button advances to iri after successful eval');
});

test('eval failure (fetch reject) shows graceful fallback, never strands the child', async () => {
  const dom = bootDom({ user: { name: 'Ted' } });
  const { doc, w } = toReflection(dom);
  w.fetch = async function () { throw new Error('network down'); };
  // Silence the expected console.error so the test output stays clean.
  w.console.error = () => {};
  const ta = doc.querySelector('.senebty-fc-reflection-textarea');
  const btn = doc.querySelector('.senebty-fc-reflection-btn');
  ta.value = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen';
  ta.dispatchEvent(new w.Event('input'));
  btn.click();
  await new Promise(r => setTimeout(r, 30));
  const reply = doc.querySelector('.senebty-fc-reflection-reply');
  assert.ok(reply.textContent.length > 0, 'fallback message shown on eval failure');
  assert.match(btn.textContent, /On to iri/i, 'button still advances after failure (no stranding)');
});

test('On to iri click hands off to renderIri (handoff phase)', async () => {
  const dom = bootDom({ user: { name: 'Ted' } });
  const { doc, w, cta, getIriReached } = toReflection(dom);
  w.fetch = async function () {
    return { ok: true, json: async () => ({ sebaResponse: 'ok' }) };
  };
  const ta = doc.querySelector('.senebty-fc-reflection-textarea');
  const btn = doc.querySelector('.senebty-fc-reflection-btn');
  ta.value = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen';
  ta.dispatchEvent(new w.Event('input'));
  btn.click();
  await new Promise(r => setTimeout(r, 30));
  // Second click on the same button (now labeled "On to iri") advances.
  btn.click();
  assert.equal(getIriReached(), true, 'renderIri reached after reflection submit + advance');
});

test('F1 story.js exports sunuReflection with required shape', () => {
  const src = fs.readFileSync('senebty/data/foundations/01-mu/story.js', 'utf8');
  assert.match(src, /sunuReflection\s*:\s*\{/, 'sunuReflection key present');
  assert.match(src, /speaker\s*:\s*['"]Sunu Merytamun['"]/, 'speaker is Sunu Merytamun');
  assert.match(src, /principle\s*:\s*['"]Greeting the Body['"]/, 'principle declared');
  assert.match(src, /minimumWords\s*:\s*15/, 'minimumWords floor declared');
});

test('F2 story.js exports asetReflection with required shape', () => {
  const src = fs.readFileSync('senebty/data/foundations/02-four-treasures/story.js', 'utf8');
  assert.match(src, /asetReflection\s*:\s*\{/, 'asetReflection key present');
  assert.match(src, /speaker\s*:\s*['"]Aset['"]/, 'speaker is Aset');
  assert.match(src, /khat.*ib.*ka.*ba/i, 'principle names the four treasures');
  assert.match(src, /minimumWords\s*:\s*15/, 'minimumWords floor declared');
});
