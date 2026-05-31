// senebty/data/foundations/04-mu-streak/story.js
// F4 Mu Streak — water as 21-day discipline (STREAK_IRI)
// Per docs/superpowers/specs/2026-05-04-senebty-v1-finish-design.md
// Tone canon: skills/docs/project/seba-voice-senebty.md
// Power Word MU reused from F1 (M1 RT verdict: HIGH — glyph 𓈗 retained on F4 card).
// "Memory becomes body" is the F4 thematic anchor — present in story prose AND
//   iriCheckpoint.sebaPostIri.
// Africana citations: Diop *Civilization or Barbarism* (Nile/water cosmology),
//   Karenga *Maat*, Obenga *African Philosophy* (Mu) — page-cites pending user
//   verification per M1 RT bindings forward.
//
// Story authored 2026-05-04 per tone canon. Subject to tone-canon RT review at M5.

const FOUNDATION_MU_STREAK = {
  id: 'foundation-4-mu-streak',
  type: 'foundation',
  level: 1,
  powerWord: 'MU',
  semaPair: 'thirst-and-flow',
  giftId: 'cartouche-nile-blue-cup',
  chunks: [
    // ─── L1 ────────────────────────────────────────────────────────────────
    {
      level: 1,
      text: "A girl named Nubia walks into the Per Ankh courtyard before the sun is high. She carries a clay cup in both hands. The cup is small and brown and warm from her palms. The papyrus-basin near the basalt bench holds clean water from the morning drawing. The sycamore-fig tree above the wall is quiet. The sunu Merytamun is on the low mat. She is the same sunu who taught Senka tjau and who taught Tanu the Four Treasures. Nubia kneels on the mat. She does not speak first. She holds the cup. The sunu speaks first. She says, 'Today, Nubia, you learn mu. Mu is the water. Today is the first morning of twenty-one mornings.' Nubia nods. She does not lift the cup yet.",
      vocab: ['Per Ankh', 'sunu', 'mu'],
      sebaIntro: "My dear {name}, this is Nubia. She is your age. She is at the Per Ankh today. The sunu Merytamun will teach her mu — the water — and the count of twenty-one mornings.",
      sebaAfter: "Twenty-one mornings is the iri. Read on, {name}, and watch the sunu speak of mu.",
    },
    {
      level: 1,
      text: "The sunu lifts her own clay cup. She says, 'Mu is the Nile in your khat. Mu is the river the Per Ankh draws from before the sun is high. Diop teaches in his book that the Nile is the long carrier of Maat through the land. The slow water makes the fields. The fields make the bread. The bread makes the body. The same long carrier is in this small cup. The cup is small. The river is long. The water is the same water.' Nubia listens. The sunu says, 'Obenga teaches that mu is named in our oldest words for life. Karenga teaches that the daily working of mu is the daily working of Maat — measured, even, ordered.' Nubia looks down at her cup. The water is still. The sun is not yet over the eastern wall. She breathes slow. The clay is warm in her palms.",
      vocab: ['khat', 'Maat', 'Nile'],
      sebaIntro: "{name}, the sunu names her sources. Diop, Obenga, Karenga — African scholars of Kemet. Listen to what they teach about mu.",
      sebaAfter: "Mu is the Nile in the cup. Diop, Obenga, and Karenga all teach that mu carries Maat. {name}, read on.",
    },
    {
      level: 1,
      text: "Then the sunu says the part Nubia did not expect. She says, 'One cup is one iri. You learned that with mu before. But today is different. Today is the first of twenty-one mornings. Tomorrow you will drink one cup again. The morning after, you will drink one cup again. For twenty-one mornings, you will drink the cup. The body learns by repeating. The Africana sources teach that memory becomes body — that the discipline you do every morning becomes who you are without thinking. The iri is not one cup. The iri is twenty-one cups, one each morning, in a row.' Nubia nods slowly. The number twenty-one is large. But the cup in her hands is small. She thinks of the long Nile and the small cup. She thinks of the slow water that makes the fields. She does not say anything yet.",
      vocab: ['iri', 'discipline', 'repeating'],
      sebaIntro: "{name}, here is the careful part. Listen. The iri is not one cup today. The iri is twenty-one mornings.",
      sebaAfter: "Memory becomes body. That is the F4 teaching. {name}, it is what you do every morning, not just once.",
    },
    {
      level: 1,
      text: "The sunu lifts her cup to her own mouth. She drinks slow. She sets the cup down on the mat. She says, 'Now you, Nubia. Drink slow. The first morning is now. The second morning is tomorrow. The Per Ankh keeps no count for you. Your own body keeps the count. Mu is the carrier of Maat. The cup is the small Nile. Drink.' Nubia lifts the cup. The clay is warm. The water is cool. She drinks slow, the way the sunu drank. She sets the cup down. The first morning is done. Twenty mornings remain. She must do — she must iri. The Per Ankh is listening.",
      vocab: ['iri'],
      sebaIntro: "{name}, the sunu shows the cup first. Then Nubia drinks. Now she must iri — twenty more mornings.",
      sebaAfter: "Nubia has done the first morning. {name}, you can iri with her. One cup now. Then tomorrow. Then twenty-one mornings in a row. Memory becomes body.",
    },
    // ─── L2 ────────────────────────────────────────────────────────────────
    {
      level: 2,
      text: "A girl named Nubia walks into the Per Ankh courtyard at the hour before the sun is high, carrying a small clay cup in both hands. The cup is brown and warm from her palms. The papyrus-basin near the basalt bench holds clean water from the morning drawing — the same water the sunu drew at first light. The sycamore-fig tree above the wall is quiet, only the small birds. The sunu Merytamun is already on the low mat — the same sunu who taught Senka tjau and Tanu the Four Treasures one morning before. Nubia kneels on the mat without speaking. She holds the cup steady. The sunu speaks first, the way the Per Ankh always teaches first. 'Today, Nubia, you learn mu. Mu is the water. And today is the first morning of twenty-one mornings.' Nubia nods. She does not lift the cup yet.",
      vocab: ['Per Ankh', 'sunu', 'mu'],
      sebaIntro: "{name}, the Per Ankh is a working medical school by the river. Merytamun is a sunu — a physician. Today she teaches mu, the water, and the count of twenty-one mornings. Watch how the teaching begins.",
      sebaAfter: "Twenty-one mornings is the iri. Read on, {name}, and watch the sunu speak of mu.",
    },
    {
      level: 2,
      text: "The sunu lifts her own clay cup in both hands. 'Mu,' she says, 'is the Nile in your khat. Mu is the long river the Per Ankh draws from at first light, before the sun is high. Diop teaches in his book *Civilization or Barbarism* that the Nile is the long carrier of Maat through the land — the slow water that makes the fields possible, the fields that make the bread possible, the bread that makes the body possible. The same long carrier is in this small cup. The cup is small. The river is long. The water is the same water.' Nubia listens carefully. The sunu adds, 'Obenga teaches in *African Philosophy* that mu is named in our oldest words for life. Karenga teaches in *Maat* that the daily working of mu is the daily working of Maat — measured, even, ordered.' Nubia looks down at her cup. The water is still.",
      vocab: ['khat', 'Maat', 'Nile', 'cosmology'],
      sebaIntro: "{name}, the sunu names her sources by name. Diop, Obenga, Karenga — three African scholars of Kemet. Each teaches a piece of mu.",
      sebaAfter: "Mu is the Nile in the cup. The scholars are clear: mu is the long carrier of Maat, and the daily cup is the daily working of Maat. {name}, read on.",
    },
    {
      level: 2,
      text: "Then the sunu says the part Nubia did not expect, the part the Per Ankh teaches when a child is ready for the longer working. 'One cup is one iri,' she says. 'You learned that with mu before — F1, the first foundation. But today is a different teaching. Today is the first morning of twenty-one mornings. Tomorrow you will drink one cup again. The morning after that, you will drink one cup again. For twenty-one mornings in a row, you will drink the cup at first light. The body learns by repeating, not by single acts. The Africana sources teach a careful truth: memory becomes body. The discipline you do every morning, without missing, becomes who you are without thinking. After twenty-one mornings, the body remembers on its own. The iri is not one cup, Nubia. The iri is twenty-one cups, one each morning, in a row.' Nubia nods slowly. The number twenty-one is large. But the cup in her hands is small.",
      vocab: ['iri', 'discipline', 'repetition', 'memory'],
      sebaIntro: "{name}, here is the careful F4 teaching. Listen. The iri is not one cup today. The iri is twenty-one mornings, one cup each morning, in a row.",
      sebaAfter: "Memory becomes body — that is the heart of F4. {name}, it is the daily working, not the single act. Twenty-one mornings is how the body learns the discipline.",
    },
    {
      level: 2,
      text: "The sunu lifts her cup to her own mouth and drinks slowly. She sets the cup back down on the mat between them. 'Now you, Nubia. Drink slow, the way I drank. The first morning is now. The second morning is tomorrow. The third morning is the morning after that. The Per Ankh keeps no count for you — your own body keeps the count. Mu is the carrier of Maat. The cup is the small Nile in your hands. Drink.' Nubia lifts the cup. The clay is warm against her palms. The water is cool. She drinks slow, the way the sunu drank — measured, even, ordered, the way Karenga teaches the working of Maat. She sets the cup down. The first morning is done. Twenty mornings remain. She must do — she must iri. The Per Ankh is listening. The papyrus-basin is still.",
      vocab: ['iri', 'Maat'],
      sebaIntro: "{name}, the sunu shows the cup first. Then Nubia drinks. Now she must iri — twenty more mornings, one cup each morning, in a row.",
      sebaAfter: "Nubia has done the first morning. {name}, now you. Drink one cup of water now. Then tomorrow. Then twenty-one mornings in a row. Memory becomes body. The Per Ankh is listening.",
    },
  ],
  comprehensionPool: [
    {
      kind: 'character',
      q: 'Who is the girl in this story?',
      a: 'Nubia',
      distractors: ['Tanu', 'Senka', 'Merytamun'],
    },
    {
      kind: 'setting',
      q: 'Where does the lesson take place?',
      a: 'The Per Ankh courtyard, before the sun is high, by the papyrus-basin and the sycamore-fig tree',
      distractors: ['A temple by the Nile', 'Nubia\'s home', 'The market in Waset'],
    },
    {
      kind: 'vocabulary',
      q: 'What is mu?',
      a: 'The water — the Nile in the cup, the long carrier of Maat',
      distractors: ['The breath', 'The heart-mind', 'The body in motion'],
    },
    {
      kind: 'inference',
      q: 'Why is the F4 iri twenty-one mornings instead of one cup?',
      a: 'Because the body learns by repeating — memory becomes body when the discipline is done every morning, in a row',
      distractors: ['Because one cup is not enough water', 'Because the sunu wants to test Nubia', 'Because twenty-one is a sacred number in the count'],
    },
    {
      kind: 'sequence',
      q: 'What does Nubia do after the sunu finishes speaking?',
      a: 'She lifts the cup, drinks slow the way the sunu drank, and sets the cup down',
      distractors: ['She refuses the cup', 'She runs to the Nile', 'She asks the sunu to drink first'],
    },
    {
      kind: 'maat',
      q: 'According to the sunu, what is the daily working of mu?',
      a: 'The daily working of Maat — measured, even, ordered — as Karenga teaches',
      distractors: ['A test of strength', 'A private ritual no one else can see', 'A way to please the elders'],
    },
    {
      kind: 'inference',
      q: 'Why does the sunu name Diop, Obenga, and Karenga as sources?',
      a: 'Because the Per Ankh names its sources — they are African scholars of Kemet who each teach a piece of mu',
      distractors: ['Because they are Kemetic gods', 'Because they invented the twenty-one-morning count', 'Because they are Nubia\'s family'],
    },
    {
      kind: 'vocabulary',
      q: 'What does "memory becomes body" mean in this lesson?',
      a: 'The discipline done every morning, without missing, becomes who you are without thinking — the body remembers on its own',
      distractors: ['You forget your old self', 'The body grows larger from drinking water', 'You memorize a song about mu'],
    },
  ],
  iriCheckpoint: {
    afterChunk: 3,
    iriType: 'STREAK_IRI',
    daysRequired: 21,
    prompt: 'Drink one cup of water now. Then tomorrow. Then twenty-one mornings in a row. Mu is the small Nile in your cup. The body learns by repeating.',
    evidenceShape: { tapsByDate: 'object<YYYY-MM-DD, boolean>' },
    parentConfirmDefault: false,
    sebaPostIri: 'You have iri. Twenty-one mornings. Memory becomes body.',
  },
  citations: [
    'Diop *Civilization or Barbarism: An Authentic Anthropology* — the Nile as the long carrier of Maat through the land; mu (water) and Nile cosmology as the foundation of Kemetic life; specific page citation pending user verification',
    'Karenga *Maat: The Moral Ideal in Ancient Egypt* — the daily working of mu as the daily working of Maat (measured, even, ordered); discipline and repetition as the body of Maat; specific page citation pending user verification',
    'Obenga *African Philosophy: The Pharaonic Period* — mu named in the oldest Kemetic words for life; high-confidence Power Word per M1 pron sheet; specific page citation pending user verification',
    'Carruthers *Mdw Ntr: Divine Speech* — naming and the daily working as paired sacred acts in the Africana frame; specific page citation pending user verification',
    'F4 thematic anchor (design doc binding): "Memory becomes body" — the body learns sacred discipline through repetition; the iri is twenty-one mornings, not one cup. F1 was one cup; F4 is twenty-one days.',
  ],

  // ── Phase 2 — daily-ritual data
  // Spec: docs/superpowers/specs/2026-05-20-senebty-f4-mu-streak-daily-ritual-design.md
  // Sage: sunu Merytamun (story-locked: F4 chunk-0 names "the same sunu who taught
  // Senka tjau and Tanu the Four Treasures" — cluster-locked F1 + F3 + F4).
  // Hybrid-Veo-reuse pattern (sanctioned by spec §3 + §12):
  //   doingVeo = NEW mu-streak-morning.mp4 (Nubia + cup-tally, F4 distinctive)
  //   blessingVeo = REUSED F1's mu-blessing-sunu.mp4 (Merytamun nod + ankh-lift)
  // blessingLine = F1's "Seneb, {name}. The body remembers." — DELIBERATE CONTINUITY.
  //   F4's theme IS "memory becomes body"; reusing the F1 blessing Veo means reusing
  //   the matching blessing line is correct, not a copy-paste error. See spec §4 note.
  // Quartet: cup / repetition / memory-body / streak / closer (5+5+5+5+1).
  // Stage-1 RT recs 1-10 implemented. Stage-2 Coach audit follows.
  dailyFoundation: {
    doingVeo: "/videos/senebty-foundations/mu-streak-morning.mp4",
    blessingVeo: "/videos/senebty-foundations/mu-blessing-sunu.mp4",   // REUSED from F1
    greeting: {
      title: "Today is Mu — the Streak",
      subtitle: "Water, twenty-one mornings — memory becomes body",
      powerWord: "MU",
    },
    dailyGesture:
      "Drink one cup of clean water, slowly.\n" +
      "This is one morning of twenty-one.\n" +
      "\n" +
      "Your body keeps the count, not the Per Ankh.\n" +
      "Memory becomes body.",
    blessingLine: "Seneb, {name}. The body remembers.",
    honorCheckLabel: "Yes — I drank this morning's cup",
    microTeachings: [
      // ── cup quartet (the cup as the small Nile — mu carries Maat) ────────
      {
        quartetTag: "cup",
        scholar: "Diop",
        quote: "The Nile is the long carrier of Maat through the land. The cup in your hand is the small Nile — the same water, the same discipline, carried closer. When you drink one cup each morning, you carry what the Nile carries.",
      },
      {
        quartetTag: "cup",
        scholar: "Diop",
        quote: "Africana civilization is built on the Nile the way a house is built on its foundation. Mu — water — is not a background element. It is the first element. The cup holds the first element. Drinking it each morning is not small.",
      },
      {
        quartetTag: "cup",
        scholar: "Obenga",
        quote: "Mu is named in the oldest Kemetic words for life. Before the name for food, before the name for fire, there is the name for water. The cup carries the oldest name. Each morning you touch the oldest thing.",
      },
      {
        quartetTag: "cup",
        scholar: "Karenga",
        quote: "Maat is carried in practice, not in theory. The cup of water is one practice — small, daily, measured. A small act done with attention is a Maat act. The cup is small. The Maat in it is not.",
      },
      {
        quartetTag: "cup",
        scholar: "Bekerie",
        quote: "The Ethiopic frame: water given to the self in the morning is water offered to the day. You receive it; you offer it. The cup moves in two directions at once. Drinking is a form of giving.",
      },

      // ── repetition quartet (the body learns by repeating, not by single acts) ──
      {
        quartetTag: "repetition",
        scholar: "Karenga",
        quote: "The daily working of Maat is not done in one grand act. It is done in the small acts repeated — measured, even, ordered. The cup of water each morning is Maat repeated. Repetition is not habit. Repetition is the form Maat takes in a body.",
      },
      {
        quartetTag: "repetition",
        scholar: "Karenga",
        quote: "What is done once is a gesture. What is done daily is a life. The sunu does not measure a child by one morning — she measures by the long practice. Twenty-one mornings is one practice. The practice is the whole teaching.",
      },
      {
        quartetTag: "repetition",
        scholar: "Hilliard",
        quote: "Children learn by doing. Not by being told, not by reading — by doing, and then by doing again. One cup each morning teaches the body what a cup of water means. The body will know this before the mind explains it.",
      },
      {
        quartetTag: "repetition",
        scholar: "Hilliard",
        quote: "The daily return to a practice is itself the lesson. Returning is not redundant — returning is how a child's body learns that the practice is real. Twenty-one mornings of returning teaches that mu is worth returning to.",
      },
      {
        quartetTag: "repetition",
        scholar: "Carruthers",
        quote: "In the Mdw Ntr tradition, the repeated act is the sacred act. One utterance is a sound. The same utterance repeated at dawn each day becomes prayer. The cup repeated each morning becomes something the body understands as holy.",
      },

      // ── memory-body quartet (memory becomes body — the anchor) ────────────
      {
        quartetTag: "memory-body",
        scholar: "Diop",
        quote: "Africana civilization lives in the body of the people, not only in the books. What the ancestors did daily, the descendants carry in the body without knowing why. Memory becomes body. That is how civilizations survive.",
      },
      {
        quartetTag: "memory-body",
        scholar: "Obenga",
        quote: "The oldest Kemetic frame: the body is the keeper of what the mind forgets. Mu moves through the body daily; the body remembers what water means even when the word is lost. The body is the oldest library.",
      },
      {
        quartetTag: "memory-body",
        scholar: "Hilliard",
        quote: "When a child does the same act every morning for twenty-one days, the act enters the body. The child no longer decides to do it — the body begins to reach for it. That is not automation. That is the body carrying the teaching.",
      },
      {
        quartetTag: "memory-body",
        scholar: "Acholonu",
        quote: "Ancestral memory lives in water. The water you drink carries what every ancestor drank before you. The body that drinks it each morning is receiving the memory the water holds. This is the oldest form of inheritance.",
      },
      {
        quartetTag: "memory-body",
        scholar: "Konadu",
        quote: "Akan wisdom: the body is the elder's voice when the elder is gone. What the elder taught the body, the body teaches the grandchild without words. Twenty-one mornings of mu enters the body. The body will teach it forward.",
      },

      // ── streak quartet (the 21-morning count; the body keeps it) ─────────
      {
        quartetTag: "streak",
        scholar: "Karenga",
        quote: "The twenty-one-morning count is not the Per Ankh's count. It is the body's count. The body marks each morning a cup is drunk. The body marks each morning a cup is missed. The Per Ankh only asks. The body already knows.",
      },
      {
        quartetTag: "streak",
        scholar: "Carruthers",
        quote: "Sacred daily practice builds the sacred life. The Mdw Ntr teaching: the words spoken each morning at the same hour carry more weight than the words spoken once at high occasion. Twenty-one mornings is twenty-one sacred acts. They compound.",
      },
      {
        quartetTag: "streak",
        scholar: "Bekerie",
        quote: "Small ceremonies build the life. The morning cup is a small ceremony — one minute, one act, one direction of attention. Twenty-one small ceremonies is a practice. A practice is a life taking shape. Do not call the cup small.",
      },
      {
        quartetTag: "streak",
        scholar: "Acholonu",
        quote: "Each morning that you drink the cup, you say yes to the ancestor who first named water sacred. Each morning you miss, you say nothing. The count is not about discipline alone — it is about which voice in you speaks each morning.",
      },
      {
        quartetTag: "streak",
        scholar: "Konadu",
        quote: "Water is the first ancestor in Akan cosmology — older than the land, older than the people. The streak of twenty-one mornings is twenty-one greetings to the first ancestor. The body that completes the streak has greeted the ancestor twenty-one times.",
      },

      // ── closer (the completed streak — the body remembers on its own) ─────
      {
        quartetTag: "closer",
        scholar: "Karenga",
        quote: "Maat is the daily check. The morning you wake and your body reaches for the cup before your mind has decided — that is the teaching complete. The body remembers. That is what twenty-one mornings was for. Not the count. The body.",
      },
    ],
  },
};

if (typeof window !== 'undefined') {
  window.Senebty = window.Senebty || {};
  window.Senebty.foundationMuStreakStory = FOUNDATION_MU_STREAK;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FOUNDATION_MU_STREAK };
}
