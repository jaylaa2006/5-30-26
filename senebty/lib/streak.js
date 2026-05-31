// senebty/lib/streak.js
// Streak engine — UTC day-math, monthly pause, ritual recording.
// Loads AFTER iri.js; merges streak methods into window.Senebty.iri.
(function(){
  if (typeof window === 'undefined') return;
  if (!window.Senebty || !window.Senebty.iri) {
    throw new Error('senebty/lib/streak.js loaded before iri.js — fix script order in maat-reader.html');
  }
  Object.assign(window.Senebty.iri, {
    _ymd(ms){
      const d = new Date(ms);
      return d.getUTCFullYear() * 10000 + (d.getUTCMonth()+1) * 100 + d.getUTCDate();
    },
    _ym(ms){
      const d = new Date(ms);
      return d.getUTCFullYear() * 100 + (d.getUTCMonth()+1);
    },
    _resolveStreakPause(now){
      const sp = this.user.senebty.streakPause;
      if (!sp.monthCounterResetAt || this._iri._ym(sp.monthCounterResetAt) !== this._iri._ym(now)){
        sp.daysUsedThisMonth = 0;
        sp.monthCounterResetAt = now;
      }
      if (sp.active && sp.endsAt && now >= sp.endsAt){
        sp.active = false;
      }
    },
    _wasInPauseWindow(prevRitualMs, nowMs){
      const sp = this.user.senebty.streakPause;
      if (!sp.startedAt || !sp.endsAt) return false;
      const oneDay = 24*3600*1000;
      // Pause window must overlap the gap between prev ritual and now (±1 day grace)
      return sp.startedAt <= (prevRitualMs + oneDay) && sp.endsAt >= (nowMs - oneDay);
    },
    // Pause meter increment — called by future pause-start UI
    incrementPauseDays(days, now){
      this._iri._resolveStreakPause.call(this, now);
      const sp = this.user.senebty.streakPause;
      sp.daysUsedThisMonth = Math.min(3, sp.daysUsedThisMonth + days);
      this.saveUser();
      return sp.daysUsedThisMonth;
    },
    recordRitualToday(opts){
      const now = (opts && opts.now) || Date.now();
      this._iri._resolveStreakPause.call(this, now);
      const todayY = this._iri._ymd(now);
      const lastY = this.user.senebty.lastRitualDate ? this._iri._ymd(this.user.senebty.lastRitualDate) : null;
      if (lastY === todayY) return { streakDays: this.user.senebty.streakDays, changed:false };
      let nextStreak;
      if (lastY === null){
        nextStreak = 1;
      } else {
        const oneDayMs = 24*3600*1000;
        const expectedNext = this._iri._ymd(this.user.senebty.lastRitualDate + oneDayMs);
        if (todayY === expectedNext){
          nextStreak = this.user.senebty.streakDays + 1;
        } else if (this._iri._wasInPauseWindow.call(this, this.user.senebty.lastRitualDate, now)){
          nextStreak = this.user.senebty.streakDays + 1;
        } else {
          nextStreak = 1;
        }
      }
      this.user.senebty.streakDays = nextStreak;
      if (nextStreak > this.user.senebty.longestStreak) this.user.senebty.longestStreak = nextStreak;
      this.user.senebty.lastRitualDate = now;
      this._iri._checkTierAdvancement.call(this);
      this.saveUser();
      return { streakDays: nextStreak, changed:true };
    },
    computeStreakDelta(opts){
      const now = (opts && opts.now) || Date.now();
      const lastY = this.user.senebty.lastRitualDate ? this._iri._ymd(this.user.senebty.lastRitualDate) : null;
      const todayY = this._iri._ymd(now);
      if (lastY === todayY) return { delta:0, willResetTo:null };
      if (lastY === null) return { delta:1, willResetTo:null };
      const oneDayMs = 24*3600*1000;
      const expectedNext = this._iri._ymd(this.user.senebty.lastRitualDate + oneDayMs);
      if (todayY === expectedNext) return { delta:1, willResetTo:null };
      if (this._iri._wasInPauseWindow.call(this, this.user.senebty.lastRitualDate, now)) return { delta:1, willResetTo:null };
      return { delta:0, willResetTo:1 };
    }
  });
})();
