/** Links: word golf. A hole has a tee word and a hole word. A stroke is a
 *  word played from the word you're standing on; it must make a phrase
 *  with it, reading forward (school -> bus is "school bus"). You hole out
 *  when your word joins the hole word. Par is the authored route. Any
 *  route the course knows is a fair route. Pure functions, no DOM. */

import { createLadder } from "./ladder-game.js?v=20260904h";

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
export function distances(course, hole, unavailable = []) {
  const blocked = new Set(unavailable);
  const prev = new Map(); // to -> Set(from)
  for (const [a, tos] of course.next) {
    if (blocked.has(a)) continue;
    for (const b of tos.keys()) {
      if (blocked.has(b)) continue;
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
  for (let i = 0; i < queue.length; i++) {
    const w = queue[i];
    const d = dist.get(w);
    for (const a of prev.get(w) ?? []) {
      if (a === hole || dist.has(a)) continue;
      dist.set(a, d + 1);
      queue.push(a);
    }
  }
  return dist;
}

/** The current word is available; every earlier word on this route is not. */
export function routeDistances(state, course) {
  return distances(course, state.hole, state.path.slice(0, -1));
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

// Explicit equivalents only. Resolve to an existing shot so spelling support
// never adds edges or changes the published course's shortest routes.
const SPELLINGS = [
  ["color", "colour"], ["honor", "honour"], ["favor", "favour"],
  ["neighbor", "neighbour"], ["labor", "labour"], ["humor", "humour"],
  ["center", "centre"], ["theater", "theatre"], ["meter", "metre"],
  ["liter", "litre"], ["fiber", "fibre"], ["gray", "grey"],
  ["tire", "tyre"], ["airplane", "aeroplane"], ["airplanes", "aeroplanes"],
  ["colors", "colours"], ["tires", "tyres"], ["neighbors", "neighbours"],
];

export function resolveShotWord(here, raw, course) {
  const word = normalizeWord(raw);
  if (course.shot(here, word)) return word;
  const forms = SPELLINGS.find((group) => group.includes(word));
  return forms?.find((form) => course.shot(here, form)) ?? word;
}

/** Play a word from where the ball lies. */
export function play(state, raw, course) {
  if (state.holed) return { ok: false, reason: "holed", state };
  const typed = normalizeWord(raw);
  if (!/^[a-z]+$/.test(typed)) return { ok: false, reason: "invalid", state };
  const here = state.path[state.path.length - 1];
  const word = resolveShotWord(here, typed, course);
  if (state.path.includes(word)) return { ok: false, reason: "revisit", state };
  const phrase = course.shot(here, word);
  if (!phrase) return { ok: false, reason: "unknown", state };
  const before = routeDistances(state, course).get(here);
  // the hole word itself sinks it; so does any word that joins the hole
  const sinks = word === state.hole;
  const joinsHole = !sinks && course.shot(word, state.hole);
  const holed = sinks || !!joinsHole;
  const after = holed ? 0 : distances(course, state.hole, state.path).get(word);
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

/** One mulligan per round. Keep hint history and do not allow undoing a finish. */
export function undo(state) {
  if (state.holed || state.undoUsed || state.path.length < 2 || state.log.at(-1)?.drop) return { ok: false, state };
  return { ok: true, state: { ...state, path: state.path.slice(0, -1),
    strokes: Math.max(0, state.strokes - 1), log: state.log.slice(0, -1),
    undoUsed: true, caddie: null } };
}

/** Saved rounds keep their original course, even after the daily rotation changes. */
export function selectHole(layout, curated, date, saved = {}) {
  const savedSpec = [...layout.holes, ...curated.holes].find(h => `${h.tee}|${h.hole}` === saved.hole);
  if (savedSpec && Array.isArray(saved.path) && saved.path[0] === savedSpec.tee) return savedSpec;
  const schedule = date >= curated.epoch ? curated : layout;
  const day = Math.floor((Date.parse(date + 'T00:00:00Z') - Date.parse(schedule.epoch + 'T00:00:00Z')) / 86400000);
  return schedule.holes[((day % schedule.holes.length) + schedule.holes.length) % schedule.holes.length];
}

/** The caddie's pick from where you stand: the shot that leaves you closest,
 *  and among those, the one with the most ways onward. Null if none. */
export function bestShot(state, course) {
  if (state.holed) return null;
  const here = state.path[state.path.length - 1];
  // A suggestion cannot rely on returning through the current word either.
  const dist = distances(course, state.hole, state.path);
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

/** Text fallback for a golf scorecard. The answers stay off the card. */
export function shareCard({ puzzleNumber, state, url, date = state.date, title = "Links" }) {
  let link = url;
  if (/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
    const exact = new URL(url);
    exact.searchParams.set('date', date);
    link = exact.href;
  }
  const diff = state.strokes - state.par;
  const relative = diff === 0 ? 'E' : diff > 0 ? `+${diff}` : `−${Math.abs(diff)}`;
  const circled = diff < 0 && state.strokes >= 1 && state.strokes <= 20 ? String.fromCodePoint(0x2460 + state.strokes - 1) : String(state.strokes);
  const hints = state.hints ? `\nHints: ${state.hints}` : '';
  const undoNote = state.undoUsed ? '\nFree undo used' : '';
  return `${title} #${puzzleNumber} ⛳\n${state.tee.toUpperCase()} → ${state.hole.toUpperCase()}\n\nHOLE  | PAR | STROKES\n${String(puzzleNumber).padEnd(6)}| ${String(state.par).padEnd(4)}| ${circled}\n\n${scoreName(state.strokes, state.par).toUpperCase()} (${relative})${hints}${undoNote}\n\n${link}`;
}
