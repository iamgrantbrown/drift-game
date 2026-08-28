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
import { createHeatLookup, heatLabel, heatTrend } from "../js/heat.js";
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
  assert.ok(heat("tea") < heat("mug"), "tea vs mug " + heat("tea") + " " + heat("mug"));
  assert.ok(heat("mug") < heat("latte"), "mug vs latte " + heat("mug") + " " + heat("latte"));
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

test("string: kite is warm, thread is hot, vehicles are cold", () => {
  const secretIndex = chain.indexOf("string");
  assert.ok(secretIndex >= 0);
  const heat = (w) => lookup.heat(w, secretIndex);
  assert.ok(heat("kite") >= 60, "kite " + heat("kite"));
  assert.ok(heat("kite") <= 85, "kite band " + heat("kite"));
  assert.ok(heat("thread") >= 75, "thread " + heat("thread"));
  assert.ok(heat("car") < 30, "car " + heat("car"));
  assert.ok(heat("bike") < 30, "bike " + heat("bike"));
  assert.ok(heat("truck") < 30, "truck " + heat("truck"));
  let state = createState(chain, secretIndex);
  const car = applyGuess(state, "car", lookup);
  assert.equal(car.ok, true);
  assert.equal(car.trend, "colder");
});

test("unrelated ice guesses share one flat heat", () => {
  const secretIndex = chain.indexOf("guitar");
  assert.ok(secretIndex >= 0);
  const ice = ["reel", "ribbon", "tail", "spoke", "paper", "sheet", "mountain", "window"];
  const heats = ice.map((w) => {
    assert.ok(lookup.isValid(w), "missing " + w);
    return lookup.heat(w, secretIndex);
  });
  for (let i = 0; i < ice.length; i++) {
    assert.ok(heats[i] < 15, ice[i] + " should be ice, got " + heats[i]);
    assert.equal(heats[i], heats[0], ice[i] + " heat " + heats[i] + " != " + heats[0]);
  }
  assert.equal(heatLabel(heats[0]), "ice");
});

test("hotter/colder needs a band change or a jump of 10", () => {
  assert.equal(heatTrend(8, 8), "still");
  assert.equal(heatTrend(10, 8), "still");
  assert.equal(heatTrend(14, 6), "still");
  assert.equal(heatTrend(16, 8), "hotter");
  assert.equal(heatTrend(8, 76), "colder");
  assert.equal(heatTrend(50, 45), "same");
  assert.equal(heatTrend(56, 45), "hotter");
  assert.equal(heatTrend(92, 80), "hotter");
  assert.equal(heatTrend(48, 76), "colder");
  assert.equal(heatTrend(66, 48), "hotter");

  const secretIndex = chain.indexOf("guitar");
  let state = createState(chain, secretIndex);
  const yesterdayHeat = lookup.heat(state.yesterday, secretIndex);
  assert.ok(yesterdayHeat >= 70 && yesterdayHeat <= 80, "yesterday heat " + yesterdayHeat);

  const reel = applyGuess(state, "reel", lookup);
  assert.equal(reel.ok, true);
  assert.equal(reel.trend, "colder");
  assert.equal(heatLabel(reel.heat), "ice");

  const ribbon = applyGuess(reel.state, "ribbon", lookup);
  assert.equal(ribbon.heat, reel.heat);
  assert.equal(ribbon.trend, "still");

  const tail = applyGuess(ribbon.state, "tail", lookup);
  assert.equal(tail.trend, "still");
  assert.equal(tail.heat, reel.heat);
});

test("yesterday lives on a paper tile, not a kite", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const yIdx = html.indexOf('id="yesterday"');
  assert.ok(yIdx > 0);
  const sectionStart = html.lastIndexOf("<section", yIdx);
  const sectionEnd = html.indexOf("</section>", yIdx);
  const board = html.slice(sectionStart, sectionEnd);
  assert.match(board, /class="board"/);
  assert.match(board, /paper-tile/);
  assert.equal(/kite|pennant|string-run|slot-dot|slot-row/i.test(board), false);
  assert.equal(board.includes("on the kite"), false);
});

test("how-to-play does not say the word is on the kite", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.equal(/on the kite/i.test(html), false);
  assert.match(html, /Yesterday.s word is shown/);
  assert.match(html, /Today drifted one meaning-step/);
  const dialogStart = html.indexOf("<dialog");
  const dialog = html.slice(dialogStart, html.indexOf("</dialog>"));
  assert.match(dialog, /Yesterday.s word is shown/);
  assert.match(dialog, /one meaning-step/);
  assert.equal(/on the kite/i.test(dialog), false);
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
  assert.equal(card.includes("🪁"), false);
});

test("board does not print heat numbers", () => {
  const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
  const css = fs.readFileSync(path.join(root, "css/style.css"), "utf8");
  assert.equal(app.includes("heat-num"), false);
  assert.equal(app.includes("${g.heat}"), false);
  assert.equal(css.includes(".heat-num"), false);
});

test("end copy uses drift language, not kite voice", () => {
  const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
  assert.match(app, /You caught the drift/);
  assert.match(app, /It drifted away/);
  assert.equal(/caught the kite|kite got away|today.s kite/i.test(app), false);
});

test("how-to sample chips say hotter, not hot", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const dialog = html.slice(html.indexOf("<dialog"), html.indexOf("</dialog>"));
  assert.equal(dialog.includes('chip-label">hot<'), false);
  assert.match(dialog, /chip-label">hotter</);
});

test("colder chips use a wind pip, not a gold sun", () => {
  const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
  assert.match(app, /trend === "colder".*return "wind"/s);
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const dialog = html.slice(html.indexOf("<dialog"), html.indexOf("</dialog>"));
  assert.match(dialog, /heat-chip colder"><span class="pip wind"/);
  assert.equal(/heat-chip colder"><span class="pip sun"/.test(dialog), false);
});

console.log("");
console.log(passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
