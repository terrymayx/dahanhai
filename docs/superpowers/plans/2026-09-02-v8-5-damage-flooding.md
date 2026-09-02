# V8.5 Damage + Flooding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build visible block damage, armor-gated penetration, hull leaks/flooding, and stronger beam-driven structural breakup without reintroducing camera/ship-hit shake.

**Architecture:** Keep cell durability in `V8ShipGrid`, projectile traversal in `V8Projectile`, ship-state consequences in `V8Battle`, and visuals in `V8Render`. V8.5 extends existing data rather than replacing V8.4.2 systems.

**Tech Stack:** Vanilla JavaScript, Canvas 2D, Node-based regression tests, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-02-v8-5-damage-flooding-design.md`

## Global Constraints
- Preserve 2-shell calm salvo and reduced fire rate.
- Camera shake and ship-hit recoil remain disabled.
- Preserve natural bobbing, debris clusters, powder blast and target locking.
- No new ships, levels or boarding combat.

---

### Task 1: Damage stages
**Files:** Modify `js/v8/10_ship_grid.js`; Test `tests/v8_5_damage_stage.test.js`
- [ ] Add `damageStage(cell)` returning intact/cracked/critical/destroyed from hp/maxHp.
- [ ] Verify healthy, half-damaged and dead cells classify correctly.

### Task 2: Armor-gated penetration
**Files:** Modify `js/v8/20_projectiles.js`; Test `tests/v8_5_penetration_gate.test.js`
- [ ] Write test proving a non-destroying hull hit stops the projectile.
- [ ] Write test proving a destroying hull hit with penetration remaining can continue past the breach.
- [ ] Implement minimal stop/continue rule using the existing material resistance table.

### Task 3: Leak + flooding model
**Files:** Modify `js/v8/30_battle.js`; Test `tests/v8_5_flooding.test.js`
- [ ] Add `ensureFlooding(ship)`, `isWaterlineHull(ship,cell)`, `addLeak(ship,cell)`, `updateFlooding(state,ship,dt)`.
- [ ] Hook hull destruction to leak creation only for waterline hull cells.
- [ ] Verify flooding grows over time, slows enemy speed and reaches sink/lose thresholds.

### Task 4: Beam structural breakup
**Files:** Modify `js/v8/30_battle.js`; Test `tests/v8_5_beam_break.test.js`
- [ ] Verify beam destruction invokes connectivity re-evaluation and multi-cell disconnected components become debris clusters.
- [ ] Keep structure feedback local; no camera shake.

### Task 5: Renderer damage + water feedback
**Files:** Modify `js/v8/40_render.js`; Test `tests/v8_5_render_contract.test.js`
- [ ] Render cracked/critical blocks with increasingly visible cracks/darkening/edge loss.
- [ ] Render leak bubbles/rings near breached hull positions.
- [ ] Apply `draft` vertical sinking offset without hit recoil.

### Task 6: Entry/version + regression
**Files:** Modify `index.html`, update only obsolete version-contract tests, temporary `.github/workflows/v8-5-regression.yml`.
- [ ] Bump V8 cache key to `8.5.0` and HUD/title to V8.5.
- [ ] Run all V8 tests, JS syntax checks, and V6/V7 legacy regression.
- [ ] Remove temporary workflow, compare tested SHA to cleanup SHA, verify final Pages deploy.
