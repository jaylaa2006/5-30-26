// senebty/lib/display-name.js
// Display-time helpers for user-facing names. Single source of truth across
// server-side prompt templates (server.js, seba-story-api.mjs) and frontend
// renderers (foundation-render.js, parent-dashboard.js, renderHome).
//
// The CANONICAL helper is capitalizeName(name). All paths that substitute
// {name} into a user-visible string MUST go through this helper.
//
// Why: user.name is stored as the user typed it. Short or lowercase entries
// ("ing", "alex") read as broken English when interpolated into templates
// like "My dear {name}, this is …" or "Hotep, {name}". Capitalizing the
// first letter at display time normalizes without touching storage.
//
// Backfill: when a user record is read/written, callers may opportunistically
// apply normalizeStoredName() to heal historical lowercase entries. Applied at:
//   - maat-reader.html App.start() (frontend) — user.name = normalizeStoredName(name)
//   - seba-story-api.mjs — sanitized childName capitalized at point of use
// No mass migration; healing happens as users naturally continue to use the app.

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else { root.SenebtyDisplayName = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {

  function capitalizeName(name) {
    if (name == null) return name;
    var s = String(name).trim();
    if (!s) return s;
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // Backfill helper — for users.db migration / opportunistic record-write
  // healing. Returns the same string if already capitalized + trimmed.
  function normalizeStoredName(name) {
    if (name == null) return name;
    var trimmed = String(name).trim();
    if (!trimmed) return trimmed;
    var capitalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    return capitalized;
  }

  // Template substitution helper — replaces every {name} occurrence in a
  // template string with the capitalized display name. Returns '' for empty
  // input. Use this instead of String.prototype.replace at every call site.
  function substituteName(template, rawName) {
    if (!template) return '';
    return String(template).replace(/\{name\}/g, capitalizeName(rawName) || 'friend');
  }

  return { capitalizeName: capitalizeName, normalizeStoredName: normalizeStoredName, substituteName: substituteName };
});
