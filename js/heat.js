/** Compact secret-major heat table: Uint8 [nSecrets * nWords].
 *  Values are relatedness rank (not GloVe cosine): 45 lukewarm, 60 warm, 75 hot.
 *  Unrelated guesses share one flat ice score from the baker.
 */

export function createHeatLookup(words, tableBytes) {
  const index = new Map(words.map((w, i) => [w, i]));
  const table =
    tableBytes instanceof Uint8Array ? tableBytes : new Uint8Array(tableBytes);
  const nWords = words.length;

  return {
    nWords,
    isValid(word) {
      return index.has(word);
    },
    heat(guess, secretIndex) {
      const i = index.get(guess);
      if (i === undefined) return null;
      return table[secretIndex * nWords + i];
    },
  };
}

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

const COLD_BANDS = new Set(["ice", "cold"]);

/**
 * Hotter/colder only when the heat band changes or the score jumps by 10+.
 * Same-band ice/cold twitching is "still", never hotter.
 */
export function heatTrend(heat, prev) {
  if (prev == null || heat == null) return "same";
  const delta = heat - prev;
  const band = heatLabel(heat);
  const prevBand = heatLabel(prev);
  const notable = band !== prevBand || Math.abs(delta) >= 10;
  if (!notable) {
    if (COLD_BANDS.has(band)) return "still";
    return "same";
  }
  if (delta > 0) return "hotter";
  if (delta < 0) return "colder";
  return "same";
}
