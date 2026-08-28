export function heatBlock(heat) {
  if (heat >= 75) return "🟩";
  if (heat >= 45) return "🟨";
  return "🟦";
}

/** Share card intentionally omits today's word. */
export function shareText({ puzzleNumber, guesses, won, maxGuesses = 6 }) {
  const bars =
    guesses.map((g) => heatBlock(g.heat)).join("") +
    "⬜".repeat(Math.max(0, maxGuesses - guesses.length));
  const line = won ? `got it in ${guesses.length}` : "drifted away";
  return `🪁 Drift #${puzzleNumber}\n${line}\n${bars}`;
}
