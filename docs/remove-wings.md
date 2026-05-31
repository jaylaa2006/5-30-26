# Removing the optional "wings"

The original app had extra sections beyond the core reader — a daily-ritual
section called **senebty**, a **timeline**, **ruler** pages, a **map**, and
**governance** pages. This kit keeps that code so the app runs, but the most
prominent entry point (the *senebty* button on the home screen) is already
**hidden** (`style="display:none"`, marked `data-starter-kit-hidden`).

You don't have to remove anything — hidden wings don't get in your way. But if you
want a truly lean codebase, remove them **one at a time, with a browser check
after each**, so you can tell immediately if something breaks.

## The safe way (recommended)
Ask Claude Code to do it surgically, one wing at a time:
> "Remove the senebty wing from this app: its `<script>`/`<link>` tags in the
> `<head>` of maat-reader.html, its `__Install...__` calls, its DOM sections, and
> its nav entries. Then run `node server.js` and confirm the reader still loads
> with no console errors. Don't touch the core reader/library."

Then repeat for `timeline`, `rulers`, `governance`, `map`.

## After each removal
1. `node server.js` → open `http://localhost:3456`.
2. Open the browser console (F12) and check for red errors.
3. Click into a story and read a few pages — confirm the core reader still works.
4. Only then move to the next wing.

## Why one-at-a-time
These wings are woven through a large file. Removing them all at once makes it
hard to know which deletion caused a problem. Small steps + a browser check after
each is how you keep the app working the whole way.

## A gotcha worth knowing
The app has image-fallback handlers that can crash the **whole** page if a
referenced image is missing (an old `onerror` that the browser mis-reads). That's
why this kit ships the guide-character art in `art/seba-khafre/` and the hero
portraits in `art/heroes/`. If you remove image references, remove the matching
`onerror` fallbacks too — or just keep the folders populated (replace the art,
don't delete it). When in doubt, ask Claude Code to "make image loads fail
gracefully instead of crashing."

## Tests
The original test suite included many wing-specific tests. If you remove a wing,
also remove or skip its tests (Claude Code can find them: they're named
`tests/senebty-*`, etc.).
