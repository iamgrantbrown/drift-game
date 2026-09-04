import fs from 'node:fs';
import assert from 'node:assert/strict';
import { buildCourse, distances } from '../js/links-game.js';
const course = buildCourse(JSON.parse(fs.readFileSync(new URL('../data/course.json', import.meta.url))));
const curated = JSON.parse(fs.readFileSync(new URL('../data/holes-curated.json', import.meta.url)));
// Inspect actual simple routes, not the old generator's route-count metadata.
export function routesFor(spec, limit = spec.par - 1) {
  const routes = [];
  function visit(word, path) {
    if (path.length - 1 > limit) return;
    if (course.shot(word, spec.hole)) { routes.push(path); return; }
    for (const next of course.from(word).keys()) {
      if (!path.includes(next) && next !== spec.hole) visit(next, [...path, next]);
    }
  }
  visit(spec.tee, [spec.tee]);
  return routes;
}
let total = 0, viable = 0;
for (const h of curated.holes) {
  assert.equal(distances(course, h.hole).get(h.tee), h.par - 1);
  const d = distances(course, h.hole, [h.tee]);
  const choices = [...course.from(h.tee).keys()];
  const safe = choices.filter(w => d.has(w)).length;
  assert(safe / choices.length >= .8, `${h.tee}: too many opening dead ends`);
  const routes = routesFor(h);
  assert(routes.length >= 3, `${h.tee}: fewer than three birdie routes`);
  total += choices.length; viable += safe;
  console.log(`${h.tee} → ${h.hole}: ${safe}/${choices.length} viable openings; ${routes.length} birdie routes`);
  for (const route of routes.slice(0, 3)) console.log('  ' + [...route, h.hole].join(' → '));
}
console.log(`${curated.holes.length} reviewed holes; ${viable}/${total} viable openings (${(viable / total * 100).toFixed(1)}%).`);
