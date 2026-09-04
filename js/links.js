/* Links: word golf. Rules in links-game.js, the drawn hole in
 * links-map.js; this file wires them to the page and speaks for the caddie. */
import {
  CADDIE_STAGES,
  askCaddie,
  bestShot,
  buildCourse,
  caddieLine,
  distances,
  drop,
  holeFromSpec,
  holeShots,
  lieOf,
  play,
  scoreName,
  shareCard,
  yardage,
} from "./links-game.js";
import { layoutHole, placeStop, renderMap } from "./links-map.js";
import {
  daysBetween,
  millisecondsUntilNextPacificMidnight,
  pacificDateString,
  puzzleNumber,
} from "./calendar.js";

const STORAGE_KEY = "links-v1";
const HOWTO_KEY = "links-howto-v1";
const SHARE_URL = "https://iamgrantbrown.github.io/drift-game/";

const $ = (id) => document.getElementById(id);
const up = (w) => w.toUpperCase();
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);
}

function loadStore(date) {
  try {
    return JSON.parse(localStorage.getItem(`${STORAGE_KEY}:${date}`)) || {};
  } catch {
    return {};
  }
}
function saveStore(date, store) {
  try {
    localStorage.setItem(`${STORAGE_KEY}:${date}`, JSON.stringify(store));
  } catch {
    /* private mode: play without persistence */
  }
}

function setStatus(msg, kind = "") {
  const el = $("status");
  el.textContent = msg || "";
  el.className = "status " + kind;
}

/* ---------- the caddie ---------- */

function shotLine(r, state) {
  const phrase = cap(r.phrase);
  const lie = lieOf({ before: r.before, after: r.after }, r.holed);
  if (lie === "holed") return `${phrase}. That’s in. ${cap(scoreName(state.strokes, state.par))}.`;
  if (lie === "water") return `${phrase}. In the water. Take a drop.`;
  if (lie === "bunker") return `${phrase}. Into the bunker, ${yardage(r.after)}.`;
  if (lie === "rough") return `${phrase}. Rough. Still ${yardage(r.after)}.`;
  if (lie === "green") return `${phrase}. On the green, 1 out.`;
  return `${phrase}. Fairway, ${yardage(r.after)}.`;
}

function endLine(state) {
  const diff = state.strokes - state.par;
  if (diff <= -1) return "A route the setter didn’t take.";
  if (diff === 0) return "Right on the setter’s route, or one as good.";
  if (diff <= 2) return "In, with a detour.";
  return "In. The long way round.";
}

/* ---------- the hole on the map ---------- */

/** Turn the ball's path into stops on the drawn hole. */
function stopsFor(state, dist, geo, justPlayed) {
  const D0 = Math.max(1, dist.get(state.tee) ?? state.par);
  const stops = [];
  let sideIndex = 0;
  state.path.forEach((word, i) => {
    if (i === 0) {
      const p = placeStop(geo, "tee", 0);
      stops.push({ word, lie: "tee", ...p, current: state.path.length === 1 && !state.holed });
      return;
    }
    const entry = [...state.log].reverse().find((e) => !e.drop && e.word === word);
    const isLast = i === state.path.length - 1;
    const lie = entry ? lieOf(entry, isLast && state.holed) : "fairway";
    const after = entry?.after;
    const progress = after === undefined ? 0 : (D0 - after) / D0;
    if (lie === "rough" || lie === "bunker") sideIndex++;
    const p = placeStop(geo, lie, progress, sideIndex);
    // two stops with the same yardage would land on the same spot; nudge the
    // newer one sideways so every ball position stays visible
    let nudge = 0;
    while (stops.some((s) => Math.hypot(s.x - p.x, s.y - p.y) < 22) && nudge < 6) {
      nudge++;
      const side = nudge % 2 ? 1 : -1;
      const k = Math.ceil(nudge / 2) * 26;
      const q = geo.at(Math.max(0.03, Math.min(0.93, progress)));
      p.x = Math.max(24, Math.min(390 - 24, p.x + q.nx * side * k));
      p.y = Math.max(24, Math.min(geo.H - 24, p.y + q.ny * side * k));
    }
    stops.push({ word, lie, ...p, current: isLast && !state.holed, justMoved: isLast && justPlayed });
  });
  return stops;
}

function renderHole(state, dist, geo, puzNum, justPlayed = false) {
  const stops = stopsFor(state, dist, geo, justPlayed);
  $("map").innerHTML = renderMap(geo, stops, { holed: state.holed, tee: state.tee, hole: state.hole });
  $("chip-hole").innerHTML = `<span><b>Hole</b>${puzNum}</span><span><b>Par</b>${state.par}</span>`;
  const here = state.path[state.path.length - 1];
  const d = dist.get(here);
  const out = state.holed ? "in" : d === undefined ? "water" : `${d} out`;
  $("chip-score").innerHTML = `<span><b>Strokes</b>${state.strokes}</span><span><b>${state.holed ? "Score" : "Lie"}</b>${state.holed ? escapeHtml(scoreName(state.strokes, state.par)) : escapeHtml(out)}</span>`;
}

/* ---------- the shot row and the trail ---------- */

/** Reading the green: the words that finish the hole, visible from the tee. */
function renderGreen(state, course) {
  const el = $("green-read");
  const finishers = holeShots(course, state.hole).filter((f) => !state.path.includes(f.word));
  if (state.holed || finishers.length === 0) {
    el.innerHTML = "";
    return;
  }
  // each chip is the finishing phrase with the word you'd play in bold: play
  // "moon" from anywhere it fits and moonwalk sinks it
  const chip = (f) => {
    const i = f.phrase.indexOf(f.word);
    const head = f.phrase.slice(0, i);
    const tail = f.phrase.slice(i + f.word.length);
    return `<span class="finisher">${escapeHtml(head)}<b>${escapeHtml(f.word)}</b>${escapeHtml(tail)}</span>`;
  };
  el.innerHTML = `<span class="green-label">any of these sinks it</span>${finishers.map(chip).join("")}`;
}

function renderShot(state, dist, course, justPlayed = false) {
  const root = $("fairway");
  const draft = root.querySelector("input")?.value || "";
  if (state.holed) {
    root.innerHTML = "";
    return;
  }
  const here = state.path[state.path.length - 1];
  const d = dist.get(here);
  const lastEntry = [...state.log].reverse().find((e) => !e.drop);
  const hereLie = state.path.length === 1 ? "tee" : lastEntry && lastEntry.word === here ? lieOf(lastEntry) : "fairway";
  const open = [...course.from(here).keys()].filter((w) => !state.path.includes(w)).length;
  root.innerHTML = `
    <form class="shot at-${hereLie}" autocomplete="off">
      <span class="from">from <b>${escapeHtml(here)}</b><small>${open} ${open === 1 ? "shot" : "shots"}</small></span>
      <input id="shot" type="text" enterkeyhint="go" autocapitalize="none" autocomplete="off" spellcheck="false" maxlength="14" placeholder="your next word" aria-label="Your next word, played from ${escapeHtml(here)}" value="${escapeHtml(draft)}" />
      <button type="submit" class="swing">Play</button>
    </form>
    <div class="trail">${state.log
      .map((e, i) => {
        if (e.drop) return `<span class="trail-item lie-drop">drop</span>`;
        const lie = lieOf(e, i === state.log.length - 1 && state.holed);
        return `<span class="trail-item lie-${lie}"><i></i>${escapeHtml(e.phrase)}</span>`;
      })
      .join("")}</div>`;
  if (d === undefined) root.querySelector(".shot").classList.add("no-route");
}

/** The caddie speaks after two tries from a spot, and stays on the page. */
function renderCaddie(state, course, dist, attemptsHere) {
  const el = $("caddie");
  const here = state.path[state.path.length - 1];
  const stage = state.caddie && state.caddie.at === here ? state.caddie.stage : 0;
  if (state.holed || stage === 0) {
    el.hidden = true;
    el.textContent = "";
    return;
  }
  el.hidden = false;
  el.textContent = `Caddie: ${caddieLine(stage, bestShot(state, course, dist), here)}`;
}

function renderActions(state, attemptsHere) {
  const box = $("actions");
  box.innerHTML = "";
  if (state.holed) return;
  const here = state.path[state.path.length - 1];
  const stage = state.caddie && state.caddie.at === here ? state.caddie.stage : 0;
  const parts = [];
  if ((attemptsHere >= 2 || stage > 0) && stage < CADDIE_STAGES) {
    const label = stage === 0 ? "Ask the caddie" : stage === 1 ? "Ask for the first letter" : "Ask for the shot";
    parts.push(`<button type="button" class="caddie-btn" id="caddie-btn">${label}</button>`);
  }
  if (state.path.length >= 2) {
    parts.push(`<button type="button" class="link-btn" id="drop-btn">take a drop, back to ${escapeHtml(up(state.path[state.path.length - 2]))} for one stroke</button>`);
  }
  box.innerHTML = parts.join("");
}

function renderEnd(state, puzNum) {
  const panel = $("end");
  panel.hidden = false;
  $("card-hole").textContent = `Hole ${puzNum}`;
  const hints = state.hints ? ` · ${state.hints} ${state.hints === 1 ? "hint" : "hints"}` : "";
  $("card-par").textContent = `Par ${state.par} · ${state.strokes} ${state.strokes === 1 ? "stroke" : "strokes"}${hints}`;
  $("end-title").textContent = scoreName(state.strokes, state.par);
  $("end-body").textContent = endLine(state);
  const route = $("route");
  route.innerHTML = "";
  let n = 0;
  for (const e of state.log) {
    n++;
    const li = document.createElement("li");
    if (e.drop) {
      li.className = "drop-row";
      li.innerHTML = `<span>${n}. drop</span><i>back to ${escapeHtml(e.word)}</i>`;
    } else {
      li.innerHTML = `<span>${n}. <b>${escapeHtml(e.word)}</b></span><i>${escapeHtml(e.phrase)}</i>`;
    }
    route.appendChild(li);
  }
  const fin = document.createElement("li");
  fin.innerHTML = `<span>⛳ <b>${escapeHtml(state.hole)}</b></span><i>${escapeHtml(state.finalPhrase || "")}</i>`;
  route.appendChild(fin);
  $("share-text").textContent = shareCard({ puzzleNumber: puzNum, state, url: SHARE_URL });
  startCountdown();
  panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

let countdownTimer = null;
function startCountdown() {
  const el = $("countdown");
  if (countdownTimer) clearInterval(countdownTimer);
  const tick = () => {
    const left = Math.max(0, Math.ceil(millisecondsUntilNextPacificMidnight(new Date()) / 1000));
    const h = String(Math.floor(left / 3600)).padStart(2, "0");
    const m = String(Math.floor((left % 3600) / 60)).padStart(2, "0");
    const s = String(left % 60).padStart(2, "0");
    el.textContent = `next tee in ${h}:${m}:${s}`;
  };
  tick();
  countdownTimer = setInterval(tick, 1000);
}

function wireDialog(dialogId, openBtnId, closeBtnId) {
  const d = $(dialogId);
  const open = () => (typeof d.showModal === "function" ? d.showModal() : d.setAttribute("open", ""));
  const close = () => (typeof d.close === "function" && d.open ? d.close() : d.removeAttribute("open"));
  if (openBtnId) $(openBtnId).addEventListener("click", open);
  if (closeBtnId) $(closeBtnId).addEventListener("click", close);
  d.addEventListener("click", (ev) => {
    if (ev.target === d) close();
  });
  return { open, close };
}

function focusShot() {
  const input = $("shot");
  if (input) input.focus({ preventScroll: true });
}

/** Under par: a few white scraps from the flag. Earned, brief, once. */
function cheer() {
  const flag = document.querySelector(".flag-group");
  if (!flag) return;
  const rect = flag.getBoundingClientRect();
  for (let i = 0; i < 12; i++) {
    const s = document.createElement("span");
    s.className = "scrap";
    const angle = Math.PI * (1 + i / 12) + (Math.random() - 0.5) * 0.4;
    s.style.left = `${rect.left + rect.width / 2}px`;
    s.style.top = `${rect.top + 6}px`;
    s.style.setProperty("--dx", `${Math.cos(angle) * (30 + Math.random() * 70)}px`);
    s.style.setProperty("--dy", `${Math.sin(angle) * (40 + Math.random() * 50) - 30}px`);
    s.style.setProperty("--rot", `${(Math.random() * 400 - 200).toFixed(0)}deg`);
    s.addEventListener("animationend", () => s.remove());
    document.body.appendChild(s);
  }
}

/* ---------- main ---------- */

async function main() {
  const howto = wireDialog("howto", "howto-btn", "howto-close");
  const markHowto = () => {
    try {
      localStorage.setItem(HOWTO_KEY, "1");
    } catch {
      /* ignore */
    }
  };
  $("howto-play").addEventListener("click", () => {
    markHowto();
    howto.close();
    focusShot();
  });
  $("howto").addEventListener("close", markHowto);

  // course.json: every shot the course knows. holes.json: the course layout.
  const [shots, layout] = await Promise.all([
    fetch("data/course.json").then((r) => r.json()),
    fetch("data/holes.json").then((r) => r.json()),
  ]);
  const course = buildCourse(shots);

  const dateParam = new URLSearchParams(location.search).get("date");
  const todayDate = /^\d{4}-\d{2}-\d{2}$/.test(dateParam || "") ? dateParam : pacificDateString(new Date());
  const k = daysBetween(layout.epoch, todayDate);
  const puzNum = puzzleNumber(todayDate, layout.epoch);
  const n = layout.holes.length;

  let state = holeFromSpec(layout.holes[((k % n) + n) % n], k);
  const dist = distances(course, state.hole);
  const geo = layoutHole(state.tee, state.hole, state.par);
  const holeKey = `${state.tee}|${state.hole}`;
  let store = loadStore(todayDate);
  const persist = () => {
    store = {
      date: todayDate,
      hole: holeKey,
      path: state.path,
      strokes: state.strokes,
      holed: state.holed,
      log: state.log,
      finalPhrase: state.finalPhrase,
      hints: state.hints || 0,
      caddie: state.caddie || null,
    };
    saveStore(todayDate, store);
  };
  if (store.hole === holeKey && Array.isArray(store.path) && store.path[0] === state.tee) {
    state = {
      ...state,
      path: store.path,
      strokes: Number(store.strokes) || 0,
      holed: !!store.holed,
      log: Array.isArray(store.log) ? store.log : [],
      finalPhrase: store.finalPhrase || null,
      hints: Number(store.hints) || 0,
      caddie: store.caddie || null,
    };
  } else {
    persist();
  }
  // tries from the current spot, real or refused; the caddie waits for two
  let attemptsHere = 0;

  $("hole-num").textContent = `Hole ${puzNum}`;
  $("rule").innerHTML = `Get from <b>${escapeHtml(up(state.tee))}</b> to <b>${escapeHtml(up(state.hole))}</b>. Every word you play must make a phrase with the one before it. Par ${state.par}.`;
  const render = (justPlayed = false) => {
    renderHole(state, dist, geo, puzNum, justPlayed);
    renderGreen(state, course);
    renderShot(state, dist, course, justPlayed);
    renderCaddie(state, course, dist, attemptsHere);
    renderActions(state, attemptsHere);
  };
  render();
  if (state.holed) renderEnd(state, puzNum);

  $("fairway").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const input = $("shot");
    if (!input) return;
    const r = play(state, input.value, course, dist);
    if (!r.ok) {
      const typed = up(input.value.trim());
      if (r.reason === "unknown") setStatus("Not a shot this course knows.", "no");
      else if (r.reason === "revisit") setStatus(`You’ve already played through ${typed}.`, "no");
      else if (r.reason === "invalid") setStatus("Letters only.", "no");
      if (r.reason !== "invalid") {
        attemptsHere++;
        // two tries in, the caddie offers the letter count unasked; it's free
        const here = state.path[state.path.length - 1];
        const stage = state.caddie && state.caddie.at === here ? state.caddie.stage : 0;
        if (attemptsHere === 2 && stage === 0) {
          const h = askCaddie(state);
          if (h.ok) {
            state = h.state;
            persist();
            renderCaddie(state, course, dist, attemptsHere);
          }
        }
        renderActions(state, attemptsHere);
      }
      input.classList.remove("refuse");
      void input.offsetWidth;
      input.classList.add("refuse");
      input.select();
      return;
    }
    state = r.state;
    attemptsHere = 0;
    persist();
    input.value = "";
    render(true);
    const lie = lieOf({ before: r.before, after: r.after }, r.holed);
    setStatus(shotLine(r, state), lie === "holed" || lie === "fairway" || lie === "green" ? "yes" : lie === "water" || lie === "bunker" ? "no" : "");
    if (r.holed && state.strokes < state.par && !reducedMotion()) cheer();
    if (state.holed) {
      renderEnd(state, puzNum);
      return;
    }
    focusShot();
  });

  $("actions").addEventListener("click", (ev) => {
    if (ev.target.closest("#caddie-btn")) {
      const r = askCaddie(state);
      if (!r.ok) return;
      state = r.state;
      persist();
      renderCaddie(state, course, dist, attemptsHere);
      renderActions(state, attemptsHere);
      focusShot();
      return;
    }
    const btn = ev.target.closest("#drop-btn");
    if (!btn) return;
    const r = drop(state);
    if (!r.ok) return;
    state = r.state;
    attemptsHere = 0;
    persist();
    render();
    const here = state.path[state.path.length - 1];
    setStatus(`Drop. Back on ${up(here)}, one stroke added. ${cap(yardage(dist.get(here)))}.`, "");
    focusShot();
  });

  $("share-btn").addEventListener("click", async () => {
    const text = $("share-text").textContent;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        setStatus("Scorecard copied. Your route stays yours.", "yes");
      }
    } catch {
      try {
        await navigator.clipboard.writeText(text);
        setStatus("Scorecard copied.", "yes");
      } catch {
        setStatus("Copy the card by hand.");
      }
    }
  });

  let seen = false;
  try {
    seen = localStorage.getItem(HOWTO_KEY) === "1";
  } catch {
    /* ignore */
  }
  if (!seen) howto.open();
  else if (!state.holed) focusShot();
}

main().catch((err) => {
  console.error(err);
  setStatus("Couldn’t load today’s hole.", "no");
});
