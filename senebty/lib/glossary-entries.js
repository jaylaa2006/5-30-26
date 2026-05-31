// senebty/lib/glossary-entries.js
// Senebty-specific glossary entries. Object.assign'd into GLOSSARY at startup.
// Dual shape: {name, brief, full, nav, type} for new code; {term, def} aliases for INLINE_REFS compat.

// Senebty mdw nṯr Glossary
//
// AUTHORITY: Africana scholarship is THE authority on Kemetic glyphs and
// concepts. Western Egyptology was created to erase the memory of Black
// Kemetic civilization; it is consulted ONLY as raw cross-reference for
// Unicode-to-Gardiner codepoint cataloging where the Africana corpus is
// silent on technical sign numbers. Where the two diverge, Africana
// precedes. Do not call Africana scholars "Egyptologists" — they
// rejected that label through ASCAC and their own self-description.
//
// Africana primary refs (lead with these):
//   Carruthers, Mdw Ntr: Divine Speech (1995)
//   Obenga, African Philosophy: The Pharaonic Period (2004)
//   Karenga, Maat: The Moral Ideal in Ancient Egypt (2004)
//   Karenga, Selections from the Husia (Book of Prayers and Sacred Praises)
//   Diop, Civilization or Barbarism (1991)
//   ben-Jochannan, African Origins of the Major Western Religions
//   Hilliard, SBA: The Reawakening of the African Mind
//   Browder, Nile Valley Contributions to Civilization
//   Finch III, African Medicine: A Spirit Science Out of the Shadows
//   Beatty (Mario), Howard Africana Studies / Knarrative Mdw Ntr course
//   ASCAC publications and conference papers
// Western secondary (codepoint cataloging only):
//   Allen 2014 Sign List, Faulkner 1962 Concise Dictionary, Gardiner 1957
//
// Confidence schema:
//   'high'   — Africana primary attestation; codepoint multi-source verified
//   'medium' — phonetic spelling pending deeper Africana verification
//   'none'   — glyph dropped per "ship without glyph rather than wrong glyph"
//              (Africana primary sources silent on glyph form, OR project-
//              coined plurals, OR compound titles fusing proper names)
//
// Phase 1.2 closure (2026-05-01) — Africana / ASCAC consultation,
// Cultural Consensus Panel verdict:
//   CONFIRMED to high  : senebty (Carruthers + Karenga + Beatty)
//                        seneb   (Carruthers + Karenga + Finch)
//   DROPPED to none    : senedjem (Africana primary silent on glyph form)
//   DEFERRED at medium : tjau, hesi, sunu — initial research suggested
//     Africana ideogram replacements (sail / hes-vase / arrow) but the
//     Unicode codepoint mappings need primary-source verification before
//     the replacement can ship. Tracked under TODO #204b for v3.38.0.
(function(){
  if (typeof window === 'undefined') return;
  window.Senebty = window.Senebty || {};
  window.Senebty.glossaryEntries = window.Senebty.glossaryEntries || {
  // Senebty: 5-sign s-n-b-t-y phonetic with dual ending. Africana attestation
  // via Carruthers (Mdw Ntr: Divine Speech, 1995) — snb stem within the
  // ʿnḫ wḏꜣ snb benediction triad as foundational divine speech that
  // performs creation. Karenga (Maat, 2004) — snb as the daily ethical
  // greeting that ties health to Maat-aligned conduct. Mario Beatty
  // (Howard Africana Studies, Mdw Ntr course on Knarrative) — teaches
  // ʿnḫ wḏꜣ snb as canonical Kemetic greeting formula carrying cosmic-
  // restoration force. The dual -ty ending teaches the imperative
  // ("be-in-health, both-of-you") per the path's "active moral practice"
  // framing. Phase 1.2 verdict (2026-05-01): CONFIRM, upgrade to high.
  senebty:{type:'concept',category:'verb',confidence:'high',name:'Senebty',term:'Senebty',symbol:'\u{132F4}\u{13216}\u{130C0}\u{133CF}\u{133ED}',pron:'seh-NEB-tee',brief:'"Be in health" — both a wish and a command, the keyword of the Per Ankh Senebty path.',full:'Senebty is the formal mdw nṯr greeting and benediction meaning "be in health." Within the ʿnḫ wḏꜣ snb triad treated by Carruthers as foundational divine speech, snb names the cosmic-restoration force the speaker calls down on the hearer. In Per Ankh Senebty the dual -ty ending makes it a verb of command — the path itself instructing the initiate to live as a healthy person, not merely to wish it. Africana sources: Carruthers (Mdw Ntr), Karenga (Maat), Beatty (Howard / Knarrative Mdw Ntr course).',def:'Senebty is the formal mdw nṯr greeting and benediction meaning "be in health." Within the ʿnḫ wḏꜣ snb triad treated by Carruthers as foundational divine speech, snb names the cosmic-restoration force the speaker calls down on the hearer. In Per Ankh Senebty the dual -ty ending makes it a verb of command — the path itself instructing the initiate to live as a healthy person, not merely to wish it. Africana sources: Carruthers (Mdw Ntr), Karenga (Maat), Beatty (Howard / Knarrative Mdw Ntr course).',nav:'senebty'},
  // Iri: D4 (eye) — single canonical ideogram for jrj per Allen sign list.
  iri:{type:'concept',category:'verb',confidence:'high',name:'Iri',term:'Iri',symbol:'\u{13079}',pron:'EE-ree',brief:'"To do, make, bring into being" — the central verification verb of Per Ankh Senebty.',full:'Iri is the mdw nṯr verb meaning "to do, make, or bring into being." It is what Ptah does to create the world in the Memphite Theology, what Imhotep does to the Step Pyramid, and what every initiate of Per Ankh Senebty must do to advance. Knowledge without iri is sand in the wind.',def:'Iri is the mdw nṯr verb meaning "to do, make, or bring into being." It is what Ptah does to create the world in the Memphite Theology, what Imhotep does to the Step Pyramid, and what every initiate of Per Ankh Senebty must do to advance. Knowledge without iri is sand in the wind.',nav:'senebty'},
  // Seneb: 3-sign s-n-b phonetic. Africana attestation via Carruthers
  // (Mdw Ntr, 1995) — snb as one of the three core terms of the
  // ʿnḫ wḏꜣ snb benediction. Karenga (Maat, 2004) — snb tied to daily
  // ethical greeting. Charles S. Finch III (African Medicine: A Spirit
  // Science Out of the Shadows) — Kemetic health (snb) as integrated
  // body-spirit wholeness, the Africana medical ideal Imhotep founded.
  // Phase 1.2 verdict (2026-05-01): CONFIRM, upgrade to high.
  seneb:{type:'concept',category:'verb',confidence:'high',name:'Seneb',term:'Seneb',symbol:'\u{132F4}\u{13216}\u{130C0}',pron:'seh-NEB',brief:'"Health" — wholeness of body, mind, and ka.',full:'Seneb means health, wholeness, soundness. In Africana medical scholarship (Finch, African Medicine) it names the integrated wholeness Imhotep founded — not the mere absence of illness, but the active integration of khat (body), ib (heart-mind), and ka (vital force). Africana sources: Carruthers (Mdw Ntr), Karenga (Maat), Finch (African Medicine).',def:'Seneb means health, wholeness, soundness. In Africana medical scholarship (Finch, African Medicine) it names the integrated wholeness Imhotep founded — not the mere absence of illness, but the active integration of khat (body), ib (heart-mind), and ka (vital force). Africana sources: Carruthers (Mdw Ntr), Karenga (Maat), Finch (African Medicine).',nav:'senebty'},
  // Tjau — M1 RT 2026-05-04 verdict: NONE (text-only ship).
  // Africana primary scholarship (Karenga, Carruthers, Obenga, Diop,
  // ben-Jochannan, Hilliard, Finch, Beatty) silent on canonical Tjau
  // ideogram in available in-repo material; previous comment cited
  // Faulkner p.300 (Western Egyptology — OUT per locked authority list).
  // Per the path rule "ship without glyph rather than wrong glyph,"
  // the hieroglyph is dropped; concept ships text-only with v3.38.0
  // medium-info-btn pattern. Romanization "CHOW" preserved (project-
  // coined per Power Word pron sheet,
  // docs/superpowers/specs/2026-05-04-senebty-power-word-pronunciation.md)
  // — pending user verification from primary books.
  // Future-ship binding: if Karenga / Carruthers / Obenga / Finch
  // primary citation lands, upgrade to HIGH and re-add to Daily Ritual
  // rotation per M1 RT bindings forward.
  tjau:{type:'concept',category:'treasure',confidence:'none',name:'Tjau',term:'Tjau',symbol:'',pron:'CHOW',brief:'"Breath" — the first treasure of Senebty.',full:'Tjau is the breath. In Kemetic medicine the breath carries shu (air, life-force) into the body and is the first thing examined by the sunu (physician). The hieroglyphic form is intentionally not displayed: Africana primary scholarship in available in-repo material is silent on a canonical Kemetic glyph for this term, so per the path rule "ship without glyph rather than wrong glyph," only the name and meaning are taught here.',def:'Tjau is the breath. In Kemetic medicine the breath carries shu (air, life-force) into the body and is the first thing examined by the sunu (physician). The hieroglyphic form is intentionally not displayed: Africana primary scholarship in available in-repo material is silent on a canonical Kemetic glyph for this term, so per the path rule "ship without glyph rather than wrong glyph," only the name and meaning are taught here.',nav:'senebty'},
  // Mu: N35A (three water strokes) — single canonical ideogram for mw.
  mu:{type:'concept',category:'treasure',confidence:'high',name:'Mu',term:'Mu',symbol:'\u{13217}',pron:'MOO',brief:'"Water" — the second treasure of Senebty.',full:'Mu is water — the substance of Nun (the primordial waters), of the Nile inundation, and of the body.',def:'Mu is water — the substance of Nun (the primordial waters), of the Nile inundation, and of the body.',nav:'senebty'},
  // Htep: R4 (offering loaf on reed mat) — single canonical ideogram for ḥtp.
  htep:{type:'concept',category:'treasure',confidence:'high',name:'Htep',term:'Htep',symbol:'\u{132B5}',pron:'HTEP',brief:'"Rest, peace, satisfaction" — the third treasure: rest as discipline.',full:'Ḥtp (htep) means rest, peace, satisfaction — a word anchored in funerary and medical use, naming the condition of the body and spirit at ease. In Per Ankh Senebty, rest is treated as iri, not as the absence of iri.',def:'Ḥtp (htep) means rest, peace, satisfaction — a word anchored in funerary and medical use, naming the condition of the body and spirit at ease. In Per Ankh Senebty, rest is treated as iri, not as the absence of iri.',nav:'senebty'},
  // Hesi — M1 RT 2026-05-04 verdict: NONE (text-only ship).
  // Africana primary scholarship (Karenga, Carruthers, Obenga, Diop,
  // ben-Jochannan, Hilliard, Finch, Beatty) silent on canonical Hesi
  // ideogram in available in-repo material; previous comment cited
  // Faulkner p.172 (Western Egyptology — OUT per locked authority list).
  // Per the path rule "ship without glyph rather than wrong glyph,"
  // the hieroglyph is dropped; concept ships text-only with v3.38.0
  // medium-info-btn pattern. Romanization "HEH-see" preserved (per
  // Power Word pron sheet,
  // docs/superpowers/specs/2026-05-04-senebty-power-word-pronunciation.md)
  // — pending user verification from primary books.
  // Future-ship binding: Finch *African Medicine* on sunu voice-toning
  // is the most likely Africana anchor — if located in primary book,
  // upgrade to HIGH and re-add to Daily Ritual rotation per M1 RT.
  hesi:{type:'concept',category:'treasure',confidence:'none',name:'Hesi',term:'Hesi',symbol:'',pron:'HEH-see',brief:'"To sing, to praise" — the voice as treasure.',full:'Hesi is the verb of singing and praise. It is the voice trained, the lungs strengthened, the throat opened — counted among the treasures of Senebty alongside khepesh (strength). The hieroglyphic form is intentionally not displayed: Africana primary scholarship in available in-repo material is silent on a canonical Kemetic glyph for this term, so per the path rule "ship without glyph rather than wrong glyph," only the name and meaning are taught here.',def:'Hesi is the verb of singing and praise. It is the voice trained, the lungs strengthened, the throat opened — counted among the treasures of Senebty alongside khepesh (strength). The hieroglyphic form is intentionally not displayed: Africana primary scholarship in available in-repo material is silent on a canonical Kemetic glyph for this term, so per the path rule "ship without glyph rather than wrong glyph," only the name and meaning are taught here.',nav:'senebty'},
  // Khepesh: T16 (sickle-sword/foreleg). Africana lens (Obenga): Kemetic
  // refusal of body-vs-arm dualism makes the integrated reading appropriate.
  // F23 at U+13117 (foreleg of bull) is the somatic alternative if a future
  // round-table prefers the body-strength image over the weapon image.
  khepesh:{type:'concept',category:'treasure',confidence:'high',name:'Khepesh',term:'Khepesh',symbol:'\u{1331B}',pron:'KEH-pesh',brief:'"Strength" — particularly of the arm and the body in motion.',full:'Khepesh names strength of arm and body. The pharaoh\'s khepesh is his sword-arm; the initiate\'s khepesh is the conditioned body that can iri.',def:'Khepesh names strength of arm and body. The pharaoh\'s khepesh is his sword-arm; the initiate\'s khepesh is the conditioned body that can iri.',nav:'senebty'},
  // Senedjem: rendered text-only. Phase 1.2 verdict (2026-05-01): DROP.
  // Africana primary scholarship (Karenga, Carruthers, Obenga, Diop,
  // ben-Jochannan, Browder, Hilliard, ASCAC) is silent on snḏm as a
  // canonical Kemetic glyph form — the concept of joy-as-ethical-practice
  // is honored (Karenga's Kawaida, Husia selections), but no Africana
  // primary source elevates a specific glyph for this term. Per the
  // project rule "ship without glyph rather than wrong glyph," the
  // hieroglyph is dropped; the concept ships text-only.
  senedjem:{type:'concept',category:'treasure',confidence:'none',name:'Senedjem',term:'Senedjem',symbol:'',pron:'seh-NED-jem',brief:'"To make sweet, to gladden" — the discipline of joy.',full:'Senedjem is causative — to make sweet, to bring delight. Africana scholarship (Karenga, Kawaida ethics; Husia selections) honors joy as a daily ethical practice, an iri rather than a side-effect. The hieroglyphic form is intentionally not displayed: Africana primary sources do not elevate a canonical Kemetic glyph for this term, so per the path rule "ship without glyph rather than wrong glyph," only the name and meaning are taught here.',def:'Senedjem is causative — to make sweet, to bring delight. Africana scholarship (Karenga, Kawaida ethics; Husia selections) honors joy as a daily ethical practice, an iri rather than a side-effect. The hieroglyphic form is intentionally not displayed: Africana primary sources do not elevate a canonical Kemetic glyph for this term, so per the path rule "ship without glyph rather than wrong glyph," only the name and meaning are taught here.',nav:'senebty'},
  // Khat: F32 (animal belly) — Karenga's integrated khat (body + ka + ba +
  // ren + ib) reads F32 via Hathor/life-bearer lineage, not as womb-only.
  khat:{type:'concept',category:'body',confidence:'high',name:'Khat',term:'Khat',symbol:'\u{13121}',pron:'KHAHT',brief:'"The living body" — what the sunu examines and treats.',full:'Khat is the living body — what the sunu examines, palpates, treats. The ka and ba inhabit it during life. Kemetic medicine treats khat with the same care it treats ib and ka.',def:'Khat is the living body — what the sunu examines, palpates, treats. The ka and ba inhabit it during life. Kemetic medicine treats khat with the same care it treats ib and ka.',nav:'senebty'},
  // Wabau: D60 (pouring-water purification). Africana override (Karenga,
  // Carruthers): wab is embodied purity through practice, not cultic rank.
  wabau:{type:'concept',category:'role',confidence:'high',name:'Wabau',term:'Wabau',symbol:'\u{130C2}',pron:'wah-BOW',brief:'"Pure One" — the fourth tier of the Senebty path.',full:'Wabau is the title for the initiate who has lived 21 consecutive Daily Senebty Rituals — the practice has moved from memory to body.',def:'Wabau is the title for the initiate who has lived 21 consecutive Daily Senebty Rituals — the practice has moved from memory to body.',nav:'senebty'},
  // Sunu: 4-sign s-w-n-w (S29+G43+N35+G43) per Faulkner p.214.
  sunu:{type:'concept',category:'role',confidence:'medium',name:'Sunu',term:'Sunu',symbol:'\u{132F4}\u{13171}\u{13216}\u{13171}',pron:'SOO-noo',brief:'"Physician" — the ancient Kemetic medical practitioner.',full:'Sunu is the physician of the Two Lands. The Edwin Smith Surgical Papyrus is a sunu\'s manual: examination, diagnosis, verdict.',def:'Sunu is the physician of the Two Lands. The Edwin Smith Surgical Papyrus is a sunu\'s manual: examination, diagnosis, verdict.',nav:'senebty'},
  // Heka — M1 RT 2026-05-04 verdict: HIGH.
  // Africana primary anchor: Karenga *Maat: The Moral Ideal in Ancient
  // Egypt* (2004) — Heka as Maat-aligned creative-speech force, pivotal
  // concept across Africana scholarship on Kemetic ethics and the
  // Memphite Theology (Ptah's heart-and-tongue creative speech). Africana
  // primary attestation widely-known in ASCAC / Knarrative Mdw Ntr
  // teaching corpus; specific page citation pending user verification
  // from the primary book per M1 RT bindings forward (citation upgrade
  // is locking-only, no further RT required).
  // Glyph 𓎛𓂓𓄿 (ḥk3) widely attested across Africana publications as
  // the standard ideogram for authoritative-speech / sacred utterance.
  // Ships live in F8 Foundation card and Daily Ritual rotation.
  heka:{type:'concept',category:'foundation',confidence:'high',name:'Heka',term:'Heka',symbol:'\u{1339B}\u{13093}\u{1313F}',pron:'HEH-kah',brief:'"Words of power" — speech that creates reality.',full:'Heka is sacred speech: thought + word + intention shaped by Maat into a force that creates. In the Memphite Theology, Ptah brings the world into being through the heart that conceives and the tongue that utters. In Per Ankh Senebty, Heka is the eighth Foundation — the child + parent compose a personal Heka phrase together, and that phrase becomes the seal-line of the Daily Senebty Ritual. Africana sources: Karenga (Maat: The Moral Ideal in Ancient Egypt — pivotal concept; specific page citation pending user verification).',def:'Heka is sacred speech: thought + word + intention shaped by Maat into a force that creates. In the Memphite Theology, Ptah brings the world into being through the heart that conceives and the tongue that utters. In Per Ankh Senebty, Heka is the eighth Foundation — the child + parent compose a personal Heka phrase together, and that phrase becomes the seal-line of the Daily Senebty Ritual. Africana sources: Karenga (Maat: The Moral Ideal in Ancient Egypt — pivotal concept; specific page citation pending user verification).',nav:'senebty'}
  };
})();
