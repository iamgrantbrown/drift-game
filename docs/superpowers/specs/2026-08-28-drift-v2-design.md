# Drift v2 design

Date: 2026-08-28
Status: historical design record. The production rules and data contract are
documented in `README.md`; later trust work replaced temperature language with
kite distance, separated pair validity from semantic scoring, and retained the
reviewed 340-puzzle calendar rather than the draft 366-word sequence below.

Drift stays what it is — a tiny static daily word game, no accounts, no
backend, no build step at play time — and fixes the one thing that breaks it
(feedback gives no signal) while promoting the one thing that makes it
special (the sense pivot) to the star of the game.

## Diagnosis of v1

- 99.6% of the dictionary shares one flat "ice" score per secret (~30 words
  carry any gradient). Hotter/colder against the previous guess on a flat
  landscape returns nothing; a typical run burns half its guesses on
  "still cold".
- The winning strategy — enumerate the *senses* of yesterday's word — is
  never taught, never rewarded by feedback, and never celebrated on win.
- The chain is 72 words, loops every 72 days, and has no authored payoff.
- The heat *band* exists in data but is hidden in the UI (subtle row tint).
- The "today" tile never fills, even on a win. Stats only appear at game end.

## Decisions (locked with Grant)

1. **Guess economy: 6 guesses, rich feedback.** Wordle-like scarcity stays.
   Every guess shows its explicit heat band; trend arrows compare with the
   previous guess. No unlimited-guess mode.
2. **Visual identity: evolve the paper-kite look.** No rebrand. Paper, sky,
   kite; the kite becomes a live progress element.

## The game (v2 rules, unchanged where not noted)

- One puzzle per day, rolling at midnight Pacific. Everyone gets the same
  word. Puzzle N = days since 2026-01-01 + 1.
- Yesterday's word is shown. Today's secret is one meaning-step away.
- Six guesses. Unknown words rejected; unknown *inflections* of known words
  (strings → string) are accepted and normalized.
- Each guess returns a **band**: ice · cold · cool · warm · hot · scorching
  (rendered as a colored chip with the band name) plus a trend arrow
  (hotter/colder) vs the previous guess when the change is notable.
- After 3 guesses that all land ice/cold, a one-time nudge appears:
  *"drift moves by meaning — yesterday's word has more than one."*
- Win: the today tile is stamped with the word, the pivot line is revealed
  ("string → guitar — a guitar string"), the kite sails off.
- Loss: the word and pivot are revealed — the pivot teaches the trick.

## Data engine (build-time only; play stays static/offline)

- **Chain: 366 words**, no repeats, wrapping (word[365] → word[0] is a valid
  step). Positions 0–71 keep the v1 chain. Every entry carries a `pivot`
  phrase describing the step from the previous word. `chain.json` schema:
  `{ epoch, timezone, words: [{ w, pivot }] }`.
- **Dense heat.** `scripts/` gains a cached Datamuse fetcher (the API the
  repo already uses at build time) and a builder:
  - per secret: `ml` (ranked ~1000), `rel_trg`, curated seeds/boosts kept
    from v1;
  - 2-hop expansion through the top ~15 neighbors (globally cached);
  - direct rank → heat 35–97 (power curve), 2-hop-only words → 15–34,
    everything else → ice (4). Secret = 100. Yesterday's word pinned ≥ 76.
- **Per-day heat files.** `data/heat/NNN.bin` (one Uint8 row per day,
  nWords bytes, ~15 KB); the app fetches only today's file. `heat.bin`
  (secret-major full table) is removed.
- **Dictionary** grows organically: union of v1 words + every fetched
  neighbor (filtered `^[a-z]+$`) + chain words. No external corpus
  downloads.

## Feedback model

- `heatLabel` bands unchanged (thresholds 15/30/45/60/75/90/100); the UI
  merges "lukewarm" into "warm" for display (7 internal, 6 shown).
- Trend: hotter/colder when the band changes or |Δ| ≥ 10; otherwise the
  band chip alone carries the information (no more "still cold" rows —
  the band **is** the row).
- First guess trends against yesterday's word's heat, as v1.

## Look and feel

- Paper texture on tiles and cards; Fraunces/Nunito stay.
- **Sky responds to progress**: a CSS custom property (best heat so far,
  0–1) drives the background gradient from pale morning blue toward warm
  golden light. Discrete steps per band, transitioned.
- **The kite flies**: the kite mark becomes a positioned element that
  climbs with the best band reached, bobbing gently; on win it sails off
  the top of the page. Pure CSS/SVG + a JS-set custom property.
- Band chips: thermometer palette from icy blue through gold to ember.
- Win stamp: today-tile fills with the word via a stamp/settle animation.

## Meta & virality

- Stats dialog (streak, best, win %, guess distribution) reachable from
  the header at any time. Store schema migrates in place (same key).
- End card: countdown to the next puzzle; "tomorrow drifts from ⟨today's
  word⟩" (private to the player, never in the share text).
- Share card: `Drift #N 🪁`, result line, six band emoji
  (🟦 ice/cold · 🟨 cool/warm · 🟧 hot/scorching · 🟩 found), site link.
  Never names the word.

## Testing

`node tests/run.mjs` (no framework) covers: calendar math; chain integrity
(366 unique words, all pivots present, wrap step valid); band mapping and
trend fixtures; inflection normalization; share text; heat-file shape
(spot-check rows: secret = 100, yesterday ≥ 76, gradient present — at
least 500 words above ice for sampled days). Browser behavior verified by
hand per repo convention.

## Out of scope

Accounts, backend, leaderboards, paid features, past-puzzle archive,
hard mode. Deploy stays GitHub Pages (no pipeline change).

## Known launch discontinuity

Re-indexing the chain to 366 changes the mapping of date → word once at
deploy; the "yesterday" shown on launch day won't match what players
actually solved the day before. Accepted as a one-time cost.

## Addendum (same day): v2.1 — the human-fairness patch

Playtesting (fence → neighbor) showed v2's feedback punished the exact
strategy the game asks for: words hot against yesterday's word (wall 95,
gate 89, wire 80 vs fence) scored ice against the secret. Two changes:

1. **Near yesterday.** A guess under 30 vs today but ≥60 vs yesterday's
   word (both rows now load, ~20KB each) shows a "near yesterday" tag
   instead of ice: right anchor, wrong branch. Wrong-but-reasonable
   guesses eliminate branches instead of reading as noise.
2. **The clue.** After three misses the pivot phrase appears with the
   secret blanked ("a fence between ______"), replacing the old nudge.
   Guesses 1–2 are the expert game; 3–6 are a fair riddle.

Also: British/American spelling bridges win ("neighbours" → neighbor);
two pivots reworded so every day's pivot blanks cleanly.

## Addendum 2 (same day): v3 — the lexical-unit chain

Playtesting judgment (Grant): free-phrase links ("race to the finish")
feel arbitrary — "what kind of human is going to get this?" The fix is a
hard editorial rule: **every chain link must be a lexical unit** — a
closed compound (racetrack, tracksuit) or a dictionary-tight two-word
collocation (coffee bean, record player). This makes every answer
objectively verifiable, sharpens the clue to "race____", and reinvents a
beloved old-school format (compound word chains) as a daily.

Implementation: `scripts/compounds.mjs` holds ~2,900 hand-curated valid
pairs over ~1,600 words; a 2-core prune plus greedy DFS with Pósa
rotations finds the longest cycle (currently 340 words, starting at
coffee). The pivot field is the unit itself. Structural tests enforce
that every pivot contains both adjacent words. Chain length is now
dynamic (the game wraps at chain.length). Extending the game is a data
edit: add pairs, re-run the solver.
