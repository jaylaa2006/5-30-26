# Adding a story

All stories live in **`public/js/stories.js`** as one big global array:
`var STORIES = [ {...}, {...} ];`. Each `{...}` is one story. The app builds the
whole library from this array, so adding a story = adding one object.

## Easiest way
Tell Claude Code:
> "Add a new Level 2 story to public/js/stories.js called 'The Lighthouse Keeper'
> about a girl who keeps a harbor light. Follow the exact same shape as the
> existing `boy-fed-stranger` story, 15 chunks."

Claude Code will copy the shape of an example and fill it in. The examples in the
file (one per level, L1–L6) are your templates.

## The shape of a story
```js
{
  id: "the-lighthouse-keeper",        // unique, lowercase-with-dashes; folder + file name
  title: "The Lighthouse Keeper",
  level: 2,                            // 1–6 (see the level table in CLAUDE.md)
  grade: 4,
  principle: "Responsibility",        // the value/theme the story teaches
  scene: "scene-coast",               // a short scene hint
  chunks: [
    { text: "The first page of the story...", vocab: [ { word: "harbor", def: "..." } ] },
    { text: "The next page...", vocab: [] },
    // ...one chunk = one page the child reads. Match the level's chunk count.
  ],
  questions: [                         // comprehension checkpoints
    { type: "multiple-choice", prompt: "Why did she...?",
      options: ["A","B","C","D"], correct: 0, feedback: "Right because..." },
    { type: "reflection", prompt: "What would you have done?", options: [], correct: 0, feedback: "" }
  ]
}
```

## After adding the story
1. Give it art: a folder `art/the-lighthouse-keeper/` with `chunk-0.png`,
   `chunk-1.png`, … one per chunk. (Generate them — see `docs/generate-assets.md` —
   or drop in your own images named `chunk-0.png`, `chunk-1.png`, …)
2. Optional intro/outro video: `videos/intros/the-lighthouse-keeper.mp4` and
   `videos/outros/the-lighthouse-keeper.mp4`.
3. Restart `node server.js`, reload `http://localhost:3456`, find your story in the library, and click through it.

## Tips
- Keep `id` identical everywhere: the STORIES `id`, the `art/<id>/` folder, the `videos/.../<id>.mp4` files.
- Chunk count should roughly match the level (L1 ≈ 12, L6 ≈ 22–28).
- The 6 example stories are real, working references — copy whichever level you want.
