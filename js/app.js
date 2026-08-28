import { MAX_GUESSES, applyGuess, createState } from "./game.js";
import { createHeatLookup, heatLabel } from "./heat.js";
import {
  dayIndex,
  daysBetween,
  pacificDateString,
  puzzleNumber,
} from "./calendar.js";
import { shareText } from "./share.js";

const STORAGE_KEY = "drift-v2";
const HOWTO_KEY = "drift-howto-v1";

const $ = (id) => document.getElementById(id);

function defaultStore() {
  return {
    streak: 0,
    maxStreak: 0,
    plays: 0,
    wins: 0,
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function recordResult(store, date, won) {
  const already = store.lastPlayDate === date;
  if (already) return store;
  const plays = (store.plays || 0) + 1;
  const wins = (store.wins || 0) + (won ? 1 : 0);
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
  return {
    ...store,
    plays,
    wins,
    streak,
    maxStreak,
    lastWinDate,
    lastPlayDate: date,
  };
}

function pipKind(heat) {
  return heat >= 45 ? "sun" : "wind";
}

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
    const label = heatLabel(g.heat);
    const found = g.word === state.today;
    const chipClass = g.trend === "hotter" || g.trend === "colder" ? g.trend : "still";
    const chipText = found
      ? "found"
      : g.trend === "hotter"
        ? "hotter"
        : g.trend === "colder"
          ? "colder"
          : g.trend === "still" || label === "ice" || label === "cold"
            ? "still cold"
            : "holding";
    row.classList.add("heat-" + label);
    row.innerHTML = `
      <span class="word">${escapeHtml(g.word)}</span>
      <span class="heat-chip ${chipClass}">
        <span class="pip ${pipKind(g.heat)}" aria-hidden="true"></span>
        <span class="chip-label">${chipText}</span>
      </span>
      <span class="heat-num">${g.heat}</span>
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

function renderEnd(state, puzNum, store) {
  const panel = $("end");
  panel.hidden = false;
  $("share-text").textContent = shareText({
    puzzleNumber: puzNum,
    guesses: state.guesses,
    won: state.won,
    maxGuesses: MAX_GUESSES,
  });
  $("end-title").textContent = state.won ? "You caught the kite" : "The kite got away";
  $("end-body").textContent = state.won
    ? `Today’s word in ${state.guesses.length} of ${MAX_GUESSES}.`
    : `Today’s word was ${state.today}. Tomorrow another step.`;
  $("form").hidden = true;
  renderStats(store);
}

function renderStats(store) {
  $("streak").textContent = String(store.streak || 0);
  $("max-streak").textContent = String(store.maxStreak || 0);
}

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

function openHowto() {
  const d = $("howto");
  if (typeof d.showModal === "function") d.showModal();
  else d.setAttribute("open", "");
}

function closeHowto() {
  const d = $("howto");
  if (typeof d.close === "function" && d.open) d.close();
  else d.removeAttribute("open");
  markHowtoSeen();
  const input = $("guess");
  if (input && !input.closest("form").hidden) input.focus();
}

function wireHowto() {
  $("howto-btn").addEventListener("click", openHowto);
  $("howto-close").addEventListener("click", closeHowto);
  $("howto-play").addEventListener("click", closeHowto);
  $("howto").addEventListener("close", markHowtoSeen);
  $("howto").addEventListener("click", (ev) => {
    if (ev.target === $("howto")) closeHowto();
  });
}

async function main() {
  wireHowto();

  const chainPack = await fetch("data/chain.json").then((r) => r.json());
  const words = await fetch("data/words.json").then((r) => r.json());
  const heatBuf = await fetch("data/heat.bin").then((r) => r.arrayBuffer());
  const lookup = createHeatLookup(words, heatBuf);
  const chain = chainPack.words;

  const now = new Date();
  const todayDate = pacificDateString(now);
  const idx = dayIndex(now, chain.length, chainPack.epoch);
  const puzNum = puzzleNumber(now, chainPack.epoch);
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
  renderStats(store);

  if (state.won || state.lost) {
    renderEnd(state, puzNum, store);
    setStatus(state.won ? "Already caught today’s kite." : "Come back after midnight Pacific.");
  }

  $("form").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const input = $("guess");
    const raw = input.value;
    const result = applyGuess(state, raw, lookup);
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
      today: {
        date: todayDate,
        guesses: state.guesses,
        won: state.won,
        lost: state.lost,
      },
    };
    if (state.won || state.lost) {
      store = recordResult(store, todayDate, state.won);
    }
    saveStore(store);
    renderGuesses(state);
    renderStats(store);
    input.value = "";
    input.focus();
    if (state.won) {
      setStatus(`You caught it — ${state.today}.`, "good");
      renderEnd(state, puzNum, store);
    } else if (state.lost) {
      setStatus("Six guesses. The kite got away.", "bad");
      renderEnd(state, puzNum, store);
    } else {
      const warmth = heatLabel(result.heat);
      if (result.trend === "hotter") setStatus(`Hotter. ${warmth}.`);
      else if (result.trend === "colder") setStatus(`Colder. ${warmth}.`);
      else if (result.trend === "still") setStatus("Still cold.");
      else setStatus(`Same heat. ${warmth}.`);
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

  if (!howtoSeen()) openHowto();
  else if (!(state.won || state.lost)) $("guess").focus();
}

main().catch((err) => {
  console.error(err);
  setStatus("Could not load today’s puzzle files.", "bad");
});
