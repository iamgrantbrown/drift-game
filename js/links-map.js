/** Links: the drawn hole. A top-down course generated from the hole's two
 *  words, deterministic, as inline SVG: rough, a winding fairway, trees,
 *  a river with a bridge, two bunkers by the green, the tee box and the
 *  flag. The ball's route is laid on it from the yardage: a shot that took
 *  you closer moves the ball up the fairway, rough puts it off to the side,
 *  a bunker shot lands in the sand, water lands in the river. */

const W = 390;
const H = 470;

function hashSeed(s) {
  let h = 2166136261;
  for (const ch of s) h = (h ^ ch.charCodeAt(0)) * 16777619;
  return h >>> 0;
}

function rng(seed) {
  let s = seed || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Cubic bezier point and unit normal at t. */
function bez(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const x = u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0];
  const y = u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1];
  const dx = 3 * u * u * (p1[0] - p0[0]) + 6 * u * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0]);
  const dy = 3 * u * u * (p1[1] - p0[1]) + 6 * u * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1]);
  const len = Math.hypot(dx, dy) || 1;
  return { x, y, nx: -dy / len, ny: dx / len, tx: dx / len, ty: dy / len };
}

/** The geometry of a hole: where everything sits. Same words, same hole.
 *  The par shapes it: a par 3 is short and nearly straight with one bunker
 *  and no water; a par 4 bends once and crosses the river; a par 5 is long,
 *  bends twice, crosses the river and has sand in three places. */
export function layoutHole(tee, hole, par = 4) {
  const rand = rng(hashSeed(`${tee}|${hole}`));
  const bend = rand() < 0.5 ? -1 : 1;
  const H = par <= 3 ? 380 : par >= 5 ? 540 : 470;
  let p0, p1, p2, p3;
  if (par <= 3) {
    p0 = [110 + rand() * 40, H - 48];
    p1 = [p0[0] + bend * (30 + rand() * 30), H * 0.62];
    p2 = [250 - bend * (20 + rand() * 30), H * 0.4];
    p3 = [280 - rand() * 40, 118];
  } else if (par >= 5) {
    p0 = [60 + rand() * 30, H - 46];
    p1 = [p0[0] + bend * (160 + rand() * 60), H * 0.72];
    p2 = [200 - bend * (170 + rand() * 60), H * 0.3];
    p3 = [300 - rand() * 40, 118];
  } else {
    p0 = [70 + rand() * 30, H - 45];
    p1 = [p0[0] + bend * (90 + rand() * 60), H * 0.64 + rand() * 30];
    p2 = [200 - bend * (60 + rand() * 80), H * 0.38 + rand() * 30];
    p3 = [300 - rand() * 40, 118];
  }
  const at = (t) => bez(p0, p1, p2, p3, t);
  const riverT = par <= 3 ? null : par >= 5 ? 0.4 + rand() * 0.1 : 0.5 + rand() * 0.12;
  // sand near the tee catches the shots that went the wrong way; sand by the
  // green catches the ones that overshot
  const bunkerSpots = par <= 3 ? [0.3, 0.86] : par >= 5 ? [0.22, 0.55, 0.8, 0.9] : [0.24, 0.78, 0.9];
  const bunkers = bunkerSpots.map((t, i) => {
    const p = at(t);
    const side = i % 2 === 0 ? 1 : -1;
    return { x: p.x + p.nx * side * (60 + rand() * 10), y: p.y + p.ny * side * (60 + rand() * 10), r: 20 + rand() * 6, t };
  });
  const trees = [];
  const treeCount = par <= 3 ? 18 : par >= 5 ? 34 : 26;
  for (let i = 0; i < treeCount; i++) {
    const t = rand();
    const p = at(t);
    const side = rand() < 0.5 ? -1 : 1;
    const off = 88 + rand() * 60;
    const x = p.x + p.nx * side * off + (rand() - 0.5) * 30;
    const y = p.y + p.ny * side * off + (rand() - 0.5) * 30;
    if (x < 8 || x > W - 8 || y < 8 || y > H - 8) continue;
    trees.push({ x, y, r: 11 + rand() * 9 });
  }
  const rocks = Array.from({ length: 5 }, () => {
    const t = rand();
    const p = at(t);
    const side = rand() < 0.5 ? -1 : 1;
    return { x: p.x + p.nx * side * (75 + rand() * 40), y: p.y + p.ny * side * (75 + rand() * 40), r: 4 + rand() * 4 };
  });
  return { H, par, p0, p1, p2, p3, at, riverT, bunkers, trees, rocks, bend };
}

function svgPathFor(p0, p1, p2, p3) {
  return `M ${p0[0]} ${p0[1]} C ${p1[0]} ${p1[1]}, ${p2[0]} ${p2[1]}, ${p3[0]} ${p3[1]}`;
}

/** Where the ball sits for a given stop: its lie and how far along it is. */
export function placeStop(geo, lie, progress, sideIndex = 0) {
  const t = Math.max(0.03, Math.min(0.93, progress));
  const p = geo.at(t);
  if (lie === "tee") {
    const s = geo.at(0.03);
    return { x: s.x, y: s.y };
  }
  if (lie === "water") {
    // no river on a par 3: the water is a pond off the green
    if (geo.riverT === null) {
      const g = geo.at(0.9);
      return { x: g.x + g.nx * 78, y: g.y + g.ny * 78 };
    }
    const r = geo.at(geo.riverT);
    return { x: r.x + r.nx * 18, y: r.y + r.ny * 18 };
  }
  if (lie === "bunker") {
    // the bunker nearest to how far along you actually are
    const b = geo.bunkers.reduce((best, cand) => (Math.abs(cand.t - t) < Math.abs(best.t - t) ? cand : best), geo.bunkers[0]);
    return { x: b.x, y: b.y };
  }
  if (lie === "rough") {
    const side = sideIndex % 2 === 0 ? 1 : -1;
    // just off the fairway, and never off the edge of the map
    return {
      x: Math.max(24, Math.min(W - 24, p.x + p.nx * side * 62)),
      y: Math.max(24, Math.min(geo.H - 24, p.y + p.ny * side * 62)),
    };
  }
  if (lie === "green") {
    const g = geo.at(0.955);
    return { x: g.x - 26, y: g.y + 14 };
  }
  if (lie === "holed") {
    const g = geo.at(1);
    return { x: g.x, y: g.y };
  }
  return { x: p.x, y: p.y };
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** Render the whole hole. `stops` are [{word, lie, progress, current}]. */
export function renderMap(geo, stops, { holed = false, tee, hole } = {}) {
  const { H, p0, p1, p2, p3, at, riverT, bunkers, trees, rocks } = geo;
  const center = svgPathFor(p0, p1, p2, p3);
  let water = "";
  if (riverT !== null) {
    // the river runs across the fairway, roughly perpendicular to it, and wanders
    const river = at(riverT);
    const rx = (k) => river.x + river.nx * k;
    const ry = (k) => river.y + river.ny * k;
    const riverPath = `M ${rx(-300)} ${ry(-300)} C ${rx(-140) + river.tx * 40} ${ry(-140) + river.ty * 40}, ${rx(-60) - river.tx * 30} ${ry(-60) - river.ty * 30}, ${rx(0)} ${ry(0)} S ${rx(120) + river.tx * 40} ${ry(120) + river.ty * 40}, ${rx(300)} ${ry(300)}`;
    // ripples instead of a centre line: small arcs scattered along the water
    const ripples = [-230, -175, -120, -60, 40, 95, 150, 205, 255]
      .map((k, i) => {
        const wob = ((i * 37) % 11) - 5;
        const x = rx(k) + river.tx * wob * 1.2;
        const y = ry(k) + river.ty * wob * 1.2;
        return `<path d="M ${x - 6} ${y} q 6 -4 12 0" class="ripple"/>`;
      })
      .join("");
    water = `<path d="${riverPath}" class="river-bank" />
  <path d="${riverPath}" class="river" />
  <path d="${riverPath}" class="river-deep" />
  ${ripples}
  <g transform="translate(${river.x} ${river.y}) rotate(${(Math.atan2(river.ty, river.tx) * 180) / Math.PI})">
    <rect x="-26" y="-16" width="52" height="32" rx="3" class="bridge"/>
    ${[-18, -9, 0, 9, 18].map((x) => `<rect x="${x - 1.5}" y="-16" width="3" height="32" class="bridge-plank"/>`).join("")}
  </g>`;
  } else {
    // a par 3 has a pond beside the green instead
    const g = at(0.9);
    const px = g.x + g.nx * 78;
    const py = g.y + g.ny * 78;
    water = `<ellipse cx="${px}" cy="${py}" rx="42" ry="30" class="river-bank" style="stroke-width:8"/>
  <ellipse cx="${px}" cy="${py}" rx="38" ry="26" class="pond"/>
  <path d="M ${px - 20} ${py - 6} q 6 -4 12 0" class="ripple"/>
  <path d="M ${px + 4} ${py + 8} q 6 -4 12 0" class="ripple"/>
  <path d="M ${px - 6} ${py + 1} q 6 -4 12 0" class="ripple"/>`;
  }
  const green = at(0.96);
  const flag = at(1);
  const teeBox = at(0.03);

  // the route: a dotted line through every stop, then the ball
  let points = "";
  let stopMarks = "";
  stops.forEach((s, i) => {
    const prev = i > 0 ? stops[i - 1] : null;
    if (prev) points += `<line x1="${prev.x}" y1="${prev.y}" x2="${s.x}" y2="${s.y}" class="route" />`;
    if (s.current) {
      stopMarks += `<g class="ball-now${s.justMoved ? " moved" : ""}" style="--fx:${prev ? prev.x - s.x : 0}px; --fy:${prev ? prev.y - s.y : 0}px"><ellipse cx="${s.x + 2}" cy="${s.y + 4}" rx="8" ry="4" class="ball-shadow"/><circle cx="${s.x}" cy="${s.y}" r="7" class="ball-dot"/></g>`;
    } else if (s.lie !== "tee") {
      stopMarks += `<circle cx="${s.x}" cy="${s.y}" r="3.5" class="stop-dot"/>`;
    }
    if (s.word && s.lie !== "tee") {
      // labels alternate above and below their ball so a crowded corner stays readable
      const above = s.current ? s.y > 40 : i % 2 === 0 && s.y > 40;
      stopMarks += `<text x="${s.x}" y="${above ? s.y - 13 : s.y + 22}" class="stop-label${s.current ? " now" : ""}">${esc(s.word)}</text>`;
    }
  });

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="The hole, ${esc(tee)} to ${esc(hole)}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="mow" width="34" height="34" patternUnits="userSpaceOnUse" patternTransform="rotate(-28)">
      <rect width="17" height="34" fill="rgba(255,255,255,0.07)"/>
    </pattern>
    <filter id="soft"><feGaussianBlur stdDeviation="1.2"/></filter>
  </defs>
  <rect width="${W}" height="${H}" class="rough-deep"/>
  <path d="${center}" class="rough" />
  <path d="${center}" class="fairway" />
  <path d="${center}" class="fairway-mow" />
  <rect x="${teeBox.x - 22}" y="${teeBox.y - 14}" width="44" height="28" rx="6" class="tee-box" transform="rotate(${(Math.atan2(teeBox.ty, teeBox.tx) * 180) / Math.PI} ${teeBox.x} ${teeBox.y})"/>
  <circle cx="${green.x}" cy="${green.y}" r="46" class="green" />
  <circle cx="${green.x}" cy="${green.y}" r="46" class="green-mow" />
  ${bunkers.map((b) => `<ellipse cx="${b.x}" cy="${b.y}" rx="${b.r + 8}" ry="${b.r}" class="bunker" transform="rotate(${(b.t * 60) | 0} ${b.x} ${b.y})"/>`).join("")}
  ${water}
  ${rocks.map((r) => `<ellipse cx="${r.x}" cy="${r.y}" rx="${r.r + 2}" ry="${r.r}" class="rock"/>`).join("")}
  ${trees.map((t) => `<g class="tree"><circle cx="${t.x + 2}" cy="${t.y + 3}" r="${t.r}" class="tree-shade"/><circle cx="${t.x}" cy="${t.y}" r="${t.r}" class="tree-top"/><circle cx="${t.x - t.r * 0.3}" cy="${t.y - t.r * 0.3}" r="${t.r * 0.45}" class="tree-light"/></g>`).join("")}
  <g class="route-layer">${points}</g>
  <g class="tee-marker-group"><circle cx="${teeBox.x}" cy="${teeBox.y}" r="5" class="tee-peg"/></g>
  <text x="${teeBox.x}" y="${teeBox.y + 32}" class="stop-label end-label">${esc(tee)}</text>
  <text x="${flag.x}" y="${flag.y + 24}" class="stop-label end-label">${esc(hole)}</text>
  <g class="flag-group${holed ? " sunk" : ""}">
    <ellipse cx="${flag.x}" cy="${flag.y + 2}" rx="7" ry="3.5" class="cup"/>
    <line x1="${flag.x}" y1="${flag.y}" x2="${flag.x}" y2="${flag.y - 34}" class="pole"/>
    <path d="M ${flag.x} ${flag.y - 34} l 20 6 l -20 7 z" class="cloth"/>
    ${holed ? `<circle cx="${flag.x}" cy="${flag.y}" r="5" class="ball-dot in-cup"/>` : ""}
  </g>
  ${stopMarks}
</svg>`;
}
