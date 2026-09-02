# V8.5.1 Remove Flooding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove every flooding/leak/draft runtime behavior and UI trace while preserving V8.5 block durability, armor-gated penetration, structure rupture, debris, and calm-fire behavior.

**Architecture:** Replace the mixed damage/flooding module with a damage-only module. Keep the existing battle core authoritative for structural sinking, and keep the overlay as a pure damage visualization layer. Tests must prove forbidden flooding fields are absent, not merely zero.

**Tech Stack:** Browser JavaScript, Canvas 2D, Node.js assertion tests, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-03-v8-5-1-remove-flooding-design.md`

## Global Constraints
- No runtime `leaks`, `flooding`, or `draft` ship fields.
- Preserve damage stages and armor-gated penetration.
- Preserve beam/core rupture, debris, powder explosion, projectile/debris water splash visuals.
- Preserve 2-shot low-frequency fire and zero hit-induced camera/ship recoil.
- No new gameplay system in this version.

---

### Task 1: Lock no-flooding contract

**Files:**
- Create: `tests/v8_5_1_no_flooding.test.js`
- Create temporarily: `.github/workflows/v8-5-1-regression.yml`

**Interfaces:**
- Consumes: `V8Battle.newGame()`, `V8Battle.spawnEnemy()`, current V8 entry files.
- Produces: regression contract that asserts forbidden flooding fields/modules/copy do not exist.

- [ ] Write failing test asserting player/enemy ships have no `leaks`, `flooding`, `draft`; index does not load flooding module; overlay has no flooding UI strings.
- [ ] Run workflow and verify RED fails for the intended flooding assertions.

### Task 2: Replace flooding module with damage-only model

**Files:**
- Create: `js/v8/36_damage_model.js`
- Delete: `js/v8/36_damage_flooding.js`

**Interfaces:**
- Produces: `V8ShipGrid.damageStage(cell)` and battle hook that preserves zero shake and `structureRupture` FX after beam/core detachment.
- Does not initialize any flooding state.

- [ ] Implement minimal damage-stage module and structure-rupture hook.
- [ ] Keep `state.shake=0` after destruction callback.
- [ ] Run no-flooding and beam-break tests until GREEN.

### Task 3: Remove flooding rendering and copy

**Files:**
- Modify: `js/v8/45_damage_overlay.js`
- Modify: `index.html`

**Interfaces:**
- Overlay consumes `V8ShipGrid.damageStage` only.
- Entry loads `36_damage_model.js?v=8.5.1`.

- [ ] Remove `applyDraft`, leak drawing, flooding percentage, and flooding copy.
- [ ] Keep cracked/critical block overlays.
- [ ] Rename HUD/page to `V8.5.1 · 船体损伤与破甲` and update cache keys.
- [ ] Run entry/render and no-flooding tests until GREEN.

### Task 4: Reconcile historical tests

**Files:**
- Modify/delete only tests whose contracts explicitly require V8.5 flooding or old V8.5.0 entry strings.

- [ ] Remove/replace flooding-specific test expectations.
- [ ] Keep all durability, armor-gate, rupture, projectile, debris, formation, calm-fire, and legacy contracts intact.
- [ ] Run full V8.5.1→V8.0 regression.
- [ ] Run `node --check` for every `js/v8/*.js`.
- [ ] Run V6/V7 legacy regression.

### Task 5: Release cleanup

**Files:**
- Delete temporary `.github/workflows/v8-5-1-regression.yml`.

- [ ] Record the SHA with complete GREEN verification.
- [ ] Delete only the temporary workflow.
- [ ] Compare tested SHA vs cleanup SHA and verify the only change is workflow removal.
- [ ] Verify GitHub Pages build/deploy succeeds for cleanup SHA.
