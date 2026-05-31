#!/usr/bin/env node
// Isolate which token Veo's RAI blocks. Blocked = code-3 at submit = FREE.
// Accepted = starts generating = ~$3 each (we stop after one poll).
import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ vertexai: true, project: process.env.GCP_PROJECT, location: 'us-central1' });

const base = 'Cinematic cel-shaded animation. A young carpenter with very dark brown Nilotic skin and 4C hair works olive wood in a stone workshop at dawn. The camera slowly pans.';
const tests = {
  'name-Jesus':   base + ' The young carpenter is named Jesus.',
  'name-Yeshua':  base + ' The young carpenter is named Yeshua.',
  'sacred-words': base + ' His sacred and reverent work is a healing prayer.',
};

for (const [label, prompt] of Object.entries(tests)) {
  try {
    let op = await ai.models.generateVideos({ model: 'veo-3.1-generate-001', prompt, config: { aspectRatio: '16:9', resolution: '1080p' } });
    await new Promise(r => setTimeout(r, 8000));
    op = await ai.operations.getVideosOperation({ operation: op });
    if (op.error) console.log(`${label.padEnd(13)} → BLOCKED (free): ${String(op.error.message).slice(0, 80)}`);
    else console.log(`${label.padEnd(13)} → ACCEPTED (generating, ~$3): done=${op.done}`);
  } catch (e) {
    console.log(`${label.padEnd(13)} → ERROR: ${String(e.message).slice(0, 80)}`);
  }
}
