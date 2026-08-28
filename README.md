# Drift

A tiny daily word game. Yesterday's secret is shown. Today's secret is one semantic step away.

Play: https://iamgrantbrown.github.io/drift-game/

Or locally: python3 -m http.server 8080

Yesterday's word is shown; today's is one meaning-step away. Six guesses, hotter or colder.

If yesterday was coffee and today is espresso, then tea is colder, mug is warmer, latte is hot.

## Play

Open https://iamgrantbrown.github.io/drift-game/

Or serve locally because the app loads data/heat.bin over HTTP:

    python3 -m http.server 8080

Then open http://localhost:8080/

- Six guesses at today's word.
- Unknown words are rejected (common English guess list).
- After each guess: hotter or colder versus your previous guess. The first guess is compared with yesterday's word.
- Heat 0-100 is semantic relatedness (rank in a baked neighbor list), never edit distance.
- One puzzle per day, rolling at midnight Pacific (America/Los_Angeles).
- Streak lives in the browser on your device. No accounts, ads, payments, or hint engine.
- The share card shows puzzle number, guess count, and heat bars. It does not name the word.

## Daily seeding

Pacific calendar date to days since 2026-01-01 (see data/chain.json epoch):

    dayIndex = days_since_epoch % chain_length
    today     = chain[dayIndex]
    yesterday = chain[(dayIndex - 1) % chain_length]
Everyone gets the same puzzle for a given Pacific date.
The chain has 72 curated common words and loops.
Puzzle 1 is 1 January 2026 Pacific.
Heat is precomputed in data/heat.bin from per-secret relatedness lists (curated neighbors plus a Datamuse expansion) using scripts/build_heat.py. Datamuse is queried only at build time; the game itself is static/offline.

## Rebuild heat
Datamuse is build-time only. The browser never calls it.

    bash scripts/fetch_datamuse.sh
    python3 scripts/build_heat.py
    node tests/run.mjs

Yesterday is pinned near 76. True neighbors rank scorching/hot; words outside the relatedness list stay ice/cold.

## Tests
Run: node tests/run.mjs
Covers day index, chain yesterday/today, hotter/colder fixtures (including string vs kite/car), win/lose, and invalid guesses.
