#!/usr/bin/env node
/**
 * generate-art-v2.js — Story-Driven Art Generator for Per Ankh Reader
 *
 * FUNDAMENTALLY DIFFERENT from v1: Instead of keyword-matching generic actions,
 * this reads the ACTUAL story text and creates scene-specific illustrations.
 * Each prompt tells the AI:
 *   1. What project this is (children's reading app)
 *   2. The full story context (title, synopsis, what happened so far)
 *   3. The EXACT chunk text being illustrated
 *   4. A specific composition directive derived from the narrative
 *   5. Consistent character descriptions throughout the story
 *
 * Usage:
 *   node generate-art-v2.js --story kandake-rome           # One story, all chunks
 *   node generate-art-v2.js --story kandake-rome --chunk 3  # One specific chunk
 *   node generate-art-v2.js --grade 5                       # All grade 5 stories
 *   node generate-art-v2.js --list                          # List available stories
 *   node generate-art-v2.js --dry-run --story kandake-rome  # Show prompts only
 *   node generate-art-v2.js --force --story kandake-rome    # Regenerate existing
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// ─── Config ───────────────────────────────────────────────────────────
const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = 'gemini-2.5-flash-image';
const ART_DIR = path.join(__dirname, 'art');
const HTML_FILE = path.join(__dirname, 'maat-reader.html');
const DELAY_MS = 5000;
const MAX_RETRIES = 3;

// ─── CLI Args ─────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const OPTS = {
  story: null,
  chunk: null,
  grade: null,
  dryRun: args.includes('--dry-run'),
  force: args.includes('--force'),
  list: args.includes('--list'),
};
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--story' && args[i + 1]) OPTS.story = args[++i];
  if (args[i] === '--chunk' && args[i + 1]) OPTS.chunk = parseInt(args[++i]);
  if (args[i] === '--grade' && args[i + 1]) OPTS.grade = parseInt(args[++i]);
}

// ─── Story Parser ────────────────────────────────────────────────────
function parseStories() {
  const html = fs.readFileSync(HTML_FILE, 'utf8');
  const storyIds = [];
  // Keys may be unquoted, double-quoted, or single-quoted (project mixes styles for newer story sets).
  // Level/grade values may be plain integers OR string-quoted (e.g., 'level':'6') in some hand-written sets.
  // Title/principle/scene strings may contain escaped quotes (e.g., Ma\'at) — use the escape-aware pattern.
  const storyRegex = /\{\s*['"]?id['"]?:\s*(?:'([^']+)'|"([^"]+)")\s*,\s*['"]?title['"]?:\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")\s*,\s*['"]?level['"]?:\s*['"]?(\d+)['"]?\s*,\s*['"]?grade['"]?:\s*['"]?(\d+)['"]?\s*,\s*['"]?principle['"]?:\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")\s*,\s*['"]?scene['"]?:\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")\s*,/g;
  let match;
  while ((match = storyRegex.exec(html)) !== null) {
    storyIds.push({
      id: match[1] || match[2],
      title: (match[3] || match[4] || '').replace(/\\'/g, "'").replace(/\\"/g, '"'),
      level: parseInt(match[5]),
      grade: parseInt(match[6]),
      principle: match[7] || match[8] || '',
      scene: match[9] || match[10] || '',
    });
  }

  for (const story of storyIds) {
    // Support compact, spaced, and JSON-quoted key formats
    let storyStart = html.indexOf(`{id:'${story.id}'`);
    if (storyStart === -1) storyStart = html.indexOf(`{id:"${story.id}"`);
    if (storyStart === -1) storyStart = html.indexOf(`id: '${story.id}'`);
    if (storyStart === -1) storyStart = html.indexOf(`id: "${story.id}"`);
    if (storyStart === -1) storyStart = html.indexOf(`"id": "${story.id}"`);
    if (storyStart === -1) storyStart = html.indexOf(`"id":"${story.id}"`);
    // Single-quoted key forms (newer story sets — sage-peh-osiris, 25th-dynasty, YW v2)
    if (storyStart === -1) storyStart = html.indexOf(`'id':'${story.id}'`);
    if (storyStart === -1) storyStart = html.indexOf(`'id': '${story.id}'`);
    if (storyStart === -1) storyStart = html.indexOf(`'id':"${story.id}"`);
    if (storyStart === -1) storyStart = html.indexOf(`'id': "${story.id}"`);
    if (storyStart === -1) continue;
    // Find chunks start — multiple formats
    let chunksStart = html.indexOf('chunks:[', storyStart);
    if (chunksStart === -1 || chunksStart > storyStart + 500) chunksStart = html.indexOf('chunks: [', storyStart);
    if (chunksStart === -1 || chunksStart > storyStart + 500) chunksStart = html.indexOf('"chunks": [', storyStart);
    if (chunksStart === -1 || chunksStart > storyStart + 500) chunksStart = html.indexOf('"chunks":[', storyStart);
    if (chunksStart === -1) continue;

    // Find end of chunks array — look for the first section after chunks
    // The format is: ...}]\n,\nsectionName:[ with possible newlines
    // Search for the closing bracket of chunks by finding next section keyword
    const afterChunks = html.substring(chunksStart, chunksStart + 500000); // generous window
    const endMatch = afterChunks.match(/\]\s*,\s*"?(?:comprehensionPool|questions|maatReflections|hekaMoments)"?\s*:\s*\[/);
    if (!endMatch) continue;
    const chunksEnd = chunksStart + endMatch.index;

    // Skip past 'chunks:' or 'chunks: ' and the opening bracket
    const bracketPos = html.indexOf('[', chunksStart);
    const chunksStr = html.substring(bracketPos + 1, chunksEnd);
    story.chunks = [];
    const chunkRegex = /\{\s*"?text"?:\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/g;
    let chunkMatch;
    while ((chunkMatch = chunkRegex.exec(chunksStr)) !== null) {
      const rawText = chunkMatch[1] || chunkMatch[2] || '';
      story.chunks.push({
        text: rawText.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\n/g, '\n'),
      });
    }
  }
  return storyIds.filter(s => s.chunks && s.chunks.length > 0);
}

// ─── Story Synopsis Generator ────────────────────────────────────────
// Creates a 2-3 sentence synopsis from the full story text
function buildSynopsis(story) {
  const allText = story.chunks.map(c => c.text).join(' ');
  // Extract key info from first and last chunks
  const firstChunk = story.chunks[0].text.substring(0, 300);
  const lastChunk = story.chunks[story.chunks.length - 1].text.substring(0, 300);
  return `"${story.title}" is a story about ${story.principle}. It begins: ${firstChunk.split('.').slice(0, 2).join('.')}. The story concludes with themes of ${story.principle.toLowerCase()}.`;
}

// ─── Running Context Builder ─────────────────────────────────────────
// Summarizes what happened in previous chunks (max 200 chars per chunk)
function buildPreviousContext(story, currentChunkIndex) {
  if (currentChunkIndex === 0) return 'This is the opening scene of the story.';
  const summaries = [];
  for (let i = 0; i < currentChunkIndex; i++) {
    const text = story.chunks[i].text;
    // Take first 2 sentences as summary
    const sentences = text.split(/\.\s+/).slice(0, 2);
    summaries.push(`Page ${i + 1}: ${sentences.join('. ').substring(0, 200)}`);
  }
  // Keep only last 3 pages of context to avoid token bloat
  const recent = summaries.slice(-3);
  return recent.join('\n');
}

// ─── Character Extractor ─────────────────────────────────────────────
// Extracts character descriptions from early story chunks for consistency
function extractCharacters(story) {
  const allText = story.chunks.slice(0, 5).map(c => c.text).join(' ');
  const characters = [];

  // Common patterns for character introductions
  const introPatterns = [
    // "Name was a/an..." or "Name, a/an..."
    /([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s+was\s+((?:a|an|the)\s+[^.]{20,120})/g,
    // "young Name" patterns
    /(?:young|old|wise|fierce)\s+([A-Z][a-z]+)\s+(?:was|had|stood|sat)\s+([^.]{10,100})/g,
    // "Her/His skin was..."
    /(?:Her|His)\s+(?:skin|face|arms|hands)\s+(?:was|were|gleamed|glowed)\s+([^.]{10,80})/g,
  ];

  // Extract named characters from story metadata
  const nameMatches = allText.match(/\b([A-Z][a-z]{2,}(?:\s[A-Z][a-z]+)?)\b/g);
  const uniqueNames = [...new Set(nameMatches || [])].filter(n =>
    !['The', 'His', 'Her', 'She', 'But', 'And', 'When', 'This', 'That', 'They', 'Each',
      'One', 'Every', 'From', 'Some', 'After', 'Before', 'Around', 'Their', 'Through',
      'Between', 'Into', 'Upon', 'Under', 'Over', 'Down', 'Behind', 'Above', 'Against',
      'Across', 'Along', 'Within', 'Without', 'Among', 'Until', 'During', 'Besides',
      'Below', 'Beyond', 'Inside', 'Outside', 'Beside', 'Beneath', 'Near', 'Past',
      'Per', 'Kemet', 'Kush', 'Nile', 'Maat', 'Isfet', 'Meroe', 'Waset', 'Roman',
      'Rome', 'Egyptian', 'African', 'Nubian', 'Kushite', 'Kemetic', 'Augustus',
      'Greek', 'Greeks', 'Mediterranean', 'Amun', 'Africa', 'Giza', 'Syene',
      'Napata', 'Britain', 'Mesopotamia', 'Saqqara', 'Sudan', 'London',
      'Imagine', 'Watch', 'Look', 'Remember', 'Today', 'Yesterday',
      'Years', 'Weeks', 'Months', 'Days', 'Hours', 'Empire', 'Ankh',
      'Pharaoh', 'Prince', 'Princess', 'King', 'Queen', 'Kandake',
      'Land', 'House', 'Great', 'Sacred', 'Royal', 'Divine', 'Ancient',
      'Sekhmet', 'Djehuti', 'Imhotep', 'Sopdet', 'Djoser', 'Field',
      'Benin', 'Mali', 'Aksum', 'Timbuktu', 'Carthage',
      'Roman Empire', 'Iron', 'Gold', 'Bronze', 'Stone', 'River',
      'While', 'These', 'Red', 'Sea', 'Where', 'What', 'How', 'Why',
      'Here', 'There', 'Then', 'Now', 'Still', 'Just', 'Even', 'Only',
      'First', 'Last', 'Next', 'Most', 'Many', 'Much', 'Such', 'Like',
      'Good', 'New', 'Old', 'Young', 'Long', 'High', 'Deep', 'Wide',
      'Dark', 'Black', 'White', 'Blue', 'Green', 'Red Sea', 'True',
      'Every', 'Other', 'Another', 'Enough', 'Already', 'Almost',
      'Perhaps', 'Never', 'Always', 'Often', 'Sometimes', 'Once',
      'Hemiunu', 'Petronius', 'Gaius', 'Aegyptus', 'Khufu',
      'Oba', 'Ogun', 'Ewuare', 'Sundiata', 'Mansa', 'Griot',
    ].includes(n)
  );

  // For each character name, find their description in the text
  for (const name of uniqueNames.slice(0, 4)) {
    const nameIdx = allText.indexOf(name);
    if (nameIdx === -1) continue;
    // Get surrounding context (500 chars around first mention)
    const context = allText.substring(Math.max(0, nameIdx - 50), nameIdx + 500);
    // Look for physical descriptions
    const skinMatch = context.match(/(?:skin|complexion|face)\s+(?:was|were|like|as)\s+([^.,]{5,60})/i);
    const ageMatch = context.match(/(\d+)[- ]year[- ]old/);
    const genderMatch = context.match(/\b(he|she|her|his|woman|man|girl|boy|queen|king|mother|father)\b/i);
    const clothMatch = context.match(/(?:wore|wearing|dressed|robe|armor|kilt|dress|linen)\s+([^.,]{5,60})/i);

    if (skinMatch || ageMatch) {
      characters.push({
        name,
        skin: skinMatch ? skinMatch[1].trim() : 'deep ebony skin',
        age: ageMatch ? `${ageMatch[1]} years old` : null,
        gender: genderMatch ? genderMatch[1].toLowerCase() : null,
        clothing: clothMatch ? clothMatch[1].trim() : null,
      });
    }
  }

  return characters;
}

// ─── Scene Composition Directives ────────────────────────────────────
// Instead of generic camera angles, derive composition from the narrative
function deriveComposition(text, chunkIndex, totalChunks) {
  const lower = text.toLowerCase();

  // Narrative position affects composition
  const isOpening = chunkIndex === 0;
  const isClosing = chunkIndex === totalChunks - 1;
  const isClimactic = chunkIndex >= Math.floor(totalChunks * 0.6) && chunkIndex <= Math.floor(totalChunks * 0.8);

  if (isOpening) {
    return 'WIDE ESTABLISHING SHOT: This is the opening scene. Show the full environment — the setting dominates. Characters are small within the grand landscape/architecture. The viewer should feel like they are arriving at this place for the first time.';
  }

  if (isClosing) {
    return 'REFLECTIVE COMPOSITION: This is the final scene. The mood is resolved and meaningful. Can be a wide shot showing the character in their world, or a warm medium shot showing their expression. The image should feel like a conclusion — satisfying and complete.';
  }

  if (isClimactic) {
    return 'DRAMATIC CLOSE COMPOSITION: This is a climactic moment. Use a dynamic angle — low angle looking up for power, tight framing for intensity, or a dramatic diagonal composition. The emotion of the scene should be palpable.';
  }

  // Action-specific compositions derived from text
  if (/battle|charge|fought|attack|invasion|war cry|shield wall/i.test(lower)) {
    return 'EPIC ACTION SHOT: Multiple figures in dynamic motion. Dust, weapons, shields — the chaos and discipline of ancient warfare. Wide enough to show the scale of the battle, close enough to see the determination on faces.';
  }
  if (/march|army|caravan|column|troops|journey/i.test(lower)) {
    return 'SWEEPING LANDSCAPE WITH FIGURES: A long line of people/soldiers/traders moving through the landscape. The environment (desert, river, plains) stretches to the horizon. Show the scale of the journey.';
  }
  if (/spoke|voice|address|said.*gathering|declared|announced/i.test(lower)) {
    return 'SPEAKER AND AUDIENCE: Show both the speaker and the listeners. The speaker should be elevated or prominent, the audience visible and reactive. The setting (throne room, plaza, temple) frames the scene.';
  }
  if (/forge|furnace|smelt|hammer|anvil|bellows/i.test(lower)) {
    return 'WORKSHOP INTERIOR: Warm orange firelight dominating. Show the tools, the furnace, the sparks, the physical labor. The craft should be the focal point, with the artisan deeply engaged.';
  }
  if (/scroll|library|per ankh|papyrus|writing|scribe/i.test(lower)) {
    return 'INTERIOR OF KNOWLEDGE: Shelves of scrolls, columns of a temple library, the warm light of oil lamps. Show the vastness of collected knowledge and the intimacy of the act of reading/writing.';
  }
  if (/night|star|moon|dark|midnight/i.test(lower)) {
    return 'NIGHT SCENE: Deep indigo sky with stars. Warm firelight or lamplight creates intimate pools of light against the darkness. Silhouettes of architecture against the star field.';
  }
  if (/river|nile|boat|sail|water|marsh/i.test(lower)) {
    return 'RIVERSCAPE: The Nile dominates — wide blue-green water, papyrus reeds, boats. Characters are ON or NEAR the water. Show the river as a living highway connecting communities.';
  }
  if (/pyramid|temple|column|pylon|obelisk/i.test(lower)) {
    return 'ARCHITECTURAL GRANDEUR: The building/monument dominates the frame. Characters are small relative to the massive stone structures. Show the scale and craftsmanship of ancient African architecture.';
  }
  if (/embrace|tears|joy|celebration|crowd|ululate/i.test(lower)) {
    return 'EMOTIONAL GROUP SCENE: Show the collective emotion — people embracing, celebrating, weeping. Warm golden light. The community is the subject, not any single individual.';
  }
  if (/taught|lesson|student|apprentice|learn|master/i.test(lower)) {
    return 'MASTER AND STUDENT: Show the teaching moment — the teacher demonstrating, the student observing intently. Their environment (workshop, garden, classroom) should be visible and specific.';
  }
  if (/heal|medicine|wound|bandage|herb|remedy/i.test(lower)) {
    return 'HEALING SCENE: Close enough to see the healer\'s hands at work, with the patient visible. Healing tools, herbs, and the clinical environment should be detailed and specific.';
  }
  if (/trade|market|merchant|goods|gold|ivory/i.test(lower)) {
    return 'MARKETPLACE/TRADE: Bustling scene with goods, merchants, diverse people. Colorful textiles, gleaming metals, exotic goods. Show the commercial life of ancient Africa.';
  }

  // Default: medium shot with story-specific environment
  return 'STORY MOMENT: Medium shot showing the character(s) actively engaged in what the text describes. The environment is clearly visible and specific to this story location. Show ACTION, not a pose.';
}

// ─── Extract Specific Scene Description ──────────────────────────────
// Pull the key visual moment from the chunk text
function extractSceneDescription(text) {
  // Split into sentences
  const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.length > 20);

  // Prioritize sentences with visual/action content
  const visualKeywords = /stood|walked|ran|held|pointed|gazed|watched|saw|looked|pressed|lifted|carried|pulled|pushed|sat|knelt|climbed|rode|fought|struck|swept|poured|shaped|carved|hammered|built|drew|painted|wrote/i;
  const visualSentences = sentences.filter(s => visualKeywords.test(s));

  if (visualSentences.length > 0) {
    // Return the 2 most visual sentences
    return visualSentences.slice(0, 2).join(' ');
  }

  // Fallback: first 2-3 sentences
  return sentences.slice(0, 3).join(' ');
}

// ─── Main Prompt Builder ─────────────────────────────────────────────
function buildPrompt(story, chunkIndex) {
  const chunk = story.chunks[chunkIndex];
  const text = chunk.text;
  const totalChunks = story.chunks.length;
  const characters = extractCharacters(story);
  const synopsis = buildSynopsis(story);
  const previousContext = buildPreviousContext(story, chunkIndex);
  const composition = deriveComposition(text, chunkIndex, totalChunks);
  const sceneDescription = extractSceneDescription(text);

  // Build character consistency block
  let charBlock = '';
  if (characters.length > 0) {
    charBlock = characters.map(c => {
      let desc = `${c.name}`;
      if (c.age) desc += `, ${c.age}`;
      if (c.gender) desc += ` (${c.gender})`;
      desc += `, ${c.skin}`;
      if (c.clothing) desc += `, ${c.clothing}`;
      return desc;
    }).join('\n  ');
  }

  // Narrative position descriptor
  let positionDesc = '';
  if (chunkIndex === 0) positionDesc = 'This is the OPENING — establish the world, introduce the characters, set the tone.';
  else if (chunkIndex === 1) positionDesc = 'This is the early setup — the story is building context and introducing the conflict.';
  else if (chunkIndex < totalChunks * 0.4) positionDesc = 'The story is developing — the conflict is deepening, stakes are rising.';
  else if (chunkIndex < totalChunks * 0.7) positionDesc = 'This is the MIDDLE — the story is at its most intense. Action, drama, confrontation.';
  else if (chunkIndex < totalChunks - 1) positionDesc = 'The story is approaching its resolution — the climax has happened or is happening now.';
  else positionDesc = 'This is the CONCLUSION — the story resolves. Show the aftermath, the lesson, the peace.';

  const prompt = `PROJECT: You are creating a SEQUENTIAL VISUAL STORY for a children's educational reading app called "Per Ankh Reader" (ages 8-12). The app teaches African history through illustrated stories.

IMPORTANT — STORY PROGRESSION: You are generating illustration ${chunkIndex + 1} of ${totalChunks} in a sequence that TELLS A VISUAL STORY. These images are seen one after another as a child reads page by page, like panels in a graphic novel or pages in a picture book. Each illustration should ADVANCE the visual narrative from the previous one. ${positionDesc}

The story should feel like it MOVES — different scenes, different moments, different compositions as the narrative progresses. Do NOT repeat the same angle or composition. Each illustration reveals a new moment in the story.

STORY: "${story.title}"
THEME: ${story.principle}
SYNOPSIS: ${synopsis}

STORY SO FAR (what the child has already seen in previous illustrations):
${previousContext}

NOW — PAGE ${chunkIndex + 1} OF ${totalChunks}. THE CHILD TURNS THE PAGE AND READS:
"${text}"

THE KEY VISUAL MOMENT FROM THIS PAGE:
${sceneDescription}

${charBlock ? `RECURRING CHARACTERS (must look the same across all ${totalChunks} pages):
  ${charBlock}` : ''}

${composition}

ART STYLE:
- Modern cel-shaded illustration — bold graphic linework (2-3px outlines), flat color fills with dramatic lighting
- Stylized realistic proportions — NOT cartoon, NOT photorealistic
- Rich saturated palette: Egyptian gold (#FFD700), lapis blue (#2E5FBF), carnelian red, malachite green, warm amber
- Landscape orientation (16:9 ratio)
- Children's book quality — engaging, beautiful, detailed environments
- ABSOLUTELY NO text, letters, words, glyphs, hieroglyphs, written symbols, speech bubbles, captions, or watermarks ANYWHERE in the image — no writing of any kind, not even decorative or background inscriptions

CRITICAL — AUTHENTIC AFRICAN REPRESENTATION (NON-NEGOTIABLE):
- All characters MUST have VERY DARK brown-black/ebony Nubian skin — Dinka, Nuer, South Sudanese complexion range. NOT medium brown. NOT caramel. NOT tan. The darkest skin tones.
- Do NOT lighten skin under ANY lighting condition. Warm light, golden hour, oil-lamp light, firelight, torchlight, and sunlight illuminate the SCENE, the walls, and the background air ONLY — they must NEVER warm up, wash out, or lighten skin. In warm, dim, or interior light, render skin as deep ebony brown-black; if anything skin reads DARKER in shadow and lamplight, NEVER lighter, warmer, or more caramel.
- Broad nose, full lips, strong jaw, high cheekbones — authentic Nilotic/East African features
- 4C tightly coiled African hair texture. NOT straight, NOT wavy
- These are the people of Kemet and Kush — among the darkest-skinned people in the ancient world
- Represent them with dignity, accuracy, and beauty

REMEMBER: This is page ${chunkIndex + 1} in a ${totalChunks}-page visual story. The illustration MUST depict what is ACTUALLY HAPPENING in the text above — the specific scene, action, and environment. NOT a generic portrait. NOT a repeated composition. ADVANCE the visual story.

FINAL REMINDER — SKIN TONE: Every human in this image MUST have skin darker than #3D2B1F (rich dark chocolate). Think Dinka people of South Sudan, Wodaabe of Niger, Maasai of Kenya. Deep, rich, dark brown-black skin that does NOT become medium-brown under any lighting. This is the single most important visual requirement. This holds DOUBLY for interior, lamplit, firelit, and golden-hour scenes: the warm light tints the WALLS, the air, and the objects — it does NOT tint the people. Skin must NEVER drift toward medium-brown, caramel, tan, or olive, no matter how warm or dim the scene is.`;

  return prompt;
}

// ─── Image Generation ────────────────────────────────────────────────
async function generateImage(genAI, prompt, retries = 0) {
  const model = genAI.getGenerativeModel({
    model: MODEL,
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
    },
  });

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    if (!response.candidates || response.candidates.length === 0) {
      throw new Error('No candidates in response');
    }
    const parts = response.candidates[0].content.parts;
    for (const part of parts) {
      if (part.inlineData) {
        return {
          data: Buffer.from(part.inlineData.data, 'base64'),
          mimeType: part.inlineData.mimeType,
        };
      }
    }
    // Check if there's a text response explaining failure
    const textParts = parts.filter(p => p.text).map(p => p.text).join(' ');
    throw new Error(`No image data. Response: ${textParts.substring(0, 200)}`);
  } catch (err) {
    if (retries < MAX_RETRIES) {
      const wait = DELAY_MS * (retries + 1);
      console.log(`  ⚠ Retry ${retries + 1}/${MAX_RETRIES} after ${wait}ms: ${err.message}`);
      await sleep(wait);
      return generateImage(genAI, prompt, retries + 1);
    }
    throw err;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Main Pipeline ───────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  Per Ankh Reader — Story-Driven Art Generator v2 ║');
  console.log('║  Scene-specific illustrations from story text    ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log();

  if (!API_KEY) {
    console.error('✗ GEMINI_API_KEY not found in .env');
    process.exit(1);
  }

  // Parse stories
  console.log('📖 Parsing stories from maat-reader.html...');
  const stories = parseStories();
  console.log(`   Found ${stories.length} stories\n`);

  // List mode
  if (OPTS.list) {
    console.log('📋 Story List:');
    console.log('─'.repeat(80));
    for (const story of stories) {
      const artDir = path.join(ART_DIR, story.id);
      const existing = fs.existsSync(artDir)
        ? fs.readdirSync(artDir).filter(f => f.endsWith('.png')).length
        : 0;
      console.log(`  L${story.level} G${story.grade} | ${story.id.padEnd(30)} | ${story.chunks.length} chunks | ${existing}/${story.chunks.length} art`);
    }
    return;
  }

  // Filter stories
  let targetStories = stories;
  if (OPTS.story) {
    targetStories = stories.filter(s => s.id === OPTS.story);
    if (!targetStories.length) {
      console.error(`✗ Story "${OPTS.story}" not found`);
      process.exit(1);
    }
  } else if (OPTS.grade) {
    targetStories = stories.filter(s => s.grade === OPTS.grade);
    if (!targetStories.length) {
      console.error(`✗ No stories found for grade ${OPTS.grade}`);
      process.exit(1);
    }
  }

  const genAI = new GoogleGenerativeAI(API_KEY);
  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const story of targetStories) {
    const storyDir = path.join(ART_DIR, story.id);
    fs.mkdirSync(storyDir, { recursive: true });

    console.log(`\n📖 ${story.title} (${story.id}) — ${story.chunks.length} chunks`);

    // Show extracted characters
    const chars = extractCharacters(story);
    if (chars.length > 0) {
      console.log(`   Characters: ${chars.map(c => c.name).join(', ')}`);
    }

    // Determine which chunks to generate
    let chunkIndices = Array.from({ length: story.chunks.length }, (_, i) => i);
    if (OPTS.chunk !== null) {
      if (OPTS.chunk >= story.chunks.length) {
        console.error(`   ✗ Chunk ${OPTS.chunk} out of range (0-${story.chunks.length - 1})`);
        continue;
      }
      chunkIndices = [OPTS.chunk];
    }

    for (const idx of chunkIndices) {
      const outPath = path.join(storyDir, `chunk-${idx}.png`);

      if (fs.existsSync(outPath) && !OPTS.force) {
        skipped++;
        continue;
      }

      const prompt = buildPrompt(story, idx);

      if (OPTS.dryRun) {
        console.log(`\n  ── Chunk ${idx} Prompt ──`);
        console.log(prompt);
        console.log('  ──────────────────────\n');
        continue;
      }

      process.stdout.write(`   [${idx + 1}/${story.chunks.length}] Generating chunk ${idx}...`);
      try {
        const image = await generateImage(genAI, prompt);
        fs.writeFileSync(outPath, image.data);
        const sizeMB = (image.data.length / 1024 / 1024).toFixed(2);
        console.log(` ✓ (${sizeMB}MB)`);
        generated++;
      } catch (err) {
        console.log(` ✗ ${err.message}`);
        failed++;
      }

      // Rate limit delay
      if (chunkIndices.length > 1) {
        await sleep(DELAY_MS);
      }
    }
  }

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`Generated: ${generated} | Skipped: ${skipped} | Failed: ${failed}`);
  console.log(`${'═'.repeat(50)}`);
}

// ─── Sema Asset Generation Mode ─────────────────────────────────────
const SEMA_MODE = args.includes('--sema');

const SEMA_ASSETS = [
  {
    filename: 'card-warm.png',
    sceneText: `A single ornate card frame with no scene inside it — only the frame itself. The frame is Kemetic Egyptian in style: papyrus stalks form the border, solar disk motifs at each corner, the whole thing rendered in warm amber, ochre, and deep gold tones. The center of the card is empty — a clean cream-colored space waiting to receive a word. The card sits slightly angled on a dark background as if floating. No characters. No action. Just the object — luminous, warm, ancient, ready. Portrait orientation.`
  },
  {
    filename: 'card-cool.png',
    sceneText: `A single ornate card frame with no scene inside it — only the frame itself. The frame is Kemetic Egyptian in style: water ripple motifs form the border, crescent and star details at each corner, the whole thing rendered in deep indigo, midnight blue, and silver-blue tones. The center of the card is empty — a clean cream-colored space waiting to receive a word. The card sits slightly angled on a dark background as if floating. No characters. No action. Just the object — still, deep, ancient, ready. Portrait orientation.`
  },
  {
    filename: 'card-joined.png',
    sceneText: `Two ornate Kemetic card frames placed side by side, touching at their edges. The left card is warm amber-gold with solar border motifs. The right card is deep indigo-blue with water-ripple border motifs. At the point where they touch, a glowing Kemetic symbol appears — the Sema hieroglyph, the joined lungs shape — radiating soft golden-blue light outward from the contact point. Both card centers are filled with warm cream light. The joining feels complete and alive — not mechanical, not forced, but discovered. Landscape orientation, two cards side by side.`
  },
  {
    filename: 'badge-first-joining.png',
    sceneText: `A circular badge scene: two hands reaching toward each other, palms open and upward, fingers almost touching at the center of the circle. The hands belong to a young person with deep brown skin, adorned with simple gold Kemetic bracelet on each wrist. Between the fingertips — not touching yet — a faint golden light bridges the gap. The background within the circle is deep night blue. The outer border of the badge is ornate Kemetic geometric pattern in gold. The feeling: first discovery, the moment before something becomes real. Square format.`
  },
  {
    filename: 'badge-eyes-open.png',
    sceneText: `A circular badge scene: a close view of two eyes side by side — rendered in Kemetic Eye of Horus style but showing both eyes together. The left eye is warm gold, glowing like sunlight. The right eye is deep blue, calm like still water. Both eyes are open, alert, seeing. They are part of the same face — a young person with dark ebony skin, one gold-painted eye, one blue-painted eye, both fully open and looking outward. The outer border is Kemetic geometric gold pattern. The feeling: seeing both sides at once for the first time. Square.`
  },
  {
    filename: 'badge-sema-walker.png',
    sceneText: `A circular badge scene: the Sema hieroglyph at center — the ancient Egyptian symbol of joined lungs and trachea rendered large and clear in the middle of the circle. The hieroglyph is half warm gold (left side) and half deep blue (right side), the two halves seamlessly joined. Around it: clean empty space that lets the symbol breathe. The outer border is the most detailed of all the badges — multiple rings of Kemetic geometric patterns alternating gold and blue. The feeling: mastery, quiet power, earned knowledge. Square.`
  },
  {
    filename: 'badge-heart-of-sema.png',
    sceneText: `A circular badge scene: a stylized Kemetic heart — the ib — at the exact center. The heart is rendered in the ancient Egyptian style: an oval form, slightly asymmetric. It is split precisely down the middle — the left half glowing warm gold, the right half deep blue — but the split is seamless, the two halves a single unified object. The heart floats in a night sky filled with the undying stars — the circumpolar stars the Kemetu called the Ikhemu-sek. The outer border is extraordinary — five concentric rings of Kemetic pattern, the outermost ring showing the Nile flood cycle, the innermost pure gold. This is the rarest badge. The feeling: sacred, earned, ancient. Square.`
  },
  {
    filename: 'seba-sema-pose.png',
    sceneText: `Seba Khafre — an elderly Kemetic priest of great dignity. Deep ebony skin. Shaved head. White linen robes falling to the ground. Wide gold and blue broad collar — the wesekh — across his shoulders. He stands in a temple interior, soft torchlight on his face. His expression: quiet recognition — not surprise, not excitement — the look of someone seeing an ancient truth for the first time again after a long time. His hands are open at chest height, palms up, as if presenting something invisible that rests between his palms. He is not pointing. He is not teaching. He is showing. Half-length portrait — from waist to just above the head. The background is temple stone with hieroglyphs visible but soft. Camera: slight low angle, looking up at him with respect.`
  },
  {
    filename: 'hall-sema-moment.png',
    sceneText: `Interior of the Hall of Two Truths. Dramatic torchlit space, massive stone columns with hieroglyphs. Anpu — the jackal-headed guide — stands at center in black and gold robes, arms raised slightly, waiting. Before him: two glowing card-shapes float in the air — one warm gold (left) one deep indigo blue (right) — face to face, not yet joined, separated by a meter of air. They glow softly in the torchlight. The scale of Ma'at is visible in the background but not the focus — it waits. The two floating cards ARE the focus. The moment: the joining has not happened yet. Everything waits. Wide landscape shot. Low, slightly dramatic angle.`
  },
  {
    filename: 'pair-flood-dry.png',
    sceneText: `A split-panel illustration of the same Nile valley location in two seasons. Left panel: the Nile at full flood — the water is red-brown and turbid, powerful, spreading across the land, papyrus reeds bending, a small boat riding the surge, everything alive and overwhelming. Right panel: the same location at low water — the Nile runs clear and blue, narrow, the black fertile silt banks visible and glistening, a child standing at the water's edge looking at their reflection. Both panels are fully alive — neither is empty, neither is better. Between them: a thin gold vertical line. Wide landscape format. The same two banks, the same sky — different season, same river.`
  },
  {
    filename: 'pair-day-night.png',
    sceneText: `A split-panel illustration of the Egyptian sky — same landscape, two times. Left panel: the golden solar barque of Ra crossing the blazing midday sky — gold and amber light flooding everything, the desert below lit up, a hawk circling in the updraft. Right panel: the same sky at deepest night — the Duat — blue-black and vast, the Milky Way visible, the undying circumpolar stars bright, the same desert below silver and still. Both halves feel complete and sacred. The same horizon line connects them. Between them: a thin gold vertical line at the exact point of transition. Wide landscape format.`
  },
  {
    filename: 'pair-kemet-deshret.png',
    sceneText: `Aerial view of the Nile Valley — wide landscape format. The frame is divided by the river itself. Left of the river: the Kemet — the Black Land — dense, dark, lush with crops, date palms, papyrus marshes, villages, life. Right of the river: the Deshret — the Red Land — vast, open, rust-red desert, stone outcroppings, absolute stillness, stars beginning to appear in the sky above it. The Nile runs between them as a glistening silver thread. Neither side dominates the frame — each takes exactly half. The dividing line IS the Nile. The feeling: these two could not be what they are without the sharp line between them.`
  },
  {
    filename: 'pair-breath.png',
    sceneText: `A close illustration of a young person's torso — dark brown skin, simple white linen garment. The illustration is split vertically down the center of the chest. Left half of the torso: chest expanded, ribs visible through the linen, the lungs full — warm gold light emanates from inside the chest, visible through the linen. Right half of the torso: chest contracted, the exhale complete, the linen soft and relaxed — cool blue light emanates from inside. Between the two halves, floating at the sternum: the Sema hieroglyph — the joined lungs symbol — glowing both gold and blue simultaneously. Camera: medium close, centered on the chest. The face is not shown — this is about the breath, not the person.`
  }
];

async function generateSemaAssets() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  Per Ankh Reader — Sema Art Asset Generator      ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  if (!API_KEY) {
    console.error('✗ GEMINI_API_KEY not found in .env');
    process.exit(1);
  }

  const genAI = new GoogleGenerativeAI(API_KEY);
  const semaDir = path.join(ART_DIR, 'sema');
  fs.mkdirSync(semaDir, { recursive: true });

  let generated = 0, skipped = 0, failed = 0;

  for (const asset of SEMA_ASSETS) {
    const outPath = path.join(semaDir, asset.filename);

    if (fs.existsSync(outPath) && !OPTS.force) {
      console.log(`  [SKIP] ${asset.filename} — already exists`);
      skipped++;
      continue;
    }

    // Build prompt using the same style/skin-tone block as story art
    const prompt = `PROJECT: You are creating art assets for a children's Kemetic educational reading app called "Per Ankh Reader" (ages 5-14). This asset is part of the Sema system — the Kemetic understanding of paired partners that need each other.

SCENE TO ILLUSTRATE:
${asset.sceneText}

ART STYLE:
- Modern cel-shaded illustration — bold graphic linework (2-3px outlines), flat color fills with dramatic lighting
- Stylized realistic proportions — NOT cartoon, NOT photorealistic
- Rich saturated palette: Egyptian gold (#FFD700), lapis blue (#2E5FBF), carnelian red, malachite green, warm amber
- Children's book quality — engaging, beautiful, detailed
- No text, no speech bubbles, no watermarks

CRITICAL — AUTHENTIC AFRICAN REPRESENTATION (NON-NEGOTIABLE):
- All human characters MUST have VERY DARK brown-black/ebony Nubian skin — Dinka, Nuer, South Sudanese complexion range. NOT medium brown. NOT caramel. NOT tan.
- Do NOT lighten skin under ANY lighting condition.
- Broad nose, full lips, strong jaw, high cheekbones — authentic Nilotic/East African features
- 4C tightly coiled African hair texture. NOT straight, NOT wavy
- Represent them with dignity, accuracy, and beauty

FINAL REMINDER — SKIN TONE: Every human in this image MUST have skin darker than #3D2B1F (rich dark chocolate). This is the single most important visual requirement.`;

    if (OPTS.dryRun) {
      console.log(`\n  ── ${asset.filename} Prompt ──`);
      console.log(prompt);
      console.log('  ──────────────────────\n');
      continue;
    }

    process.stdout.write(`  [GEN] ${asset.filename}...`);
    try {
      const image = await generateImage(genAI, prompt);
      fs.writeFileSync(outPath, image.data);
      const sizeMB = (image.data.length / 1024 / 1024).toFixed(2);
      console.log(` ✓ (${sizeMB}MB)`);
      generated++;
    } catch (err) {
      console.log(` ✗ ${err.message}`);
      failed++;
    }

    await sleep(DELAY_MS);
  }

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`Sema Assets — Generated: ${generated} | Skipped: ${skipped} | Failed: ${failed}`);
  console.log(`Output: ${semaDir}`);
  console.log(`${'═'.repeat(50)}`);
}

if (SEMA_MODE) {
  generateSemaAssets().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
} else {
  main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
