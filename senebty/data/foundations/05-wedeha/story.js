// senebty/data/foundations/05-wedeha/story.js
// F5 Wedeha — The Plate of Kemet. Maat-as-proportion in whole-food nutrition.
//
// Protagonist: Bener — girl, ~9 years old. Name from Kemetic root bener (sweet).
// Distinct from: Sitra (F1), Tanu (F2), Senka (F3), Nubia (F4), Ahmose (F6),
//   Iry (F7), Kahotep (F8), Khaemwaset (Threshold).
//
// Pedagogical arc:
//   Chunk 1 (Arrival) — Bener walks home. Sunu has sent her home with the
//     teaching: today she prepares the plate with a parent. Names mu (F1 recap)
//     and tjau (F3 recap), then wedeha — the proportioned offering.
//   Chunk 2 (Whole foods) — Diop on Kemetic nutrition tradition. Finch on sunu
//     nutrition counsel. "The plate that holds Maat is the plate that holds
//     proportion."
//   Chunk 3 (Maat-as-proportion) — Karenga on Maat as measured, even, ordered
//     (continuity with F1/F4). Parent helps Bener arrange the plate.
//   Chunk 4 (The offering) — Bener names the foods. The plate is offered — eaten
//     together. Parent will record what was made.
//
// iri: WEDEHA_PHOTO_IRI — parent photographs the prepared plate, confirms via
//   dashboard. Photo stored AES-256-GCM encrypted, deleted on confirmation or
//   30-day TTL (COPPA-gated per F5 Wedeha PHOTO_IRI design spec).
//
// Africana citations: Diop *Civilization or Barbarism*, Karenga *Maat*,
//   Finch *African Medicine*, positioning note.
//
// Spec: docs/superpowers/specs/2026-05-16-senebty-f5-wedeha-photo-iri-design.md
// Design-gate RT 2026-05-16 — bindings:
//   1. 4 L1 chunks, protagonist Bener.
//   2. iriType = 'WEDEHA_PHOTO_IRI', evidenceShape = { photoId, uploadedAt }.
//   3. Citations: Diop + Finch + Karenga + positioning note.

const FOUNDATION_WEDEHA = {
  id: 'foundation-5-wedeha',
  type: 'foundation',
  level: 1,
  powerWord: 'WEDEHA',
  semaPair: 'plate-and-proportion',
  giftId: 'plate-of-kemet',
  chunks: [
    // ─── L1 ──────────────────────────────────────────────────────────────
    {
      level: 1,
      text: "A girl named Bener walks home from the Per Ankh in the early afternoon. She is nine years old. The road is warm. She carries the teaching the sunu gave her before she left. The sunu said: today you do not stay at the Per Ankh. Today you go home. Today you prepare the plate with your parent. Bener has learned mu at the Per Ankh — mu is water. She has learned tjau — tjau is breath. Now the sunu has given her the next word. The word is wedeha. Wedeha is the plate. The plate is not any plate. The plate is the proportioned offering — the plate arranged so that no part is too much and no part is too little. Bener holds the word in her mouth as she walks. She says it once to herself: wedeha. The plate that holds Maat.",
      vocab: ['wedeha', 'mu', 'tjau', 'Per Ankh'],
      sebaIntro: "My dear {name}, this is Bener. She is nine years. The sunu has sent her home with a new word: wedeha. Wedeha is the plate of Kemet — the proportioned offering.",
      sebaAfter: "Wedeha — the plate that holds Maat. Bener is walking home to prepare it with her parent. Read on, {name}.",
    },
    {
      level: 1,
      text: "Bener steps into the kitchen and finds her parent there. She says, 'The sunu sent me home to make wedeha with you today.' Her parent nods and sets aside the work. They stand at the table together. Bener looks at what is on the table: bread made from emmer grain, a bunch of green vegetables, a small piece of dried fish, and two figs. Diop, an African scholar of Kemet, teaches in his book that the Kemetic table held whole foods — grain, vegetable, fish, and fruit — because the body is built from the land. The land gives what the body needs. Finch, an African scholar of medicine, teaches that the sunu counseled families on the foods that kept the body in balance. The sunu did not wait for illness. She named the foods before illness came. Bener looks at the table. The foods are already there. Now they must arrange them.",
      vocab: ['wedeha', 'emmer', 'balance'],
      sebaIntro: "{name}, Bener finds her parent in the kitchen. The foods are on the table. Diop and Finch teach us what the Kemetic table held.",
      sebaAfter: "Diop is an African scholar of Kemet. Finch is an African scholar of medicine. Both teach that the plate was a matter of proportion and balance. Read on, {name}.",
    },
    {
      level: 1,
      text: "The parent picks up the bread and breaks it in half. They place one piece at the center of the plate. They say, 'Bread first. Bread is the foundation.' Then they place the green vegetables beside the bread. Then the dried fish beside the vegetables. Then the two figs at the edge. Bener watches each placement. Karenga, an African scholar of Maat, teaches that Maat is measured, even, and ordered — no part fights the others, no part overwhelms the others. The plate before them now shows that teaching. The bread does not crowd the fish. The fish does not crowd the vegetables. The figs sit at the edge, balanced. Bener's parent says, 'No part of the plate fights the others. That is the plate that holds Maat.' Bener looks at the arranged plate. She sees what wedeha means in the arrangement.",
      vocab: ['wedeha', 'Maat', 'proportion'],
      sebaIntro: "{name}, the parent arranges the plate piece by piece. Karenga teaches that Maat is measured, even, and ordered. Watch the plate take shape.",
      sebaAfter: "No part of the plate fights the others. Karenga's teaching of Maat — measured, even, ordered — is present in the arrangement. {name}, read on.",
    },
    {
      level: 1,
      text: "Bener and her parent sit before the prepared plate. Bener's parent says, 'Name what is here.' Bener points to each food. 'Bread from emmer grain. Green vegetables from the garden. Dried fish from the river. Two figs.' Her parent nods after each one. Then her parent says, 'Now we eat it.' They eat together from the plate. Bener eats slow, the way the sunu eats at the Per Ankh. The bread is dense and filling. The vegetables are cool. The fish is salty. The figs are sweet at the end. When the plate is empty, Bener's parent says, 'I will write down what we made today.' The parent lifts a stylus and writes on a small piece of papyrus: emmer bread, green vegetables, dried fish, two figs. Wedeha. The plate has been offered. The iri is done.",
      vocab: ['wedeha', 'iri', 'emmer'],
      sebaIntro: "{name}, Bener names each food on the plate. Then they eat it together — slowly, the way the Per Ankh teaches.",
      sebaAfter: "The plate was prepared. The plate was named. The plate was eaten together. {name}, that is wedeha. The iri is done.",
    },
  ],
  comprehensionPool: [
    {
      kind: 'character',
      q: 'Who is the girl in this story?',
      a: 'Bener',
      distractors: ['Nubia', 'Sitra', 'Senka'],
    },
    {
      kind: 'setting',
      q: 'Where does Bener prepare the plate?',
      a: 'At home, in the kitchen, with her parent',
      distractors: ['At the Per Ankh courtyard', 'At the market in Waset', 'By the Nile with the sunu'],
    },
    {
      kind: 'vocabulary',
      q: 'What is wedeha?',
      a: 'The plate — the proportioned offering arranged so no part is too much and no part is too little',
      distractors: ['Water — the Nile in the cup', 'Breath — the air in the khat', 'A tool the sunu uses at the Per Ankh'],
    },
    {
      kind: 'vocabulary',
      q: 'Which two power words does Bener recall as she walks home?',
      a: 'Mu (water) and tjau (breath)',
      distractors: ['Iri and Maat', 'Wedeha and khat', 'Emmer and fish'],
    },
    {
      kind: 'maat',
      q: 'Which African scholar teaches that Maat is measured, even, and ordered?',
      a: 'Karenga',
      distractors: ['Diop', 'Finch', 'Obenga'],
    },
    {
      kind: 'maat',
      q: 'What does "no part of the plate fights the others" show us about Maat?',
      a: 'Maat is proportion — when each part is in its place, the whole is balanced and ordered',
      distractors: ['Maat means only the pharaoh eats well', 'Maat is about eating quickly so no one is hungry', 'Maat means only vegetables should be on the plate'],
    },
    {
      kind: 'inference',
      q: 'Why does the sunu send Bener home to prepare the plate with her parent instead of preparing it at the Per Ankh?',
      a: 'Because the iri belongs in the home — the family prepares the plate together, not the sunu alone',
      distractors: ['Because the Per Ankh has no food', 'Because Bener misbehaved at the Per Ankh', 'Because parents are better cooks than the sunu'],
    },
    {
      kind: 'sequence',
      q: 'What four foods are on Bener\'s wedeha plate?',
      a: 'Emmer bread, green vegetables, dried fish, and two figs',
      distractors: ['Barley bread, lentils, roasted goat, and dates', 'Mu, tjau, emmer, and figs', 'Figs, olives, wheat bread, and chicken'],
    },
    {
      kind: 'vocabulary',
      q: 'Which African scholar teaches that the Kemetic table held whole foods because the body is built from the land?',
      a: 'Diop',
      distractors: ['Finch', 'Karenga', 'Carruthers'],
    },
    {
      kind: 'inference',
      q: 'Why does Bener\'s parent write down what they made on papyrus?',
      a: 'To record the iri — the parent is the keeper of the evidence of the wedeha preparation',
      distractors: ['To sell the recipe at the market', 'Because the sunu required a written test', 'To remind Bener what she ate so she can repeat it alone'],
    },
  ],
  iriCheckpoint: {
    afterChunk: 3,
    iriType: 'WEDEHA_PHOTO_IRI',
    prompt: 'Prepare the Kemetic plate with your parent. Your parent will upload one photo of the plate when it is ready.',
    evidenceShape: { photoId: 'string', uploadedAt: 'number' },
    parentConfirmDefault: true,
    sebaPostIri: 'You have iri. You have prepared the plate of Kemet with your family. Wedeha — the plate that holds Maat in proportion.',
  },
  citations: [
    'Diop *Civilization or Barbarism: An Authentic Anthropology* — the Kemetic table as whole foods drawn from the land (grain, vegetable, fish, fruit); the body built from the land as the basis of Kemetic nutrition tradition; specific page citation pending user verification',
    'Karenga *Maat: The Moral Ideal in Ancient Egypt* — Maat as measured, even, and ordered; the plate as a practical site of Maat-as-proportion (continuity with F1/F4 daily-working framing); specific page citation pending user verification',
    'Finch *African Medicine: A Spirit Science Out of the Shadows* — the sunu as nutrition counselor who named the foods before illness came; preventive plate counsel as sunu practice in Kemetic medicine; specific page citation pending user verification',
    'F5 pedagogical positioning: Wedeha bridges the body-practices of F1 (mu/water), F3 (tjau/breath) into the food domain. The parent is the iri-keeper in F5 — intentional pedagogical departure from F1-F4 where the child acts alone. PHOTO_IRI is the evidence shape; iri completion is parent-confirmed via dashboard upload.',
  ],
  // ── Phase 2 — daily-ritual data
  // Spec: docs/superpowers/specs/2026-05-20-senebty-f5-wedeha-daily-ritual-design.md
  // Sage: sunu Merytamun (wing-constant who sent Bener home with the wedeha teaching).
  //   Wing map: F1 Merytamun, F2 Aset, F3 Merytamun, F4 Merytamun, F5 Merytamun.
  //   F5's story is home-set; there is no in-home sage; Merytamun is the framing sage.
  //
  // TWO new Veos (different subjects — NO hybrid reuse):
  //   doingVeo  = NEW wedeha-plate.mp4 (Bener, home kitchen, RITUAL-DEMONSTRATION)
  //   blessingVeo = NEW wedeha-blessing-sunu.mp4 (Merytamun, Per Ankh, AMBIENT-RITUAL)
  //   Different subjects → NO pair byte-identity test.
  //   Instead: Merytamun blessing block matches F3's tjau-blessing-sunu (cross-foundation
  //   Merytamun continuity — same wing-constant character). See tests Task 4.
  //
  // PHOTO-FREE (spec §2 — CRITICAL):
  //   The daily ritual does NOT touch WEDEHA_PHOTO_IRI, the consent dialog,
  //   /api/senebty/ photo endpoints, or the PM2 cleanup cron. Those stay entirely
  //   in the chunk-reading flow. This dailyFoundation block has NO photoId, upload,
  //   consent, or WEDEHA_PHOTO_IRI reference. The honor-check is a button press
  //   (dailyFoundationLog[date]), not a photo upload.
  //
  // Quartet: plate / proportion / prevention / family / closer (5+5+5+5+1).
  // Stage-1 RT recs 1-11 implemented. Stage-2 Coach audit follows.
  dailyFoundation: {
    doingVeo: "/videos/senebty-foundations/wedeha-plate.mp4",
    blessingVeo: "/videos/senebty-foundations/wedeha-blessing-sunu.mp4",
    greeting: {
      title: "Today is Wedeha",
      subtitle: "The plate that holds Maat — proportion, not too much, not too little",
      powerWord: "WEDEHA",
    },
    dailyGesture:
      "At one meal today, arrange your plate in proportion:\n" +
      "  a grain, a vegetable, a protein, a fruit.\n" +
      "  No part too much. No part too little.\n" +
      "\n" +
      "Name each part out loud. That is wedeha.",
    blessingLine: "Seneb, {name}. Your plate holds Maat.",
    honorCheckLabel: "Yes — I made a plate that holds Maat",
    microTeachings: [
      // ── plate quartet (the Kemetic table — whole foods from the land) ─────
      {
        quartetTag: "plate",
        scholar: "Diop",
        quote: "Africana civilization grew its body from the land. The Kemetic table — grain, vegetable, fish, fruit — is not a modern prescription. It is what the Nile valley offered, and what the people took in daily. The plate that holds these four things holds the land.",
      },
      {
        quartetTag: "plate",
        scholar: "Diop",
        quote: "The whole food is the food that remains whole from the land to the table. The grain is not powdered; the vegetable is not stripped; the fish is not processed beyond recognition; the fruit is not reduced to sweetness. The Kemetic table kept the whole thing whole.",
      },
      {
        quartetTag: "plate",
        scholar: "Obenga",
        quote: "Kemetic medicine named the foods before it named the diseases. The grain, the vegetable, the fish, the fruit — these were the vocabulary of health before there was a word for illness. The plate was the first pharmacy.",
      },
      {
        quartetTag: "plate",
        scholar: "Hilliard",
        quote: "What children eat at the table is not separate from what they learn at the table. The plate is a lesson in what the land provides and what the body needs. Naming the four parts of the plate is naming four relationships with the earth.",
      },
      {
        quartetTag: "plate",
        scholar: "Bekerie",
        quote: "Ethiopic tradition: the shared plate is the shared covenant. What the family eats together, the family becomes together. The proportioned plate placed on the table is an offering — not to a deity, but to the family that will eat from it.",
      },

      // ── proportion quartet (Maat as measured, even, ordered) ─────────────
      {
        quartetTag: "proportion",
        scholar: "Karenga",
        quote: "Maat is measured. Maat is even. Maat is ordered. The plate that holds a grain, a vegetable, a protein, a fruit — with no part dominating, no part absent — is a plate that holds Maat. Wedeha is the word for this. The plate enacts it.",
      },
      {
        quartetTag: "proportion",
        scholar: "Karenga",
        quote: "The daily working of Maat is not an abstraction. It is a plate arranged in proportion at one meal. It is the child who names each part. Maat does not require a grand act. It requires the proportioned one, repeated daily, at the table.",
      },
      {
        quartetTag: "proportion",
        scholar: "Carruthers",
        quote: "In the Mdw Ntr tradition, proportion is the ordering principle of the visible world. The sky holds its proportion with the earth; the Nile holds its proportion with the land. The plate holds its proportion with the body. When one part dominates, Isfet enters.",
      },
      {
        quartetTag: "proportion",
        scholar: "Diop",
        quote: "Civilizational order and bodily order follow the same principle. What the Kemetic builders understood — that no single element should dominate the design — applies to the table as it applies to the temple. Proportion is the engineering of Maat.",
      },
      {
        quartetTag: "proportion",
        scholar: "Konadu",
        quote: "Akan wisdom names the balanced offering as the one that does not take too much and does not give too little. The plate arranged in proportion follows this. The child who can arrange a proportioned plate has learned the geometry of enough.",
      },

      // ── prevention quartet (the sunu named foods before illness came) ─────
      {
        quartetTag: "prevention",
        scholar: "Finch",
        quote: "The Kemetic sunu did not wait for illness to counsel on food. The sunu came to the home when the child was well and named the foods before the body was in need. Prevention is the first medicine. The proportioned plate is the preventive act.",
      },
      {
        quartetTag: "prevention",
        scholar: "Finch",
        quote: "Kemetic nutritional practice was not reactive. The sunu's counsel came before the symptom — she named the grain, the vegetable, the fish, the fruit as the body's builders, not as its remedies. The plate arranged before hunger becomes a disease is the sunu's teaching enacted.",
      },
      {
        quartetTag: "prevention",
        scholar: "Karenga",
        quote: "Maat in the body is maintained by daily practice, not restored by crisis response. The proportioned plate eaten before the body is unwell is the Maat-keeping act. The sunu teaches wedeha so that wedeha need not be taught by illness.",
      },
      {
        quartetTag: "prevention",
        scholar: "Hilliard",
        quote: "Children who learn the proportioned plate before their bodies know imbalance carry that knowledge forward. The lesson taught in health is the lesson remembered in difficulty. The sunu teaches wedeha to the well child because the well child is the one who can learn.",
      },
      {
        quartetTag: "prevention",
        scholar: "Acholonu",
        quote: "Ancestral food knowledge is preventive knowledge. The grandparent who teaches a child the proportioned plate is not teaching nutrition — she is teaching the body how to care for itself before the body forgets. Food wisdom passed early prevents forgetting.",
      },

      // ── family quartet (the iri belongs in the home) ──────────────────────
      {
        quartetTag: "family",
        scholar: "Hilliard",
        quote: "Children learn what is important by what the family returns to at the table. If the family arranges the plate together, the child learns that the plate is important. If the family names the parts together, the child learns that naming is important. The family table is the first classroom.",
      },
      {
        quartetTag: "family",
        scholar: "Hilliard",
        quote: "The parent who sits down with the child to arrange the proportioned plate is not performing a nutrition lesson. She is performing a Maat lesson. The parent's presence at the plate says: this act is worth our time together. Children receive that message before they receive the nutrition.",
      },
      {
        quartetTag: "family",
        scholar: "Acholonu",
        quote: "The ancestral table is the memory of the family. What was eaten together was remembered together. A child who arranges a proportioned plate with a parent is building a food memory — a memory the body will recognize even when the parent is gone.",
      },
      {
        quartetTag: "family",
        scholar: "Konadu",
        quote: "Akan tradition: the family plate is the family covenant. What is arranged together at the table belongs to everyone at the table. The child who names the grain names it for the family. The iri is shared — the wedeha is a family iri, not a solitary one.",
      },
      {
        quartetTag: "family",
        scholar: "Bekerie",
        quote: "Ethiopic understanding of the communal meal: no part of the plate is consumed in isolation. The grain nourishes everyone; the vegetable nourishes everyone. The proportioned plate arranged by a child and a parent is already a communal act before the first bite.",
      },

      // ── closer (the proportioned plate as daily Maat site) ────────────────
      {
        quartetTag: "closer",
        scholar: "Karenga",
        quote: "The plate that holds Maat in proportion is Maat practiced daily at home. Not in the Per Ankh. Not in the temple. At the table. When the child arranges the four parts and names them, the child is practicing Maat at the only site where Maat can be practiced every day. The home is the first temple.",
      },
    ],
  },
};

if (typeof window !== 'undefined') {
  window.Senebty = window.Senebty || {};
  window.Senebty.foundationWedehaStory = FOUNDATION_WEDEHA;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FOUNDATION_WEDEHA };
}
