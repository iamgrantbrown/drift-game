/** Distance progress: sense-aware semantic relatedness, 0-100, baked at build time.
 *  v2 serves one Uint8 row per day (data/heat/NNN.bin), indexed by the
 *  shared dictionary order in data/words.json.
 */

const SUFFIXES = ["s", "es", "ed", "ing", "er"];

export function createHeatLookup(words, rowBytes, boosts = new Map(), caps = new Map()) {
  const index = new Map(words.map((w, i) => [w, i]));
  const row = rowBytes instanceof Uint8Array ? rowBytes : new Uint8Array(rowBytes);

  /** All dictionary words this guess could stand for: the word itself, then
   *  de-inflected base forms (strings -> string, baking -> bake), with
   *  British/American spelling bridges (neighbours -> neighbor) applied to
   *  every form — even intermediate forms the dictionary doesn't contain. */
  function candidates(word) {
    const raw = new Set([word]);
    const addStems = (t) => {
      for (const suf of SUFFIXES) {
        if (t.length - suf.length < 3 || !t.endsWith(suf)) continue;
        const stem = t.slice(0, -suf.length);
        raw.add(stem);
        if (stem.length >= 3 && stem[stem.length - 1] === stem[stem.length - 2]) {
          raw.add(stem.slice(0, -1)); // running -> run
        }
        raw.add(stem + "e"); // baking -> bake
      }
    };
    addStems(word);
    for (const w of [...raw]) {
      for (const v of [
        w.replace(/our/, "or"),
        w.replace(/or(?!.*or)/, "our"),
        w.replace(/re$/, "er"),
        w.replace(/er$/, "re"),
      ]) {
        if (v !== w) raw.add(v);
      }
    }
    for (const w of [...raw]) addStems(w); // stems of bridged forms
    const out = [...raw].filter((w) => index.has(w));
    // the typed word itself, when valid, stays the primary reading
    out.sort((x, y) => (x === word ? -1 : y === word ? 1 : 0));
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
      return Math.min(Math.max(row[index.get(w)], boosts.get(w) || 0), caps.get(w) ?? 100);
    },
  };
}

/**
 * Human-reviewed corrections supplement the phrase-conditioned baked row.
 * Pair data is deliberately not used here: a word can form a phrase with the
 * answer while belonging to the wrong sense for today's connection.
 */
export function calibrationBoosts(answer, corrections = {}) {
  const boosts = new Map();
  for (const [word, heat] of Object.entries(corrections[answer] || {})) {
    boosts.set(word, Math.max(boosts.get(word) || 0, heat));
  }
  return boosts;
}

export function calibrationCaps(answer, corrections = {}) {
  return new Map(Object.entries(corrections[answer] || {}));
}

/** Internal distance bands (data thresholds). */
export function distanceLabel(heat) {
  if (heat >= 100) return "found";
  if (heat >= 88) return "almost";
  if (heat >= 70) return "very-close";
  if (heat >= 50) return "close";
  if (heat >= 30) return "in-sight";
  if (heat >= 15) return "distant";
  return "far";
}

export const DISTANCE_TEXT = {
  far: "far away",
  distant: "distant",
  "in-sight": "in sight",
  close: "close",
  "very-close": "very close",
  almost: "almost there",
  found: "found",
};

export function distanceText(heat) {
  return DISTANCE_TEXT[distanceLabel(heat)];
}

export const DISTANCE_ORDER = ["far", "distant", "in-sight", "close", "very-close", "almost", "found"];

export function distanceRank(heat) {
  return DISTANCE_ORDER.indexOf(distanceLabel(heat));
}

/** One to six filled notebook dots for a valid miss; six for a find. */
export function distanceSteps(heat) {
  if (heat >= 100) return 6;
  return Math.max(1, distanceRank(heat) + 1);
}

/**
 * Trend vs the previous guess: closer/farther when the display band changes
 * or the score moves 10+. Otherwise "same" — the band chip itself carries
 * the information now, so there is no "still cold" filler state.
 */
export function distanceTrend(heat, prev) {
  if (prev == null || heat == null) return "same";
  const delta = heat - prev;
  const notable = distanceLabel(heat) !== distanceLabel(prev) || Math.abs(delta) >= 10;
  if (!notable) return "same";
  if (delta > 0) return "closer";
  if (delta < 0) return "farther";
  return "same";
}
