import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  HINT_LENGTH_AFTER,
  HINT_LETTER_AFTER,
  RUNGS,
  STRIDE,
  createLadder,
  createPairIndex,
  hintStage,
  hintText,
  ladderShareText,
  ladderWindow,
  linkClue,
  totalTries,
  tryRung,
  useRungHint,
} from "../js/ladder-game.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const chainPack = JSON.parse(fs.readFileSync(path.join(root, "data/chain.json"), "utf8"));
const chain = chainPack.words;
const words = JSON.parse(fs.readFileSync(path.join(root, "data/words.json"), "utf8"));
const realPairs = [
  ...JSON.parse(fs.readFileSync(path.join(root, "data/pairs.json"), "utf8")),
  ...JSON.parse(fs.readFileSync(path.join(root, "data/pair-overrides.json"), "utf8")),
];

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

/* ---------- a small real ladder: coffee cup, cupcake, cakewalk, walkway, way out ---------- */

const toy = [
  { w: "coffee", pivot: "iced coffee" },
  { w: "cup", pivot: "coffee cup" },
  { w: "cake", pivot: "cupcake" },
  { w: "walk", pivot: "cakewalk" },
  { w: "way", pivot: "walkway" },
  { w: "out", pivot: "way out" },
];
const toyPairs = [
  ["coffee", "bean"],
  ["coffee", "table", "coffee table"],
  ["cup", "board", "cupboard"],
  ["board", "walk", "boardwalk"],
  ["side", "walk", "sidewalk"],
];
const toyDict = new Set([
  ...toy.map((e) => e.w),
  "bean", "table", "board", "side", "zebra",
]);
const toyIndex = () => createPairIndex(toyPairs, toy);
const fresh = () => createLadder(toy, 0);

test("a ladder is six chain words: top, four rungs, bottom", () => {
  assert.equal(RUNGS, 4);
  const s = fresh();
  assert.equal(s.top, "coffee");
  assert.equal(s.bottom, "out");
  assert.deepEqual(s.answers, ["cup", "cake", "walk", "way"]);
  assert.equal(s.rungs.length, 4);
  assert.equal(s.solved, false);
});

test("each link carries the phrase that joins its two words", () => {
  const s = fresh();
  assert.deepEqual(s.pivots, ["coffee cup", "cupcake", "cakewalk", "walkway", "way out"]);
});

test("ladders step through the real chain and wrap at the end", () => {
  const w0 = ladderWindow(chain, 0).map((e) => e.w);
  const w1 = ladderWindow(chain, 1).map((e) => e.w);
  assert.equal(w0.length, RUNGS + 2);
  // today's bottom is tomorrow's top, and nothing else leaks forward
  assert.equal(STRIDE, RUNGS + 1);
  assert.equal(w1[0], w0[w0.length - 1]);
  assert.equal(new Set([...w0, ...w1]).size, 2 * (RUNGS + 2) - 1);
  assert.equal(chain.length % STRIDE, 0, "the chain divides into whole ladders");
  const puzzles = chain.length / STRIDE;
  const last = ladderWindow(chain, puzzles - 1).map((e) => e.w);
  const start = chain.length - STRIDE;
  last.forEach((w, j) => assert.equal(w, chain[(start + j) % chain.length].w));
  assert.equal(last[last.length - 1], chain[0].w);
});

test("the intended answer locks a rung and counts one try", () => {
  const r = tryRung(fresh(), 0, "Cup ", toyDict, toyIndex());
  assert.equal(r.ok, true);
  assert.equal(r.result, "lock");
  assert.equal(r.state.rungs[0].word, "cup");
  assert.equal(r.state.rungs[0].tries, 1);
});

test("an alternative that joins both neighbours also locks", () => {
  // cup + board (cupboard), board + walk (boardwalk)
  const r = tryRung(fresh(), 1, "board", toyDict, toyIndex());
  assert.equal(r.result, "lock");
  assert.equal(r.state.rungs[1].word, "board");
});

test("a miss says which side it joined", () => {
  const above = tryRung(fresh(), 0, "bean", toyDict, toyIndex());
  assert.equal(above.result, "above");
  assert.equal(above.phraseAbove, "coffee bean");
  assert.equal(above.state.rungs[0].tries, 1);
  assert.deepEqual(above.state.rungs[0].misses, [{ word: "bean", side: "above" }]);

  const below = tryRung(fresh(), 1, "side", toyDict, toyIndex());
  assert.equal(below.result, "below");
  assert.equal(below.phraseBelow, "sidewalk");

  const neither = tryRung(fresh(), 1, "zebra", toyDict, toyIndex());
  assert.equal(neither.result, "neither");
});

test("unknown words, repeats, and locked rungs are refused without a try", () => {
  const bad = tryRung(fresh(), 0, "qqq", toyDict, toyIndex());
  assert.equal(bad.ok, false);
  assert.equal(bad.reason, "invalid");

  const once = tryRung(fresh(), 0, "bean", toyDict, toyIndex()).state;
  const twice = tryRung(once, 0, "bean", toyDict, toyIndex());
  assert.equal(twice.ok, false);
  assert.equal(twice.reason, "duplicate");
  assert.equal(once.rungs[0].tries, 1);

  const locked = tryRung(fresh(), 0, "cup", toyDict, toyIndex()).state;
  const again = tryRung(locked, 0, "bean", toyDict, toyIndex());
  assert.equal(again.ok, false);
  assert.equal(again.reason, "locked");
});

test("all four rungs locked solves the ladder and ends play", () => {
  let s = fresh();
  for (const [i, w] of ["cup", "cake", "walk", "way"].entries()) {
    s = tryRung(s, i, w, toyDict, toyIndex()).state;
  }
  assert.equal(s.solved, true);
  assert.equal(totalTries(s), 4);
  assert.equal(tryRung(s, 0, "bean", toyDict, toyIndex()).reason, "solved");
});

test("hints unlock per rung by misses and never appear unasked", () => {
  let s = fresh();
  assert.equal(hintStage(s.rungs[0]), 0);
  assert.equal(useRungHint(s, 0).ok, false);
  for (const w of ["bean", "table"]) s = tryRung(s, 0, w, toyDict, toyIndex()).state;
  assert.equal(HINT_LENGTH_AFTER, 2);
  assert.equal(hintStage(s.rungs[0]), 1);
  assert.equal(s.rungs[0].hints, 0);
  s = useRungHint(s, 0).state;
  assert.equal(s.rungs[0].hints, 1);
  assert.equal(hintText(s, 0), "_ _ _");
  assert.equal(useRungHint(s, 0).ok, false);
  for (const w of ["zebra", "board"]) s = tryRung(s, 0, w, toyDict, toyIndex()).state;
  assert.equal(HINT_LETTER_AFTER, 4);
  assert.equal(hintStage(s.rungs[0]), 2);
  s = useRungHint(s, 0).state;
  assert.equal(hintText(s, 0), "c _ _");
});

test("a link shows its phrase when both sides are known", () => {
  let s = fresh();
  assert.deepEqual(linkClue(s, 0, toyIndex()), { kind: "blank", text: "coffee ______" });
  s = tryRung(s, 0, "cup", toyDict, toyIndex()).state;
  assert.deepEqual(linkClue(s, 0, toyIndex()), { kind: "phrase", text: "coffee cup" });
  assert.deepEqual(linkClue(s, 1, toyIndex()), { kind: "blank", text: "cup ______" });
});

test("a blank is written on the side the missing word belongs", () => {
  const s = createLadder(
    [
      { w: "capital", pivot: "capital city" },
      { w: "letter", pivot: "capital letter" },
      { w: "opener", pivot: "letter opener" },
      { w: "can", pivot: "can opener" },
      { w: "soda", pivot: "soda can" },
      { w: "club", pivot: "club soda" },
    ],
    0,
  );
  const index = createPairIndex([], []);
  assert.deepEqual(linkClue(s, 0, index), { kind: "blank", text: "capital ______" });
  // club soda: the bottom word comes first, so the blank sits after it
  assert.deepEqual(linkClue(s, 4, index), { kind: "blank", text: "club ______" });
  assert.deepEqual(linkClue(s, 2, index), { kind: "none" });
});

test("a locked alternative still gets a phrase and a positioned blank", () => {
  let s = tryRung(fresh(), 1, "board", toyDict, toyIndex()).state; // cupboard, boardwalk
  assert.deepEqual(linkClue(s, 1, toyIndex()), { kind: "blank", text: "______ board" });
  assert.deepEqual(linkClue(s, 2, toyIndex()), { kind: "blank", text: "board ______" });
  s = tryRung(s, 0, "cup", toyDict, toyIndex()).state;
  assert.deepEqual(linkClue(s, 1, toyIndex()), { kind: "phrase", text: "cupboard" });
});

test("share card counts tries per rung and never names a rung", () => {
  let s = fresh();
  for (const w of ["bean", "table"]) s = tryRung(s, 0, w, toyDict, toyIndex()).state;
  s = useRungHint(s, 0).state;
  for (const [i, w] of ["cup", "cake", "walk", "way"].entries()) {
    s = tryRung(s, i, w, toyDict, toyIndex()).state;
  }
  const text = ladderShareText({ puzzleNumber: 12, state: s, url: "https://x.y/" });
  assert.match(text, /#12/);
  assert.match(text, /6 tries/);
  assert.match(text, /coffee/);
  assert.match(text, /out/);
  for (const w of ["cup", "cake", "walk", "way"]) assert.doesNotMatch(text, new RegExp(`\\b${w}\\b`));
  const row = text.split("\n").find((l) => /[🟩🟨🟧]/u.test(l));
  assert.equal([...row].filter((c) => /[🟩🟨🟧]/u.test(c)).length, RUNGS);
  assert.match(text, /💡/);
});

test("every real ladder is solvable with its intended answers", () => {
  const index = createPairIndex(realPairs, chain);
  const dict = new Set([...words, ...realPairs.flat()]);
  const puzzles = chain.length / STRIDE;
  for (let k = 0; k < puzzles; k++) {
    let s = createLadder(chain, k);
    for (let i = 0; i < RUNGS; i++) {
      const r = tryRung(s, i, s.answers[i], dict, index);
      assert.equal(r.result, "lock", `puzzle ${k} rung ${i} (${s.answers[i]})`);
      s = r.state;
    }
    assert.equal(s.solved, true, `puzzle ${k}`);
    const seen = new Set([s.top, s.bottom, ...s.answers]);
    assert.equal(seen.size, RUNGS + 2, `puzzle ${k} repeats a word`);
  }
});

test("the domino chain reads downward on every link and every line is solvable", () => {
  const lines = JSON.parse(fs.readFileSync(path.join(root, "data/lines.json"), "utf8")).words;
  assert.ok(lines.length >= 5 * 30 + 1, `only ${lines.length} words`);
  lines.forEach((e, i) => {
    if (i === 0) return; // an open chain: the first word has nothing above it
    const prev = lines[i - 1].w;
    const u = e.pivot.toLowerCase();
    // the tile above always comes first in the phrase, so a column reads downward
    const forward = u === `${prev} ${e.w}` || u === prev + e.w;
    assert.ok(forward, `${prev} + ${e.w}: "${e.pivot}" does not read downward`);
  });
  const index = createPairIndex(realPairs, lines);
  const dict = new Set([...words, ...realPairs.flat()]);
  for (let k = 0; k < Math.floor((lines.length - 1) / STRIDE); k++) {
    let s = createLadder(lines, k);
    for (let i = 0; i < RUNGS; i++) s = tryRung(s, i, s.answers[i], dict, index).state;
    assert.equal(s.solved, true, `line ${k}`);
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
