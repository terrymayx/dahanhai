# V8.4 物理质感重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变 V8.3 点击瞄准、双舰编队、4 发齐射和二维格子命中语义的前提下，让炮弹、船体、残骸、水面和镜头反馈呈现“真实基础 + 爽快强化”的重量感。

**Architecture:** 保持现有 `js/v8` 分层：ShipGrid 只提供材料/物理系数，Projectile 管理抛物线与 trail/落水，Battle 管理船体受力、反馈事件与残骸阶段，Renderer 只消费这些纯数据进行绘制。所有新增物理偏移都作为视觉态叠加，不修改导航 `ship.x/y/rotation` 和现有命中坐标系。

**Tech Stack:** Vanilla JavaScript、Canvas 2D、Node.js 合同测试、GitHub Actions、GitHub Pages。

**Spec:** `docs/superpowers/specs/2026-09-02-v8-4-physics-feel-design.md`

## Global Constraints

- 基调固定：真实基础 + 爽快强化。
- 不改 V8.3 双舰编队、锁定切换、4 发分时齐射、局部瞄准、材料穿透、火药舱连锁、结构断裂。
- X/Y 继续负责精准命中；Z 只服务视觉/落弹感，不引入真正 3D 碰撞。
- 同时最多 2 艘 active 敌舰。
- 不加入甲板近战。
- 不创建逐格 DOM/Node/Sprite；debrisCluster 仍一块一个对象。
- 单弹 trail 最多约 8 点；水面 FX/普通 FX 必须有数量上限。
- 最终入口版本为 `V8.4 · 物理质感重构`，cache key `?v=8.4.0`。
- `legacy_v7.html` 不修改。

---

### Task 1: 船体视觉物理状态与命中冲量

**Files:**
- Modify: `js/v8/10_ship_grid.js`
- Modify: `js/v8/30_battle.js`
- Create: `tests/v8_4_ship_impulse.test.js`

**Interfaces:**
- Produces `Grid.IMPACT_FORCE`：按 cell material/type 查询基础冲量。
- Produces `Battle.ensureShipPhysics(ship)`：初始化纯数据 `ship.physics`。
- Produces `Battle.applyHitImpulse(ship, cell, pos, projectile, scale?)`：把命中方向/局部杠杆转换为 impulse 与 roll。
- Produces `Battle.updateShipPhysics(ship, dt)`：阻尼、回弹、限幅。

- [ ] **Step 1: Write the failing test**

测试内容：
```js
const sloop=G.createTemplateShip('sloop','enemy',0,0);
const manowar=G.createTemplateShip('manowar','enemy',0,0);
B.ensureShipPhysics(sloop);B.ensureShipPhysics(manowar);
assert(sloop.physics.mass<manowar.physics.mass);

const deck=sloop.cells.find(c=>c.alive&&c.type==='deck');
const beam=sloop.cells.find(c=>c.alive&&(c.type==='beam'||c.type==='core'));
const p={vx:900,vy:0,damage:24,side:'player'};
B.applyHitImpulse(sloop,deck,G.cellCenterWorld(sloop,deck),p);
const deckImpulse=Math.hypot(sloop.physics.impulseX,sloop.physics.impulseY);
const rollBefore=Math.abs(sloop.physics.roll)+Math.abs(sloop.physics.angularVelocity);

sloop.physics.impulseX=sloop.physics.impulseY=sloop.physics.roll=sloop.physics.angularVelocity=0;
B.applyHitImpulse(sloop,beam,G.cellCenterWorld(sloop,beam),p);
const beamImpulse=Math.hypot(sloop.physics.impulseX,sloop.physics.impulseY);
assert(beamImpulse>deckImpulse);
assert(Math.abs(sloop.physics.roll)+Math.abs(sloop.physics.angularVelocity)>=rollBefore);

const before=Math.hypot(sloop.physics.impulseX,sloop.physics.impulseY);
for(let i=0;i<120;i++)B.updateShipPhysics(sloop,1/60);
assert(Math.hypot(sloop.physics.impulseX,sloop.physics.impulseY)<before);
assert(Math.abs(sloop.physics.offsetX)<3&&Math.abs(sloop.physics.offsetY)<3);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/v8_4_ship_impulse.test.js`
Expected: FAIL because V8.4 physics interfaces/fields do not exist.

- [ ] **Step 3: Implement minimal physics state**

`10_ship_grid.js` export:
```js
const IMPACT_FORCE={deck:2.2,hull:3.2,mast:3.8,cannon:3.8,rudder:3.8,beam:5.2,core:5.2,powder:5.8};
```

`30_battle.js` initialize masses:
```js
const SHIP_MASS={sloop:.75,gunship:1,manowar:1.35,player:1.45};
```

`ship.physics` keeps `impulseX/impulseY/angularVelocity/offsetX/offsetY/roll/bobPhase/mass/damping`.

`applyHitImpulse` must:
- normalize projectile XY velocity;
- divide response by mass;
- use `Grid.worldToLocal(ship,pos.x,pos.y)` for torque lever;
- clamp visual impulse/roll so ordinary hits stay in the spec ranges;
- never mutate `ship.x/y/rotation`.

`updateShipPhysics` must:
- integrate impulse into offset;
- apply exponential damping;
- spring offset/roll back toward zero;
- clamp offset to ±14px and roll to ±5°.

Hook `state.onCellHit` so every projectile hit applies physical impulse before feedback evaluation.

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/v8_4_ship_impulse.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/v8/10_ship_grid.js js/v8/30_battle.js tests/v8_4_ship_impulse.test.js
git commit -m "feat: add V8.4 ship impact physics"
```

---

### Task 2: 自适应抛物线、trail 与炮弹落水

**Files:**
- Modify: `js/v8/20_projectiles.js`
- Modify: `js/v8/30_battle.js`
- Create: `tests/v8_4_ballistic_feel.test.js`

**Interfaces:**
- Produces `Projectile.computeArcHeight(side,distance,variation?) -> number`。
- Projectile object gains `trail`, `trailT`, `splashDone`.
- Projectile calls `state.onProjectileSplash(p,{x,y})` once when an unhit arc completes.

- [ ] **Step 1: Write the failing test**

```js
assert(P.computeArcHeight('player',1400)>P.computeArcHeight('player',300));
assert(P.computeArcHeight('player',900)>P.computeArcHeight('enemy',900));

const state=B.newGame();
state.enemies=[];
const p=P.spawn(state,{x:100,y:100,vx:300,vy:0,side:'player',flightTime:.5,arcHeight:P.computeArcHeight('player',600)});
for(let i=0;i<40;i++)P.updateAll(state,.025);
assert(p.trail.length<=8);
assert(state.fx.some(f=>f.k==='waterSplash'));
assert(state.fx.some(f=>f.k==='waterRing'));
assert(!state.projectiles.includes(p));
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/v8_4_ballistic_feel.test.js`
Expected: FAIL because adaptive arc/trail/splash contract is absent.

- [ ] **Step 3: Implement adaptive arc and splash lifecycle**

`computeArcHeight`:
```js
function computeArcHeight(side,distance,variation){
  const base=side==='player'
    ? Math.max(145,Math.min(205,140+distance*.055))
    : Math.max(90,Math.min(135,85+distance*.035));
  return Math.max(0,base+(variation||0));
}
```

Projectile trail rules:
- sample every 0.05s;
- store `{x,y,z,t,dur:.28}`;
- max 8 entries per projectile;
- age/remove entries inside projectile update.

Splash rules:
- track whether projectile hit at least one cell (`p.didHit=true` when collision occurs);
- when `arcAge>=flightTime`, projectile is still alive, and `didHit` is false, call `state.onProjectileSplash` once and destroy projectile;
- Battle handler emits one `waterSplash`, one `waterRing`, and 2–4 `foam` records with short lifetimes.

Update `Battle.firePlayer/fireEnemy` to use `computeArcHeight` from target distance; 4-player-shot variation is `[-10,4,12,-4]` or equivalent within ±12px.

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/v8_4_ballistic_feel.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/v8/20_projectiles.js js/v8/30_battle.js tests/v8_4_ballistic_feel.test.js
git commit -m "feat: add adaptive cannon arcs and water splashes"
```

---

### Task 3: 反馈等级与统一 combat event

**Files:**
- Modify: `js/v8/30_battle.js`
- Create: `tests/v8_4_feedback_levels.test.js`

**Interfaces:**
- Produces `Battle.feedbackLevelFor(cell,res,eventType?) -> 'light'|'medium'|'heavy'|'critical'`。
- Produces `Battle.emitCombatEvent(state,type,payload)`.
- Event handler maps levels to bounded shake/hitStop and FX payloads.

- [ ] **Step 1: Write the failing test**

```js
assert.strictEqual(B.feedbackLevelFor({type:'deck'},{destroyed:false}),'light');
assert.strictEqual(B.feedbackLevelFor({type:'hull'},{destroyed:true}),'medium');
assert.strictEqual(B.feedbackLevelFor({type:'beam'},{destroyed:true}),'heavy');
assert.strictEqual(B.feedbackLevelFor({type:'powder'},{destroyed:true},'powder_blast'),'critical');

const s=B.newGame();
B.emitCombatEvent(s,'impact_medium',{x:10,y:10});
const mediumShake=s.shake,mediumStop=s.hitStop;
B.emitCombatEvent(s,'powder_blast',{x:10,y:10});
assert(s.shake>mediumShake);
assert(s.hitStop>=mediumStop);
assert(s.shake<=12);
assert(s.hitStop<=.075);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/v8_4_feedback_levels.test.js`
Expected: FAIL because event/level interfaces are missing.

- [ ] **Step 3: Implement event-driven feedback**

Define bounded values:
```js
const FEEDBACK={
  light:{shake:1,hitStop:0},
  medium:{shake:4,hitStop:.032},
  heavy:{shake:7,hitStop:.052},
  critical:{shake:11,hitStop:.072}
};
```

Map event names:
- `impact_light` -> light
- `impact_medium` -> medium
- `impact_heavy` / `beam_break` -> heavy
- `powder_blast` -> critical
- `debris_splash` / `projectile_splash` -> visual-only water feedback (no major hitStop)

Refactor existing `onCellHit`, `emitDetachedFeedback`, `triggerPowderBlast` so shake/hitStop are driven through this interface instead of scattered unconditional values. Preserve existing splinters/structureBreak/powderBlast visuals.

Powder blast also calls `applyHitImpulse` with an additional scale equivalent to about 9.0 base force.

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/v8_4_feedback_levels.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/v8/30_battle.js tests/v8_4_feedback_levels.test.js
git commit -m "refactor: grade V8.4 combat feedback by impact level"
```

---

### Task 4: 残骸三阶段动力学与入水反馈

**Files:**
- Modify: `js/v8/30_battle.js`
- Create: `tests/v8_4_debris_water.test.js`

**Interfaces:**
- `debrisCluster.phase` is one of `airborne`, `float`, `sink`.
- Cluster fields: `splashDone`, `floatBaseY`, `bobPhase`, inherited `vx/vy/angularVelocity`, `life`, `sinkProgress`.

- [ ] **Step 1: Write the failing test**

```js
const s=B.newGame();
const ship=B.spawnEnemy(s,'gunship',{x:1000,y:500});
B.ensureShipPhysics(ship);
ship.physics.impulseX=8;ship.physics.impulseY=-3;
const comps=[[ship.cells.find(c=>c.alive),ship.cells.filter(c=>c.alive)[1],ship.cells.filter(c=>c.alive)[2]]];
const clusters=B.createDebrisClusters(s,ship,comps);
const c=clusters[clusters.length-1];
assert.strictEqual(c.phase,'airborne');
assert(Math.abs(c.vx)>0);

let phases=new Set([c.phase]);
for(let i=0;i<240&&s.debrisClusters.includes(c);i++){
  B.updateDebrisClusters(s,1/60);phases.add(c.phase);
}
assert(phases.has('float'));
assert(phases.has('sink'));
assert(c.splashDone);
assert(s.fx.filter(f=>f.k==='waterSplash').length>=1);
```

Also create small/large clusters and assert the larger one receives a longer `life`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/v8_4_debris_water.test.js`
Expected: FAIL because debris phases/inheritance/splash-once behavior are absent.

- [ ] **Step 3: Implement three phases**

On creation:
- derive cluster centroid as today;
- inherit a fraction of ship navigation velocity (enemy uses approximately `-ship.speed*.25` X) plus `ship.physics.impulseX/Y`;
- add outward velocity from local centroid relative to ship center;
- set `phase:'airborne'`, `airTime` in 0.35–0.55s, `floatTime` in 0.7–1.4s;
- `life` scales upward with `Math.sqrt(cellCount)` so large clusters live longer.

Update:
- airborne: modest drag, faster angular motion;
- transition once to float: set `splashDone=true`, emit large `waterSplash` + `waterRing` and `debris_splash` event;
- float: stronger horizontal drag, bob around `floatBaseY`, angular damping;
- sink: increase `sinkProgress` with easing, lower visual position and fade until removal.

Do not split cells into independent physics objects.

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/v8_4_debris_water.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/v8/30_battle.js tests/v8_4_debris_water.test.js
git commit -m "feat: add buoyant debris lifecycle and splash physics"
```

---

### Task 5: Renderer 物理观感与 V8.4 发布入口

**Files:**
- Modify: `js/v8/40_render.js`
- Modify: `index.html`
- Create: `tests/v8_4_render_contract.test.js`

**Interfaces:**
- Renderer consumes `ship.physics`, projectile `trail/vz/z`, debris `phase/sinkProgress`, and FX `waterSplash/waterRing/foam`.

- [ ] **Step 1: Write the failing test**

Contract assertions must require source tokens/behavior for:
```js
ship.physics
bobPhase
offsetX
offsetY
roll
p.trail
p.vz
f.k==='waterSplash'
f.k==='waterRing'
f.k==='foam'
V8.4 · 物理质感重构
?v=8.4.0
```

Also assert `legacy_v7.html` exists and V8 entry does not load legacy boarding scripts.

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/v8_4_render_contract.test.js`
Expected: FAIL against V8.3 renderer/entry.

- [ ] **Step 3: Implement renderer changes**

Ship draw transform:
```js
const ph=ship.physics||{};
const bobY=Math.sin(state.time*freq+(ph.bobPhase||0))*amp;
const bobRoll=Math.sin(state.time*rollFreq+(ph.bobPhase||0)*.7)*rollAmp;
ctx.translate(ship.x+(ph.offsetX||0),ship.y+(ph.offsetY||0)+bobY+sinkOffset);
ctx.rotate(ship.rotation+(ph.roll||0)+bobRoll+sinkRotation);
```

Use kind-specific `amp/freq/rollAmp`, with sloop most active and player/manowar slowest.

Projectile rendering:
- draw trail smoke samples first;
- descending (`p.vz<0`) slightly increases projectile highlight/size and shortens the bright line;
- keep sea shadow based on Z.

Water FX:
- `waterSplash`: vertical tapered white/cyan plume plus small base ellipse;
- `waterRing`: expanding ellipse with fading stroke;
- `foam`: tiny irregular fading ellipse/circle.

Wake:
- scale width/alpha/length using `ship.kind` and current speed/baseSpeed ratio.

Debris:
- float phase includes a small bob offset;
- sink phase uses `sinkProgress` for downward shift and fade.

Update HUD/title/cache:
- `大航海时代 V8.4 · 物理质感重构`
- HUD `V8.4 · 物理质感重构`
- all six V8 script cache keys `?v=8.4.0`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/v8_4_render_contract.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/v8/40_render.js index.html tests/v8_4_render_contract.test.js
git commit -m "feat: render V8.4 weight water and motion feedback"
```

---

### Task 6: Full regression and release verification

**Files:**
- Temporary Create/Delete: `.github/workflows/v8-4-regression.yml`
- No production changes expected unless a regression reveals a real compatibility defect.

**Interfaces:** None.

- [ ] **Step 1: Run V8.4 + historical V8 regression**

Workflow command:
```bash
set -e
for t in tests/v8_4*.test.js; do echo "== $t =="; node "$t"; done
for t in tests/v8_3*.test.js tests/v8_2*.test.js tests/v8_1*.test.js tests/v8_0*.test.js; do echo "== $t =="; node "$t"; done
for f in js/v8/*.js; do node --check "$f"; done
```

Expected: all PASS.

- [ ] **Step 2: Run legacy regression**

```bash
cp index.html /tmp/v8-index.html
cp legacy_v7.html index.html
for t in tests/v6*.test.js tests/v7*.test.js; do node "$t"; done
cp /tmp/v8-index.html index.html
git diff --exit-code
```

Expected: all PASS and no leftover diff.

- [ ] **Step 3: Record tested SHA**

Record the exact `main` SHA whose V8.4/full regression workflow is green.

- [ ] **Step 4: Remove temporary workflow**

Delete `.github/workflows/v8-4-regression.yml` after the authoritative green run.

- [ ] **Step 5: Verify cleanup-only delta**

Compare tested SHA -> final SHA. Expected exactly one removed file: `.github/workflows/v8-4-regression.yml`.

- [ ] **Step 6: Verify GitHub Pages**

Confirm the Pages `pages build and deployment` run for the final SHA completes with `conclusion: success`.

- [ ] **Step 7: Final report**

Report final `main` SHA, regression run evidence, Pages success, and public URL `https://terrymayx.github.io/dahanhai/`.
