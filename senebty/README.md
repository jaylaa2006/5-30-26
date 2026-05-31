# Per Ankh Senebty

The health/medicine wing of Per Ankh Reader. Senebty means "be in health" — both wish and command.

## Architecture: Option D

Senebty is a section of `maat-reader.html`, not a sibling app. Source files live here, runtime
loads them via `<script>` tags from inside `maat-reader.html`. Single shared `window` namespace.

See `docs/superpowers/specs/2026-04-25-senebty-architecture-decisions.md` for the full verdict.

## Layout

- `lib/`     — JS modules attached to `window.Senebty.*`
- `styles/`  — Section-scoped CSS (ONLY for needs the reader tokens don't already cover)
- `data/`    — Lesson data, source-stack PDFs (raw/ + ocr/ gitignored)
- `tests/`   — Node test scripts; ESM-import lib modules directly

## Things we MUST NOT duplicate

(from `docs/superpowers/specs/2026-04-25-senebty-architecture-decisions.md`)

1. PerAnkhTTS — Azure TTS bootstrap, token cache, `.speak()`
2. Azure STT recognizer stack
3. GLOSSARY + INLINE_REFS + buildRefAwareHTML()
4. App.user + localStorage['perankh_user'] + saveUser
5. App._iri + streak math (lives at App._iri; source moves into lib/iri.js + lib/streak.js)
6. App.nav router
7. renderParentDashboard() at maat-reader.html ~32459 (extend, don't fork)
8. .sema-breath-circle CSS + @keyframes sema-breath (lines 1116–1175)
9. Seba voice/dialogue components (.sema-seba-text family)
10. Color tokens, typography, button styles, screen-back chrome

## Convention

All NEW Senebty globals attach to `window.Senebty.*`. PR review enforces.
