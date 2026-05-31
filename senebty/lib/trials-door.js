// senebty/lib/trials-door.js
// Imhotep's Trials stub door. Reachable when user crosses to Shemes-Imhotep tier.
(function(){
  if (typeof window === 'undefined') return;
  window.Senebty = window.Senebty || {};
  window.Senebty.trialsDoor = {
    open(){
      if (typeof window.App !== 'undefined' && typeof window.App.nav === 'function'){
        window.App.nav('imhotepTrials');
      }
    },
  };
})();
