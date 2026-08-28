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

/* ---------- chain ---------- */

test("chain has 366 unique lowercase words with pivots", () => {
  assert.equal(chain.length, 366);
  const seen = new Set();
  for (const e of chain) {
    assert.match(e.w, /^[a-z]+$/, e.w);
    assert.ok(typeof e.pivot === "string" && e.pivot.length >= 4, `pivot for ${e.w}`);
    assert.ok(!seen.has(e.w), `duplicate ${e.w}`);
    seen.add(e.w);
  }
});

test("every chain word is in the dictionary", () => {
  const dict = new Set(words);
  for (const e of chain) assert.ok(dict.has(e.w), e.w);
});

test("v1 chain opening is preserved", () => {
  assert.equal(chain[0].w, "coffee");
  assert.equal(chain[22].w, "string");
  assert.equal(chain[23].w, "guitar");
  assert.equal(chain[71].w, "breakfast");
});

/* ---------- calendar ---------- */

test("dayIndex wraps the chain by pacific day", () => {
  assert.equal(dayIndex("2026-01-01", chain.length), 0);
  assert.equal(dayIndex("2026-01-02", chain.length), 1);
  assert.equal(dayIndex("2027-01-02", chain.length), 0); // 366 days later
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
  assert.equal(EPOCH, "2026-01-01");
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
  assert.equal(heatTrend(22, 20), "same"); // same band, small delta
  assert.equal(heatTrend(8, 5), "same"); // ice twitching is never a trend
  assert.equal(heatTrend(31, 28), "hotter"); // band changed cold -> cool
});

/* ---------- lookup & inflections ---------- */

const day23 = createHeatLookup(words, heatRow(23)); // guitar

test("inflections resolve, preferring the word itself then base forms", () => {
  assert.ok(day23.candidates("strings").includes("string"));
  assert.equal(day23.resolve("string"), "string");
  assert.equal(day23.resolve("guitars"), "guitar");
  assert.equal(day23.resolve("zzzzzz"), null);
});

test("british spellings bridge to the secret", () => {
  const day253 = createHeatLookup(words, heatRow(253)); // neighbor
  let s = createState(chain, 253);
  const r = applyGuess(s, "neighbours", day253);
  assert.ok(r.ok);
  assert.ok(r.state.won, "neighbours should catch neighbor");
});

test("an inflection of the secret wins even when it is its own dict word", () => {
  const day22 = createHeatLookup(words, heatRow(22)); // string
  let s = createState(chain, 22);
  const r = applyGuess(s, "strings", day22);
  assert.ok(r.ok);
  assert.ok(r.state.won, "strings should catch string");
});

test("guitar day: secret is 100, yesterday is hot, neighbors grade down", () => {
  assert.equal(day23.heat("guitar"), 100);
  assert.ok(day23.heat("string") >= 76, String(day23.heat("string")));
  assert.ok(day23.heat("violin") >= 60, String(day23.heat("violin")));
  assert.ok(day23.heat("banjo") >= 75, String(day23.heat("banjo")));
  const carHeat = day23.heat("car");
  assert.ok(carHeat < 45, `car should not be warm for guitar: ${carHeat}`);
});

test("dense signal: every sampled day has hundreds of graded words", () => {
  for (const day of [0, 23, 100, 200, 300, 365]) {
    const row = heatRow(day);
    const above = row.reduce((n, h) => n + (h >= 15 ? 1 : 0), 0);
    assert.ok(above >= 150, `day ${day}: only ${above} words above ice`);
    assert.equal(row.length, words.length);
  }
});

test("all 366 heat files exist and are one byte per word", () => {
  for (let d = 0; d < 366; d++) {
    assert.equal(heatRow(d).length, words.length, `day ${d}`);
  }
});

/* ---------- game flow ---------- */

test("createState exposes today, yesterday, and the pivot", () => {
  const s = createState(chain, 23);
  assert.equal(s.today, "guitar");
  assert.equal(s.yesterday, "string");
  assert.equal(s.pivot, "a guitar string");
});

test("win on exact guess; inflection of the secret also wins", () => {
  let s = createState(chain, 23);
  let r = applyGuess(s, "Guitars", day23);
  assert.ok(r.ok);
  assert.ok(r.state.won);
  assert.equal(r.state.guesses[0].heat, 100);
});

test("invalid and duplicate guesses are rejected without consuming a turn", () => {
  let s = createState(chain, 23);
  assert.equal(applyGuess(s, "qqqq", day23).ok, false);
  assert.equal(applyGuess(s, "not a word!", day23).ok, false);
  s = applyGuess(s, "violin", day23).state;
  const dup = applyGuess(s, "violins", day23); // resolves to violin
  assert.equal(dup.ok, false);
  assert.equal(dup.reason, "duplicate");
  assert.equal(s.guesses.length, 1);
});

test("six misses lose the game", () => {
  let s = createState(chain, 23);
  for (const w of ["tea", "rain", "cloud", "sand", "wine", "bread"]) {
    s = applyGuess(s, w, day23).state;
  }
  assert.ok(s.lost);
  assert.ok(!s.won);
  assert.equal(s.guesses.length, MAX_GUESSES);
});

test("near yesterday: cold vs today but hot vs yesterday flags the guess", () => {
  const day253 = createHeatLookup(words, heatRow(253)); // neighbor
  const day252 = createHeatLookup(words, heatRow(252)); // fence
  let s = createState(chain, 253);
  assert.equal(s.today, "neighbor");
  assert.equal(s.yesterday, "fence");
  const wall = applyGuess(s, "wall", day253, day252);
  assert.ok(wall.state.guesses[0].near, "wall should be near-yesterday");
  const friend = applyGuess(wall.state, "friend", day253, day252);
  assert.ok(!friend.state.guesses[1].near, "friend is warm vs today, not near");
  const gossip = applyGuess(friend.state, "gossip", day253, day252);
  assert.ok(!gossip.state.guesses[2].near, "gossip is cold vs both, plain ice");
});

test("without a prev lookup no guess is flagged near", () => {
  let s = createState(chain, 253);
  const day253 = createHeatLookup(words, heatRow(253));
  const r = applyGuess(s, "wall", day253);
  assert.ok(!r.state.guesses[0].near);
});

test("clue appears after three misses, never after the game ends", () => {
  let s = createState(chain, 23);
  assert.ok(!clueAvailable(s));
  for (const w of ["tea", "rain", "cloud"]) s = applyGuess(s, w, day23).state;
  assert.ok(clueAvailable(s));
  const won = applyGuess(s, "guitar", day23).state;
  assert.ok(!clueAvailable(won));
});

test("blankPivot hides the secret, inflections and compounds included", () => {
  assert.equal(blankPivot("a fence between neighbors", "neighbor"), "a fence between ______");
  assert.equal(blankPivot("a record player", "player"), "a record ______");
  assert.equal(blankPivot("a sheepdog", "dog"), "a sheep___");
  assert.equal(blankPivot("the coach's office", "office"), "the coach's ______");
});

test("every day's pivot blanks to a usable clue", () => {
  for (const e of chain) {
    const clue = blankPivot(e.pivot, e.w);
    assert.notEqual(clue, e.pivot, `${e.w}: pivot never blanked`);
    assert.ok(!new RegExp(`\\b${e.w}\\b`, "i").test(clue), `${e.w}: still visible in "${clue}"`);
  }
});

test("bestHeat tracks the maximum", () => {
  let s = createState(chain, 23);
  s = applyGuess(s, "violin", day23).state;
  s = applyGuess(s, "tea", day23).state;
  assert.equal(bestHeat(s), s.guesses[0].heat);
});

/* ---------- share ---------- */

test("share text never contains the secret and maps bands to emoji", () => {
  let s = createState(chain, 23);
  s = applyGuess(s, "tea", day23).state;
  s = applyGuess(s, "violin", day23).state;
  s = applyGuess(s, "guitar", day23).state;
  const text = shareText({ puzzleNumber: 240, guesses: s.guesses, won: s.won });
  assert.ok(!text.includes("guitar"), text);
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
