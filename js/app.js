import { MAX_GUESSES, applyGuess, blankPivot, clueAvailable, createState } from "./game.js";
import { bandFor, bandRank, createHeatLookup } from "./heat.js";
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

/** Sky warmth is a live thermometer: it follows the LATEST guess, warming
 *  when you run hot and cooling again when you drift cold. */
function renderProgress(state) {
  const last = state.guesses[state.guesses.length - 1];
  const rank = state.won ? 6 : last ? bandRank(last.heat) : 0;
  const warmth = Math.min(1, rank / 5);
  document.documentElement.style.setProperty("--warmth", warmth.toFixed(3));
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
