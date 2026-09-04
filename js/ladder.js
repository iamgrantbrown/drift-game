import {
  RUNGS,
  STRIDE,
  createLadder,
  createPairIndex,
  hintStage,
  hintText,
  ladderShareText,
  linkClue,
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
import { voiceLine } from "./voice.js";

const STORAGE_KEY = "ladder-v1";
const HOWTO_KEY = "ladder-howto-v1";
const SHARE_URL = "https://iamgrantbrown.github.io/drift-game/ladder.html";

const $ = (id) => document.getElementById(id);

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);
}

/** One saved ladder per date, so previewing another day never wipes today's. */
function storageKey(date) {
  return `${STORAGE_KEY}:${date}`;
}

function loadStore(date) {
  try {
    const own = JSON.parse(localStorage.getItem(storageKey(date)));
    if (own) return own;
    // an older save kept only one ladder under the bare key
    const legacy = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return legacy && legacy.date === date ? legacy : {};
  } catch {
    return {};
  }
}

function saveStore(date, store) {
  try {
    localStorage.setItem(storageKey(date), JSON.stringify(store));
  } catch {
    /* private mode: play without persistence */
  }
}

function setStatus(msg, kind = "") {
  const el = $("status");
  el.textContent = msg || "";
  el.className = "status " + kind;
}

/* ---------- the voice of the ladder ---------- */

const LOCK_LINES = ["that holds.", "locked in.", "both sides hold."];

function missLine(result, word, phraseAbove, phraseBelow, aboveKnown, belowKnown) {
  const W = word.toUpperCase();
  if (result === "above") {
    const tail = belowKnown ? "but it doesn’t join the word below." : "but nothing joins it to the rung below.";
    return `${W} makes ${phraseAbove}, ${tail}`;
  }
  if (result === "below") {
    const tail = aboveKnown ? "but it doesn’t join the word above." : "but nothing joins it to the rung above.";
    return `${W} makes ${phraseBelow}, ${tail}`;
  }
  return `${W} doesn’t join either side.`;
}

function endLine(tries) {
  if (tries <= RUNGS) return "Clean climb. Not one slip.";
  if (tries <= RUNGS + 3) return "A few slips, still a climb.";
  return "You got there. Every rung holds.";
}

/* ---------- rendering ---------- */

function triesText(n) {
  if (!n) return "";
  return n === 1 ? "1 try" : `${n} tries`;
}

/** The ladder stands on the ground. The start word is the bottom bar, the
 *  goal word is the top bar, and you climb: rung 1 is the lowest. A missing
 *  rung is a dashed outline until its word locks it solid. Between rungs
 *  hangs the phrase, or the clue written on the side the missing word
 *  belongs. Misses stay struck under their rung for the whole climb.
 *  `justLocked` is the rung that locked on this render, the only one that
 *  animates. */
function renderLadder(state, index, justLocked = -1) {
  const root = $("ladder");
  // keep whatever is half-typed in the other rungs
  const drafts = {};
  root.querySelectorAll(".rung-input").forEach((el) => {
    if (el.value) drafts[el.dataset.rung] = el.value;
  });
  root.innerHTML = "";

  const el = (className, html) => {
    const node = document.createElement("div");
    node.className = className;
    node.innerHTML = html;
    return node;
  };

  const endRung = (label, word) =>
    el(
      "rung rung-end",
      `<span class="rung-word">${escapeHtml(word)}</span><span class="rung-side">${label}</span>`,
    );

  const link = (j) => {
    const clue = linkClue(state, j, index);
    const fresh = justLocked >= 0 && (j === justLocked || j === justLocked + 1);
    const node = el(
      `link link-${clue.kind}${fresh ? " just-joined" : ""}`,
      clue.kind === "none" ? "" : `<span class="link-text">${escapeHtml(clue.text)}</span>`,
    );
    node.setAttribute(
      "aria-label",
      clue.kind === "phrase" ? `joined: ${clue.text}` : clue.kind === "blank" ? `clue: ${clue.text}` : "not joined yet",
    );
    return node;
  };

  const notes = (i, rung) => {
    const misses = rung.misses
      .map((m) => {
        const note = m.side === "above" ? "joins above" : m.side === "below" ? "joins below" : "";
        return `<span class="miss${note ? " joins" : ""}"><s>${escapeHtml(m.word)}</s>${note ? `<small>${note}</small>` : ""}</span>`;
      })
      .join("");
    const clue = rung.word ? "" : hintText(state, i);
    const hintBtn = !rung.word && rung.hints < hintStage(rung)
      ? `<button type="button" class="rung-hint" data-rung="${i}">${rung.hints ? "another hint" : "a hint?"}</button>`
      : "";
    const html = `${misses}${clue ? `<span class="rung-clue">${clue}</span>` : ""}${hintBtn}`;
    return html ? el(`rung-notes${rung.word ? " rung-notes-locked" : ""}`, html) : null;
  };

  // column word 0 is the start (bottom bar), column word RUNGS + 1 the top
  root.appendChild(endRung("top", state.bottom));
  for (let i = RUNGS - 1; i >= 0; i--) {
    root.appendChild(link(i + 1));
    const rung = state.rungs[i];
    if (rung.word) {
      root.appendChild(
        el(
          `rung rung-locked${i === justLocked ? " just-locked" : ""}`,
          `<span class="rung-word">${escapeHtml(rung.word)}</span><span class="rung-side">${triesText(rung.tries)}</span>`,
        ),
      );
    } else {
      root.appendChild(
        el(
          "rung rung-open",
          `<form class="rung-form" data-rung="${i}" autocomplete="off">
            <input class="rung-input" data-rung="${i}" type="text" enterkeyhint="go" autocapitalize="none" autocomplete="off" spellcheck="false" maxlength="14" placeholder="rung ${i + 1}" aria-label="Rung ${i + 1}" value="${escapeHtml(drafts[i] || "")}" />
            <button type="submit">try</button>
          </form>
          <span class="rung-side">${triesText(rung.tries)}</span>`,
        ),
      );
    }
    const n = notes(i, rung);
    if (n) root.appendChild(n);
  }
  root.appendChild(link(0));
  root.appendChild(endRung("start", state.top));
}

/** The sky rises as you climb: 0 on the ground, 1 at the top. */
function renderClimb(state) {
  const locked = state.rungs.filter((r) => r.word).length;
  const climb = state.solved ? 1 : locked / RUNGS;
  document.documentElement.style.setProperty("--climb", climb.toFixed(3));
  // the sky warms toward evening as you climb, but never goes full sunset
  document.documentElement.style.setProperty("--arrival", (climb * 0.55).toFixed(3));
}

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A missed word drops off the rung and lands in the notes below. */
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

/** Paper scraps from the top bar when the ladder is complete. */
function celebrate() {
  if (reducedMotion()) return;
  const top = document.querySelector(".rung-end");
  if (!top) return;
  const rect = top.getBoundingClientRect();
  const colors = ["#fffaf2", "#d07850", "#cfae80", "#e2b45a"];
  for (let i = 0; i < 16; i++) {
    const s = document.createElement("span");
    s.className = "scrap";
    const angle = Math.PI + (i / 16) * Math.PI + (Math.random() - 0.5) * 0.4;
    s.style.left = `${rect.left + rect.width * (0.2 + Math.random() * 0.6)}px`;
    s.style.top = `${rect.top + rect.height / 2}px`;
    s.style.background = colors[i % colors.length];
    s.style.setProperty("--dx", `${Math.cos(angle) * (40 + Math.random() * 120)}px`);
    s.style.setProperty("--dy", `${Math.sin(angle) * (60 + Math.random() * 80) - 40}px`);
    s.style.setProperty("--rot", `${(Math.random() * 520 - 260).toFixed(0)}deg`);
    s.addEventListener("animationend", () => s.remove());
    document.body.appendChild(s);
  }
}

function focusRung(preferred) {
  const inputs = [...document.querySelectorAll(".rung-input")];
  if (!inputs.length) return;
  const next = inputs.find((el) => Number(el.dataset.rung) >= preferred) || inputs[0];
  next.focus();
}

function renderEnd(state, puzNum) {
  const panel = $("end");
  panel.hidden = false;
  const tries = totalTries(state);
  $("end-title").textContent = "Ladder complete";
  $("end-body").textContent = `${endLine(tries)} ${triesText(tries)} in all.`;
  $("end-ladder").textContent = [state.top, ...state.rungs.map((r) => r.word), state.bottom].join(" · ");
  $("share-text").textContent = ladderShareText({ puzzleNumber: puzNum, state, url: SHARE_URL });
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
    el.textContent = `the next ladder goes up in ${h}:${m}:${s}`;
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
    focusRung(0);
  });
  $("howto").addEventListener("close", markHowto);

  const [chainPack, words, basePairs, pairOverrides] = await Promise.all([
    fetch("data/chain.json").then((r) => r.json()),
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
  const cycle = Math.floor(chain.length / STRIDE);

  let state = createLadder(chain, ((k % cycle) + cycle) % cycle);
  // a saved ladder only counts if it is this ladder (same ends), so a
  // reshuffled chain never restores yesterday's words into today's rungs
  const ladderKey = `${state.top}|${state.bottom}`;
  let store = loadStore(todayDate);
  const persist = () => {
    store = { date: todayDate, ladder: ladderKey, rungs: state.rungs, solved: state.solved };
    saveStore(todayDate, store);
  };
  if (
    store.date === todayDate &&
    store.ladder === ladderKey &&
    Array.isArray(store.rungs) &&
    store.rungs.length === RUNGS
  ) {
    state = { ...state, rungs: store.rungs, solved: !!store.solved };
  } else {
    persist();
  }

  $("puzzle-num").textContent = `#${puzNum}`;
  renderLadder(state, index);
  renderClimb(state);
  if (state.solved) renderEnd(state, puzNum);

  const ladder = $("ladder");
  ladder.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const form = ev.target.closest(".rung-form");
    if (!form) return;
    const i = Number(form.dataset.rung);
    const input = form.querySelector(".rung-input");
    const r = tryRung(state, i, input.value, dict, index);
    if (!r.ok) {
      if (r.reason === "invalid") setStatus(voiceLine("invalid", puzNum + i), "bad");
      else if (r.reason === "duplicate") setStatus("already tried on this rung.", "bad");
      input.classList.remove("shake");
      void input.offsetWidth;
      input.classList.add("shake");
      input.select();
      return;
    }
    state = r.state;
    persist();
    if (r.result !== "lock") dropMiss(input, r.word);
    input.value = "";
    renderLadder(state, index, r.result === "lock" ? i : -1);
    renderClimb(state);
    if (state.solved) {
      setStatus("");
      renderEnd(state, puzNum);
      celebrate();
      return;
    }
    if (r.result === "lock") {
      setStatus(LOCK_LINES[(puzNum + totalTries(state)) % LOCK_LINES.length], "good");
      focusRung(i + 1);
    } else {
      const aboveKnown = i === 0 || !!state.rungs[i - 1].word;
      const belowKnown = i === RUNGS - 1 || !!state.rungs[i + 1].word;
      setStatus(missLine(r.result, r.word, r.phraseAbove, r.phraseBelow, aboveKnown, belowKnown), "nudge");
      focusRung(i);
    }
  });

  ladder.addEventListener("click", (ev) => {
    const btn = ev.target.closest(".rung-hint");
    if (!btn) return;
    const i = Number(btn.dataset.rung);
    const r = useRungHint(state, i);
    if (!r.ok) return;
    state = r.state;
    persist();
    renderLadder(state, index);
    focusRung(i);
  });

  $("share-btn").addEventListener("click", async () => {
    const text = $("share-text").textContent;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        setStatus("Share card copied. The rungs stay secret.", "good");
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

  let seen = false;
  try {
    seen = localStorage.getItem(HOWTO_KEY) === "1";
  } catch {
    /* ignore */
  }
  if (!seen) howto.open();
  else if (!state.solved) focusRung(0);
}

main().catch((err) => {
  console.error(err);
  setStatus("Could not load today’s ladder.", "bad");
});
