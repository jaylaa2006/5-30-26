// senebty/data/foundations/08-heka/story.js
// F8 Heka — speech that creates reality / TEACHING_IRI / personal Heka phrase
// Per docs/superpowers/specs/2026-05-04-senebty-v1-finish-design.md
// Tone canon: skills/docs/project/seba-voice-senebty.md
// Heka phrase composition tool already shipped via senebty/lib/heka-phrase.js
//   (M1 Task 7 commit 4832a79). F8's iri-completion seal points to that
//   existing CRUD — child + parent compose the personal phrase together
//   via window.Senebty.hekaPhrase.set(). M3 Task 6 ships story + module
//   surface only; the composition modal lives in heka-phrase.js already.
//
// Karenga binding (Maat): Heka is authoritative speech — speech that creates
//   reality. The first speaking is the first making. Heka is M1 RT HIGH;
//   glyph 𓎛𓂓𓄿 retained on the Foundations index card (do NOT empty).
// Carruthers binding (Mdw Ntr): speech as cosmic force — to speak truly is
//   to call a thing into the world.
// Obenga binding (African Philosophy: The Pharaonic Period): the spoken word
//   in pharaonic thought as a creative principle of cosmic order.
//
// Setting: mixed — Per Ankh courtyard for the lesson, child's home for the
//   teaching. Sunu Merytamun introduces Heka at the Per Ankh; the child
//   carries the practice home and teaches a parent.
// Child protagonist: Kahotep (new Kemetic name; not Khaemwaset / Tanu /
//   Senka / Nubia / Ahmose / Iry).
// Power Word taught at home: SENEB (from F4-line / Foundation-Treasures).
//
// Story authored 2026-05-04 per tone canon. Subject to tone-canon RT review at M5.

const FOUNDATION_HEKA = {
  id: 'foundation-8-heka',
  type: 'foundation',
  level: 1,
  powerWord: 'HEKA',
  semaPair: 'word-and-deed',
  giftId: 'tool-heka-phrase-composition',
  chunks: [
    // ─── L1 ────────────────────────────────────────────────────────────────
    {
      level: 1,
      text: "A boy named Kahotep sits in the Per Ankh courtyard at midmorning. Sunu Merytamun stands at the head of the lesson mat. Kahotep has learned mu. He has learned tjau. He has learned hesi. Today the sunu lifts her hand for quiet. She says, 'Today, children, I will teach you Heka.' Kahotep sits up straight. The sunu says, 'Karenga, an African scholar of Maat, teaches that Heka is authoritative speech. Heka is speech that creates reality. The word, said true, makes a thing in the world.' Kahotep listens with his whole body.",
      vocab: ['Per Ankh', 'sunu', 'Heka'],
      sebaIntro: "My dear {name}, this is Kahotep. He is your age. He sits at the Per Ankh today to learn Heka. The sunu Merytamun is about to teach.",
      sebaAfter: "Heka is speech that creates reality, {name}. Karenga teaches it so. The word, said true, makes a thing in the world. Read on.",
    },
    {
      level: 1,
      text: "Sunu Merytamun says, 'I will show you. Watch the room.' She looks at a small girl on the mat who has been crying quietly all morning. The girl's face is turned down. The sunu says one careful sentence. 'Henut, you carried your sister to the river this morning, and that was a good carrying.' The small girl lifts her face. Her eyes change. Her shoulders open. The room changes too. Kahotep sees it. The sunu says, 'That is Heka. One true sentence, said with care, made the room new. Carruthers teaches that the speaking of a true word and the making of a true thing are the same working. Speech is making.'",
      vocab: ['authoritative', 'sentence'],
      sebaIntro: "{name}, the sunu shows Heka by speaking. Watch the small girl's face. Watch the room change. Listen.",
      sebaAfter: "One true sentence made the room new, {name}. Speech is making. Carruthers teaches it so. Read on.",
    },
    {
      level: 1,
      text: "Sunu Merytamun says, 'Now you. Heka is not for the Per Ankh alone. The pharaoh speaks Heka at the temple. The mother speaks Heka at the cooking fire. The child speaks Heka at home. Obenga teaches that the spoken word in our old thought is a creative principle — it holds the cosmic order. Tonight, when you go home, teach. Take one Power Word you have learned — SENEB, KHAT, SENEDJEM — and teach it to someone in your house. Tell them what it means. Show them how to say it. Then come back and tell me who listened.' Kahotep nods. He thinks of his mother. He thinks of SENEB. Tonight, he will give it.",
      vocab: ['cosmic', 'principle'],
      sebaIntro: "{name}, the sunu sends the children home. Heka is not only for the Per Ankh. Listen to the assignment.",
      sebaAfter: "Kahotep will teach SENEB to his mother tonight, {name}. The word goes out into the world. That is Heka. Read on.",
    },
    {
      level: 1,
      text: "At evening Kahotep sits with his mother on the mat. The lamp is low. He says, 'Mother, today the sunu taught Heka. She said the word, said true, makes a thing in the world. I will teach you SENEB.' His mother sets down her bowl. She turns her face to him fully. She listens. Kahotep says, 'SENEB means health. The whole health. Not only the body. The body and the breath and the work and the family — the whole standing-strong of a person. The sunu says SENEB is the word the pharaoh's people sent on every letter. SENEB to you.' His mother nods. She says the word back. SENEB. Kahotep shows her how to say it slow, from the chest. She says it again. SENEB.",
      vocab: ['SENEB', 'standing-strong'],
      sebaIntro: "{name}, the day has closed. Kahotep is at home now. He sits with his mother. He is about to teach. Listen.",
      sebaAfter: "His mother said it back, {name}. SENEB. The word has gone out. That is Heka — speech that creates reality. Read on.",
    },
    {
      level: 1,
      text: "Kahotep's mother holds his hand. She says, 'Tomorrow you will tell the sunu I listened. And one more thing. Tonight, you and I will compose a Heka phrase together. One sentence, our own, said true — for our house. The sunu would call that the personal Heka phrase.' Kahotep's eyes open wide. He has heard older children speak of the personal phrase. He says, 'Yes, mother.' Together they begin. They speak slow. They choose each word. They say the sentence aloud once, then again, then a third time so the room holds it. Kahotep must do — he must iri. He has taught one Power Word. The voice has gone out into the world. He says the lesson word slow. HEKA. His mother says it with him. HEKA.",
      vocab: ['HEKA', 'compose'],
      sebaIntro: "{name}, this is the iri. Kahotep teaches. His mother listens. Then they compose the personal Heka phrase together. Watch.",
      sebaAfter: "The voice has gone out, {name}. The word is in the world now. Tonight you too will teach one Power Word at home. Then with your parent, compose your Heka phrase. The Per Ankh sees you.",
    },
    // ─── L2 ────────────────────────────────────────────────────────────────
    {
      level: 2,
      text: "A boy named Kahotep sits in the Per Ankh courtyard at midmorning, on the woven palm mat with the other children of his lesson group. The sun is high on the white wall above the colonnade and the air smells faintly of the river beyond the temple wall. Sunu Merytamun stands at the head of the lesson mat in her plain linen, the way she always does. Kahotep has come to the Per Ankh many times now across the seasons. He has learned mu — the daily water. He has learned tjau — the four-count breath. He has learned hesi — the trained voice. Today the sunu lifts her hand for quiet, and the children settle. 'Today, children,' she says, 'I will teach you Heka.' The other children sit up straight on the mat. Kahotep sits up straight too. 'Karenga, an African scholar of Maat, teaches in his book that Heka is authoritative speech. Heka is speech that creates reality. The word, said true, makes a thing in the world. That is the teaching for today.' Kahotep listens with his whole body, the way Merytamun has taught him to listen.",
      vocab: ['Per Ankh', 'sunu', 'Heka', 'colonnade'],
      sebaIntro: "{name}, Kahotep is at the Per Ankh today. The sunu Merytamun is about to teach Heka — speech that creates reality. Listen as the lesson begins.",
      sebaAfter: "Heka is speech that creates reality, {name}. Karenga teaches it so. The word, said true, makes a thing in the world. Read on.",
    },
    {
      level: 2,
      text: "'I will show you,' the sunu says. 'Watch the room as I speak. Watch what one true sentence can do.' She breathes slow, the way she taught the children to breathe in the tjau lesson. She turns her gaze to a small girl on the mat who has been crying quietly all morning, her face turned down toward her knees. Sunu Merytamun says one careful sentence. She says, 'Henut, you carried your sister to the river this morning, and that was a good carrying.' The small girl lifts her face. Her eyes change first, then her shoulders open. The crying stops. The room changes around her too — the other children see it on her face and the air feels different on the mat. Kahotep sees it clearly. The sunu turns back to the lesson and says, 'That is Heka. One true sentence, said with care, made the room new. Carruthers teaches in his book that the speaking of a true word and the making of a true thing are the same working — speech is craft, speech is making. The word built something in the room that was not there before.'",
      vocab: ['authoritative', 'sentence', 'craft'],
      sebaIntro: "{name}, the sunu shows Heka by speaking — not by explaining. Watch the small girl's face. Watch the room change around her.",
      sebaAfter: "One true sentence made the room new, {name}. Speech is making. Carruthers teaches it so. Read on.",
    },
    {
      level: 2,
      text: "Sunu Merytamun looks around the mat at each child in turn. 'Now you,' she says. 'Heka is not for the Per Ankh alone. The pharaoh speaks Heka at the temple. The mother speaks Heka at the cooking fire. The scribe speaks Heka over the papyrus. The child speaks Heka at home. Obenga teaches in his book on African philosophy that the spoken word in our old pharaonic thought is a creative principle — it holds the cosmic order. Tonight, when you go home, you will teach. Take one Power Word you have already learned at the Per Ankh — SENEB, KHAT, SENEDJEM, any one of the words you carry — and teach it to someone in your house. A parent. An older sister. A grandfather. Tell them what the word means. Show them how to say it slow. Then come back tomorrow and tell me who listened, and what they said when they heard you.' Kahotep nods slowly. He thinks of his mother first, the way her hands move when she is working. He thinks of SENEB. He has carried that word a long time. Tonight, he will give it.",
      vocab: ['cosmic', 'principle', 'papyrus'],
      sebaIntro: "{name}, the sunu sends the children home with the assignment. Heka is not only for the Per Ankh — it is for the cooking fire, the front room, the mat at home. Listen.",
      sebaAfter: "Kahotep will teach SENEB to his mother tonight, {name}. The word goes out into the world. That is Heka. Read on.",
    },
    {
      level: 2,
      text: "At evening Kahotep sits with his mother on the mat in the front room of their home. The oil lamp is low on the small table. The day's work is finished. He has been holding the lesson all the way home from the Per Ankh and now the lamp is lit and the room is still. 'Mother,' he says, 'today the sunu taught Heka. She said the word, said true, makes a thing in the world. She told us to teach a Power Word at home tonight. I will teach you SENEB.' His mother sets down the bowl she has been holding. She turns her face to him fully — the way Merytamun turns her face to a child at the Per Ankh. She listens. Kahotep says, 'SENEB means health, mother. The whole health. Not only the body. The body and the breath and the work and the family — the whole standing-strong of a person at once. The sunu says SENEB is the word the pharaoh's people sent on every letter and every greeting. SENEB to you. Health to you.' His mother nods slowly. She says the word back to him. SENEB. Kahotep shows her how to say it slow, from the chest, the way the sunu says Power Words at the Per Ankh. She says it again, more careful. SENEB. The room is quiet. The lamp is steady. Something has happened that was not there before.",
      vocab: ['SENEB', 'standing-strong', 'greeting'],
      sebaIntro: "{name}, the day has closed. Kahotep is at home now. He sits with his mother on the mat. He is about to teach SENEB. Listen.",
      sebaAfter: "His mother said it back, {name}. SENEB. The word has gone out into the world. That is Heka — speech that creates reality. Read on.",
    },
    {
      level: 2,
      text: "Kahotep's mother holds his hand on the mat for a long moment. She says, 'Tomorrow you will tell the sunu Merytamun that I listened. And one more thing tonight, Kahotep. Tonight, you and I will compose a Heka phrase together. One sentence, our own, said true — for our house, in our voices. The sunu would call that the personal Heka phrase. The Per Ankh has a place for it.' Kahotep's eyes open wide. He has heard the older children at the Per Ankh speak of this — the personal phrase, the one each family makes for itself. He says, 'Yes, mother.' Together they begin. They speak slow. They choose each word with care, the way the sunu chose each word for Henut this morning. They say the sentence aloud once, then again, then a third time so the room and the lamp and the night hold it. Kahotep must do — he must iri. He has taught one Power Word. He has heard his parent say it back. The voice has gone out into the world. He says the lesson word slow now, from the chest. HEKA. His mother says it with him. HEKA. The making-sweet of the day is sealed by speech.",
      vocab: ['HEKA', 'compose', 'Maat'],
      sebaIntro: "{name}, this is the iri. Kahotep teaches. His mother listens. Then together they compose the personal Heka phrase. Watch.",
      sebaAfter: "The voice has gone out, {name}. The word is in the world now. Karenga, Carruthers, Obenga — three African scholars name what Kahotep has done. Tonight you too will teach one Power Word at home. Then with your parent, compose your Heka phrase. The Per Ankh sees you.",
    },
  ],
  comprehensionPool: [
    {
      kind: 'character',
      q: 'Who is the boy in this story?',
      a: 'Kahotep',
      distractors: ['Khaemwaset', 'Ahmose', 'Senka'],
    },
    {
      kind: 'character',
      q: 'Who teaches Heka at the Per Ankh?',
      a: 'Sunu Merytamun',
      distractors: ['Kahotep\'s mother', 'A scribe at the temple', 'A grandfather at home'],
    },
    {
      kind: 'vocabulary',
      q: 'What does Karenga teach Heka means?',
      a: 'Authoritative speech — speech that creates reality; the word, said true, makes a thing in the world',
      distractors: ['A song sung at the temple', 'A magic spell only the pharaoh can speak', 'A name for the morning prayer'],
    },
    {
      kind: 'setting',
      q: 'Where does the lesson begin, and where does the iri happen?',
      a: 'The lesson begins at the Per Ankh courtyard at midmorning; the iri happens at home in the evening with Kahotep\'s mother',
      distractors: ['Both happen at the Per Ankh', 'Both happen at the temple', 'Both happen at the cooking fire'],
    },
    {
      kind: 'sequence',
      q: 'Which Power Word does Kahotep teach his mother?',
      a: 'SENEB — the whole standing-strong of a person; body, breath, work, and family',
      distractors: ['HEKA', 'KHAT', 'SENEDJEM'],
    },
    {
      kind: 'inference',
      q: 'Why does the sunu show Heka by speaking to Henut instead of explaining?',
      a: 'Because Heka is making, not explaining — one true sentence, said with care, made the room new for Henut',
      distractors: ['Because the children were not listening', 'Because explaining is forbidden at the Per Ankh', 'Because the sunu had no more words for the lesson'],
    },
    {
      kind: 'maat',
      q: 'According to Carruthers and Obenga, why is speech a working of Maat?',
      a: 'Carruthers teaches that speaking a true word and making a true thing are the same working — speech is craft. Obenga teaches that the spoken word is a creative principle that holds the cosmic order.',
      distractors: ['Because only the pharaoh can speak Maat', 'Because Maat requires silence', 'Because words and deeds are unrelated'],
    },
    {
      kind: 'inference',
      q: 'What do Kahotep and his mother do together at the iri close?',
      a: 'They compose a personal Heka phrase together — one sentence in their own voices, said three times so the room holds it',
      distractors: ['They go to the Per Ankh together', 'They write the sentence on papyrus and bury it', 'They send the sentence to the pharaoh'],
    },
  ],
  iriCheckpoint: {
    afterChunk: 4,
    iriType: 'TEACHING_IRI',
    prompt: 'Teach one Power Word to someone in your house. Tell them what it means. Show them how you say it. Then come back and tell me who listened.',
    evidenceShape: { taughtTo: 'string', wordTaught: 'string', parentDescription: 'string' },
    parentConfirmDefault: true,
    sebaPostIri: 'You have iri. The voice has gone out into the world. You are no longer only listening — you are speaking. Tonight, with your parent, compose your Heka phrase. The Per Ankh sees you.',
  },
  citations: [
    'Karenga *Maat: The Moral Ideal in Ancient Egypt* — Heka as authoritative speech, speech that creates reality (M1 RT HIGH verdict on Heka glyph 𓎛𓂓𓄿; Karenga binding pivotal). Specific page citation pending user verification',
    'Carruthers *Mdw Ntr: Divine Speech* — speech as cosmic force; the speaking of a true word and the making of a true thing as the same Maat-working. Specific page citation pending user verification',
    'Obenga *African Philosophy: The Pharaonic Period* — the spoken word in pharaonic thought as a creative principle of cosmic order. Specific page citation pending user verification',
  ],

  // ── Phase 2 — daily-ritual data
  // Spec: docs/superpowers/specs/2026-05-20-senebty-f8-heka-daily-ritual-design.md
  // Stage-1 RT: docs/superpowers/round-tables/2026-05-20-f8-heka-stage1-rt.md
  //
  // F8 is the LAST Phase-2 foundation. When F8 ships (all 21 microTeachings complete),
  //   _isComplete('heka') === true and COMPLETE_SLUGS goes 7→8, unblocking task #8
  //   (flip the A/B gate default ON for all 8 foundations — a separate ship).
  //
  // Sage: sunu Merytamun — Per Ankh (F8 chunks 0-2). Authentic: she introduces Heka
  //   at the Per Ankh; Kahotep carries it home to teach his mother (chunks 3-4).
  //   Wing sage map: F1 Merytamun, F2 Aset, F3 Merytamun, F4 Merytamun (reuse F1),
  //   F5 Merytamun, F6 Merytamun (reuse F1), F7 Tameri (new), F8 Merytamun (new — 4th).
  //
  // 2-new-Veo (spec §4):
  //   doingVeo    = NEW heka-speak.mp4 (Kahotep solo, speaking a true word — RITUAL-DEMONSTRATION)
  //   blessingVeo = NEW heka-blessing-sunu.mp4 (Merytamun nod + ankh-lift — AMBIENT-RITUAL,
  //                 4th Merytamun blessing; byte-consistent with F3/F5 tjau/wedeha-blessing-sunu)
  //   Different subjects (Kahotep vs Merytamun) → no pair byte-identity; instead
  //   Merytamun-match-F3/F5 assertion in the Veo lint test (Task 4).
  //
  // SCHEDULER/CRUD-FREE (spec §2 + Stage-1 RT Rec 1):
  //   The deep TEACHING_IRI (teach-at-home + compose-phrase; 14-day scheduler;
  //   pending_teaching_iri SQLite table; Web Push + SendGrid; Day-7 reminder +
  //   Day-14 auto-advance; confirm-token endpoint; Heka-phrase CRUD M3) stays in
  //   the chunk-reading iriCheckpoint above, UNTOUCHED. This dailyFoundation block
  //   has ZERO scheduler/pending_teaching_iri/TEACHING_IRI/CRUD/confirm-token/push
  //   references. The daily honor is a button press (dailyFoundationLog[date]) only.
  //
  // ROTATION STATUS: IN rotation (Task 3 shipped 21 microTeachings 2026-05-20).
  //   daily-foundation-gate.js FOUNDATION_ORDER[7] = 'heka'; the 21 microTeachings
  //   make _isComplete('heka') === true. F8 Stage-2 Coach mechanically verified
  //   (vm sandbox): _isComplete('heka') === true, _completeFoundations() returns
  //   all 8 (mu … heka), the 8-day intro sequence ends in heka, and emptying the
  //   microTeachings flips _isComplete('heka') back to false (empty-flip teeth).
  //   COMPLETE_SLUGS 7→8 — the wing is complete; task #8 (A/B flip) is unblocked.
  //
  // Quartet: speech / teaching / true-word / cosmic-order / closer (5+5+5+5+1).
  // Stage-1 RT Recs 1, 7 (partial) implemented here (Task 2).
  // Recs 2-6, 10 land in Task 3 (21 microTeachings + gate-test COMPLETE_SLUGS 7→8).
  // Recs 8, 9 land in Task 4 (Veo prompts + lint tests).
  dailyFoundation: {
    experienceType: "affirmation",
    hekaAllowCustom: true,
    hekaTrueWords: [
      "I weigh what I'm told against Maat before I let it weigh on me.",
      "I am not what the screen sells me — I am what my actions make true.",
      "When many voices shout, I listen for the one that holds truth.",
      "I read the world closely, the way a scribe reads; nothing true fears a careful eye.",
      "What is permitted is not always just — I measure power by the scale, not by its volume.",
      "I will not call a crooked thing straight because a loud voice tells me to.",
      "Justice is not handed to me; it is kept by me, in small choices, daily.",
      "I carry my strength and my gentleness on the same scale, and I keep it level.",
      "I can be certain and still stay open — balance is not weakness, it is mastery.",
      "Like the flood, hard seasons rise and recede; I am not the worst day I am living.",
      "The sun dies each dusk and is reborn each dawn — so can I begin again.",
      "Nothing that grows skips its seasons, so I let mine take their time.",
      "Endings are turns in the circle, not the edge of a cliff.",
      "My gifts are not mine alone; I grow them to give them back.",
      "I rise highest when I lift with my people, not above them.",
      "I follow what sets my heart alight, and I aim that fire toward my community.",
      "One reed bends; a bound bundle holds — and I belong to a bundle.",
      "Despair is a liar that calls itself realism; I do not sign my name to its story.",
      "I choose hope as a discipline, not a mood — I practice it even on heavy days.",
      "I speak life over my own name today, and my word becomes my world.",
    ],
    doingVeo: "/videos/senebty-foundations/heka-speak.mp4",
    blessingVeo: "/videos/senebty-foundations/heka-blessing-sunu.mp4",
    greeting: {
      title: "Today is Heka",
      subtitle: "Speech that creates reality — one true word makes a thing in the world",
      powerWord: "HEKA",
    },
    dailyGesture:
      "Heka is speech that creates reality.\n" +
      "Today, speak ONE true, kind sentence to someone in your house —\n" +
      "name something good they did, and say it true.\n" +
      "\n" +
      "One true sentence, said with care, makes the room new.",
    blessingLine: "Seneb, {name}. Your true word went out into the world.",
    honorCheckLabel: "Yes — I spoke one true sentence today",
    microTeachings: [
      // ── speech quartet (Heka is authoritative speech; speech creates reality; the word said true makes a thing) ──
      // Spec §6: Karenga×2, Obenga×1, Diop×1, Bekerie×1 = 5
      {
        quartetTag: "speech",
        scholar: "Karenga",
        quote: "Karenga teaches that Heka is authoritative speech — not decoration, not noise, but speech that carries the weight of truth behind it. In the Kemetic moral frame, every word spoken with care is a creative act. The word said true makes a thing in the world that was not there before.",
      },
      {
        quartetTag: "speech",
        scholar: "Karenga",
        quote: "In Maat, Karenga teaches, the spoken word is a moral instrument. Heka is the power of authoritative speech — the word said with intention, precision, and care. A child who speaks one true sentence has enacted Heka. That sentence goes out into the world and changes what it touches.",
      },
      {
        quartetTag: "speech",
        scholar: "Obenga",
        quote: "Obenga teaches that in pharaonic thought the spoken word was understood as a generative force — not metaphor, but a philosophical account of how human speech organizes reality. To speak a thing truly is to bring it into ordered existence. Heka names that capacity in every speaker who speaks with care.",
      },
      {
        quartetTag: "speech",
        scholar: "Diop",
        quote: "Diop teaches that Africana civilization understood speech and action as inseparable. A word spoken in the community was an act that carried consequence. Heka is that understanding given a name — the authoritative word that does not merely describe the world but shapes it.",
      },
      {
        quartetTag: "speech",
        scholar: "Bekerie",
        quote: "Bekerie teaches that the Ethiopic tradition holds the spoken word as a bridge between the one who speaks and the world that receives. A true word said with care is not private — it crosses the space between speaker and listener and makes something new in that crossing. Heka is that crossing, named.",
      },

      // ── teaching quartet (teaching IS Heka; the word goes out into the world; teach what you know at home) ──
      // Spec §6: Hilliard×2, Karenga×1, Acholonu×1, Diop×1 = 5
      // Note: Konadu (new wing voice excluded per Stage-1 RT) replaced with Diop,
      //   resolving the spec-summary 22→21 off-by-one; Diop total = 3 (speech + teaching + true-word).
      {
        quartetTag: "teaching",
        scholar: "Hilliard",
        quote: "Hilliard teaches that children learn by teaching. When a child explains a word to a parent — showing how to say it, telling what it means — the child's own understanding deepens. That is Heka: the word given to another goes out into the world and returns to the giver stronger.",
      },
      {
        quartetTag: "teaching",
        scholar: "Hilliard",
        quote: "When Kahotep teaches SENEB to his mother at home, Hilliard would say, he is doing the highest Africana pedagogy — not waiting until he is grown to contribute, but handing the knowledge forward now, in the ordinary kitchen, at the ordinary lamp. Teaching at home is Heka at its most honest.",
      },
      {
        quartetTag: "teaching",
        scholar: "Karenga",
        quote: "Karenga teaches that in the Maat tradition, knowledge is not held — it is carried forward. The child who teaches a parent has taken what the community gave and returned it with care. That returning is authoritative speech: Heka enacted not at the temple but at the family mat.",
      },
      {
        quartetTag: "teaching",
        scholar: "Acholonu",
        quote: "Acholonu finds in ancestral African knowing that the teaching bond between child and parent runs both directions. When a child teaches something true, the parent receives it — and the family's store of knowing grows. Heka at home is the community teaching itself from the inside out.",
      },
      {
        quartetTag: "teaching",
        scholar: "Diop",
        quote: "Diop teaches that Africana civilization passed its most important knowledge within the family household, not only in formal schools. The child who brings a Power Word home and teaches it at the evening lamp is practicing what Diop documents: the family as the first institution of learning.",
      },

      // ── true-word quartet (speaking a true word = making a true thing; the true sentence makes the room new) ──
      // Spec §6: Carruthers×2, Finch×1, Diop×1, Bekerie×1 = 5
      {
        quartetTag: "true-word",
        scholar: "Carruthers",
        quote: "Carruthers teaches in Mdw Ntr that the spoken true word is not a description of reality after the fact — it is the making of reality. To speak a true word is to call a thing into ordered existence. The sentence said true over another person changes what that person carries forward.",
      },
      {
        quartetTag: "true-word",
        scholar: "Carruthers",
        quote: "In the Mdw Ntr tradition, Carruthers teaches, word and thing are not separate categories. The true name of a thing is that thing in speech. When Sunu Merytamun said one true sentence to Henut, the room changed — not by accident but by the Kemetic principle that a true word makes a true thing.",
      },
      {
        quartetTag: "true-word",
        scholar: "Finch",
        quote: "Finch teaches that Kemetic medicine understood the true word as healing. A sunu who named what was good in a patient, named it accurately and with care, was practicing Heka — speech that made the good more real. The true sentence about a person is itself a medicine.",
      },
      {
        quartetTag: "true-word",
        scholar: "Diop",
        quote: "Diop teaches that in ancient African societies, the spoken affirmation of a person's worth was a communal act with real effect. A child who names something good another person did, and says it true, raises that person's standing. The true word does not flatter — it names what is already there, and in naming it, strengthens it.",
      },
      {
        quartetTag: "true-word",
        scholar: "Bekerie",
        quote: "Bekerie teaches that the Ethiopic tradition regards honest speech as a form of care for the world. A true word said with intention is not passive — it is active tending of the community's moral fabric. When a child speaks one true, kind sentence today, that child is tending the world Bekerie describes.",
      },

      // ── cosmic-order quartet (the spoken word as a creative principle that holds the cosmic order; pharaoh/mother/child all speak Heka) ──
      // Spec §6: Obenga×2, Carruthers×1, Hilliard×1, Acholonu×1 = 5
      {
        quartetTag: "cosmic-order",
        scholar: "Obenga",
        quote: "Obenga teaches that in pharaonic thought the spoken word was a creative principle of cosmic order — not magic, but the philosophical recognition that organized speech organizes reality. Heka is the name for that principle: the word that holds the world in order because it describes the world truly.",
      },
      {
        quartetTag: "cosmic-order",
        scholar: "Obenga",
        quote: "The pharaoh spoke Heka at the temple. The mother spoke Heka at the cooking fire. The child speaks Heka at home. Obenga teaches that this is not a hierarchy of importance — it is the same cosmic principle at different scales. The child's true sentence is as much a holding of order as the pharaoh's ceremony.",
      },
      {
        quartetTag: "cosmic-order",
        scholar: "Carruthers",
        quote: "Carruthers teaches that Mdw Ntr — divine speech — was not the property of priests alone. Every speaker who spoke truly was participating in the same tradition. The word that creates reality flows through every person who uses it with care. The cosmic order is held by the sum of all true words spoken each day.",
      },
      {
        quartetTag: "cosmic-order",
        scholar: "Hilliard",
        quote: "Hilliard teaches that the child's daily act of truthful speech is a contribution to the community's order — not a small personal gesture but a real social force. When a child names something good in another person, that community becomes slightly more ordered, slightly more whole. Heka works at every scale.",
      },
      {
        quartetTag: "cosmic-order",
        scholar: "Acholonu",
        quote: "Acholonu finds in ancestral African knowledge that the spoken word was understood as a thread in the fabric of communal life. When that thread is a true word said with care, it strengthens the fabric. When it is careless or false, it weakens it. Heka names the obligation to keep speaking truly — to hold the fabric.",
      },

      // ── closer (the daily true sentence is Maat spoken into the world) ──
      {
        quartetTag: "closer",
        scholar: "Karenga",
        quote: "Karenga teaches that Maat is not held in the temples alone. One true word, said daily with care — naming what is good, speaking it true — is Maat creating the world anew. That is Heka. That is what you do when you speak one true sentence to someone in your house today.",
      },
    ],
  },
};

if (typeof window !== 'undefined') {
  window.Senebty = window.Senebty || {};
  window.Senebty.foundationHekaStory = FOUNDATION_HEKA;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FOUNDATION_HEKA };
}
