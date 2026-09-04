import { renderShareImage } from "./links-scorecard.js?v=20260904h";
import { clubBird, playFinishSound } from "./links-delight.js?v=20260904h";
/* Links: word golf. Rules in links-game.js, the drawn hole in
 * links-map.js; this file wires them to the page and speaks for the caddie. */
import {
  CADDIE_STAGES,
  askCaddie,
  bestShot,
  buildCourse,
  caddieLine,
  drop,
  undo,
  selectHole,
  distances,
  holeFromSpec,
  holeShots,
  lieOf,
  play,
  routeDistances,
  scoreName,
  shareCard,
  yardage,
} from "./links-game.js?v=20260904h";
import { layoutHole, placeStop, renderMap } from "./links-map.js?v=20260904h";
import {
  daysBetween,
  millisecondsUntilNextPacificMidnight,
  pacificDateString,
  puzzleNumber,
} from "./calendar.js?v=20260904h";

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
  if (diff <= -1) return "A little less golf. A little more glory.";
  if (diff === 0) return "Right on par. Nicely played.";
  if (diff <= 2) return "In, with a detour.";
  return "In. The long way round.";
}

/* ---------- the hole on the map ---------- */

/** Turn the ball's path into stops on the drawn hole. */
function stopsFor(state, dist, geo, justPlayed) {
  const D0 = Math.max(1, geo.teeDistance ?? state.par);
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
    const lie = entry ? lieOf(isLast && !state.holed ? { ...entry, after: dist.get(word) } : entry, isLast && state.holed) : "fairway";
    const after = entry?.after;
    const progress = after === undefined ? 0 : (D0 - after) / D0;
    if (lie === "rough" || lie === "bunker") sideIndex++;
    const p = placeStop(geo, lie, progress, sideIndex);
    // two stops with the same yardage would land on the same spot; nudge the
    // newer one sideways so every ball position stays visible
    let nudge = 0;
    while (lie !== "holed" && stops.some((s) => Math.hypot(s.x - p.x, s.y - p.y) < 22) && nudge < 6) {
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

function renderHole(state, dist, geo, puzNum, justPlayed = false, animateWin = false) {
  const stops = stopsFor(state, dist, geo, justPlayed);
  $("map").innerHTML = renderMap(geo, stops, { holed: state.holed, tee: state.tee, hole: state.hole, animateWin });
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
  $("green-guide").hidden = state.holed || finishers.length === 0;
  $("green-preview").hidden = state.holed || finishers.length === 0;
  $("finisher-count").textContent = `${finishers.length} finishing phrases`;
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
  el.innerHTML = finishers.map(chip).join("");
  const here = state.path.at(-1);
  const reachable = finishers.map(f => ({ ...f, distance: f.word === here ? 0 : distances(course, f.word, state.path.slice(0, -1)).get(here) }))
    .filter(f => f.distance !== undefined)
    .sort((a, b) => a.distance - b.distance || a.word.length - b.word.length || a.word.localeCompare(b.word)).slice(0, 3);
  $("green-preview").innerHTML = `<h2>Plan your finish</h2><p>Reach one of these words through a phrase to sink it.</p><div class="green-read">${reachable.map(chip).join("")}</div>${reachable[0] ? `<p class="finish-example">Reach <b>${escapeHtml(up(reachable[0].word))}</b> and “${escapeHtml(reachable[0].phrase)}” sinks it automatically.</p>` : ""}`;
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
  if (d === undefined) {
    root.innerHTML = `<div class="recovery"><strong>No route from ${escapeHtml(up(here))}.</strong><span>Undo or take a drop to get back in play.</span></div>`;
    return;
  }
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

/** Hints stay on the page and are only revealed when requested. */
function renderCaddie(state, course, dist) {
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

function renderActions(state, dist) {
  const box = $("actions");
  box.innerHTML = "";
  if (state.holed) return;
  const here = state.path[state.path.length - 1];
  const stage = state.caddie && state.caddie.at === here ? state.caddie.stage : 0;
  const parts = [];
  const stuck = !dist.has(here);
  if (!stuck && stage < CADDIE_STAGES) {
    const label = stage === 0 ? "Caddie · free clue" : stage === 1 ? "First letter · +1 hint" : "Phrase clue · +1 hint";
    parts.push(`<button type="button" class="caddie-btn" id="caddie-btn">${label}</button>`);
  }
  if (state.path.length >= 2 && !state.undoUsed && !state.log.at(-1)?.drop) {
    parts.push(`<button type="button" class="caddie-btn" id="undo-btn">Undo last shot · free</button>`);
  }
  if (state.path.length >= 2) {
    parts.push(`<button type="button" class="${stuck ? "caddie-btn" : "link-btn"}" id="drop-btn">Drop to ${escapeHtml(up(state.path[state.path.length - 2]))} · +1 stroke</button>`);
  }
  box.innerHTML = parts.join("");
}

function renderEnd(state, puzNum, { arrival = false } = {}) {
  const panel = $("end");
  panel.hidden = false;
  $("card-hole").textContent = `Hole ${puzNum}`;
  const hints = state.hints ? ` · ${state.hints} ${state.hints === 1 ? "hint" : "hints"}` : "";
  $("card-par").textContent = `Par ${state.par} · ${state.strokes} ${state.strokes === 1 ? "stroke" : "strokes"}${hints}`;
  $("end-title").textContent = scoreName(state.strokes, state.par);
  $("end-body").textContent = endLine(state);
  $("card-bird").innerHTML = state.strokes < state.par ? clubBird() : "";
  $("card-bird").hidden = state.strokes >= state.par;
  renderScorebook();
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
  prepareShareImage(state, puzNum);
  startCountdown();
  panel.classList.toggle("arriving", arrival && !reducedMotion());
  if (arrival) {
    $("end-title").focus({ preventScroll: true });
    panel.scrollIntoView({ behavior: reducedMotion() ? "instant" : "smooth", block: "nearest" });
  }
}

let shareImageFile = null;
let imageGeneration = 0;
function prepareShareImage(state, number) {
  const generation = ++imageGeneration;
  shareImageFile = null;
  $("share-btn").disabled = true;
  $("download-card").disabled = true;
  renderShareImage($("share-image"), { state, puzzleNumber: number, date: state.date }).then(blob => {
    if (generation !== imageGeneration || !blob) return;
    shareImageFile = new File([blob], `links-${number}-${state.date}.png`, { type:'image/png' });
    $("share-btn").textContent = navigator.canShare?.({ files:[shareImageFile] }) ? 'Share scorecard' : 'Download scorecard';
    $("share-btn").disabled = false;
    $("download-card").disabled = false;
  }).catch(() => setStatus('The image could not be prepared. Copy text is still available.'));
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

let celebrating = false;
let finishTimer;
let finishCallback;
let stopFinishSound;
let soundEnabled = false;
function closeFinish() {
  clearTimeout(finishTimer);
  stopFinishSound?.();
  stopFinishSound = null;
  $("finish-stage").classList.remove("playing");
  if ($("finish-stage").open) $("finish-stage").close();
  celebrating = false;
  $("replay-btn").disabled = false;
  const callback = finishCallback;
  finishCallback = null;
  callback?.();
}

function renderScorebook() {
  const rounds = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!/^links-v1:\d{4}-\d{2}-\d{2}$/.test(key || "")) continue;
      try {
        const r = JSON.parse(localStorage.getItem(key));
        if (!r?.holed || !Number.isFinite(r.strokes) || !Number.isFinite(r.par) || typeof r.hole !== 'string') continue;
        rounds.push({ ...r, date: key.slice(9) });
      } catch { /* Ignore a damaged entry, keep the rest of the book. */ }
    }
  } catch { /* Private browsing can still play. */ }
  rounds.sort((a, b) => b.date.localeCompare(a.date));
  const birdies = rounds.filter(r => r.strokes < r.par).length;
  $("scorebook-content").innerHTML = rounds.length ? `<p class="book-total"><b>${rounds.length}</b> rounds finished · <b>${birdies}</b> under par</p><ol class="book-rounds">${rounds.map(r => `<li><a href="?date=${encodeURIComponent(r.date)}"><span>${escapeHtml(r.date)}<small>${escapeHtml(r.hole.replace('|', ' → '))}</small></span><strong>${escapeHtml(scoreName(r.strokes, r.par))}<small>${r.strokes} strokes · par ${r.par}</small></strong></a></li>`).join("")}</ol>` : '<p class="book-empty">Your first page is waiting. Finish a hole and we’ll keep it here.</p>';
}

/** A stable stage: putt, cup, bird landing, then a keepsake card. */
function celebrateWin(state, dist, geo, puzNum) {
  if (celebrating) return;
  if (reducedMotion()) {
    renderHole(state, dist, geo, puzNum);
    renderEnd(state, puzNum, { arrival: true });
    return;
  }
  celebrating = true;
  $("replay-btn").disabled = true;
  const stage = $("finish-stage");
  const under = state.strokes < state.par;
  $("finish-bird").innerHTML = clubBird();
  $("finish-bird").hidden = !under;
  $("finish-title").textContent = cap(scoreName(state.strokes, state.par));
  $("finish-subtitle").textContent = state.par - state.strokes === 1 ? "One under par. Beautifully linked." : `${state.strokes} strokes · par ${state.par}`;
  $("finish-phrase").textContent = state.finalPhrase;
  stage.classList.toggle("under-par", under);
  stage.showModal();
  void stage.offsetWidth;
  stage.classList.add("playing");
  stopFinishSound = playFinishSound(soundEnabled, under);
  finishCallback = () => renderEnd(state, puzNum, { arrival: true });
  finishTimer = window.setTimeout(closeFinish, 4600);
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

  try { soundEnabled = localStorage.getItem("links-sound") === "on"; } catch {}
  const renderSound = () => {
    $("sound-btn").textContent = soundEnabled ? "Sound on" : "Sound off";
    $("sound-btn").setAttribute("aria-pressed", String(soundEnabled));
  };
  renderSound();
  $("sound-btn").addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    try { localStorage.setItem("links-sound", soundEnabled ? "on" : "off"); } catch {}
    renderSound();
  });
  wireDialog("scorebook", "scorebook-btn", "scorebook-close");
  $("scorebook-btn").addEventListener("click", renderScorebook);
  $("finish-close").addEventListener("click", closeFinish);
  $("finish-continue").addEventListener("click", closeFinish);
  $("finish-stage").addEventListener("cancel", ev => { ev.preventDefault(); closeFinish(); });

  // course.json: every shot the course knows. holes.json: the course layout.
  const [shots, layout, curated] = await Promise.all([
    fetch("data/course.json").then((r) => r.json()),
    fetch("data/holes.json").then((r) => r.json()),
    fetch("data/holes-curated.json").then((r) => r.json()),
  ]);
  const course = buildCourse(shots);

  const dateParam = new URLSearchParams(location.search).get("date");
  const todayDate = /^\d{4}-\d{2}-\d{2}$/.test(dateParam || "") ? dateParam : pacificDateString(new Date());
  const k = daysBetween(layout.epoch, todayDate);
  const puzNum = puzzleNumber(todayDate, layout.epoch);
  let store = loadStore(todayDate);
  let state = { ...holeFromSpec(selectHole(layout, curated, todayDate, store), k), date: todayDate };
  // Backfill old finished rounds with their original par for the scorebook.
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!/^links-v1:\d{4}-\d{2}-\d{2}$/.test(key || "")) continue;
      try {
        const old = JSON.parse(localStorage.getItem(key));
        const spec = layout.holes.find(h => `${h.tee}|${h.hole}` === old?.hole);
        if (old?.holed && spec && !old.par) localStorage.setItem(key, JSON.stringify({ ...old, par: spec.par }));
      } catch {}
    }
  } catch {}
  let dist = routeDistances(state, course);
  const geo = layoutHole(state.tee, state.hole, state.par);
  geo.teeDistance = dist.get(state.tee);
  const holeKey = `${state.tee}|${state.hole}`;
  const persist = () => {
    store = {
      date: todayDate,
      hole: holeKey,
      par: state.par,
      undoUsed: !!state.undoUsed,
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
      undoUsed: !!store.undoUsed,
    };
  } else {
    persist();
  }
  renderScorebook();
  $("hole-num").textContent = `Hole ${puzNum}`;
  $("rule").innerHTML = `Get from <b>${escapeHtml(up(state.tee))}</b> to <b>${escapeHtml(up(state.hole))}</b>. Every word you play must make a phrase with the one before it. Par ${state.par}.`;
  const render = (justPlayed = false) => {
    dist = routeDistances(state, course);
    renderHole(state, dist, geo, puzNum, justPlayed);
    renderGreen(state, course);
    renderShot(state, dist, course, justPlayed);
    renderCaddie(state, course, dist);
    renderActions(state, dist);
  };
  render();
  if (state.holed) renderEnd(state, puzNum);

  let pendingShot = null;
  const clearWarning = () => { pendingShot = null; $("shot-warning").hidden = true; };
  $("cancel-shot").addEventListener("click", () => { clearWarning(); focusShot(); $("shot")?.select(); });
  $("fairway").addEventListener("input", clearWarning);
  $("confirm-shot").addEventListener("click", () => { if (pendingShot) submitShot(true); });
  const submitShot = (confirmed = false) => {
    const input = $("shot");
    if (!input) return;
    const r = play(state, input.value, course, dist);
    if (!r.ok) {
      const typed = up(input.value.trim());
      if (r.reason === "unknown") setStatus("Not a shot this course knows.", "no");
      else if (r.reason === "revisit") setStatus(`You’ve already played through ${typed}.`, "no");
      else if (r.reason === "invalid") setStatus("Letters only.", "no");
      input.classList.remove("refuse");
      void input.offsetWidth;
      input.classList.add("refuse");
      input.select();
      return;
    }
    if (!r.holed && r.after === undefined && (!confirmed || pendingShot !== input.value)) {
      pendingShot = input.value;
      $("warning-text").textContent = `“${cap(r.phrase)}” works, but there’s no route from ${up(r.state.path.at(-1))} to ${up(state.hole)} without going back. No stroke taken yet.`;
      $("shot-warning").hidden = false;
      $("cancel-shot").focus({ preventScroll: true });
      return;
    }
    clearWarning();
    state = r.state;
    persist();
    input.value = "";
    render(true);
    const lie = lieOf({ before: r.before, after: r.after }, r.holed);
    $("status").classList.remove("shot-connected");
    void $("status").offsetWidth;
    setStatus(shotLine(r, state), lie === "holed" || lie === "fairway" || lie === "green" ? "yes" : lie === "water" || lie === "bunker" ? "no" : "");
    const wordAt = r.phrase.lastIndexOf(r.state.path.at(-1));
    const line = shotLine(r, state);
    $("status").innerHTML = `<span class="joined-phrase"><span class="phrase-first">${escapeHtml(cap(r.phrase.slice(0, wordAt)))}</span><span class="phrase-second">${escapeHtml(r.phrase.slice(wordAt))}</span>.</span>${escapeHtml(line.slice(r.phrase.length + 1))}`;
    $("status").classList.add("shot-connected");
    if (state.holed) {
      celebrateWin(state, dist, geo, puzNum);
      return;
    }
    if (!dist.has(state.path.at(-1))) {
      $("drop-btn")?.focus({ preventScroll: true });
      return;
    }
    focusShot();
  };
  $("fairway").addEventListener("submit", ev => { ev.preventDefault(); submitShot(); });

  $("actions").addEventListener("click", (ev) => {
    if (ev.target.closest("#caddie-btn")) {
      const r = askCaddie(state);
      if (!r.ok) return;
      state = r.state;
      persist();
      renderCaddie(state, course, dist);
      renderActions(state, dist);
      focusShot();
      return;
    }
    if (ev.target.closest("#undo-btn")) {
      const r = undo(state);
      if (!r.ok) return;
      clearWarning(); state = r.state; persist(); render();
      setStatus(`Back to ${up(state.path.at(-1))}. Shot removed. Your free undo is used.`, "yes");
      focusShot(); return;
    }
    const btn = ev.target.closest("#drop-btn");
    if (!btn) return;
    clearWarning();
    const r = drop(state);
    if (!r.ok) return;
    state = r.state;
    persist();
    render();
    const here = state.path[state.path.length - 1];
    setStatus(`Drop. Back on ${up(here)}, one stroke added. ${cap(yardage(dist.get(here)))}.`, "");
    focusShot();
  });

  $("replay-btn").addEventListener("click", () => {
    if (state.holed) celebrateWin(state, dist, geo, puzNum);
  });

  const downloadCard = () => {
    if (!shareImageFile) return;
    const url = URL.createObjectURL(shareImageFile);
    const a = document.createElement('a'); a.href = url; a.download = shareImageFile.name;
    a.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus('Scorecard image saved. Copy text includes the link to this hole.', 'yes');
  };
  const copyCard = async () => {
    try {
      await navigator.clipboard.writeText($("share-text").textContent);
      setStatus('Scorecard copied, with a link to this exact hole.', 'yes');
    } catch {
      document.querySelector('.text-card').open = true;
      setStatus('Select and copy the text version below.');
    }
  };
  $("download-card").addEventListener('click', downloadCard);
  $("copy-card").addEventListener('click', copyCard);
  $("share-btn").addEventListener('click', async () => {
    if (!shareImageFile) return;
    if (!navigator.canShare?.({ files: [shareImageFile] })) { downloadCard(); return; }
    try {
      await navigator.share({ files: [shareImageFile], text: $("share-text").textContent, title: `Links #${puzNum}` });
    } catch (err) {
      if (err.name !== 'AbortError') setStatus('Sharing was unavailable. Use Save image or Copy text.');
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
