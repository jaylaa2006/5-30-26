// Weekly Seba broadcast — personalization + safety contract.
// Locks: child-name greeting with HTML-escaping + "beloved family" fallback,
// {{greeting}} placeholder in both templates, child_name in the query, and the
// consent-correct audience filter.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const script = fs.readFileSync('scripts/send-seba-weekly.mjs', 'utf8');
const fam = fs.readFileSync('emails/seba-weekly-1-family.html', 'utf8');
const book = fs.readFileSync('emails/seba-weekly-2-book.html', 'utf8');

test('both templates carry the {{greeting}} placeholder', () => {
  assert.match(fam, /Hotep, \{\{greeting\}\}\./, 'family template needs {{greeting}}');
  assert.match(book, /Hotep, \{\{greeting\}\}\./, 'book template needs {{greeting}}');
});

test('greetingFor HTML-escapes the child name (no injection)', () => {
  assert.match(script, /function escapeHtml/, 'must have escapeHtml');
  assert.match(script, /function greetingFor/, 'must have greetingFor');
  // greetingFor must run the name through escapeHtml.
  const fn = script.match(/function greetingFor[\s\S]*?\n\}/);
  assert.ok(fn, 'greetingFor must exist');
  assert.match(fn[0], /escapeHtml\(/, 'greetingFor must escape the name');
  assert.match(fn[0], /beloved family/, 'greetingFor must fall back to "beloved family"');
});

test('render + buildMsg thread childName through to {{greeting}}', () => {
  assert.match(script, /\.replaceAll\(['"]\{\{greeting\}\}['"], greetingFor\(childName\)\)/,
    'render must replace {{greeting}} with greetingFor(childName)');
  assert.match(script, /buildMsg = \(to, googleId, email, childName\)/,
    'buildMsg must accept childName');
});

test('query selects child_name + send passes it', () => {
  assert.match(script, /SELECT google_id, parent_email, email_prefs, child_name FROM users/,
    'query must select child_name');
  assert.match(script, /buildMsg\(r\.parent_email, r\.google_id, r\.parent_email, r\.child_name\)/,
    'live send must pass r.child_name');
});

test('audience filter stays consent-correct (verified, non-unsubscribed, prefs honored)', () => {
  assert.match(script, /email_verified = 1/);
  assert.match(script, /unsubscribed = 0/);
  assert.match(script, /weeklyEnabled\(r\.email_prefs\)/, 'must honor per-user weekly pref');
});

// ── Subject-line personalization (option B: "[Child]'s family" framing) ──────
test('subjectGreetingFor is plain-text safe (header-injection-safe, no HTML)', () => {
  assert.match(script, /function subjectGreetingFor/, 'must have subjectGreetingFor');
  const fn = script.match(/function subjectGreetingFor[\s\S]*?\n\}/);
  assert.ok(fn, 'subjectGreetingFor must exist');
  // Strips control chars incl CR/LF — subjects are email headers (injection safety).
  assert.match(fn[0], /\\x00-\\x1F/, 'subject greeting must strip control chars (header-injection safety)');
  // Plain ASCII apostrophe, NOT the body greeting's HTML entity.
  assert.match(fn[0], /'s family/, 'subject greeting must use a plain apostrophe');
  assert.doesNotMatch(fn[0], /&rsquo;|escapeHtml/, 'subject greeting must NOT HTML-escape (plain-text header)');
  // No name → null so subjectFor can fall back to the generic line.
  assert.match(fn[0], /:\s*null/, 'no-name must return null');
});

test('subjectFor falls back to the generic subject when no child name', () => {
  const fn = script.match(/function subjectFor[\s\S]*?\n\}/);
  assert.ok(fn, 'subjectFor must exist');
  assert.match(fn[0], /return iteration\.subject/, 'must fall back to the static subject');
  assert.match(fn[0], /iteration\.subjectP/, 'must use the per-iteration personalizer when a name exists');
});

test('both send paths use personalized subjectFor, and iterations define subjectP', () => {
  assert.match(script, /subject:\s*subjectFor\(iteration, childName\)/, 'live send subject must be personalized');
  assert.match(script, /subject:\s*['"]\[TEST\] ['"]\s*\+\s*subjectFor\(it, TEST_CHILD\)/,
    'test-mode subject must be personalized too');
  assert.match(script, /subjectP:\s*fam =>/, 'iterations must define a subjectP personalizer');
});
