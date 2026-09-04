// Lay out the course: data/holes.json, one hole per day, from data/course.json.
// A hole is a tee word, a hole word, and a par. The shortest known route is
// par minus one, so par has a stroke of slack in it the way real par does:
// play the perfect line and that's a birdie.
//
// Run: node scripts/build_holes.mjs --corpus <dir> [--count 800]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildCourse } from "../js/links-game.js";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const corpus = opt("--corpus", null);
const COUNT = Number(opt("--count", 800));
if (!corpus) {
  console.error("usage: node scripts/build_holes.mjs --corpus <dir> [--count N]");
  process.exit(1);
}

const course = buildCourse(JSON.parse(readFileSync("data/course.json", "utf8")));
const freq = readFileSync(join(corpus, "google-10000.txt"), "utf8").split("\n").map((s) => s.trim()).filter(Boolean);
const rank = new Map();
freq.forEach((w, i) => {
  if (!rank.has(w)) rank.set(w, i);
});

// Tees and holes come from the hand-reviewed pair words: concrete, everyday,
// the kind of word a compound hangs off (school, box, mail), not the
// web-corpus abstractions the frequency list is full of (analysis, unit).
// Routes in between may use any word the course knows.
const reviewedWords = new Set(
  [
    ...JSON.parse(readFileSync("data/pairs.json", "utf8")),
    ...JSON.parse(readFileSync("data/pair-overrides.json", "utf8")),
  ].flatMap(([a, b]) => [a, b]),
);
const inDeg = new Map();
for (const [, tos] of course.next) for (const b of tos.keys()) inDeg.set(b, (inDeg.get(b) || 0) + 1);
// a tee or a hole is the name of the day's puzzle, so it holds a higher bar
// than a shot: nothing from the block list, nothing grim, nothing you'd
// hesitate to say to a child
const NO_ANCHOR = new Set(
  `gun blood war bomb drug hell devil evil sin crime prison jail victim weapon knife fire flood plague disease virus hate ugly fat dumb stupid idiot fool loser`.split(/\s+/),
);
if (existsSync("data/block.txt")) {
  for (const line of readFileSync("data/block.txt", "utf8").split("\n")) {
    const t = line.trim().toLowerCase();
    if (t && !t.startsWith("#") && !t.includes(" ")) NO_ANCHOR.add(t);
  }
}
const everyday = (w) => reviewedWords.has(w) && rank.has(w) && rank.get(w) < 6000 && w.length >= 3 && !NO_ANCHOR.has(w);
const tees = [...course.next.keys()].filter((w) => everyday(w) && course.from(w).size >= 5);
const holeOk = (w) => everyday(w) && (inDeg.get(w) || 0) >= 3;

let seed = 2026;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

/** Shortest distances from a tee, and how many shortest routes reach each word. */
function survey(tee, maxDepth) {
  const dist = new Map([[tee, 0]]);
  const ways = new Map([[tee, 1]]);
  const queue = [tee];
  while (queue.length) {
    const w = queue.shift();
    const d = dist.get(w);
    if (d >= maxDepth) continue;
    for (const n of course.from(w).keys()) {
      if (!dist.has(n)) {
        dist.set(n, d + 1);
        ways.set(n, ways.get(w));
        queue.push(n);
      } else if (dist.get(n) === d + 1) {
        ways.set(n, ways.get(n) + ways.get(w));
      }
    }
  }
  return { dist, ways };
}

// a course has a rhythm: mostly par 4, a par 3 and a par 5 every few holes
const PARS = [4, 4, 3, 4, 5, 4, 4, 3, 4, 4, 5, 4, 3, 4, 4, 5, 4, 4];
const REST = 60; // days before a word can be a tee or a hole again
const lastUsed = new Map();
const holes = [];
let tries = 0;
while (holes.length < COUNT && tries < COUNT * 400) {
  tries++;
  const day = holes.length;
  // par is the number of links on the shortest route to the hole word; since
  // the ball drops as soon as your word joins the hole, that route takes
  // par minus one strokes, and playing it is a birdie
  const par = PARS[day % PARS.length];
  const d = par;
  const fresh = (w) => !lastUsed.has(w) || day - lastUsed.get(w) >= REST;
  const tee = pick(tees);
  if (!fresh(tee)) continue;
  const { dist, ways } = survey(tee, d);
  const options = [...dist.entries()]
    .filter(([w, dd]) => dd === d && holeOk(w) && fresh(w) && (d < 3 || ways.get(w) >= 2))
    .map(([w]) => w);
  if (options.length === 0) continue;
  const hole = pick(options);
  holes.push({ tee, hole, par, shortest: d - 1, routes: ways.get(hole) });
  lastUsed.set(tee, day);
  lastUsed.set(hole, day);
}

writeFileSync("data/holes.json", JSON.stringify({ epoch: "2026-01-01", timezone: "America/Los_Angeles", holes }, null, 0) + "\n");
const byPar = holes.reduce((m, h) => ((m[h.par] = (m[h.par] || 0) + 1), m), {});
console.log(`holes.json: ${holes.length} holes (${tries} tries); by par ${JSON.stringify(byPar)}`);
console.log(holes.slice(0, 10).map((h) => `${h.tee} -> ${h.hole} (par ${h.par}, ${h.routes} shortest routes)`).join("\n"));
