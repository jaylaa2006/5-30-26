// senebty/lib/elder-hint-dispatcher.js — Phase v3.34.0
// Pure-function dispatcher for elder-hint pool selection + override resolution.
// Spec: docs/superpowers/specs/2026-04-28-elder-hint-v2.md §F + §G
(function(){
  // Build pool key: pool/<persona>/<register>.<virtue>.<slot>
  // For comprehension (no virtue): pool/<persona>/<register>.<slot>
  function buildPoolKey(persona, register, virtue, slot){
    var parts = [register];
    if (virtue) parts.push(virtue);
    parts.push(slot);
    return 'pool/' + persona + '/' + parts.join('.');
  }

  // Build hint ID per spec §G.2
  function buildHintId(source){
    var args = Array.prototype.slice.call(arguments, 1);
    if (source === 'pool'){
      // args: [poolKey, index]
      return args[0] + '/' + args[1];
    }
    if (source === 'ai'){
      // args: [requestId]
      var reqId = String(args[0] || '');
      return 'ai/' + reqId.slice(0, 8);
    }
    if (source === 'curated'){
      // args: [storyId, slotKey]  OR  [storyId, slotKey, index]
      if (args.length === 2){
        return 'curated/' + args[0] + '/' + args[1];
      }
      return 'curated/' + args[0] + '/' + args[1] + '/' + args[2];
    }
    throw new Error('unknown source: ' + source);
  }

  // Build a plain object whose prototype matches the caller's realm.
  // Without this, cross-realm assert.deepStrictEqual rejects values that
  // have identical structure but a different Object.prototype (vm sandbox).
  function plainObj(refObj){
    var Ctor = (refObj && refObj.constructor) || Object;
    return new Ctor();
  }

  // Fisher-Yates picker with no-repeat-until-exhausted reset.
  // Returns { text, id } or null.
  function pickElderHint(pool, slotKey, seenSet){
    if (!Array.isArray(pool) || pool.length === 0) return null;
    var candidates = pool.map(function(text, idx){
      var c = plainObj(pool);
      c.text = text;
      c.id = slotKey + '/' + idx;
      return c;
    });
    var fresh = candidates.filter(function(c){ return !seenSet.has(c.id); });
    if (fresh.length === 0){
      // Pool exhausted — reset and pick fresh
      seenSet.clear();
      var picked = candidates[Math.floor(Math.random() * candidates.length)];
      seenSet.add(picked.id);
      return picked;
    }
    var pick = fresh[Math.floor(Math.random() * fresh.length)];
    seenSet.add(pick.id);
    return pick;
  }

  // Per-story override resolver — chunk-specific > story-array > null
  function resolveOverride(story, register, virtue, slot, chunkId){
    if (!story || !story.elderHintOverrides) return null;
    var overrides = story.elderHintOverrides;

    // Build slot key — virtue is optional (comprehension may skip it)
    var slotKey = virtue ? (register + '.' + virtue + '.' + slot) : (register + '.' + slot);

    // 1. Chunk-specific override (single string, wins)
    if (chunkId != null){
      var chunkKey = slotKey + '.chunk-' + chunkId;
      if (typeof overrides[chunkKey] === 'string'){
        var r1 = plainObj(story);
        r1.type = 'chunk';
        r1.text = overrides[chunkKey];
        r1.sourceTag = 'curated';
        return r1;
      }
    }

    // 2. Story-array override (array, picked via Fisher-Yates by caller)
    if (Array.isArray(overrides[slotKey])){
      var r2 = plainObj(story);
      r2.type = 'array';
      r2.pool = overrides[slotKey];
      r2.slotKey = slotKey;
      r2.sourceTag = 'curated';
      return r2;
    }

    return null;
  }

  function makeDispatcher(){
    return {
      buildPoolKey: buildPoolKey,
      buildHintId: buildHintId,
      pickElderHint: pickElderHint,
      resolveOverride: resolveOverride
    };
  }

  // Bind to whichever global is present.
  // - Browser: window is the global; window.Senebty namespace.
  // - Test sandbox (vm.createContext({ window: {}, Senebty: {} })):
  //     window is a plain object, Senebty is also a plain object.
  //     We attach to BOTH so either lookup path resolves.
  if (typeof window !== 'undefined'){
    window.Senebty = window.Senebty || {};
    window.Senebty.elderHintDispatcher = makeDispatcher();
  }
  if (typeof Senebty !== 'undefined'){
    Senebty.elderHintDispatcher = makeDispatcher();
  }
})();
