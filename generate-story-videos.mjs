#!/usr/bin/env node
// Generate Story-Specific Intro + Outro Videos for Per Ankh Reader
// Uses Gemini 2.5 Flash to analyze story text → deeply specific prompts → Veo 3.1
//
// Usage:
//   node generate-story-videos.mjs                    — all stories without videos
//   node generate-story-videos.mjs papyrus-makers     — one story
//   node generate-story-videos.mjs --list             — list stories & status
//   node generate-story-videos.mjs --prompts-only     — generate prompts, don't call Veo
//   node generate-story-videos.mjs --intro-only       — only generate intros
//   node generate-story-videos.mjs --outro-only       — only generate outros

import { GoogleGenAI } from '@google/genai';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { config } from 'dotenv';

config();

// API key cycling — collect all GEMINI_API_KEY* from .env
const API_KEYS = [
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY_4,
].filter(Boolean);
if (!API_KEYS.length) { console.error('Missing GEMINI_API_KEY in .env'); process.exit(1); }
console.log(`[KEYS] ${API_KEYS.length} API key(s) available for cycling`);

let _keyIdx = 0;
let ai = new GoogleGenAI({ apiKey: API_KEYS[0] });

function cycleKey() {
  _keyIdx++;
  if (_keyIdx >= API_KEYS.length) return false;
  console.log(`[KEYS] Switching to key ${_keyIdx + 1} of ${API_KEYS.length}`);
  ai = new GoogleGenAI({ apiKey: API_KEYS[_keyIdx] });
  return true;
}

// ─── Extract stories from maat-reader.html ─────────────────────────

function extractStories() {
  const html = readFileSync('maat-reader.html', 'utf-8');

  // Find the STORIES array — it starts after "const STORIES = [" and ends at matching "];"
  const storiesMatch = html.match(/const\s+STORIES\s*=\s*\[/);
  if (!storiesMatch) { console.error('Could not find STORIES array'); process.exit(1); }

  const startIdx = storiesMatch.index + storiesMatch[0].length - 1;
  // Find the matching close bracket
  let depth = 1, i = startIdx + 1;
  while (depth > 0 && i < html.length) {
    if (html[i] === '[') depth++;
    else if (html[i] === ']') depth--;
    i++;
  }
  const storiesStr = html.substring(startIdx, i);

  // Evaluate — the story data is plain JS objects
  let stories;
  try {
    stories = new Function(`return ${storiesStr}`)();
  } catch (e) {
    console.error('Failed to parse STORIES array:', e.message);
    process.exit(1);
  }

  return stories;
}

// ─── Check which stories need videos ────────────────────────────────

function getVideoStatus(storyId, scene) {
  const isBattle = scene === 'scene-battle';
  const introPath = isBattle ? `videos/${storyId}.mp4` : `videos/intros/${storyId}.mp4`;
  const outroPath = `videos/outros/${storyId}.mp4`;
  return {
    hasIntro: existsSync(introPath),
    hasOutro: existsSync(outroPath),
    introPath,
    outroPath,
  };
}

// ─── Gemini prompt generator ────────────────────────────────────────

const STYLE_BASE = `Cinematic animated scene in modern cel-shaded Spider-Verse art style. Bold graphic linework, flat color fills with dramatic lighting. Saturated ancient African color palette — gold (#FFD700), lapis blue (#2E5FBF), carnelian red, malachite green. Children's book quality. NO text, NO watermarks, NO speech bubbles, NO UI elements.

CRITICAL CHARACTER DESIGN: All characters have VERY dark brown/black Nubian skin, broad noses, full lips, 4C tightly coiled African hair. Authentic East African/Nilotic features. NOT European features. NOT lightened skin.`;

async function generateVideoPrompts(story) {
  const chunks = story.chunks || [];
  const totalChunks = chunks.length;

  // Extract key story text sections
  const openingText = chunks.slice(0, 2).map(c => c.text).join('\n\n');
  const climaxText = chunks.slice(Math.max(0, totalChunks - 3)).map(c => c.text).join('\n\n');

  const systemPrompt = `You are a cinematic video prompt engineer for a children's Kemetic educational reading app called "Per Ankh Reader." You create deeply specific, visually rich video prompts for Veo 3.1 (Google's video generation AI).

RULES:
1. Every prompt must be DEEPLY SPECIFIC to this story — reference exact characters by name, exact settings, exact actions from the text
2. NO generic "Egyptian temple" or "Nile river" establishing shots — capture the SPECIFIC moment that makes THIS story unique
3. Focus on PHYSICAL ACTION — people moving, gestures, objects being used, weather, landscapes. Veo excels at this.
4. NEVER describe internal emotions ("realization dawning", "understanding growing", "shift in eyes") — Veo CANNOT render invisible internal states. Instead show the PHYSICAL RESULT: character smiling, embracing someone, raising arms, running, handing an object, standing tall
5. Avoid abstract/magical language ("glowing", "ethereal", "mystical energy", "aura") — these produce tiny broken files
6. Include specific camera directions (tracking shot, dolly, low angle, aerial pullback)
7. Include specific character design (skin tone, hair, clothing from the story)
8. Each prompt should capture a single continuous 5-8 second shot with CLEAR PHYSICAL MOVEMENT throughout
9. The environment and physical action should DOMINATE — characters doing concrete things in specific places
10. CONTENT SAFETY: NEVER use words like "torment", "abuse", "attack", "violence", "blood", "suffering", "bully", "strike", "hit", "weapon aimed at person". Replace conflict with POSITIVE framing: training, competition, determination, standing tall, walking away. This is a children's educational app — keep all prompts suitable for all ages. Veo will REJECT prompts with violent or distressing language.
11. HISTORICAL NAMES: NEVER use real historical figure names (Shaka, Mansa Musa, Cleopatra, Alaafin, etc.) in the video prompt. Veo blocks celebrity/historical figure names. Instead, describe the character by ROLE and APPEARANCE only — "a young warrior", "a powerful king", "an elder scholar", "a royal guard". The prompt must be visually specific WITHOUT naming anyone.`;

  const userPrompt = `STORY: "${story.title}"
PRINCIPLE: ${story.principle}
SCENE TYPE: ${story.scene}
TOTAL CHUNKS: ${totalChunks}

=== OPENING (first 2 chunks) ===
${openingText}

=== CLIMAX & RESOLUTION (last 3 chunks) ===
${climaxText}

Generate TWO video prompts. Return ONLY valid JSON with this exact structure:
{
  "intro": {
    "description": "Brief 1-line description of what happens in this video",
    "prompt": "The full Veo prompt text — 150-250 words, deeply specific to this story's opening"
  },
  "outro": {
    "description": "Brief 1-line description of what happens in this video",
    "prompt": "The full Veo prompt text — 150-250 words, deeply specific to this story's climactic resolution"
  }
}

INTRO VIDEO: Capture the story's unique opening moment — the specific character in their specific world doing the specific thing that sets this story in motion. Make the viewer curious and excited. This is NOT a generic establishing shot — it's the HOOK of THIS specific story. Show PHYSICAL ACTION: a character walking, reaching, lifting, building, cooking, observing something specific.

OUTRO VIDEO: Show the PHYSICAL CLIMACTIC ACTION — NOT internal feelings. What is the character PHYSICALLY DOING at the peak moment? Examples of good outro content:
- A character RUNNING across a field
- HANDING an object to someone
- EMBRACING a family member
- STANDING TALL before a crowd
- RAISING arms in victory
- PLACING a finished object on a table
- WALKING through a doorway into sunlight
The environment must be vivid and active (wind blowing, water flowing, fire crackling, dust rising, birds flying). NEVER write about "realization", "understanding", or "feelings" — show the VISIBLE PHYSICAL RESULT of those feelings through ACTION and BODY LANGUAGE in a specific environment.

CRITICAL: Both prompts must describe continuous PHYSICAL MOVEMENT throughout the entire 5-8 seconds. The camera must also move (dolly, track, pan). Static scenes with people sitting and thinking produce BROKEN FILES.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      { role: 'user', parts: [{ text: systemPrompt + '\n\n' + userPrompt }] }
    ],
    config: {
      temperature: 0.7,
      responseMimeType: 'application/json',
    }
  });

  const text = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text || '';
  try {
    const parsed = JSON.parse(text);
    // Prepend style base to each prompt
    if (parsed.intro?.prompt) parsed.intro.prompt = STYLE_BASE + '\n\n' + parsed.intro.prompt;
    if (parsed.outro?.prompt) parsed.outro.prompt = STYLE_BASE + '\n\n' + parsed.outro.prompt;
    return parsed;
  } catch (e) {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed.intro?.prompt) parsed.intro.prompt = STYLE_BASE + '\n\n' + parsed.intro.prompt;
      if (parsed.outro?.prompt) parsed.outro.prompt = STYLE_BASE + '\n\n' + parsed.outro.prompt;
      return parsed;
    }
    throw new Error('Could not parse Gemini response as JSON: ' + text.substring(0, 200));
  }
}

// ─── Veo 3.1 video generation ──────────────────────────────────────

async function generateVideo(prompt, outputPath, resolution = '1080p') {
  let operation = await ai.models.generateVideos({
    model: process.env.VEO_MODEL || 'veo-3.1-fast-generate-preview',
    prompt: prompt,
    config: {
      aspectRatio: '16:9',
      resolution: resolution,
    },
  });

  let polls = 0;
  while (!operation.done) {
    polls++;
    process.stdout.write(`\r    Generating... ${polls * 10}s elapsed`);
    await new Promise(r => setTimeout(r, 10000));
    operation = await ai.operations.getVideosOperation({ operation });
  }
  console.log('');

  if (!operation.response?.generatedVideos?.length) {
    // Log full response for debugging content filtering
    const resp = operation.response || {};
    const reason = resp.promptFeedback?.blockReason || resp.filterReason || 'unknown';
    console.log(`    [DEBUG] Full response: ${JSON.stringify(resp).slice(0, 300)}`);
    throw new Error(`No video returned from Veo (reason: ${reason})`);
  }

  await ai.files.download({
    file: operation.response.generatedVideos[0].video,
    downloadPath: outputPath,
  });
}

// ─── Main ──────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const listMode = args.includes('--list');
const promptsOnly = args.includes('--prompts-only');
const introOnly = args.includes('--intro-only');
const outroOnly = args.includes('--outro-only');
const targetId = args.find(a => !a.startsWith('--'));

console.log('Extracting stories from maat-reader.html...');
const STORIES = extractStories();
console.log(`Found ${STORIES.length} stories.\n`);

// Ensure output directories
if (!existsSync('videos')) mkdirSync('videos');
if (!existsSync('videos/intros')) mkdirSync('videos/intros');
if (!existsSync('videos/outros')) mkdirSync('videos/outros');

// List mode
if (listMode) {
  console.log('Story Video Status:\n');
  console.log('  ID'.padEnd(34) + 'INTRO  OUTRO  TITLE');
  console.log('  ' + '─'.repeat(80));
  for (const s of STORIES) {
    const status = getVideoStatus(s.id, s.scene);
    const introIcon = status.hasIntro ? '✓' : '○';
    const outroIcon = status.hasOutro ? '✓' : '○';
    console.log(`  ${s.id.padEnd(32)} ${introIcon.padEnd(7)}${outroIcon.padEnd(7)}${s.title}`);
  }
  const needIntro = STORIES.filter(s => !getVideoStatus(s.id, s.scene).hasIntro).length;
  const needOutro = STORIES.filter(s => !getVideoStatus(s.id, s.scene).hasOutro).length;
  console.log(`\n  Need intro: ${needIntro}  |  Need outro: ${needOutro}  |  Total stories: ${STORIES.length}`);
  process.exit(0);
}

// Filter stories
let stories = STORIES;
if (targetId) {
  stories = STORIES.filter(s => s.id === targetId);
  if (!stories.length) { console.error(`Unknown story: ${targetId}`); process.exit(1); }
}

// Only include stories that need videos
stories = stories.filter(s => {
  const status = getVideoStatus(s.id, s.scene);
  if (introOnly) return !status.hasIntro;
  if (outroOnly) return !status.hasOutro;
  return !status.hasIntro || !status.hasOutro;
});

if (!stories.length) {
  console.log('All requested stories already have videos!');
  process.exit(0);
}

console.log(`Processing ${stories.length} stories...\n`);

// Cache prompts to file for review/reuse
const promptCache = {};
const cacheFile = 'video-prompts-cache.json';
if (existsSync(cacheFile)) {
  try { Object.assign(promptCache, JSON.parse(readFileSync(cacheFile, 'utf-8'))); } catch {}
}

let generated = 0;
const MAX_VIDEOS = 50; // Safety limit per run

for (const story of stories) {
  if (generated >= MAX_VIDEOS) {
    console.log(`\n[LIMIT] Reached ${MAX_VIDEOS} video limit. Run again to continue.`);
    break;
  }

  const status = getVideoStatus(story.id, story.scene);
  console.log(`\n━━━ ${story.title} (${story.id}) ━━━`);

  // Step 1: Generate prompts via Gemini text
  let prompts = promptCache[story.id];
  if (!prompts) {
    console.log('  [PROMPT] Analyzing story text with Gemini Flash...');
    try {
      prompts = await generateVideoPrompts(story);
      promptCache[story.id] = prompts;
      writeFileSync(cacheFile, JSON.stringify(promptCache, null, 2));
      console.log(`  [PROMPT] Intro: ${prompts.intro?.description || 'generated'}`);
      console.log(`  [PROMPT] Outro: ${prompts.outro?.description || 'generated'}`);
    } catch (err) {
      console.error(`  [FAIL] Prompt generation failed: ${err.message}`);
      continue;
    }
    // Brief pause after text generation
    await new Promise(r => setTimeout(r, 2000));
  } else {
    console.log(`  [CACHE] Using cached prompts`);
    console.log(`  [PROMPT] Intro: ${prompts.intro?.description || '(no desc)'}`);
    console.log(`  [PROMPT] Outro: ${prompts.outro?.description || '(no desc)'}`);
  }

  if (promptsOnly) continue;

  // Step 2: Generate intro video
  if (!status.hasIntro && !outroOnly && prompts.intro) {
    console.log(`  [VEO] Generating INTRO video...`);
    try {
      await generateVideo(prompts.intro.prompt, status.introPath);
      console.log(`  [OK] Saved: ${status.introPath}`);
      generated++;
    } catch (err) {
      console.error(`  [FAIL] Intro: ${err.message}`);
      if (err.message?.includes('RESOURCE_EXHAUSTED') || err.message?.includes('429')) {
        if (!cycleKey()) { console.log('\n[QUOTA] All API keys exhausted.'); break; }
        console.log('  [RETRY] Retrying with next key...');
        try {
          await generateVideo(prompts.intro?.prompt || prompts.outro?.prompt, status.introPath);
          console.log('  [OK] Retry succeeded');
          generated++;
        } catch(e2) {
          if (!cycleKey()) { console.log('\n[QUOTA] All API keys exhausted.'); break; }
        }
      }
    }
    await new Promise(r => setTimeout(r, 5000));
  }

  // Step 3: Generate outro video
  if (!status.hasOutro && !introOnly && prompts.outro) {
    console.log(`  [VEO] Generating OUTRO video...`);
    try {
      await generateVideo(prompts.outro.prompt, status.outroPath);
      console.log(`  [OK] Saved: ${status.outroPath}`);
      generated++;
    } catch (err) {
      console.error(`  [FAIL] Outro: ${err.message}`);
      if (err.message?.includes('RESOURCE_EXHAUSTED') || err.message?.includes('429')) {
        if (!cycleKey()) { console.log('\n[QUOTA] All API keys exhausted.'); break; }
        console.log('  [RETRY] Retrying with next key...');
        try {
          await generateVideo(prompts.intro?.prompt || prompts.outro?.prompt, status.introPath);
          console.log('  [OK] Retry succeeded');
          generated++;
        } catch(e2) {
          if (!cycleKey()) { console.log('\n[QUOTA] All API keys exhausted.'); break; }
        }
      }
    }
    await new Promise(r => setTimeout(r, 5000));
  }
}

// Save final prompt cache
writeFileSync(cacheFile, JSON.stringify(promptCache, null, 2));

console.log(`\n${'═'.repeat(60)}`);
console.log(`Generated ${generated} video(s). Prompts cached in ${cacheFile}.`);
console.log(`Deploy with: rsync -avz --progress videos/ root@89.167.47.23:/var/www/perankh/videos/`);
