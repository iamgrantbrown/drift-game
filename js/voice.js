/** The kite-flier's voice. Every system message is a person, not a taxonomy.
 *  Lines rotate deterministically by day + guess, so the game feels alive but
 *  everyone sees the same words on the same day.
 *
 *  Rules for these lines: concrete over atmospheric (a string really does hum
 *  in strong wind); function first (a rejected word must read as rejected,
 *  never as scored); varied rhythm; no greeting-card poetry.
 */

const LINES = {
  ice: [
    "nothing stirring out there.",
    "still air.",
    "no wind at all that way.",
  ],
  cold: [
    "barely a tug. keep looking.",
    "the string hardly moves.",
    "cold out there. drift on.",
  ],
  cool: [
    "a faint ripple.",
    "something, far off.",
    "cooler, but it's moving.",
  ],
  warm: [
    "the string tightens.",
    "warmer. keep going.",
    "you're in the right wind.",
  ],
  hot: [
    "it's tugging now.",
    "close. the tail is dancing.",
    "hot wind. stay with it.",
  ],
  scorching: [
    "nearly overhead. look up.",
    "so close the string hums.",
    "right there.",
  ],
  near: [
    "you're holding yesterday's string. the word moved on.",
    "that's yesterday's sky. it drifted somewhere else.",
    "close to yesterday, not to today.",
  ],
  invalid: [
    "not a word this game knows.",
    "can't fly that one.",
  ],
  duplicate: [
    "you already tried that one.",
    "that kite's already up.",
  ],
  loss: [
    "it got away. it drifts again tomorrow.",
    "the wind kept it. another chance tomorrow.",
  ],
  done: [
    "you've flown today. back after midnight pacific.",
  ],
};

const WIN = {
  quick: ["no wind needed. first try.", "one guess. the kite barely left your hand."],
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
