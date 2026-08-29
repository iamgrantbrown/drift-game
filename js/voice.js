/** The drift-keeper's voice. Every system message is a person, not a taxonomy.
 *  Lines rotate deterministically by day + guess, so the game feels alive but
 *  everyone sees the same words on the same day.
 *
 *  Rules for these lines: concrete over atmospheric; function first (a
 *  rejected word must read as rejected, never as scored); varied rhythm;
 *  no greeting-card poetry. Vocabulary: the notebook and the trail.
 */

const LINES = {
  ice: [
    "nothing stirring out there.",
    "still air.",
    "no wind at all that way.",
  ],
  cold: [
    "barely a tug. keep looking.",
    "the trail barely moves.",
    "cold out there. drift on.",
  ],
  cool: [
    "a faint ripple.",
    "something, far off.",
    "cooler, but it's moving.",
  ],
  warm: [
    "the trail tightens.",
    "warmer. keep going.",
    "you're in the right wind.",
  ],
  hot: [
    "it pulls now.",
    "close. the trail is warm.",
    "hot wind. stay with it.",
  ],
  scorching: [
    "nearly overhead. look up.",
    "so close it hums.",
    "right there.",
  ],
  near: [
    "a real join, but it's yesterday's. today went another way.",
    "that joins yesterday. the drift moved on.",
    "yesterday's join. try another direction.",
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
    "it got away. it drifts again tomorrow.",
    "the wind kept it. another chance tomorrow.",
  ],
  done: [
    "today's page is done. back after midnight pacific.",
  ],
};

const WIN = {
  quick: ["first line, first try.", "one guess. straight ink."],
  clean: ["a clean catch.", "caught mid-drift."],
  clue: ["the clue did its work.", "the drift showed itself, and you took it."],
};

/** Deterministic line for a message kind. Same seed -> same line. */
export function voiceLine(kind, seed = 0) {
  const pool = LINES[kind];
  if (!pool) return "";
  return pool[Math.abs(seed) % pool.length];
}

/** Win line by how the catch happened. */
export function winLine(guessCount, seed = 0) {
  const pool = guessCount <= 1 ? WIN.quick : guessCount <= 3 ? WIN.clean : WIN.clue;
  return pool[Math.abs(seed) % pool.length];
}
