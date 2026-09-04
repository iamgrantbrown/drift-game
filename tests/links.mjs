import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  askCaddie,
  bestShot,
  buildCourse,
  caddieLine,
  createHole,
  distances,
  drop,
  undo,
  selectHole,
  holeFromSpec,
  holeShots,
  lieOf,
  play,
  routeDistances,
  scoreName,
  shareCard,
  yardage,
} from "../js/links-game.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lines = JSON.parse(fs.readFileSync(path.join(root, "data/lines.json"), "utf8")).words;
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

/* a toy course: school -> bus -> stop -> watch -> dog -> ear, plus side roads */
const toyPairs = [
  ["school", "bus", "school bus"],
  ["bus", "stop", "bus stop"],
  ["stop", "watch", "stopwatch"],
  ["watch", "dog", "watchdog"],
  ["dog", "ear", "dog ear"],
  ["school", "yard", "schoolyard"], // a dead end: yard goes nowhere
  ["school", "day", "school day"],
  ["day", "dream", "daydream"], // dream goes nowhere either
  ["stop", "sign", "stop sign"],
  ["sign", "post", "signpost"],
  ["post", "card", "postcard"], // long way round, never reaches ear
  ["bus", "lane", "bus lane"],
  ["lane", "dog", "lane dog"], // a shortcut: school, bus, lane, dog = 3 strokes
  ["ear", "drum", "eardrum"], // a backward-looking pair, must not count as a shot into the hole
];
const toyLine = ["school", "bus", "stop", "watch", "dog", "ear"].map((w, i, a) => ({
  w,
  pivot: i === 0 ? w : toyPairs.find(([x, y]) => x === a[i - 1] && y === w)[2],
}));
const course = () => buildCourse(toyPairs);
const hole = () => createHole(toyLine, 0);

test("a course only knows shots that read forward", () => {
  const c = course();
  assert.equal(c.shot("school", "bus"), "school bus");
  assert.equal(c.shot("bus", "school"), null);
  assert.equal(c.shot("stop", "watch"), "stopwatch");
  assert.equal(c.shot("ear", "drum"), "eardrum");
});

test("a hole has a tee, a flag, and a par from the authored route", () => {
  const h = hole();
  assert.equal(h.tee, "school");
  assert.equal(h.hole, "ear");
  assert.equal(h.par, 4);
  assert.deepEqual(h.path, ["school"]);
  assert.equal(h.strokes, 0);
  assert.equal(h.holed, false);
});

test("yardage is the fewest strokes left to a word that joins the hole", () => {
  const d = distances(course(), "ear");
  assert.equal(d.get("dog"), 0);
  assert.equal(d.get("watch"), 1);
  assert.equal(d.get("lane"), 1);
  assert.equal(d.get("bus"), 2);
  assert.equal(d.get("school"), 3); // the shortcut through lane
  assert.equal(d.get("yard"), undefined); // no route
  assert.equal(yardage(3), "3 out");
  assert.equal(yardage(1), "1 out");
  assert.equal(yardage(undefined), "no route from here");
});

test("a real shot counts a stroke, moves the ball, and reports the phrase and the yardage", () => {
  const c = course();
  const d = distances(c, "ear");
  const r = play(hole(), " Bus", c, d);
  assert.equal(r.ok, true);
  assert.equal(r.phrase, "school bus");
  assert.equal(r.before, 3);
  assert.equal(r.after, 2);
  assert.equal(r.holed, false);
  assert.deepEqual(r.state.path, ["school", "bus"]);
  assert.equal(r.state.strokes, 1);
});

test("a word the course doesn't know costs nothing", () => {
  const c = course();
  const d = distances(c, "ear");
  const r = play(hole(), "teacher", c, d);
  assert.equal(r.ok, false);
  assert.equal(r.reason, "unknown");
  assert.equal(r.state.strokes, 0);
  const bad = play(hole(), "sch00l", c, d);
  assert.equal(bad.reason, "invalid");
});

test("you can't play through a word you've already been on", () => {
  const c = course();
  const d = distances(c, "ear");
  let s = play(hole(), "bus", c, d).state;
  const back = play(s, "school", c, d);
  assert.equal(back.ok, false);
  assert.equal(["unknown", "revisit"].includes(back.reason), true);
});

test("reaching a word that joins the hole holes out, and the hole word itself sinks it too", () => {
  const c = course();
  const d = distances(c, "ear");
  let s = hole();
  for (const w of ["bus", "stop", "watch"]) s = play(s, w, c, d).state;
  const r = play(s, "dog", c, d);
  assert.equal(r.holed, true);
  assert.equal(r.state.holed, true);
  assert.equal(r.state.strokes, 4);
  assert.equal(r.finalPhrase, "dog ear");
  assert.equal(play(r.state, "ear", c, d).reason, "holed");

  // playing the hole word from an adjacent word also sinks it, for the same stroke count
  let t = hole();
  for (const w of ["bus", "stop", "watch", "dog"]) t = play(t, w, c, d).state;
  assert.equal(t.holed, true);
});

test("a shortcut beats par and the score says so", () => {
  const c = course();
  const d = distances(c, "ear");
  let s = hole();
  for (const w of ["bus", "lane", "dog"]) s = play(s, w, c, d).state;
  assert.equal(s.holed, true);
  assert.equal(s.strokes, 3);
  assert.equal(scoreName(3, 4), "birdie");
  assert.equal(scoreName(4, 4), "par");
  assert.equal(scoreName(5, 4), "bogey");
  assert.equal(scoreName(6, 4), "double bogey");
  assert.equal(scoreName(2, 4), "eagle");
  assert.equal(scoreName(9, 4), "+5");
});

test("a drop goes back one word for a penalty stroke", () => {
  const c = course();
  const d = distances(c, "ear");
  let s = play(hole(), "yard", c, d).state; // dead end
  assert.equal(d.get("yard"), undefined);
  assert.equal(drop(hole()).ok, false); // nothing to drop back to on the tee
  const r = drop(s);
  assert.equal(r.ok, true);
  assert.deepEqual(r.state.path, ["school"]);
  assert.equal(r.state.strokes, 2);
});

test("the caddie picks the closest shot and gives it away in three stages", () => {
  const c = course();
  const d = distances(c, "ear");
  let s = hole();
  const pick = bestShot(s, c, d);
  assert.equal(pick.word, "bus"); // bus is 2 out; yard and day have no route
  assert.equal(caddieLine(1, pick), "Try a 3-letter word.");
  assert.equal(caddieLine(2, pick), "It starts with B.");
  assert.equal(caddieLine(3, pick), "School b _ _.");
  let r = askCaddie(s);
  assert.equal(r.ok, true);
  assert.equal(r.state.hints, 0); // the letter count is free
  assert.equal(r.state.caddie.stage, 1);
  s = askCaddie(askCaddie(r.state).state).state;
  assert.equal(s.caddie.stage, 3);
  assert.equal(s.hints, 2); // the first letter and the blanked phrase are not
  assert.equal(askCaddie(s).ok, false); // three is all the caddie has
  s = play(s, "bus", c, d).state;
  assert.equal(askCaddie(s).state.caddie.stage, 1); // a new lie, a fresh caddie
  const text = shareCard({ puzzleNumber: 1, state: s, url: "u" });
  assert.match(text, /Hints: 2/);
  assert.doesNotMatch(text, /Hints: 3/);
  // reading the green: the words that finish the hole
  assert.deepEqual(holeShots(c, "ear").map((x) => x.word), ["dog"]);
  assert.equal(holeShots(c, "ear")[0].phrase, "dog ear");
  // from a dead end the caddie says so
  const stuck = play(hole(), "yard", c, d).state;
  assert.equal(bestShot(stuck, c, d), null);
  assert.match(caddieLine(1, null), /drop/);
});

test("golf scorecard keeps answers private and links to the exact date", () => {
  const c = course();
  let s = play(hole(), 'yard', c).state;
  s = drop(s).state;
  for (const w of ['bus','lane','dog']) s = play(s,w,c).state;
  const text = shareCard({ puzzleNumber:266, state:s, date:'2026-09-23', url:'https://x.y/?ref=card' });
  assert.match(text, /Links #266/);
  assert.match(text, /HOLE  \| PAR \| STROKES/);
  assert.match(text, /266   \| 4   \| 5/);
  assert.match(text, /SCHOOL → EAR/);
  assert.match(text, /BOGEY \(\+1\)/);
  assert.match(text, /https:\/\/x.y\/\?ref=card&date=2026-09-23/);
  for (const w of ['bus','lane','dog','yard']) assert.doesNotMatch(text.toLowerCase(), new RegExp(`\\b${w}\\b`));
  const birdie = shareCard({ puzzleNumber:250, state:{ ...s, strokes:3, undoUsed:true }, url:'https://x.y/' });
  assert.match(birdie, /③/);
  assert.match(birdie, /BIRDIE \(−1\)/);
  assert.match(birdie, /Free undo used/);
});

test("every shot lands somewhere: fairway, rough, bunker, water, or the green", () => {
  assert.equal(lieOf({ before: 3, after: 2 }), "fairway");
  assert.equal(lieOf({ before: 3, after: 3 }), "rough");
  assert.equal(lieOf({ before: 2, after: 3 }), "bunker");
  assert.equal(lieOf({ before: 2, after: undefined }), "water");
  assert.equal(lieOf({ before: 2, after: 1 }), "green");
  assert.equal(lieOf({ drop: true }), "drop");
  assert.equal(lieOf({ before: 1, after: 0 }, true), "holed");
});

test("every authored line can still be played to its length on the reviewed pairs", () => {
  const c = buildCourse(realPairs, lines);
  const holes = Math.floor((lines.length - 1) / 5);
  for (let k = 0; k < holes; k++) {
    const h = createHole(lines, k);
    const d = distances(c, h.hole);
    let s = h;
    for (const w of h.route) {
      const r = play(s, w, c, d);
      assert.equal(r.ok, true, `line ${k}: ${s.path.at(-1)} -> ${w}`);
      s = r.state;
    }
    assert.equal(s.holed, true, `line ${k}`);
  }
});

test("yardage and caddie never send a player through a forbidden revisit", () => {
  const c = buildCourse(JSON.parse(fs.readFileSync(path.join(root, "data/course.json"), "utf8")));
  let s = holeFromSpec({ tee: "ball", hole: "blue", par: 4 });
  for (const word of ["field", "work", "sheet", "metal"]) {
    const r = play(s, word, c);
    assert.equal(r.ok, true);
    s = r.state;
  }
  assert.equal(distances(c, "blue").get("metal"), 5); // old, unrestricted answer
  assert.equal(routeDistances(s, c).get("metal"), undefined);
  assert.equal(s.log.at(-1).after, undefined);
  assert.equal(lieOf(s.log.at(-1)), "water");
  assert.equal(bestShot(s, c), null);
  s = drop(s).state;
  assert.equal(routeDistances(s, c).has("sheet"), true);
  assert.notEqual(bestShot(s, c), null);
  assert.equal(s.strokes, 5);
});

test("a legal detour gets its real length and the caddie avoids a false shortcut", () => {
  const pairs = [["tee", "alpha"], ["alpha", "beta"], ["beta", "alpha"],
    ["alpha", "finish"], ["beta", "gamma"], ["gamma", "delta"],
    ["delta", "finish"], ["finish", "hole"]];
  const c = buildCourse(pairs);
  let s = holeFromSpec({ tee: "tee", hole: "hole", par: 4 });
  s = play(s, "alpha", c).state;
  s = play(s, "beta", c).state;
  assert.equal(distances(c, "hole").get("beta"), 2);
  assert.equal(routeDistances(s, c).get("beta"), 3);
  assert.equal(s.log.at(-1).after, 3);
  assert.equal(bestShot(s, c).word, "gamma");
  assert.equal(bestShot(s, c).after, 2);
  const restored = drop(s).state;
  assert.equal(routeDistances(restored, c).get("alpha"), 1);
  assert.equal(bestShot(restored, c).word, "finish");
});

test("reviewed spelling equivalents use existing shots in both directions", () => {
  for (const [stored, typed] of [["tire", "tyre"], ["tyre", "tire"],
    ["color", "colour"], ["honor", "honour"], ["centre", "center"]]) {
    const c = buildCourse([["start", stored], [stored, "end"]]);
    const originalEdges = [...c.next].map(([a, tos]) => [a, [...tos]]);
    const s = holeFromSpec({ tee: "start", hole: "end", par: 2 });
    const r = play(s, ` ${typed.toUpperCase()} `, c);
    assert.equal(r.ok, true, typed);
    assert.equal(r.holed, true);
    assert.equal(r.state.path.at(-1), stored);
    assert.deepEqual([...c.next].map(([a, tos]) => [a, [...tos]]), originalEdges);
  }
  const c = buildCourse([["start", "show"], ["show", "end"]]);
  assert.equal(play(holeFromSpec({ tee: "start", hole: "end", par: 2 }), "shower", c).reason, "unknown");
});

test("the course is big, clean, and every laid-out hole has par one over its shortest route", () => {
  const shots = JSON.parse(fs.readFileSync(path.join(root, "data/course.json"), "utf8"));
  // a reviewed course is smaller than a scraped one, and that is the point
  assert.ok(shots.length >= 5000, `only ${shots.length} shots`);
  for (const [a, b, phrase] of shots) {
    assert.match(a, /^[a-z]{3,}$/);
    assert.match(b, /^[a-z]{3,}$/);
    assert.ok(phrase === `${a} ${b}` || phrase === a + b, `${a} -> ${b}: "${phrase}" does not read forward`);
  }
  const c = buildCourse(shots);
  const { holes } = JSON.parse(fs.readFileSync(path.join(root, "data/holes.json"), "utf8"));
  assert.ok(holes.length >= 365, `only ${holes.length} holes`);
  for (const [i, h] of holes.entries()) {
    assert.ok(h.par >= 3 && h.par <= 5, `hole ${i}: par ${h.par}`);
    const d = distances(c, h.hole);
    assert.equal(d.get(h.tee), h.par - 1, `hole ${i}: ${h.tee} -> ${h.hole} is ${d.get(h.tee)} out on a par ${h.par}`);
    const s = holeFromSpec(h, i);
    assert.deepEqual(s.path, [h.tee]);
  }
});

test("one free undo restores the route and stroke count, retaining hints", () => {
  const c = course(); let s = play(hole(), 'bus', c).state;
  s = askCaddie(askCaddie(s).state).state;
  const before = JSON.stringify(s);
  const r = undo(s);
  assert(r.ok); assert.equal(r.state.strokes, 0); assert.deepEqual(r.state.path, ['school']);
  assert.equal(r.state.log.length, 0); assert.equal(r.state.hints, 1); assert.equal(r.state.caddie, null);
  assert.equal(JSON.stringify(s), before);
  assert(!undo(play(r.state, 'bus', c).state).ok);
  assert(!undo(drop(s).state).ok);
  assert(!undo({ ...s, holed: true }).ok);
});

test("new rotation preserves historical and saved future rounds", () => {
  const layout = JSON.parse(fs.readFileSync(path.join(root, 'data/holes.json')));
  const curated = JSON.parse(fs.readFileSync(path.join(root, 'data/holes-curated.json')));
  assert.equal(selectHole(layout, curated, '2026-09-07').tee, 'nose');
  assert.equal(selectHole(layout, curated, '2026-09-08').tee, 'magic');
  assert.equal(selectHole(layout, curated, '2026-09-22').tee, 'magic');
  const old = { hole:'string|line', path:['string','bean'] };
  assert.equal(selectHole(layout, curated, '2026-12-08', old).tee, 'string');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
