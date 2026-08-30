/** The drift-keeper's voice. Every system message is a person, not a taxonomy.
 *  Lines rotate deterministically by day + guess, so the game feels alive but
 *  everyone sees the same words on the same day.
 *
 *  Rules for these lines: concrete over atmospheric; function first (a
 *  rejected word must read as rejected, never as scored); varied rhythm;
 *  no greeting-card poetry. Vocabulary: the notebook and the trail.
 */

const LINES = {
  far: [
    "the kite is far away.",
    "far from today’s word.",
    "still drifting far out.",
  ],
  distant: [
    "still at a distance.",
    "a faint tug, but far off.",
    "the line barely moves.",
  ],
  "in-sight": [
    "the kite is in sight.",
    "you can feel the line now.",
    "a connection is coming into view.",
  ],
  close: [
    "the line is tightening.",
    "close. keep reeling it in.",
    "you’re closing the distance.",
  ],
  "very-close": [
    "very close. keep the line steady.",
    "you’re reeling it in.",
    "nearly within reach.",
  ],
  almost: [
    "almost there.",
    "within reach now.",
    "one small pull away.",
  ],
  invalid: [
    "not a word this game knows.",
    "can't write that one.",
  ],
  duplicate: [
    "you already tried that one.",
    "that one's already on the page.",
  ],
  loss: [
    "You used all six guesses. The answer is below.",
  ],
  done: [
    "today's page is done. back after midnight pacific.",
  ],
};

const WIN = {
  quick: ["first line, first try.", "one guess. straight ink."],
  clean: ["a clean catch.", "caught mid-drift."],
  late: ["you followed it home.", "the trail opened up, and you took it."],
};

/** Deterministic line for a message kind. Same seed -> same line. */
export function voiceLine(kind, seed = 0) {
  const pool = LINES[kind];
  if (!pool) return "";
  return pool[Math.abs(seed) % pool.length];
}

/** Win line by how the catch happened. */
export function winLine(guessCount, seed = 0) {
  const pool = guessCount <= 1 ? WIN.quick : guessCount <= 3 ? WIN.clean : WIN.late;
  return pool[Math.abs(seed) % pool.length];
}
