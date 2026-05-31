// tests/senebty-wing-screen-visible.test.mjs
// Regression lock for the v3.51.64 prod bug: the #senebty wing screen was
// invisible for ALL users because it carried a static `hidden` attribute that
// the generic screen-switcher (App.nav: `forEach(remove .active)` +
// `getElementById(screen).add('active')`) never clears. Other screens work
// because they have no static `hidden`; #senebty was the lone exception, so
// clicking into the Senebty wing showed nothing.
//
// Root cause: the daily-foundation gate path (the _dfContainer branch) DOES
// clear `hidden` (`_dfContainer.hidden = false`), but the rings fall-through
// goes through the generic nav, which only toggles `.active`. A screen that is
// shown via the generic `.active` mechanism MUST NOT carry a static `hidden`
// attribute, or it stays display:none forever.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('maat-reader.html', 'utf8');

test('#senebty wing screen has NO static hidden attribute (shown via generic .active nav)', () => {
  const m = html.match(/<div id="senebty"\s+class="screen"([^>]*)>/);
  assert.ok(m, '#senebty screen div must exist');
  assert.doesNotMatch(
    m[1],
    /\bhidden\b/,
    '#senebty must NOT have a static `hidden` attribute — the generic screen-switcher only toggles .active and never clears hidden, so a static hidden leaves the wing invisible (v3.51.64 regression).',
  );
});

test('daily-foundation containers keep hidden ONLY because their show-path clears it', () => {
  // senebtyDailyFoundation legitimately keeps `hidden` because the gate path
  // explicitly sets `_dfContainer.hidden = false` before adding .active.
  // This test documents the invariant: if a .screen carries static `hidden`,
  // there must be an explicit `.hidden = false` clear somewhere in the source.
  const dfHasHidden = /<div id="senebtyDailyFoundation"\s+class="screen"\s+hidden>/.test(html);
  if (dfHasHidden) {
    assert.match(
      html,
      /_dfContainer\.hidden\s*=\s*false/,
      'senebtyDailyFoundation carries static hidden — its show-path MUST clear it via `_dfContainer.hidden = false`.',
    );
  }
});

test('generic screen-switcher exists (the .active toggle the wing relies on)', () => {
  assert.match(
    html,
    /querySelectorAll\('\.screen'\)\.forEach\(s\s*=>\s*s\.classList\.remove\('active'\)\)/,
    'the generic screen-switcher (remove .active from all) must exist',
  );
});
