/** Compact secret-major heat table: Uint8 [nSecrets * nWords]. */

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
