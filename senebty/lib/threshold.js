// senebty/lib/threshold.js
// First-discovery threshold-crossing intro. Plays once per direction, then never again.
(function(){
  if (typeof window === 'undefined') return;
  window.Senebty = window.Senebty || {};

  // Default 4500ms = full ~3s clip + ~1.5s linger so child can read Seba's copy.
  // Reduced-motion path collapses to 1000ms (shortest tolerable since the video is hidden).
  // Tap-to-dismiss-early in maat-reader.html clears the pending timer regardless.
  var DISMISS_MS = 4500;
  var DISMISS_MS_REDUCED = 1000;

  function getDismissMs(reducedMotion){
    return reducedMotion ? DISMISS_MS_REDUCED : DISMISS_MS;
  }

  function maybePlayIntro(app, direction){
    if (!app || !app.user || !app.user.senebty) return false;
    const flagKey = direction === 'outbound' ? 'firstReturnSeen' : 'firstCrossSeen';
    if (app.user.senebty[flagKey]) return false;
    app.user.senebty[flagKey] = true;
    if (typeof app.saveUser === 'function') app.saveUser();
    return true;
  }

  var COPY = {
    inbound:  'Senebty, young one. You stand at the gate of Per Ankh. Imhotep stood here once. Come.',
    outbound: 'You have iri. Now return to the scrolls. The Sunu reads as much as he heals. Come.',
  };

  function copyFor(direction){ return COPY[direction] || COPY.inbound; }

  window.Senebty.threshold = { maybePlayIntro, copyFor, getDismissMs };
})();
