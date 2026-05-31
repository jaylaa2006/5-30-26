#!/usr/bin/env node
/**
 * generate-story-intros-v2.mjs — chunk-sourced story intro/outro generator.
 *
 * Implements the Video Generation Golden Law (.claude/rules/video-generation-
 * golden-law.md) + the 2026-05-21 best-in-class RT+Coach
 * (docs/superpowers/round-tables/2026-05-21-video-pipeline-best-in-class-rt.md).
 *
 * Pipeline (per locked decisions: pure-text STYLE_BASE, looping backdrops,
 * 16:9, Standard quality):
 *   1. Parse the story's chunks + title + principle from maat-reader.html
 *      (same parser shape as generate-art-v2.js).
 *   2. Distill context with Gemini (Vertex) — INTRO: chunks 1-2 → ONE
 *      establishing tableau (opening only, no spoilers). OUTRO: last 2 chunks
 *      + principle → ONE idealized resolution tableau (principle landing,
 *      tone matched to the ending).
 *   3. Assemble the Veo prompt: STYLE_BASE (cel-shaded, UNCHANGED) + the
 *      distilled scene + Africana/anti-Europeanization clause.
 *   4. Generate via Vertex Veo 3.1 (veo-3.1-generate-001), save inline bytes
 *      + a reproducibility sidecar.
 *
 * Auth: ADC (gcloud auth application-default login).
 * Usage:
 *   GCP_PROJECT=<id> node generate-story-intros-v2.mjs --story <id> --mode intro [--dry-run]
 *   GCP_PROJECT=<id> node generate-story-intros-v2.mjs --story <id> --mode outro
 *   node generate-story-intros-v2.mjs --list-pending      # pending intros (no auth needed)
 */

import { GoogleGenAI } from '@google/genai';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';

const HTML_FILE = 'maat-reader.html';
// Story data lives in BOTH the reader HTML (general library) and the extracted
// public/js/stories.js bundle (pert-em-heru, sage-peh, and other newer sets).
// The parser must read both so every story is reachable (HARD RULE 0 — fix the
// parser, never hand-author prompts). Extra files only ADD matches.
const STORY_SRC_FILES = [HTML_FILE, 'public/js/stories.js'];
const PROJECT = process.env.GCP_PROJECT;
const LOCATION = process.env.GCP_LOCATION || 'us-central1';
const VEO_MODEL = process.env.GCP_VEO_MODEL || 'veo-3.1-generate-001';
const TEXT_MODEL = process.env.GCP_TEXT_MODEL || 'gemini-2.5-flash';

// ─── args ───────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const OPTS = { story: null, mode: 'intro', dryRun: false, listPending: false };
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--story') OPTS.story = argv[++i];
  else if (argv[i] === '--mode') OPTS.mode = argv[++i];
  else if (argv[i] === '--dry-run') OPTS.dryRun = true;
  else if (argv[i] === '--list-pending') OPTS.listPending = true;
}

// ─── STYLE_BASE — the cel-shaded substrate. DO NOT alter the look. ──
// (Carried verbatim from the shipped intro generators so the new clips
//  match the original grade-2 intros exactly. Golden Law clause 1+4.)
const STYLE_BASE = `Cinematic cel-shaded Spider-Verse animation. Bold graphic linework, flat color fills, dramatic chiaroscuro lighting. Warm ancient-Egyptian palette — gold (#C4A347), lapis blue (#1a237e), carnelian (#B8412B), malachite (#2E7D32), sandstone cream. 1080p 16:9. Children's book quality. Full cinematic motion (camera move + character action). NO text, NO watermarks, NO speech bubbles, NO Latin/Roman alphabet, NO signatures.

AUTHENTIC AFRICANA REPRESENTATION: every human figure has very dark brown to rich ebony skin with warm golden undertones, broad noses with wide nostrils, full prominent lips, 4C tightly coiled hair, Nilotic bone structure. Render skin in deep dark-brown to ebony tones only. Every figure is a dark-skinned person of the ancient Kemet cultural continuum.`;

// ─── Veo prompt-safety ──────────────────────────────────────────────
// Probe finding (2026-05-21): "Jesus", "Yeshua", and "sacred/reverent/
// healing" ALL pass Veo RAI in isolation. The carpenter block came from
// the DENSE prompt — most likely the weapon-adjacent tool inventory
// (adze/awl/drill-bow) + over-stuffed detail. So: KEEP names + setting +
// sacred language; keep briefs LEAN; soften weapon-like objects.
const LEAN_SAFETY = `KEEP THE PROMPT LEAN AND SUBMITTABLE (the video model rejects over-dense prompts):
- ONE clear scene, ONE main figure (at most one other). No long inventories of tools or objects.
- Do NOT list sharp/striking implements (no "adze", "awl", "chisel", "blade", "axe", "drill-bow", "spear", "knife"). If a tool matters, say "a woodworking tool" generically.
- Plain, concrete adjectives — no stacked ornate description, no "sacred/holy/divine".
- You MAY use the story's real names + setting (generate as authored — try first). KEEP the dark-skinned Nilotic / Africana physical description (required, safe).`;

// Net for residual triggers: identifiable-figure naming + weapon-adjacent nouns.
const SCRUB = [
  [/\bcarpenter of Nazareth\b/gi, 'village carpenter'],
  [/\bYeshua['’]?s?\b/gi, 'the young carpenter'],
  [/\bJesus['’]?s?\b/gi, 'the young carpenter'],
  [/\b(?:adze|awl|chisel|drill-?bow|axe|hatchet|blade|knife|spear|sickle)s?\b/gi, 'woodworking tool'],
];
function scrub(text) {
  let t = text;
  for (const [re, rep] of SCRUB) t = t.replace(re, rep);
  return t;
}

// ─── story parser (shape ported from generate-art-v2.js) ────────────
function parseStories() {
  const html = STORY_SRC_FILES
    .filter(f => existsSync(f))
    .map(f => readFileSync(f, 'utf8'))
    .join('\n');
  const meta = [];
  const storyRegex = /\{\s*['"]?id['"]?:\s*(?:'([^']+)'|"([^"]+)")\s*,\s*['"]?title['"]?:\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")\s*,\s*['"]?level['"]?:\s*['"]?(\d+)['"]?\s*,\s*['"]?grade['"]?:\s*['"]?(\d+)['"]?\s*,\s*['"]?principle['"]?:\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")\s*,\s*['"]?scene['"]?:\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")\s*,/g;
  for (const m of html.matchAll(storyRegex)) {
    meta.push({
      id: m[1] || m[2],
      title: (m[3] || m[4] || '').replace(/\\'/g, "'").replace(/\\"/g, '"'),
      principle: m[7] || m[8] || '',
      scene: m[9] || m[10] || '',
    });
  }
  for (const story of meta) {
    let s = html.indexOf(`{id:'${story.id}'`);
    if (s === -1) s = html.indexOf(`{id:"${story.id}"`);
    if (s === -1) s = html.indexOf(`id: '${story.id}'`);
    if (s === -1) s = html.indexOf(`'id':'${story.id}'`);
    if (s === -1) s = html.indexOf(`'id': '${story.id}'`);
    if (s === -1) continue;
    let cs = html.indexOf('chunks:[', s);
    if (cs === -1 || cs > s + 800) cs = html.indexOf('chunks: [', s);
    if (cs === -1 || cs > s + 800) cs = html.indexOf('"chunks":[', s);
    if (cs === -1) continue;
    const after = html.substring(cs, cs + 500000);
    const end = after.match(/\]\s*,\s*"?(?:comprehensionPool|questions|maatReflections|hekaMoments)"?\s*:\s*\[/);
    if (!end) continue;
    const bracket = html.indexOf('[', cs);
    const body = html.substring(bracket + 1, cs + end.index);
    story.chunks = [];
    const chunkRegex = /\{\s*"?text"?:\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/g;
    for (const cm of body.matchAll(chunkRegex)) {
      const raw = cm[1] || cm[2] || '';
      story.chunks.push(raw.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\n/g, '\n'));
    }
  }
  return meta.filter(s => s.chunks && s.chunks.length > 0);
}

// ─── distillation prompt (structured, single-tableau, no-spoiler) ───
const ULTRA_SAFE = `ULTRA-SAFE RETRY (the first attempt was REJECTED — go maximally neutral):
- Do NOT name or depict an IDENTIFIABLE real religious or public figure (e.g. "Yeshua / Jesus of Nazareth"). Describe people GENERICALLY by role — "a young carpenter", "a queen", "an elder".
- NO crowds, NO "multitudes", NO gatherings — at most ONE ordinary person, or NONE (just the place).
- NO blood, bleeding, wounds, illness, bodies, or death.
- NO anointing, ritual, ceremony, worship, miracle, or prayer — no religious act of any kind.
- Just a calm, secular ESTABLISHING LANDSCAPE or quiet daily-life scene: the setting, the light, the weather, gentle ambient motion. Evoke the WORLD, not an event.`;
// Canonical climactic iconography for the Pert em Heru (Book of Coming Forth by
// Day) chapters — Africana/Kemetic authority reference (RT 2026-05-30) fed to the
// distiller so each sacred chapter CLOSES on its strongest canonical image, not a
// generic pan-out. Keyed by the chapter slug shared by the pert-em-heru-* and
// sage-peh-* sets. Phrased by ROLE / SYMBOL (not divine proper names) so the RAI
// scrub stays clean. This is reference CONTEXT, not a hand-authored prompt — the
// generator still distills + scrubs the final Veo prompt (HARD RULE 0).
const CHAPTER_ICONOGRAPHY = {
  'hymn-to-ra': 'the solar barque cresting the dawn horizon — the great radiant sun-disk lifting over the Nile at the triumphant first light of morning',
  'story-of-osiris': 'the green-skinned ancestral king rising reborn and upright, a winged guardian queen enfolding him in her outstretched wings, the djed pillar of endurance raised behind',
  'journey-begins': 'the human-headed Ba-soul bird taking flight on spread wings toward the luminous gateway of the hidden world',
  'great-questions': 'the creative Word bursting into radiant living hieroglyphs of light as the cosmos awakens at the spark of self-knowing',
  'power-of-names': 'the true name blazing in golden hieroglyphic fire within a cartouche of living light',
  'heart-chapter': 'the luminous heart resting perfectly steady and true on one golden pan of the great scale',
  'courage-serpent': 'at the prow of the solar barque a lance of dawn-light spears the vast chaos-serpent coiled beneath the dark waters — radiant light overcoming darkness (triumphant, never gory)',
  'knowing-all': 'the master key of wisdom turning as luminous papyrus scrolls of knowledge unfurl, the shining akh-spirit blazing into brilliance',
  'golden-falcon': 'the golden falcon-soul bursting upward into powerful soaring flight, climbing high above the temple and the gleaming river',
  'bennu-bird': 'the sacred Bennu heron erupting from holy flame and rising reborn on blazing wings toward the rising sun',
  'lotus': 'the sacred blue lotus surging up from the dark water and bursting fully open to the sunrise, petals unfurling in radiant light',
  'hall-of-truths': 'the great golden scales settling perfectly level — the heart weighed true against the single feather of Maat — before the silent assembled assessors in the immense pillared hall',
  '42-declarations': "the vindicated soul declared true-of-voice — an ibis-headed divine scribe inscribing the verdict as radiant affirmation fills the hall",
  'field-of-reeds': 'the radiant abundant Field of Reeds opening wide — golden harvest, eternal blue waters, lush green fields — as the vindicated soul steps into paradise',
  'new-morning': 'the transfigured shining akh stepping forth into the blazing sunrise, arms lifting, reborn into eternal light — Coming Forth by Day',
};
function iconographyFor(storyId) {
  const key = storyId.replace(/^(pert-em-heru|sage-peh)-/, '');
  return CHAPTER_ICONOGRAPHY[key] || null;
}

function distillInstruction(story, mode, ultraSafe) {
  const synopsis = `"${story.title}" — a story about ${story.principle}.`;
  if (mode === 'intro') {
    const ctx = story.chunks.slice(0, 2).join('\n\n');
    return `You are a cinematic art director for a cel-shaded children's animation set in the ancient African / Kemet cultural continuum.

${LEAN_SAFETY}${ultraSafe ? '\n\n' + ULTRA_SAFE : ''}

${synopsis}

OPENING (first two pages):
${ctx}

Write ONE establishing-shot scene brief for the story's OPENING — a single coherent tableau (one location, one moment, one camera move). This is an INTRO that loops as ambient background while a child reads, so it must feel inviting and alive. Establish the OPENING setting only — do NOT depict later plot events (no spoilers). Collapse the two pages into ONE scene, not two.

Return STRICT JSON, no prose outside it:
{"setting":"","time_of_day":"","foreground":"","midground":"","background":"","characters":"(describe with very dark brown/ebony skin, 4C hair, Nilotic features — anti-lightening)","action":"(the ONE full motion + camera move)","mood":""}`;
  }
  // outro — the chapter's CLIMACTIC ICONOGRAPHIC BEAT (its peak sacred image),
  // NOT a dull resolution pan-out and NOT the narrator/teacher frame. Feed the
  // opening (subject + cast) PLUS the whole SECOND HALF (where the mythic climax
  // and close live) so the distiller can land the strongest moment. Sacred-text
  // close per the Africana iconography round table (RT 2026-05-30).
  const half = Math.max(1, Math.floor(story.chunks.length / 2));
  const ctx = [story.chunks[0], ...story.chunks.slice(half)].join('\n\n');
  const icon = iconographyFor(story.id);
  return `You are a cinematic art director for a cel-shaded children's animation set in the ancient African / Kemet cultural continuum.

${LEAN_SAFETY}${ultraSafe ? '\n\n' + ULTRA_SAFE : ''}

${synopsis}
${icon ? `\nSACRED ICONOGRAPHY — this is a chapter of the Book of Coming Forth by Day; it MUST close on its canonical climactic image: ${icon}.\n` : ''}
STORY (opening for subject + cast, then the climactic SECOND HALF):
${ctx}

Write ONE OUTRO scene brief: the CLIMACTIC ICONOGRAPHIC BEAT that closes this ${icon ? 'sacred chapter' : 'story'} on its STRONGEST image, landing the principle of "${story.principle}" at its triumphant, luminous PEAK — NOT a quiet wind-down. One coherent tableau (one location, one decisive moment).

HARD CONSTRAINTS:
- ICONOGRAPHY FIRST: the closing image is the chapter's own central sacred figure, creature, or symbol at its MOMENT OF POWER${icon ? ' — render the canonical image named above' : ' (for a mythic chapter: the solar barque, the Bennu in flame, the scales + feather of Maat, the soaring falcon, the bursting blue lotus, the Field of Reeds)'}.
- ACTION + CAMERA = FULL CINEMATIC MOTION at the peak. The subject ACTS at full intensity (the lotus bursts open, the Bennu erupts and rises, the falcon launches skyward, the scales settle with weight, dawn-light spears the dark). Drive the camera INTO the moment — a decisive push-in, a craning RISE to a triumphant hero-shot, a soaring climb with the subject, or a charged reveal of the icon. Then settle the motion onto a held, iconic FINAL frame that matches the FIRST frame so the 8s clip still loops seamlessly.
- BANNED (these read as dull/dead): a generic slow "pull back and crane up", a static pan-out, "slowly revealing the landscape" as the whole move, a frozen figure merely observing or contemplating. Climax, not wind-down.
- Do NOT depict the storytelling FRAME: no narrator/teacher/elder/scribe telling the tale (e.g. "Seba" / "Seba Khafre"), and no reader-child being addressed (no "{name}", no "Living Sun" or any similar epithet the text uses for the READER). They are the frame, not the scene.
- Describe any sacred or royal figure GENERICALLY and reverently by role or as iconographic Kemetic imagery (an enthroned ancestral king, a sacred falcon, a radiant winged guardian) — never by a real divine proper name. Sacred and dignified, child-safe — triumphant light, NEVER gore. Every figure dark-skinned Kemetic, anti-lightening.

Return STRICT JSON, no prose outside it:
{"setting":"","time_of_day":"","foreground":"","midground":"","background":"","characters":"(the chapter's OWN sacred subject/figures — very dark brown/ebony skin, 4C hair, Nilotic features — anti-lightening; NO narrator, NO reader-child)","action":"(FULL cinematic CLIMACTIC motion + a CHARGED dynamic camera driving INTO the icon — NOT a pull-back/pan-out — settling to a loopable iconic frame)","mood":"(the principle '${story.principle}' landing at its triumphant peak)"}`;
}

function briefToVeoPrompt(brief, story, mode) {
  const lines = [
    STYLE_BASE,
    '',
    `SCENE (${mode} — ${story.title}): ${brief.setting}. ${brief.time_of_day}.`,
    `FOREGROUND: ${brief.foreground}`,
    `MIDGROUND: ${brief.midground}`,
    `BACKGROUND: ${brief.background}`,
    `CHARACTERS: ${brief.characters}`,
    `ACTION + CAMERA: ${brief.action}`,
    `MOOD: ${brief.mood}`,
    `LOOP: seamless — final frame returns to the first so the clip loops without a visible cut.`,
  ];
  return scrub(lines.join('\n'));
}

// ─── main ───────────────────────────────────────────────────────────
const stories = parseStories();

if (OPTS.listPending) {
  const introM = readFileSync(HTML_FILE, 'utf8').match(/_introVideoSlugs:\s*new Set\(\[([^\]]*)\]\)/);
  const have = new Set((introM ? introM[1] : '').split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')));
  // Emit ALL chunk-having non-battle story ids; the caller diffs against the
  // PROD intro files (source of truth) to find what GENUINELY has no intro —
  // the manifest can drift, so we don't trust it for "already exists".
  const all = stories.filter(s => s.scene !== 'scene-battle').map(s => s.id);
  console.log(all.join('\n'));
  console.error('[stories] ' + all.length + ' chunk-having non-battle stories; manifest has ' + have.size);
  process.exit(0);
}

if (!OPTS.story) { console.error('Need --story <id>'); process.exit(1); }
const story = stories.find(s => s.id === OPTS.story);
if (!story) { console.error('Story not found or has no chunks:', OPTS.story); process.exit(1); }
console.log(`[${OPTS.mode}] ${story.id} — "${story.title}" (${story.chunks.length} chunks, principle: ${story.principle})`);

if (!PROJECT) { console.error('Missing GCP_PROJECT'); process.exit(1); }
const ai = new GoogleGenAI({ vertexai: true, project: PROJECT, location: LOCATION });

// distill + generate, with auto-retry-on-block (ultra-safe re-distill)
const outDir = OPTS.mode === 'intro' ? 'videos/intros' : 'videos/outros';
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
const outPath = `${outDir}/${story.id}.mp4`;

async function distill(ultraSafe) {
  const resp = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: distillInstruction(story, OPTS.mode, ultraSafe),
    config: { responseMimeType: 'application/json', temperature: 0.7 },
  });
  return JSON.parse(resp.text.trim().replace(/^```json|```$/g, ''));
}

const MAX_POLLS = 60; // ~10 min cap — prevents the indefinite hang seen 2026-05-21
async function tryGenerate(prompt) {
  let op = await ai.models.generateVideos({
    model: VEO_MODEL, prompt, config: { aspectRatio: '16:9', resolution: '1080p' },
  });
  let polls = 0;
  while (!op.done) {
    if (polls >= MAX_POLLS) return { netError: true, error: { message: 'poll timeout (>10min)' } };
    polls++; process.stdout.write(`\r[veo] ${polls * 10}s elapsed`);
    await new Promise(r => setTimeout(r, 10000));
    try { op = await ai.operations.getVideosOperation({ operation: op }); }
    catch (e) { return { netError: true, error: { message: 'poll: ' + (e.message || e) } }; }
  }
  console.log('');
  if (op.error) return { blocked: true, error: op.error };
  const vid = op.response?.generatedVideos?.[0]?.video;
  if (!vid) return { blocked: true, error: { message: 'no video returned' } };
  return { vid };
}

const NET_RE = /ENOTFOUND|ECONNRESET|ETIMEDOUT|EAI_AGAIN|fetch failed|token failed|network|timeout/i;

const MAX_ATTEMPTS = 2;      // RAI re-distill attempts (normal → ultra-safe)
const MAX_NET_RETRIES = 6;   // transient network retries (do NOT consume RAI attempts)
let saved = false, lastErr = null, usedBrief = null, usedPrompt = null, netRetries = 0;
for (let attempt = 0; attempt < MAX_ATTEMPTS && !saved; attempt++) {
  const ultraSafe = attempt > 0;
  console.log(`[distill] ${TEXT_MODEL}${ultraSafe ? ' (ultra-safe retry)' : ''} ...`);
  let brief;
  try { brief = await distill(ultraSafe); }
  catch (e) {
    if (NET_RE.test(e.message || '') && netRetries < MAX_NET_RETRIES) {
      netRetries++; console.error(`[net] transient distill error (${String(e.message).slice(0, 50)}) — wait 20s, retry ${netRetries}/${MAX_NET_RETRIES}`);
      await new Promise(res => setTimeout(res, 20000)); attempt--; continue;
    }
    console.error('[distill] failed:', e.message); process.exit(2);
  }
  const veoPrompt = briefToVeoPrompt(brief, story, OPTS.mode);
  usedBrief = brief; usedPrompt = veoPrompt;
  if (OPTS.dryRun) {
    console.log('\n──────── VEO PROMPT ────────\n' + veoPrompt + '\n────────────────────────────');
    console.log('[dry-run] no video generated.'); process.exit(0);
  }
  console.log(`[veo] generating (attempt ${attempt + 1}/${MAX_ATTEMPTS}) via ${VEO_MODEL} ...`);
  const r = await tryGenerate(veoPrompt);
  if (r.vid) {
    const vid = r.vid;
    if (vid.videoBytes) writeFileSync(outPath, Buffer.from(vid.videoBytes, 'base64'));
    else if (vid.uri && !vid.uri.startsWith('gs://')) writeFileSync(outPath, Buffer.from(await (await fetch(vid.uri)).arrayBuffer()));
    else { console.error('[veo] unexpected video shape:', JSON.stringify(vid).slice(0, 800)); process.exit(3); }
    saved = true;
  } else if (r.netError) {
    if (netRetries < MAX_NET_RETRIES) {
      netRetries++; console.error(`[net] transient gen error (${String(r.error?.message).slice(0, 50)}) — wait 20s, retry ${netRetries}/${MAX_NET_RETRIES}`);
      await new Promise(res => setTimeout(res, 20000)); attempt--; continue;
    }
    lastErr = r.error; console.error('[net] gave up after network retries:', r.error?.message);
  } else {
    lastErr = r.error;
    console.error(`[veo] blocked (attempt ${attempt + 1}): ${String(r.error?.message).slice(0, 130)}`);
  }
}

if (!saved) {
  console.error(`[veo] GAVE UP after ${MAX_ATTEMPTS} attempts. Last: ${String(lastErr?.message).slice(0, 160)}`);
  process.exit(3);
}

writeFileSync(`${outDir}/${story.id}.${OPTS.mode}.json`, JSON.stringify({
  id: story.id, mode: OPTS.mode, model: VEO_MODEL, textModel: TEXT_MODEL,
  principle: story.principle, brief: usedBrief, prompt: usedPrompt, generatedAt: new Date().toISOString(),
}, null, 2));
console.log(`[ok] saved ${outPath} (+ sidecar)`);
