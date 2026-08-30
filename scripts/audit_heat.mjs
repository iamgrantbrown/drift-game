import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  calibrationBoosts,
  calibrationCaps,
  createHeatLookup,
  distanceText,
} from "../js/heat.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const chain = JSON.parse(fs.readFileSync(path.join(root, "data/chain.json"), "utf8")).words;
const words = JSON.parse(fs.readFileSync(path.join(root, "data/words.json"), "utf8"));
const corrections = JSON.parse(
  fs.readFileSync(path.join(root, "data/heat-overrides.json"), "utf8"),
);
const caps = JSON.parse(fs.readFileSync(path.join(root, "data/heat-caps.json"), "utf8"));

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
  const calibrated = createHeatLookup(
    words,
    row,
    calibrationBoosts(answer, corrections),
    calibrationCaps(answer, caps),
  );
  console.log(`\n${answer.toUpperCase()} · day ${day}`);
  for (const [guess, floor] of Object.entries(expected)) {
    const before = raw.heat(guess);
    const after = calibrated.heat(guess);
    const ok = after >= floor;
    console.log(
      `  ${guess.padEnd(12)} ${String(before).padStart(3)} → ${String(after).padStart(3)}  ${distanceText(after)}${ok ? "" : "  FAIL"}`,
    );
    if (!ok) failures += 1;
  }
}

for (const [answer, expected] of Object.entries(caps)) {
  const day = chain.findIndex((entry) => entry.w === answer);
  const row = new Uint8Array(
    fs.readFileSync(path.join(root, "data", "heat", `${String(day).padStart(3, "0")}.bin`)),
  );
  const calibrated = createHeatLookup(
    words,
    row,
    calibrationBoosts(answer, corrections),
    calibrationCaps(answer, caps),
  );
  console.log(`\n${answer.toUpperCase()} · wrong-sense caps`);
  for (const [guess, cap] of Object.entries(expected)) {
    const after = calibrated.heat(guess);
    const ok = after <= cap;
    console.log(
      `  ${guess.padEnd(12)} ${String(after).padStart(3)} ≤ ${String(cap).padStart(3)}  ${distanceText(after)}${ok ? "" : "  FAIL"}`,
    );
    if (!ok) failures += 1;
  }
}

if (failures) {
  console.error(`\n${failures} heat audit failure${failures === 1 ? "" : "s"}`);
  process.exit(1);
}

console.log(`\n${new Set([...Object.keys(corrections), ...Object.keys(caps)]).size} representative puzzles passed`);
