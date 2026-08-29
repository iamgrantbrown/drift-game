import { MAX_GUESSES, applyGuess, blankPivot, clueAvailable, createState } from "./game.js";
import { bandFor, createHeatLookup } from "./heat.js";
import { dayIndex, daysBetween, pacificDateString, puzzleNumber, TIMEZONE } from "./calendar.js";
import { shareText } from "./share.js";
import { voiceLine, winLine } from "./voice.js";

const STORAGE_KEY = "drift-v2";
const HOWTO_KEY = "drift-howto-v1";

const $ = (id) => document.getElementById(id);

function defaultStore() {
  return {
    streak: 0,
    maxStreak: 0,
    plays: 0,
    wins: 0,
    dist: [0, 0, 0, 0, 0, 0],
    lastWinDate: null,
    lastPlayDate: null,
    today: null,
  };
}

function loadStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultStore();
    return { ...defaultStore(), ...JSON.parse(raw) };
  } catch {
    return defaultStore();
  }
}

function saveStore(store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* private mode: play without persistence */
  }
}

function recordResult(store, date, won, guessCount) {
  const already = store.lastPlayDate === date;
  if (already) return store;
  const plays = (store.plays || 0) + 1;
  const wins = (store.wins || 0) + (won ? 1 : 0);
  const dist = [...(store.dist || [0, 0, 0, 0, 0, 0])];
  if (won && guessCount >= 1 && guessCount <= MAX_GUESSES) dist[guessCount - 1] += 1;
  let streak = store.streak || 0;
  let maxStreak = store.maxStreak || 0;
  let lastWinDate = store.lastWinDate || null;
  if (won) {
    if (lastWinDate) {
      const gap = daysBetween(lastWinDate, date);
      streak = gap === 1 ? streak + 1 : gap === 0 ? streak : 1;
    } else {
      streak = 1;
    }
    lastWinDate = date;
    maxStreak = Math.max(maxStreak, streak);
  } else {
    streak = 0;
  }
  return { ...store, plays, wins, dist, streak, maxStreak, lastWinDate, lastPlayDate: date };
}

/* ---------- rendering ---------- */

const TREND_ARROW = { hotter: "▲", colder: "▼" };

/** The notebook page: guessed words scribble out and stack up; the write
 *  line moves down with you; empty rules wait below. */
function renderPage(state) {
  const trail = $("trail");
  trail.innerHTML = "";
  for (let i = 0; i < state.guesses.length; i++) {
    const g = state.guesses[i];
    const found = g.word === state.today;
    const band = found ? "found" : g.near ? "near" : bandFor(g.heat);
    const label = g.near ? "joins yesterday" : band;
    const line = document.createElement("div");
    line.className = "page-line line-guess band-" + band;
    if (i === state.guesses.length - 1) line.classList.add("latest");
    const showArrow = !found && !g.near && TREND_ARROW[g.trend];
    const arrow = showArrow ? `<span class="trend ${g.trend}" aria-hidden="true">${TREND_ARROW[g.trend]}</span>` : "";
    line.setAttribute("aria-label", `${g.word}: ${label}${showArrow ? ", " + g.trend : ""}`);
    line.innerHTML = `
      <span class="line-word ${found ? "line-found" : "scribbled"}">${escapeHtml(g.word)}</span>
      <span class="band-chip band-${band}">
        <span class="band-dot" aria-hidden="true"></span>
        <span class="band-name">${label}</span>${arrow}
      </span>
    `;
    trail.appendChild(line);
  }
  // loss: the answer gets written on the page in the drift's own hand
  if (state.lost) {
    const line = document.createElement("div");
    line.className = "page-line line-guess line-reveal";
    line.innerHTML = `<span class="line-word line-revealed">${escapeHtml(state.today)}</span><span class="reveal-note">the drift</span>`;
    trail.appendChild(line);
  }
  const over = state.won || state.lost;
  $("active-line").hidden = over;
  const used = state.guesses.length + (state.lost ? 1 : 0);
  const blanksLeft = over ? Math.max(0, MAX_GUESSES - used) : Math.max(0, MAX_GUESSES - used - 1);
  const blanks = $("blanks");
  blanks.innerHTML = "";
  for (let i = 0; i < blanksLeft; i++) {
    const line = document.createElement("div");
    line.className = "page-line line-blank";
    blanks.appendChild(line);
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);
}

function setStatus(msg, kind = "") {
  const el = $("status");
  el.textContent = msg || "";
  el.className = "status " + kind;
}

/** The notebook travels through your day: every guess sets it down
 *  somewhere new, and the finished page ends up under a lamp at night.
 *  Each scene = a caption (time + place, like a journal entry), a calm
 *  surface, and a few pencil-drawn props that say where you are. */
const SCENES = [
  { name: "home", label: "8 am \u00b7 at home" },
  { name: "coffee", label: "10 am \u00b7 the coffee shop" },
  { name: "commute", label: "12 pm \u00b7 on the train" },
  { name: "office", label: "2 pm \u00b7 the office" },
  { name: "park", label: "5 pm \u00b7 the park" },
  { name: "evening", label: "7 pm \u00b7 the kitchen table" },
];
const NIGHT = { name: "night", label: "11 pm \u00b7 lights out" };

const S = (x, y, w, body) =>
  `<svg class="prop" style="left:${x};top:${y};width:${w}px" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

const PROPS = {
  home: [
    // potted plant, bottom-left of the desk
    S("calc(50% - 350px)", "62%", 92,
      '<path d="M32 62 h36 l-5 28 h-26 z"/><path d="M50 62 C 50 40, 38 34, 30 22"/><path d="M50 62 C 52 38, 64 34, 72 20"/><path d="M50 62 C 50 44, 50 34, 50 24"/><path d="M30 22 c -2 8, 2 12, 8 13"/><path d="M72 20 c 3 8, -1 13, -8 14"/><path d="M50 24 c -6 4, -6 10, 0 13"/>'),
    // morning mug, top-right
    S("calc(50% + 265px)", "16%", 74,
      '<path d="M28 40 h40 v26 a14 14 0 0 1 -14 14 h-12 a14 14 0 0 1 -14 -14 z"/><path d="M68 46 h8 a9 9 0 0 1 0 18 h-9"/><path d="M40 30 c 0 -6, 6 -6, 6 -12"/><path d="M52 32 c 0 -5, 5 -5, 5 -10"/>'),
  ],
  coffee: [
    // cup on saucer with steam, top-right
    S("calc(50% + 250px)", "14%", 96,
      '<ellipse cx="50" cy="74" rx="34" ry="7"/><path d="M28 42 h36 v14 a13 13 0 0 1 -13 13 h-10 a13 13 0 0 1 -13 -13 z"/><path d="M64 46 h7 a8 8 0 0 1 0 16 h-8"/><path d="M36 32 c 0 -7, 6 -7, 6 -14"/><path d="M47 34 c 0 -6, 6 -6, 6 -12"/><path d="M57 32 c 0 -7, 6 -7, 6 -14"/>'),
    // croissant, bottom-left
    S("calc(50% - 345px)", "64%", 88,
      '<path d="M16 64 C 12 52, 22 42, 34 46 C 38 36, 62 36, 66 46 C 78 42, 88 52, 84 64 C 80 58, 72 56, 66 58 C 62 50, 38 50, 34 58 C 28 56, 20 58, 16 64 z"/><path d="M34 46 C 36 51, 36 54, 34 58" stroke-width="1.8"/><path d="M66 46 C 64 51, 64 54, 66 58" stroke-width="1.8"/>'),
  ],
  commute: [
    // train window with the country rolling past, top-right
    S("calc(50% + 245px)", "12%", 110,
      '<rect x="10" y="18" width="80" height="56" rx="9"/><rect x="16" y="24" width="68" height="44" rx="5" stroke-width="1.7"/><path d="M18 56 C 30 48, 42 54, 52 50 C 64 44, 74 50, 82 48" stroke-width="1.7"/><path d="M24 34 h12 M46 31 h16 M30 40 h9" stroke-width="1.5" opacity="0.7"/>'),
    // ticket stub, bottom-left
    S("calc(50% - 330px)", "66%", 84,
      '<path d="M18 40 h64 v12 a5 5 0 0 0 0 10 v12 h-64 v-12 a5 5 0 0 0 0 -10 z" transform="rotate(-8 50 57)"/><path d="M30 52 h24 M30 60 h18" transform="rotate(-8 50 57)"/><path d="M66 46 v30" stroke-dasharray="4 5" transform="rotate(-8 50 57)"/>'),
  ],
  office: [
    // sticky notes, top-right
    S("calc(50% + 265px)", "15%", 86,
      '<rect x="16" y="18" width="34" height="34" transform="rotate(-5 33 35)"/><rect x="48" y="40" width="34" height="34" transform="rotate(6 65 57)"/><path d="M22 32 c 8 -4, 16 2, 22 -2" transform="rotate(-5 33 35)"/><path d="M54 54 h20 M54 62 h14" transform="rotate(6 65 57)"/>'),
    // paper coffee cup + paperclip, bottom-left
    S("calc(50% - 335px)", "63%", 80,
      '<path d="M34 36 h30 l-4 40 h-22 z"/><path d="M32 36 h34 v-8 h-34 z"/><path d="M40 22 c 0 -5, 5 -5, 5 -9"/><path d="M76 66 c 6 -2, 10 4, 5 8 l-12 9 c -7 5, -14 -4, -8 -9 l 13 -10" stroke-width="1.8"/>'),
  ],
  park: [
    // a bird on a branch, top-right
    S("calc(50% + 240px)", "12%", 116,
      '<path d="M6 70 C 28 64, 62 66, 94 62"/><path d="M74 64 c 5 -4, 8 -9, 8 -15"/><path d="M34 61 C 24 60, 22 50, 30 45 C 31 36, 43 33, 48 39 C 50 38, 53 38, 55 40 L 64 43 L 55 46 C 57 55, 48 63, 38 61 z"/><circle cx="47" cy="43" r="1.1" fill="currentColor" stroke="none"/><path d="M32 52 a8 6 0 0 0 10 4" stroke-width="1.7"/><path d="M31 46 l-11 -5 M31 50 l-12 0" stroke-width="1.7"/><path d="M38 61 v7 M44 60 v8" stroke-width="1.7"/>'),
    // fallen leaves, bottom-left
    S("calc(50% - 340px)", "66%", 84,
      '<path d="M26 60 c -8 -12, 2 -26, 16 -24 c 2 14, -6 24, -16 24 z"/><path d="M30 56 c 4 -8, 8 -14, 10 -20"/><path d="M58 74 c -6 -10, 2 -20, 13 -19 c 1 11, -5 19, -13 19 z" transform="rotate(24 64 64)"/>'),
  ],
  evening: [
    // lit candle, top-right
    S("calc(50% + 275px)", "14%", 70,
      '<path d="M40 44 h20 v34 h-20 z"/><ellipse cx="50" cy="78" rx="20" ry="5"/><path d="M50 44 v-8"/><path d="M50 22 c 5 6, 4 11, 0 14 c -4 -3, -5 -8, 0 -14 z"/>'),
    // plate with fork, bottom-left
    S("calc(50% - 350px)", "64%", 92,
      '<circle cx="56" cy="56" r="26"/><circle cx="56" cy="56" r="16"/><path d="M18 36 v14 M24 36 v14 M30 36 v14 M24 50 v28"/><path d="M18 50 h12"/>'),
  ],
  night: [
    // bedside lamp glowing, top-right
    S("calc(50% + 245px)", "8%", 120,
      '<path d="M27 42 a23 23 0 0 1 46 0 z"/><path d="M50 42 v24"/><path d="M34 75 a16 9 0 0 1 32 0 z"/><path d="M37 50 l-5 9" stroke-width="1.6" opacity="0.75"/><path d="M50 51 v10" stroke-width="1.6" opacity="0.75"/><path d="M63 50 l5 9" stroke-width="1.6" opacity="0.75"/>'),
    // moon + reading glasses, bottom-left
    S("calc(50% - 330px)", "10%", 56, '<path d="M62 20 a26 26 0 1 0 18 44 a30 30 0 0 1 -18 -44 z"/>'),
    S("calc(50% - 345px)", "66%", 84,
      '<circle cx="32" cy="56" r="14"/><circle cx="68" cy="56" r="14"/><path d="M46 56 c 2 -4, 6 -4, 8 0"/><path d="M18 56 l -8 -6 M82 56 l 8 -6"/>'),
  ],
};

let sceneShown = null;
let sceneFront = null; // which layer is currently visible

function renderProgress(state) {
  const scene = state.won || state.lost ? NIGHT : SCENES[Math.min(state.guesses.length, SCENES.length - 1)];
  if (scene.name === sceneShown) return;
  sceneShown = scene.name;
  document.documentElement.dataset.scene = scene.name;
  $("scene-caption").textContent = scene.label;
  const a = $("scene-a");
  const b = $("scene-b");
  const front = sceneFront === a ? a : sceneFront === b ? b : null;
  const back = front === a ? b : a;
  back.className = "scene bg-" + scene.name;
  back.innerHTML = (PROPS[scene.name] || []).join("");
  // double rAF so the class lands before the fade starts
  requestAnimationFrame(() => requestAnimationFrame(() => {
    back.classList.add("visible");
    if (front) front.classList.remove("visible");
  }));
  sceneFront = back;
}

function renderEnd(state, puzNum, store) {
  const panel = $("end");
  panel.hidden = false;
  $("share-text").textContent = shareText({
    puzzleNumber: puzNum,
    guesses: state.guesses,
    won: state.won,
    maxGuesses: MAX_GUESSES,
  });
  $("end-title").textContent = state.won ? "You caught the drift" : "It drifted away";
  $("end-body").textContent = state.won
    ? `${winLine(state.guesses.length, puzNum)} In ${state.guesses.length} of ${MAX_GUESSES}.`
    : voiceLine("loss", puzNum);
  $("pivot-line").innerHTML =
    `From “<b>${escapeHtml(state.yesterday)}</b>”, the word drifted through ` +
    `“<i>${escapeHtml(state.pivot)}</i>” to “<b>${escapeHtml(state.today)}</b>”.`;
  $("tomorrow-line").textContent = `Tomorrow drifts from “${state.today}”.`;
  $("form").hidden = true;
  renderStats(store);
  startCountdown();
  panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

/* ---------- stats dialog ---------- */

function renderStats(store) {
  $("stat-plays").textContent = String(store.plays || 0);
  const winPct = store.plays ? Math.round((100 * (store.wins || 0)) / store.plays) : 0;
  $("stat-win").textContent = winPct + "%";
  $("stat-streak").textContent = String(store.streak || 0);
  $("stat-best").textContent = String(store.maxStreak || 0);
  const dist = store.dist || [0, 0, 0, 0, 0, 0];
  const max = Math.max(1, ...dist);
  const root = $("dist");
  root.innerHTML = "";
  dist.forEach((n, i) => {
    const row = document.createElement("div");
    row.className = "dist-row";
    row.innerHTML = `<span class="dist-n">${i + 1}</span><span class="dist-bar" style="--w:${Math.round((100 * n) / max)}%"><b>${n}</b></span>`;
    root.appendChild(row);
  });
}

function wireDialog(dialogId, openBtnId, closeBtnId, onOpen) {
  const d = $(dialogId);
  const open = () => {
    if (onOpen) onOpen();
    if (typeof d.showModal === "function") d.showModal();
    else d.setAttribute("open", "");
  };
  const close = () => {
    if (typeof d.close === "function" && d.open) d.close();
    else d.removeAttribute("open");
  };
  if (openBtnId) $(openBtnId).addEventListener("click", open);
  if (closeBtnId) $(closeBtnId).addEventListener("click", close);
  d.addEventListener("click", (ev) => {
    if (ev.target === d) close();
  });
  return { open, close };
}

/* ---------- countdown ---------- */

let countdownTimer = null;

function startCountdown() {
  const el = $("countdown");
  if (countdownTimer) clearInterval(countdownTimer);
  const tick = () => {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(now);
    const get = (t) => Number(parts.find((p) => p.type === t).value);
    const secsToday = (get("hour") % 24) * 3600 + get("minute") * 60 + get("second");
    const left = 86400 - secsToday;
    const h = String(Math.floor(left / 3600)).padStart(2, "0");
    const m = String(Math.floor((left % 3600) / 60)).padStart(2, "0");
    const s = String(left % 60).padStart(2, "0");
    el.textContent = `tomorrow’s word drifts in ${h}:${m}:${s}`;
  };
  tick();
  countdownTimer = setInterval(tick, 1000);
}

/* ---------- howto ---------- */

function howtoSeen() {
  try {
    return localStorage.getItem(HOWTO_KEY) === "1";
  } catch {
    return false;
  }
}

function markHowtoSeen() {
  try {
    localStorage.setItem(HOWTO_KEY, "1");
  } catch {
    /* ignore */
  }
}

/* ---------- main ---------- */

async function main() {
  const statsDialog = wireDialog("stats", "stats-btn", "stats-close");
  const howtoDialog = wireDialog("howto", "howto-btn", "howto-close");
  $("howto-play").addEventListener("click", () => {
    markHowtoSeen();
    howtoDialog.close();
    const input = $("guess");
    if (input && !input.closest("form").hidden) input.focus();
  });
  $("howto").addEventListener("close", markHowtoSeen);

  const chainPack = await fetch("data/chain.json").then((r) => r.json());
  const chain = chainPack.words;
  // Playtest preview: ?date=YYYY-MM-DD plays that Pacific day's puzzle.
  const dateParam = new URLSearchParams(location.search).get("date");
  const todayDate = /^\d{4}-\d{2}-\d{2}$/.test(dateParam || "")
    ? dateParam
    : pacificDateString(new Date());
  const idx = dayIndex(todayDate, chain.length, chainPack.epoch);
  const puzNum = puzzleNumber(todayDate, chainPack.epoch);

  const prevIdx = (idx - 1 + chain.length) % chain.length;
  const [words, heatBuf, pairList] = await Promise.all([
    fetch("data/words.json").then((r) => r.json()),
    fetch(`data/heat/${String(idx).padStart(3, "0")}.bin`).then((r) => r.arrayBuffer()),
    fetch("data/pairs.json").then((r) => r.json()).catch(() => []),
  ]);
  const lookup = createHeatLookup(words, heatBuf);
  const yesterdayWord = chain[prevIdx].w;
  // every word known to join yesterday's word into a lexical unit
  const joins = new Set();
  for (const [a, b] of pairList) {
    if (a === yesterdayWord) joins.add(b);
    else if (b === yesterdayWord) joins.add(a);
  }

  let state = createState(chain, idx);
  let store = loadStore();

  if (store.today && store.today.date === todayDate && Array.isArray(store.today.guesses)) {
    state = {
      ...state,
      guesses: store.today.guesses,
      won: !!store.today.won,
      lost: !!store.today.lost,
    };
  } else {
    store = { ...store, today: { date: todayDate, guesses: [], won: false, lost: false } };
    saveStore(store);
  }

  $("yesterday").textContent = state.yesterday;
  $("puzzle-num").textContent = `#${puzNum}`;
  renderPage(state);
  renderProgress(state);
  renderStats(store);

  const renderClue = () => {
    const note = $("clue");
    if (clueAvailable(state)) {
      $("clue-text").textContent = blankPivot(state.pivot, state.today);
      note.hidden = false;
    } else {
      note.hidden = true;
    }
  };
  renderClue();

  if (state.won || state.lost) {
    renderEnd(state, puzNum, store);
    setStatus(voiceLine("done", puzNum));
  }

  const shake = (input) => {
    input.classList.remove("shake");
    void input.offsetWidth; // restart the animation
    input.classList.add("shake");
  };

  $("form").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const input = $("guess");
    const result = applyGuess(state, input.value, lookup, joins);
    if (!result.ok) {
      if (result.reason === "invalid") setStatus(voiceLine("invalid", puzNum + state.guesses.length), "bad");
      else if (result.reason === "duplicate") setStatus(voiceLine("duplicate", puzNum + state.guesses.length), "bad");
      else setStatus(voiceLine("done", puzNum));
      shake(input);
      input.select();
      return;
    }
    state = result.state;
    store = {
      ...store,
      today: { date: todayDate, guesses: state.guesses, won: state.won, lost: state.lost },
    };
    if (state.won || state.lost) {
      store = recordResult(store, todayDate, state.won, state.guesses.length);
    }
    saveStore(store);
    renderPage(state);
    renderProgress(state);
    renderStats(store);
    renderClue();
    input.value = "";
    if (!state.won && !state.lost) input.focus();
    const seed = puzNum * 7 + state.guesses.length;
    if (state.won) {
      setStatus(`caught it: ${state.today}.`, "good");
      renderEnd(state, puzNum, store);
      burstScraps($("trail").lastElementChild || $("trail"));
    } else if (state.lost) {
      setStatus(voiceLine("loss", puzNum), "bad");
      renderEnd(state, puzNum, store);
    } else if (state.guesses[state.guesses.length - 1].near) {
      setStatus(voiceLine("near", seed), "nudge");
    } else {
      setStatus(voiceLine(bandFor(result.heat), seed));
    }
  });

  $("share-btn").addEventListener("click", async () => {
    const text = $("share-text").textContent;
    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
        setStatus("Share card copied. The word stays secret.", "good");
      }
    } catch {
      try {
        await navigator.clipboard.writeText(text);
        setStatus("Share card copied.", "good");
      } catch {
        setStatus("Copy the card by hand.");
      }
    }
  });

  if (!howtoSeen()) howtoDialog.open();
  else if (!(state.won || state.lost)) $("guess").focus();
}

/** A little burst of paper scraps from the stamped tile on a win. */
function burstScraps(fromEl) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const rect = fromEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const colors = ["#fffaf2", "#d07850", "#c4ae94", "#e2b45a"];
  for (let i = 0; i < 14; i++) {
    const s = document.createElement("span");
    s.className = "scrap" + (i % 5 === 0 ? " scrap-kite" : "");
    const angle = (i / 14) * Math.PI * 2 + Math.random() * 0.6;
    s.style.left = cx + "px";
    s.style.top = cy + "px";
    s.style.background = colors[i % colors.length];
    s.style.setProperty("--dx", Math.cos(angle) * (50 + Math.random() * 90) + "px");
    s.style.setProperty("--dy", Math.sin(angle) * (40 + Math.random() * 60) - 90 + "px");
    s.style.setProperty("--rot", (Math.random() * 520 - 260).toFixed(0) + "deg");
    s.addEventListener("animationend", () => s.remove());
    document.body.appendChild(s);
  }
}

main().catch((err) => {
  console.error(err);
  setStatus("Could not load today’s puzzle files.", "bad");
});
