import { MAX_GUESSES, applyGuess, createState } from "./game.js";
import { createHeatLookup, heatLabel } from "./heat.js";
import {
  dayIndex,
  daysBetween,
  pacificDateString,
  puzzleNumber,
} from "./calendar.js";
import { shareText } from "./share.js";

const STORAGE_KEY = "drift-v1";

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

function renderGuesses(state) {
  const root = $("guesses");
  root.innerHTML = "";
  for (let i = 0; i < MAX_GUESSES; i++) {
    const g = state.guesses[i];
    const row = document.createElement("div");
    row.className = "guess-row" + (g ? " filled" : " empty");
    if (!g) {
      row.innerHTML = `<span class="slot">${i + 1}</span><span class="ghost">waiting</span>`;
      root.appendChild(row);
      continue;
    }
    const trend =
      g.trend === "hotter" ? "hotter" : g.trend === "colder" ? "colder" : "holding";
    const pct = Math.max(2, Math.min(100, g.heat));
    row.innerHTML = `
      <span class="word">${escapeHtml(g.word)}</span>
      <span class="meter" aria-hidden="true"><span class="fill heat-${heatLabel(g.heat)}" style="width:${pct}%"></span></span>
      <span class="heat">${g.heat}</span>
      <span class="trend ${g.trend}">${g.word === state.today ? "found" : trend}</span>
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
  $("end-title").textContent = state.won ? "You caught the drift" : "It drifted away";
  $("end-body").textContent = state.won
    ? `Today's word in ${state.guesses.length} of ${MAX_GUESSES}. Streak ${store.streak}.`
    : `Today's word was ${state.today}. Streak resets. Tomorrow another step.`;
  $("form").hidden = true;
}

function renderStats(store) {
  $("streak").textContent = String(store.streak || 0);
  $("max-streak").textContent = String(store.maxStreak || 0);
}

async function main() {
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
  $("pacific-date").textContent = todayDate;
  renderGuesses(state);
  renderStats(store);

  const baseline = lookup.heat(state.yesterday, state.dayIndex);
  $("baseline").textContent = `Starting heat from yesterday: ${baseline}`;

  if (state.won || state.lost) {
    renderEnd(state, puzNum, store);
    setStatus(state.won ? "Already found today's word." : "Come back after midnight Pacific.", "muted");
  }

  $("form").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const input = $("guess");
    const raw = input.value;
    const result = applyGuess(state, raw, lookup);
    if (!result.ok) {
      if (result.reason === "invalid") setStatus("Unknown word — try a common English word.", "bad");
      else if (result.reason === "duplicate") setStatus("Already guessed.", "bad");
      else setStatus("Today's drift is over.", "muted");
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
      setStatus(`Hot enough. ${state.today}.`, "good");
      renderEnd(state, puzNum, store);
    } else if (state.lost) {
      setStatus("Six guesses. The current slips away.", "bad");
      renderEnd(state, puzNum, store);
    } else {
      const t = result.trend === "hotter" ? "Hotter." : result.trend === "colder" ? "Colder." : "Same heat.";
      setStatus(`${t} Heat ${result.heat} — ${heatLabel(result.heat)}.`);
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
        setStatus("Copy the card by hand.", "muted");
      }
    }
  });

  $("guess").focus();
}

main().catch((err) => {
  console.error(err);
  setStatus("Could not load today's puzzle files.", "bad");
});
