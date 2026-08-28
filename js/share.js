import { bandFor } from "./heat.js";

const BAND_EMOJI = {
  ice: "🟦",
  cold: "🟦",
  cool: "🟨",
  warm: "🟨",
  hot: "🟧",
  scorching: "🟧",
  found: "🟩",
};

export function heatBlock(heat) {
  return BAND_EMOJI[bandFor(heat)] || "🟦";
}

/** Share card intentionally omits today's word. */
export function shareText({ puzzleNumber, guesses, won, maxGuesses = 6 }) {
  const bars =
    guesses.map((g) => heatBlock(g.heat)).join("") +
    "⬜".repeat(Math.max(0, maxGuesses - guesses.length));
  const line = won ? `caught the drift in ${guesses.length}` : "it drifted away";
  return `Drift #${puzzleNumber} 🪁\n${line}\n${bars}\nhttps://iamgrantbrown.github.io/drift-game/`;
}
