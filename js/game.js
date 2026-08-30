import { heatTrend } from "./heat.js";

export const MAX_GUESSES = 6;
export const FIRST_HINT_AFTER = 3;
export const SECOND_HINT_AFTER = 4;
export const MAX_HINTS = 2;

// Alternative pairing: the guess forms a familiar unit with yesterday's word
// (tin -> tin can) but scores cold against today. Detected by exact pair
// lookup, never by heat.
export const NEAR_TODAY_MAX = 30;

export function createState(chainEntries, index) {
  const n = chainEntries.length;
  const dayIndex = ((index % n) + n) % n;
  const entry = chainEntries[dayIndex];
  return {
    dayIndex,
    today: entry.w,
    pivot: entry.pivot,
    yesterday: chainEntries[(dayIndex - 1 + n) % n].w,
    guesses: [],
    hintsUsed: 0,
    won: false,
    lost: false,
  };
}

export function normalizeGuess(raw) {
  return String(raw || "").trim().toLowerCase();
}

/** Optional hints unlock in stages; they never appear without a player click. */
export function hintAvailable(state) {
  if (state.won || state.lost || state.hintsUsed >= MAX_HINTS) return false;
  const needed = state.hintsUsed === 0 ? FIRST_HINT_AFTER : SECOND_HINT_AFTER;
  return state.guesses.length >= needed;
}

export function useHint(state) {
  if (!hintAvailable(state)) return { ok: false, state };
  return { ok: true, state: { ...state, hintsUsed: state.hintsUsed + 1 } };
}

export function hintText(state, stage = state.hintsUsed) {
  if (stage <= 0) return "";
  if (stage === 1) return `${state.today.length} letters.`;
  return `It completes: ${blankPivot(state.pivot, state.today)}`;
}

const PIVOT_SUFFIXES = ["s", "es", "ed", "ing", "er"];

function stemsOf(token) {
  const out = [token];
  for (const suf of PIVOT_SUFFIXES) {
    if (!token.endsWith(suf) || token.length - suf.length < 3) continue;
    const stem = token.slice(0, -suf.length);
    out.push(stem);
    if (stem[stem.length - 1] === stem[stem.length - 2]) out.push(stem.slice(0, -1));
    out.push(stem + "e");
  }
  return out;
}

/**
 * The pivot phrase with the secret blanked: "a fence between neighbors"
 * -> "a fence between ______". Inflections blank fully; compounds blank
 * just the secret ("a sheepdog" -> "a sheep___").
 */
export function blankPivot(pivot, word) {
  const BLANK = "______";
  let hit = false;
  const tokens = pivot.split(" ").map((tok) => {
    const core = tok.toLowerCase().replace(/’/g, "'").replace(/'s$/, "").replace(/[^a-z]/g, "");
    if (!core || !stemsOf(core).includes(word)) return tok;
    hit = true;
    return tok.replace(/[A-Za-z]+/, BLANK);
  });
  if (hit) return tokens.join(" ");
  // compound fallback: blank the secret inside a longer token
  return pivot
    .split(" ")
    .map((tok) => {
      if (hit) return tok;
      const core = tok.toLowerCase();
      if (word.length >= 3 && core.includes(word)) {
        hit = true;
        return tok.replace(new RegExp(word, "i"), "_".repeat(word.length));
      }
      return tok;
    })
    .join(" ");
}

/** Best heat reached so far (0 when no guesses). Drives the kite + sky. */
export function bestHeat(state) {
  return state.guesses.reduce((m, g) => Math.max(m, g.heat), 0);
}

/**
 * Apply a guess. Heat is semantic (per-day baked row), never edit distance.
 * Inflections resolve to their base word (strings -> string) and count as
 * that word. The first guess has no comparison arrow.
 * `joins` is the Set of words known to pair with yesterday's word; a cold
 * guess in that set receives the explicit alternative-pairing explanation.
 */
export function applyGuess(state, rawGuess, lookup, joins = null) {
  if (state.won || state.lost) {
    return { ok: false, reason: "over", state };
  }
  const typed = normalizeGuess(rawGuess);
  if (!/^[a-z]+$/.test(typed)) {
    return { ok: false, reason: "invalid", state };
  }
  // Any base form matching the secret wins ("strings" catches "string" even
  // when "strings" is a dictionary word of its own).
  const forms = lookup.candidates(typed);
  if (forms.length === 0) {
    return { ok: false, reason: "invalid", state };
  }
  const word = forms.includes(state.today) ? state.today : forms[0];
  if (state.guesses.some((g) => g.word === word)) {
    return { ok: false, reason: "duplicate", state };
  }
  const heat = word === state.today ? 100 : lookup.heat(word);
  const prev = state.guesses.length === 0 ? null : state.guesses[state.guesses.length - 1].heat;
  const trend = heatTrend(heat, prev);
  const won = word === state.today;
  const near = !won && heat < NEAR_TODAY_MAX && joins !== null && joins.has(word);
  const guesses = [...state.guesses, { word, heat, trend, near }];
  const lost = !won && guesses.length >= MAX_GUESSES;
  const next = { ...state, guesses, won, lost };
  let reason = "continue";
  if (won) reason = "win";
  else if (lost) reason = "lose";
  return { ok: true, reason, state: next, heat, trend };
}
