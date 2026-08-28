import { heatTrend } from "./heat.js";

export const MAX_GUESSES = 6;
export const NUDGE_AFTER = 3; // all-cold guesses before the sense-pivot nudge

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

/** True when enough cold guesses have piled up to earn the meaning nudge. */
export function shouldNudge(state) {
  return (
    !state.won &&
    !state.lost &&
    state.guesses.length >= NUDGE_AFTER &&
    state.guesses.every((g) => g.heat < 30)
  );
}

/** Best heat reached so far (0 when no guesses). Drives the kite + sky. */
export function bestHeat(state) {
  return state.guesses.reduce((m, g) => Math.max(m, g.heat), 0);
}

/**
 * Apply a guess. Heat is semantic (per-day baked row), never edit distance.
 * Inflections resolve to their base word (strings -> string) and count as
 * that word. First guess trends against yesterday's word's heat.
 */
export function applyGuess(state, rawGuess, lookup) {
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
  const guesses = [...state.guesses, { word, heat, trend }];
  const lost = !won && guesses.length >= MAX_GUESSES;
  const next = { ...state, guesses, won, lost };
  let reason = "continue";
  if (won) reason = "win";
  else if (lost) reason = "lose";
  return { ok: true, reason, state: next, heat, trend };
}
