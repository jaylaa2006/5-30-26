// senebty/lib/user-migration.js
// Idempotent user-shape migration for the Senebty namespace.
// Called by App.init() exactly once per page load. Safe to call repeatedly.
(function(){
  if (typeof window === 'undefined') return;
  window.Senebty = window.Senebty || {};
  window.Senebty.migrate = function senebtyMigrate(user){
    if (!user || typeof user !== 'object') return;
    if (!user.senebty){
      user.senebty = {
        tier:0,
        iriLog:[],
        iriCompletedByLesson:{},
        streakDays:0,
        longestStreak:0,
        lastRitualDate:null,
        fourTreasuresLog:[],
        dailyFoundationLog:{},
        pendingParentConfirmations:[],
        giftsUnlocked:[],
        hekaPhrasePersonal:null,
        hekaPhraseSetAt:null,
        hekaPhraseEditableByChild:true,
        introViewed:false,
        enteredAt:null,
        streakPause:{ active:false, startedAt:null, endsAt:null, daysUsedThisMonth:0, monthCounterResetAt:null },
        firstCrossSeen:false,
        firstReturnSeen:false
      };
    } else {
      // Forward-compatible field-by-field defaulting (do not overwrite live data)
      const s = user.senebty;
      if (typeof s.tier !== 'number') s.tier = 0;
      if (!Array.isArray(s.iriLog)) s.iriLog = [];
      if (!s.iriCompletedByLesson || typeof s.iriCompletedByLesson !== 'object') s.iriCompletedByLesson = {};
      if (typeof s.streakDays !== 'number') s.streakDays = 0;
      if (typeof s.longestStreak !== 'number') s.longestStreak = 0;
      if (s.lastRitualDate === undefined) s.lastRitualDate = null;
      if (!Array.isArray(s.fourTreasuresLog)) s.fourTreasuresLog = [];
      // F1 Mu Daily Ritual (Task 16) — daily foundation log keyed by YYYY-MM-DD.
      // Belt-and-suspenders with daily-foundation-gate._ensureLog().
      if (!s.dailyFoundationLog || typeof s.dailyFoundationLog !== 'object' || Array.isArray(s.dailyFoundationLog)) s.dailyFoundationLog = {};
      if (!Array.isArray(s.pendingParentConfirmations)) s.pendingParentConfirmations = [];
      if (!Array.isArray(s.giftsUnlocked)) s.giftsUnlocked = [];
      if (s.hekaPhrasePersonal === undefined) s.hekaPhrasePersonal = null;
      if (s.hekaPhraseSetAt === undefined) s.hekaPhraseSetAt = null;
      if (s.hekaPhraseEditableByChild === undefined) s.hekaPhraseEditableByChild = true;
      if (typeof s.introViewed !== 'boolean') s.introViewed = false;
      if (s.enteredAt === undefined) s.enteredAt = null;
      if (!s.streakPause || typeof s.streakPause !== 'object'){
        s.streakPause = { active:false, startedAt:null, endsAt:null, daysUsedThisMonth:0, monthCounterResetAt:null };
      }
      if (s.firstCrossSeen === undefined) s.firstCrossSeen = false;
      if (s.firstReturnSeen === undefined) s.firstReturnSeen = false;
    }
    if (user.gradeSource === undefined) user.gradeSource = null;
    // Phase v3.33.0 — Seba audio parent toggle (default on, opt-out).
    user.settings = user.settings || {};
    if (typeof user.settings.sebaVoice !== 'boolean') user.settings.sebaVoice = true;
  };
})();
