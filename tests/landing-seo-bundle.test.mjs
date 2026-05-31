// v3.51.78 — Landing-page SEO audit bundle (2026-05-27).
//
// User-prompted ("ensure the landing page is indeed fine for SEO"). The
// audit found the landing was technically clean (JSON-LD, OG, sitemap,
// robots, mobile, compression all ✓) but the TEXT signals were thin:
//
//   #1 TITLE — brand-only "Per Ankh Reader — House of Life" wasted 27
//      chars of a 60-char SEO budget. New domain, no brand authority
//      yet → search queries for "African stories for kids", "Maat",
//      "Kemet" got 0 signal from the title.
//   #2 META DESCRIPTION — 172 chars, truncated in SERP (~155 limit).
//   #3 H1 — two h1s on landing (noscript + visible .intro-title). The
//      visible one was brand-only; noscript one was keyword-rich.
//   #4 INTERNAL LINKING — only 1 story link from landing (the v3.51.77
//      imhotep sample). Internal links are crawl-rank fuel; landing
//      should link 4-6 hero stories to lift their rank.
//
// Per-story prerendered pages were ALREADY strong (unique title,
// chunk-0 description, Article + Breadcrumb JSON-LD, 6-link crawl
// graph). This bundle only touches the landing.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('maat-reader.html', 'utf8');

// ── #1 — keyword-rich title (≤70 chars to avoid SERP truncation) ────────

test('#1 — landing <title> carries primary keywords and is ≤70 chars', () => {
  const m = html.match(/<title>([^<]+)<\/title>/);
  assert.ok(m, '<title> must exist');
  const title = m[1];
  assert.ok(title.length <= 70,
    `<title> is ${title.length} chars — Google truncates at ~60-65 visible chars (pixel budget): "${title}"`);
  // Must include at least the brand + "African" + age-range tokens.
  assert.match(title, /per ankh|peraNkh/i, 'title must include the brand');
  assert.match(title, /African/i, 'title must include "African" (primary search keyword)');
  assert.match(title, /5-14|kids|children/i, 'title must include age-range / audience keyword');
  // Bonus: at least one of the Kemetic-niche keywords.
  assert.match(title, /Maat|Kemet|Nubia|Kush|Aksum/i,
    'title must include at least one Kemetic-niche keyword (Maat/Kemet/Nubia/Kush/Aksum) to capture long-tail');
});

// ── #2 — meta description ≤160 chars (no SERP truncation) ───────────────

test('#2 — landing meta description ≤160 chars + keyword coverage', () => {
  const m = html.match(/<meta name="description" content="([^"]+)"/);
  assert.ok(m, '<meta name="description"> must exist');
  const desc = m[1];
  assert.ok(desc.length <= 160,
    `description is ${desc.length} chars — Google truncates at ~155 on desktop: "${desc}"`);
  assert.ok(desc.length >= 120,
    `description is ${desc.length} chars — under 120 wastes SERP real estate: "${desc}"`);
  // Must include the highest-value keyword cluster.
  assert.match(desc, /African/i, 'description must include "African"');
  assert.match(desc, /Maat/i, 'description must include "Maat"');
  // At least 2 geographic / civilizational keywords from the niche set.
  const niche = ['Kemet', 'Nubia', 'Kush', 'Aksum', 'Mali', 'Imhotep', 'Mansa Musa', 'Hatshepsut'];
  const hits = niche.filter(k => new RegExp(k, 'i').test(desc));
  assert.ok(hits.length >= 2,
    `description should hit ≥2 niche keywords (got ${hits.length}: ${hits.join(',') || 'none'}): "${desc}"`);
});

// ── #3 — visible h1 carries keywords (not brand-only) ───────────────────

test('#3 — visible (.intro-title) h1 carries the African/Stories/Ages keywords', () => {
  // Allow nested children (v3.51.79: brand + sub spans for visual hierarchy
  // while keeping the SEO keyword string in h1 textContent).
  const m = html.match(/<h1[^>]*class="intro-title"[^>]*>([\s\S]*?)<\/h1>/);
  assert.ok(m, 'visible .intro-title h1 must exist');
  // Strip inner tags so we test the rendered text content.
  const textContent = m[1].replace(/<[^>]+>/g, '').trim();
  assert.match(textContent, /African|Kemet|Story|Stories|Maat/i,
    `visible h1 textContent should carry at least one primary keyword (was brand-only pre-fix): "${textContent}"`);
  // v3.51.79 specifically: if the h1 contains nested spans, the descriptor
  // sub-span MUST exist (visual hierarchy fix) so the brand isn't equal-
  // weight with the keyword line.
  if (/<span/.test(m[1])) {
    assert.match(m[1], /class=["']intro-title-sub["']/,
      'h1 with nested spans must include .intro-title-sub for visual hierarchy (v3.51.79 fix)');
  }
});

// ── #4 — Featured Stories internal-linking block ────────────────────────

test('#4 — landing intro carries a Featured Stories block with 4-6 internal links to /stories/<slug>', () => {
  const introStart = html.indexOf('<div id="intro"');
  assert.ok(introStart > 0, '#intro screen must exist');
  const introEnd = html.indexOf('<!-- ═══════════ WELCOME', introStart);
  const intro = html.slice(introStart, introEnd > 0 ? introEnd : introStart + 80000);
  // Count distinct /stories/<slug> hrefs in the intro (excluding the hub itself).
  const links = [...new Set(
    [...intro.matchAll(/href="\/stories\/([a-z0-9-]+)"/g)].map(m => m[1])
  )];
  assert.ok(links.length >= 4,
    `landing intro must internal-link ≥4 distinct /stories/<slug> pages (got ${links.length}: ${links.join(', ')})`);
  assert.ok(links.length <= 8,
    `landing intro should link ≤8 hero stories (got ${links.length}) — too many dilutes the signal`);
  // The Featured Stories block must be wrapped in a clear section heading or class.
  assert.match(intro, /(Featured\s*Stories|Try\s*a\s*Story|Sample\s*Stories|Read\s*these|Start\s*here)/i,
    'Featured Stories block must carry a recognizable heading ("Featured Stories" / "Try a Story" / similar)');
});

// ── og: + twitter: parity with the new title/description ────────────────

test('#5 — og:title + og:description match the new title/description keywords', () => {
  const ogt = html.match(/<meta property="og:title" content="([^"]+)"/);
  const ogd = html.match(/<meta property="og:description" content="([^"]+)"/);
  assert.ok(ogt, 'og:title must exist');
  assert.ok(ogd, 'og:description must exist');
  // og:title should also carry African + age-range keywords (social parity).
  assert.match(ogt[1], /African/i,
    `og:title must carry the "African" keyword for social sharing parity: "${ogt[1]}"`);
  assert.match(ogd[1], /African/i,
    `og:description must carry "African" for social parity: "${ogd[1]}"`);
});
