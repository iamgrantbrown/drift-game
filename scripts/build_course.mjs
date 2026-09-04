// Build data/course.json: every forward shot the Links course knows, as
// [first, second, phrase]. Sources (downloaded separately, see --corpus):
//   wiktionary-compounds.txt      Category:English compound terms (36k)
//   wordnet-two-word-nouns.txt    WordNet noun lemmas with one space (49k)
//   google-20000.txt              word frequency list, most common first
// plus the hand-reviewed pairs already in data/pairs.json and
// data/pair-overrides.json, which always win.
//
// Run: node scripts/build_course.mjs --corpus <dir> [--common 9000]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const corpus = opt("--corpus", null);
const COMMON = Number(opt("--common", 9000));
// --keep <file>: a reviewed list of phrases that passed the "would a
// twelve-year-old anywhere know it" bar. When given, unreviewed candidates
// only survive if they are on it. Reviewed pairs always survive.
const keepFile = opt("--keep", existsSync("data/keep.txt") ? "data/keep.txt" : null);
const keep = keepFile ? new Set(readFileSync(keepFile, "utf8").split("\n").map((s) => s.trim()).filter(Boolean)) : null;
if (keepFile) console.log(`keeping only reviewed phrases from ${keepFile}`);
if (!corpus) {
  console.error("usage: node scripts/build_course.mjs --corpus <dir> [--common N]");
  process.exit(1);
}
const read = (f) => readFileSync(join(corpus, f), "utf8").split("\n").map((s) => s.trim()).filter(Boolean);

// what counts as a common word: the top N by frequency, letters only,
// three letters or more, and not a function word
const STOP = new Set(
  `the and for are but not you all any can had her was one our out day get has him his how man new now old see two way who boy did its let put say she too use dad mom yes not off own per via than that them then they this were what when with will your from have into just like more over such time very there after where here self some every other ever less most much`.split(/\s+/),
);
// the 10k list has the swears taken out, which suits a family game
const freq = read("google-10000.txt").map((w) => w.toLowerCase());
const rank = new Map();
freq.forEach((w, i) => {
  if (!rank.has(w)) rank.set(w, i);
});
const common = (w) => /^[a-z]{3,}$/.test(w) && rank.has(w) && rank.get(w) < COMMON && !STOP.has(w);
// a closed compound must be a word people actually use: in the 20k
// frequency list or our own guess dictionary. WordNet alone lets in
// "threadfin" and "finback", real words nobody plays.
const knownWord = new Set([
  ...read("google-20000.txt"),
  ...JSON.parse(readFileSync("data/words.json", "utf8")),
]);
// WordNet's two-word nouns include descriptive phrases ("scientific
// knowledge") and jargon ("count agent"); keep only those whose first
// word is itself a noun and whose halves are both very common.
const nounWord = new Set(read("wordnet-single-nouns.txt"));
const WORDNET_COMMON = 6500;
// the second half of an everyday phrase is often a less common word
// ("metal detector"), so it only has to be in the wider 20k list
const rank20 = new Map();
read("google-20000.txt").forEach((w, i) => {
  if (!rank20.has(w)) rank20.set(w, i);
});

// data/block.txt: words and phrases a family game leaves out, reviewed or not
const blockedWords = new Set();
const blockedPhrases = new Set();
if (existsSync("data/block.txt")) {
  for (const line of readFileSync("data/block.txt", "utf8").split("\n")) {
    const t = line.trim().toLowerCase();
    if (!t || t.startsWith("#")) continue;
    (t.includes(" ") ? blockedPhrases : blockedWords).add(t);
  }
}
const blocked = (a, b, phrase) => blockedWords.has(a) || blockedWords.has(b) || blockedPhrases.has(phrase) || blockedWords.has(phrase);

const shots = new Map(); // "a|b" -> phrase
const source = new Map(); // "a|b" -> where it came from
const add = (a, b, phrase, from) => {
  if (a === b) return;
  if (blocked(a, b, phrase)) return;
  const key = `${a}|${b}`;
  if (!shots.has(key)) {
    shots.set(key, phrase);
    source.set(key, from);
  }
};

// 1. reviewed pairs first: they carry authored phrases and always win
const reviewed = [
  ...JSON.parse(readFileSync("data/pairs.json", "utf8")),
  ...(existsSync("data/pair-overrides.json") ? JSON.parse(readFileSync("data/pair-overrides.json", "utf8")) : []),
];
for (const [a, b, unit] of reviewed) {
  const u = (unit || `${a} ${b}`).toLowerCase();
  if (u === `${a} ${b}` || u === a + b) add(a, b, u, "reviewed");
  else if (u === `${b} ${a}` || u === b + a) add(b, a, u, "reviewed");
}

// 2. open compounds: two common words with a space between
const openPhrases = [
  ...read("wiktionary-compounds.txt").filter((t) => /^[a-z]+ [a-z]+$/.test(t)).map((t) => [t, "wiktionary"]),
  ...read("wordnet-two-word-nouns.txt").filter((t) => /^[a-z]+ [a-z]+$/.test(t)).map((t) => [t, "wordnet"]),
];
let openKept = 0;
for (const [phrase, from] of openPhrases) {
  const [a, b] = phrase.split(" ");
  const bOk = common(b) || (from === "wordnet" && /^[a-z]{3,}$/.test(b) && rank20.has(b) && !STOP.has(b));
  if (!common(a) || !bOk) continue;
  if (from === "wordnet" && (!nounWord.has(a) || rank.get(a) >= WORDNET_COMMON)) continue;
  if (keep && !keep.has(phrase)) continue;
  if (!shots.has(`${a}|${b}`)) openKept++;
  add(a, b, phrase, "open");
}

// 3. closed compounds from Wiktionary: split into two common words.
//    The category vouches that the word IS a compound; we only have to
//    find the seam. Prefer the split whose halves are most common.
let closedKept = 0;
for (const word of read("wiktionary-compounds.txt")) {
  if (!/^[a-z]{6,}$/.test(word)) continue;
  if (!knownWord.has(word)) continue;
  let best = null;
  for (let i = 3; i <= word.length - 3; i++) {
    const a = word.slice(0, i);
    const b = word.slice(i);
    if (!common(a) || !common(b)) continue;
    const score = rank.get(a) + rank.get(b);
    if (!best || score < best.score) best = { a, b, score };
  }
  if (!best) continue;
  if (keep && !keep.has(word)) continue;
  if (!shots.has(`${best.a}|${best.b}`)) closedKept++;
  add(best.a, best.b, word, "closed");
}

const out = [...shots.entries()].map(([key, phrase]) => [...key.split("|"), phrase]).sort((x, y) => (x[0] + x[1] < y[0] + y[1] ? -1 : 1));
writeFileSync("data/course.json", JSON.stringify(out) + "\n");

const words = new Set(out.flatMap(([a, b]) => [a, b]));
const outDeg = new Map();
for (const [a] of out) outDeg.set(a, (outDeg.get(a) || 0) + 1);
const degs = [...outDeg.values()].sort((a, b) => a - b);
console.log(`course.json: ${out.length} shots over ${words.size} words`);
console.log(`  reviewed ${[...source.values()].filter((s) => s === "reviewed").length}, open ${openKept}, closed ${closedKept}`);
console.log(`  words with a forward shot: ${outDeg.size}; median shots per word ${degs[Math.floor(degs.length / 2)]}; words with 10+: ${degs.filter((d) => d >= 10).length}`);
const sample = out.filter((_, i) => i % Math.floor(out.length / 40) === 0).map((p) => p[2]);
console.log("  sample:", sample.join(", "));
