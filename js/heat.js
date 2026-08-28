/** Heat: semantic relatedness rank, 0-100, baked at build time.
 *  v2 serves one Uint8 row per day (data/heat/NNN.bin), indexed by the
 *  shared dictionary order in data/words.json.
 */

const SUFFIXES = ["s", "es", "ed", "ing", "er"];

export function createHeatLookup(words, rowBytes) {
  const index = new Map(words.map((w, i) => [w, i]));
  const row = rowBytes instanceof Uint8Array ? rowBytes : new Uint8Array(rowBytes);

  /** All dictionary words this guess could stand for: the word itself,
   *  then de-inflected base forms (strings -> string, baking -> bake). */
  function candidates(word) {
    const out = [];
    if (index.has(word)) out.push(word);
    for (const suf of SUFFIXES) {
      if (word.length - suf.length < 3 || !word.endsWith(suf)) continue;
      const stem = word.slice(0, -suf.length);
      if (index.has(stem) && !out.includes(stem)) out.push(stem);
      // doubled final consonant: running -> run
      const undoubled = stem.slice(0, -1);
      if (stem.length >= 3 && stem[stem.length - 1] === stem[stem.length - 2] && index.has(undoubled) && !out.includes(undoubled)) {
        out.push(undoubled);
      }
      // dropped e: baking -> bake
      if (index.has(stem + "e") && !out.includes(stem + "e")) out.push(stem + "e");
    }
    // British/American spelling bridges: colour<->color, theatre<->theater
    for (const w of [...out, word]) {
      for (const v of [
        w.replace(/our/, "or"),
        w.replace(/or(?!.*or)/, "our"),
        w.replace(/re$/, "er"),
        w.replace(/er$/, "re"),
      ]) {
        if (v !== w && index.has(v) && !out.includes(v)) out.push(v);
      }
    }
    return out;
  }

  function resolve(word) {
    return candidates(word)[0] ?? null;
  }

  return {
    nWords: words.length,
    candidates,
    resolve,
    isValid(word) {
      return resolve(word) !== null;
    },
    heat(guess) {
      const w = resolve(guess);
      if (w === null) return null;
      return row[index.get(w)];
    },
  };
}

/** Internal bands (data thresholds). */
export function heatLabel(heat) {
  if (heat >= 100) return "found";
  if (heat >= 90) return "scorching";
  if (heat >= 75) return "hot";
  if (heat >= 60) return "warm";
  if (heat >= 45) return "lukewarm";
  if (heat >= 30) return "cool";
  if (heat >= 15) return "cold";
  return "ice";
}

/** Display band: lukewarm folds into warm — six visible steps. */
export function bandFor(heat) {
  const label = heatLabel(heat);
  return label === "lukewarm" ? "warm" : label;
}

export const BAND_ORDER = ["ice", "cold", "cool", "warm", "hot", "scorching", "found"];

export function bandRank(heat) {
  return BAND_ORDER.indexOf(bandFor(heat));
}

/**
 * Trend vs the previous guess: hotter/colder when the display band changes
 * or the score moves 10+. Otherwise "same" — the band chip itself carries
 * the information now, so there is no "still cold" filler state.
 */
export function heatTrend(heat, prev) {
  if (prev == null || heat == null) return "same";
  const delta = heat - prev;
  const notable = bandFor(heat) !== bandFor(prev) || Math.abs(delta) >= 10;
  if (!notable) return "same";
  if (delta > 0) return "hotter";
  if (delta < 0) return "colder";
  return "same";
}
