import { heatTrend } from "./heat.js";

export const MAX_GUESSES = 6;
export const CLUE_AFTER = 3; // misses before the blanked pivot clue appears

// "near yesterday": ice/cold vs today, but hot vs yesterday's word —
// right anchor, wrong branch.
export const NEAR_TODAY_MAX = 30;
export const NEAR_PREV_MIN = 60;

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
    won: false,
    lost: false,
  };
}

export function normalizeGuess(raw) {
  return String(raw || "").trim().toLowerCase();
}

/** True once the blanked-pivot clue should be showing. */
export function clueAvailable(state) {
  return !state.won && !state.lost && state.guesses.length >= CLUE_AFTER;
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
 * that word. First guess trends against yesterday's word's heat.
 * Near-yesterday: `prevLookup` (yesterday's heat row) catches semantic
 * closeness; `joins` (a Set of words known to join yesterday's word into a
 * lexical unit) catches exact joins like "tin" on a "can" day.
 */
export function applyGuess(state, rawGuess, lookup, prevLookup = null, joins = null) {
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
  const prev =
    state.guesses.length === 0
      ? lookup.heat(state.yesterday)
      : state.guesses[state.guesses.length - 1].heat;
  const trend = heatTrend(heat, prev);
  const won = word === state.today;
  const near =
    !won &&
    heat < NEAR_TODAY_MAX &&
    ((prevLookup !== null && (prevLookup.heat(word) ?? 0) >= NEAR_PREV_MIN) ||
      (joins !== null && joins.has(word)));
  const guesses = [...state.guesses, { word, heat, trend, near }];
  const lost = !won && guesses.length >= MAX_GUESSES;
  const next = { ...state, guesses, won, lost };
  let reason = "continue";
  if (won) reason = "win";
  else if (lost) reason = "lose";
  return { ok: true, reason, state: next, heat, trend };
}
