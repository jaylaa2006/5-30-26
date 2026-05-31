#!/usr/bin/env node
// B experiment: image-to-video from existing YW art. The figure (Yeshua) comes
// from the REFERENCE IMAGE; the text prompt never names/identifies him — testing
// whether the figure-from-image route slips past Vertex's text-RAI block.
import { GoogleGenAI } from '@google/genai';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';

const ai = new GoogleGenAI({ vertexai: true, project: process.env.GCP_PROJECT, location: 'us-central1' });
const imgPath = process.argv[2] || 'art/yeshuas-way-carpenter-of-nazareth/chunk-0.png';
const outPath = process.argv[3] || 'videos/_test/carpenter-img2vid.mp4';

const imageBytes = readFileSync(imgPath).toString('base64');
// Neutral animate prompt — NO figure naming, NO religious terms.
const prompt = `Gently bring this illustrated scene to life with full cinematic motion. Slow, smooth camera push-in toward the workbench; warm dawn light strengthens through the doorway across the shot; subtle ambient motion — fine dust drifting in the light beams, the seated figure's hands moving slowly and steadily at the wood. Cel-shaded animation, picture-book pacing, seamless loop. NO text, NO watermarks.`;

if (!existsSync('videos/_test')) mkdirSync('videos/_test', { recursive: true });
console.log('[B] image:', imgPath);
console.log('[B] submitting image-to-video (veo-3.1-generate-001)...');

let op = await ai.models.generateVideos({
  model: 'veo-3.1-generate-001',
  prompt,
  image: { imageBytes, mimeType: 'image/png' },
  config: { aspectRatio: '16:9', resolution: '1080p' },
});
let polls = 0;
while (!op.done) {
  polls++;
  process.stdout.write(`\r[B] ${polls * 10}s elapsed`);
  await new Promise(r => setTimeout(r, 10000));
  op = await ai.operations.getVideosOperation({ operation: op });
}
console.log('');
if (op.error) { console.error('[B] BLOCKED:', JSON.stringify(op.error)); process.exit(3); }
const vid = op.response?.generatedVideos?.[0]?.video;
if (!vid) { console.error('[B] no video:', JSON.stringify(op.response)?.slice(0, 800)); process.exit(3); }
if (vid.videoBytes) writeFileSync(outPath, Buffer.from(vid.videoBytes, 'base64'));
else if (vid.uri && !vid.uri.startsWith('gs://')) writeFileSync(outPath, Buffer.from(await (await fetch(vid.uri)).arrayBuffer()));
else { console.error('[B] unexpected shape:', JSON.stringify(vid).slice(0, 400)); process.exit(3); }
console.log('[B] OK ✅ saved', outPath, '— image-to-video with the actual figure PASSED.');
