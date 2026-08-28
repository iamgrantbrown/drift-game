import { MAX_GUESSES, applyGuess, bestHeat, createState, shouldNudge } from "./game.js";
import { bandFor, bandRank, createHeatLookup } from "./heat.js";
import { dayIndex, daysBetween, pacificDateString, puzzleNumber, TIMEZONE } from "./calendar.js";
import { shareText } from "./share.js";

const STORAGE_KEY = "drift-v2";
const HOWTO_KEY = "drift-howto-v1";
const NUDGE_TEXT = "drift moves by meaning — yesterday’s word has more than one.";

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

function renderGuesses(state) {
  const root = $("guesses");
  root.innerHTML = "";
  for (let i = 0; i < MAX_GUESSES; i++) {
    const g = state.guesses[i];
    const row = document.createElement("div");
    row.className = "guess-row" + (g ? " filled" : " empty");
    if (!g) {
      row.setAttribute("aria-label", `Guess ${i + 1} empty`);
      root.appendChild(row);
      continue;
    }
    const found = g.word === state.today;
    const band = found ? "found" : bandFor(g.heat);
    row.classList.add("band-" + band);
    if (i === state.guesses.length - 1) row.classList.add("latest");
    const arrow = !found && TREND_ARROW[g.trend] ? `<span class="trend ${g.trend}" aria-hidden="true">${TREND_ARROW[g.trend]}</span>` : "";
    const trendWord = !found && TREND_ARROW[g.trend] ? g.trend : "";
    row.setAttribute("aria-label", `${g.word}: ${band}${trendWord ? ", " + trendWord : ""}`);
    row.innerHTML = `
      <span class="word">${escapeHtml(g.word)}</span>
      <span class="band-chip band-${band}">
        <span class="band-dot" aria-hidden="true"></span>
        <span class="band-name">${band}</span>${arrow}
      </span>
    `;
    root.appendChild(row);
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

/** Sky warmth + kite altitude follow the best band reached (0..5). */
function renderProgress(state) {
  const rank = state.won ? 6 : bandRank(bestHeat(state));
  const warmth = Math.min(1, rank / 5);
  document.documentElement.style.setProperty("--warmth", warmth.toFixed(3));
  const kite = $("kite");
  kite.style.setProperty("--alt", (rank / 6).toFixed(3));
  kite.classList.toggle("soaring", state.won);
  kite.classList.toggle("sunk", state.lost);
}

function stampToday(state) {
  const tile = $("today-word");
  tile.textContent = state.today;
  tile.classList.add(state.won ? "stamped" : "revealed");
  $("today-blank").hidden = true;
}

function renderEnd(state, puzNum, store) {
  const panel = $("end");
  panel.hidden = false;
  stampToday(state);
  $("share-text").textContent = shareText({
    puzzleNumber: puzNum,
    guesses: state.guesses,
    won: state.won,
    maxGuesses: MAX_GUESSES,
  });
  $("end-title").textContent = state.won ? "You caught the drift" : "It drifted away";
  $("end-body").textContent = state.won
    ? `Today’s word in ${state.guesses.length} of ${MAX_GUESSES}.`
    : `Today’s word was ${state.today}.`;
  $("pivot-line").innerHTML =
    `<b>${escapeHtml(state.yesterday)}</b> → <b>${escapeHtml(state.today)}</b> — ${escapeHtml(state.pivot)}`;
  $("tomorrow-line").textContent = `Tomorrow drifts from “${state.today}.”`;
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
    el.textContent = `Next drift in ${h}:${m}:${s}`;
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

  const [words, heatBuf] = await Promise.all([
    fetch("data/words.json").then((r) => r.json()),
    fetch(`data/heat/${String(idx).padStart(3, "0")}.bin`).then((r) => r.arrayBuffer()),
  ]);
  const lookup = createHeatLookup(words, heatBuf);

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
  renderGuesses(state);
  renderProgress(state);
  renderStats(store);

  if (state.won || state.lost) {
    renderEnd(state, puzNum, store);
    setStatus(state.won ? "Already caught today’s drift." : "Come back after midnight Pacific.");
  }

  let nudged = state.guesses.length > 0 && shouldNudge(state);
  if (nudged) setStatus(NUDGE_TEXT, "nudge");

  $("form").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const input = $("guess");
    const result = applyGuess(state, input.value, lookup);
    if (!result.ok) {
      if (result.reason === "invalid") setStatus("Not in the word list.", "bad");
      else if (result.reason === "duplicate") setStatus("Already guessed.", "bad");
      else setStatus("Today’s drift is over.");
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
    renderGuesses(state);
    renderProgress(state);
    renderStats(store);
    input.value = "";
    input.focus();
    if (state.won) {
      setStatus(`You caught it — ${state.today}.`, "good");
      renderEnd(state, puzNum, store);
    } else if (state.lost) {
      setStatus("Six guesses. It drifted away.", "bad");
      renderEnd(state, puzNum, store);
    } else if (!nudged && shouldNudge(state)) {
      nudged = true;
      setStatus(NUDGE_TEXT, "nudge");
    } else {
      const band = bandFor(result.heat);
      if (result.trend === "hotter") setStatus(`Hotter — ${band}.`);
      else if (result.trend === "colder") setStatus(`Colder — ${band}.`);
      else setStatus(cap(band) + ".");
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

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

main().catch((err) => {
  console.error(err);
  setStatus("Could not load today’s puzzle files.", "bad");
});
