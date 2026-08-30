import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  EPOCH,
  dayIndex,
  daysBetween,
  millisecondsUntilNextPacificMidnight,
  pacificDateString,
  puzzleNumber,
} from "../js/calendar.js";
import {
  applyGuess,
  bestHeat,
  blankPivot,
  createState,
  hintAvailable,
  hintText,
  MAX_GUESSES,
  useHint,
} from "../js/game.js";
import {
  calibrationBoosts,
  calibrationCaps,
  createHeatLookup,
  distanceLabel,
  distanceSteps,
  distanceText,
  distanceTrend,
} from "../js/heat.js";
import { shareText } from "../js/share.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const chainPack = JSON.parse(fs.readFileSync(path.join(root, "data/chain.json"), "utf8"));
const words = JSON.parse(fs.readFileSync(path.join(root, "data/words.json"), "utf8"));
const chain = chainPack.words;
const N = chain.length;
const pairs = [
  ...JSON.parse(fs.readFileSync(path.join(root, "data/pairs.json"), "utf8")),
  ...JSON.parse(fs.readFileSync(path.join(root, "data/pair-overrides.json"), "utf8")),
];

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

test("countdown reaches the real next Pacific midnight across DST", () => {
  assert.equal(millisecondsUntilNextPacificMidnight(new Date("2026-03-08T08:00:00Z")), 23 * 3600000);
  assert.equal(millisecondsUntilNextPacificMidnight(new Date("2026-11-01T07:00:00Z")), 25 * 3600000);
  assert.equal(millisecondsUntilNextPacificMidnight(new Date("2026-08-30T19:00:00Z")), 12 * 3600000);
});

/* ---------- bands & trend ---------- */

test("distance labels use plain, stable thresholds", () => {
  assert.equal(distanceLabel(100), "found");
  assert.equal(distanceLabel(95), "almost");
  assert.equal(distanceLabel(80), "very-close");
  assert.equal(distanceLabel(65), "close");
  assert.equal(distanceLabel(35), "in-sight");
  assert.equal(distanceLabel(20), "distant");
  assert.equal(distanceLabel(5), "far");
  assert.equal(distanceText(95), "almost there");
});

test("distance meter exposes six stable steps", () => {
  assert.equal(distanceSteps(5), 1);
  assert.equal(distanceSteps(35), 3);
  assert.equal(distanceSteps(72), 5);
  assert.equal(distanceSteps(92), 6);
});

test("distance trend reports closer and farther", () => {
  assert.equal(distanceTrend(80, 40), "closer");
  assert.equal(distanceTrend(20, 60), "farther");
  assert.equal(distanceTrend(22, 20), "same");
  assert.equal(distanceTrend(8, 5), "same");
  assert.equal(distanceTrend(31, 28), "closer");
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

test("a known alternative pairing is flagged independently of distance", () => {
  let s = createState(SYN_CHAIN, 1);
  const wall = applyGuess(s, "wall", synToday, SYN_JOINS);
  assert.ok(wall.state.guesses[0].alternative, "wall joins yesterday");
  const friend = applyGuess(wall.state, "friend", synToday, new Set(["friend"]));
  assert.ok(friend.state.guesses[1].alternative, "a close guess can still be another pairing");
});

test("without a join set no guess is flagged", () => {
  const s = createState(SYN_CHAIN, 1);
  const r = applyGuess(s, "wall", synToday);
  assert.ok(!r.state.guesses[0].alternative);
});

test("a distant guess outside the join set stays a normal distance result", () => {
  const s = createState(SYN_CHAIN, 1);
  const joins = new Set(["wall"]);
  const r = applyGuess(s, "gossip", synToday, joins);
  assert.ok(!r.state.guesses[0].alternative, "gossip does not join yesterday");
});

test("pairs.json covers today's real neighbors of yesterday", () => {
  const set = new Set(pairs.map(([a, b]) => a + "|" + b));
  for (let i = 0; i < N; i++) {
    const prev = chain[(i - 1 + N) % N].w;
    const cur = chain[i].w;
    assert.ok(set.has(prev + "|" + cur) || set.has(cur + "|" + prev), `${prev}->${cur} missing from pairs`);
  }
});

test("manual pair coverage includes football club", () => {
  assert.ok(pairs.some(([a, b]) => a === "football" && b === "club"));
});

test("human corrections cover intuitive polysemous relationships", () => {
  const corrections = JSON.parse(fs.readFileSync(path.join(root, "data/heat-overrides.json"), "utf8"));
  const dict = new Set(words);
  for (const [answer, guesses] of Object.entries(corrections)) {
    assert.ok(chain.some((entry) => entry.w === answer), `${answer} is not in the daily chain`);
    const boosts = calibrationBoosts(answer, corrections);
    for (const [guess, expected] of Object.entries(guesses)) {
      assert.ok(dict.has(guess), `${answer}/${guess} is not in the dictionary`);
      assert.ok(boosts.get(guess) >= expected, `${answer}/${guess}`);
    }
  }
  const club = calibrationBoosts("club", corrections);
  assert.ok(club.get("golf") > club.get("team"));
  assert.ok(club.get("team") > club.get("dance"));
});

test("wrong-sense caps keep misleading polysemy out of close bands", () => {
  const caps = JSON.parse(fs.readFileSync(path.join(root, "data/heat-caps.json"), "utf8"));
  assert.ok(calibrationCaps("duck", caps).get("dodge") <= 20);
  assert.ok(calibrationCaps("cup", caps).get("chalice") <= 20);
  assert.ok(calibrationCaps("gas", caps).get("gasoline") <= 20);
});

/* ---------- real heat data (structural spot checks) ---------- */

test("all score files exist, one byte per word, secret 100, yesterday connected", () => {
  const index = new Map(words.map((w, i) => [w, i]));
  for (const d of [0, 1, Math.floor(N / 2), N - 1]) {
    const row = heatRow(d);
    assert.equal(row.length, words.length, `day ${d} row size`);
    assert.equal(row[index.get(chain[d].w)], 100, `day ${d} secret`);
    const yest = chain[(d - 1 + N) % N].w;
    assert.ok(row[index.get(yest)] >= 76, `day ${d} yesterday ${yest}`);
    const above = row.reduce((n, h) => n + (h >= 15 ? 1 : 0), 0);
    assert.ok(above >= 150, `day ${d}: only ${above} words above the far band`);
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

test("hints are optional, staged, and unavailable after the game ends", () => {
  let s = createState(SYN_CHAIN, 1);
  assert.ok(!hintAvailable(s));
  for (const w of ["wall", "friend", "gossip"]) s = applyGuess(s, w, synToday).state;
  assert.ok(hintAvailable(s));
  assert.equal(s.hintsUsed, 0, "a hint never appears automatically");
  s = useHint(s).state;
  assert.equal(s.hintsUsed, 1);
  assert.equal(hintText(s), "8 letters. Starts with N.");
  assert.ok(!hintAvailable(s), "second hint waits for another guess");
  s = applyGuess(s, "bake", synToday).state;
  assert.ok(hintAvailable(s));
  s = useHint(s).state;
  assert.equal(s.hintsUsed, 2);
  assert.match(hintText(s), /______hood watch/);
  const won = applyGuess(s, "neighbor", synToday).state;
  assert.ok(!hintAvailable(won));
});

test("opening the first hint late still requires another guess for hint two", () => {
  let s = createState(SYN_CHAIN, 1);
  for (const w of ["wall", "friend", "gossip", "bake"]) s = applyGuess(s, w, synToday).state;
  assert.ok(hintAvailable(s));
  s = useHint(s).state;
  assert.equal(s.firstHintGuessCount, 4);
  assert.ok(!hintAvailable(s), "hint two cannot open on the same guess count");
  s = applyGuess(s, "fence", synToday).state;
  assert.ok(hintAvailable(s));
});

test("bestHeat tracks the maximum", () => {
  let s = createState(SYN_CHAIN, 1);
  s = applyGuess(s, "friend", synToday).state;
  s = applyGuess(s, "gossip", synToday).state;
  assert.equal(bestHeat(s), 68);
});

test("alternative pairings do not drive the semantic progress sky", () => {
  const s = createState(SYN_CHAIN, 1);
  const alternative = applyGuess(s, "friend", synToday, new Set(["friend"])).state;
  assert.equal(bestHeat(alternative), 0);
});

test("distance trends skip over alternative-pair guesses", () => {
  let s = createState(SYN_CHAIN, 1);
  s = applyGuess(s, "friend", synToday).state;
  s = applyGuess(s, "wall", synToday, new Set(["wall"])).state;
  const next = applyGuess(s, "gossip", synToday).state.guesses[2];
  assert.equal(next.trend, "farther", "compares with friend, not the hidden wall distance");
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
  const text = shareText({ puzzleNumber: 240, guesses: s.guesses, won: s.won, hintsUsed: 1 });
  assert.ok(!text.includes("neighbor"), text);
  assert.ok(text.includes("Drift #240"));
  assert.ok(text.includes("caught the drift in 3"));
  assert.ok(text.includes("🟩"));
  assert.ok(text.includes("💡"));
  assert.ok(text.includes("⬜⬜⬜"));
});

test("share text gives alternative pairings their own glyph", () => {
  const s = createState(SYN_CHAIN, 1);
  const guessed = applyGuess(s, "friend", synToday, new Set(["friend"])).state;
  const text = shareText({ puzzleNumber: 240, guesses: guessed.guesses, won: false });
  assert.ok(text.includes("🔗"));
});

/* ---------- voice ---------- */

test("voice lines: deterministic, non-empty, function-critical kinds distinct", async () => {
  const { voiceLine, winLine } = await import("../js/voice.js");
  for (const kind of ["far", "distant", "in-sight", "close", "very-close", "almost", "invalid", "duplicate", "loss", "done"]) {
    for (const seed of [0, 1, 2, 100]) {
      const line = voiceLine(kind, seed);
      assert.ok(line.length > 0, `${kind} seed ${seed}`);
      assert.equal(line, voiceLine(kind, seed), "deterministic");
    }
  }
  assert.ok(winLine(1, 0).length > 0);
  assert.notEqual(winLine(1, 0), winLine(5, 0), "quick and late wins read differently");
  assert.equal(voiceLine("nope", 0), "");
});

/* ---------- summary ---------- */

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
