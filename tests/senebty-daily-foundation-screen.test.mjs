import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

function makeStubDocument() {
  const handlers = new Map();
  function makeEl(tag) {
    const children = [];
    const el = {
      tagName: tag.toUpperCase(),
      children, className: '', style: {}, dataset: {}, textContent: '',
      attrs: new Map(),
      appendChild(c) { children.push(c); return c; },
      removeChild(c) { const i = children.indexOf(c); if (i >= 0) children.splice(i, 1); },
      replaceChildren(...newChildren) { children.length = 0; newChildren.forEach(n => children.push(n)); },
      setAttribute(k, v) { el.attrs.set(k, v); if (k === 'aria-live') el['aria-live'] = v; },
      addEventListener(evt, fn) { handlers.set(`${tag}:${evt}`, fn); el._lastListener = { evt, fn }; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
    };
    return el;
  }
  return { createElement: makeEl, _handlers: handlers };
}

function loadScreenModule() {
  const src = fs.readFileSync('senebty/lib/daily-foundation-screen.js', 'utf8');
  const document = makeStubDocument();
  const sandbox = { window: { Senebty: {} }, document, console };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return { win: sandbox.window, document };
}

test('installer exists', () => {
  const { win } = loadScreenModule();
  assert.ok(win.__InstallDailyFoundationScreen__);
});

test('render() requires app + container — exposes render function', () => {
  const { win } = loadScreenModule();
  const App = { user: { id: 'u1', name: 'King', senebty: { dailyFoundationLog: {} } } };
  win.__InstallDailyFoundationScreen__(App);
  assert.equal(typeof App.dailyFoundationScreen.render, 'function');
});

test('render appends doing-Veo card with video src pointing at the foundation Veo URL', () => {
  const { win, document } = loadScreenModule();
  const App = {
    user: { id: 'u1', name: 'King', senebty: { dailyFoundationLog: {} } },
    dailyFoundationGate: { pickMicroIdx: () => 0, getTodaysFoundation: () => 'mu' },
  };
  win.Senebty = { foundations: { mu: { dailyFoundation: {
    greeting: { title: 'Today is Mu', subtitle: 'Water', powerWord: 'MU' },
    blessingLine: 'Seneb, {name}.',
    dailyGesture: 'Drink one cup.',
    microTeachings: [{ scholar: 'Diop', quote: '...' }],
    doingVeo: '/videos/senebty-foundations/mu-drink.mp4',
    blessingVeo: '/videos/senebty-foundations/mu-blessing-sunu.mp4',
  } } } };
  win.__InstallDailyFoundationScreen__(App);
  const container = document.createElement('div');
  App.dailyFoundationScreen.render(App, container, 'mu');
  const doing = container.children.find(c => c.className === 'senebty-df-doing');
  assert.ok(doing, 'doing card present');
  const video = doing.children.find(c => c.tagName === 'VIDEO');
  assert.ok(video, '<video> element');
  assert.equal(video.attrs.get('src'), '/videos/senebty-foundations/mu-drink.mp4');
});

test('doing-Veo falls back to /videos/senebty-foundations/<slug>-doing.mp4 when doingVeo missing', () => {
  const { win, document } = loadScreenModule();
  const App = {
    user: { id: 'u1', name: 'King', senebty: { dailyFoundationLog: {} } },
    dailyFoundationGate: { pickMicroIdx: () => 0 },
  };
  win.Senebty = { foundations: { mu: { dailyFoundation: {
    greeting: { title: 'Today is Mu', subtitle: '...', powerWord: 'MU' },
    microTeachings: [{ scholar: 'Diop', quote: '...' }],
    // doingVeo NOT provided — should fall back to generic {slug}-doing.mp4
  } } } };
  win.__InstallDailyFoundationScreen__(App);
  const container = document.createElement('div');
  App.dailyFoundationScreen.render(App, container, 'mu');
  const doing = container.children.find(c => c.className === 'senebty-df-doing');
  const video = doing.children.find(c => c.tagName === 'VIDEO');
  assert.equal(video.attrs.get('src'), '/videos/senebty-foundations/mu-doing.mp4');
});

test('render appends honor-check button with WCAG copy + click handler', () => {
  const { win, document } = loadScreenModule();
  const App = {
    user: { id: 'u1', name: 'King', senebty: { dailyFoundationLog: {} } },
    dailyFoundationGate: { pickMicroIdx: () => 0, recordCompletion: () => true },
  };
  win.Senebty = { foundations: { mu: { dailyFoundation: {
    greeting: { title: 'Today is Mu', subtitle: '...', powerWord: 'MU' },
    blessingLine: 'Seneb, {name}.',
    dailyGesture: 'Drink one cup.',
    microTeachings: [{ scholar: 'Diop', quote: '...' }],
    doingVeo: '/videos/senebty-foundations/mu-drink.mp4',
    blessingVeo: '/videos/senebty-foundations/mu-blessing-sunu.mp4',
  } } } };
  win.__InstallDailyFoundationScreen__(App);
  const container = document.createElement('div');
  App.dailyFoundationScreen.render(App, container, 'mu');
  const honor = container.children.find(c => c.className === 'senebty-df-honor');
  assert.ok(honor, 'honor button present');
  assert.equal(honor.tagName, 'BUTTON');
  assert.match(honor.textContent, /did this today/i, 'honor button has affordance copy');
  assert.ok(honor._lastListener, 'click handler attached');
  assert.equal(honor._lastListener.evt, 'click');
});

test('honor click records completion via gate.recordCompletion with microIdx', () => {
  const recorded = [];
  const { win, document } = loadScreenModule();
  const App = {
    user: { id: 'u1', name: 'King', senebty: { dailyFoundationLog: { '2026-05-17': { slug: 'mu', completed: false } } } },
    dailyFoundationGate: {
      pickMicroIdx: () => 7,
      recordCompletion(user, today, micro) { recorded.push({ today, micro, userId: user.id }); user.senebty.dailyFoundationLog[today].completed = true; return true; },
    },
  };
  win.Senebty = { foundations: { mu: { dailyFoundation: {
    greeting: { title: 'Today is Mu', subtitle: '...', powerWord: 'MU' },
    blessingLine: 'Seneb, {name}.',
    dailyGesture: 'Drink one cup.',
    microTeachings: [{ scholar: 'Diop', quote: '...' }],
    doingVeo: '/videos/senebty-foundations/mu-drink.mp4',
    blessingVeo: '/videos/senebty-foundations/mu-blessing-sunu.mp4',
  } } } };
  win.__InstallDailyFoundationScreen__(App);
  const container = document.createElement('div');
  App.dailyFoundationScreen.render(App, container, 'mu');
  const honor = container.children.find(c => c.className === 'senebty-df-honor');
  honor._lastListener.fn();  // simulate click
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0].micro, 7);
  assert.equal(recorded[0].userId, 'u1');
});

test('honor click transitions to blessing phase — replaces container with blessing card', () => {
  const { win, document } = loadScreenModule();
  const App = {
    user: { id: 'u1', name: 'King', senebty: { dailyFoundationLog: { '2026-05-17': { slug: 'mu', completed: false } } } },
    dailyFoundationGate: { pickMicroIdx: () => 0, recordCompletion: () => true },
  };
  win.Senebty = { foundations: { mu: { dailyFoundation: {
    greeting: { title: 'Today is Mu', subtitle: '...', powerWord: 'MU' },
    blessingLine: 'Seneb, {name}. The body remembers.',
    dailyGesture: 'Drink one cup.',
    microTeachings: [{ scholar: 'Diop', quote: '...' }],
    doingVeo: '/videos/senebty-foundations/mu-drink.mp4',
    blessingVeo: '/videos/senebty-foundations/mu-blessing-sunu.mp4',
  } } } };
  win.__InstallDailyFoundationScreen__(App);
  const container = document.createElement('div');
  App.dailyFoundationScreen.render(App, container, 'mu');
  const honor = container.children.find(c => c.className === 'senebty-df-honor');
  honor._lastListener.fn();
  // After click, container replaced with blessing card
  const blessing = container.children.find(c => c.className === 'senebty-df-blessing');
  assert.ok(blessing, 'blessing card present after honor click');
  // blessing line with {name} substituted
  const line = blessing.children.find(c => c.className === 'senebty-df-blessing__line');
  assert.ok(line);
  assert.match(line.textContent, /Seneb, King\. The body remembers\./);
});

test('reduced-motion: doing Veo renders <img> instead of <video>', () => {
  const { win, document } = loadScreenModule();
  // Stub window.matchMedia to return matches:true for reduced-motion
  win.matchMedia = (q) => ({ matches: q.includes('reduce'), addEventListener: () => {} });
  const App = {
    user: { id: 'u1', name: 'King', senebty: { dailyFoundationLog: {} } },
    dailyFoundationGate: { pickMicroIdx: () => 0 },
  };
  win.Senebty = { foundations: { mu: { dailyFoundation: {
    greeting: { title: 'Today is Mu', subtitle: '...', powerWord: 'MU' },
    blessingLine: 'Seneb, {name}.',
    dailyGesture: 'Drink.',
    microTeachings: [{ scholar: 'Diop', quote: '...' }],
  } } } };
  win.__InstallDailyFoundationScreen__(App);
  const container = document.createElement('div');
  App.dailyFoundationScreen.render(App, container, 'mu');
  const doing = container.children.find(c => c.className === 'senebty-df-doing');
  const img = doing.children.find(c => c.tagName === 'IMG');
  const video = doing.children.find(c => c.tagName === 'VIDEO');
  assert.ok(img, 'reduced-motion: <img> present');
  assert.equal(video, undefined, 'reduced-motion: <video> NOT present');
});

test('blessing card includes Continue to Senebty button with nav handler', () => {
  const { win, document } = loadScreenModule();
  win.matchMedia = (q) => ({ matches: false, addEventListener: () => {} });
  const navCalls = [];
  const App = {
    user: { id: 'u1', name: 'King', senebty: { dailyFoundationLog: { '2026-05-17': { slug: 'mu', completed: false } } } },
    dailyFoundationGate: { pickMicroIdx: () => 0, recordCompletion: () => true },
    nav: (screen) => navCalls.push(screen),
  };
  win.Senebty = { foundations: { mu: { dailyFoundation: {
    greeting: { title: 'Today is Mu', subtitle: '...', powerWord: 'MU' },
    blessingLine: 'Seneb, {name}.',
    dailyGesture: 'Drink.',
    microTeachings: [{ scholar: 'Diop', quote: '...' }],
    doingVeo: '/videos/senebty-foundations/mu-drink.mp4',
    blessingVeo: '/videos/senebty-foundations/mu-blessing-sunu.mp4',
  } } } };
  win.__InstallDailyFoundationScreen__(App);
  const container = document.createElement('div');
  App.dailyFoundationScreen.render(App, container, 'mu');
  // honor click triggers blessing
  const honor = container.children.find(c => c.className === 'senebty-df-honor');
  honor._lastListener.fn();
  const blessing = container.children.find(c => c.className === 'senebty-df-blessing');
  const continueBtn = blessing.children.find(c => c.className === 'senebty-df-continue');
  assert.ok(continueBtn, 'continue button present');
  assert.equal(continueBtn.tagName, 'BUTTON');
  // click should call App.nav('senebty')
  continueBtn._lastListener.fn();
  assert.deepEqual(navCalls, ['senebty']);
});

test('blessing card includes blessing-Veo video', () => {
  const { win, document } = loadScreenModule();
  const App = {
    user: { id: 'u1', name: 'King', senebty: { dailyFoundationLog: { '2026-05-17': { slug: 'mu', completed: false } } } },
    dailyFoundationGate: { pickMicroIdx: () => 0, recordCompletion: () => true },
  };
  win.Senebty = { foundations: { mu: { dailyFoundation: {
    greeting: { title: 'Today is Mu', subtitle: '...', powerWord: 'MU' },
    blessingLine: 'Seneb, {name}.',
    dailyGesture: 'Drink.',
    microTeachings: [{ scholar: 'Diop', quote: '...' }],
    doingVeo: '/videos/senebty-foundations/mu-drink.mp4',
    blessingVeo: '/videos/senebty-foundations/mu-blessing-sunu.mp4',
  } } } };
  win.__InstallDailyFoundationScreen__(App);
  const container = document.createElement('div');
  App.dailyFoundationScreen.render(App, container, 'mu');
  const honor = container.children.find(c => c.className === 'senebty-df-honor');
  honor._lastListener.fn();
  const blessing = container.children.find(c => c.className === 'senebty-df-blessing');
  const vidWrap = blessing.children.find(c => c.className === 'senebty-df-blessing__video');
  assert.ok(vidWrap);
  const video = vidWrap.children.find(c => c.tagName === 'VIDEO');
  assert.ok(video, '<video> in blessing card');
  assert.equal(video.attrs.get('src'), '/videos/senebty-foundations/mu-blessing-sunu.mp4');
});

// v3.51.43 — Data-shape resolver MUST find dailyFoundation under the canonical
// per-foundation singular layout (window.Senebty.foundationMuStory). The previous
// resolver only looked at Senebty.foundations[slug] and rendered blank because
// that collection does not exist in production.
test('resolver finds dailyFoundation under Senebty.foundationMuStory (production layout)', () => {
  const { win, document } = loadScreenModule();
  const App = {
    user: { id: 'u1', name: 'King', senebty: { dailyFoundationLog: {} } },
    dailyFoundationGate: { pickMicroIdx: () => 0 },
  };
  // Production layout: per-foundation singular, NO `foundations` collection.
  win.Senebty = { foundationMuStory: { dailyFoundation: {
    greeting: { title: 'Today is Mu', subtitle: 'Water', powerWord: 'MU' },
    blessingLine: 'Seneb, {name}.',
    dailyGesture: 'Drink one cup.',
    microTeachings: [{ scholar: 'Diop', quote: 'Mu is the carrier.' }],
    doingVeo: '/videos/senebty-foundations/mu-drink.mp4',
    blessingVeo: '/videos/senebty-foundations/mu-blessing-sunu.mp4',
  } } };
  win.__InstallDailyFoundationScreen__(App);
  const container = document.createElement('div');
  App.dailyFoundationScreen.render(App, container, 'mu');
  // Greeting card should be present (would NOT be if resolver returned null)
  const greeting = container.children.find(c => c.className === 'senebty-df-greeting');
  assert.ok(greeting, 'greeting card must render when data is at foundationMuStory');
  const title = greeting.children.find(c => c.className === 'senebty-df-greeting__title');
  assert.match(title.textContent, /Today is Mu/);
});

test('resolver falls back to Senebty.foundations[slug] when singular missing (forward-compat)', () => {
  const { win, document } = loadScreenModule();
  const App = {
    user: { id: 'u1', name: 'King', senebty: { dailyFoundationLog: {} } },
    dailyFoundationGate: { pickMicroIdx: () => 0 },
  };
  win.Senebty = { foundations: { 'four-treasures': { dailyFoundation: {
    greeting: { title: 'Today is FT', subtitle: 'x', powerWord: 'FT' },
    blessingLine: 'Seneb {name}.',
    dailyGesture: 'gesture',
    microTeachings: [{ scholar: 'Karenga', quote: 'q' }],
  } } } };
  win.__InstallDailyFoundationScreen__(App);
  const container = document.createElement('div');
  App.dailyFoundationScreen.render(App, container, 'four-treasures');
  const greeting = container.children.find(c => c.className === 'senebty-df-greeting');
  assert.ok(greeting, 'greeting card must render when data is at foundations[slug] collection');
});

// v3.51.44 — _renderGestureInstructions coverage

test('_renderGestureInstructions creates a senebty-df-gesture card when dailyGesture is present', () => {
  const { win, document } = loadScreenModule();
  const App = {
    user: { id: 'u1', name: 'King', senebty: { dailyFoundationLog: {} } },
    dailyFoundationGate: { pickMicroIdx: () => 0 },
  };
  win.Senebty = { foundations: { mu: { dailyFoundation: {
    greeting: { title: 'Today is Mu', subtitle: 'Water', powerWord: 'MU' },
    blessingLine: 'Seneb, {name}.',
    dailyGesture: 'Drink one cup of water.',
    microTeachings: [{ scholar: 'Diop', quote: '...' }],
  } } } };
  win.__InstallDailyFoundationScreen__(App);
  const container = document.createElement('div');
  App.dailyFoundationScreen.render(App, container, 'mu');
  const gesture = container.children.find(c => c.className === 'senebty-df-gesture');
  assert.ok(gesture, 'senebty-df-gesture card must be present when dailyGesture is provided');
  const p = gesture.children.find(c => c.tagName === 'P');
  assert.ok(p, '<p> element inside gesture card');
  assert.match(p.textContent, /Drink one cup/);
});

test('_renderGestureInstructions applies --multiline modifier when dailyGesture contains \\n', () => {
  const { win, document } = loadScreenModule();
  const App = {
    user: { id: 'u1', name: 'King', senebty: { dailyFoundationLog: {} } },
    dailyFoundationGate: { pickMicroIdx: () => 0 },
  };
  win.Senebty = { foundations: { 'four-treasures': { dailyFoundation: {
    greeting: { title: 'Today is Four Treasures', subtitle: 'Body', powerWord: 'KHAT' },
    blessingLine: 'Seneb, {name}.',
    dailyGesture: 'Touch Khat (body).\nTouch Ib (heart).',
    microTeachings: [{ scholar: 'Karenga', quote: '...' }],
  } } } };
  win.__InstallDailyFoundationScreen__(App);
  const container = document.createElement('div');
  App.dailyFoundationScreen.render(App, container, 'four-treasures');
  const gesture = container.children.find(c => c.className === 'senebty-df-gesture');
  assert.ok(gesture, 'senebty-df-gesture card must be present');
  const p = gesture.children.find(c => c.tagName === 'P');
  assert.ok(p, '<p> element inside gesture card');
  assert.match(p.className, /senebty-df-greeting__subtitle--multiline/, '--multiline modifier applied for multi-line gesture');
  assert.match(p.className, /senebty-df-greeting__subtitle/, 'base subtitle class also present');
});

test('_renderGestureInstructions does NOT apply --multiline modifier when dailyGesture is single-line', () => {
  const { win, document } = loadScreenModule();
  const App = {
    user: { id: 'u1', name: 'King', senebty: { dailyFoundationLog: {} } },
    dailyFoundationGate: { pickMicroIdx: () => 0 },
  };
  win.Senebty = { foundations: { mu: { dailyFoundation: {
    greeting: { title: 'Today is Mu', subtitle: 'Water', powerWord: 'MU' },
    blessingLine: 'Seneb, {name}.',
    dailyGesture: 'Drink one cup of water.',
    microTeachings: [{ scholar: 'Diop', quote: '...' }],
  } } } };
  win.__InstallDailyFoundationScreen__(App);
  const container = document.createElement('div');
  App.dailyFoundationScreen.render(App, container, 'mu');
  const gesture = container.children.find(c => c.className === 'senebty-df-gesture');
  assert.ok(gesture, 'senebty-df-gesture card must be present');
  const p = gesture.children.find(c => c.tagName === 'P');
  assert.ok(p, '<p> element inside gesture card');
  assert.equal(p.className, 'senebty-df-greeting__subtitle', 'single-line gesture must not have --multiline modifier');
});

// v3.51.44 task 6 — Stage-2 Coach C1: honor-check button copy reads from
// dailyFoundation.honorCheckLabel when present; falls back to generic copy
// when absent (F1 Mu does not override).
test('honor-check button uses dailyFoundation.honorCheckLabel when present (Coach C1)', () => {
  const { win, document } = loadScreenModule();
  const App = {
    user: { id: 'u1', name: 'King', senebty: { dailyFoundationLog: {} } },
    dailyFoundationGate: { pickMicroIdx: () => 0, recordCompletion: () => true },
  };
  win.Senebty = { foundations: { 'four-treasures': { dailyFoundation: {
    greeting: { title: 'Today is the Four Treasures', subtitle: 'Khat, Ib, Ka, Ba — the working four', powerWord: 'KHAT' },
    blessingLine: 'Seneb, {name}. The four are remembered.',
    dailyGesture: 'Touch each treasure, say its name:\n  Khat\n  Ib\n  Ka\n  Ba',
    honorCheckLabel: 'Yes — I touched the four and named the hungry one',
    microTeachings: [{ scholar: 'Obenga', quote: '...' }],
  } } } };
  win.__InstallDailyFoundationScreen__(App);
  const container = document.createElement('div');
  App.dailyFoundationScreen.render(App, container, 'four-treasures');
  const honor = container.children.find(c => c.className === 'senebty-df-honor');
  assert.ok(honor, 'honor button present');
  assert.equal(honor.textContent, 'Yes — I touched the four and named the hungry one', 'honor button reads dailyFoundation.honorCheckLabel verbatim when present');
});

test('honor-check button falls back to generic copy when honorCheckLabel is absent (F1 Mu back-compat)', () => {
  const { win, document } = loadScreenModule();
  const App = {
    user: { id: 'u1', name: 'King', senebty: { dailyFoundationLog: {} } },
    dailyFoundationGate: { pickMicroIdx: () => 0, recordCompletion: () => true },
  };
  win.Senebty = { foundations: { mu: { dailyFoundation: {
    greeting: { title: 'Today is Mu', subtitle: 'Water', powerWord: 'MU' },
    blessingLine: 'Seneb, {name}.',
    dailyGesture: 'Drink one cup.',
    microTeachings: [{ scholar: 'Diop', quote: '...' }],
    // no honorCheckLabel — generic fallback expected
  } } } };
  win.__InstallDailyFoundationScreen__(App);
  const container = document.createElement('div');
  App.dailyFoundationScreen.render(App, container, 'mu');
  const honor = container.children.find(c => c.className === 'senebty-df-honor');
  assert.match(honor.textContent, /did this today/i, 'no-override fallback preserves generic F1 copy');
});

// v3.51.44 task 6 — Stage-2 Coach C2: doing-Veo aria-label is concise when
// gesture card owns the dailyGesture prose, to avoid SR double-read.
test('doing-Veo aria-label is concise when dailyGesture card is rendered (Coach C2 — no SR double-read)', () => {
  const { win, document } = loadScreenModule();
  const App = {
    user: { id: 'u1', name: 'King', senebty: { dailyFoundationLog: {} } },
    dailyFoundationGate: { pickMicroIdx: () => 0, recordCompletion: () => true },
  };
  const multilineGesture = 'Touch each treasure, say its name:\n  Khat — palm on chest\n  Ib — palm on heart\n  Ka — arms lifted to shoulder height, palms forward\n  Ba — fingertips at throat';
  win.Senebty = { foundations: { 'four-treasures': { dailyFoundation: {
    greeting: { title: 'Today is the Four Treasures', subtitle: '...', powerWord: 'KHAT' },
    blessingLine: 'Seneb, {name}.',
    dailyGesture: multilineGesture,
    microTeachings: [{ scholar: 'Obenga', quote: '...' }],
    doingVeo: '/videos/senebty-foundations/four-treasures-touch.mp4',
  } } } };
  win.__InstallDailyFoundationScreen__(App);
  const container = document.createElement('div');
  App.dailyFoundationScreen.render(App, container, 'four-treasures');
  const doing = container.children.find(c => c.className === 'senebty-df-doing');
  const video = doing.children.find(c => c.tagName === 'VIDEO');
  const ariaLabel = video.attrs.get('aria-label');
  // aria-label must NOT contain the full multi-line gesture (which the
  // gesture card already announces to SR users above the Veo).
  assert.notEqual(ariaLabel, multilineGesture, 'aria-label must not duplicate the full multi-line dailyGesture');
  assert.ok(ariaLabel && ariaLabel.length < 80, `aria-label must be concise (got ${ariaLabel && ariaLabel.length} chars): ${ariaLabel}`);
  assert.match(ariaLabel, /ritual demonstration/i, 'aria-label uses generic "Ritual demonstration" form');
});
