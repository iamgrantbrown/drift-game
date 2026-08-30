import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { bandFor, createHeatLookup, relationshipBoosts } from "../js/heat.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const chain = JSON.parse(fs.readFileSync(path.join(root, "data/chain.json"), "utf8")).words;
const words = JSON.parse(fs.readFileSync(path.join(root, "data/words.json"), "utf8"));
const pairs = JSON.parse(fs.readFileSync(path.join(root, "data/pairs.json"), "utf8"));
const corrections = JSON.parse(
  fs.readFileSync(path.join(root, "data/heat-overrides.json"), "utf8"),
);

let failures = 0;

for (const [answer, expected] of Object.entries(corrections)) {
  const day = chain.findIndex((entry) => entry.w === answer);
  if (day < 0) {
    console.error(`${answer}: missing from chain`);
    failures += 1;
    continue;
  }
  const row = new Uint8Array(
    fs.readFileSync(path.join(root, "data/heat", `${String(day).padStart(3, "0")}.bin`)),
  );
  const raw = createHeatLookup(words, row);
  const calibrated = createHeatLookup(words, row, relationshipBoosts(pairs, answer, corrections));
  console.log(`\n${answer.toUpperCase()} · day ${day}`);
  for (const [guess, floor] of Object.entries(expected)) {
    const before = raw.heat(guess);
    const after = calibrated.heat(guess);
    const ok = after >= floor;
    console.log(
      `  ${guess.padEnd(12)} ${String(before).padStart(3)} → ${String(after).padStart(3)}  ${bandFor(after)}${ok ? "" : "  FAIL"}`,
    );
    if (!ok) failures += 1;
  }
}

if (failures) {
  console.error(`\n${failures} heat audit failure${failures === 1 ? "" : "s"}`);
  process.exit(1);
}

console.log(`\n${Object.keys(corrections).length} representative puzzles passed`);
