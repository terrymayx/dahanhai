# V6.0 自由接舷系统 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 V5.x 的固定上舷/下舷槽位接舷重构为连续接舷边界：敌船在旗舰右侧任意合理 Y 位置真实接触后就地锁舷、搭板、放海盗，并由船体碰撞决定多船是否能同时贴帮。

**Architecture:** 接舷型敌船继续保持 `approach -> closing -> docked -> retreat`，但彻底移除 `slot / upper / lower / both`。核心几何由 `js/10_model.js` 提供动态接触点；`js/21_boarding_update.js` 只消费动态接触数据完成靠近、锁舷和登船；`js/40_scene.js` 使用 `contactX/contactY` 动态绘制跳板/抓钩。V5.7 的接舷补丁行为合并回核心后删除，避免继续叠补丁。

**Tech Stack:** 原生 HTML5 Canvas、原生 JavaScript、Node.js 回归测试脚本、GitHub Pages。

**Spec:** `docs/superpowers/specs/2026-09-01-free-boarding-system-design.md`

## Global Constraints

- 不再存在固定接舷位语义：禁止 `SLOTS.upper / lower / both`、`slotBlocked()`、`chooseDockSlot()` 作为接舷核心依赖。
- 存活敌船从生成到接舷保持 `rot = 0`；只有沉船动画允许额外旋转。
- `deployBoarder(e)` 仅在 `e.state === 'docked' && e.contact === true` 且动态接触仍有效时返回 `true`。
- 多船是否能同时贴帮只由真实碰撞和空间决定；`docked` 船是静态障碍，`closing` 船不得推动已贴帮船。
- 保留 V5.5 自动开炮开关，默认关闭。
- 保留 V5.6 旗舰无限血测试模式。
- 保留 V5.8 甲板近战测试模式：弓箭手远程不射，海盗进入 `fight` 后恢复射击。
- 必须保留 `js/40_scene.js` 中 `const p=clamp(f.t/f.dur,0,1);` 的沉船卡死修复。
- 最终不再加载 `js/41_collision_visual.js` 和 `js/58_berthing_contact_fix.js`。
- 最终入口版本更新为 V6.0。

---

## File Structure

- `js/10_model.js` — 接舷几何、动态接触点、船体碰撞、敌船基础状态数据。
- `js/21_boarding_update.js` — 接舷船状态机、局部纵向避让、锁舷、海盗动态登船路径。
- `js/40_scene.js` — 动态跳板/抓钩绘制；保留所有现有场景和特效逻辑。
- `js/50_hud_overlay.js` — 删除固定上/下舷 HUD 和旧菜单说明，保留动态贴帮计数。
- `js/60_input_loop.js` — 主循环只对真实 `docked && contact` 敌船绘制接舷装置，不再依赖 `turning/rot`。
- `js/55_levels.js` — 不改关卡设计，只验证 `deployBoarder()` 包装的 boolean 语义。
- `js/56_auto_cannon.js` — 保留，回归测试。
- `js/57_infinite_ship_hp.js` — 保留，回归测试。
- `js/59_melee_test_mode.js` — 保留，回归测试。
- `index.html` — 删除旧补丁脚本，更新 V6.0 版本信息。
- `tests/v6_free_boarding.test.js` — Node 回归测试：静态约束 + 动态几何 + 登船语义。
- 删除 `js/41_collision_visual.js`。
- 删除 `js/58_berthing_contact_fix.js`。

---

### Task 1: 建立 V6.0 失败测试与旧逻辑护栏

**Files:**
- Create: `tests/v6_free_boarding.test.js`
- Read only: `js/10_model.js`, `js/21_boarding_update.js`, `js/40_scene.js`, `js/50_hud_overlay.js`, `js/55_levels.js`, `js/56_auto_cannon.js`, `js/57_infinite_ship_hp.js`, `js/59_melee_test_mode.js`, `index.html`

**Interfaces:**
- Consumes: 当前浏览器全局函数与源码文本。
- Produces: 一个可直接运行的 Node 测试入口 `node tests/v6_free_boarding.test.js`，后续所有任务都必须保持绿色。

- [ ] **Step 1: 写失败测试，先证明当前版本仍依赖固定槽位**

```js
const fs = require('fs');
const assert = require('assert');

const model = fs.readFileSync('js/10_model.js','utf8');
const boarding = fs.readFileSync('js/21_boarding_update.js','utf8');
const scene = fs.readFileSync('js/40_scene.js','utf8');
const hud = fs.readFileSync('js/50_hud_overlay.js','utf8');
const index = fs.readFileSync('index.html','utf8');

assert(!/const\s+SLOTS\s*=/.test(model), 'V6 core must not define fixed SLOTS');
assert(!/slotBlocked\s*\(/.test(model), 'V6 core must not use slotBlocked');
assert(!/chooseDockSlot\s*\(/.test(model), 'V6 core must not use chooseDockSlot');
assert(!/SLOTS\./.test(boarding), 'boarding routes must not depend on fixed SLOTS');
assert(!/上舷|下舷/.test(hud), 'HUD must not expose fixed boarding slots');
assert(!/41_collision_visual\.js/.test(index), 'old collision visual patch must not load');
assert(!/58_berthing_contact_fix\.js/.test(index), 'old berthing patch must not load');
assert(/clamp\(f\.t\/f\.dur,0,1\)/.test(scene), 'sink FX clamp regression must remain');
```

- [ ] **Step 2: 运行测试，确认 RED**

Run:

```bash
node tests/v6_free_boarding.test.js
```

Expected: FAIL on `SLOTS`, `slotBlocked`, `SLOTS.` 或旧补丁脚本加载中的至少一项；失败原因必须是 V6 行为尚未实现，而不是脚本路径错误。

- [ ] **Step 3: 加入动态几何行为测试骨架**

测试脚本中再加入一个纯几何参考函数，用来约束后续生产实现：

```js
function playerHullRightX(y){
  const P={cx:430,cy:560,rx:172,ry:310};
  const ny=(y-P.cy)/P.ry;
  if(Math.abs(ny)>=1)return P.cx;
  return P.cx+P.rx*Math.sqrt(Math.max(0,1-ny*ny));
}

for(const y of [330,430,560,690,790]){
  const x=playerHullRightX(y);
  assert(Number.isFinite(x));
  assert(x>=430 && x<=602);
}
```

- [ ] **Step 4: Commit 测试**

```bash
git add tests/v6_free_boarding.test.js
git commit -m "test: define V6 free boarding expectations"
```

---

### Task 2: 重写核心接舷几何，删除固定槽位模型

**Files:**
- Modify: `js/10_model.js`
- Test: `tests/v6_free_boarding.test.js`

**Interfaces:**
- Consumes: `PLAYER_COLLIDER`, `enemyCollider(e)`, 敌船 `x/y/state`。
- Produces:
  - `clampContactY(y, enemyRy) -> number`
  - `contactPointForEnemy(e) -> {x:number,y:number,normalX:number,normalY:number}`
  - `enemyBowX(e) -> number`
  - `shipsTouchPlayer(e) -> boolean`
  - `lockEnemyContact(e) -> boolean`
  - `clearEnemyContact(e) -> void`
  - 敌船字段：`contact`, `contactX`, `contactY`, `contactNormalX`, `contactNormalY`

- [ ] **Step 1: 扩展失败测试，要求核心暴露动态接触字段且不再创建 `slot`**

在测试中增加源码断言：

```js
assert(!/slot:null/.test(model), 'enemy spawn must not create slot');
assert(/contactX/.test(model));
assert(/contactY/.test(model));
assert(/function\s+contactPointForEnemy/.test(model));
assert(/function\s+lockEnemyContact/.test(model));
```

Run:

```bash
node tests/v6_free_boarding.test.js
```

Expected: FAIL because current model has `slot:null` and lacks dynamic contact helpers.

- [ ] **Step 2: 在 `js/10_model.js` 删除固定槽位数据与函数**

删除：

```js
const SLOTS=...
function slotTargetY(...)
function slotBlocked(...)
function chooseDockSlot(...)
```

敌船生成对象改为：

```js
const e={
  type,t,s:t.s,x:2070,y:rand(250,870),hp:t.hp,max:t.hp,
  state:'approach',rot:0,
  deployed:0,deployT:0,shootT:rand(2.4,4),flash:0,ph:rand(0,6.28),
  sinkT:0,clearT:0,contact:false,
  contactX:null,contactY:null,contactNormalX:1,contactNormalY:0,
  rangeX:rand(1260,1510),rangeY:rand(300,820),gone:false
};
```

- [ ] **Step 3: 实现动态接触点函数**

在船体碰撞段加入：

```js
function clampContactY(y,enemyRy=0){
  const pad=Math.min(70,Math.max(16,enemyRy*.20));
  return clamp(y,PLAYER_COLLIDER.cy-PLAYER_COLLIDER.ry+pad,
                 PLAYER_COLLIDER.cy+PLAYER_COLLIDER.ry-pad);
}
function contactPointForEnemy(e){
  const c=enemyCollider(e);
  const y=clampContactY(e.y,c.ry);
  const x=playerHullRightX(y);
  const nx=Math.max(1e-6,(x-PLAYER_COLLIDER.cx)/(PLAYER_COLLIDER.rx*PLAYER_COLLIDER.rx));
  const ny=(y-PLAYER_COLLIDER.cy)/(PLAYER_COLLIDER.ry*PLAYER_COLLIDER.ry);
  const mag=Math.hypot(nx,ny)||1;
  return {x,y,normalX:nx/mag,normalY:ny/mag};
}
function enemyBowX(e){return e.x-enemyCollider(e).rx;}
function shipsTouchPlayer(e){
  if(!e||e.state==='sink'||e.gone)return false;
  const p=contactPointForEnemy(e);
  const c=enemyCollider(e);
  const verticalOverlap=Math.abs(e.y-p.y)<=Math.max(24,c.ry*.72);
  return verticalOverlap&&enemyBowX(e)<=p.x+PLAYER_COLLIDER.skin+3;
}
function lockEnemyContact(e){
  if(!shipsTouchPlayer(e))return false;
  const p=contactPointForEnemy(e),c=enemyCollider(e);
  e.x=p.x+c.rx-PLAYER_COLLIDER.skin;
  e.contact=true;e.contactX=p.x;e.contactY=p.y;
  e.contactNormalX=p.normalX;e.contactNormalY=p.normalY;
  return true;
}
function clearEnemyContact(e){
  e.contact=false;e.contactX=null;e.contactY=null;
  e.contactNormalX=1;e.contactNormalY=0;
}
```

- [ ] **Step 4: 改造旗舰外侧约束，只使用当前几何而非槽位**

```js
function constrainEnemyOutsidePlayer(e){
  if(!e||e.state==='sink'||e.gone||e.t.role==='ranged'||e.state==='docked')return;
  const c=enemyCollider(e),p=contactPointForEnemy(e);
  const minX=p.x+c.rx-PLAYER_COLLIDER.skin;
  if(e.x<minX)e.x=minX;
}
```

注意：后续 Task 3 的 `closing` 会在真正锁舷前调用 `lockEnemyContact()`，因此不能再用旧 `dockCX(slotY)`。

- [ ] **Step 5: 更新碰撞排序规则，`docked` 永远静态**

保持现有 AABB 分离算法，但确认：

```js
const staticA=A.state==='docked'&&A.contact;
const staticB=B.state==='docked'&&B.contact;
```

当一方静态时只移动另一方；两方都静态时不互推。

- [ ] **Step 6: 运行测试**

```bash
node tests/v6_free_boarding.test.js
```

Expected: Task 2 新增断言 PASS；整体测试仍可能在 boarding/HUD/旧补丁项保持 RED。

- [ ] **Step 7: Commit**

```bash
git add js/10_model.js tests/v6_free_boarding.test.js
git commit -m "refactor: replace boarding slots with dynamic contact geometry"
```

---

### Task 3: 重写接舷状态机与动态登船路径

**Files:**
- Modify: `js/21_boarding_update.js`
- Test: `tests/v6_free_boarding.test.js`

**Interfaces:**
- Consumes: `contactPointForEnemy`, `lockEnemyContact`, `clearEnemyContact`, `enemyCollider`, `enemyBowX`, `resolveEnemyShipCollisions`。
- Produces:
  - `findLocalBerthingOffset(e) -> number`
  - `deployBoarder(e) -> boolean`
  - `docked` 敌船始终带稳定 `contactX/contactY`

- [ ] **Step 1: 写失败测试，禁止 boarding 文件继续出现固定槽位**

```js
assert(!/SLOTS\./.test(boarding));
assert(!/chooseDockSlot\s*\(/.test(boarding));
assert(!/slotTargetY\s*\(/.test(boarding));
assert(/contactY/.test(boarding));
```

Run:

```bash
node tests/v6_free_boarding.test.js
```

Expected: FAIL on current `SLOTS` / `chooseDockSlot` / `slotTargetY` references.

- [ ] **Step 2: 重写 `deployBoarder(e)` 的入口保护**

函数开头必须是：

```js
function deployBoarder(e){
  if(!e||e.state!=='docked'||!e.contact||
     !Number.isFinite(e.contactX)||!Number.isFinite(e.contactY)||
     !shipsTouchPlayer(e))return false;
```

然后使用：

```js
const bowX=enemyBowX(e)+18;
const entryX=Math.min(580,e.contactX-18);
const entryY=e.contactY;
```

- [ ] **Step 3: 重写三种登船路径为动态接触点**

`plank`：

```js
const landing={x:entryX,y:entryY+rand(-26,26)};
g.boarders.push({
  ship:e,hp,max:hp,band,
  x:bowX,y:e.y+rand(-14,14),i:0,atkT:rand(.3,.7),anim:0,
  method:'plank',state:'plank',
  wp:[{x:e.contactX+12,y:e.contactY},{x:landing.x,y:landing.y}]
});
```

`swing`：

```js
const anchor={x:bowX+10,y:e.y+rand(-26,26)};
const to={x:entryX,y:entryY+rand(-55,55)};
g.boarders.push({
  ship:e,hp,max:hp,band,x:anchor.x,y:anchor.y+28,
  atkT:rand(.3,.7),anim:0,method:'swing',state:'swing',
  swingT:0,dur:.9,anchor,from:{x:anchor.x,y:anchor.y+28},to
});
```

`climb`：

```js
const to={x:entryX,y:entryY+rand(-32,32)};
g.boarders.push({
  ship:e,hp,max:hp,band,x:bowX,y:e.y+rand(-24,24),
  atkT:rand(.3,.7),anim:0,method:'climb',state:'climb',climbT:0,to
});
```

保留函数末尾 `return true`。

- [ ] **Step 4: 加入局部纵向避让，不做固定目标 Y**

```js
function findLocalBerthingOffset(e){
  const c=enemyCollider(e);
  let push=0;
  for(const o of g.enemies){
    if(o===e||o.gone||o.state==='sink'||o.t.role==='ranged')continue;
    const oc=enemyCollider(o);
    const dx=Math.abs(o.x-e.x);
    const minDx=c.rx+oc.rx+40;
    if(dx>minDx)continue;
    const dy=e.y-o.y;
    const need=c.ry+oc.ry+12-Math.abs(dy);
    if(need>0)push+=(dy>=0?1:-1)*Math.min(need,55);
  }
  return clamp(push,-70,70);
}
```

- [ ] **Step 5: 重写 `approach/closing/docked/retreat`**

接舷型敌船逻辑替换为：

```js
if(e.state==='approach'||e.state==='hold'){
  const p=contactPointForEnemy(e);
  const c=enemyCollider(e);
  const enterX=p.x+c.rx+470;
  e.x-=e.t.sp*SPD*dt;
  if(e.x<=enterX)e.state='closing';
}else if(e.state==='closing'){
  const avoid=findLocalBerthingOffset(e);
  const lateralSpeed=Math.max(28,e.t.sp*.36)*SPD;
  e.y+=clamp(avoid,-lateralSpeed*dt,lateralSpeed*dt);

  const p=contactPointForEnemy(e),c=enemyCollider(e);
  const targetX=p.x+c.rx-PLAYER_COLLIDER.skin;
  const gap=Math.max(0,e.x-targetX);
  const speed=Math.max(28,e.t.sp*clamp(gap/360,.30,.72))*SPD;
  e.x=Math.max(targetX,e.x-speed*dt);

  if(lockEnemyContact(e)){
    e.state='docked';e.deployT=.18;e.clearT=0;
    g.warnT=3.5;sfx.alarm();
  }
}else if(e.state==='docked'){
  e.rot=0;
  if(!e.contact||!Number.isFinite(e.contactX)||!Number.isFinite(e.contactY)){
    clearEnemyContact(e);e.state='closing';continue;
  }
  const c=enemyCollider(e);
  e.x=e.contactX+c.rx-PLAYER_COLLIDER.skin;
  e.y+=(e.contactY-e.y)*Math.min(1,dt*4);

  if(e.deployed<e.t.pir){
    e.deployT-=dt*SPD;
    if(e.deployT<=0){
      e.deployT=e.type==='manowar'?.72:.95;
      if(deployBoarder(e))e.deployed++;
    }
  }else if(!g.boarders.some(b=>b.ship===e&&b.hp>0)){
    e.clearT+=dt;
    if(e.clearT>1.0){clearEnemyContact(e);e.state='retreat';}
  }else e.clearT=0;
}else if(e.state==='retreat'){
  clearEnemyContact(e);e.rot=0;
  e.x+=e.t.sp*.9*dt;
  if(e.x>2180)e.gone=true;
}
```

- [ ] **Step 6: 处理船沉没时接触数据**

进入 `sink` 的代码路径必须调用：

```js
clearEnemyContact(e);
```

但已进入 `fight` 的海盗保留；还在 `plank/swing/climb` 且母船沉没的海盗按现有规则清理或失效，不能继续从不存在的船生成新海盗。

- [ ] **Step 7: 跑测试**

```bash
node tests/v6_free_boarding.test.js
```

Expected: boarding 固定槽位断言全部 PASS；`deployBoarder` 仍由后续集成测试验证。

- [ ] **Step 8: Commit**

```bash
git add js/21_boarding_update.js tests/v6_free_boarding.test.js
git commit -m "refactor: make boarding contact and routes fully dynamic"
```

---

### Task 4: 动态绘制跳板和抓钩，清除旧转向视觉假设

**Files:**
- Modify: `js/40_scene.js`
- Modify: `js/60_input_loop.js`
- Test: `tests/v6_free_boarding.test.js`

**Interfaces:**
- Consumes: `e.contactX`, `e.contactY`, `enemyBowX(e)`, `e.state`, `e.contact`。
- Produces: `drawDockedGear(e)` 只依赖动态接触点；主循环只为真实贴帮船调用。

- [ ] **Step 1: 写失败测试，禁止视觉层读取 `SLOTS` 或 `rot>0.9`**

```js
const input = fs.readFileSync('js/60_input_loop.js','utf8');
assert(!/SLOTS\./.test(scene), 'scene docking gear must be dynamic');
assert(!/rot\s*>\s*0\.9/.test(input), 'main loop must not gate boarding gear by rotation');
```

Run:

```bash
node tests/v6_free_boarding.test.js
```

Expected: FAIL on current scene/input behavior。

- [ ] **Step 2: 用动态接触点重写 `drawDockedGear(e)`**

```js
function drawDockedGear(e){
  if(!e||e.state!=='docked'||!e.contact||
     !Number.isFinite(e.contactX)||!Number.isFinite(e.contactY))return;

  const bowX=enemyBowX(e);
  const enemyDeckX=bowX+Math.max(46,72*e.s);
  const count=e.type==='manowar'?2:1;
  const offsets=count===2?[-34,34]:[0];

  for(const off of offsets){
    const y=clampContactY(e.contactY+off,enemyCollider(e).ry*.2);
    const playerX=playerHullRightX(y)-10;
    const enemyY=e.y+clamp(y-e.y,-48,48);
    const dx=enemyDeckX-playerX,dy=enemyY-y;
    const len=Math.max(42,Math.hypot(dx,dy));
    const ang=Math.atan2(dy,dx);

    ctx.save();ctx.translate((playerX+enemyDeckX)/2,(y+enemyY)/2);ctx.rotate(ang);
    rr(-len/2,-12,len,24,5);ctx.fillStyle='#b5793a';ctx.fill();
    ctx.strokeStyle='#7a4a21';ctx.lineWidth=4;ctx.stroke();ctx.restore();

    ctx.strokeStyle='#b98c4f';ctx.lineWidth=4;ctx.lineCap='round';ctx.beginPath();
    ctx.moveTo(enemyDeckX+8,enemyY-16);
    ctx.quadraticCurveTo((enemyDeckX+playerX)/2,y-28,playerX,y-6);
    ctx.stroke();
  }
}
```

- [ ] **Step 3: 保留沉船卡死修复**

确认 `drawFxAll()` 仍有且只使用有界进度：

```js
f.t+=dt; const p=clamp(f.t/f.dur,0,1);
```

禁止改回未 clamp 的 `f.t/f.dur`。

- [ ] **Step 4: 修改主循环接舷装置绘制条件**

将旧：

```js
if((e.state==='turning'||e.state==='docked')&&e.rot>0.9) drawDockedGear(e);
```

替换为：

```js
for(const e of g.enemies){
  if(e.state==='docked'&&e.contact)drawDockedGear(e);
}
```

- [ ] **Step 5: 跑测试**

```bash
node tests/v6_free_boarding.test.js
```

Expected: scene/input 固定槽位与旋转门槛断言 PASS，沉船 clamp 断言 PASS。

- [ ] **Step 6: Commit**

```bash
git add js/40_scene.js js/60_input_loop.js tests/v6_free_boarding.test.js
git commit -m "refactor: render boarding gear from live contact points"
```

---

### Task 5: HUD 和菜单切换为自由接舷语义

**Files:**
- Modify: `js/50_hud_overlay.js`
- Test: `tests/v6_free_boarding.test.js`

**Interfaces:**
- Consumes: `g.enemies`, `g.boarders`, `boardingMode()`。
- Produces: HUD 只显示真实贴帮数量，不显示固定上/下舷状态。

- [ ] **Step 1: 写失败测试**

```js
assert(!/上舷|下舷|双舷/.test(hud));
assert(/state==='docked'.*contact|contact.*state==='docked'/.test(hud.replace(/\s+/g,' ')));
```

Run:

```bash
node tests/v6_free_boarding.test.js
```

Expected: FAIL because current HUD/menu仍包含上舷/下舷文字。

- [ ] **Step 2: 修改贴帮计数**

```js
const docked=g.enemies.filter(e=>e.state==='docked'&&e.contact).length;
txt('接舷战！'+docked+' 艘贴帮 · '+g.boarders.length+' 名海盗',980,70,32,'#ffffff','#5a1818',5);
```

- [ ] **Step 3: 删除固定槽位 HUD**

完全删除：

```js
const up=slotBlocked(...)
const lo=slotBlocked(...)
txt('上舷 ...')
txt('下舷 ...')
```

- [ ] **Step 4: 更新菜单说明**

用下面两句替换固定槽位说明：

```js
'⚓ 敌船可在旗舰右侧任意位置真实贴帮，哪里碰到就在哪里接舷',
'🪝 多艘船能否同时靠上来只由船体碰撞和实际空间决定',
```

- [ ] **Step 5: 跑测试并提交**

```bash
node tests/v6_free_boarding.test.js
git add js/50_hud_overlay.js tests/v6_free_boarding.test.js
git commit -m "ui: replace fixed boarding slots with free-contact HUD"
```

---

### Task 6: 删除 V5.x 接舷补丁并更新 V6.0 入口

**Files:**
- Delete: `js/41_collision_visual.js`
- Delete: `js/58_berthing_contact_fix.js`
- Modify: `index.html`
- Test: `tests/v6_free_boarding.test.js`

**Interfaces:**
- Consumes: Tasks 2–5 已经合并回核心的行为。
- Produces: 干净的 V6.0 加载链，不再叠旧接舷补丁。

- [ ] **Step 1: 确认删除前测试仍对旧脚本保持 RED**

```bash
node tests/v6_free_boarding.test.js
```

Expected: 如果前面任务尚未改 index，仍 FAIL on old patch script references。

- [ ] **Step 2: 删除旧文件**

```bash
git rm js/41_collision_visual.js js/58_berthing_contact_fix.js
```

- [ ] **Step 3: 更新 `index.html`**

删除：

```html
<script src="js/41_collision_visual.js"></script>
<script src="js/58_berthing_contact_fix.js"></script>
```

保留加载顺序：

```html
<script src="js/00_base.js"></script>
<script src="js/10_model.js"></script>
<script src="js/20_combat_skills.js"></script>
<script src="js/21_boarding_update.js"></script>
<script src="js/30_art_units.js"></script>
<script src="js/40_scene.js"></script>
<script src="js/50_hud_overlay.js"></script>
<script src="js/55_levels.js"></script>
<script src="js/56_auto_cannon.js"></script>
<script src="js/57_infinite_ship_hp.js"></script>
<script src="js/59_melee_test_mode.js"></script>
<script src="js/60_input_loop.js"></script>
```

标题改为：

```html
<title>大航海时代 V6.0 · 自由接舷系统</title>
```

横屏提示改为：

```html
<small style="font-size:14px;opacity:.7">大航海时代 · V6.0 自由接舷</small>
```

- [ ] **Step 4: 跑测试**

```bash
node tests/v6_free_boarding.test.js
```

Expected: 所有静态结构测试 PASS。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove legacy boarding patches for V6"
```

---

### Task 7: 回归关卡、自动开炮、无限血和甲板近战测试模式

**Files:**
- Modify only if test exposes incompatibility: `js/55_levels.js`, `js/56_auto_cannon.js`, `js/57_infinite_ship_hp.js`, `js/59_melee_test_mode.js`
- Test: `tests/v6_free_boarding.test.js`

**Interfaces:**
- Consumes: 新 `deployBoarder(e) -> boolean` 与 V6 状态机。
- Produces: 所有 V5.5/V5.6/V5.8 独立测试功能继续工作。

- [ ] **Step 1: 在测试中加入关卡 wrapper 语义检查**

```js
const levels=fs.readFileSync('js/55_levels.js','utf8');
assert(/const deployed=_deployBoarderLevel\(e\)/.test(levels));
assert(/if\(!deployed\)return false/.test(levels));
assert(/return true/.test(levels));
```

- [ ] **Step 2: 加入自动开炮默认关闭检查**

```js
const auto=fs.readFileSync('js/56_auto_cannon.js','utf8');
assert(/state\.autoCannon=false/.test(auto));
assert(/if\(!g\.autoCannon\)return false/.test(auto));
```

- [ ] **Step 3: 加入旗舰无限血检查**

```js
const hp=fs.readFileSync('js/57_infinite_ship_hp.js','utf8');
assert(/state\.infiniteShipHP=true/.test(hp));
assert(/g\.player\.hp=g\.player\.max/.test(hp));
```

- [ ] **Step 4: 加入甲板弓箭测试模式检查**

```js
const melee=fs.readFileSync('js/59_melee_test_mode.js','utf8');
assert(/b\.state==='fight'/.test(melee));
assert(/g\.arrows\.length=0/.test(melee));
```

- [ ] **Step 5: 运行测试**

```bash
node tests/v6_free_boarding.test.js
```

Expected: PASS。如果失败，只做最小兼容修复，不改变这些独立功能的产品规则。

- [ ] **Step 6: Commit（只有发生兼容修复时）**

```bash
git add js/55_levels.js js/56_auto_cannon.js js/57_infinite_ship_hp.js js/59_melee_test_mode.js tests/v6_free_boarding.test.js
git commit -m "fix: preserve combat test modes under free boarding"
```

如果没有生产文件变化，只提交新增测试断言：

```bash
git add tests/v6_free_boarding.test.js
git commit -m "test: cover V6 combat mode regressions"
```

---

### Task 8: 浏览器烟雾测试与最终发布验证

**Files:**
- Test: `tests/v6_free_boarding.test.js`
- Verify: `index.html` + 全部 `js/*.js`

**Interfaces:**
- Consumes: 完整 V6.0 页面。
- Produces: 可发布的 GitHub Pages V6.0。

- [ ] **Step 1: 全量 JS 语法检查**

Run:

```bash
for f in js/*.js tests/*.js; do node --check "$f" || exit 1; done
```

Expected: exit 0, no syntax errors。

- [ ] **Step 2: 运行完整 V6 回归测试**

```bash
node tests/v6_free_boarding.test.js
```

Expected: `PASS: V6.0 free boarding regression`，0 failures。

- [ ] **Step 3: 启动本地静态服务并运行浏览器烟雾测试**

Run:

```bash
python -m http.server 4173
```

用 Chromium/Chrome 打开 `http://127.0.0.1:4173/`，至少验证以下场景：

1. 第一波开始后自动开炮保持关闭；
2. 弓箭手不会远程射敌船；
3. 至少一艘接舷船在非固定 428/668 的 Y 位置贴上旗舰；
4. 接触后出现动态跳板/抓钩；
5. 海盗沿该动态接触点进入旗舰；
6. 海盗进入 `fight` 后弓箭手恢复射击；
7. 两艘纵向不重叠的接舷船可以同时贴帮；
8. 两艘会重叠的船不能互相穿过；
9. 巨舰不再出现“both/双舷槽位”行为；
10. 击沉敌船后动画循环继续运行至少 2 秒且 console 无 exception；
11. 旗舰受到伤害时仍显示受击反馈但 HP 保持满值。

- [ ] **Step 4: 检查旧槽位残留**

Run:

```bash
grep -RInE "SLOTS\.|slotBlocked\(|chooseDockSlot\(|slotTargetY\(|上舷|下舷|both" js index.html || true
```

Expected: 接舷核心和 HUD 中无旧槽位语义。允许出现与其他无关文本时必须人工确认不是接舷逻辑。

- [ ] **Step 5: 检查沉船 clamp**

Run:

```bash
grep -n "clamp(f.t/f.dur,0,1)" js/40_scene.js
```

Expected: exactly one active sink/effect progress clamp line or equivalent bounded expression。

- [ ] **Step 6: 最终 Commit**

如烟雾测试产生最后的小修复：

```bash
git add -A
git commit -m "publish: V6 free boarding system"
```

若无需修复，则不制造空提交。

- [ ] **Step 7: 发布后回读验证**

从 GitHub default branch 回读：

- `index.html`
- `js/10_model.js`
- `js/21_boarding_update.js`
- `js/40_scene.js`
- `js/50_hud_overlay.js`
- `js/60_input_loop.js`

确认：版本为 V6.0、旧补丁脚本不再加载、动态 contact 函数和动态 boarding 路径已实际提交。

---

## Self-Review Result

- Spec coverage: 已覆盖动态接触、任意 Y 接舷、多船碰撞、巨舰自然占位、动态跳板/抓钩、动态海盗入口、HUD 清理、旧补丁删除、V5.5/V5.6/V5.8 回归、沉船 clamp、浏览器烟雾测试。
- Placeholder scan: 无 TBD/TODO/“后续实现”占位项。
- Type consistency: 全计划统一使用 `contactX/contactY/contactNormalX/contactNormalY/contact`；`deployBoarder(e)` 始终返回 boolean；不再引入新 `slot` 语义。
- Scope: 只重构接舷相关架构及必要兼容回归，不扩展关卡、AI、技能或新敌船类型。
