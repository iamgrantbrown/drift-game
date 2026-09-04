/** Links: word golf. A hole has a tee word and a hole word. A stroke is a
 *  word played from the word you're standing on; it must make a phrase
 *  with it, reading forward (school -> bus is "school bus"). You hole out
 *  when your word joins the hole word. Par is the authored route. Any
 *  route the course knows is a fair route. Pure functions, no DOM. */

import { createLadder } from "./ladder-game.js?v=20260904c";

/** Forward shots only: a pair whose unit reads a then b gives a -> b. */
export function buildCourse(pairList, chainEntries = []) {
  const next = new Map(); // from -> Map(to -> phrase)
  const add = (a, b, phrase) => {
    if (!next.has(a)) next.set(a, new Map());
    if (!next.get(a).has(b)) next.get(a).set(b, phrase);
  };
  for (const [a, b, unit] of pairList) {
    const u = (unit || `${a} ${b}`).toLowerCase();
    if (u === `${a} ${b}` || u === a + b) add(a, b, u);
    else if (u === `${b} ${a}` || u === b + a) add(b, a, u);
  }
  // the authored lines are shots too, with their spelled unit
  for (let i = 1; i < chainEntries.length; i++) {
    const a = chainEntries[i - 1].w;
    const b = chainEntries[i].w;
    const u = chainEntries[i].pivot.toLowerCase();
    if (u === `${a} ${b}` || u === a + b) add(a, b, u);
  }
  return {
    next,
    /** The phrase a -> b makes, or null if the course doesn't know that shot. */
    shot(a, b) {
      return next.get(a)?.get(b) ?? null;
    },
    from(a) {
      return next.get(a) ?? new Map();
    },
  };
}

/** Fewest strokes from each word to a word that joins the hole.
 *  0 means your word already joins the hole. Absent means no known route. */
export function distances(course, hole) {
  const prev = new Map(); // to -> Set(from)
  for (const [a, tos] of course.next) {
    for (const b of tos.keys()) {
      if (!prev.has(b)) prev.set(b, new Set());
      prev.get(b).add(a);
    }
  }
  const dist = new Map();
  const queue = [];
  for (const a of prev.get(hole) ?? []) {
    if (a === hole) continue;
    dist.set(a, 0);
    queue.push(a);
  }
  while (queue.length) {
    const w = queue.shift();
    const d = dist.get(w);
    for (const a of prev.get(w) ?? []) {
      if (a === hole || dist.has(a)) continue;
      dist.set(a, d + 1);
      queue.push(a);
    }
  }
  return dist;
}

export function yardage(d) {
  if (d === undefined) return "no route from here";
  if (d === 0) return "at the hole";
  return `${d} out`;
}

/** A hole from a spec: tee word, hole word, par. */
export function holeFromSpec({ tee, hole, par }, k = 0) {
  return {
    k,
    tee,
    hole,
    par,
    route: null,
    path: [tee],
    strokes: 0,
    holed: false,
    log: [],
    finalPhrase: null,
    hints: 0,
    caddie: null,
  };
}

/** Hole k from an authored line: tee, hole, par, and the setter's route. */
export function createHole(chainEntries, k) {
  const line = createLadder(chainEntries, k);
  return { ...holeFromSpec({ tee: line.top, hole: line.bottom, par: line.answers.length }, k), route: line.answers };
}

export function normalizeWord(raw) {
  return String(raw || "").trim().toLowerCase();
}

/** Play a word from where the ball lies. */
export function play(state, raw, course, dist) {
  if (state.holed) return { ok: false, reason: "holed", state };
  const word = normalizeWord(raw);
  if (!/^[a-z]+$/.test(word)) return { ok: false, reason: "invalid", state };
  const here = state.path[state.path.length - 1];
  if (state.path.includes(word)) return { ok: false, reason: "revisit", state };
  const phrase = course.shot(here, word);
  if (!phrase) return { ok: false, reason: "unknown", state };
  const before = dist.get(here);
  // the hole word itself sinks it; so does any word that joins the hole
  const sinks = word === state.hole;
  const joinsHole = !sinks && course.shot(word, state.hole);
  const holed = sinks || !!joinsHole;
  const after = sinks ? 0 : dist.get(word);
  const finalPhrase = sinks ? phrase : joinsHole || null;
  const entry = { word, phrase, before, after, drop: false };
  const next = {
    ...state,
    path: [...state.path, word],
    strokes: state.strokes + 1,
    holed,
    log: [...state.log, entry],
    finalPhrase: holed ? finalPhrase : null,
  };
  return { ok: true, state: next, phrase, before, after, holed, finalPhrase: next.finalPhrase };
}

/** Take a drop: back to the previous word for one penalty stroke. */
export function drop(state) {
  if (state.holed || state.path.length < 2) return { ok: false, state };
  const path = state.path.slice(0, -1);
  const entry = { word: path[path.length - 1], phrase: null, before: null, after: null, drop: true };
  return { ok: true, state: { ...state, path, strokes: state.strokes + 1, log: [...state.log, entry] } };
}

/** The caddie's pick from where you stand: the shot that leaves you closest,
 *  and among those, the one with the most ways onward. Null if none. */
export function bestShot(state, course, dist) {
  const here = state.path[state.path.length - 1];
  let best = null;
  for (const [word, phrase] of course.from(here)) {
    if (state.path.includes(word)) continue;
    if (word === state.hole) return { word, phrase, after: 0 };
    const after = course.shot(word, state.hole) ? 0 : dist.get(word);
    if (after === undefined) continue;
    const onward = course.from(word).size;
    if (!best || after < best.after || (after === best.after && onward > best.onward)) best = { word, phrase, after, onward };
  }
  return best;
}

export const CADDIE_STAGES = 3;

/** Reading the green: every word the course knows that finishes the hole,
 *  with the phrase it makes. You can see the flag from the tee. */
export function holeShots(course, hole) {
  const out = [];
  for (const [a, tos] of course.next) {
    if (a !== hole && tos.has(hole)) out.push({ word: a, phrase: tos.get(hole) });
  }
  return out.sort((x, y) => x.word.localeCompare(y.word));
}

/** What the caddie says at each stage: length, first letter, the blanked phrase. */
export function caddieLine(stage, shot, here) {
  if (!shot) return "Nothing from here gets you closer. Take a drop.";
  const w = shot.word;
  if (stage <= 1) return `Try a ${w.length}-letter word.`;
  if (stage === 2) return `It starts with ${w[0].toUpperCase()}.`;
  const blanked = shot.phrase.replace(w, `${w[0]}${" _".repeat(w.length - 1)}`);
  return `${blanked.charAt(0).toUpperCase()}${blanked.slice(1)}.`;
}

/** Take a hint from where you stand. Stages reset when the ball moves.
 *  The first stage, the letter count, is free; the rest go on the card. */
export function askCaddie(state) {
  const here = state.path[state.path.length - 1];
  const stage = state.caddie && state.caddie.at === here ? state.caddie.stage : 0;
  if (state.holed || stage >= CADDIE_STAGES) return { ok: false, state };
  const hints = (state.hints || 0) + (stage === 0 ? 0 : 1);
  return { ok: true, state: { ...state, hints, caddie: { at: here, stage: stage + 1 } } };
}

export function scoreName(strokes, par) {
  const diff = strokes - par;
  if (diff <= -3) return "albatross";
  if (diff === -2) return "eagle";
  if (diff === -1) return "birdie";
  if (diff === 0) return "par";
  if (diff === 1) return "bogey";
  if (diff === 2) return "double bogey";
  if (diff === 3) return "triple bogey";
  return `+${diff}`;
}

/** Where a shot leaves you. The yardage decides it:
 *  green   one out, the next word can hole it
 *  fairway closer than you were
 *  rough   the same distance out
 *  bunker  further out, but there is still a way to the hole
 *  water   no route to the hole from here; take a drop
 *  Drops report as "drop". A holing shot is "holed". */
export function lieOf(entry, holed = false) {
  if (entry.drop) return "drop";
  if (holed) return "holed";
  if (entry.after === undefined) return "water";
  if (entry.after === 1) return "green";
  if (entry.before === undefined || entry.after < entry.before) return "fairway";
  if (entry.after === entry.before) return "rough";
  return "bunker";
}

const GLYPH = { holed: "🟩", green: "🟩", fairway: "🟩", rough: "🟨", bunker: "🟧", water: "🟦", drop: "🟥" };

function strokeGlyph(entry, isLast, holed) {
  return GLYPH[lieOf(entry, isLast && holed)];
}

/** The scorecard line. Never names the words you played. */
export function shareCard({ puzzleNumber, state, url, title = "Links" }) {
  const score = scoreName(state.strokes, state.par);
  const glyphs = state.log.map((e, i) => strokeGlyph(e, i === state.log.length - 1, state.holed)).join("");
  const bulbs = state.hints ? ` · ${"💡".repeat(state.hints)}` : "";
  return `${title} #${puzzleNumber} · par ${state.par}\n${state.tee} ⛳ ${state.hole}\n${score} · ${state.strokes} ${state.strokes === 1 ? "stroke" : "strokes"}${bulbs}\n${glyphs}\n${url}`;
}
