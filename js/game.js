export const MAX_GUESSES = 6;

export function createState(chain, index) {
  const n = chain.length;
  const dayIndex = ((index % n) + n) % n;
  return {
    dayIndex,
    today: chain[dayIndex],
    yesterday: chain[(dayIndex - 1 + n) % n],
    guesses: [],
    won: false,
    lost: false,
  };
}

export function normalizeGuess(raw) {
  return String(raw || "").trim().toLowerCase();
}

/**
 * Apply a guess. Heat is semantic (lookup table), never edit distance.
 * First guess is hotter/colder versus yesterday's word (the drift origin).
 */
export function applyGuess(state, rawGuess, lookup) {
  if (state.won || state.lost) {
    return { ok: false, reason: "over", state };
  }
  const word = normalizeGuess(rawGuess);
  if (!/^[a-z]+$/.test(word) || !lookup.isValid(word)) {
    return { ok: false, reason: "invalid", state };
  }
  if (state.guesses.some((g) => g.word === word)) {
    return { ok: false, reason: "duplicate", state };
  }
  const heat = word === state.today ? 100 : lookup.heat(word, state.dayIndex);
  const prev =
    state.guesses.length === 0
      ? lookup.heat(state.yesterday, state.dayIndex)
      : state.guesses[state.guesses.length - 1].heat;
  let trend = "same";
  if (heat > prev) trend = "hotter";
  else if (heat < prev) trend = "colder";
  const won = word === state.today;
  const guesses = [...state.guesses, { word, heat, trend }];
  const lost = !won && guesses.length >= MAX_GUESSES;
  const next = { ...state, guesses, won, lost };
  let reason = "continue";
  if (won) reason = "win";
  else if (lost) reason = "lose";
  return { ok: true, reason, state: next, heat, trend };
}
