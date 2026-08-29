import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  EPOCH,
  dayIndex,
  daysBetween,
  pacificDateString,
  puzzleNumber,
} from "../js/calendar.js";
import {
  applyGuess,
  bestHeat,
  blankPivot,
  clueAvailable,
  createState,
  MAX_GUESSES,
} from "../js/game.js";
import { bandFor, createHeatLookup, heatLabel, heatTrend } from "../js/heat.js";
import { shareText } from "../js/share.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const chainPack = JSON.parse(fs.readFileSync(path.join(root, "data/chain.json"), "utf8"));
const words = JSON.parse(fs.readFileSync(path.join(root, "data/words.json"), "utf8"));
const chain = chainPack.words;
const N = chain.length;

function heatRow(day) {
  return new Uint8Array(
    fs.readFileSync(path.join(root, "data/heat", String(day).padStart(3, "0") + ".bin")),
  );
}

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log("ok  ", name);
  } catch (err) {
    failed += 1;
    console.error("FAIL", name);
    console.error("    ", err.message);
  }
}

/* ---------- chain: every link is a lexical unit ---------- */

test("chain is long, unique, lowercase, with a unit pivot per step", () => {
  assert.ok(N >= 250, `chain length ${N}`);
  const seen = new Set();
  for (const e of chain) {
    assert.match(e.w, /^[a-z]+$/, e.w);
    assert.ok(typeof e.pivot === "string" && e.pivot.length >= 4, `pivot for ${e.w}`);
    assert.ok(!seen.has(e.w), `duplicate ${e.w}`);
    seen.add(e.w);
  }
  assert.equal(chain[0].w, "coffee");
});

test("lexical-unit rule: every pivot contains BOTH adjacent words", () => {
  for (let i = 0; i < N; i++) {
    const prev = chain[(i - 1 + N) % N].w;
    const cur = chain[i].w;
    const flat = chain[i].pivot.toLowerCase().replace(/[^a-z]/g, " ");
    const compact = flat.replace(/ /g, "");
    assert.ok(compact.includes(prev), `${chain[i].pivot}: missing yesterday "${prev}"`);
    assert.ok(compact.includes(cur), `${chain[i].pivot}: missing today "${cur}"`);
  }
});

test("every chain word is in the dictionary", () => {
  const dict = new Set(words);
  for (const e of chain) assert.ok(dict.has(e.w), e.w);
});

test("every day's pivot blanks to a usable clue", () => {
  for (const e of chain) {
    const clue = blankPivot(e.pivot, e.w);
    assert.notEqual(clue, e.pivot, `${e.w}: pivot never blanked`);
    assert.ok(!new RegExp(`\\b${e.w}\\b`, "i").test(clue), `${e.w}: still visible in "${clue}"`);
  }
});

/* ---------- calendar ---------- */

test("dayIndex wraps the chain by pacific day", () => {
  assert.equal(dayIndex("2026-01-01", N), 0);
  assert.equal(dayIndex("2026-01-02", N), 1);
  const far = daysBetween(EPOCH, "2027-06-15");
  assert.equal(dayIndex("2027-06-15", N), ((far % N) + N) % N);
});

test("puzzleNumber counts from epoch", () => {
  assert.equal(puzzleNumber("2026-01-01"), 1);
  assert.equal(puzzleNumber("2026-08-28"), 240);
});

test("daysBetween handles month boundaries", () => {
  assert.equal(daysBetween("2026-02-28", "2026-03-01"), 1);
  assert.equal(daysBetween("2026-01-01", "2026-01-01"), 0);
});

test("pacificDateString returns YYYY-MM-DD", () => {
  assert.match(pacificDateString(new Date()), /^\d{4}-\d{2}-\d{2}$/);
});

/* ---------- bands & trend ---------- */

test("heatLabel band thresholds", () => {
  assert.equal(heatLabel(100), "found");
  assert.equal(heatLabel(95), "scorching");
  assert.equal(heatLabel(80), "hot");
  assert.equal(heatLabel(65), "warm");
  assert.equal(heatLabel(50), "lukewarm");
  assert.equal(heatLabel(35), "cool");
  assert.equal(heatLabel(20), "cold");
  assert.equal(heatLabel(5), "ice");
});

test("bandFor folds lukewarm into warm", () => {
  assert.equal(bandFor(50), "warm");
  assert.equal(bandFor(65), "warm");
  assert.equal(bandFor(35), "cool");
});

test("heatTrend: band change or 10+ delta is notable", () => {
  assert.equal(heatTrend(80, 40), "hotter");
  assert.equal(heatTrend(20, 60), "colder");
  assert.equal(heatTrend(22, 20), "same");
  assert.equal(heatTrend(8, 5), "same");
  assert.equal(heatTrend(31, 28), "hotter");
});

/* ---------- lookup & inflections (synthetic — data-independent) ---------- */

const SYN_WORDS = ["fence", "neighbor", "neighbors", "neighbours", "wall", "friend", "gossip", "walls", "bake", "baking"];
function synRow(map) {
  const row = new Uint8Array(SYN_WORDS.length).fill(5);
  for (const [w, h] of Object.entries(map)) row[SYN_WORDS.indexOf(w)] = h;
  return row;
}
const synToday = createHeatLookup(SYN_WORDS, synRow({ neighbor: 100, neighbors: 92, friend: 68, wall: 6 }));
const SYN_JOINS = new Set(["wall", "gossip"]); // words that join yesterday ("fence")
const SYN_CHAIN = [{ w: "fence", pivot: "picket fence" }, { w: "neighbor", pivot: "neighborhood watch" }];

test("inflections resolve, preferring the word itself then base forms", () => {
  assert.ok(synToday.candidates("walls").includes("wall"));
  assert.equal(synToday.resolve("baking"), "baking");
  assert.ok(synToday.candidates("baking").includes("bake"));
  assert.equal(synToday.resolve("zzzzzz"), null);
});

test("an inflection of the secret wins even when it is its own dict word", () => {
  const s = createState(SYN_CHAIN, 1);
  const r = applyGuess(s, "neighbors", synToday);
  assert.ok(r.ok);
  assert.ok(r.state.won, "neighbors should catch neighbor");
});

test("british spellings bridge to the secret", () => {
  const s = createState(SYN_CHAIN, 1);
  const r = applyGuess(s, "neighbours", synToday);
  assert.ok(r.ok);
  assert.ok(r.state.won, "neighbours should catch neighbor");
});

test("joins yesterday: a cold guess in the join set is flagged", () => {
  let s = createState(SYN_CHAIN, 1);
  const wall = applyGuess(s, "wall", synToday, SYN_JOINS);
  assert.ok(wall.state.guesses[0].near, "wall joins yesterday (stone wall vs fence world)");
  const friend = applyGuess(wall.state, "friend", synToday, SYN_JOINS);
  assert.ok(!friend.state.guesses[1].near, "friend is warm vs today, never flagged");
});

test("without a join set no guess is flagged", () => {
  const s = createState(SYN_CHAIN, 1);
  const r = applyGuess(s, "wall", synToday);
  assert.ok(!r.state.guesses[0].near);
});

test("a cold guess outside the join set stays plain ice", () => {
  const s = createState(SYN_CHAIN, 1);
  const joins = new Set(["wall"]);
  const r = applyGuess(s, "gossip", synToday, joins);
  assert.ok(!r.state.guesses[0].near, "gossip does not join yesterday");
});

test("pairs.json covers today's real neighbors of yesterday", () => {
  const pairs = JSON.parse(fs.readFileSync(path.join(root, "data/pairs.json"), "utf8"));
  const set = new Set(pairs.map(([a, b]) => a + "|" + b));
  for (let i = 0; i < N; i++) {
    const prev = chain[(i - 1 + N) % N].w;
    const cur = chain[i].w;
    assert.ok(set.has(prev + "|" + cur) || set.has(cur + "|" + prev), `${prev}->${cur} missing from pairs`);
  }
});

/* ---------- real heat data (structural spot checks) ---------- */

test("all heat files exist, one byte per word, secret 100, yesterday hot", () => {
  const index = new Map(words.map((w, i) => [w, i]));
  for (const d of [0, 1, Math.floor(N / 2), N - 1]) {
    const row = heatRow(d);
    assert.equal(row.length, words.length, `day ${d} row size`);
    assert.equal(row[index.get(chain[d].w)], 100, `day ${d} secret`);
    const yest = chain[(d - 1 + N) % N].w;
    assert.ok(row[index.get(yest)] >= 76, `day ${d} yesterday ${yest}`);
    const above = row.reduce((n, h) => n + (h >= 15 ? 1 : 0), 0);
    assert.ok(above >= 150, `day ${d}: only ${above} words above ice`);
  }
  for (let d = 0; d < N; d++) {
    assert.ok(fs.existsSync(path.join(root, "data/heat", String(d).padStart(3, "0") + ".bin")), `day ${d} file`);
  }
});

/* ---------- game flow ---------- */

test("createState exposes today, yesterday, and the pivot", () => {
  const s = createState(chain, 1);
  assert.equal(s.today, chain[1].w);
  assert.equal(s.yesterday, chain[0].w);
  assert.equal(s.pivot, chain[1].pivot);
});

test("six misses lose the game; win stops play", () => {
  let s = createState(SYN_CHAIN, 1);
  for (const w of ["wall", "friend", "gossip", "bake", "fence", "walls"]) {
    const r = applyGuess(s, w, synToday);
    if (r.ok) s = r.state;
  }
  assert.ok(s.lost);
  assert.equal(s.guesses.length, MAX_GUESSES);
  const over = applyGuess(s, "neighbor", synToday);
  assert.equal(over.ok, false);
  assert.equal(over.reason, "over");
});

test("invalid and duplicate guesses are rejected without consuming a turn", () => {
  let s = createState(SYN_CHAIN, 1);
  assert.equal(applyGuess(s, "qqqq", synToday).ok, false);
  assert.equal(applyGuess(s, "not a word!", synToday).ok, false);
  s = applyGuess(s, "friend", synToday).state;
  const dup = applyGuess(s, "friend", synToday);
  assert.equal(dup.ok, false);
  assert.equal(dup.reason, "duplicate");
  assert.equal(s.guesses.length, 1);
});

test("clue appears after three misses, never after the game ends", () => {
  let s = createState(SYN_CHAIN, 1);
  assert.ok(!clueAvailable(s));
  for (const w of ["wall", "friend", "gossip"]) s = applyGuess(s, w, synToday).state;
  assert.ok(clueAvailable(s));
  const won = applyGuess(s, "neighbor", synToday).state;
  assert.ok(!clueAvailable(won));
});

test("bestHeat tracks the maximum", () => {
  let s = createState(SYN_CHAIN, 1);
  s = applyGuess(s, "friend", synToday).state;
  s = applyGuess(s, "gossip", synToday).state;
  assert.equal(bestHeat(s), 68);
});

test("blankPivot hides the secret in compounds, idioms, and inflections", () => {
  assert.equal(blankPivot("coffee bean", "bean"), "coffee ______");
  assert.equal(blankPivot("racetrack", "track"), "race_____");
  assert.equal(blankPivot("grass roots", "root"), "grass ______");
  assert.equal(blankPivot("tug of war", "war"), "tug of ______");
  assert.equal(blankPivot("catcher's mitt", "mitt"), "catcher's ______");
});

/* ---------- share ---------- */

test("share text never contains the secret and maps bands to emoji", () => {
  let s = createState(SYN_CHAIN, 1);
  s = applyGuess(s, "gossip", synToday).state;
  s = applyGuess(s, "friend", synToday).state;
  s = applyGuess(s, "neighbor", synToday).state;
  const text = shareText({ puzzleNumber: 240, guesses: s.guesses, won: s.won });
  assert.ok(!text.includes("neighbor"), text);
  assert.ok(text.includes("Drift #240"));
  assert.ok(text.includes("caught the drift in 3"));
  assert.ok(text.includes("🟩"));
  assert.ok(text.includes("⬜⬜⬜"));
});

/* ---------- voice ---------- */

test("voice lines: deterministic, non-empty, function-critical kinds distinct", async () => {
  const { voiceLine, winLine } = await import("../js/voice.js");
  for (const kind of ["ice", "cold", "cool", "warm", "hot", "scorching", "near", "invalid", "duplicate", "loss", "done"]) {
    for (const seed of [0, 1, 2, 100]) {
      const line = voiceLine(kind, seed);
      assert.ok(line.length > 0, `${kind} seed ${seed}`);
      assert.equal(line, voiceLine(kind, seed), "deterministic");
    }
  }
  assert.ok(winLine(1, 0).length > 0);
  assert.notEqual(winLine(1, 0), winLine(5, 0), "quick and clue wins read differently");
  assert.equal(voiceLine("nope", 0), "");
});

/* ---------- summary ---------- */

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
