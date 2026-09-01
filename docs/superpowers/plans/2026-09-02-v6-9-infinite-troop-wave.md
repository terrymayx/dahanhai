# V6.9 Infinite Troop Wave Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the battle scene to an endless 15-second troop-transport wave survival loop with continuous archer fire and no level system.

**Architecture:** Keep V6.3–V6.8 battle systems intact and add a focused `js/25_v69_endless_waves.js` override layer loaded after V6.8. Remove the old level and melee-test scripts from `index.html`, and change the base enemy type definitions so every enemy ship is a boarding troop carrier. The V6.9 layer owns endless wave timing, archer auto-targeting, HUD copy, and win-state suppression.

**Tech Stack:** Vanilla JavaScript, Canvas 2D, Node static regression tests, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-09-02-v6-9-infinite-troop-wave-design.md`

## Global Constraints

- No level system; `js/55_levels.js` must not load.
- No old melee-test archer suppression; `js/59_melee_test_mode.js` must not load.
- Wave interval is exactly 15 seconds.
- Wave ship count is `Math.min(10,3+Math.floor((wave-1)/2))`.
- All enemy ship types carry pirates, have `shoot:false`, and are not `role:'ranged'`.
- Archer priority is fight boarder -> transit boarder -> nearest living troop ship.
- Preserve V6.3–V6.8 behavior and the clamped FX progress regression.

---

### Task 1: Lock V6.9 behavior with RED regression

**Files:**
- Create: `tests/v6_9_endless_troop_waves.test.js`

**Interfaces:**
- Consumes: repository source text.
- Produces: static and VM checks for V6.9 invariants.

- [ ] **Step 1: Write the failing test**

Test for: V6.9 version, no level/melee-test scripts, 15-second interval, capped wave-size formula, all three enemy types boarding-capable, `chooseV69ArcherTarget()`, and endless-wave state.

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/v6_9_endless_troop_waves.test.js`
Expected: FAIL because V6.9 layer/version does not exist.

- [ ] **Step 3: Commit RED test**

Commit message: `test: add V6.9 endless troop wave regression`

### Task 2: Convert all enemy ships to troop transports

**Files:**
- Modify: `js/10_model.js`
- Modify: `js/24_v68_feedback_perf.js`

**Interfaces:**
- Produces enemy types: `sloop pir=3`, `gunship pir=5`, `manowar pir=8`; all `shoot:false`; all boarding roles.

- [ ] **Step 1: Update base type definitions**

Change `gunship` from ranged artillery to medium troop transport and set `pir:5`, `role:'board'`, `shoot:false`. Keep sloop/manowar as boarding ships and set manowar pirates to 8.

- [ ] **Step 2: Keep V6.8 pooled spawn compatible**

Ensure pooled `spawnEnemy()` does not call ranged lane assignment for the converted gunship.

- [ ] **Step 3: Run V6.9 test**

Expected: enemy-type checks pass; wave/archer checks still fail.

### Task 3: Add endless 15-second wave controller

**Files:**
- Create: `js/25_v69_endless_waves.js`
- Modify: `index.html`

**Interfaces:**
- Produces: `V69_WAVE_INTERVAL=15`, `v69WaveShipCount(wave)`, `v69WaveTypes(wave)`, `startV69Wave(wave)`, state fields `waveClock`, `nextWaveIn`.

- [ ] **Step 1: Add endless-wave state wrapper**

`newGame()` must initialize `wave=0`, `waveClock=0`, `nextWaveIn=15`, and no level fields are required.

- [ ] **Step 2: Replace start-of-battle wave behavior**

Override `startWave()` so the first wave queues immediately using dynamic wave composition.

- [ ] **Step 3: Trigger a new wave every 15 seconds regardless of existing enemies**

Wrap `update(dt)` and advance `waveClock`; when it reaches 15 seconds, subtract 15 and call `startV69Wave(g.wave+1)`.

- [ ] **Step 4: Prevent normal victory state**

If old wave completion logic attempts `g.state='win'`, restore `playing` in endless mode.

- [ ] **Step 5: Remove old scripts from index**

Remove `js/55_levels.js` and `js/59_melee_test_mode.js`; load `js/25_v69_endless_waves.js` after V6.8 and before input loop.

### Task 4: Make archer fire continuously

**Files:**
- Modify: `js/25_v69_endless_waves.js`

**Interfaces:**
- Produces: `chooseV69ArcherTarget()`, `fireV69Archer()`, archer timer state `v69ArcherT`.

- [ ] **Step 1: Implement target priority**

Return nearest living fight boarder first, then nearest transit boarder, then nearest living enemy ship.

- [ ] **Step 2: Implement automatic arrow fire**

Use the archer's damage/interval and create arrows toward boarders or enemy ships. Continue firing whenever a target exists and archer is alive.

- [ ] **Step 3: Verify continuous-fire regression**

Run `node tests/v6_9_endless_troop_waves.test.js` and expect PASS.

### Task 5: Update battle HUD/version and full regression

**Files:**
- Modify: `js/25_v69_endless_waves.js`
- Modify: `index.html`
- Update existing version-only assertions if they reject V6.9 while preserving their behavioral assertions.

**Interfaces:**
- HUD shows `第 N 波` and `下一波 X.Xs`.

- [ ] **Step 1: Update menu/HUD copy**

Version must display `V6.9 · 无限运兵船潮`; no level copy may be shown.

- [ ] **Step 2: Run syntax checks**

Run: `for f in js/*.js; do node --check "$f"; done`

- [ ] **Step 3: Run full regressions**

Run V6.3, V6.4, V6.5, V6.6, V6.7, V6.8, and V6.9 tests.

- [ ] **Step 4: Verify GitHub Pages deployment**

Confirm final Pages workflow concludes `success` for final `main` SHA.
