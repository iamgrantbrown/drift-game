/** Ladder rules. Six consecutive chain words: the ends are shown, the four
 *  rungs between are blank. A rung locks when the typed word joins both of
 *  its neighbours into a word or phrase. Pure functions, no DOM.
 */

export const RUNGS = 4;
// Today's bottom word is tomorrow's top: the ladder continues, and no
// rung is ever shown a day early.
export const STRIDE = RUNGS + 1;
export const HINT_LENGTH_AFTER = 2;
export const HINT_LETTER_AFTER = 4;

/** The six chain entries for ladder k, wrapping around the chain. */
export function ladderWindow(chainEntries, k) {
  const n = chainEntries.length;
  const start = ((((k * STRIDE) % n) + n) % n);
  return Array.from({ length: RUNGS + 2 }, (_, j) => chainEntries[(start + j) % n]);
}

export function createLadder(chainEntries, k) {
  const window = ladderWindow(chainEntries, k);
  const words = window.map((e) => e.w);
  return {
    k,
    top: words[0],
    bottom: words[words.length - 1],
    answers: words.slice(1, -1),
    // pivots[j] is the phrase joining column word j and j+1
    pivots: window.slice(1).map((e) => e.pivot),
    rungs: Array.from({ length: RUNGS }, () => ({ word: null, tries: 0, hints: 0, misses: [] })),
    solved: false,
  };
}

/** Order-insensitive lookup of known pairings and the phrase they make. */
export function createPairIndex(pairList, chainEntries = []) {
  const phrases = new Map();
  const words = new Set();
  const key = (a, b) => `${a}|${b}`;
  for (const [a, b, unit] of pairList) {
    phrases.set(key(a, b), unit || `${a} ${b}`);
    words.add(a);
    words.add(b);
  }
  // the chain's own links carry the authored phrase (closed compounds included)
  for (let i = 0; i < chainEntries.length; i++) {
    const prev = chainEntries[(i - 1 + chainEntries.length) % chainEntries.length];
    phrases.set(key(prev.w, chainEntries[i].w), chainEntries[i].pivot);
    words.add(chainEntries[i].w);
  }
  return {
    words,
    has(a, b) {
      return phrases.has(key(a, b)) || phrases.has(key(b, a));
    },
    phrase(a, b) {
      return phrases.get(key(a, b)) ?? phrases.get(key(b, a)) ?? null;
    },
  };
}

/** Column word at position j (0 = top, RUNGS + 1 = bottom), null while blank. */
export function columnWord(state, j) {
  if (j === 0) return state.top;
  if (j === RUNGS + 1) return state.bottom;
  return state.rungs[j - 1].word;
}

/** Phrase for link j (between column words j and j+1) once both are known. */
export function linkPhrase(state, j, index) {
  const a = columnWord(state, j);
  const b = columnWord(state, j + 1);
  if (!a || !b) return null;
  const intendedA = j === 0 || a === state.answers[j - 1];
  const intendedB = j === RUNGS || b === state.answers[j];
  if (intendedA && intendedB) return state.pivots[j];
  return index.phrase(a, b);
}

const BLANK = "______";

/** Which word comes first in the phrase that joins a and b. */
function phraseOrder(phrase, a, b) {
  const flat = ` ${phrase.toLowerCase()} `;
  const ia = flat.indexOf(a);
  const ib = flat.indexOf(b);
  if (ia < 0 || ib < 0) return [a, b];
  return ia <= ib ? [a, b] : [b, a];
}

/**
 * What to write between column words j and j+1:
 *   phrase  both words known, the unit they make ("capital letter")
 *   blank   one word known, written on its own side ("capital ______")
 *   none    neither known yet
 * The blank never reveals the missing word's length or whether the unit
 * is closed: it is always six underscores and always spaced.
 */
export function linkClue(state, j, index) {
  const above = columnWord(state, j);
  const below = columnWord(state, j + 1);
  if (above && below) {
    const phrase = linkPhrase(state, j, index);
    return phrase ? { kind: "phrase", text: phrase } : { kind: "none" };
  }
  if (!above && !below) return { kind: "none" };
  // the missing side is read as its intended answer to learn the order
  const a = above ?? state.answers[j - 1];
  const b = below ?? state.answers[j];
  const intendedA = j === 0 || a === state.answers[j - 1];
  const intendedB = j === RUNGS || b === state.answers[j];
  const phrase = intendedA && intendedB ? state.pivots[j] : index.phrase(a, b);
  if (!phrase) return { kind: "none" };
  const [first, second] = phraseOrder(phrase, a, b);
  const known = above ?? below;
  const text = first === known ? `${known} ${BLANK}` : `${BLANK} ${known}`;
  return { kind: "blank", text };
}

export function normalizeWord(raw) {
  return String(raw || "").trim().toLowerCase();
}

export function tryRung(state, i, raw, dict, index) {
  if (state.solved) return { ok: false, reason: "solved", state };
  const rung = state.rungs[i];
  if (!rung || rung.word) return { ok: false, reason: "locked", state };
  const word = normalizeWord(raw);
  if (!/^[a-z]+$/.test(word) || !(dict.has(word) || index.words.has(word))) {
    return { ok: false, reason: "invalid", state };
  }
  if (rung.misses.some((m) => m.word === word)) {
    return { ok: false, reason: "duplicate", state };
  }
  const answer = state.answers[i];
  const above = i === 0 ? state.top : state.answers[i - 1];
  const below = i === RUNGS - 1 ? state.bottom : state.answers[i + 1];
  const intended = word === answer;
  const joinsAbove = intended || index.has(above, word);
  const joinsBelow = intended || index.has(word, below);
  const phraseAbove = joinsAbove ? (intended ? state.pivots[i] : index.phrase(above, word)) : null;
  const phraseBelow = joinsBelow ? (intended ? state.pivots[i + 1] : index.phrase(word, below)) : null;
  const lock = joinsAbove && joinsBelow;
  const result = lock ? "lock" : joinsAbove ? "above" : joinsBelow ? "below" : "neither";
  const nextRung = {
    ...rung,
    tries: rung.tries + 1,
    word: lock ? word : null,
    misses: lock ? rung.misses : [...rung.misses, { word, side: result }],
  };
  const rungs = state.rungs.map((r, j) => (j === i ? nextRung : r));
  const solved = rungs.every((r) => r.word);
  return {
    ok: true,
    result,
    word,
    phraseAbove,
    phraseBelow,
    state: { ...state, rungs, solved },
  };
}

/** 0: no hint yet. 1: letter count. 2: first letter. Locked rungs need none. */
export function hintStage(rung) {
  if (rung.word) return 0;
  if (rung.misses.length >= HINT_LETTER_AFTER) return 2;
  if (rung.misses.length >= HINT_LENGTH_AFTER) return 1;
  return 0;
}

export function useRungHint(state, i) {
  const rung = state.rungs[i];
  if (!rung || rung.hints >= hintStage(rung)) return { ok: false, state };
  const rungs = state.rungs.map((r, j) => (j === i ? { ...r, hints: r.hints + 1 } : r));
  return { ok: true, state: { ...state, rungs } };
}

export function hintText(state, i) {
  const rung = state.rungs[i];
  if (!rung || rung.hints === 0) return "";
  const answer = state.answers[i];
  const blanks = [...answer].map(() => "_");
  if (rung.hints >= 2) blanks[0] = answer[0];
  return blanks.join(" ");
}

export function totalTries(state) {
  return state.rungs.reduce((n, r) => n + r.tries, 0);
}

export function totalHints(state) {
  return state.rungs.reduce((n, r) => n + r.hints, 0);
}

function rungGlyph(rung) {
  if (!rung.word) return "⬜";
  if (rung.tries <= 1) return "🟩";
  if (rung.tries <= 3) return "🟨";
  return "🟧";
}

/** Share card: ends, tries, one glyph per rung. Never the rung words. */
export function ladderShareText({ puzzleNumber, state, url, title = "Rungs" }) {
  const tries = totalTries(state);
  const hints = totalHints(state);
  const line = `${state.top} to ${state.bottom} · ${tries} ${tries === 1 ? "try" : "tries"}${hints ? ` · ${"💡".repeat(hints)}` : ""}`;
  return `${title} #${puzzleNumber} 🪜\n${line}\n${state.rungs.map(rungGlyph).join("")}\n${url}`;
}
