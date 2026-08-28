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
import { applyGuess, createState, MAX_GUESSES } from "../js/game.js";
import { createHeatLookup } from "../js/heat.js";
import { shareText } from "../js/share.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const chainPack = JSON.parse(fs.readFileSync(path.join(root, "data/chain.json"), "utf8"));
const words = JSON.parse(fs.readFileSync(path.join(root, "data/words.json"), "utf8"));
const heatBuf = fs.readFileSync(path.join(root, "data/heat.bin"));
const lookup = createHeatLookup(words, heatBuf);
const chain = chainPack.words;

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

test("chain is at least 60 unique lowercase words", () => {
  assert.ok(chain.length >= 60, String(chain.length));
  assert.equal(new Set(chain).size, chain.length);
  for (const w of chain) {
    assert.match(w, /^[a-z]+$/);
    assert.ok(lookup.isValid(w), "missing from guess list: " + w);
  }
});

test("guess list is compact common English", () => {
  assert.ok(words.length >= 2000 && words.length <= 8000, String(words.length));
  assert.ok(lookup.isValid("coffee"));
  assert.ok(lookup.isValid("mug"));
  assert.equal(lookup.isValid("xyzzynotaword"), false);
});

test("day index is stable for Pacific calendar dates", () => {
  assert.equal(dayIndex("2026-01-01", chain.length, EPOCH), 0);
  assert.equal(dayIndex("2026-01-02", chain.length, EPOCH), 1);
  assert.equal(puzzleNumber("2026-01-01"), 1);
  assert.equal(puzzleNumber("2026-01-02"), 2);
  assert.equal(daysBetween("2026-08-27", "2026-08-28"), 1);
  const dt = new Date(Date.UTC(2026, 0, 1 + chain.length));
  const looped = dt.toISOString().slice(0, 10);
  assert.equal(dayIndex("2026-01-01", chain.length, EPOCH), dayIndex(looped, chain.length, EPOCH));
});

test("day index uses America/Los_Angeles around midnight", () => {
  const stillThursday = new Date("2026-08-28T06:30:00Z");
  const fridayPacific = new Date("2026-08-28T08:30:00Z");
  assert.equal(pacificDateString(stillThursday), "2026-08-27");
  assert.equal(pacificDateString(fridayPacific), "2026-08-28");
  assert.notEqual(
    dayIndex(stillThursday, chain.length, EPOCH),
    dayIndex(fridayPacific, chain.length, EPOCH)
  );
});

test("yesterday and today follow the curated chain and loop", () => {
  const d0 = createState(chain, 0);
  assert.equal(d0.today, "coffee");
  assert.equal(d0.yesterday, "breakfast");
  const d1 = createState(chain, 1);
  assert.equal(d1.yesterday, "coffee");
  assert.equal(d1.today, "espresso");
  const last = createState(chain, chain.length - 1);
  assert.equal(last.today, "breakfast");
  assert.equal(last.yesterday, "toast");
  const wrapped = createState(chain, chain.length);
  assert.equal(wrapped.today, d0.today);
  assert.equal(wrapped.yesterday, d0.yesterday);
});

test("invalid and duplicate guesses are rejected", () => {
  const state = createState(chain, 1);
  const bad = applyGuess(state, "xyzzynotaword", lookup);
  assert.equal(bad.ok, false);
  assert.equal(bad.reason, "invalid");
  assert.equal(bad.state.guesses.length, 0);
  const empty = applyGuess(state, "   ", lookup);
  assert.equal(empty.reason, "invalid");
  const proper = applyGuess(state, "TEA", lookup);
  assert.equal(proper.ok, true);
  const dup = applyGuess(proper.state, "tea", lookup);
  assert.equal(dup.ok, false);
  assert.equal(dup.reason, "duplicate");
});

test("win in one and lose after six", () => {
  const win0 = createState(chain, 1);
  const win = applyGuess(win0, "espresso", lookup);
  assert.equal(win.ok, true);
  assert.equal(win.reason, "win");
  assert.equal(win.state.won, true);
  assert.equal(win.heat, 100);
  const over = applyGuess(win.state, "latte", lookup);
  assert.equal(over.reason, "over");

  let lose = createState(chain, 1);
  const filler = ["library", "mountain", "saddle", "bicycle", "paper", "window"];
  for (let i = 0; i < MAX_GUESSES; i++) {
    const r = applyGuess(lose, filler[i], lookup);
    assert.equal(r.ok, true, filler[i]);
    lose = r.state;
  }
  assert.equal(lose.lost, true);
  assert.equal(lose.won, false);
  assert.equal(lose.guesses.length, 6);
});

test("hotter/colder is semantic and monotonic on espresso fixtures", () => {
  const secretIndex = chain.indexOf("espresso");
  assert.equal(secretIndex, 1);
  const heat = (w) => lookup.heat(w, secretIndex);
  assert.equal(heat("espresso"), 100);
  assert.ok(heat("latte") > heat("tea"), "latte vs tea");
  assert.ok(heat("coffee") > heat("tea"), "coffee vs tea");
  assert.ok(heat("brew") > heat("mountain"), "brew vs mountain");
  assert.ok(heat("latte") > heat("library"));
  assert.ok(heat("mug") > heat("saddle"), "mug vs saddle");

  let state = createState(chain, 1);
  const tea = applyGuess(state, "tea", lookup);
  assert.equal(tea.ok, true);
  assert.equal(tea.trend, "colder");
  const latte = applyGuess(tea.state, "latte", lookup);
  assert.equal(latte.trend, "hotter");
  const hit = applyGuess(latte.state, "espresso", lookup);
  assert.equal(hit.reason, "win");
  assert.ok(hit.heat > latte.heat);
});

test("share card never names the secret", () => {
  let state = createState(chain, 1);
  state = applyGuess(state, "tea", lookup).state;
  state = applyGuess(state, "latte", lookup).state;
  state = applyGuess(state, "espresso", lookup).state;
  const card = shareText({ puzzleNumber: 12, guesses: state.guesses, won: true });
  assert.match(card, /Drift #12/);
  assert.match(card, /got it in 3/);
  assert.equal(card.includes("espresso"), false);
  assert.equal(card.includes("coffee"), false);
});

console.log("");
console.log(passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
