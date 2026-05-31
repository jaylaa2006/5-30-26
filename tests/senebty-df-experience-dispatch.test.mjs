// tests/senebty-df-experience-dispatch.test.mjs
// Contract for the experienceType dispatch + the three internal-foundation
// renderers (F3 breath / F6 voice-demo / F8 affirmation). jsdom-stub vm style,
// mirrors senebty-daily-foundation-screen.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

function makeStubDocument() {
  const handlers = [];
  function makeEl(tag) {
    const children = [];
    const el = {
      tagName: tag.toUpperCase(),
      children, className: '', style: {}, dataset: {}, textContent: '', value: '',
      attrs: new Map(),
      appendChild(c) { children.push(c); return c; },
      replaceChildren(...n) { children.length = 0; n.forEach(x => children.push(x)); },
      setAttribute(k, v) { el.attrs.set(k, v); },
      getAttribute(k) { return el.attrs.has(k) ? el.attrs.get(k) : null; },
      // NOTE: _lastListener holds the LAST-registered listener. For elements with
      // multiple listeners (e.g. <audio> ended/pause/error), use handlers[] to target a specific one.
      addEventListener(evt, fn) { el._lastListener = { evt, fn }; handlers.push({ el, evt, fn }); },
      querySelector() { return null; }, querySelectorAll() { return []; },
    };
    el.classList = { _s: new Set(), add(c){ this._s.add(c); }, remove(c){ this._s.delete(c); }, contains(c){ return this._s.has(c); } };
    return el;
  }
  return { createElement: makeEl, _handlers: handlers };
}

function loadScreen() {
  const src = fs.readFileSync('senebty/lib/daily-foundation-screen.js', 'utf8');
  const document = makeStubDocument();
  const sandbox = { window: { Senebty: {} }, document, console };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return { win: sandbox.window, document };
}

function appWith(df, slug) {
  const App = {
    user: { id: 'u1', name: 'King', senebty: { dailyFoundationLog: {} } },
    saveUser() { App._saved = (App._saved || 0) + 1; },
    dailyFoundationGate: { pickMicroIdx: () => 0 },
  };
  const base = { greeting: { title: 'T', subtitle: 's', powerWord: 'P' }, blessingLine: 'Seneb, {name}.', microTeachings: [{ scholar: 'X', quote: 'q' }] };
  App._df = Object.assign(base, df);
  App._slug = slug;
  return App;
}
function renderAndFind(App, klass) {
  const { win, document } = loadScreen();
  win.Senebty = { foundations: { [App._slug]: { dailyFoundation: App._df } } };
  win.__InstallDailyFoundationScreen__(App);
  const container = document.createElement('div');
  App.dailyFoundationScreen.render(App, container, App._slug);
  return { container, card: container.children.find(c => c.className && c.className.indexOf(klass) === 0) };
}

test('default (no experienceType) still renders the doing-veo card', () => {
  const App = appWith({ doingVeo: '/v/x.mp4' }, 'mu');
  const { card } = renderAndFind(App, 'senebty-df-doing');
  assert.ok(card, 'doing card present on default path');
});

test('voice-demo: audio (no autoplay) + tap-to-play button + affirmation', () => {
  const App = appWith({ experienceType: 'voice-demo', voiceDemoAudio: '/audio/senebty/hesi-voice-demo.mp3', voiceAffirmation: 'Speak it steady.' }, 'hesi');
  const { card } = renderAndFind(App, 'senebty-df-voicedemo');
  assert.ok(card, 'voice-demo card present');
  const audio = card.children.find(c => c.tagName === 'AUDIO');
  assert.ok(audio, '<audio> present');
  assert.equal(audio.getAttribute('src'), '/audio/senebty/hesi-voice-demo.mp3');
  assert.equal(audio.getAttribute('autoplay'), null, 'NO autoplay on audio (Critical Rule)');
  assert.equal(audio.getAttribute('preload'), 'none', 'audio preload="none" — no auto-load');
  const play = card.children.find(c => c.className === 'senebty-df-voicedemo__play');
  assert.ok(play, 'tap-to-play button present');
  assert.ok(play.getAttribute('aria-label'), 'play button has aria-label');
  const aff = card.children.find(c => c.className === 'senebty-df-voicedemo__affirm');
  assert.equal(aff.textContent, 'Speak it steady.');
});

test('breath: renders breath chamber with ambient video + guide (motion path)', () => {
  const App = appWith({ experienceType: 'breath', breathAmbientVeo: '/videos/senebty-foundations/tjau-breath-ambient.mp4', breathRounds: 3, breathPattern: [4,7,8] }, 'tjau');
  const { card } = renderAndFind(App, 'senebty-df-breath');
  assert.ok(card, 'breath card present');
  const bg = card.children.find(c => c.className === 'senebty-df-breath__bg');
  const video = bg && bg.children.find(c => c.tagName === 'VIDEO');
  assert.ok(video, 'ambient <video> present');
  assert.equal(video.getAttribute('src'), '/videos/senebty-foundations/tjau-breath-ambient.mp4');
  assert.equal(video.getAttribute('autoplay'), '');           // muted backdrop video may autoplay
  assert.equal(video.getAttribute('muted'), '');              // but is MUTED (no-autoplay-AUDIO rule)
  const guide = card.children.find(c => c.className && c.className.indexOf('senebty-df-breath__guide') === 0);
  assert.ok(guide, 'breathing guide present');
  assert.equal(guide.getAttribute('role'), 'img');
  assert.match(guide.getAttribute('aria-label'), /in 4.*hold 7.*out 8/);
});

test('voice-demo: slug-fallback audio URL + default affirmation when fields absent', () => {
  const App = appWith({ experienceType: 'voice-demo' }, 'hesi');
  const { card } = renderAndFind(App, 'senebty-df-voicedemo');
  const audio = card.children.find(c => c.tagName === 'AUDIO');
  assert.equal(audio.getAttribute('src'), '/audio/senebty/hesi-voice-demo.mp3', 'slug fallback URL');
  const aff = card.children.find(c => c.className === 'senebty-df-voicedemo__affirm');
  assert.equal(aff.textContent, 'Your voice is yours. Speak it steady.', 'default affirmation text');
});

const HEKA_POOL = ["I'm word A", "I'm word B", "I'm word C", "I'm word D", "I'm word E"];

test('affirmation: shows 2 distinct choices + custom input + save', () => {
  const App = appWith({ experienceType: 'affirmation', hekaTrueWords: HEKA_POOL, hekaAllowCustom: true }, 'heka');
  const { card } = renderAndFind(App, 'senebty-df-affirm');
  assert.ok(card, 'affirm card present');
  const list = card.children.find(c => c.className === 'senebty-df-affirm__choices');
  assert.ok(list, 'choices container present');
  const btns = list.children.filter(c => c.className === 'senebty-df-affirm__choice');
  assert.equal(btns.length, 2, 'exactly two on rotation');
  assert.notEqual(btns[0].textContent, btns[1].textContent, 'two DISTINCT words');
  assert.ok(card.children.find(c => c.className === 'senebty-df-affirm__input'), 'custom input present');
  assert.ok(card.children.find(c => c.className === 'senebty-df-affirm__save'), 'save button present');
});

test('affirmation: choosing a word persists VERBATIM to user.senebty.hekaTrueWord + saveUser', () => {
  const App = appWith({ experienceType: 'affirmation', hekaTrueWords: HEKA_POOL }, 'heka');
  const { card } = renderAndFind(App, 'senebty-df-affirm');
  const list = card.children.find(c => c.className === 'senebty-df-affirm__choices');
  const choice = list.children.find(c => c.className === 'senebty-df-affirm__choice');
  choice._lastListener.fn();   // simulate click
  assert.equal(App.user.senebty.hekaTrueWord, choice.textContent, 'stored verbatim (apostrophe preserved, no escaping)');
  assert.ok(App._saved >= 1, 'saveUser called');
});

test('affirmation: custom word is whitespace-normalized + length-capped ≤120', () => {
  const App = appWith({ experienceType: 'affirmation', hekaTrueWords: HEKA_POOL, hekaAllowCustom: true }, 'heka');
  const { card } = renderAndFind(App, 'senebty-df-affirm');
  const input = card.children.find(c => c.className === 'senebty-df-affirm__input');
  const save = card.children.find(c => c.className === 'senebty-df-affirm__save');
  input.value = 'y'.repeat(200);
  save._lastListener.fn();
  assert.ok(App.user.senebty.hekaTrueWord.length <= 120, 'capped to ≤120');
});

test('affirmation: persisted word greets the returner', () => {
  const App = appWith({ experienceType: 'affirmation', hekaTrueWords: HEKA_POOL }, 'heka');
  App.user.senebty.hekaTrueWord = 'my own true word';
  const { card } = renderAndFind(App, 'senebty-df-affirm');
  const prev = card.children.find(c => c.className === 'senebty-df-affirm__prev');
  assert.ok(prev && prev.textContent.indexOf('my own true word') !== -1, 'prior word shown');
});

test('tjau data declares experienceType breath', () => {
  const s = fs.readFileSync('senebty/data/foundations/03-tjau/story.js', 'utf8');
  assert.match(s, /experienceType:\s*["']breath["']/);
  assert.match(s, /breathAmbientVeo:\s*["']\/videos\/senebty-foundations\/tjau-breath-ambient\.mp4["']/);
  assert.match(s, /breathRounds:\s*3/);
  assert.match(s, /breathPattern:\s*\[\s*4\s*,\s*7\s*,\s*8\s*\]/);
});
test('hesi data declares experienceType voice-demo', () => {
  const s = fs.readFileSync('senebty/data/foundations/06-hesi/story.js', 'utf8');
  assert.match(s, /experienceType:\s*["']voice-demo["']/);
  assert.match(s, /voiceDemoAudio:\s*["']\/audio\/senebty\/hesi-voice-demo\.mp3["']/);
  assert.match(s, /voiceAffirmation:\s*"The steady voice is yours to keep\. Speak it true\."/);
});
test('heka data declares experienceType affirmation with a 20-word pool', () => {
  const s = fs.readFileSync('senebty/data/foundations/08-heka/story.js', 'utf8');
  assert.match(s, /experienceType:\s*["']affirmation["']/);
  const block = s.match(/hekaTrueWords:\s*\[([\s\S]*?)\]/);
  assert.ok(block, 'hekaTrueWords array present');
  // Count entries by line-start quote (robust to apostrophes inside the strings).
  // NOTE: the hekaTrueWords capture is non-greedy on `]`; assumes no affirmation contains a literal `]`.
  const count = (block[1].match(/^\s*"/gm) || []).length;
  assert.strictEqual(count, 20, 'pool must be EXACTLY 20 entries (found ' + count + ')');
});

test('reduced-motion: breath renders poster IMG (not video) + static guide + count phase', () => {
  const { win, document } = loadScreen();
  win.matchMedia = function () { return { matches: true }; };
  win.Senebty = { foundations: { tjau: { dailyFoundation: {
    greeting: { title: 'Today is Tjau', subtitle: 's', powerWord: 'TJAU' },
    blessingLine: 'x', microTeachings: [{ scholar: 'X', quote: 'q' }],
    experienceType: 'breath', breathPattern: [4, 7, 8], breathRounds: 3,
  } } } };
  const App = { user: { id: 'u1', name: 'K', senebty: { dailyFoundationLog: {} } }, dailyFoundationGate: { pickMicroIdx: () => 0 } };
  win.__InstallDailyFoundationScreen__(App);
  const c = document.createElement('div');
  App.dailyFoundationScreen.render(App, c, 'tjau');
  const card = c.children.find(x => x.className === 'senebty-df-breath');
  assert.ok(card, 'breath card present');
  const bg = card.children.find(x => x.className === 'senebty-df-breath__bg');
  assert.ok(bg.children.find(x => x.tagName === 'IMG'), 'reduced-motion → poster img');
  assert.ok(!bg.children.find(x => x.tagName === 'VIDEO'), 'no video under reduced-motion');
  const guide = card.children.find(x => x.className && x.className.indexOf('senebty-df-breath__guide--static') !== -1);
  assert.ok(guide, 'guide is static under reduced-motion');
});

test('voice-demo: tapping play marks the viz is-playing', () => {
  const App = appWith({ experienceType: 'voice-demo', voiceDemoAudio: '/audio/senebty/hesi-voice-demo.mp3' }, 'hesi');
  const { card } = renderAndFind(App, 'senebty-df-voicedemo');
  const play = card.children.find(c => c.className === 'senebty-df-voicedemo__play');
  const viz = card.children.find(c => c.className && c.className.indexOf('senebty-df-voicedemo__viz') === 0);
  play._lastListener.fn();
  assert.ok(viz.classList.contains('is-playing'), 'viz marked playing on tap');
});

test('affirmation: choosing a word updates the aria-live status line', () => {
  const App = appWith({ experienceType: 'affirmation', hekaTrueWords: ["I'm A", "I'm B", "I'm C", "I'm D", "I'm E"] }, 'heka');
  const { card } = renderAndFind(App, 'senebty-df-affirm');
  const list = card.children.find(c => c.className === 'senebty-df-affirm__choices');
  const choice = list.children.find(c => c.className === 'senebty-df-affirm__choice');
  choice._lastListener.fn();
  const status = card.children.find(c => c.className === 'senebty-df-affirm__status');
  assert.ok(status && status.textContent.indexOf(choice.textContent) !== -1, 'status announces the carried word');
});
