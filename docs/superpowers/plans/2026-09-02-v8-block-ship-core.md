# V8.0 方块船体破坏系统 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立一个独立于 V7 wrapper 链的 V8.0-A 可玩战斗核心，让玩家与敌舰都由可破坏方块网格组成，炮弹命中具体格子并造成真实视觉缺损。

**Architecture:** 新建 `js/v8/`，把网格数据、炮弹碰撞、战斗状态、渲染和输入循环分开。V8 页面只加载 V8 脚本；当前 V7.3 页面复制保存为 `legacy_v7.html`，不删除旧逻辑。所有结构破坏规则放在纯数据模块中，便于 Node 单测与未来迁移到 Cocos Creator。

**Tech Stack:** HTML5 Canvas 2D、原生 JavaScript、Node.js `assert` + `vm` 测试、GitHub Pages。

**Spec:** `docs/superpowers/specs/2026-09-02-v8-block-ship-core-design.md`

## Global Constraints
- 手机横屏，1920×1080 设计坐标。
- 方块必须是数据，不允许一格一个 DOM/Node。
- 玩家与敌舰都使用 ShipGrid。
- 普通炮弹伤害 24。
- 敌舰结构完整度 <= 0.34 沉没。
- 玩家结构完整度 <= 0.24 失败。
- V8.0-A 暂不包含复杂登船、火焰传播、漏水、断裂块物理。
- 保留 V7.3 为 `legacy_v7.html`。

---

### Task 1: Pure ShipGrid Core

**Files:**
- Create: `js/v8/10_ship_grid.js`
- Test: `tests/v8_0_ship_grid.test.js`

**Interfaces:**
- Produces: `V8ShipGrid.createTemplateShip(kind, side, x, y)`
- Produces: `V8ShipGrid.damageCell(ship, cell, damage)`
- Produces: `V8ShipGrid.integrity(ship)`
- Produces: `V8ShipGrid.worldToLocal(ship, x, y)`
- Produces: `V8ShipGrid.firstCellAlongSegment(ship, x0, y0, x1, y1)`

- [ ] **Step 1: Write failing test**

Test must assert:
```js
assert(ship.cells.length > 50);
assert(ship.cells.every(c => !('node' in c)));
const hit = V8ShipGrid.firstCellAlongSegment(ship, ship.x + 300, ship.y, ship.x - 300, ship.y);
assert(hit && hit.alive);
V8ShipGrid.damageCell(ship, hit, 999);
assert.strictEqual(hit.alive, false);
assert(V8ShipGrid.integrity(ship) < 1);
```
Also verify player, sloop, gunship, manowar templates have expected grid dimensions.

- [ ] **Step 2: Run test and confirm RED**

Run: `node tests/v8_0_ship_grid.test.js`
Expected: FAIL because `js/v8/10_ship_grid.js` does not exist.

- [ ] **Step 3: Implement minimal ShipGrid**

Create plain-cell templates with:
```js
{gx, gy, type, hp, maxHp, alive:true, weight}
```
Implement segment stepping in ship-local coordinates at <= cellSize/3 increments and return first live occupied cell.

- [ ] **Step 4: Run test and confirm GREEN**

Run: `node tests/v8_0_ship_grid.test.js`
Expected: PASS.

---

### Task 2: Projectile Damage Chain

**Files:**
- Create: `js/v8/20_projectiles.js`
- Extend: `tests/v8_0_ship_grid.test.js`

**Interfaces:**
- Consumes: `V8ShipGrid.firstCellAlongSegment`, `damageCell`, `integrity`.
- Produces: `V8Projectile.spawn(...)`, `V8Projectile.updateAll(state, dt)`.
- Calls state callbacks: `onCellHit`, `onCellDestroyed`, `onShipCritical`.

- [ ] **Step 1: Add failing projectile test**

Construct a target ship, launch a projectile through it, advance update, and assert exactly the first live cell loses HP while an interior cell remains unchanged.

- [ ] **Step 2: Run and confirm RED**

Run: `node tests/v8_0_ship_grid.test.js`
Expected: FAIL because projectile module is missing.

- [ ] **Step 3: Implement projectile update**

Each projectile stores previous position. Per frame, advance position then ray-step previous→current through candidate ships and damage only the first hit cell of the nearest hit ship.

- [ ] **Step 4: Run and confirm GREEN**

---

### Task 3: V8 Battle State

**Files:**
- Create: `js/v8/00_v8_base.js`
- Create: `js/v8/30_battle.js`
- Test: `tests/v8_0_battle.test.js`

**Interfaces:**
- Produces: global `V8` state.
- Produces: `V8Battle.newGame()`, `spawnEnemy()`, `update(dt)`, `setFocus(ship)`.

- [ ] **Step 1: Write failing battle test**

Verify new game contains one player grid ship; spawning creates grid enemy; enemy critical integrity moves it to `sink`; player <=0.24 sets lose.

- [ ] **Step 2: Run and confirm RED**

- [ ] **Step 3: Implement battle loop**

Auto-fire player cannon every 0.72s at focus/nearest enemy. Spawn enemy every ~2.4s with increasing mix. Enemy fires toward player after reaching x < 1450. No boarding in V8.0-A.

- [ ] **Step 4: Run and confirm GREEN**

---

### Task 4: Batch Grid Renderer

**Files:**
- Create: `js/v8/40_render.js`
- Test: `tests/v8_0_render_contract.test.js`

**Interfaces:**
- Consumes global `V8`, ship grid data, projectile/fx arrays.
- Produces `V8Render.draw()`.

- [ ] **Step 1: Write contract test**

Static test verifies renderer iterates `ship.cells` and uses Canvas `fillRect/strokeRect`; it must not create DOM elements or per-cell nodes.

- [ ] **Step 2: Confirm RED**

- [ ] **Step 3: Implement renderer**

Draw each live cell in one ship-local transform. Damaged cell gets dark overlay/crack. Dead cell is skipped. Draw structural percent text, projectiles, splinters, sea and HUD.

- [ ] **Step 4: Confirm GREEN**

---

### Task 5: Playable V8 Entry + Legacy Preservation

**Files:**
- Create: `legacy_v7.html` from current `index.html` unchanged.
- Replace: `index.html`
- Create: `js/v8/50_input_loop.js`
- Test: `tests/v8_0_entry.test.js`

**Interfaces:**
- Entry loads only V8 scripts.
- Input: click/tap enemy sets focus; blank clears focus; pause/restart supported.

- [ ] **Step 1: Write failing entry test**

Assert `index.html` title contains V8.0, loads only `js/v8/*`, and `legacy_v7.html` still contains V7.3 script stack.

- [ ] **Step 2: Confirm RED**

- [ ] **Step 3: Implement page and loop**

Create canvas entry and requestAnimationFrame loop. Keep landscape prompt.

- [ ] **Step 4: Confirm GREEN**

---

### Task 6: Full Regression + Deployment

**Files:**
- Temporary: `.github/workflows/v8-regression.yml`

- [ ] **Step 1: Run V8 tests + syntax checks**

Commands:
```bash
node tests/v8_0_ship_grid.test.js
node tests/v8_0_battle.test.js
node tests/v8_0_render_contract.test.js
node tests/v8_0_entry.test.js
for f in js/v8/*.js; do node --check "$f"; done
```

- [ ] **Step 2: Run legacy regression tests**

Run all existing `tests/v6*.test.js` and `tests/v7*.test.js` to ensure preserved V7 files remain valid.

- [ ] **Step 3: Remove temporary workflow after GREEN**

- [ ] **Step 4: Verify GitHub Pages deployment success**

Expected final public page: `https://terrymayx.github.io/dahanhai/` running V8.0-A; legacy V7 reachable at `/legacy_v7.html`.
