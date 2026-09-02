# V8.6 · 部件损伤与结构应力 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 V8.5.1 的独立方块耐久升级为渐进部件性能与主梁结构应力系统，并在准星附近显示当前部件 HP/状态。

**Architecture:** 新建 `js/v8/37_component_stress.js` 负责部件耐久比例、阶段、结构应力、应力扩散和 Battle hooks；`30_battle.js` 只做两个小集成点：敌舰炮击倒计时乘 `cannonEfficiency`，现有系统重算函数优先消费 V8.6 的渐进系统状态。`45_damage_overlay.js` 负责瞄准信息和结构应力视觉，不改变导航或受击物理。

**Tech Stack:** Browser Canvas 2D, plain JavaScript IIFE modules, Node `assert`/`vm` tests, GitHub Actions regression.

**Spec:** `docs/superpowers/specs/2026-09-03-v8-6-component-stress-design.md`

## Global Constraints

- 完全不加入进水，不创建 `leaks` / `flooding` / `draft` 或任何隐藏进水数值。
- 保留破甲后穿透、方块独立耐久、火药舱摧毁爆炸、结构连通性断裂、残骸、水花。
- 保留低频 2 发齐射、无镜头抖动、无船体受击后坐/横摇。
- 不增加新舰型、关卡、炮弹种类或登船战。
- `legacy_v7.html` 不修改。
- 页面/HUD 版本为 `V8.6 · 部件损伤与结构应力`，V8 缓存键统一 `?v=8.6.0`。

---

### Task 1: 部件耐久阶段与系统比例

**Files:**
- Create: `js/v8/37_component_stress.js`
- Create: `tests/v8_6_component_ratios.test.js`

**Interfaces:**
- Produces: `V8ComponentStress.componentRatio(cell)`, `componentStage(cell)`, `shipSystemRatios(ship)`, `structureStressStage(stress)`, `refreshShip(ship)`.
- `refreshShip(ship)` writes `ship.systemRatios`, `beamIntegrity`, `structureStress`, `structureStressStage`, `cannonEfficiency`, `mastEfficiency`, `rudderEfficiency`, `powderDanger` and per-cell `stress`.

- [ ] Write a failing test covering 0.66/0.33 stage boundaries, aggregate ratios and structure stress.
- [ ] Run `node tests/v8_6_component_ratios.test.js`; expect failure because `37_component_stress.js`/interfaces do not exist.
- [ ] Implement the minimal pure calculation layer in `37_component_stress.js`.
- [ ] Re-run the test; expect pass.
- [ ] Commit `feat: add V8.6 component stress model`.

### Task 2: 渐进部件性能接入战斗

**Files:**
- Modify: `js/v8/30_battle.js`
- Modify: `js/v8/37_component_stress.js`
- Create: `tests/v8_6_progressive_systems.test.js`

**Interfaces:**
- `refreshShip(ship)` computes `mastEfficiency = .75 + .25*mastRatio`, `rudderEfficiency = .55 + .45*rudderRatio`, `cannonEfficiency = cannonRatio<=0?0:.45+.55*cannonRatio`.
- Enemy fire countdown becomes `e.shotT -= dt * cannonEfficiency`.
- `B.recomputeShipSystems(ship)` preserves legacy behavior when V8.6 module is absent, but when present consumes the V8.6 ratios for continuous speed degradation.

- [ ] Write a failing test that damages cannon/mast/rudder cells without destroying them and asserts continuous fire/speed effects.
- [ ] Run the test; expect current binary alive/dead behavior to fail.
- [ ] Modify `30_battle.js` integration points and add Battle hooks in `37_component_stress.js` to refresh after hits/destroys/spawns/new game.
- [ ] Re-run the test; expect pass and `state.shake===0`.
- [ ] Commit `feat: make ship systems degrade with component HP`.

### Task 3: 主梁结构应力与局部应力断裂

**Files:**
- Modify: `js/v8/37_component_stress.js`
- Create: `tests/v8_6_structure_stress.test.js`

**Interfaces:**
- `cellStress(ship,cell)` derives local stress from nearby damaged `beam/core` cells using Manhattan distance.
- `applyStressRupture(state,ship,sourceCell,pos)` runs only after a `beam/core` destruction with `structureStress>=.34`, applies bounded stress damage within 2 cells to hull/deck/beam/core, then reuses `G.detachDisconnectedComponents` and `B.createDebrisClusters`.
- Emits local `stressRupture` FX; always restores `state.shake=0` and invokes `B.clearAttackMotion(ship)` when available.

- [ ] Write a failing test proving healthy neighbors cannot be one-shot by stress, critical neighbors may fail, and coherent detached pieces become debris clusters.
- [ ] Run the test; expect missing stress rupture behavior.
- [ ] Implement bounded stress propagation and detachment reuse.
- [ ] Re-run the test; expect pass with no camera/ship recoil.
- [ ] Commit `feat: add beam stress rupture propagation`.

### Task 4: 瞄准 HP/状态与结构应力视觉

**Files:**
- Modify: `js/v8/45_damage_overlay.js`
- Create: `tests/v8_6_aim_overlay.test.js`

**Interfaces:**
- `resolveAimCell(state)` returns `{ship,cell}` for current `state.aim`.
- `formatAimInfo(ship,cell)` returns primary text such as `主梁 52 / 96 · 受损` plus optional system detail (`炮效 72%`, `帆效 81%`, `舵效 65%`, `结构应力 48%`, `危险`).
- Overlay renders stress lines only for cells with `stress>0`, and renders `stressRupture` as a local effect; no global transform shake.

- [ ] Write a failing static/behavior test for Chinese labels, HP text, system detail, stress tokens and no flooding terms.
- [ ] Run the test; expect failure because overlay lacks V8.6 aim info.
- [ ] Implement aim info and local stress rendering.
- [ ] Re-run the test; expect pass.
- [ ] Commit `feat: show V8.6 component health and stress`.

### Task 5: V8.6 入口、回归与发布

**Files:**
- Modify: `index.html`
- Update only historical tests whose assertions hard-code the superseded active V8.5.1 title/cache key.
- Create temporarily: `.github/workflows/v8-6-regression.yml`

**Interfaces:**
- Script order: `35_combat_tuning.js` → `36_damage_model.js` → `37_component_stress.js` → `40_render.js` → `45_damage_overlay.js`.
- All active V8 scripts use `?v=8.6.0`.

- [ ] Write/update V8.6 entry contract asserting title, cache keys, `37_component_stress.js`, no flooding module/terms, and legacy V7 untouched.
- [ ] Run V8.6 tests, then V8.5.1→V8.0 tests, `node --check js/v8/*.js`, and V6/V7 legacy via temporary GitHub Actions workflow.
- [ ] If historical tests fail only because they hard-code V8.5.1 active title/cache keys, update only those assertions; do not weaken behavioral contracts.
- [ ] Require all three groups GREEN: V8 full regression, JS syntax, Legacy V6/V7.
- [ ] Delete temporary regression workflow and compare tested SHA to cleanup SHA; only workflow deletion may differ.
- [ ] Verify GitHub Pages succeeds on final cleanup SHA.
- [ ] Final commit state is production `main` with no temporary workflow.
