# Astra review: Links and Drift

Reviewed the local checkout on 4 September 2026. Links is the current homepage; Drift is the original game at `drift.html`.

## Recommendation

Develop Links as the main game. Finding your own route to a visible destination is a strong foundation: players can plan, recover, and explain their solution afterward. Preserve the golf setting, drawn course, concise phrase feedback, and paper scorecard. Put the next effort into fair rules, reliable feedback, and an easier first round.

The static architecture is appropriate. Separating the game rules, map, browser integration, and generated data is already useful. A framework migration or live AI judging service would not address the main problems found here.

## What I verified

- `npm test`: 64 passing tests, zero failures across Drift, Ladder, and Links.
- Played Links hole 247 through a dead end, a drop, and a completed five-stroke round. Navigating back restored the completed result correctly.
- Reproduced incorrect yardage on hole 1 through the browser.
- Inspected layouts at the default desktop size and a 390 × 844 browser viewport. This is responsive browser testing, not a physical phone or software-keyboard test.
- Played today's Drift puzzle to completion with one hint.
- Audited the local course data: 6,614 directed phrase connections and 800 scheduled holes.
- Inspected source for scoring, caddie behavior, persistence, daily selection, and word normalization.

No gameplay code, puzzle data, or deployment was changed. This review document is the only repository addition. Production behavior, native sharing, and a real midnight transition were not tested.

## 1. Fix route-aware yardage and caddie advice

**Confirmed correctness defect. Highest priority.**

On `/?date=2026-01-01`, play:

`ball → field → work → sheet → metal`

The UI says **“Sheet metal. Rough. Still 5 out.”** In fact, no legal onward route reaches BLUE without a drop. An independent graph traversal excluding previously played words finds no route; the current caddie also returns no suggestion at this position.

`distances()` calculates distances across the entire graph, while `play()` prohibits revisiting words. `bestShot()` excludes visited words only as the immediate next shot, so its remaining-distance estimates can still depend on forbidden later revisits.

Calculate distances against the currently legal graph. Use the same result for yardage, lie classification, caddie selection, and dead-end handling. Recompute after a shot or a drop. Keep historical shot feedback as the result at the time it was played.

Add regressions for the route above, a legal detour whose length increases because a prior word is unavailable, and restoration after a drop.

Source: `js/links-game.js:42`, `js/links-game.js:104`, `js/links-game.js:141`; the browser currently computes its distance map once at startup in `js/links.js`.

## 2. Put the next shot ahead of the finishing-phrase list

**Confirmed layout problem; proposed design remedy.**

The input follows the full course illustration and every finishing phrase. Today's GUARD hole lists 16 finishers. Hole 342, STRING to LINE, lists 59. At phone width the latter becomes a long wall of chips before the player can enter a word. The initial desktop view of today's hole also placed the input below the viewport.

Keep the current word, input, and feedback together in a compact action area. Make finishing phrases expandable and keep the complete list available without letting it displace the main action. A shorter map during play could expand on completion to celebrate the full route. Avoid selecting just a few hidden “preferred” finishers in a way that quietly steers players toward one solution.

The green palette, terrain, ball, and cream scorecard give the game personality. Improve the hierarchy while retaining those features. Check the small helper text and white Play label for contrast during that pass.

Source: `index.html`; `js/links.js:137`; `css/links.css`.

## 3. Make accepted phrases feel dependable

**Confirmed coverage gaps; proposed editorial workflow.**

The course accepts `rubber tire`, `color wheel`, and `honor guard`, but lacks `rubber tyre`, `colour wheel`, and `honour guard`. Links only trims and lowercases input, so these variants are not bridged. Familiar combinations such as school bag and duck bill are also absent.

Treat the phrase graph as core game content. Maintain explicit spelling aliases, a consistent policy for plurals and hyphenated phrases, and a review queue for missing connections. Offer a small “Suggest this phrase” action after rejection, with user-controlled submission. Prioritize common guesses around upcoming tees and plausible routes.

Avoid deciding validity through a live language model during a round. A reviewed, versioned graph keeps the daily game consistent. Phrase additions can change optimal scores, so preserve published puzzle versions when evolving the course.

Source: `data/course.json`; `js/links-game.js:99`; `scripts/build_course.mjs`.

## 4. Rebalance invisible dead ends

**Measured property; design judgment rather than a code defect.**

Across the 800 holes, 2,865 of 8,296 accepted opening choices have no path to the hole even before accounting for visited-word restrictions: **34.5%**. This weights each opening choice equally; it is not a measured player failure rate.

In my round, RUBBER → BAND → WIDTH was accepted, then produced “0 shots” and required a penalty drop. An invented word costs nothing, while a legitimate compound can cost both the shot and recovery. That can make trying a good phrase feel worse than guessing something implausible.

Keep the possibility of mistakes, but test a clearer bargain. My first experiment would be a warning before committing a shot with no onward route, coupled with hole selection that favors several plausible continuations. An alternative is one free recovery per round. These change difficulty in different ways and should be compared with playtests rather than applied together automatically.

At a true dead end, make recovery the primary control instead of leaving an active input with zero available shots.

## 5. Teach the finish rule through one tiny practice hole

**Design proposal.**

“Get from RUBBER to GUARD” suggests entering GUARD, but the game finishes as soon as the entered word can precede GUARD. That shortcut is reasonable once understood, yet central enough to deserve a demonstration.

Use a brief guided example: SCHOOL → BUS → STOP, then automatically show STOP + WATCH = STOPWATCH and the ball falling into the WATCH hole. This teaches direction, chaining, and automatic completion through an action.

Make the caddie available when someone is stuck without requiring two rejected guesses. Keep hints opt-in: the current code reveals the first length hint automatically after two rejections. Clearly state which subsequent hints appear on the scorecard.

Source: `index.html`; `js/links.js:197`; `js/links.js:384`.

## 6. Give completion a satisfying second beat

**Design and scoring proposals.**

The scorecard neatly records the route, including the drop. After finishing, I wanted to see how I could have done better. Add an optional “Show a shortest route” reveal, and an explicitly separate practice replay that preserves the official daily score. A small personal history of score versus par would make progress visible over time.

There is also a scoring mismatch to resolve: the builder makes every hole's shortest solution exactly one stroke under par. Thus birdie is the best attainable result on the current published graph, despite eagle and albatross labels existing in the code. The UI's “setter's route” language also describes something the current generated holes do not store.

Either define par honestly as a benchmark with birdie as perfect, or establish par from an actual reference route or calibrated difficulty if exceptional shortcuts should earn better scores. Do not imply that impossible scores are discoverable.

Source: `scripts/build_holes.mjs`; `tests/links.mjs`; `js/links-game.js:76`; `js/links.js:endLine`.

## 7. Close the daily lifecycle gaps

**Source-confirmed behavior; not reproduced by waiting through midnight.**

Both games choose the date and puzzle once when the page starts. Their countdowns repeatedly ask for the next midnight, but do not load the new puzzle when midnight passes. An overnight tab can therefore retain the old puzzle while the countdown starts counting toward another day.

Check the date on tab visibility/focus and at rollover. Offer “Today's hole is ready” while preserving an unfinished round. Add a visible retry action for failed data loads. Version saved state against the relevant puzzle/data version and validate saved content before restoring it.

Add a small browser smoke suite around first run, win, dead end/drop, reload, failed loading, and rollover. Existing rule tests are valuable, but they do not cover these browser behaviors.

Source: startup and countdown functions in `js/links.js` and `js/app.js`.

## The original Drift

Drift has the more distinctive visual atmosphere: the notebook, kite, soft sky, and restrained completion treatment fit together well. I would preserve that art direction.

Its main weakness is the relationship between the stated task and the feedback. In today's LAST puzzle, NIGHT and CHANCE were both marked “far away” without pairing recognition; STAND was recognized as another LAST pairing. After the length/first-letter hint, WORD solved the puzzle. The first three guesses did relatively little to narrow the intended answer.

Improve the pairing catalog and show two independent pieces of information for each guess: whether it pairs with yesterday, and how close its meaning is to the answer. Currently recognized alternative pairings suppress the distance meter and are excluded from progress/trend comparisons. An early clue to the intended sense is another experiment worth testing before changing the six-guess budget.

A separate correctness defect exists in normalization: suffix stripping treats **SHOWER as a form of SHOW**, and `applyGuess()` accepts it as a win when SHOW is the answer. SHOW is in the current chain. Replace broad transformations with reviewed aliases or validated inflections, and test unrelated words that merely share endings.

Sources: `js/app.js:110`; `js/game.js:applyGuess`; `js/heat.js:16`.

## Suggested order

1. Correct route-aware feedback and the demonstrated normalization defect.
2. Improve the action layout, phrase aliases, and dead-end recovery.
3. Add the practice introduction and improve caddie access.
4. Fix daily rollover and add browser regressions.
5. Playtest difficulty, then add route comparison and personal history.

The key question for the next playtest is whether players can explain why a move helped or hurt and identify what to try next. That is more useful now than increasing the number of holes or adding more visual effects.
