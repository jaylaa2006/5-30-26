// senebty/data/foundations/01-mu/story.js
// F1 Mu — Water. The FIRST foundation: a young child's first encounter
// with mu (water) at the Per Ankh.
//
// Pedagogically precedes F4 Mu Streak (which assumes "you have learned
// mu before" — chunk-2 of F4). F1 introduces what mu is; F4 extends to
// the 21-morning streak discipline.
//
// iri: WATER_IRI — the existing 4-phase body-ritual (arrival → pour →
// drink → rest) preserved as the iri renderer; the chunk-reading phase
// is the new lead-in delegated to foundationRender.
//
// Spec-gate RT 2026-05-16 — APPROVE WITH BINDINGS (top-3):
//   1. 4 L1 chunks matching F4 mu-streak structure.
//   2. iri preserves existing 4-phase WATER_IRI timer (renderIri callback).
//   3. New protagonist Sitra — young girl, first time at Per Ankh.

const FOUNDATION_MU = {
  id: 'foundation-1-mu',
  type: 'foundation',
  level: 1,
  powerWord: 'MU',
  semaPair: 'body-and-water',
  giftId: 'cup-of-mu',
  chunks: [
    // ─── L1 ──────────────────────────────────────────────────────────────
    {
      level: 1,
      text: "A small girl named Sitra walks into the Per Ankh courtyard for the first time. She is six years old. The morning is cool. The basalt floor is swept. The sun is just over the eastern wall. A sunu sits on the low mat. Her name is Merytamun. She is dressed in plain white. Her hands are clean. A small clay cup of clean water sits on the basalt bench beside her. Finch, an African scholar of medicine, teaches that the sunu greets the body before she treats the body — the first work is always the greeting. Sitra kneels on the mat. She does not speak first. The sunu speaks first. She says, 'Today, Sitra, you learn the first thing. The first thing is mu. Mu is water.' Sitra nods. She looks at the cup.",
      vocab: ['Per Ankh', 'sunu', 'mu'],
      sebaIntro: "My dear {name}, this is Sitra. She is six years. She has just walked into the Per Ankh for the first time. The sunu Merytamun is about to teach her the first thing.",
      sebaAfter: "The first thing is mu, {name}. Mu is water. The sunu names it before she pours it. Read on.",
    },
    {
      level: 1,
      text: "The sunu Merytamun lifts the small clay cup. She holds it in both hands. She says, 'Mu is the Nile in your khat. Your khat is your body. Diop, an African scholar of Kemet, teaches that the Nile is the long carrier of Maat through our land. The slow water makes the fields. The fields make the bread. The bread makes the body. The same long carrier is in this small cup.' Sitra looks at the cup. The water inside is still. The morning light catches the rim. Sitra has carried water before, at her own home. She has drunk water before. But she has never been told that the water is the Nile in her khat. She listens. The sunu does not rush.",
      vocab: ['khat', 'Nile', 'Maat'],
      sebaIntro: "{name}, the sunu lifts the cup and names what is inside. Listen to the name she gives it.",
      sebaAfter: "Diop is an African scholar of Kemet, {name}. He teaches that the Nile is the long carrier of Maat. The same long carrier is in the small cup. Read on.",
    },
    {
      level: 1,
      text: "Then the sunu says the careful thing. She says, 'Sitra, today is one cup. Today is one iri. Iri means to do. The Per Ankh teaches by doing. The body learns by doing. Karenga, an African scholar of Maat, teaches that the daily working of mu is the daily working of Maat — measured, even, ordered. The pharaoh drinks mu each morning. The sunu drinks mu each morning. The child drinks mu each morning. The same water. The same working.' Sitra sits straight on the mat. The cup is still on the bench. The sunu has not yet given it. Sitra knows what comes next. The first iri is hers.",
      vocab: ['iri'],
      sebaIntro: "{name}, the sunu names the practice. She says iri — to do. The Per Ankh teaches by doing.",
      sebaAfter: "Karenga teaches that the daily working of mu is the daily working of Maat. {name}, you will do one cup with Sitra. The body learns by doing.",
    },
    {
      level: 1,
      text: "The sunu lifts the cup from the bench. She holds it out in both hands toward Sitra. She says, 'Now you, Sitra. Pour the water you will drink. Then drink it slow. The Per Ankh listens. The body is the cup that holds Maat. Mu is what fills it.' Sitra takes the cup carefully in both hands. The clay is warm from the morning sun. The water is cool against her palms. She breathes slow. The first morning is now. The first iri is now. She must do — she must iri. The Per Ankh is quiet. The sun is over the eastern wall.",
      vocab: ['iri', 'Per Ankh'],
      sebaIntro: "{name}, the sunu gives Sitra the cup. The first iri is now. Watch — and do.",
      sebaAfter: "Sitra takes the cup. Now you, {name}. Pour your own cup. Drink slow. The body is the cup that holds Maat. Mu is what fills it.",
    },
  ],
  comprehensionPool: [
    {
      kind: 'character',
      q: 'Who is the girl in this story?',
      a: 'Sitra',
      distractors: ['Merytamun', 'Tanu', 'Nubia'],
    },
    {
      kind: 'setting',
      q: 'Where does the lesson take place?',
      a: 'The Per Ankh courtyard',
      distractors: ['Sitra\'s home', 'A temple by the Nile', 'A market square in Waset'],
    },
    {
      kind: 'vocabulary',
      q: 'What is mu?',
      a: 'Water — the Nile in your khat',
      distractors: ['Bread', 'Breath', 'Body'],
    },
    {
      kind: 'vocabulary',
      q: 'What is the khat?',
      a: 'Your body — the body the sunu palpates and examines',
      distractors: ['Your heart-mind', 'Your name', 'Your shadow'],
    },
    {
      kind: 'vocabulary',
      q: 'What does iri mean?',
      a: 'To do — the Per Ankh teaches by doing, not just by saying',
      distractors: ['To rest', 'To pour', 'To speak'],
    },
    {
      kind: 'sequence',
      q: 'How many cups of mu is the iri today?',
      a: 'One cup — today is one iri',
      distractors: ['Three cups', 'Twenty-one cups', 'As many as Sitra wants'],
    },
    {
      kind: 'maat',
      q: 'Which African scholar teaches that the Nile is the long carrier of Maat?',
      a: 'Diop',
      distractors: ['Karenga', 'Obenga', 'Carruthers'],
    },
    {
      kind: 'inference',
      q: 'Why does the sunu say the pharaoh, the sunu, and the child all drink mu each morning?',
      a: 'Because the same working of mu holds Maat in measure for every body',
      distractors: ['Because only the pharaoh truly knows how', 'Because the children copy the adults', 'Because mu tastes good in the morning'],
    },
  ],
  iriCheckpoint: {
    afterChunk: 3,
    iriType: 'WATER_IRI',
    prompt: 'Pour one cup of clean water. Drink it slow. The body is the cup that holds Maat.',
    evidenceShape: { cups: 'number' },
    parentConfirmDefault: true,
    sebaPostIri: 'You have iri. You have drunk one cup of mu with Sitra. The body remembers. Return tomorrow for the streak.',
  },
  // v3.51.40 — Sunu Merytamun reflection at end of F1 (before iri). Replaces
  // the crude 5-MCQ block with a single end-of-foundation open-text moment
  // in the sunu's voice. Per the project Africana-source-precedence binding,
  // the sunu greets the body before she treats it — Finch's frame. The
  // child writes one honest reflection; Sunu listens.
  sunuReflection: {
    speaker: 'Sunu Merytamun',
    speakerGlyph: '𓋹',
    principle: 'Greeting the Body',
    storyContext: 'Sitra learned that the sunu greets the khat (body) before she treats it. The first iri is to name and listen to your own body before you act on it.',
    sebaIntro: "{name}, the sunu Merytamun sits with you now. She does not hurry. She listens before she teaches. Take a slow breath. Then write to her honestly.",
    prompt: "When did you last greet your khat before you used it? Tell Merytamun about one time — even a small time — when you noticed your body before you asked it to work.",
    sebaAfter: "{name}, the body remembers when you greet it. The first iri is hers — and yours.",
    minimumWords: 15,
  },
  citations: [
    'Diop *Civilization or Barbarism* — the Nile as the long carrier of Maat through Kemet (continuity with F4 mu-streak); specific page citation pending user verification',
    'Karenga *Maat: The Moral Ideal in Ancient Egypt* — the daily working of mu as the daily working of Maat, measured/even/ordered; specific page citation pending user verification',
    'Finch *African Medicine: A Spirit Science Out of the Shadows* — sunu daily ritual frame around mu as the first substance the sunu teaches; specific page citation pending user verification',
    'F1 pedagogical positioning: F1 precedes F4 mu-streak. F1 = first cup, first encounter. F4 = the 21-morning streak that extends F1. Same Power Word (MU), same scholar set (Diop/Karenga/Obenga/Finch).',
  ],
  dailyFoundation: {
    doingVeo: "/videos/senebty-foundations/mu-drink.mp4",
    greeting: {
      title: "Today is Mu",
      subtitle: "Water — the Nile in your khat",
      powerWord: "MU",
    },
    dailyGesture: "Drink one cup of clean water, slowly. Greet your khat before you fill it.",
    blessingLine: "Seneb, {name}. The body remembers.",
    // microTeachings — Stage-2 Coach Item 1 (carry-forward): each entry
    // carries a quartetTag field. F1 Mu is not quartet-structured; tags use
    // closest-fit semantics so tests can read tags uniformly across F1+F2:
    //   'khat'   — body-anchored / vessel framing
    //   'closer' — Maat / daily-discipline framing
    // F1 Mu has no ib/ka/ba structure (single foundation, single power-word),
    // so all entries map to either 'khat' (body-vessel + water-as-carrier-to-
    // the-body) or 'closer' (daily-discipline / Maat-as-daily-check). This
    // is informational on F1 — the F1 data test does NOT assert quartet
    // counts (F1 is not quartet-structured; the field exists for cross-
    // foundation parity only).
    microTeachings: [
      { quartetTag: 'khat', scholar: "Diop", quote: "The Nile is the long carrier of Maat through our land. The slow water makes the fields. The fields make the bread. The bread makes the body. The same long carrier is in this small cup." },
      { quartetTag: 'closer', scholar: "Karenga", quote: "The daily working of mu is the daily working of Maat — measured, even, ordered. The pharaoh drinks mu each morning. The child drinks mu each morning. The same water." },
      { quartetTag: 'khat', scholar: "Finch", quote: "The sunu greets the body before she treats the body — the first work is always the greeting." },
      { quartetTag: 'khat', scholar: "Hilliard", quote: "The body learns by doing. Read the cup. Lift the cup. Drink the cup. The body remembers what the mind has not yet named." },
      { quartetTag: 'khat', scholar: "Acholonu", quote: "Water carries ancestral memory. When you drink slow, you drink with those who drank before you on this land." },
      { quartetTag: 'khat', scholar: "Obenga", quote: "Mu is not metaphor. It is the literal first medicine. Every other treatment begins after the body is greeted with water." },
      { quartetTag: 'khat', scholar: "Diop", quote: "The Nile is not the river only — it is the body's understanding of flow. Your khat is a small Nile, replenished daily." },
      { quartetTag: 'closer', scholar: "Carruthers", quote: "Maat is precision in small things. One cup, drunk with attention, is Maat. Five cups, drunk while distracted, is not." },
      { quartetTag: 'closer', scholar: "Karenga", quote: "The discipline of the small daily act is the discipline of the great life. Mu is the smallest daily act." },
      { quartetTag: 'khat', scholar: "Bekerie", quote: "Water knows the body. The body remembers water. The two are old companions; the morning cup is their daily reunion." },
      { quartetTag: 'khat', scholar: "Finch", quote: "The Per Ankh sunu taught that the morning cup repairs what the night exhaled. Drink before you speak. Drink before you eat." },
      { quartetTag: 'closer', scholar: "Hilliard", quote: "Children do not learn from instruction. Children learn from witnessing the elder do the thing. Show the cup. Drink the cup. The child will drink." },
      { quartetTag: 'khat', scholar: "Acholonu", quote: "When you drink, you drink for those who could not drink — the ancestors who walked far for water. Drink with their thirst in your hand." },
      { quartetTag: 'khat', scholar: "Diop", quote: "Mu is not water-in-the-cup only. It is the moving carrier in the body. Every joint, every channel, every cell asks for mu by morning." },
      { quartetTag: 'closer', scholar: "Karenga", quote: "Begin the day with mu and the day begins with Maat. Begin the day with anything else, and the day begins with imbalance." },
      { quartetTag: 'khat', scholar: "Obenga", quote: "The Edwin Smith Papyrus opens with the body before it speaks of medicine. The body, greeted, becomes the place medicine can enter." },
      { quartetTag: 'closer', scholar: "Carruthers", quote: "There is no Maat without measure, and no measure without the first cup. The first cup is the day's first measure." },
      { quartetTag: 'khat', scholar: "Konadu", quote: "Water is the first ancestor. To drink is to acknowledge what came before you and made you possible." },
      { quartetTag: 'closer', scholar: "Bekerie", quote: "The morning cup is a small ceremony. Small ceremonies, done daily, build the life." },
      { quartetTag: 'closer', scholar: "Finch", quote: "Mu is not optional. The body does not negotiate. Drink early, drink slow, drink with attention — this is the sunu's instruction." },
      { quartetTag: 'closer', scholar: "Hilliard", quote: "What you do at sunrise becomes who you are by sunset. Drinking mu at sunrise is choosing whose child you will be today." },
    ],
  },
};

if (typeof window !== 'undefined') {
  window.Senebty = window.Senebty || {};
  window.Senebty.foundationMuStory = FOUNDATION_MU;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FOUNDATION_MU };
}
