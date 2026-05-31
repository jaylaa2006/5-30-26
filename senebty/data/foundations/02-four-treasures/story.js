// senebty/data/foundations/02-four-treasures/story.js
// F2 Four Treasures — Khat / Ib / Ka / Ba
// Per docs/superpowers/specs/2026-05-04-senebty-v1-finish-design.md
// Tone canon: skills/docs/project/seba-voice-senebty.md
// Cultural Consensus M1 binding: BODY_IRI redesigned to tap-each-treasure-card
//   pattern (NOT body-locations). Africana citations required: Karenga, Carruthers,
//   Obenga, Finch.
// Pedagogical-quartet transparency note required in Seba aside (Akh/Ren/Sheut).
//
// Story authored 2026-05-04 per tone canon. Subject to tone-canon RT review at M5.

const FOUNDATION_FOUR_TREASURES = {
  id: 'foundation-2-four-treasures',
  type: 'foundation',
  level: 1,
  powerWord: 'KHAT',
  semaPair: 'body-and-breath',
  giftId: 'chart-four-treasures',
  chunks: [
    // ─── L1 ────────────────────────────────────────────────────────────────
    {
      level: 1,
      text: "A girl named Tanu walks into the Per Ankh courtyard. The morning is cool. The basalt floor is swept. The sun is on the eastern wall. A sunu is already there. Her name is Merytamun. She is dressed in plain white. Her hands are clean. A bowl of water sits beside her. Tanu kneels on the mat. She does not speak first. The sunu speaks first. She says, 'Today you learn the Four Treasures.' Tanu nods. The sunu lifts a small wooden card. It is painted with a single sign. The sign is khat — the body. The sunu points at Tanu's arm. The sunu says, 'This is your khat.'",
      vocab: ['Per Ankh', 'sunu', 'khat'],
      sebaIntro: "My dear {name}, this is Tanu. She is your age. She is at the Per Ankh today. The sunu Merytamun will teach her the Four Treasures.",
      sebaAfter: "The first treasure is the khat — the body. The sunu names it before she touches it. Read on, {name}.",
    },
    {
      level: 1,
      text: "Tanu looks at her arm. The sunu lifts a second card. It is painted with the sign for ib — the heart. The sunu says, 'The ib is more than the muscle in your chest. The ib is your heart-mind. It is what knows right from wrong. Karenga teaches that the ib is weighed against the feather of Maat.' Tanu touches her chest. She says the word. 'Ib.' The sunu nods. She says, 'Khat. Ib. Two treasures named. Two more to come.' Tanu sits straight on the mat. She listens. The morning is bright now. The bowl of water is still. The sunu does not rush.",
      vocab: ['ib', 'maat'],
      sebaIntro: "{name}, the second treasure is the ib. Watch how the sunu teaches it.",
      sebaAfter: "The ib is heart-and-mind together. Karenga, an African scholar of Maat, teaches that the ib is what is weighed at the end. Read on.",
    },
    {
      level: 1,
      text: "The sunu lifts a third card. It is painted with two raised arms. The sunu says, 'This is your ka. Your ka is your vital essence. It is what the ancestors gave you. It walks with you.' She raises her own arms at her sides, palms forward, the way the sign is painted. 'Lift your arms like the sign,' she says. Tanu raises her arms. The ka is in her shoulders now. She says the word. 'Ka.' The sunu lifts a fourth card. It is painted with a bird. The sunu says, 'This is your ba. Your ba is who you are. It is your name in the world.' The sunu rests her own fingers at the hollow of her throat. 'Your name lives here,' she says. Tanu touches her throat. She says the word. 'Ba.' The sunu sets the four cards in a row. Tanu asks, 'Are there more?' The sunu says, 'Yes. There are also Akh and Ren and Sheut. The old sources name seven. The sunu teaches the working four first. Then the rest, when you are older.'",
      vocab: ['ka', 'ba', 'akh', 'ren'],
      sebaIntro: "{name}, watch the third and fourth treasures. And listen — Tanu asks the careful question.",
      sebaAfter: "The sunu tells the truth: the working set is four. The full Africana teaching also names Akh, Ren, and Sheut — seven in all. {name}, you are learning the pedagogical four first. The rest waits for you.",
    },
    {
      level: 1,
      text: "Tanu looks at the row of cards. Four treasures, four cards. The sunu lifts the bowl of water. She rests it on the basalt mortar bench. She says, 'You will tap each card. You will say its name. The Per Ankh listens.' Tanu kneels closer to the bench. She knows what comes next. She must do — she must iri. The sunu does not praise her. The sunu does not hurry her. The sunu sits and waits. The four wooden cards lie in the morning light. Khat. Ib. Ka. Ba. Tanu reaches her hand toward the first card. The Per Ankh is quiet. The morning is hers.",
      vocab: ['iri'],
      sebaIntro: "{name}, the Per Ankh is quiet. The four cards are ready. So is Tanu. So are you.",
      sebaAfter: "Tanu reaches for the first card. Now you. Tap each treasure. Say each name. The sunu is listening.",
    },
    // ─── L2 ────────────────────────────────────────────────────────────────
    {
      level: 2,
      text: "A girl named Tanu walks into the Per Ankh courtyard at the hour when the basalt floor still holds the night's cool. The sun is climbing the eastern wall. The yard has been swept clean by a junior scribe. A sunu waits on the low mat. Her name is Merytamun, and she has been a sunu of the Per Ankh for nineteen seasons. She is dressed in a plain white shift. Her hands are washed. A clay bowl of clean water rests beside her, and four small wooden cards lie face-down on a basalt mortar bench. Tanu kneels on the mat without speaking. The sunu speaks first, the way the Per Ankh always teaches first. 'Today, Tanu, you learn the Four Treasures.' Tanu nods. The sunu turns over the first card.",
      vocab: ['Per Ankh', 'sunu', 'scribe'],
      sebaIntro: "{name}, this is Tanu. The Per Ankh is a working medical school. Merytamun is a sunu — a physician. Watch how teaching begins.",
      sebaAfter: "The sunu speaks first. Then the work begins. Read on, {name}.",
    },
    {
      level: 2,
      text: "The first card is painted with the sign for khat — the living body. The sunu places her open hand on Tanu's forearm, above the wrist, the way a sunu does at every morning examination. 'This,' she says, 'is your khat. Your living vessel. The sunu palpates the khat. The sunu reads the khat. The khat is what the African scholar Obenga calls the physical vessel — not a mistake to be escaped, but a holy thing entrusted to you.' She turns over the second card. It bears the sign for ib. 'And this,' she says, 'is your ib. The ib is your heart-mind. It knows right from wrong. Karenga teaches that the ib is what is weighed against the feather of Maat at the end of life.' Tanu touches her chest and says the word. 'Ib.'",
      vocab: ['khat', 'ib', 'maat'],
      sebaIntro: "{name}, the first two treasures: khat and ib. Body and heart-mind. Listen to who the sunu cites.",
      sebaAfter: "Obenga and Karenga are African scholars of Kemet. The sunu names her sources. {name}, you can name yours too. Read on.",
    },
    {
      level: 2,
      text: "The sunu turns the third card. It is painted with two raised arms — the sign for ka. 'This is your ka,' she says. 'Your vital essence. Carruthers in Mdw Ntr teaches that the ka is named into you by the ancestors. The ka walks with you when you sleep. The ka eats when you eat.' Merytamun raises her own arms at her sides to shoulder height, palms forward, the way the sign is painted on the card. 'The sign is the gesture,' she says. 'Lift your arms like the ka.' Tanu raises her arms. Her shoulders open. Her chest rises a little. The ka is in her body now. She repeats the word. 'Ka.' The sunu turns the fourth card. It is painted with a human-headed bird. 'And this is your ba. Your ba is your personality, your particular self, the one who is no other.' The sunu rests her own fingertips at the hollow of her throat, just above the clavicle. 'Your name lives here,' she says. 'The ba breathes out at the hollow of the throat — Obenga teaches that the ba is named in the breath that carries the voice.' Tanu touches her own throat. She says the word. 'Ba.' Tanu asks then, the way a careful student asks, 'Sunu — are there more?' Merytamun nods. 'Yes. There are also Akh and Ren and Sheut. The old sources name seven. The sunu teaches the working four first. The rest, when you are older.'",
      vocab: ['ka', 'ba', 'akh', 'ren'],
      sebaIntro: "{name}, watch the careful question Tanu asks. A good student names what she does not yet know.",
      sebaAfter: "Carruthers wrote Mdw Ntr — Divine Speech. He is one of the African scholars who carries the Kemetic teaching. {name}, the working set is four. The full set is seven. The sunu teaches you the truth in measure.",
    },
    {
      level: 2,
      text: "The four cards lie in a row in the morning light. Khat. Ib. Ka. Ba. The sunu does not move them. She says, 'In a moment, Tanu, you will tap each card in turn. You will say the name aloud. The Per Ankh listens. The ancestors listen. Finch in African Medicine teaches that this naming is the first work of the sunu — the body is greeted before it is treated.' Tanu kneels closer to the basalt mortar bench. The yard is quiet. The bowl of water is still. The sunu does not praise her. The sunu does not hurry her. The sunu sits and waits, the way a master waits. Tanu looks at the four cards. She knows what comes next. She must do. She must iri. She reaches her hand toward the first card.",
      vocab: ['iri'],
      sebaIntro: "{name}, the courtyard is quiet. Tanu is ready. The sunu is waiting.",
      sebaAfter: "Finch wrote African Medicine. He teaches that the sunu greets the body before treating it. {name}, now you. Tap each treasure. Say each name. The sunu is listening.",
    },
  ],
  comprehensionPool: [
    {
      kind: 'character',
      q: 'Who is the girl in this story?',
      a: 'Tanu',
      distractors: ['Merytamun', 'Khaemwaset', 'a junior scribe'],
    },
    {
      kind: 'setting',
      q: 'Where does the lesson take place?',
      a: 'The Per Ankh courtyard',
      distractors: ['Tanu\'s home', 'A temple by the Nile', 'A market square in Waset'],
    },
    {
      kind: 'sequence',
      q: 'Which treasure does the sunu name FIRST?',
      a: 'Khat (the body)',
      distractors: ['Ib (the heart-mind)', 'Ka (the vital essence)', 'Ba (the personality)'],
    },
    {
      kind: 'vocabulary',
      q: 'What is the ib?',
      a: 'The heart-mind — what knows right from wrong and is weighed against the feather of Maat',
      distractors: ['The lungs', 'The body in motion', 'The shadow of a person'],
    },
    {
      kind: 'vocabulary',
      q: 'What is the ka?',
      a: 'Your vital essence — given by the ancestors',
      distractors: ['Your physical body', 'Your written name', 'Your nightly dream'],
    },
    {
      kind: 'vocabulary',
      q: 'What is the ba?',
      a: 'Your personality — your particular self, shown as a human-headed bird',
      distractors: ['Your physical body', 'Your shadow', 'Your breath'],
    },
    {
      kind: 'inference',
      q: 'Why does the sunu say there are also Akh and Ren and Sheut?',
      a: 'Because the old sources name seven; the sunu teaches the working four first',
      distractors: ['Because Tanu is too young to learn the right ones', 'Because the cards are painted wrong', 'Because the sunu disagrees with the old sources'],
    },
    {
      kind: 'maat',
      q: 'How does the sunu show Maat in her teaching?',
      a: 'She names her sources, teaches the truth in measure, and does not hurry the student',
      distractors: ['She praises every answer', 'She tests Tanu before teaching her', 'She keeps the harder treasures secret forever'],
    },
  ],
  iriCheckpoint: {
    afterChunk: 3,
    iriType: 'BODY_IRI',
    prompt: 'Tap each of the four treasures. Say its name. The Per Ankh master listens.',
    evidenceShape: { taps: 'array<{treasure: string, recited: boolean, score?: number}>' },
    parentConfirmDefault: true,
    sebaPostIri: 'You have iri. The four treasures are in your voice now. The ancestors see.',
  },
  // v3.51.40 — Aset reflection at end of F2 (before iri). The user binding
  // names the wing-pattern speaker; per Africana scholar Diop, Aset (Auset)
  // is the mother of measure who teaches the daily check across the working
  // four (khat / ib / ka / ba). Karenga's MAAT frame: the ib is weighed
  // daily, not only at the end of life. The reflection asks the child to
  // notice which treasure was tended today and which went hungry. One
  // honest sentence is enough.
  asetReflection: {
    speaker: 'Aset',
    speakerGlyph: '𓋹',
    principle: 'Daily check across khat, ib, ka, and ba',
    storyContext: 'Tanu learned the four treasures: khat (body), ib (heart-mind), ka (vital essence), ba (personality). The sunu teaches the working four first; the working four must be checked every day.',
    sebaIntro: "{name}, Aset is the mother of measure. She greets each of your four treasures by name. Sit a moment. Then tell her honestly which treasure you tended today, and which one went hungry.",
    prompt: "Of khat, ib, ka, and ba — which treasure did you tend well today, and which one did you forget? Tell Aset what you noticed.",
    sebaAfter: "{name}, the working four are a daily check, not a once-and-done test. Aset hears you. The treasure that went hungry today is the first one to greet tomorrow.",
    minimumWords: 15,
  },
  citations: [
    'Karenga *Maat: The Moral Ideal in Ancient Egypt* — Ib (heart-mind) as moral arbiter weighed against the feather of Maat; specific page citation pending user verification',
    'Carruthers *Mdw Ntr: Divine Speech* — Ka (vital essence) as named-into-being by the ancestors; specific page citation pending user verification',
    'Obenga *African Philosophy: The Pharaonic Period* — Khat as physical vessel, holy and entrusted (not a mistake to be escaped); specific page citation pending user verification',
    'Finch *African Medicine: A Spirit Science Out of the Shadows* — sunu daily examination ritual as the working frame for the Four Treasures pedagogy; specific page citation pending user verification',
    'Pedagogical-quartet transparency: ancient Africana sources also name Akh, Ren, and Sheut — seven in total; Senebty teaches the working four for ages 7-12, with the remaining three deferred to later tiers (per design spec line 138)',
  ],
  // ── Phase 2 v3.51.44 — daily-ritual data per
  // docs/superpowers/specs/2026-05-19-senebty-f2-four-treasures-daily-ritual-design.md
  // Sage: Aset (mother of measure). Per-foundation rotation locked at F2
  // (F1 Mu = sunu Merytamun stayed; F3-F8 follow their named sages).
  // Body-touch gesture per L2 chunk: "The sign IS the gesture" (Carruthers).
  // Stage-1 RT recs 1-10 implemented; Stage-2 Coach audit follows.
  dailyFoundation: {
    doingVeo: "/videos/senebty-foundations/four-treasures-touch.mp4",
    blessingVeo: "/videos/senebty-foundations/four-treasures-blessing-aset.mp4",
    greeting: {
      title: "Today is the Four Treasures",
      subtitle: "Khat, Ib, Ka, Ba — the working four",
      powerWord: "KHAT",
    },
    dailyGesture:
      "Touch each treasure, say its name:\n" +
      "  Khat — palm on chest\n" +
      "  Ib — palm on heart\n" +
      "  Ka — arms lifted to shoulder height, palms forward\n" +
      "  Ba — fingertips at throat\n" +
      "\n" +
      "Then pause. Of the four, which went hungry yesterday? Honor it today.",
    blessingLine: "Seneb, {name}. The four are remembered.",
    // Honor-check button label (Stage-2 Coach C1 — F2 spec §5 verbatim CTA).
    // Engine reads dailyFoundation.honorCheckLabel; falls back to F1's generic
    // "✓ I did this today" copy when absent (F1 Mu does not override).
    honorCheckLabel: "Yes — I touched the four and named the hungry one",
    // microTeachings — each entry carries an explicit quartetTag field
    // ('khat' | 'ib' | 'ka' | 'ba' | 'closer') so the quartet-structure test
    // reads the tag instead of keyword-matching the quote text (which was
    // brittle against spec-verbatim quotes that contain cross-quartet
    // vocabulary, e.g. "Feed your khat" in a Ka quote). Stage-2 Coach Item 1.
    microTeachings: [
      // ── Khat quartet (physical vessel) ───────────────────────────────────
      { quartetTag: 'khat', scholar: "Obenga", quote: "The khat is the physical vessel, holy and entrusted. It is not a mistake to be escaped — it is the place where Maat enters the world through you." },
      { quartetTag: 'khat', scholar: "Obenga", quote: "The Edwin Smith Papyrus opens with the body before it speaks of medicine. The body greeted is the body that becomes a place healing can enter." },
      { quartetTag: 'khat', scholar: "Finch", quote: "The first work of the sunu is greeting the khat. Before any treatment, before any examination, the body is named and listened to. The greeting is the medicine that comes before the medicine." },
      { quartetTag: 'khat', scholar: "Diop", quote: "The khat is a small Nile — the long carrier of Maat that ends in your body. Greet it daily, and you have greeted Maat where Maat lives in you." },
      { quartetTag: 'khat', scholar: "Hilliard", quote: "Children learn the khat by touching it. The body remembers what the mind has not yet named. Palm on chest, name said aloud — this is how the working four enter a child's life." },

      // ── Ib quartet (heart-mind) ──────────────────────────────────────────
      { quartetTag: 'ib', scholar: "Karenga", quote: "The ib is weighed against the feather of Maat daily, not only at the end of life. The daily check is the discipline of the great life lived small." },
      { quartetTag: 'ib', scholar: "Karenga", quote: "The ib is the moral compass. The daily question is not 'did I do right today' alone — it is 'did my ib align with Maat in the small things' — for the small things are where the ib lives." },
      { quartetTag: 'ib', scholar: "Ben-Jochannan", quote: "The ib is the world's oldest conscience. Kemetic heart-mind ethics predate every later moral system. When you greet your ib, you greet the oldest knowing in your body." },
      { quartetTag: 'ib', scholar: "Carruthers", quote: "In Mdw Ntr — Divine Speech — the ib speaks before the mouth speaks. What the mouth says, the ib has already chosen. Greet the ib, and the mouth knows what to say." },
      { quartetTag: 'ib', scholar: "Acholonu", quote: "The heart is the ancestral compass. When the ib aches, the ancestors are speaking through it. Greet the ib and ask what they are trying to tell you." },

      // ── Ka quartet (vital essence) ───────────────────────────────────────
      { quartetTag: 'ka', scholar: "Carruthers", quote: "The ka is named into you by the ancestors. You do not own it — you carry it. When you lift your arms in the ka sign, you are lifting what they gave you." },
      { quartetTag: 'ka', scholar: "Carruthers", quote: "The sign IS the gesture. The Kemetic glyph for ka is two arms lifted — and the practice is to lift two arms. The body teaches the ka by enacting the ka. Children learn the cosmos this way: with the body first, the word after." },
      { quartetTag: 'ka', scholar: "Hilliard", quote: "Children carry the ka of the elders. What the elder does at sunrise, the child does at sunset — and the ka continues. Daily ritual is how ka is handed forward unbroken." },
      { quartetTag: 'ka', scholar: "Diop", quote: "The ka is continuity across the long line. The ancestors eat when you eat. The ancestors lift their arms when you lift yours. Greet the ka, and you greet every one of them." },
      { quartetTag: 'ka', scholar: "Konadu", quote: "The ka eats when you eat. Feed your khat, and you feed every ancestor who walked before you. The daily lifting of the ka sign is a feast the ancestors share." },

      // ── Ba quartet (personality / particular self) ───────────────────────
      { quartetTag: 'ba', scholar: "Obenga", quote: "The ba is named in the breath that carries the voice. The throat is its address. Fingertips at the throat, name said aloud — this is the daily greeting of the unrepeatable self." },
      { quartetTag: 'ba', scholar: "Obenga", quote: "The voice carries ba into the world. When you speak your name, ba is heard. The daily ritual is small only in length — it is the world hearing you remember who you are." },
      { quartetTag: 'ba', scholar: "Welsing", quote: "Africana psychology names the ba as the unrepeatable self. To define yourself in a world that refuses to is the first act of resistance. The daily ba-touch is that resistance in your own body." },
      { quartetTag: 'ba', scholar: "Acholonu", quote: "The ba is the unrepeatable one. No two ba have ever been the same. The world has space for yours — but only if you greet it daily. The world does not invite what is never named." },
      { quartetTag: 'ba', scholar: "Bekerie", quote: "Your name is the world's address for your ba. When the world calls you by name, your ba turns to listen. Greet your ba daily, and you teach it to come when called." },

      // ── Closer (Maat / daily measure across all four) ────────────────────
      { quartetTag: 'closer', scholar: "Karenga", quote: "Maat is the daily check across all four. The discipline of the small daily act is the discipline of the great life. The treasure that went hungry today is the first one to greet tomorrow." },
    ],
  },
};

if (typeof window !== 'undefined') {
  window.Senebty = window.Senebty || {};
  window.Senebty.foundationFourTreasuresStory = FOUNDATION_FOUR_TREASURES;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FOUNDATION_FOUR_TREASURES };
}
