#!/usr/bin/env node
/** Validate the production puzzle chain without rewriting it.
 *
 * data/chain.json is the reviewed, calendar-sensitive source of truth. An
 * earlier version of this script carried a different draft chain and could
 * silently replace live puzzles. Chain expansion now happens by reviewing
 * data/chain.json directly, then running this validator and rebuilding heat.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const pack = JSON.parse(readFileSync(join(ROOT, "data", "chain.json"), "utf8"));
const chain = pack.words;
const errors = [];

if (!Array.isArray(chain) || chain.length < 300) {
  errors.push(`chain length ${chain?.length ?? 0}, expected at least 300 reviewed puzzles`);
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(pack.epoch || "")) errors.push("missing valid epoch");
if (pack.timezone !== "America/Los_Angeles") errors.push(`unexpected timezone ${pack.timezone}`);

const seen = new Map();
chain.forEach(({ w, pivot }, i) => {
  if (!/^[a-z]+$/.test(w || "")) errors.push(`bad word at ${i}: "${w}"`);
  if (!pivot || pivot.length < 4) errors.push(`missing pivot at ${i} (${w})`);
  if (seen.has(w)) errors.push(`duplicate "${w}" at ${i} (first at ${seen.get(w)})`);
  seen.set(w, i);

  const previous = chain[(i - 1 + chain.length) % chain.length]?.w || "";
  const compact = String(pivot).toLowerCase().replace(/[^a-z]/g, "");
  if (!compact.includes(previous)) errors.push(`${i} ${w}: pivot omits yesterday "${previous}"`);
  if (!compact.includes(w)) errors.push(`${i} ${w}: pivot omits today "${w}"`);
});

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`validated data/chain.json: ${chain.length} unique, connected puzzles`);
