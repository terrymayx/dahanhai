# V8.1 Precision Destruction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add local click aiming, finite projectile penetration, structural disconnection/detachment, and stronger destruction feedback to the V8 single-enemy block-ship prototype.

**Architecture:** Extend the existing `js/v8/` modules in place. `ShipGrid` owns connectivity and detached-cell data, `Projectile` owns finite penetration and hit continuation, `Battle` owns aim state and feedback severity, while `Render/Input` only visualize and collect pointer intent. No legacy V7 wrapper is involved.

**Tech Stack:** Plain JavaScript, Canvas 2D, Node-based regression tests, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-09-02-v8-1-precision-destruction-design.md`

## Global Constraints
- Maximum 1 active enemy ship at any time; next enemy only after the current ship sinks.
- Keep `legacy_v7.html` unchanged.
- Do not re-enable boarding/deck combat.
- Cells remain pure data, never one DOM/Node per block.
- Player penetration defaults to 78; player projectile damage remains 24.
- Structure connectivity uses 4-neighbor adjacency.
- Structural hit-stop is capped at 0.07 seconds.

---

### Task 1: Structural connectivity and detachment

**Files:**
- Modify: `js/v8/10_ship_grid.js`
- Create: `tests/v8_1_structure_break.test.js`

**Interfaces:**
- Produces: `mainConnectedKeys(ship) -> Set<string>`
- Produces: `detachDisconnected(ship) -> Cell[]`

- [ ] **Step 1: Write the failing structure test**

Create a ship, manually carve a one-cell bridge, destroy the bridge, call `detachDisconnected`, then assert the isolated live cluster becomes dead while the core-connected cluster remains alive.

- [ ] **Step 2: Run RED**

Run: `node tests/v8_1_structure_break.test.js`
Expected: FAIL because `detachDisconnected` is missing.

- [ ] **Step 3: Implement minimal flood fill**

Use live `core` cells as seed set; if none remain, seed from the live cell nearest grid center. Visit only live 4-neighbor cells using `cellMap`. Mark unvisited live cells dead and return them.

- [ ] **Step 4: Run GREEN**

Run: `node tests/v8_1_structure_break.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: add V8 structural detachment`

---

### Task 2: Finite player projectile penetration

**Files:**
- Modify: `js/v8/20_projectiles.js`
- Create: `tests/v8_1_penetration.test.js`

**Interfaces:**
- Projectile fields: `penetration:number`, `hitCells:Object<string,boolean>`
- Consumes: `V8ShipGrid.firstCellAlongSegment`, `damageCell`

- [ ] **Step 1: Write the failing penetration test**

Spawn a player projectile through a dense test ship with `penetration:78`, update enough frames, and assert at least two distinct cells lose HP or die from that single projectile. Also assert an enemy projectile still stops after one cell.

- [ ] **Step 2: Run RED**

Run: `node tests/v8_1_penetration.test.js`
Expected: FAIL because player projectile currently dies after first hit.

- [ ] **Step 3: Implement minimal penetration accounting**

Add per-type costs `{hull:34,deck:24,core:42,mast:28,cannon:28,powder:28}`. On player hit, subtract cost, record `ship.id + ':' + gx + ',' + gy`, move projectile forward by `cellSize*0.55` along its normalized velocity, and keep it alive while penetration remains positive. Enemy projectiles retain old stop-on-hit behavior.

- [ ] **Step 4: Run GREEN**

Run: `node tests/v8_1_penetration.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: add V8 projectile penetration`

---

### Task 3: Local click aiming

**Files:**
- Modify: `js/v8/30_battle.js`
- Modify: `js/v8/50_input_loop.js`
- Create: `tests/v8_1_aiming.test.js`

**Interfaces:**
- Produces: `setAim(state,ship,worldX,worldY) -> aim|null`
- State field: `aim:{shipId,gx,gy,x,y}|null`
- `firePlayer(state,target)` consumes `state.aim` when `shipId===target.id`

- [ ] **Step 1: Write the failing aiming test**

Create an enemy, call `setAim` at a known world point on the ship, force `playerFireT=0`, update once, then assert the projectile velocity points closer to the selected local point than to the ship center. Assert sinking that ship clears aim.

- [ ] **Step 2: Run RED**

Run: `node tests/v8_1_aiming.test.js`
Expected: FAIL because `setAim` and `state.aim` do not exist.

- [ ] **Step 3: Implement aim state and input hook**

Convert world click to grid coordinates using `worldToLocal/localToGrid`; preserve the world aim point so firing into a newly created hole still works. In `50_input_loop.js`, clicking an enemy invokes `Battle.setAim(...)` in addition to focus selection.

- [ ] **Step 4: Run GREEN**

Run: `node tests/v8_1_aiming.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: add V8 local click aiming`

---

### Task 4: Structure-break feedback and renderer

**Files:**
- Modify: `js/v8/30_battle.js`
- Modify: `js/v8/40_render.js`
- Create: `tests/v8_1_feedback_contract.test.js`

**Interfaces:**
- State fields: `shake:number`, `hitStop:number`
- FX kinds: `impactBurst`, `structureBreak`, `debris`
- Renderer consumes `state.aim`, `state.shake`, new FX kinds.

- [ ] **Step 1: Write the failing feedback contract test**

Destroy a bridge that detaches at least 8 cells, route the destroyed-cell callback through Battle, then assert `state.hitStop>0`, `state.shake>=9`, at least one `structureBreak` FX and multiple `debris` FX entries exist.

- [ ] **Step 2: Run RED**

Run: `node tests/v8_1_feedback_contract.test.js`
Expected: FAIL because structural feedback does not exist.

- [ ] **Step 3: Implement feedback severity**

After a destroyed cell, call `detachDisconnected`. For 3-7 lost cells add `impactBurst` and shake 4. For 8+ or any detached cluster add `structureBreak`, debris records for detached cells, shake 9, and `hitStop=Math.max(hitStop,0.07)`.

- [ ] **Step 4: Render the new feedback**

In `40_render.js`: offset world drawing by small random shake; draw aim crosshair/ring at `state.aim`; draw `impactBurst`, `structureBreak`, and tumbling debris. Update HUD title/copy to V8.1.

- [ ] **Step 5: Run GREEN**

Run: `node tests/v8_1_feedback_contract.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

Commit message: `feat: add V8 structure-break feedback`

---

### Task 5: Full regression and Pages verification

**Files:**
- Temporary create/delete: `.github/workflows/v8-1-regression.yml`

**Interfaces:**
- No new production interface.

- [ ] **Step 1: Run all V8.1 tests**

Run:
`node tests/v8_1_structure_break.test.js && node tests/v8_1_penetration.test.js && node tests/v8_1_aiming.test.js && node tests/v8_1_feedback_contract.test.js`
Expected: PASS.

- [ ] **Step 2: Run V8.0 regression**

Run:
`node tests/v8_0_ship_grid.test.js && node tests/v8_0_battle.test.js && node tests/v8_0_render_contract.test.js && node tests/v8_0_entry.test.js && node tests/v8_0_single_enemy.test.js`
Expected: PASS.

- [ ] **Step 3: Run syntax checks**

Run: `for f in js/v8/*.js; do node --check "$f"; done`
Expected: PASS.

- [ ] **Step 4: Remove temporary workflow after success**

Delete `.github/workflows/v8-1-regression.yml` without touching production code.

- [ ] **Step 5: Verify final Pages deployment**

Verify the final `main` SHA has a completed successful `pages build and deployment` run.

- [ ] **Step 6: Commit cleanup**

Commit message: `ci: remove temporary V8.1 regression workflow`
