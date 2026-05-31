#!/usr/bin/env node
// tests/senebty-foundation-render.test.mjs
// Client-side unit tests for senebty/lib/foundation-render.js (M4 Task 9).
// jsdom with runScripts: 'dangerously' — the supported senebty test pattern.
//
// Run: node --test tests/senebty-foundation-render.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import fs from 'node:fs';

const src = fs.readFileSync('senebty/lib/foundation-render.js', 'utf8');

// Minimal #senebtyFoundation host DOM, matching the structure the foundation
// modules read today.
function bootDom(appStub) {
  // v3.51.16 — mock matchMedia so foundation-render's cinematic fade
  // detects prefers-reduced-motion=true in tests → falls back to instant
  // swap. Otherwise the JS fade (~280ms) would race the test's synchronous
  // click()→assert() pattern.
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

test('foundationRender namespace + installer are exposed', () => {
  const dom = bootDom();
  const w = dom.window;
  assert.equal(typeof w.Senebty.foundationRender, 'object', 'window.Senebty.foundationRender missing');
  assert.equal(typeof w.Senebty.foundationRender.run, 'function', 'run() missing');
  assert.equal(typeof w.__InstallFoundationRender__, 'function', '__InstallFoundationRender__ missing');
});

test('__InstallFoundationRender__ is idempotent and fails loud on bad target', () => {
  const dom = bootDom();
  const w = dom.window;
  const app = {};
  assert.equal(w.__InstallFoundationRender__(app), true, 'first install should return true');
  assert.equal(w.__InstallFoundationRender__(app), true, 'second install should be idempotent true');
  assert.equal(app.foundationRender, w.Senebty.foundationRender, 'installer attaches the api');
  assert.equal(w.__InstallFoundationRender__(null), false, 'invalid target returns false');
});

test('run() with no story shows the not-loaded message, no CTA', () => {
  const dom = bootDom();
  const w = dom.window;
  w.Senebty.foundationRender.run(w.App, {
    lessonId: 'foundation-2-four-treasures', foundationKey: 'four-treasures',
    story: null, isCompleted: () => false, recordIri: () => {}, renderIri: () => {},
  });
  const copy = dom.window.document.getElementById('senebtyFoundationCopy');
  const cta = dom.window.document.getElementById('senebtyFoundationCta');
  assert.match(copy.textContent, /not loaded|refresh/i);
  assert.equal(cta.style.display, 'none');
});

test('run() with isCompleted()===true shows done-state + Back to gate CTA', () => {
  const navCalls = [];
  const dom = bootDom({ nav: undefined });
  const w = dom.window;
  w.App.nav = (screen) => navCalls.push(screen);
  w.Senebty.foundationRender.run(w.App, {
    lessonId: 'foundation-2-four-treasures', foundationKey: 'four-treasures',
    story: { iriCheckpoint: { sebaPostIri: 'You have iri. {name}, the path remembers.' } },
    isCompleted: () => true, recordIri: () => {}, renderIri: () => {},
  });
  const copy = dom.window.document.getElementById('senebtyFoundationCopy');
  const cta = dom.window.document.getElementById('senebtyFoundationCta');
  assert.match(copy.textContent, /You have iri/);
  assert.ok(!copy.textContent.includes('{name}'), '{name} token must be resolved, not rendered literally');
  assert.equal(cta.textContent, 'Back to gate');
  cta.onclick();
  assert.deepEqual(navCalls, ['senebty']);
});

// v3.51.14 — IMG-path tests use deterministically-fake foundation keys
// so they don't break when VEO_AVAILABLE expands (recurrence of v3.51.6
// failure mode). Pattern: any chunk-combo NOT in the VEO_AVAILABLE map
// will route through the <img> branch. 'test-noveo' is reserved as the
// fake key for IMG-path tests across this suite. See the project law at
// .claude/rules/two-stage-qa-protocol.md (Stage-1 RT enforcement).
test('_renderArtSlot builds the senebty art URL with cache-buster', () => {
  const dom = bootDom({ ART_CACHE_VERSION: '20260514a' });
  const w = dom.window;
  const slot = dom.window.document.createElement('div');
  w.Senebty.foundationRender._renderArtSlot(slot, w.App,
    { foundationKey: 'test-noveo', glyph: undefined }, 99);
  const img = slot.querySelector('img.senebty-fc-art-img');
  assert.ok(img, 'art img created (test-noveo guarantees IMG branch)');
  assert.equal(img.getAttribute('src'),
    '/art/senebty/foundations/test-noveo/chunk-99.png?v=20260514a');
});

test('_renderArtSlot onerror → lapis-field fallback, glyph present', () => {
  const dom = bootDom({ ART_CACHE_VERSION: '0' });
  const w = dom.window;
  const slot = dom.window.document.createElement('div');
  // test-noveo + glyph forces the IMG branch + lapis fallback with glyph.
  w.Senebty.foundationRender._renderArtSlot(slot, w.App,
    { foundationKey: 'test-noveo', glyph: '\u{1342B}' }, 88);
  const img = slot.querySelector('img');
  img.dispatchEvent(new dom.window.Event('error'));
  const fb = slot.querySelector('.senebty-fc-art-fallback');
  assert.ok(fb, 'fallback div created');
  assert.equal(fb.querySelector('.senebty-fc-art-glyph').textContent, '\u{1342B}');
  assert.equal(img.style.display, 'none');
});

// v3.51.14 — positive VIDEO-path coverage (Maya binding). Regression alert
// if the VIDEO branch ever fails to render <video> for a chunk in the
// VEO_AVAILABLE map.
test('_renderArtSlot renders <video> when chunk has a VEO_AVAILABLE entry', () => {
  const dom = bootDom({ ART_CACHE_VERSION: '0' });
  const w = dom.window;
  // v3.51.16 — bootDom mocks matchMedia to TRUE for reduced-motion (so the
  // cinematic fade falls back to instant swap in tests). But _renderArtSlot
  // also reads matchMedia and falls back to <img> in reduced-motion mode.
  // Override here so this specific test exercises the VIDEO path.
  w.matchMedia = function(q){ return { matches: false, media: q, addEventListener:function(){}, removeEventListener:function(){}, addListener:function(){}, removeListener:function(){} }; };
  const slot = dom.window.document.createElement('div');
  // khaemwaset-0 has been in VEO_AVAILABLE since v3.51.0 — deterministic.
  w.Senebty.foundationRender._renderArtSlot(slot, w.App,
    { foundationKey: 'khaemwaset', glyph: undefined }, 0);
  const video = slot.querySelector('video.senebty-fc-art-video');
  assert.ok(video, '<video> element created for chunks with Veo');
  assert.match(video.getAttribute('src'), /^\/videos\/senebty-rituals\/khaemwaset-chunk-0/);
  // Static PNG poster must be set for the prefers-reduced-motion fallback.
  assert.match(video.getAttribute('poster'), /^\/art\/senebty\/foundations\/khaemwaset\/chunk-0\.png/);
  // Decorative — must be hidden from screen readers.
  assert.equal(video.getAttribute('aria-hidden'), 'true');
});

// v3.51.14 — VEO_AVAILABLE snapshot. Catches accidental deletion of
// entries during refactors (Performance binding). If the snapshot count
// is intentionally reduced, update it here in the same commit and
// document the deletion.
// v3.51.14 Coach #4 — exact-count snapshot. Each VEO_AVAILABLE delta is a
// deliberate noticed change; update this number in the SAME commit that
// adds/removes a map entry. The closure-private map is exposed as
// _VEO_AVAILABLE on the module surface (READ-ONLY — mutations leak into
// production; tests needing mutation must clone-and-restore).
// v3.51.18 Coach #2 — positive vocab-wrapping test. With GLOSSARY +
// App.wordTap present, chunk text containing a known glossary term must
// render with a clickable .vocab span (not plain text). Without these,
// the helper degrades to plain text (graceful fallback).
test('chunk text wraps glossary terms with .vocab tap-targets when GLOSSARY + App.wordTap exist', () => {
  const dom = bootDom({ ART_CACHE_VERSION: '0' });
  const w = dom.window;
  // Wire a minimal GLOSSARY + App.wordTap on the window so _renderWithVocab
  // recognizes a known term ("mu") and attaches the click handler.
  w.GLOSSARY = { 'mu': { name: 'mu', brief: 'water' } };
  let tapped = null;
  w.App.wordTap = function (term) { tapped = term; };

  const story = {
    chunks: [{ level: 1, sebaIntro: 'Hear about mu, friend.', text: 'The mu is the water.', sebaAfter: 'Sit with mu.' }],
    comprehensionPool: [],
    iriCheckpoint: {},
  };
  w.Senebty.foundationRender.run(w.App, {
    lessonId: 'x', foundationKey: 'test-noveo', story: story,
    isCompleted: () => false, recordIri: () => {}, renderIri: () => {},
  });
  // After run, we're in chunk-intro phase; click READ once to advance to chunk-text.
  const cta = w.document.getElementById('senebtyFoundationCta');
  const copy = w.document.getElementById('senebtyFoundationCopy');
  // chunk-intro shows "Hear about mu, friend." — assert mu is wrapped.
  const introVocab = copy.querySelectorAll('.vocab');
  assert.ok(introVocab.length >= 1, 'chunk-intro mu must be wrapped in .vocab span');
  assert.equal(introVocab[0].dataset.word, 'mu');
  assert.equal(introVocab[0].getAttribute('role'), 'button');
  assert.equal(introVocab[0].getAttribute('tabindex'), '0');
  // Click the span — should fire App.wordTap('mu').
  introVocab[0].click();
  assert.equal(tapped, 'mu', 'click on vocab span calls App.wordTap with the term');
});

test('VEO_AVAILABLE exact count snapshot (deliberate-delta discipline)', () => {
  const dom = bootDom({});
  const w = dom.window;
  const map = w.Senebty.foundationRender._VEO_AVAILABLE;
  assert.ok(map, 'VEO_AVAILABLE exposed for inspection');
  const count = Object.keys(map).length;
  const EXPECTED = 36; // 10 prior ritual + 26 wave-1 = 36 at v3.51.14
  assert.equal(count, EXPECTED,
    `VEO_AVAILABLE has ${count} entries; expected exactly ${EXPECTED}. ` +
    `If your commit adds or removes Veos, update EXPECTED in this test in the SAME commit.`);
});

test('_renderArtSlot onerror → lapis-field fallback, NO glyph (NONE/DROP foundations)', () => {
  const dom = bootDom({ ART_CACHE_VERSION: '0' });
  const w = dom.window;
  const slot = dom.window.document.createElement('div');
  // v3.51.5 — _renderArtSlot now renders <video> when the chunk has a Veo
  // entry in VEO_AVAILABLE. Use a fake foundation+chunk combo guaranteed
  // to be off the VEO_AVAILABLE map so the <img> fallback path is exercised.
  w.Senebty.foundationRender._renderArtSlot(slot, w.App,
    { foundationKey: 'test-noveo', glyph: undefined }, 99);
  slot.querySelector('img').dispatchEvent(new dom.window.Event('error'));
  const fb = slot.querySelector('.senebty-fc-art-fallback');
  assert.ok(fb, 'fallback div created');
  assert.equal(fb.querySelector('.senebty-fc-art-glyph'), null, 'no glyph span when glyph absent');
});

// Minimal 2-chunk story fixture, no comprehension, no iri — isolates the
// chunk state machine. renderIri records that it was reached.
function chunkOnlyStory() {
  return {
    chunks: [
      { level: 1, sebaIntro: 'Hear this, {name}.', text: 'The first teaching.', sebaAfter: 'Sit with it.' },
      { level: 1, sebaIntro: 'And now this.', text: 'The second teaching.', sebaAfter: 'Sit again.' },
    ],
    comprehensionPool: [],
    iriCheckpoint: {},
  };
}

test('chunk state machine: intro → text → after → next chunk → handoff', () => {
  const dom = bootDom({ user: { name: 'Ted' } });
  const w = dom.window;
  const doc = w.document;
  let iriReached = false;
  w.Senebty.foundationRender.run(w.App, {
    lessonId: 'x', foundationKey: 'four-treasures', story: chunkOnlyStory(),
    isCompleted: () => false, recordIri: () => {},
    renderIri: () => { iriReached = true; },
  });
  const copy = doc.getElementById('senebtyFoundationCopy');
  const cta = doc.getElementById('senebtyFoundationCta');

  assert.equal(copy.textContent, 'Hear this, Ted.', 'chunk-intro shows resolved sebaIntro');
  assert.equal(cta.textContent, 'Read');

  cta.onclick();
  assert.equal(copy.textContent, 'The first teaching.', 'chunk-text shows chunk.text');
  assert.equal(cta.textContent, 'Continue');

  cta.onclick();
  assert.equal(copy.textContent, 'Sit with it.', 'chunk-after shows resolved sebaAfter');
  assert.equal(cta.textContent, 'Next chunk');

  cta.onclick(); // → chunk 2 intro
  assert.equal(copy.textContent, 'And now this.');
  cta.onclick(); cta.onclick(); // text, after
  assert.equal(cta.textContent, 'On to comprehension', 'last chunk after → comprehension label');

  cta.onclick(); // empty comprehensionPool → straight to handoff
  assert.equal(iriReached, true, 'renderIri reached after chunks (empty comp pool)');
});

test('run() called twice does not leak a stale art slot', () => {
  const dom = bootDom({ user: { name: 'T' } });
  const w = dom.window;
  const cfg = {
    lessonId: 'x', foundationKey: 'four-treasures', story: chunkOnlyStory(),
    isCompleted: () => false, recordIri: () => {}, renderIri: () => {},
  };
  w.Senebty.foundationRender.run(w.App, cfg);
  w.Senebty.foundationRender.run(w.App, cfg);  // re-render
  const slots = w.document.querySelectorAll('#senebtyFoundation .senebty-foundation-stage .senebty-fc-art');
  assert.equal(slots.length, 1, 'exactly one art slot after a re-render — no leak');
});

function compStory() {
  return {
    chunks: [{ level: 1, sebaIntro: 'i', text: 't', sebaAfter: 'a' }],
    comprehensionPool: [
      { kind: 'character', q: 'Who is the boy?', a: 'Kahotep', distractors: ['Senka', 'Ahmose', 'Iry'] },
      { kind: 'maat', q: 'What is Maat?', a: 'Balance', distractors: ['Chaos', 'Night', 'Stone'] },
    ],
    iriCheckpoint: {},
  };
}

// Drive the helper to the first comprehension question.
function toFirstQuestion(dom) {
  const w = dom.window, doc = w.document;
  let ctxSeen = null;
  w.Senebty.foundationRender.run(w.App, {
    lessonId: 'x', foundationKey: 'four-treasures', story: compStory(),
    isCompleted: () => false, recordIri: () => {},
    renderIri: (app, ctx) => { ctxSeen = ctx; },
  });
  const cta = doc.getElementById('senebtyFoundationCta');
  cta.onclick(); cta.onclick(); cta.onclick(); // intro → text → after → comp
  return { w, doc, cta, getCtx: () => ctxSeen };
}

test('MCQ renders 4 options (a + 3 distractors)', () => {
  const dom = bootDom({ user: { name: 'T' } });
  const { doc } = toFirstQuestion(dom);
  const opts = doc.querySelectorAll('.senebty-fc-mcq-option');
  assert.equal(opts.length, 4);
  const labels = [...opts].map(o => o.textContent).sort();
  assert.deepEqual(labels, ['Ahmose', 'Iry', 'Kahotep', 'Senka']);
});

test('MCQ option order is deterministic across re-render (seeded by question)', () => {
  const order1 = (() => {
    const { doc } = toFirstQuestion(bootDom({ user: { name: 'T' } }));
    return [...doc.querySelectorAll('.senebty-fc-mcq-option')].map(o => o.textContent);
  })();
  const order2 = (() => {
    const { doc } = toFirstQuestion(bootDom({ user: { name: 'T' } }));
    return [...doc.querySelectorAll('.senebty-fc-mcq-option')].map(o => o.textContent);
  })();
  assert.deepEqual(order1, order2, 'same question → same option order');
});

test('MCQ one-try-reveal: wrong pick highlights correct, advances, tallies', () => {
  const dom = bootDom({ user: { name: 'T' } });
  const { doc, cta, getCtx } = toFirstQuestion(dom);
  const opts = [...doc.querySelectorAll('.senebty-fc-mcq-option')];
  const wrong = opts.find(o => o.textContent !== 'Kahotep');
  wrong.click();
  const correct = opts.find(o => o.textContent === 'Kahotep');
  assert.ok(correct.classList.contains('senebty-fc-mcq-correct'), 'correct option highlighted');
  assert.ok(wrong.classList.contains('senebty-fc-mcq-wrong'), 'wrong pick marked');
  assert.equal(cta.textContent, 'Next question');
  cta.onclick(); // → question 2
  // Answer q2 correctly
  const opts2 = [...doc.querySelectorAll('.senebty-fc-mcq-option')];
  opts2.find(o => o.textContent === 'Balance').click();
  assert.equal(cta.textContent, 'On to iri');
  cta.onclick(); // → handoff
  // Note: getCtx() returns a jsdom-realm object; deepEqual fails cross-realm.
  // Use property-level assertions to avoid cross-realm prototype mismatch.
  const comp = getCtx().comprehension;
  assert.equal(comp.correct, 1, 'comprehension.correct tallied');
  assert.equal(comp.total, 2, 'comprehension.total tallied');
});

test('handoff: renderIri receives the full ctx shape', () => {
  const dom = bootDom({ user: { name: 'T' } });
  const w = dom.window;
  let ctx = null;
  w.Senebty.foundationRender.run(w.App, {
    lessonId: 'x', foundationKey: 'four-treasures', story: chunkOnlyStory(),
    isCompleted: () => false, recordIri: () => {},
    renderIri: (app, c) => { ctx = c; },
  });
  const cta = w.document.getElementById('senebtyFoundationCta');
  // chunkOnlyStory has 2 chunks × 3 clicks each = 6 clicks to reach handoff
  cta.onclick(); cta.onclick(); cta.onclick(); cta.onclick(); cta.onclick(); cta.onclick();
  assert.ok(ctx, 'renderIri called');
  ['stage', 'copy', 'counter', 'cta', 'story'].forEach(k =>
    assert.ok(k in ctx, 'ctx.' + k + ' present'));
  // ctx.comprehension is a jsdom-realm object — assert primitives, not deepEqual
  // (deepStrictEqual fails cross-realm prototype comparison).
  assert.equal(ctx.comprehension.correct, 0);
  assert.equal(ctx.comprehension.total, 0);
  assert.equal(typeof ctx.finishIri, 'function');
});

test('ctx.finishIri runs record → save → tierCheck → nav', () => {
  const calls = [];
  const dom = bootDom({ user: { name: 'T' } });
  const w = dom.window;
  // Functions cannot survive JSON.stringify in bootDom — assign post-boot (same
  // pattern as the done-state test which assigns nav after bootDom).
  w.App.saveUser = () => calls.push('save');
  w.App._checkTierAdvancement = () => calls.push('tier');
  w.App.nav = (s) => calls.push('nav:' + s);
  let ctx = null;
  w.Senebty.foundationRender.run(w.App, {
    lessonId: 'x', foundationKey: 'four-treasures', story: chunkOnlyStory(),
    isCompleted: () => false,
    recordIri: (ev) => calls.push('record:' + JSON.stringify(ev)),
    renderIri: (app, c) => { ctx = c; },
  });
  const cta = w.document.getElementById('senebtyFoundationCta');
  // chunkOnlyStory has 2 chunks × 3 clicks each = 6 clicks to reach handoff
  cta.onclick(); cta.onclick(); cta.onclick(); cta.onclick(); cta.onclick(); cta.onclick();
  ctx.finishIri({ ok: true });
  assert.deepEqual(calls, ['record:{"ok":true}', 'save', 'tier', 'nav:senebty']);
});

test('renderIri throwing is caught + logged + leaves a safe message', () => {
  const dom = bootDom({ user: { name: 'T' } });
  const w = dom.window;
  const errs = [];
  w.console.error = (...a) => errs.push(a.join(' '));
  w.Senebty.foundationRender.run(w.App, {
    lessonId: 'foundation-2-four-treasures', foundationKey: 'four-treasures',
    story: chunkOnlyStory(), isCompleted: () => false, recordIri: () => {},
    renderIri: () => { throw new Error('iri boom'); },
  });
  const cta = w.document.getElementById('senebtyFoundationCta');
  // chunkOnlyStory has 2 chunks × 3 clicks each = 6 clicks to reach handoff
  cta.onclick(); cta.onclick(); cta.onclick(); cta.onclick(); cta.onclick(); cta.onclick();
  const copy = w.document.getElementById('senebtyFoundationCopy');
  assert.match(copy.textContent, /something went wrong|return to the gate/i);
  assert.ok(errs.some(e => /renderIri threw/.test(e)), 'error logged with renderIri context');
});

test('handoff with no renderIri does not throw — last comp state remains', () => {
  const dom = bootDom({ user: { name: 'T' } });
  const w = dom.window;
  // config has NO renderIri — legal for an in-development foundation.
  assert.doesNotThrow(() => {
    w.Senebty.foundationRender.run(w.App, {
      lessonId: 'x', foundationKey: 'four-treasures', story: chunkOnlyStory(),
      isCompleted: () => false, recordIri: () => {},
      // renderIri intentionally omitted
    });
    const cta = w.document.getElementById('senebtyFoundationCta');
    for (let i = 0; i < 6; i++) cta.onclick();  // chunkOnlyStory = 6 clicks → handoff
  }, 'handoff must not throw when renderIri is absent');
});

test('foundation-comic.css exists with the required classes + reduced-motion', () => {
  const css = fs.readFileSync('senebty/styles/foundation-comic.css', 'utf8');
  ['.senebty-fc-art', '.senebty-fc-art-img', '.senebty-fc-art-fallback',
   '.senebty-fc-art-glyph', '.senebty-fc-mcq', '.senebty-fc-mcq-q',
   '.senebty-fc-mcq-list', '.senebty-fc-mcq-option',
   '.senebty-fc-mcq-correct', '.senebty-fc-mcq-wrong'].forEach(cls => {
    assert.ok(css.includes(cls), 'missing CSS class: ' + cls);
  });
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/,
    'must have a prefers-reduced-motion block');
  assert.ok(css.includes('44px') || css.includes('2.75rem'),
    'MCQ option hit area should be >= 44px');
});

test('foundation-four-treasures.js render() delegates to foundationRender.run', () => {
  const modSrc = fs.readFileSync('senebty/lib/foundation-four-treasures.js', 'utf8');
  assert.match(modSrc, /window\.Senebty\.foundationRender\.run\(/,
    'render() must call window.Senebty.foundationRender.run');
  assert.match(modSrc, /renderIri\s*:/, 'config must include a renderIri callback');
  // The bespoke BODY_IRI tap-treasures logic must still be present (relocated,
  // not deleted) — the 4 treasure names are the fingerprint.
  ['Khat', 'Ib', 'Ka', 'Ba'].forEach(t =>
    assert.ok(modSrc.includes("'" + t + "'") || modSrc.includes('"' + t + '"'),
      'BODY_IRI treasure "' + t + '" must survive the cutover'));
  // Still exposes the module's public surface.
  ['start', 'isCompleted', 'recordIri', 'render'].forEach(fn =>
    assert.match(modSrc, new RegExp('\\b' + fn + '\\b'), 'must still expose ' + fn));
});

// ─── Impl-gate RT bindings (2026-05-14) ─────────────────────────────────────

// Fixture: a comprehension pool LARGER than MAX_COMPREHENSION (5), to prove
// the helper caps it. 7 questions in; only 5 should render.
function bigCompStory() {
  const q = (n) => ({ kind: 'character', q: 'Q' + n + '?', a: 'A' + n,
    distractors: ['x' + n, 'y' + n, 'z' + n] });
  return {
    chunks: [{ level: 1, sebaIntro: 'i', text: 't', sebaAfter: 'a' }],
    comprehensionPool: [q(1), q(2), q(3), q(4), q(5), q(6), q(7)],
    iriCheckpoint: {},
  };
}

test('B1: comprehension is capped at MAX_COMPREHENSION (5) — pool of 7 → 5 asked', () => {
  const dom = bootDom({ user: { name: 'T' } });
  const w = dom.window, doc = w.document;
  let ctx = null;
  w.Senebty.foundationRender.run(w.App, {
    lessonId: 'x', foundationKey: 'four-treasures', story: bigCompStory(),
    isCompleted: () => false, recordIri: () => {},
    renderIri: (app, c) => { ctx = c; },
  });
  const cta = doc.getElementById('senebtyFoundationCta');
  const counter = doc.getElementById('senebtyFoundationCounter');
  cta.onclick(); cta.onclick(); cta.onclick(); // intro → text → after → comp Q1
  // v3.49.3 — counter uses progress dots (●○○○○) instead of "Question N / M"
  // (PM/UX RT removed implementation-vocab from reader copy). The cap test
  // now asserts the dot count = MAX_COMPREHENSION (5), proving the pool was
  // capped from 7 → 5.
  const dots = counter.textContent.replace(/\s+/g, '');
  assert.equal(dots.length, 5, 'counter must have exactly 5 dots (cap), not 7');
  assert.match(counter.textContent, /●/, 'first dot must be filled (current question)');
  // Answer all 5, counting how many questions appear.
  let asked = 0;
  for (let i = 0; i < 5; i++) {
    const opts = [...doc.querySelectorAll('.senebty-fc-mcq-option')];
    assert.ok(opts.length === 4, 'question ' + (i + 1) + ' should render 4 options');
    asked++;
    opts[0].click();        // pick something (one-try-reveal)
    cta.onclick();          // advance
  }
  assert.equal(asked, 5, 'exactly 5 questions asked from a 7-question pool');
  assert.ok(ctx, 'handoff reached after the 5th question');
  assert.equal(ctx.comprehension.total, 5, 'ctx.comprehension.total reflects the cap, not the raw pool');
});

test('QA-DA: comprehension art slot renders the lapis anchor directly — no <img>, no 404 request', () => {
  const dom = bootDom({ user: { name: 'T' }, ART_CACHE_VERSION: '0' });
  const w = dom.window, doc = w.document;
  w.Senebty.foundationRender.run(w.App, {
    lessonId: 'x', foundationKey: 'four-treasures', story: compStory(),
    isCompleted: () => false, recordIri: () => {}, renderIri: () => {},
  });
  const cta = doc.getElementById('senebtyFoundationCta');
  cta.onclick(); cta.onclick(); cta.onclick(); // → comp Q1
  const slot = doc.querySelector('#senebtyFoundation .senebty-foundation-stage .senebty-fc-art');
  assert.ok(slot, 'art slot present during comprehension');
  assert.ok(slot.querySelector('.senebty-fc-art-fallback'),
    'comp art slot must show the lapis fallback directly');
  assert.equal(slot.querySelector('img'), null,
    'comp art slot must NOT contain an <img> — no doomed 404 request per question');
});

test('Tehuti: MCQ has an aria-live feedback line, populated on answer', () => {
  const dom = bootDom({ user: { name: 'T' } });
  const w = dom.window, doc = w.document;
  w.Senebty.foundationRender.run(w.App, {
    lessonId: 'x', foundationKey: 'four-treasures', story: compStory(),
    isCompleted: () => false, recordIri: () => {}, renderIri: () => {},
  });
  const cta = doc.getElementById('senebtyFoundationCta');
  cta.onclick(); cta.onclick(); cta.onclick(); // → comp Q1 (compStory Q1 answer is 'Kahotep')
  const fb = doc.querySelector('.senebty-fc-mcq-feedback');
  assert.ok(fb, 'aria-live feedback element present');
  assert.equal(fb.getAttribute('aria-live'), 'polite', 'feedback line must be aria-live=polite');
  assert.equal(fb.textContent, '', 'feedback is empty before the child answers');
  // Pick a wrong option → feedback names the correct answer.
  const opts = [...doc.querySelectorAll('.senebty-fc-mcq-option')];
  opts.find(o => o.textContent !== 'Kahotep').click();
  assert.match(fb.textContent, /not quite/i, 'wrong answer → feedback announces it');
  assert.match(fb.textContent, /Kahotep/, 'wrong answer → feedback names the correct answer');
});

// ─── v3.51.64 — daily-ritual / legacy-reader separation (NARROWED gate) ──────
//
// HISTORY: v3.51.41 added an early-return `if (story.dailyFoundation) {
// copy=''; cta.hide(); return; }` on the premise (true then) that ONLY F1 Mu
// had a dailyFoundation block. Phase 2 (v3.51.44-63) gave ALL EIGHT
// foundations a dailyFoundation block, so that gate fired for every foundation
// and blanked the ENTIRE legacy chunk-reader (story + comprehension + iri) —
// clicking any foundation in the Eight-Foundations index rendered an empty
// parchment (confirmed via live Chrome audit on prod).
//
// FIX (user decision 2026-05-20): the legacy comic-page reader (story +
// comprehension + iri) is the intended content for the index. The daily-ritual
// (daily-foundation-screen) is a SEPARATE opt-in daily touch, not a
// replacement. So run() must NOT early-return on story.dailyFoundation; it must
// render the reader and suppress ONLY the pulse+reflection layer (which the
// daily-foundation-screen owns) by forcing reflectionData=null →
// pulseMode=false.

test('v3.51.64: foundation-render references story.dailyFoundation (to suppress pulse/reflection only)', () => {
  assert.match(src, /story\.dailyFoundation/, 'foundation-render must check story.dailyFoundation to suppress the pulse/reflection layer');
});

test('v3.51.64: run() with story.dailyFoundation does NOT early-return-blank — it renders the reader, suppressing only pulse+reflection', () => {
  // Build an F1-shaped story with BOTH sunuReflection (would normally trigger
  // pulse-mode) AND dailyFoundation. Correct behavior: the chunk-story renders
  // (copy gets text, CTA visible), but pulse + reflection are suppressed.
  const chunks = [];
  for (let i = 0; i < 4; i++) {
    chunks.push({ level: 1, sebaIntro: 'i' + i, text: 'chunk text ' + i, sebaAfter: 'a' + i });
  }
  const pool = [];
  for (let i = 0; i < 5; i++) {
    pool.push({ kind: 'character', q: 'Q' + i + '?', a: 'A' + i, distractors: ['x' + i, 'y' + i, 'z' + i] });
  }
  const f1Story = {
    chunks,
    comprehensionPool: pool,
    iriCheckpoint: { sebaPostIri: 'done' },
    sunuReflection: {
      speaker: 'Sunu Merytamun', speakerGlyph: '𓋹', principle: 'Greeting the Body',
      storyContext: 'context', sebaIntro: 'hi', prompt: 'reflect', sebaAfter: 'bye',
      minimumWords: 15,
    },
    dailyFoundation: {
      greeting: { title: 'Today', subtitle: 'rise', powerWord: 'Mu' },
      doingVeo: '', blessingVeo: '', blessingLine: '', dailyGesture: '',
      microTeachings: [{ quartetTag: 'khat', scholar: 'Diop', quote: 'drink' }],
    },
  };
  const dom = bootDom({ user: { name: 'T' }, ART_CACHE_VERSION: '0' });
  const w = dom.window, doc = w.document;
  w.Senebty.foundationRender.run(w.App, {
    lessonId: 'x', foundationKey: 'mu', story: f1Story,
    isCompleted: () => false, recordIri: () => {}, renderIri: () => {},
  });
  // The reader renders: chunk copy has text (NOT blanked).
  const copy = doc.getElementById('senebtyFoundationCopy');
  assert.ok(copy && copy.textContent.trim().length > 0,
    'the chunk-story copy must render text — the reader must NOT be blanked when story.dailyFoundation is present (v3.51.64 fix)');
  // Pulse + reflection are suppressed (daily-foundation-screen owns them).
  assert.equal(doc.querySelector('.senebty-fc-pulse'), null,
    'pulse must be suppressed when story.dailyFoundation is present');
  assert.equal(doc.querySelector('.senebty-fc-reflection'), null,
    'reflection must be suppressed when story.dailyFoundation is present');
  // CTA visible — the reader's advance affordance is active.
  const cta = doc.getElementById('senebtyFoundationCta');
  assert.notEqual(cta.style.display, 'none',
    'CTA must be VISIBLE — the legacy reader is active (only pulse/reflection are suppressed)');
});

test('v3.51.41 gate: F2-F8 path unchanged — sunuReflection alone (no dailyFoundation) still pulse-mode', () => {
  // Build an F2-shaped story: sunuReflection present, NO dailyFoundation.
  // The legacy pulse path must still engage.
  const chunks = [];
  for (let i = 0; i < 4; i++) {
    chunks.push({ level: 1, sebaIntro: 'i' + i, text: 't' + i, sebaAfter: 'a' + i });
  }
  const pool = [];
  for (let i = 0; i < 5; i++) {
    pool.push({ kind: 'character', q: 'Q' + i + '?', a: 'A' + i, distractors: ['x' + i, 'y' + i, 'z' + i] });
  }
  const f2Story = {
    chunks,
    comprehensionPool: pool,
    iriCheckpoint: { sebaPostIri: 'done' },
    sunuReflection: {
      speaker: 'Sunu', speakerGlyph: '𓋹', principle: 'Body',
      storyContext: 'c', sebaIntro: 'hi', prompt: 'reflect', sebaAfter: 'bye',
      minimumWords: 15,
    },
    // NOTE: no dailyFoundation — F2-F8 still legacy.
  };
  const dom = bootDom({ user: { name: 'T' }, ART_CACHE_VERSION: '0' });
  const w = dom.window, doc = w.document;
  w.Senebty.foundationRender.run(w.App, {
    lessonId: 'x', foundationKey: 'four-treasures', story: f2Story,
    isCompleted: () => false, recordIri: () => {}, renderIri: () => {},
  });
  // CTA must still be visible — legacy flow active.
  const cta = doc.getElementById('senebtyFoundationCta');
  assert.notEqual(cta.style.display, 'none',
    'F2-F8 (no dailyFoundation) must keep CTA visible — legacy flow intact');
});
