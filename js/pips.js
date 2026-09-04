/* Pips: word dominoes. The rules live in ladder-game.js (a chain, a
 * two-sided fit); this file is the table, the column, and the voice.
 * The column reads downward: every tile and the one below it make a word
 * or phrase, so the tiles stack and touch. */
import {
  RUNGS,
  STRIDE,
  columnWord,
  createLadder,
  createPairIndex,
  hintStage,
  hintText,
  linkClue,
  totalHints,
  totalTries,
  tryRung,
  useRungHint,
} from "./ladder-game.js";
import {
  daysBetween,
  millisecondsUntilNextPacificMidnight,
  pacificDateString,
  puzzleNumber,
} from "./calendar.js";

const TILES = RUNGS + 2;
const STORAGE_KEY = "pips-v1";
const HOWTO_KEY = "pips-howto-v1";
const SHARE_URL = "https://iamgrantbrown.github.io/drift-game/pips.html";
const TITLE = "Line";

const $ = (id) => document.getElementById(id);
const up = (w) => w.toUpperCase();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
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

/* ---------- saves: one per date ---------- */

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

/* ---------- the voice: plain, and it names the words ---------- */

function missLine(r, state, i) {
  const W = up(r.word);
  const above = columnWord(state, i);
  const below = columnWord(state, i + 2);
  if (r.result === "above") {
    const other = below ? `with ${up(below)}` : "with the tile below it";
    return `${W} makes ${r.phraseAbove}, but ${W} doesn’t go ${other}.`;
  }
  if (r.result === "below") {
    const other = above ? `with ${up(above)}` : "with the tile above it";
    return `${W} makes ${r.phraseBelow}, but ${W} doesn’t go ${other}.`;
  }
  const a = above ? up(above) : "the tile above";
  const b = below ? up(below) : "the tile below";
  return `${W} doesn’t go with ${a} or ${b}.`;
}

function fitLine(r) {
  const both = [r.phraseAbove, r.phraseBelow].filter(Boolean);
  return `${up(r.word)} fits. ${both.join(", ")}.`;
}

function doneLine(tries) {
  if (tries <= RUNGS) return "Four tiles, four tries. Not one wasted.";
  if (tries <= RUNGS + 3) return "A couple of misses. Clean line.";
  return "Plenty of misses, but the line is down.";
}

/* ---------- the tries mark ---------- */

function triesMark(n) {
  if (!n) return `<span class="mark" aria-label="no tries yet"></span>`;
  return `<span class="mark" aria-label="${n} ${n === 1 ? "try" : "tries"}"><b>${n}</b></span>`;
}

/* ---------- the column ---------- */

/** The phrase two touching tiles make, when it is one word: worth a whisper. */
function whisperFor(state, index, j) {
  const clue = linkClue(state, j, index);
  if (clue.kind !== "phrase") return "";
  return clue.text.includes(" ") ? "" : clue.text;
}

function renderLine(state, index, justPlaced = -1) {
  const root = $("line");
  const drafts = {};
  root.querySelectorAll(".gap-input").forEach((el) => {
    if (el.value) drafts[el.dataset.gap] = el.value;
  });
  root.innerHTML = "";

  const el = (className, html) => {
    const node = document.createElement("div");
    node.className = className;
    node.innerHTML = html;
    return node;
  };
  const tongue = (k) => (k < TILES - 1 ? '<span class="tongue" aria-hidden="true"></span>' : "");
  const whisper = (k) => {
    const w = k < TILES - 1 ? whisperFor(state, index, k) : "";
    return w ? `<span class="whisper" aria-label="spelled ${escapeHtml(w)}">${escapeHtml(w)}</span>` : "";
  };

  const given = (word, k) => {
    const node = el(
      `tile tile-down given${k === 0 ? " first" : " last"}`,
      `<span class="tile-word">${escapeHtml(word)}</span><span class="mark" aria-label="given"></span>${tongue(k)}${whisper(k)}`,
    );
    node.style.setProperty("--i", k);
    return node;
  };

  root.appendChild(given(state.top, 0));
  for (let i = 0; i < RUNGS; i++) {
    const rung = state.rungs[i];
    const k = i + 1;
    let node;
    if (rung.word) {
      node = el(
        `tile tile-down${i === justPlaced ? " just-placed" : ""}`,
        `<span class="tile-word">${escapeHtml(rung.word)}</span>${triesMark(rung.tries)}${tongue(k)}${whisper(k)}`,
      );
    } else {
      node = el(
        "tile tile-gap",
        `<form class="gap-form" data-gap="${i}" autocomplete="off">
          <input class="gap-input" data-gap="${i}" type="text" enterkeyhint="go" autocapitalize="none" autocomplete="off" spellcheck="false" maxlength="14" placeholder="tile ${k + 1}" aria-label="Tile ${k + 1}" value="${escapeHtml(drafts[i] || "")}" />
          <button type="submit">place</button>
        </form>${triesMark(rung.tries)}`,
      );
    }
    node.style.setProperty("--i", k);
    root.appendChild(node);
  }
  root.appendChild(given(state.bottom, TILES - 1));
}

/** The misses for the gap you're on. */
function renderYard(state, gap) {
  const yard = $("yard");
  const rung = state.rungs[gap];
  if (state.solved || !rung || rung.word) {
    yard.innerHTML = "";
    return;
  }
  const bones = rung.misses
    .map((m) => `<span class="bone"><s>${escapeHtml(m.word)}</s>${m.made ? `<small>${escapeHtml(m.made)}</small>` : ""}</span>`)
    .join("");
  const letters = hintText(state, gap);
  const hint =
    rung.hints < hintStage(rung)
      ? `<button type="button" class="hint-btn" data-gap="${gap}">${rung.hints === 0 ? "show how many letters" : "show the first letter"}</button>`
      : "";
  const body = `${bones}${letters ? `<span class="letters">${letters}</span>` : ""}${hint}`;
  yard.innerHTML = body ? `<span class="yard-label">misses, tile ${gap + 2}</span>${body}` : "";
}

function focusGap(preferred) {
  const inputs = [...document.querySelectorAll(".gap-input")];
  if (!inputs.length) return null;
  const next = inputs.find((el) => Number(el.dataset.gap) >= preferred) || inputs[0];
  next.focus({ preventScroll: false });
  return Number(next.dataset.gap);
}

function dropMiss(input, word) {
  if (reducedMotion()) return;
  const rect = input.getBoundingClientRect();
  const ghost = document.createElement("span");
  ghost.className = "falling";
  ghost.textContent = word;
  ghost.style.left = `${rect.left}px`;
  ghost.style.top = `${rect.top}px`;
  ghost.addEventListener("animationend", () => ghost.remove());
  document.body.appendChild(ghost);
}

/* ---------- the win: seat, then read ---------- */

async function finish(state, index) {
  const line = $("line");
  if (reducedMotion()) {
    line.classList.add("seated");
    return;
  }
  // 1. the seat: each tongue clicks home, top to bottom
  line.classList.add("seating");
  await wait(150 * (TILES - 1) + 300);
  line.classList.remove("seating");
  line.classList.add("seated");
  // 2. the read: a light pauses at each pair, and the phrase appears at the seam
  const tiles = [...line.querySelectorAll(".tile")];
  for (let j = 0; j < TILES - 1; j++) {
    const clue = linkClue(state, j, index);
    const a = tiles[j];
    const b = tiles[j + 1];
    a.classList.add("reading");
    b.classList.add("reading");
    let chip = null;
    if (clue.kind === "phrase") {
      chip = document.createElement("span");
      chip.className = "read-chip";
      chip.textContent = clue.text;
      chip.style.top = `${b.offsetTop}px`;
      line.appendChild(chip);
    }
    await wait(420);
    a.classList.remove("reading");
    b.classList.remove("reading");
    if (chip) chip.remove();
  }
  await wait(250);
}

function shareText(state, puzNum) {
  const tries = totalTries(state);
  const hints = totalHints(state);
  const glyph = (r) => (r.tries <= 1 ? "🟩" : r.tries <= 3 ? "🟨" : r.tries <= 6 ? "🟧" : "🟥");
  const line = `${state.top} ${state.rungs.map(glyph).join("")} ${state.bottom}`;
  const score = `${tries} ${tries === 1 ? "try" : "tries"}${hints ? `, ${hints} ${hints === 1 ? "hint" : "hints"}` : ""}`;
  return `${TITLE} #${puzNum}\n${line}\n${score}\n${SHARE_URL}`;
}

function renderEnd(state, puzNum) {
  const panel = $("end");
  panel.hidden = false;
  const tries = totalTries(state);
  $("end-title").textContent = "It reads.";
  $("end-body").textContent = `${doneLine(tries)} ${tries} tries in all.`;
  $("end-line").textContent = [state.top, ...state.rungs.map((r) => r.word), state.bottom].join(" · ");
  $("share-text").textContent = shareText(state, puzNum);
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
    el.textContent = `new tiles in ${h}:${m}:${s}`;
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

/* ---------- main ---------- */

async function main() {
  let state = null;
  let activeGap = 0;

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
    if (!state) return;
    activeGap = focusGap(0) ?? activeGap;
    renderYard(state, activeGap);
  });
  $("howto").addEventListener("close", markHowto);

  // lines.json: every link reads first tile then second
  const [chainPack, words, basePairs, pairOverrides] = await Promise.all([
    fetch("data/lines.json").then((r) => r.json()),
    fetch("data/words.json").then((r) => r.json()),
    fetch("data/pairs.json").then((r) => r.json()).catch(() => []),
    fetch("data/pair-overrides.json").then((r) => r.json()).catch(() => []),
  ]);
  const chain = chainPack.words;
  const index = createPairIndex([...basePairs, ...pairOverrides], chain);
  const dict = new Set(words);

  const dateParam = new URLSearchParams(location.search).get("date");
  const todayDate = /^\d{4}-\d{2}-\d{2}$/.test(dateParam || "") ? dateParam : pacificDateString(new Date());
  const k = daysBetween(chainPack.epoch, todayDate);
  const puzNum = puzzleNumber(todayDate, chainPack.epoch);
  // the forward chain is a path, not a cycle: windows never wrap past its end
  const cycle = Math.floor((chain.length - 1) / STRIDE);

  state = createLadder(chain, ((k % cycle) + cycle) % cycle);
  const lineKey = `${state.top}|${state.bottom}`;
  let store = loadStore(todayDate);
  const persist = () => {
    store = { date: todayDate, line: lineKey, rungs: state.rungs, solved: state.solved };
    saveStore(todayDate, store);
  };
  if (store.line === lineKey && Array.isArray(store.rungs) && store.rungs.length === RUNGS) {
    state = { ...state, rungs: store.rungs, solved: !!store.solved };
  } else {
    persist();
  }

  activeGap = Math.max(0, state.rungs.findIndex((r) => !r.word));

  $("puzzle-num").textContent = `#${puzNum}`;
  renderLine(state, index);
  renderYard(state, activeGap);
  if (state.solved) {
    $("line").classList.add("seated");
    renderEnd(state, puzNum);
  }

  const line = $("line");
  line.addEventListener("focusin", (ev) => {
    const input = ev.target.closest(".gap-input");
    if (!input) return;
    activeGap = Number(input.dataset.gap);
    renderYard(state, activeGap);
  });

  line.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const form = ev.target.closest(".gap-form");
    if (!form) return;
    const i = Number(form.dataset.gap);
    const input = form.querySelector(".gap-input");
    const r = tryRung(state, i, input.value, dict, index);
    if (!r.ok) {
      if (r.reason === "invalid") setStatus("Not a word this game knows.", "no");
      else if (r.reason === "duplicate") setStatus(`${up(input.value.trim())} has already been tried on this tile.`, "no");
      input.classList.remove("refuse");
      void input.offsetWidth;
      input.classList.add("refuse");
      input.select();
      return;
    }
    if (r.result !== "lock") {
      // remember what the miss did make, so the boneyard can show it
      const made = r.phraseAbove || r.phraseBelow || "";
      const rungs = r.state.rungs.map((rg, j) =>
        j === i ? { ...rg, misses: rg.misses.map((m, n) => (n === rg.misses.length - 1 ? { ...m, made } : m)) } : rg,
      );
      state = { ...r.state, rungs };
      dropMiss(input, r.word);
    } else {
      state = r.state;
    }
    persist();
    input.value = "";
    renderLine(state, index, r.result === "lock" ? i : -1);
    if (state.solved) {
      setStatus("");
      renderYard(state, activeGap);
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      finish(state, index).then(() => renderEnd(state, puzNum));
      return;
    }
    if (r.result === "lock") {
      setStatus(fitLine(r), "yes");
      activeGap = focusGap(i + 1) ?? activeGap;
    } else {
      setStatus(missLine(r, state, i), "no");
      activeGap = focusGap(i) ?? i;
    }
    renderYard(state, activeGap);
  });

  $("yard").addEventListener("click", (ev) => {
    const btn = ev.target.closest(".hint-btn");
    if (!btn) return;
    const i = Number(btn.dataset.gap);
    const r = useRungHint(state, i);
    if (!r.ok) return;
    state = r.state;
    persist();
    renderYard(state, i);
    focusGap(i);
  });

  $("share-btn").addEventListener("click", async () => {
    const text = $("share-text").textContent;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        setStatus("Copied. The missing tiles stay secret.", "yes");
      }
    } catch {
      try {
        await navigator.clipboard.writeText(text);
        setStatus("Copied.", "yes");
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
  else if (!state.solved) {
    activeGap = focusGap(activeGap) ?? activeGap;
    renderYard(state, activeGap);
  }
}

main().catch((err) => {
  console.error(err);
  setStatus("Couldn’t load today’s tiles.", "no");
});
