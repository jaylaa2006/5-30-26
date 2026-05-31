// senebty/lib/iri.js
// IRI verification engine for Per Ankh Senebty.
// Methods called as App._iri.<name>.call(App, ...) — `this` is App.
// Tone-canon copy lives in skills/docs/project/seba-voice-senebty.md.
(function(){
  if (typeof window === 'undefined') return;
  window.Senebty = window.Senebty || {};
  window.Senebty.iri = {
    TYPES: Object.freeze({
      BREATH_IRI:    { id:'BREATH_IRI',    label:'Breath',    parentConfirmDefault:false },
      VOICE_IRI:     { id:'VOICE_IRI',     label:'Voice',     parentConfirmDefault:false },
      WATER_IRI:     { id:'WATER_IRI',     label:'Water',     parentConfirmDefault:false },
      PHOTO_IRI:     { id:'PHOTO_IRI',     label:'Photo',     parentConfirmDefault:true  },
      STREAK_IRI:    { id:'STREAK_IRI',    label:'Streak',    parentConfirmDefault:false },
      CREATION_IRI:  { id:'CREATION_IRI',  label:'Creation',  parentConfirmDefault:true  },
      TEACHING_IRI:  { id:'TEACHING_IRI',  label:'Teaching',  parentConfirmDefault:true  },
      BODY_IRI:      { id:'BODY_IRI',      label:'Body',      parentConfirmDefault:true  }
    }),
    record(entry){
      const t = entry && entry.type;
      if (!t || !this._iri.TYPES[t]) throw new Error('unknown iri type: ' + t);
      const lessonId = entry.lessonId || null;
      const ts = entry.ts || Date.now();
      const payload = entry.payload || {};
      const needsParent = entry.parentConfirmRequired === true
        || (entry.parentConfirmRequired !== false && this._iri.TYPES[t].parentConfirmDefault);
      const rec = { type:t, lessonId, ts, payload, confirmed: !needsParent };
      this.user.senebty.iriLog.push(rec);
      if (needsParent){
        const pendingId = 'pend_' + ts + '_' + Math.random().toString(36).slice(2,8);
        this.user.senebty.pendingParentConfirmations.push({ id: pendingId, type:t, lessonId, ts, payload });
      } else if (lessonId){
        this.user.senebty.iriCompletedByLesson[lessonId] = t;
      }
      this._iri._checkTierAdvancement.call(this);
      this.saveUser();
      return rec;
    },
    isCompleted(lessonId){
      return Boolean(this.user.senebty.iriCompletedByLesson[lessonId]);
    },
    getTierProgress(){
      const tierIdx = this.user.senebty.tier|0;
      const current = window.Senebty.tiers[tierIdx];
      const next = window.Senebty.tiers[tierIdx + 1] || null;
      const gateMet = next ? this._iri._gateSatisfied.call(this, next.gate) : false;
      return { currentTierKey: current.key, nextTierKey: next ? next.key : null, gateMet };
    },
    _gateSatisfied(gate){
      if (!gate || gate.type === 'entry') return true;
      const s = this.user.senebty;
      if (gate.type === 'iriCount') return s.iriLog.filter(r => r.confirmed).length >= gate.value;
      if (gate.type === 'foundationsCompleted'){
        const lessons = Object.keys(s.iriCompletedByLesson).filter(k => /^foundation-\d+$/.test(k));
        return lessons.length >= gate.value;
      }
      if (gate.type === 'streakDays') return s.streakDays >= gate.value;
      if (gate.type === 'teachingIri') return s.iriLog.filter(r => r.type === 'TEACHING_IRI' && r.confirmed).length >= gate.value;
      if (gate.type === 'composite'){
        return gate.requires.every(reqKey => {
          const reqIdx = window.Senebty.tiers.findIndex(t => t.key === reqKey);
          return s.tier >= reqIdx;
        });
      }
      return false;
    },
    _checkTierAdvancement(){
      const tierIdx = this.user.senebty.tier|0;
      const next = window.Senebty.tiers[tierIdx + 1];
      if (!next) return null;
      if (this._iri._gateSatisfied.call(this, next.gate)){
        this.user.senebty.tier = tierIdx + 1;
        if (this.user.senebty.tier === 1 && !this.user.senebty.enteredAt){
          this.user.senebty.enteredAt = Date.now();
        }
        return next.key;
      }
      return null;
    },
    pendingForParent(){
      return this.user.senebty.pendingParentConfirmations.slice();
    },
    parentConfirm(pendingId, parentEvidence){
      const pending = this.user.senebty.pendingParentConfirmations;
      const idx = pending.findIndex(p => p.id === pendingId);
      if (idx === -1) return false;
      const p = pending[idx];
      pending.splice(idx, 1);
      const logRec = this.user.senebty.iriLog.find(r => r.ts === p.ts && r.type === p.type && r.lessonId === p.lessonId && !r.confirmed);
      if (logRec){
        logRec.confirmed = true;
        if (parentEvidence && parentEvidence.sentence) logRec.parentSentence = parentEvidence.sentence;
      }
      if (p.lessonId) this.user.senebty.iriCompletedByLesson[p.lessonId] = p.type;
      this._iri._checkTierAdvancement.call(this);
      this.saveUser();
      return true;
    },
  };
})();
