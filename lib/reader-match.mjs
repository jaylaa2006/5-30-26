// Reader speech-to-text word matching — pure functions for unit testing.
//
// The main reader in maat-reader.html is a self-contained single file
// (architecture note in CLAUDE.md), so these functions are duplicated
// there inline as App._editDist, App._fuzzyMatch, App._fuzzyMatchAlt,
// App._childSubs. Any change here must be mirrored in the HTML and
// vice versa. A consistency-check test guards the invariant.

// Common child speech recognition substitutions.
// Keys: what the child said; values: acceptable expected-word matches.
// Both directions accepted by fuzzyMatch.
export const childSubs = Object.freeze({
  'the': 'a', 'a': 'the', 'an': 'and', 'and': 'an',
  'was': 'were', 'were': 'was', 'is': 'was', 'are': 'were',
  'im': "i'm", 'dont': "don't", 'cant': "can't", 'wont': "won't",
  'its': "it's", 'thats': "that's", 'hes': "he's", 'shes': "she's",
  'theyre': "they're", 'youre': "you're", 'theyll': "they'll",
  'gonna': 'going', 'wanna': 'want', 'gotta': 'got',
});

// Levenshtein distance — O(m*n) time, O(n) space.
export function editDist(a, b){
  if(a.length === 0) return b.length;
  if(b.length === 0) return a.length;
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for(let i = 1; i <= m; i++){
    const curr = [i];
    for(let j = 1; j <= n; j++){
      curr[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j - 1], prev[j], curr[j - 1]);
    }
    prev = curr;
  }
  return prev[n];
}

// Primary fuzzy match — permissive, with child substitutions, plural/tense
// tolerance, prefix match, and length-bucketed edit distance.
export function fuzzyMatch(spoken, expected){
  if(spoken === expected) return true;
  // Common child substitutions (both directions)
  if(childSubs[spoken] === expected || childSubs[expected] === spoken) return true;
  // Plural/tense tolerance
  if(expected.endsWith('s')   && spoken === expected.slice(0, -1))  return true;
  if(spoken.endsWith('s')     && expected === spoken.slice(0, -1))   return true;
  if(expected.endsWith('ed')  && spoken === expected.slice(0, -2))   return true;
  if(expected.endsWith('ing') && spoken === expected.slice(0, -3))   return true;
  // Prefix match — strict: spoken ≥5 chars AND ≥75% of expected length
  if(spoken.length >= 5 && expected.length >= 6 && expected.startsWith(spoken) && spoken.length >= expected.length * 0.75) return true;
  if(spoken.length >= 5 && expected.length >= 6 && spoken.startsWith(expected) && expected.length >= spoken.length * 0.75) return true;
  // Edit distance — words ≤3 chars must be exact, ≤5 chars allow 1, else 2
  if(expected.length <= 3) return false;
  const maxDist = expected.length <= 5 ? 1 : 2;
  return editDist(spoken, expected) <= maxDist;
}

// Tighter match for low-confidence alternative transcripts. No child
// substitution, no plural/prefix — only exact or small edit distance.
export function fuzzyMatchAlt(spoken, expected){
  if(spoken === expected) return true;
  const maxDist = expected.length <= 4 ? 1 : 2;
  return editDist(spoken, expected) <= maxDist;
}
