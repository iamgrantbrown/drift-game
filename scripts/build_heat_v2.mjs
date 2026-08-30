#!/usr/bin/env node
/** Drift v2 heat baker. Build-time only — the game never calls Datamuse.
 *
 * Fetches (with a resumable disk cache at scripts/datamuse_v2/):
 *   per secret: ml (1000), rel_trg (200), rel_syn/spc/gen (100)
 *   per puzzle: ml for the answer with yesterday as a topic (sense context)
 *   2-hop:      ml (150) for each secret's top-20 ml neighbors (globally cached)
 * Then bakes:
 *   data/words.json         guess dictionary (union of v1 words, chain, fetched)
 *   data/heat/NNN.bin       one Uint8 row per day (nWords bytes), NNN = day index
 * The stored score is relatedness rank, never edit distance. The interface
 * translates it into six plain distance bands from far away to almost there.
 *
 * Run: node scripts/build_heat_v2.mjs [--fetch-only|--bake-only]
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CACHE = join(ROOT, "scripts", "datamuse_v2");
const WORD_RE = /^[a-z]{3,14}$/;
const HOP_NEIGHBORS = 20;
const CONTEXT_RESULTS = 50;
const UNSUPPORTED_CLOSE_CAP = 49;
const YESTERDAY_MIN = 76;
const ICE = 5;
const CONCURRENCY = 6;

const chainPack = JSON.parse(readFileSync(join(ROOT, "data", "chain.json"), "utf8"));
const entries = chainPack.words;
const secrets = entries.map((e) => e.w);
// Pinned v1 guess list — never read data/words.json (this script's own output).
const oldWords = JSON.parse(readFileSync(join(ROOT, "scripts", "words_v1.json"), "utf8"));
const pairWords = new Set([
  ...JSON.parse(readFileSync(join(ROOT, "data", "pairs.json"), "utf8")).flat(),
  ...JSON.parse(readFileSync(join(ROOT, "data", "pair-overrides.json"), "utf8")).flat(),
]);
const trustedPhraseWords = new Set([...oldWords, ...secrets, ...pairWords]);
const seeds = loadSeeds();

mkdirSync(CACHE, { recursive: true });

function loadSeeds() {
  const out = {};
  const p = join(ROOT, "scripts", "related_seeds.json");
  if (existsSync(p)) Object.assign(out, JSON.parse(readFileSync(p, "utf8")));
  const b = join(ROOT, "scripts", "boosts.txt");
  if (existsSync(b)) {
    for (const line of readFileSync(b, "utf8").split("\n")) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 3) continue;
      const [secret, tier, ...ws] = parts;
      const bucket = ((out[secret] ||= {})[tier] ||= []);
      for (const w of ws) if (!bucket.includes(w)) bucket.push(w);
    }
  }
  return out;
}

function cachePath(kind, word) {
  return join(CACHE, `${kind}-${word}.json`);
}

async function dmFetch(kind, word, params) {
  const p = cachePath(kind, word);
  if (existsSync(p)) {
    try {
      return JSON.parse(readFileSync(p, "utf8"));
    } catch {
      rmSync(p);
    }
  }
  const url = `https://api.datamuse.com/words?${params}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": "drift-game-heat-builder/2.0" } });
      if (!res.ok) throw new Error(`http ${res.status}`);
      const data = await res.json();
      writeFileSync(p, JSON.stringify(data));
      return data;
    } catch (err) {
      if (attempt === 3) throw new Error(`datamuse ${kind}:${word} failed: ${err.message}`);
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
}

async function pooled(tasks, width = CONCURRENCY) {
  const results = new Array(tasks.length);
  let next = 0;
  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= tasks.length) return;
      results[i] = await tasks[i]();
      if (i > 0 && i % 200 === 0) console.log(`  ${i}/${tasks.length}`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(width, tasks.length) }, worker));
  return results;
}

function clean(w) {
  w = String(w || "").trim().toLowerCase();
  return WORD_RE.test(w) ? w : null;
}

async function fetchAll() {
  console.log(`fetching direct lists for ${secrets.length} secrets…`);
  await pooled(
    secrets.flatMap((s, day) => [
      () => dmFetch("ml", s, `ml=${s}&max=1000`),
      () => dmFetch("trg", s, `rel_trg=${s}&max=200`),
      () => dmFetch("syn", s, `rel_syn=${s}&max=100`),
      () => dmFetch("spc", s, `rel_spc=${s}&max=100`),
      () => dmFetch("gen", s, `rel_gen=${s}&max=100`),
      () => dmFetch(
        `context${CONTEXT_RESULTS}-${String(day).padStart(3, "0")}`,
        s,
        `ml=${s}&topics=${encodeURIComponent(secrets[(day - 1 + secrets.length) % secrets.length])}&max=${CONTEXT_RESULTS}`,
      ),
    ]),
  );
  const hopTargets = new Set();
  for (const s of secrets) {
    const ml = JSON.parse(readFileSync(cachePath("ml", s), "utf8"));
    for (const e of ml.slice(0, HOP_NEIGHBORS)) {
      const w = clean(e.word);
      if (w && w !== s) hopTargets.add(w);
    }
  }
  console.log(`fetching 2-hop lists for ${hopTargets.size} unique neighbors…`);
  await pooled([...hopTargets].map((w) => () => dmFetch("hop", w, `ml=${w}&max=150`)));
  console.log("fetch complete.");
}

function directHeat(rank) {
  if (rank < 8) return 97 - rank;
  if (rank < 22) return 89 - (rank - 8);
  if (rank < 42) return 74 - Math.floor((rank - 22) / 2);
  if (rank < 62) return 59 - Math.floor((rank - 42) / 2);
  if (rank < 86) return 44 - Math.floor((rank - 62) / 2);
  // long tail: ranks 86..999 glide from ~32 down to 18 (cool -> cold)
  return Math.max(18, 32 - Math.floor((rank - 86) / 70));
}

const SEED_TIER_HEAT = { close: 93, hot: 80, warm: 62, luke: 48 };

function bake() {
  console.log("building dictionary…");
  // Commonness proxy: how many distinct fetched lists a word appears in.
  // Keeps the guess list to common, central words so per-day heat rows
  // (nWords bytes each) stay small enough to ship one per reviewed puzzle.
  const DICT_TARGET = 20000;
  const counts = new Map();
  const countList = (path) => {
    if (!existsSync(path)) return;
    for (const e of JSON.parse(readFileSync(path, "utf8"))) {
      const w = clean(e.word);
      if (w) counts.set(w, (counts.get(w) || 0) + 1);
    }
  };
  const hopWords = new Set();
  for (const s of secrets) {
    for (const kind of ["ml", "trg", "syn", "spc", "gen"]) countList(cachePath(kind, s));
    const day = entries.findIndex((entry) => entry.w === s);
    const ml = JSON.parse(readFileSync(cachePath("ml", s), "utf8"));
    for (const e of ml.slice(0, HOP_NEIGHBORS)) {
      const w = clean(e.word);
      if (w && w !== s) hopWords.add(w);
    }
  }
  for (const w of hopWords) countList(cachePath("hop", w));
  const dict = new Set(oldWords.filter((w) => WORD_RE.test(w)));
  for (const s of secrets) dict.add(s);
  const ranked = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .map(([w]) => w);
  for (const w of ranked) {
    if (dict.size >= DICT_TARGET) break;
    dict.add(w);
  }
  const words = [...dict].sort();
  const index = new Map(words.map((w, i) => [w, i]));
  console.log(`dictionary: ${words.length} words (was ${oldWords.length})`);

  mkdirSync(join(ROOT, "data", "heat"), { recursive: true });
  const stats = [];
  for (let day = 0; day < secrets.length; day++) {
    const secret = secrets[day];
    const yesterday = secrets[(day - 1 + secrets.length) % secrets.length];
    const heat = new Map(); // word -> heat, max-merged
    const senseHeat = new Map(); // context-conditioned evidence for the intended sense

    const bump = (w, h) => {
      w = clean(w);
      if (!w || w === secret) return;
      const cur = heat.get(w);
      if (cur === undefined || h > cur) heat.set(w, h);
    };

    const ml = JSON.parse(readFileSync(cachePath("ml", secret), "utf8"));
    ml.forEach((e, r) => bump(e.word, directHeat(r)));
    JSON.parse(readFileSync(cachePath("trg", secret), "utf8")).forEach((e, r) =>
      bump(e.word, Math.max(35, 78 - Math.floor(r * 1.2))),
    );
    for (const kind of ["syn", "spc", "gen"]) {
      JSON.parse(readFileSync(cachePath(kind, secret), "utf8")).forEach((e, r) =>
        bump(e.word, Math.max(40, 72 - r)),
      );
    }
    // 2-hop: words related to the secret's close neighbors get cold->cool credit
    const hopScore = new Map();
    ml.slice(0, HOP_NEIGHBORS).forEach((n, nr) => {
      const nw = clean(n.word);
      if (!nw || !existsSync(cachePath("hop", nw))) return;
      const nWeight = 1 - (nr / HOP_NEIGHBORS) * 0.5;
      JSON.parse(readFileSync(cachePath("hop", nw), "utf8")).forEach((e, r) => {
        const w = clean(e.word);
        if (!w || w === secret) return;
        hopScore.set(w, (hopScore.get(w) || 0) + (1 - r / 150) * nWeight);
      });
    });
    for (const [w, score] of hopScore) {
      if (!heat.has(w)) bump(w, 15 + Math.min(19, Math.round(score * 6)));
    }

    // A word in isolation can select the wrong sense (duck as a verb, cup as
    // a vessel). Ask for words meaning today's answer while using yesterday
    // as a topic. This keeps the component word central, unlike querying the
    // whole joined phrase, which can drift toward the phrase's overall idea.
    const context = JSON.parse(
      readFileSync(cachePath(`context${CONTEXT_RESULTS}-${String(day).padStart(3, "0")}`, secret), "utf8"),
    );
    let contextRank = 0;
    for (const e of context) {
      const w = clean(e.word);
      if (
        !w ||
        !index.has(w) ||
        !trustedPhraseWords.has(w) ||
        w === secret ||
        senseHeat.has(w)
      ) continue;
      senseHeat.set(w, directHeat(contextRank++));
    }
    for (const [w, h] of heat) {
      const contextual = senseHeat.get(w);
      heat.set(w, contextual === undefined ? Math.min(h, UNSUPPORTED_CLOSE_CAP) : Math.max(h, contextual));
    }
    for (const [w, h] of senseHeat) bump(w, h);

    // curated seeds override upward
    const tiers = seeds[secret];
    if (tiers) {
      for (const [tier, ws] of Object.entries(tiers)) {
        const h = SEED_TIER_HEAT[tier];
        if (h) for (const w of ws) bump(w, h);
      }
    }
    bump(yesterday, Math.max(heat.get(yesterday) ?? 0, YESTERDAY_MIN));

    const row = new Uint8Array(words.length).fill(ICE);
    for (const [w, h] of heat) {
      const i = index.get(w);
      if (i !== undefined) row[i] = Math.min(99, h);
    }
    row[index.get(secret)] = 100;
    writeFileSync(join(ROOT, "data", "heat", String(day).padStart(3, "0") + ".bin"), row);
    const above = row.reduce((n, h) => n + (h >= 15 ? 1 : 0), 0);
    stats.push(above);
  }
  writeFileSync(join(ROOT, "data", "words.json"), JSON.stringify(words) + "\n");
  const min = Math.min(...stats), max = Math.max(...stats);
  const avg = Math.round(stats.reduce((a, b) => a + b, 0) / stats.length);
  console.log(`baked ${secrets.length} day files; words with signal per day: min ${min}, avg ${avg}, max ${max}`);
  if (min < 150) console.warn(`WARNING: day ${stats.indexOf(min)} has only ${min} words above the far band`);
}

const mode = process.argv[2] || "";
if (mode !== "--bake-only") await fetchAll();
if (mode !== "--fetch-only") bake();
