// senebty/lib/daily-ritual.js
// Daily Senebty Ritual orchestration. 4 steps:
//   1. Sema breath (60s) — reuses _buildSemaChrome({variant:'breathing'})
//   2. Power Word of the day — VOICE_IRI 3× recitation, score-only Azure
//   3. Four Treasures self-rate — 3-state kid-glyph rating per Imani binding
//   4. Seal — "Senebty. I iri today." canonical (tone canon §86)
// Imani binding: tier modal NEVER fires mid-ritual; defer to ritual close.
(function(){
  if (typeof window === 'undefined') return;
  window.Senebty = window.Senebty || {};

  // Power Word rotation — 5-slot fallback default until M5 RT locks cardinality
  // M5 reads docs/superpowers/specs/2026-05-04-senebty-power-word-pronunciation.md
  // (M1 RT 2026-05-04 verdict: 5-slot fallback locked since Tjau/Hesi NONE)
  const POWER_WORDS_FALLBACK = ['SENEB','MU','KHAT','SENEDJEM','HEKA'];

  function start(){
    window.Senebty.tierModal._activeRitual = true;
    showStep(1);
  }

  function close(){
    window.Senebty.tierModal._activeRitual = false;
    if (window.Senebty.tierModal && typeof window.Senebty.tierModal.flushQueue === 'function'){
      window.Senebty.tierModal.flushQueue();
    }
    if (typeof window.App !== 'undefined' && typeof window.App.nav === 'function'){
      window.App.nav('senebty');
    }
  }

  // v3.51.24 — cinematic step transition (completes the v3.51.22 daily-ritual
  // ship: CSS opacity transition landed but display:none→block jump-cut past it.
  // JS now: hide-all → reveal-with-opacity:0 → next frame → opacity:1 so the
  // CSS transition animates 0→1. prefers-reduced-motion → instant swap.
  function showStep(n){
    const screen = document.getElementById('senebtyDaily');
    if (!screen) return;
    const steps = screen.querySelectorAll('[data-ritual-step]');
    steps.forEach(el => { el.style.display = 'none'; el.style.opacity = '0'; });
    const target = screen.querySelector(`[data-ritual-step="${n}"]`);
    if (target) {
      target.style.display = 'block';
      const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reducedMotion) {
        target.style.opacity = '1';
      } else {
        // Double rAF so the browser commits display:block before opacity flip,
        // letting the CSS transition animate from 0 → 1.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => { target.style.opacity = '1'; });
        });
      }
    }
    const banner = screen.querySelector('.senebty-ritual-banner');
    if (banner) banner.textContent = `Daily Senebty Ritual · Step ${n} of 4`;
  }

  function powerWordOfDay(){
    const day = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
    return POWER_WORDS_FALLBACK[day % POWER_WORDS_FALLBACK.length];
  }

  function recordTreasureRating(treasure, rating){
    if (!['weak','holding','strong'].includes(rating)) return;
    const u = window.App && window.App.user;
    if (!u || !u.senebty) return;
    if (!Array.isArray(u.senebty.fourTreasuresLog)) u.senebty.fourTreasuresLog = [];
    const today = new Date().toISOString().slice(0,10);
    let row = u.senebty.fourTreasuresLog.find(r => r.date === today);
    if (!row){ row = { date: today, khat:null, ib:null, ka:null, ba:null }; u.senebty.fourTreasuresLog.push(row); }
    row[treasure] = rating;
    if (typeof window.App.saveUser === 'function') window.App.saveUser();
  }

  function tapSeal(){
    if (window.App && typeof window.App.recordRitualToday === 'function'){
      window.App.recordRitualToday();
    } else if (window.Senebty.streak && typeof window.Senebty.streak.recordRitualToday === 'function'){
      window.Senebty.streak.recordRitualToday.call({ user: window.App && window.App.user, saveUser: window.App && window.App.saveUser });
    }
    close();
  }

  window.Senebty.dailyRitual = {
    start, close, showStep, powerWordOfDay, recordTreasureRating, tapSeal,
    _POWER_WORDS_FALLBACK: POWER_WORDS_FALLBACK,
  };
})();
