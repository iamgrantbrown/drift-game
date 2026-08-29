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
    // a pen and a jotted note: the desk where the day starts
    S("calc(50% + 265px)", "16%", 86,
      '<path d="M24 76 L62 38 a7 7 0 0 1 10 10 L34 86 a7 7 0 0 1 -10 -10 z"/><path d="M24 76 l-8 16 l16 -8"/><path d="M56 44 l8 8" stroke-width="1.7"/>'),
    S("calc(50% - 345px)", "62%", 88,
      '<path d="M20 26 h44 v22 l-8 8 h-36 z" transform="rotate(-5 42 41)"/><path d="M28 36 h28 M28 44 h18" stroke-width="1.6" transform="rotate(-5 42 41)"/>'),
  ],
  coffee: [
    // your cup, seen from above, spoon on the saucer
    S("calc(50% + 250px)", "13%", 104,
      '<circle cx="48" cy="52" r="31"/><circle cx="48" cy="52" r="20"/><circle cx="48" cy="52" r="14" stroke-width="1.7"/><path d="M79 46 a9 9 0 0 1 0 13"/><path d="M62 76 l16 12"/><ellipse cx="80" cy="90" rx="5" ry="3.6" transform="rotate(38 80 90)"/>'),
    // the ring an earlier cup left behind
    S("calc(50% - 340px)", "62%", 90,
      '<path d="M36 26 a24 24 0 0 1 30 10" stroke-width="5" opacity="0.5"/><path d="M70 44 a24 24 0 0 1 -12 28" stroke-width="5" opacity="0.4"/><path d="M50 74 a24 24 0 0 1 -22 -34" stroke-width="5" opacity="0.45"/>'),
  ],
  commute: [
    // phone face-up on the tray table, ticket beside it
    S("calc(50% + 275px)", "14%", 76,
      '<rect x="34" y="18" width="34" height="62" rx="7"/><path d="M46 24 h10" stroke-width="1.7"/><circle cx="51" cy="72" r="2.6" stroke-width="1.7"/>'),
    S("calc(50% - 330px)", "64%", 84,
      '<path d="M18 40 h64 v12 a5 5 0 0 0 0 10 v12 h-64 v-12 a5 5 0 0 0 0 -10 z" transform="rotate(-8 50 57)"/><path d="M30 52 h24 M30 60 h18" transform="rotate(-8 50 57)" stroke-width="1.7"/><path d="M66 46 v30" stroke-dasharray="4 5" transform="rotate(-8 50 57)" stroke-width="1.7"/>'),
  ],
  office: [
    // sticky notes and a pencil put down mid-thought
    S("calc(50% + 265px)", "15%", 86,
      '<rect x="16" y="18" width="34" height="34" transform="rotate(-5 33 35)"/><rect x="48" y="40" width="34" height="34" transform="rotate(6 65 57)"/><path d="M22 32 c 8 -4, 16 2, 22 -2" transform="rotate(-5 33 35)"/><path d="M54 54 h20 M54 62 h14" transform="rotate(6 65 57)"/>'),
    S("calc(50% - 340px)", "64%", 84,
      '<path d="M22 80 L58 44 M30 88 L66 52"/><path d="M22 80 l-6 12 l10 -4 z"/><path d="M58 44 l8 8 M62 40 l8 8" stroke-width="1.7"/>'),
  ],
  park: [
    // what the wind left on the bench
    S("calc(50% + 260px)", "14%", 92,
      '<path d="M74 20 C 58 22, 42 38, 32 60 C 29 68, 28 76, 28 82 C 34 78, 43 71, 51 61 C 64 47, 71 33, 74 20 z"/><path d="M30 80 C 46 60, 62 38, 74 20" stroke-width="1.6"/><path d="M38 62 l8 3 M44 52 l9 4 M52 42 l8 4" stroke-width="1.4" opacity="0.8"/>'),
    S("calc(50% - 340px)", "64%", 84,
      '<path d="M26 60 c -8 -12, 2 -26, 16 -24 c 2 14, -6 24, -16 24 z"/><path d="M30 56 c 4 -8, 8 -14, 10 -20" stroke-width="1.6"/><path d="M58 74 c -6 -10, 2 -20, 13 -19 c 1 11, -5 19, -13 19 z" transform="rotate(24 64 64)"/>'),
  ],
  evening: [
    // the notebook set like a dinner plate: fork left, knife right
    S("calc(50% - 300px)", "22%", 90,
      '<path d="M46 90 c -3 -14, -2 -24, 2 -34 l 0 -4 c -5 -4, -7 -10, -7 -18 l 2 -16 M52 90 c 3 -14, 2 -24, -2 -34 l 0 -4 c 5 -4, 7 -10, 7 -18 l -2 -16"/><path d="M46 18 v16 M52 18 v16" stroke-width="1.7"/>'),
    S("calc(50% + 260px)", "22%", 90,
      '<path d="M48 90 c -2 -12, -2 -22, 0 -34"/><path d="M52 90 c 2 -12, 2 -22, 0 -34"/><path d="M48 56 c -6 -14, -6 -28, 2 -42 c 8 10, 9 28, 2 42 z"/>'),
  ],
  night: [
    // glasses folded, a book closed: the day put away
    S("calc(50% + 260px)", "13%", 88,
      '<rect x="30" y="18" width="42" height="64" rx="3"/><path d="M37 18 v64" stroke-width="1.7"/><path d="M46 34 h18 M46 42 h12" stroke-width="1.5" opacity="0.8"/><path d="M60 82 v-8 l4 4 l4 -4 v8" stroke-width="1.5"/>'),
    S("calc(50% - 345px)", "60%", 90,
      '<circle cx="30" cy="56" r="13"/><circle cx="58" cy="56" r="13"/><path d="M43 54 a5 4 0 0 1 2 0" stroke-width="1.7"/><path d="M71 52 C 66 40, 52 36, 40 40" stroke-width="1.7"/><path d="M17 52 C 20 44, 26 40, 34 41" stroke-width="1.7"/>'),
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
