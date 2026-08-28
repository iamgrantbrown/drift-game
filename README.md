# Drift

A tiny daily word game. Yesterday's secret is shown. Today's secret is one
meaning-step away — often through another meaning of the word.

Play: https://iamgrantbrown.github.io/drift-game/

If yesterday was **record** and today is **player**, the step is *a record
player*. Six guesses; every guess shows how close its meaning is:
ice · cold · cool · warm · hot · scorching.

## Play

Open https://iamgrantbrown.github.io/drift-game/

Or serve locally (the app loads `data/` over HTTP):

    python3 -m http.server 8080

Then open http://localhost:8080/

- Six guesses at today's word. One puzzle per day, rolling at midnight
  Pacific (America/Los_Angeles); everyone gets the same word.
- Every guess shows its heat band (meaning-closeness, never spelling),
  plus a hotter/colder arrow when the band moved against your last guess.
- Unknown words are rejected; inflections of known words are accepted and
  count as their base word (guessing "strings" catches "string").
- After three all-cold guesses, a one-time nudge reminds you the drift
  moves by meaning — yesterday's word usually has more than one.
- Win or lose, the end card reveals the pivot ("record → player — a record
  player") and counts down to the next puzzle.
- Streak and stats live in the browser on your device. No accounts, ads,
  or payments.
- The share card shows puzzle number, guess count, and band bars. It never
  names the word.

## Daily seeding

Pacific calendar date to days since 2026-01-01 (see `data/chain.json`):

    dayIndex  = days_since_epoch % 366
    today     = chain[dayIndex].w
    yesterday = chain[dayIndex - 1].w

The chain is 366 curated words, no repeats, and wraps at the year mark.
Each entry carries the pivot phrase that links it to the previous word.
Puzzle 1 is 1 January 2026 Pacific.

## Heat data

Heat 0–100 is semantic relatedness rank, baked at build time — the game
itself is static and calls no APIs.

- `data/words.json` — the 20k-word guess dictionary.
- `data/heat/NNN.bin` — one Uint8 row per day (`NNN` = day index); the app
  fetches only today's ~20KB file.
- Built by `scripts/build_heat_v2.mjs` from Datamuse means-like lists
  (~1000 ranked neighbors per secret), triggers, syn/spc/gen relations,
  a 2-hop expansion through each secret's closest neighbors, and the
  curated seeds in `scripts/related_seeds.json` / `scripts/boosts.txt`.
  Around a thousand words per day carry real gradient; everything else is
  flat ice. Yesterday's word is pinned hot (≥76).

## Rebuild

    node scripts/chain_v2.mjs        # validate + write data/chain.json
    node scripts/build_heat_v2.mjs   # fetch (cached) + bake words + heat
    node tests/run.mjs

Datamuse is queried only at build time, with a resumable disk cache in
`scripts/datamuse_v2/` (gitignored).

## Tests

Run: `node tests/run.mjs`

Covers calendar math, chain integrity (366 unique words, pivots, the
preserved v1 opening), band thresholds and trend fixtures, inflection
resolution (including inflections of the secret winning), dense-signal
spot checks on the baked heat files, game flow (win/lose/duplicate/nudge),
and the share card.
