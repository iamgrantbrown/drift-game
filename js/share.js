import { distanceLabel } from "./heat.js";

const DISTANCE_EMOJI = {
  far: "🟦",
  distant: "🟦",
  "in-sight": "🟨",
  close: "🟨",
  "very-close": "🟧",
  almost: "🟧",
  found: "🟩",
};

export function resultBlock(guess) {
  if (guess.alternative ?? guess.near) return "🔗";
  return DISTANCE_EMOJI[distanceLabel(guess.heat)] || "🟦";
}

/** Share card intentionally omits today's word. */
export function shareText({ puzzleNumber, guesses, won, hintsUsed = 0, maxGuesses = 6 }) {
  const bars =
    guesses.map(resultBlock).join("") +
    "⬜".repeat(Math.max(0, maxGuesses - guesses.length));
  const line = won ? `caught the drift in ${guesses.length}` : "it drifted away";
  const hints = hintsUsed ? ` · ${"💡".repeat(hintsUsed)}` : "";
  return `Drift #${puzzleNumber} 🪁\n${line}${hints}\n${bars}\nhttps://iamgrantbrown.github.io/drift-game/`;
}
