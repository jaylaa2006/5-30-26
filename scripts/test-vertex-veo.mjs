#!/usr/bin/env node
// One-clip Veo 3.1 test via Vertex AI — confirms (a) Veo runs on this GCP
// project, and (b) whether the $300 trial credit covers it (check the billing
// page after running). Uses ADC (gcloud auth application-default login).
//
// Usage:
//   GCP_PROJECT=your-project-id node scripts/test-vertex-veo.mjs
// Optional env:
//   GCP_LOCATION   (default us-central1)
//   GCP_VEO_MODEL  (default veo-3.1-generate-preview)

import { GoogleGenAI } from '@google/genai';
import { existsSync, mkdirSync, writeFileSync } from 'fs';

const PROJECT = process.env.GCP_PROJECT;
const LOCATION = process.env.GCP_LOCATION || 'us-central1';
const MODEL = process.env.GCP_VEO_MODEL || 'veo-3.1-generate-preview';

if (!PROJECT) {
  console.error('Missing GCP_PROJECT env var. Run:');
  console.error('  GCP_PROJECT=your-project-id node scripts/test-vertex-veo.mjs');
  process.exit(1);
}

const ai = new GoogleGenAI({ vertexai: true, project: PROJECT, location: LOCATION });

const PROMPT = `Cinematic animated establishing shot in modern cel-shaded Spider-Verse art style. Bold graphic linework, flat color fills with dramatic lighting, saturated ancient Egyptian palette — gold, lapis blue, carnelian, malachite. Children's book quality. NO text, NO watermarks.

SCENE: A small Nubian girl with 4C tightly coiled hair in two side-puffs, deep mahogany skin, white linen wrapper, walks slowly across a swept basalt courtyard of an ancient Kemetic learning house at dawn. The camera tracks gently with her. Warm honey-gold dawn light strengthens across the shot. A sycamore-fig tree above the eastern wall, lapis dawn sky beyond.

CAMERA: slow gentle tracking dolly, picture-book pacing, no shake.`;

if (!existsSync('videos/_test')) mkdirSync('videos/_test', { recursive: true });
const outputPath = 'videos/_test/vertex-veo-test.mp4';

console.log(`[test] project=${PROJECT} location=${LOCATION} model=${MODEL}`);
console.log('[test] starting Veo generation...');

try {
  let operation = await ai.models.generateVideos({
    model: MODEL,
    prompt: PROMPT,
    config: { aspectRatio: '16:9', resolution: '1080p' },
  });

  let polls = 0;
  while (!operation.done) {
    polls++;
    process.stdout.write(`\r[test] generating... ${polls * 10}s elapsed`);
    await new Promise(r => setTimeout(r, 10000));
    operation = await ai.operations.getVideosOperation({ operation });
  }
  console.log('');

  if (!operation.response?.generatedVideos?.length) {
    console.error('[test] FAIL: no video returned.');
    console.error('[test] raw response:', JSON.stringify(operation.response, null, 2));
    process.exit(2);
  }

  const vid = operation.response.generatedVideos[0].video;
  console.log('[test] video object keys:', Object.keys(vid || {}).join(', '));

  if (vid?.videoBytes) {
    // Vertex returns the clip inline as base64 when no outputGcsUri is set.
    writeFileSync(outputPath, Buffer.from(vid.videoBytes, 'base64'));
    console.log(`[test] OK ✅ saved ${outputPath} (from inline videoBytes)`);
  } else if (vid?.uri) {
    // GCS or signed download URI.
    if (vid.uri.startsWith('gs://')) {
      console.log(`[test] video staged at GCS: ${vid.uri}`);
      console.log('[test] (re-run with a bucket download step, or it can be pulled via gsutil)');
    } else {
      const res = await fetch(vid.uri);
      writeFileSync(outputPath, Buffer.from(await res.arrayBuffer()));
      console.log(`[test] OK ✅ saved ${outputPath} (from uri)`);
    }
  } else {
    console.error('[test] FAIL: video object had neither videoBytes nor uri.');
    console.error('[test] dump:', JSON.stringify(vid, null, 2).slice(0, 2000));
    process.exit(2);
  }
  console.log('[test] Now check the GCP billing page: did this draw down the $300 credit?');
} catch (err) {
  console.error('\n[test] ERROR:', err?.message || err);
  if (err?.message && /model/i.test(err.message)) {
    console.error('[test] hint: the model id may differ on Vertex — try GCP_VEO_MODEL=veo-3.0-generate-001');
  }
  if (err?.message && /permission|PERMISSION|403/i.test(err.message)) {
    console.error('[test] hint: ensure Vertex AI API is enabled + your account has Vertex AI User role.');
  }
  process.exit(3);
}
