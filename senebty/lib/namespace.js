// senebty/lib/namespace.js
// Bootstrap window.Senebty namespace. MUST load before any other senebty/lib/*.js.
// Idempotent — preserves any pre-existing window.Senebty values (set by tests or other libs).
(function(){
  if (typeof window === 'undefined') return;
  window.Senebty = window.Senebty || {};
  window.Senebty.version = window.Senebty.version || '0.1.0';
})();
