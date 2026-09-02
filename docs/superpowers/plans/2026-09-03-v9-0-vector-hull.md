# V9.0 Vector Hull Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace visible pixel-block ships with smooth procedural Canvas vector ships while preserving hidden grid damage/collision semantics.

**Architecture:** Add a focused `38_vector_ship.js` rendering module loaded before `40_render.js`. The existing battle/grid/projectile model remains authoritative; `40_render.js` delegates ship and debris visuals to the vector module when present. Damage holes are composited into an offscreen per-ship canvas from dead logical cells, so damage still tracks exact cell state without displaying the grid.

**Tech Stack:** JavaScript, Canvas 2D, existing V8 modules, Node-based contract tests, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-03-v9-0-vector-hull-design.md`

## Global Constraints
- No image assets or generated images.
- Keep grid collision and independent cell HP.
- Keep armor-gated penetration.
- Keep low-frequency 2-shot salvo.
- Keep camera shake and hit recoil disabled.
- No flooding fields or behavior.
- Do not modify `legacy_v7.html`.

---

### Task 1: Pure vector hull geometry

**Files:**
- Create: `tests/v9_0_vector_geometry.test.js`
- Create: `js/v8/38_vector_ship.js`

**Interfaces:**
- Produces `V9VectorShip.hullProfile(ship)` returning dimensions and orientation.
- Produces `V9VectorShip.traceHullPath(ctx,ship)` and `traceDeckPath(ctx,ship)`.
- Produces deterministic `damageSeed(gx,gy)` / organic hole path helper.

- [ ] Write failing geometry test requiring player vertical profile, enemy horizontal profile, and distinct sloop/gunship/manowar fullness.
- [ ] Run test in temporary CI and verify RED because module is missing.
- [ ] Implement pure profile and hull/deck path helpers using quadratic/bezier curves.
- [ ] Re-run and verify GREEN.

### Task 2: Vector ship body + organic damage

**Files:**
- Modify: `js/v8/38_vector_ship.js`
- Create: `tests/v9_0_damage_visual_contract.test.js`

**Interfaces:**
- Produces `drawShipLocal(targetCtx,ship,state)`.
- Uses a logical-sized offscreen Canvas per ship draw.
- Uses `destination-out` for destroyed-cell organic holes.

- [ ] Write RED contract requiring offscreen composition, `destination-out`, non-rectangular hole helper, deck/plank/mast/sail/cannon visual layers, and no per-cell square body drawing.
- [ ] Implement hull fill, inner deck, plank lines, bow/stern deck, mast/yard/sail accents, cannon ports.
- [ ] Add dead-cell organic holes and damaged-cell crack/scorch/highlight overlays.
- [ ] Verify GREEN.

### Task 3: Renderer integration and non-block debris

**Files:**
- Modify: `js/v8/40_render.js`
- Modify: `js/v8/45_damage_overlay.js`
- Create: `tests/v9_0_render_integration.test.js`

**Interfaces:**
- `40_render.js` delegates visible ship body to `V9VectorShip.drawShipLocal` when loaded.
- `V9VectorShip.drawDebrisClusterLocal(ctx,cluster)` draws planks/shell fragments.
- `45_damage_overlay.js` keeps cracks/HUD but removes square critical fill.

- [ ] Write RED integration test requiring vector delegation and absence of normal per-cell `drawCell` ship loop when V9 module is active.
- [ ] Modify `drawShip` to keep wake/focus/status but render vector body.
- [ ] Modify debris rendering to delegate to organic plank fragments.
- [ ] Remove square critical overlay from `45_damage_overlay.js`; keep non-rectangular damage marks.
- [ ] Verify GREEN.

### Task 4: Entry/version contract

**Files:**
- Modify: `index.html`
- Modify: `js/v8/45_damage_overlay.js`
- Create: `tests/v9_0_entry_contract.test.js`

**Interfaces:**
- Entry loads `38_vector_ship.js` before `40_render.js`.
- Title/HUD/cache version is V9.0 / `9.0.0`.

- [ ] Write RED entry contract.
- [ ] Update page title, orientation label, script order/cache keys, HUD copy.
- [ ] Verify GREEN.

### Task 5: Full regression and release

**Files:**
- Modify temporary `.github/workflows/v8-6-regression.yml` into V9 regression runner, then delete it after green verification.
- Update only historical tests whose sole failure is a stale current-version title/cache assertion.

- [ ] Run all `tests/v9_0*.test.js`.
- [ ] Run `tests/v8_6*.test.js`, `v8_5*.test.js`, `v8_4*.test.js`, `v8_3*.test.js`, `v8_2*.test.js`, `v8_1*.test.js`, `v8_0*.test.js`.
- [ ] Run `node --check js/v8/*.js`.
- [ ] Run V6/V7 legacy regression against `legacy_v7.html` with index restored afterward.
- [ ] Diagnose any failure from logs before changing code/tests.
- [ ] Require a fresh all-green workflow run.
- [ ] Delete temporary CI workflow; compare tested SHA to cleanup SHA and confirm only workflow removal.
- [ ] Verify final GitHub Pages deployment succeeds for cleanup SHA.
