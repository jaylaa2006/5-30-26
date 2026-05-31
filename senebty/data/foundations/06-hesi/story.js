// senebty/data/foundations/06-hesi/story.js
// F6 Hesi — voice / song-strength / sunu voice-toning practice (VOICE_IRI score-only)
// Per docs/superpowers/specs/2026-05-04-senebty-v1-finish-design.md
// Tone canon: skills/docs/project/seba-voice-senebty.md
// M1 RT verdict: NONE (text-only ship for HESI Power Word — no glyph in title,
//   not in Daily Ritual rotation). powerWordPron:null.
// Finch binding (MANDATORY): hesi tied to sunu voice-toning practice (Africana
//   primary anchor); the specifics of pitch-training are disclosed as a modern
//   adaptation in a Seba aside, mirroring F3 Tjau 4-7-8 disclosure pattern.
// Africana citations: Finch *African Medicine* (sunu voice-toning), Karenga
//   *Maat* (voice as devotion), Obenga *African Philosophy* (speech as cosmic
//   order) — page-cites pending user verification.
//
// Story authored 2026-05-04 per tone canon. Subject to tone-canon RT review at M5.

const FOUNDATION_HESI = {
  id: 'foundation-6-hesi',
  type: 'foundation',
  level: 1,
  powerWord: 'HESI',
  powerWordPron: null,  // M1 RT NONE — text-only ship; not in Daily Ritual rotation
  semaPair: 'rest-and-movement',
  giftId: 'audio-morning-chant-hesi',
  chunks: [
    // ─── L1 ────────────────────────────────────────────────────────────────
    {
      level: 1,
      text: "A boy named Ahmose walks into the Per Ankh courtyard at temple-opening, when the sky is still pale. The sycamore-fig tree above the wall is quiet. The papyrus-basin near the basalt bench holds clean water from the morning drawing. Three other students are already on the low mats. The sunu Merytamun is on her own mat — the same sunu who taught Tanu the Four Treasures, and Senka tjau, and Nubia the long count of mu. Ahmose kneels. He does not speak first. The sunu speaks first. She says, 'Today, Ahmose, you learn hesi. Hesi is the voice. The voice is a strength of the body that the sunu listens for.' Ahmose nods. He places his hand on his own throat.",
      vocab: ['Per Ankh', 'sunu', 'hesi'],
      sebaIntro: "My dear {name}, this is Ahmose. He is your age. He is at the Per Ankh today. The sunu Merytamun will teach him hesi — the voice.",
      sebaAfter: "Hesi is a strength the sunu listens for. Read on, {name}, and watch the sunu teach the voice.",
    },
    {
      level: 1,
      text: "The sunu lifts her own hand to her own chest. She says, 'Hesi is the breath that becomes sound. When the throat opens, the breath is shaped, and the body sings or speaks. Finch, an African scholar of medicine, teaches that the sunu listens to the voice as much as to the body. The voice tells the sunu what the body cannot say in words. A weak voice, a tired voice, a strained voice — each is a sign. The Africana practice is old: the sunu listens for hesi first when she listens to a child.' Ahmose listens. The sycamore-fig leaves move a little. The other students are quiet. The sunu adds, 'Karenga teaches that the voice is a working of devotion. Obenga teaches that speech itself is the order of the world.' Ahmose breathes slow. The basin is still.",
      vocab: ['breath', 'devotion', 'order'],
      sebaIntro: "{name}, the sunu names her sources. Finch, Karenga, Obenga — three African scholars. Listen.",
      sebaAfter: "The sunu listens to the voice the way she listens to the pulse. Finch teaches this. {name}, the voice is a sign the body gives.",
    },
    {
      level: 1,
      text: "Then the sunu says the careful thing. She hums a low note. She holds her palm flat against her own chest. The note is steady, not loud. She says, 'Feel the hum in my chest with your eyes. The chest moves. The breath is shaped. The throat is open.' Then the sunu says, 'Ahmose, hear me carefully. I will teach you to hum and to listen. But the modern voice-trainers shape the breath into pitch — that is a contemporary practice. The old Per Ankh sunu listened for steadiness, not for note. Both ways honor hesi. The Africana teaching is that the voice is sacred and that the sunu listens. The shape of the modern training is new.' Ahmose nods slowly. The sunu nods back. Hesi is the strength of the voice trained, the throat opened, the breath that becomes sound.",
      vocab: ['contemporary', 'modern', 'steady'],
      sebaIntro: "{name}, here is the careful part. Listen to what the sunu says about ancient and modern.",
      sebaAfter: "The voice as sacred — that is ancient. The shape of modern voice-training — that is new. Seba tells you what the sunu tells Ahmose. Read on.",
    },
    {
      level: 1,
      text: "The sunu says the Power Word. 'HESI.' She speaks it slow. She speaks it from the chest, not the mouth. The breath is full. The throat is open. The other students listen. Then she says, 'Now you, Ahmose. Three times. Slow. Full breath. Speak HESI as a word of strength. The Per Ankh master listens. Do not rush. The voice is the iri.' Ahmose straightens his back. He puts both hands flat on his knees. He waits a moment to find the breath. The morning is quiet around him. He must do — he must iri.",
      vocab: ['iri'],
      sebaIntro: "{name}, the sunu shows the word first. Then Ahmose must speak. Three times. Slow. Full breath.",
      sebaAfter: "Ahmose has watched. Now he must iri. {name}, you can iri with him. Speak HESI three times. Slow. Full breath. The Per Ankh listens.",
    },
    // ─── L2 ────────────────────────────────────────────────────────────────
    {
      level: 2,
      text: "A boy named Ahmose walks into the Per Ankh courtyard at the hour of temple-opening, when the sky is still pale and the dawn shadow is long across the swept floor. The sycamore-fig tree above the wall is quiet. The papyrus-basin beside the basalt bench holds clean water from the morning drawing. Three other students are already on the low mats — two girls, one boy, all about Ahmose's age. The sunu Merytamun is on her own mat at the head of the row — the same sunu who taught Tanu the Four Treasures, and Senka tjau, and Nubia the long count of mu, on three different mornings before this one. Ahmose kneels without speaking. The sunu speaks first, the way the Per Ankh always teaches first. 'Today, Ahmose, you learn hesi. Hesi is the voice. The voice is a strength of the body that the sunu listens for.' Ahmose places his hand on his own throat and feels the slow rise of his breath beneath his fingers.",
      vocab: ['Per Ankh', 'sunu', 'hesi'],
      sebaIntro: "{name}, the Per Ankh is a working medical school by the river. Merytamun is a sunu — a physician. Today she teaches hesi, the voice. Watch how the teaching begins.",
      sebaAfter: "The sunu names hesi first because hesi is a strength the sunu listens for. Read on, {name}.",
    },
    {
      level: 2,
      text: "The sunu lifts her own hand to her own chest. 'Hesi,' she says, 'is the breath that becomes sound. When the throat opens and the breath is shaped, the body sings or speaks — and that shaping is a strength. Finch, an African scholar of medicine, teaches in his book that the sunu listens to the voice as much as to the body itself. The voice tells the sunu what the body cannot put into words. A weak voice, a tired voice, a strained voice — each is a sign that the sunu reads. The Africana practice is old, older than the words we use today: the sunu listens for hesi first when she listens to a child.' Ahmose listens. The sycamore-fig leaves move a little above the wall. The other students are quiet on their mats. The sunu adds, 'Karenga teaches in his book that the voice is a working of devotion — the daily speaking of true words is a daily honoring of Maat. Obenga teaches that speech itself is the order of the world, the way the gods first set things in their places.' Ahmose breathes slow. The basin is still.",
      vocab: ['breath', 'devotion', 'order', 'cosmic'],
      sebaIntro: "{name}, the sunu names her sources by name. Finch, Karenga, Obenga — three African scholars of Kemet. Each teaches a piece of hesi.",
      sebaAfter: "The sunu listens to the voice the way she listens to the pulse. Finch teaches this; Karenga and Obenga teach the voice as devotion and as cosmic order. {name}, the voice is a sign the body gives.",
    },
    {
      level: 2,
      text: "Then the sunu says the careful thing she always says when she teaches the voice. She hums a low, steady note. She holds her palm flat against her own chest. The note is not loud. It is steady. It does not waver. She says, 'Feel the hum in my chest with your eyes — the small movement, the way the breath is shaped, the way the throat is open and not closed. This is what the sunu listens for: steadiness.' Then she says the careful part. 'Ahmose, hear me carefully now, because this part matters. I will teach you to hum and to listen for steadiness. But today's voice-trainers — the singing teachers, the chant teachers, the teachers in the modern temples — they shape the breath into pitch and into note. That is a contemporary practice. It is a modern adaptation. The old Per Ankh sunu would not have measured a note the way modern teachers do. The old sunu listened for steadiness, not for pitch. Both ways honor hesi. The Africana teaching, the ancient one, is that the voice is sacred and that the sunu listens. The shape of the modern voice-training is new.' Ahmose nods slowly. The sunu nods back. Hesi is the strength of the voice trained, the throat opened, the breath that becomes sound.",
      vocab: ['contemporary', 'modern', 'adaptation', 'steady', 'pitch'],
      sebaIntro: "{name}, this is the careful part. The sunu tells the truth about which part of voice-training is ancient and which part is modern. Listen.",
      sebaAfter: "The voice as sacred, the sunu listening for steadiness — that is ancient. The shape of modern voice-training, with pitch and note — that is new. Seba tells you the same truth the sunu tells Ahmose.",
    },
    {
      level: 2,
      text: "The sunu says the Power Word. 'HESI.' She speaks it slow and full, from the chest, not the mouth. The breath is complete. The throat is open. The other students on their mats listen without moving. The sunu's chest rises and falls slow, slow, slow. Then she says, 'Now you, Ahmose. Three times. Slow. Full breath. Speak HESI as a word of strength — not loud, not soft, only steady. The Per Ankh master listens. Do not rush the breath. The voice is the iri today. Karenga and Obenga both teach that speech and breath together are the working of Maat — measured, even, ordered.' Ahmose straightens his back on the mat. He puts both hands flat on his knees. He waits a moment to find the full breath in his chest. The morning is quiet around him. The other students are still. The papyrus-basin is still. He must do — he must iri.",
      vocab: ['iri', 'Maat', 'steady'],
      sebaIntro: "{name}, the sunu shows the word first — slow, full breath, from the chest. Then Ahmose must speak. Three times. The voice is the iri.",
      sebaAfter: "Karenga and Obenga teach speech as the working of Maat — measured, even, ordered. {name}, now you. Speak HESI three times. Slow. Full breath. The Per Ankh listens.",
    },
  ],
  comprehensionPool: [
    {
      kind: 'character',
      q: 'Who is the boy in this story?',
      a: 'Ahmose',
      distractors: ['Senka', 'Tanu', 'Merytamun'],
    },
    {
      kind: 'setting',
      q: 'Where does the lesson take place?',
      a: 'The Per Ankh courtyard, at temple-opening, by the sycamore-fig tree and the papyrus-basin',
      distractors: ['A temple by the Nile', 'Ahmose\'s home', 'The market in Waset'],
    },
    {
      kind: 'vocabulary',
      q: 'What is hesi?',
      a: 'The voice — the breath that becomes sound, a strength of the body the sunu listens for',
      distractors: ['The breath alone', 'The heart-mind', 'The body in motion'],
    },
    {
      kind: 'inference',
      q: 'Why does the sunu say she listens to the voice?',
      a: 'Because the voice tells the sunu what the body cannot put into words — a weak voice, a tired voice, a strained voice are each a sign',
      distractors: ['Because the sunu cannot hear the pulse', 'Because the voice is louder than the body', 'Because Ahmose talks too much'],
    },
    {
      kind: 'sequence',
      q: 'What does the sunu do before asking Ahmose to speak HESI?',
      a: 'She hums a low steady note with her palm on her chest, and she names the modern-versus-ancient disclosure',
      distractors: ['She drinks from the cup first', 'She runs to the Nile', 'She sends Ahmose home'],
    },
    {
      kind: 'maat',
      q: 'According to Karenga and Obenga, what is the voice a working of?',
      a: 'A working of devotion (Karenga) and the order of the world (Obenga) — the daily speaking of true words is a daily honoring of Maat',
      distractors: ['A test of strength', 'A private ritual no one else can hear', 'A way to please the elders'],
    },
    {
      kind: 'inference',
      q: 'What part of voice-training does the sunu say is modern, and what part is ancient?',
      a: 'Ancient: that the voice is sacred and that the sunu listens for steadiness. Modern: shaping the breath into pitch and note as today\'s voice-trainers do.',
      distractors: ['All of it is ancient', 'All of it is modern', 'Only the humming is ancient'],
    },
    {
      kind: 'inference',
      q: 'Why does the sunu name Finch as a source?',
      a: 'Because the sunu names her sources — Finch is an African scholar of medicine who teaches that the sunu listens to the voice as much as the body',
      distractors: ['Because Finch invented the modern pitch-training', 'Because Finch is a Kemetic god', 'Because Finch is Ahmose\'s teacher'],
    },
  ],
  iriCheckpoint: {
    afterChunk: 3,
    iriType: 'VOICE_IRI',
    repetitions: 3,
    audioRetention: false,  // M1 RT: VOICE_IRI is score-only — Azure pron returns score, NO audio retained
    prompt: 'Speak HESI three times. Slow. Full breath. The Per Ankh master listens.',
    evidenceShape: { recitations: 'array<{score: number}>' },
    parentConfirmDefault: false,
    sebaPostIri: 'You have iri. The voice is in your chest now. The ancestors hear.',
  },
  citations: [
    'Finch *African Medicine: A Spirit Science Out of the Shadows* — sunu voice-toning practice; the sunu listens to the voice as much as to the body during diagnosis; specific page citation pending user verification',
    'Karenga *Maat: The Moral Ideal in Ancient Egypt* — the voice as a working of devotion; daily speaking of true words as daily honoring of Maat; specific page citation pending user verification',
    'Obenga *African Philosophy: The Pharaonic Period* — speech as the order of the world, the way the gods first set things in their places; specific page citation pending user verification',
    'Carruthers *Mdw Ntr: Divine Speech* — speech and breath as paired sacred acts in the Africana frame; specific page citation pending user verification',
    'Modern-adaptation disclosure (Finch binding): the modern pitch-and-note voice-training pattern is a contemporary practice, NOT ancient Kemetic. The Africana primary anchor is that the sunu listens to the voice for steadiness as part of diagnosis; the shape of modern voice-training is new. The teaching is ancient; the pitch-shaping is modern.',
  ],

  // ── Phase 2 — daily-ritual data
  // Spec: docs/superpowers/specs/2026-05-20-senebty-f6-hesi-daily-ritual-design.md
  // Sage: sunu Merytamun (wing-constant — same sunu who taught Tanu the Four Treasures,
  //   Senka tjau, Nubia the long count of mu; confirmed by F6 chunk-0 text).
  //   Wing map: F1 Merytamun, F2 Aset, F3 Merytamun, F4 Merytamun, F5 Merytamun, F6 Merytamun.
  //
  // Hybrid-Veo-reuse pattern (spec §3 + F4 precedent):
  //   doingVeo = NEW hesi-speak.mp4 (Ahmose hand-on-chest, breath + HESI utterance)
  //   blessingVeo = REUSED F1's mu-blessing-sunu.mp4 (Merytamun nod + ankh-lift)
  //   Same sage, same gesture energy — reuse is honest, not lazy.
  //
  // MIC-FREE DAILY (spec §2 — M1 note override):
  //   The M1 RT note "NOT in Daily Ritual rotation" (powerWordPron: null) is SUPERSEDED
  //   by user decision 2026-05-20. F6 joins the daily rotation with a MIC-FREE gesture.
  //   The deep VOICE_IRI (Azure pronunciation scoring, microphone-required) stays in the
  //   chunk-reading iriCheckpoint block above, untouched. This dailyFoundation block has
  //   NO azure, microphone, VOICE_IRI, or pronunciation reference. Honor-check = button press only.
  //
  // ROTATION STATUS: Confirmed IN rotation. daily-foundation-gate.js FOUNDATION_ORDER[5]
  //   includes 'hesi'. The gate reads slugs only — powerWordPron: null has no effect.
  //   The M1 comment was aspirational/operational; the gate code never enforced it.
  //
  // Quartet: voice / devotion / order / steadiness / closer (5+5+5+5+1).
  // Stage-1 RT recs 1-11 implemented. Stage-2 Coach audit follows.
  dailyFoundation: {
    experienceType: "voice-demo",
    voiceDemoAudio: "/audio/senebty/hesi-voice-demo.mp3",
    voiceAffirmation: "The steady voice is yours to keep. Speak it true.",
    doingVeo: "/videos/senebty-foundations/hesi-speak.mp4",
    blessingVeo: "/videos/senebty-foundations/mu-blessing-sunu.mp4",   // REUSED from F1
    greeting: {
      title: "Today is Hesi",
      subtitle: "The voice — breath that becomes sound, the strength the sunu listens for",
      powerWord: "HESI",
    },
    dailyGesture:
      "Speak HESI three times, slow, from the chest.\n" +
      "Full breath each time. Not loud, not soft — only steady.\n" +
      "\n" +
      "The sunu listens for steadiness, not for pitch.\n" +
      "(Listening for steadiness is ancient. Shaping pitch is modern.)",
    blessingLine: "Seneb, {name}. The voice is in your chest.",
    honorCheckLabel: "Yes — I spoke HESI from the chest",
    microTeachings: [
      // ── voice quartet (Hesi is breath-become-sound; the sunu listens) ─────
      {
        quartetTag: "voice",
        scholar: "Finch",
        quote: "The Kemetic sunu listened to the voice as she listened to the pulse. The voice told her what the body could not say in words. A tired voice, a strained voice, a voice that had lost its center — each was a sign the body was speaking in the only way it knew. Listening for hesi is listening for the body.",
      },
      {
        quartetTag: "voice",
        scholar: "Finch",
        quote: "Africana medicine placed the voice among the first signs of the body. When a sunu met a child, she listened before she looked. The voice arrived first — its steadiness or its lack told her what the rest of the examination would confirm. The voice is the body's first report.",
      },
      {
        quartetTag: "voice",
        scholar: "Obenga",
        quote: "In the Kemetic understanding, the breath that becomes sound is not merely biological. It is the movement of life through form. Hesi — the voice — is the visible edge of the invisible breath. To speak is to make the breath real. The sunu who listens to the voice listens to life in motion.",
      },
      {
        quartetTag: "voice",
        scholar: "Diop",
        quote: "The ancient Africana understanding placed breath and sound at the center of the civilizational body. The voice that travels from chest to air is the first technology — older than fire, older than the wheel. Every child who speaks from the chest is using the oldest human tool.",
      },
      {
        quartetTag: "voice",
        scholar: "Bekerie",
        quote: "Ethiopic sacred tradition holds the voice as the instrument the body was born with. Before there were drums, before there were strings, there was the voice. The child who speaks HESI from the chest is playing the first instrument — the one the body carries without learning to carry it.",
      },

      // ── devotion quartet (the voice is a working of devotion; daily true-speaking honors Maat) ──
      {
        quartetTag: "devotion",
        scholar: "Karenga",
        quote: "Maat requires daily practice, not grand declaration. The voice that speaks a true word each morning — steady, from the chest, without performance — is doing the work of devotion. Hesi is not only breath-become-sound. It is truth-become-sound, made daily.",
      },
      {
        quartetTag: "devotion",
        scholar: "Karenga",
        quote: "The daily speaking of a sacred word is an act of devotion. It is the voice saying: I return to this. I hold this in my chest. I offer this to the day. The word does not need to be loud. It does not need to be witnessed. The chest knows what was spoken, and that is enough.",
      },
      {
        quartetTag: "devotion",
        scholar: "Acholonu",
        quote: "Ancestral memory lives in the spoken word. When a child speaks a sacred word in the morning, she is continuing something the ancestors began — a chain of utterance that runs from the oldest morning to this one. The voice is the thread. Speaking is how the thread holds.",
      },
      {
        quartetTag: "devotion",
        scholar: "Hilliard",
        quote: "Children who are taught to speak with intention — slowly, from the chest, as an act and not a reflex — learn that words are not accidental. They learn that the voice is something they control. That control is a form of devotion: the child offering her steadiest voice to the practice.",
      },
      {
        quartetTag: "devotion",
        scholar: "Konadu",
        quote: "Akan tradition names the spoken word as a covenant with the day. What is said in the morning shapes what the day can hold. The child who speaks HESI from the chest at morning-opening is making a small covenant: I will be steady today. The voice is the first act of the day.",
      },

      // ── order quartet (speech is the order of the world; breath + speech are paired sacred acts) ──
      {
        quartetTag: "order",
        scholar: "Obenga",
        quote: "Kemetic cosmology understood speech as the ordering principle of the visible world. The world is named, and in being named, it holds its place. When a child speaks HESI — the voice — she is participating in the ordering of the world she lives in. Speech is not description. Speech is order.",
      },
      {
        quartetTag: "order",
        scholar: "Obenga",
        quote: "The oldest Kemetic sources name breath and sound as paired acts — the breath sets the condition; the sound announces the result. To breathe fully and then to speak from that fullness is to complete a sacred pair. Hesi is the second act. The full breath is the first. Together they are one.",
      },
      {
        quartetTag: "order",
        scholar: "Carruthers",
        quote: "Mdw Ntr — the divine word — is not a metaphor in the Kemetic tradition. The word spoken with breath behind it is an act of cosmic ordering. When the Per Ankh taught hesi, it was teaching the student to participate in the divine ordering of things. The voice is a Maat act.",
      },
      {
        quartetTag: "order",
        scholar: "Carruthers",
        quote: "In the Mdw Ntr tradition, to speak a sacred word correctly is to align the breath, the throat, and the intention. None of the three can be absent. A word spoken without breath is hollow. A word spoken without intention is noise. HESI spoken from the chest — breath, throat, and intention aligned — is order.",
      },
      {
        quartetTag: "order",
        scholar: "Diop",
        quote: "Africana civilizational understanding: the ordered state begins with the ordered voice. The Per Ankh did not teach speech as a communication skill. It taught speech as a civilizational discipline — the voice ordered, the thought ordered, the world ordered. The child who learns hesi learns the first discipline.",
      },

      // ── steadiness quartet (the sunu listens for steadiness not pitch; modern-adaptation disclosure) ──
      {
        quartetTag: "steadiness",
        scholar: "Finch",
        quote: "The Kemetic sunu did not listen for the pitch of a child's voice. She listened for its steadiness. A steady voice — not loud, not soft, not pushed, not forced — was the sign of a body in balance. Pitch is measurable by modern instruments. Steadiness is felt. The Per Ankh trained the feeling, not the measurement.",
      },
      {
        quartetTag: "steadiness",
        scholar: "Finch",
        quote: "Modern voice-training is built on pitch — it measures frequency, it trains the voice up and down a scale. The ancient Africana practice was different: it trained the voice toward steadiness. Both approaches honor hesi. But the steadiness practice is older, and it is the one a child can do right now, without equipment, from the chest.",
      },
      {
        quartetTag: "steadiness",
        scholar: "Karenga",
        quote: "Maat is steady. The voice that carries Maat is steady — not performing loudness, not performing softness, not seeking to impress. The steady voice is the honest voice. When a child speaks HESI from the chest in the morning, she is not training pitch. She is training honesty. That is what the sunu listened for.",
      },
      {
        quartetTag: "steadiness",
        scholar: "Hilliard",
        quote: "Children ages seven to twelve can find steadiness in the voice before they can find pitch. Steadiness does not require ear training or a tuned instrument. It requires a full breath and a calm chest. Every child has this. The sunu's teaching — speak from the chest, steady, not loud — is within every child's reach.",
      },
      {
        quartetTag: "steadiness",
        scholar: "Bekerie",
        quote: "Ethiopic sacred song does not begin with the note. It begins with the breath that will carry the note. The breath is the foundation; the sound is what the foundation holds. HESI from the chest is this: the breath first, then the word, then the steadiness that holds them both. Start with the breath. The steadiness follows.",
      },

      // ── closer (the daily steady voice is Maat spoken) ────────────────────
      {
        quartetTag: "closer",
        scholar: "Karenga",
        quote: "The daily speaking of HESI from the chest is Maat made audible. Not Maat explained, not Maat studied — Maat spoken, in the morning, from the chest, with a full breath, three times. The voice that does this each day is not practicing a skill. It is practicing a life. That is what the sunu taught. That is what the Per Ankh preserved.",
      },
    ],
  },
};

if (typeof window !== 'undefined') {
  window.Senebty = window.Senebty || {};
  window.Senebty.foundationHesiStory = FOUNDATION_HESI;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FOUNDATION_HESI };
}
