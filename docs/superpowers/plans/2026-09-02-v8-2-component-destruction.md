# V8.2 部位破坏与连锁毁伤 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 V8.1 方块船核心上实现可学习的功能部位、材料穿透、火药舱连锁爆炸，以及保持原形状的整块残骸脱落。

**Architecture:** 继续扩展 `js/v8` 现有四层，不新增 legacy wrapper。`10_ship_grid.js` 负责模板部位、材料和连通分量；`20_projectiles.js` 只负责按材料阻力消耗 penetration；`30_battle.js` 负责部位被摧毁后的系统后果、连锁爆炸和 debris cluster 生命周期；`40_render.js` 负责功能部位辨识、准星部位名、powder blast 和整块残骸渲染。

**Tech Stack:** 浏览器 Canvas 2D、原生 JavaScript、Node.js 22 测试、GitHub Actions、GitHub Pages。

**Spec:** `docs/superpowers/specs/2026-09-02-v8-2-component-destruction-design.md`

## Global Constraints

- 敌舰结构完整度 `<= 34%` 进入 sink。
- 我方旗舰结构完整度 `<= 24%` 战败。
- 场上最多 `1` 艘 active 敌舰；击沉后下一艘按原刷新计时出现。
- 不接回甲板战。
- 继续使用 `js/v8` 核心，不新增 legacy wrapper。
- `legacy_v7.html` 不修改。
- 玩家炮弹保留连续穿透；敌方炮弹命中一格后停止。
- 火药舱连锁伤害同一 powder 在一次爆炸链中最多触发一次，避免递归死循环。
- 首页最终版本为 `V8.2 · 部位破坏与连锁毁伤`，V8 script cache key 为 `?v=8.2.0`。

---

### Task 1: 功能部位模板与材料数据

**Files:**
- Modify: `js/v8/10_ship_grid.js`
- Create: `tests/v8_2_components.test.js`

**Interfaces:**
- Consumes: `V8ShipGrid.createTemplateShip(kind, side, x, y)`。
- Produces: `V8ShipGrid.MATERIAL_RESISTANCE`、`V8ShipGrid.connectedComponents(ship)`、新模板 cell 字段 `material/critical/system`。

- [ ] **Step 1: 写失败测试，锁定 V8.2 部位合同**

```js
const fs=require('fs');
const vm=require('vm');
const assert=require('assert');
const ctx={console,Math};ctx.globalThis=ctx;vm.createContext(ctx);
vm.runInContext(fs.readFileSync('js/v8/10_ship_grid.js','utf8'),ctx);
const G=ctx.V8ShipGrid;

for(const kind of ['sloop','gunship','manowar']){
  const ship=G.createTemplateShip(kind,'enemy',1000,500);
  const types=new Set(ship.cells.map(c=>c.type));
  for(const t of ['beam','powder','rudder','mast','cannon'])
    assert(types.has(t),`${kind} must contain ${t}`);
  const powders=ship.cells.filter(c=>c.type==='powder');
  assert(powders.length>=1,'powder exists');
  assert(powders.every(c=>{
    const k=(x,y)=>ship.cellMap[x+','+y];
    return k(c.gx-1,c.gy)&&k(c.gx+1,c.gy)&&k(c.gx,c.gy-1)&&k(c.gx,c.gy+1);
  }),'powder must be internal');
  assert(ship.cells.every(c=>!('node' in c)&&!('sprite' in c)),'cells remain pure data');
}

assert(G.MATERIAL_RESISTANCE.hull===34);
assert(G.MATERIAL_RESISTANCE.deck===24);
assert(G.MATERIAL_RESISTANCE.beam===52);
assert(G.MATERIAL_RESISTANCE.powder===20);
assert(G.MATERIAL_RESISTANCE.rudder===28);
assert(G.MATERIAL_RESISTANCE.mast===30);
assert(G.MATERIAL_RESISTANCE.cannon===30);
console.log('V8.2 component template tests passed');
```

- [ ] **Step 2: 运行测试确认 RED**

Run: `node tests/v8_2_components.test.js`

Expected: FAIL，因为旧模板只稳定生成 `hull/deck/core`，且没有 `MATERIAL_RESISTANCE`。

- [ ] **Step 3: 实现确定性功能部位布局**

在 `10_ship_grid.js` 中：

```js
const CELL_HP={hull:28,deck:20,beam:48,core:48,powder:18,rudder:24,mast:26,cannon:26};
const CELL_WEIGHT={hull:1,deck:1,beam:3,core:3,powder:1,rudder:1,mast:1,cannon:1};
const MATERIAL_RESISTANCE={hull:34,deck:24,beam:52,core:52,powder:20,rudder:28,mast:30,cannon:30};
```

增加 `assignFunctionalTypes(kind,w,h,occ,cellMap)`：

- 先把 occupancy 内格默认分成 outer `hull` 与 inner `deck`；
- 沿 `gy≈h/2` 的内部连续位置生成 `beam`；
- 在中后部内部 1~2 格设置 `powder`；
- 在船尾内部设置 `rudder`；
- 中部设置 `mast`；
- 中部上下两侧内部位置设置 `cannon`；
- 每次设置功能格前必须验证目标格存在且不是 outer hull。

cell 创建时统一写入：

```js
cell.material=cell.type==='core'?'beam':cell.type;
cell.critical=['beam','powder','rudder','mast','cannon'].includes(cell.type);
cell.system=cell.type==='beam'?'structure':(cell.critical?cell.type:null);
```

- [ ] **Step 4: 增加 connected components 只读接口**

```js
function connectedComponents(ship){
  const seen=new Set(), out=[];
  for(const cell of ship.cells){
    if(!cell.alive||seen.has(key(cell.gx,cell.gy)))continue;
    const q=[cell], comp=[];seen.add(key(cell.gx,cell.gy));
    for(let i=0;i<q.length;i++){
      const cur=q[i];comp.push(cur);
      for(const [gx,gy] of [[cur.gx-1,cur.gy],[cur.gx+1,cur.gy],[cur.gx,cur.gy-1],[cur.gx,cur.gy+1]]){
        const k=key(gx,gy),n=ship.cellMap[k];
        if(n&&n.alive&&!seen.has(k)){seen.add(k);q.push(n);}
      }
    }
    out.push(comp);
  }
  return out;
}
```

导出 `MATERIAL_RESISTANCE` 与 `connectedComponents`。

- [ ] **Step 5: 运行 Task 1 测试并提交**

Run: `node tests/v8_2_components.test.js`

Expected: PASS。

Commit: `feat: add V8.2 functional ship components`

---

### Task 2: 材料阻力穿透

**Files:**
- Modify: `js/v8/20_projectiles.js`
- Create: `tests/v8_2_material_penetration.test.js`

**Interfaces:**
- Consumes: `V8ShipGrid.MATERIAL_RESISTANCE`。
- Produces: 玩家炮弹按 `cell.material || cell.type` 扣除 penetration；敌方炮弹逻辑不变。

- [ ] **Step 1: 写失败测试**

测试三点：

```js
assert(G.MATERIAL_RESISTANCE.beam>G.MATERIAL_RESISTANCE.hull);
assert(G.MATERIAL_RESISTANCE.hull>G.MATERIAL_RESISTANCE.deck);
```

构造同样 `penetration=60` 的两发玩家炮弹：

- 一条路径首个有效格改为 `deck`，预期命中后 projectile 仍存活；
- 一条路径首个有效格改为 `beam`，预期 penetration 明显更低或耗尽；
- 另发 `side:'enemy'` 炮弹命中后必须从 `state.projectiles` 消失。

- [ ] **Step 2: 运行确认 RED**

Run: `node tests/v8_2_material_penetration.test.js`

Expected: FAIL，因为 `20_projectiles.js` 仍维护自己的旧 `PEN_COST`。

- [ ] **Step 3: 用 Grid 材料表替代旧 PEN_COST**

```js
const PEN_COST=Grid.MATERIAL_RESISTANCE;
...
const material=bestCell.material||bestCell.type;
p.penetration-=PEN_COST[material]||28;
```

保留：

```js
if(p.side==='player') { /* finite penetration */ }
else p.dead=true;
```

- [ ] **Step 4: 运行新旧穿透测试并提交**

Run:

```bash
node tests/v8_2_material_penetration.test.js
node tests/v8_1_penetration.test.js
node tests/v8_0_ship_grid.test.js
```

Expected: 全部 PASS。

Commit: `feat: apply V8.2 material penetration resistance`

---

### Task 3: 火药舱连锁爆炸与系统损伤

**Files:**
- Modify: `js/v8/30_battle.js`
- Create: `tests/v8_2_powder_chain.test.js`

**Interfaces:**
- Consumes: cell `type/system`、`G.damageCell()`、`G.detachDisconnected()`。
- Produces: `applyComponentDestroyed(state,ship,cell,pos,chainCtx)`、`triggerPowderBlast(state,ship,powderCell,chainCtx)`、`recomputeShipSystems(ship)`。

- [ ] **Step 1: 写 powder RED 测试**

构造敌船，找到 `powder`，记录爆炸前周围半径 2 格 hp；直接摧毁 powder 后调用 Battle 的部位破坏处理，断言：

```js
assert(state.fx.some(f=>f.k==='powderBlast'));
assert(changedNeighborCount>=2);
assert(state.shake>=10);
assert(state.hitStop>0 && state.hitStop<=.07);
```

再准备两个相邻 powder，断言一次爆炸链结束后函数返回且每个 powder 的 chain trigger 次数最多 1。

- [ ] **Step 2: 运行确认 RED**

Run: `node tests/v8_2_powder_chain.test.js`

Expected: FAIL，因为 Battle 尚无 powder blast / system recompute。

- [ ] **Step 3: 实现 chain context 与局部爆炸**

```js
function triggerPowderBlast(state,ship,cell,chain){
  chain=chain||{triggered:new Set()};
  const id=(ship.id||ship.kind)+':'+cell.gx+','+cell.gy;
  if(chain.triggered.has(id))return;
  chain.triggered.add(id);
  const center=G.cellCenterWorld(ship,cell);
  state.fx.push({k:'powderBlast',x:center.x,y:center.y,t:0,dur:.62,r:96});
  state.shake=Math.max(state.shake,12);
  state.hitStop=Math.max(state.hitStop,.07);
  for(const target of ship.cells){
    if(!target.alive)continue;
    const dx=target.gx-cell.gx,dy=target.gy-cell.gy,d=Math.hypot(dx,dy);
    if(d>2.01)continue;
    const damage=d<=1.05?38:20;
    const res=G.damageCell(ship,target,damage);
    if(res.destroyed&&target.type==='powder')triggerPowderBlast(state,ship,target,chain);
  }
}
```

爆炸链结束后只做一次 `detachDisconnected` / debris cluster 转换（Task 4 接管 cluster 创建）。

- [ ] **Step 4: 实现 rudder/mast/cannon 状态重算**

```js
function recomputeShipSystems(ship){
  const alive=t=>ship.cells.some(c=>c.alive&&c.type===t);
  ship.rudderAlive=alive('rudder');
  ship.mastAlive=alive('mast');
  ship.cannonsAlive=ship.cells.filter(c=>c.alive&&c.type==='cannon').length;
  const base=(ENEMY[ship.kind]||ENEMY.sloop).speed;
  let mult=1;
  if(!ship.rudderAlive)mult*=.55;
  if(!ship.mastAlive)mult*=.75;
  ship.speed=Math.max(base*.3,base*mult);
}
```

`fireEnemy` 前增加：

```js
if(e.cannonsAlive===0)return;
```

敌船 update 中若 `!e.rudderAlive`，添加仅视觉的轻微 `rotation` 摇摆，不引入复杂航海物理。

- [ ] **Step 5: 把 onCellDestroyed 路由到部位处理**

普通格：保持 V8.1 splinter/structure feedback；功能格：调用 `applyComponentDestroyed`。powder 使用 chain context；其它功能格调用 `recomputeShipSystems`。

- [ ] **Step 6: 跑测试并提交**

Run:

```bash
node tests/v8_2_powder_chain.test.js
node tests/v8_1_feedback_contract.test.js
node tests/v8_1_aiming.test.js
```

Expected: PASS。

Commit: `feat: add V8.2 powder chain and system damage`

---

### Task 4: 整块残骸 cluster 生命周期

**Files:**
- Modify: `js/v8/10_ship_grid.js`
- Modify: `js/v8/30_battle.js`
- Create: `tests/v8_2_debris_cluster.test.js`

**Interfaces:**
- Consumes: `G.connectedComponents(ship)`、`G.mainConnectedKeys(ship)`、`G.cellCenterLocal(ship,cell)`。
- Produces: `G.detachDisconnectedComponents(ship)` 返回 component 数组；Battle state 新增 `debrisClusters`；cluster 数据 `{cells,x,y,vx,vy,rotation,angularVelocity,life,sinkProgress}`。

- [ ] **Step 1: 写 cluster RED 测试**

创建人为断开的 3 格 component，运行 detach：

```js
const comps=G.detachDisconnectedComponents(ship);
assert(comps.some(c=>c.length===3));
assert(threeCells.every(c=>!c.alive));
```

再调用 Battle 的 cluster 创建逻辑，断言：

```js
assert.strictEqual(state.debrisClusters.length,1);
assert.strictEqual(state.debrisClusters[0].cells.length,3);
const rel=state.debrisClusters[0].cells.map(c=>[c.x,c.y]);
assert(new Set(rel.map(JSON.stringify)).size===3);
```

update 0.5 秒后 rotation/sinkProgress 改变；超过 life 后 cluster 被移除。

- [ ] **Step 2: 运行确认 RED**

Run: `node tests/v8_2_debris_cluster.test.js`

Expected: FAIL，因为 V8.1 只有逐格 `debris` FX。

- [ ] **Step 3: ShipGrid 返回 disconnected components**

新增：

```js
function detachDisconnectedComponents(ship){
  const keep=mainConnectedKeys(ship),pending=new Set();
  for(const c of ship.cells)if(c.alive&&!keep.has(key(c.gx,c.gy)))pending.add(key(c.gx,c.gy));
  const out=[];
  while(pending.size){
    const startKey=pending.values().next().value,start=ship.cellMap[startKey];
    const q=[start],comp=[];pending.delete(startKey);
    for(let i=0;i<q.length;i++){
      const c=q[i];comp.push(c);
      for(const [gx,gy] of [[c.gx-1,c.gy],[c.gx+1,c.gy],[c.gx,c.gy-1],[c.gx,c.gy+1]]){
        const k=key(gx,gy),n=ship.cellMap[k];
        if(n&&n.alive&&pending.has(k)){pending.delete(k);q.push(n);}
      }
    }
    for(const c of comp){c.alive=false;c.hp=0;}
    out.push(comp);
  }
  return out;
}
```

保留旧 `detachDisconnected()` 作为兼容 wrapper：flatten components 后返回旧数组。

- [ ] **Step 4: Battle 创建 cluster**

`newGame()` 增加 `debrisClusters:[]`。

对于 component：

- `<2` 格：继续生成普通 `debris` FX；
- `>=2` 格：算 component 本地几何中心，保存每个 cell 相对中心的 `x/y/type/color`；
- cluster world center 由 `G.localToWorld(ship,cx,cy)` 得到；
- 初始 `vx/vy/angularVelocity` 使用现有 `U.rand`，life 约 `1.4~2.2s`。

- [ ] **Step 5: Battle update cluster**

```js
for(const c of state.debrisClusters){
  c.life-=dt;
  c.x+=c.vx*dt;c.y+=c.vy*dt;
  c.rotation+=c.angularVelocity*dt;
  c.vy+=55*dt;
  c.sinkProgress=Math.min(1,c.sinkProgress+dt*.55);
}
state.debrisClusters=state.debrisClusters.filter(c=>c.life>0);
```

- [ ] **Step 6: 跑 cluster + 历史断裂测试并提交**

Run:

```bash
node tests/v8_2_debris_cluster.test.js
node tests/v8_1_structure_break.test.js
node tests/v8_1_feedback_contract.test.js
```

Expected: PASS。

Commit: `feat: preserve detached hulls as debris clusters`

---

### Task 5: V8.2 渲染与准星部位提示

**Files:**
- Modify: `js/v8/40_render.js`
- Create: `tests/v8_2_render_contract.test.js`

**Interfaces:**
- Consumes: cell type、`state.debrisClusters`、`state.fx[k==='powderBlast']`、`state.aim`。
- Produces: 功能格可辨颜色、准星部位名、整块 cluster 绘制、powder blast 视觉。

- [ ] **Step 1: 写渲染合同 RED 测试**

静态断言 `40_render.js` 包含：

- `beam/powder/rudder/mast/cannon` 的颜色分支；
- `drawDebrisClusters`；
- `powderBlast`；
- `主梁/火药舱/舵机/桅杆/炮位` 映射。

- [ ] **Step 2: 运行确认 RED**

Run: `node tests/v8_2_render_contract.test.js`

Expected: FAIL。

- [ ] **Step 3: 扩展 cellColor**

```js
const COMPONENT_COLORS={
  beam:'#8f652f',powder:'#7c2f28',rudder:'#b9793d',mast:'#5a3824',cannon:'#454b52'
};
```

功能格在被 hull/deck 包围时仍按该颜色画，但保持现有网格描边，不增加科幻 UI。

- [ ] **Step 4: 准星显示部位名**

根据 `state.aim.gx/gy` 查 `ship.cellMap`，若该格或半径 1 格内最近存活格为功能格，准星上方短暂/持续显示对应中文名：

```js
const LABEL={beam:'主梁',powder:'火药舱',rudder:'舵机',mast:'桅杆',cannon:'炮位'};
```

- [ ] **Step 5: 绘制 powderBlast 和 debris cluster**

`drawDebrisClusters(state)`：对每个 cluster `save/translate/rotate/globalAlpha`，再按 cluster cell 相对坐标逐格绘制，随着 sinkProgress 增加整体下沉和透明度衰减。

`powderBlast`：比 `structureBreak` 更大的橙黄核心 + 外圈，持续约 0.62s。

- [ ] **Step 6: HUD 切换 V8.2 文案并提交**

HUD 主标题：`V8.2 · 部位破坏与连锁毁伤`。

底部提示：`瞄准火药舱可引爆内部 · 打断主梁会撕裂整块船体`。

Run:

```bash
node tests/v8_2_render_contract.test.js
node tests/v8_1_feedback_contract.test.js
node tests/v8_0_render_contract.test.js
```

Expected: PASS。

Commit: `feat: render V8.2 components and debris clusters`

---

### Task 6: 发布入口、全量回归与 Pages 验证

**Files:**
- Modify: `index.html`
- Create: `tests/v8_2_entry.test.js`
- Temporary create/delete: `.github/workflows/v8-2-regression.yml`

**Interfaces:**
- Consumes: 完成后的 V8.2 modules/tests。
- Produces: GitHub Pages 正式 V8.2 入口。

- [ ] **Step 1: 写入口 RED 测试**

断言：

```js
assert(index.includes('V8.2'));
for(const src of scripts)assert(src.includes('?v=8.2.0'));
assert(fs.existsSync('legacy_v7.html'));
assert(!index.includes('31_v73_proximity_boarding.js'));
```

- [ ] **Step 2: 运行确认 RED**

Run: `node tests/v8_2_entry.test.js`

Expected: FAIL，因为当前首页还是 V8.1 / `?v=8.1.0`。

- [ ] **Step 3: 更新 index.html**

只修改标题、横屏提示、说明注释和 6 个 V8 script cache key 到 `8.2.0`；不修改 `legacy_v7.html`。

- [ ] **Step 4: 创建临时全量 CI workflow**

Workflow 使用 Node 22，依次运行：

```bash
node tests/v8_2_components.test.js
node tests/v8_2_material_penetration.test.js
node tests/v8_2_powder_chain.test.js
node tests/v8_2_debris_cluster.test.js
node tests/v8_2_render_contract.test.js
node tests/v8_2_entry.test.js
node tests/v8_1_structure_break.test.js
node tests/v8_1_penetration.test.js
node tests/v8_1_aiming.test.js
node tests/v8_1_feedback_contract.test.js
node tests/v8_1_entry.test.js
node tests/v8_0_ship_grid.test.js
node tests/v8_0_battle.test.js
node tests/v8_0_render_contract.test.js
node tests/v8_0_entry.test.js
node tests/v8_0_single_enemy.test.js
for f in js/v8/*.js; do node --check "$f"; done
```

Legacy 阶段：临时 `cp legacy_v7.html index.html` 后执行 `tests/v6*.test.js tests/v7*.test.js`，结束恢复 V8 index 并 `git diff --exit-code`。

- [ ] **Step 5: 只根据失败日志修真实回归**

如果 V8.0/V8.1 测试与 V8.2 新语义直接冲突，只更新已经被新规格取代的断言；不得删除测试覆盖，不得为通过 CI 恢复旧功能。

- [ ] **Step 6: 全量 GREEN 后删除临时 workflow**

删除 `.github/workflows/v8-2-regression.yml`，比较最终 SHA 与已验证 SHA，确认差异仅 workflow 删除。

- [ ] **Step 7: 验证最终 GitHub Pages**

等待最终 `main` SHA 的 `pages build and deployment` conclusion 为 `success`，再宣布完成。

Commit sequence:

- `test: add V8.2 entry contract`
- `feat: publish V8.2 component destruction`
- `ci: run full V8.2 regression`
- `ci: remove temporary V8.2 regression workflow`

---

## Self-Review

- Spec coverage: 功能部位、确定性布局、材料穿透、powder 链式爆炸、rudder/mast/cannon 系统后果、beam 结构权重、整块残骸、功能格视觉、准星部位名、单舰规则、沉船阈值、legacy 保留、Pages 发布均有对应 Task。
- Placeholder scan: 无 TBD/TODO/“类似 Task N”或未定义接口。
- Type consistency: `material/critical/system`、`MATERIAL_RESISTANCE`、`detachDisconnectedComponents`、`debrisClusters`、`powderBlast` 在前置 Task 定义后由后续 Task 消费，命名一致。
