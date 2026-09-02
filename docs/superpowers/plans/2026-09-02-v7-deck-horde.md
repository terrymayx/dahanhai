# V7.0 Deck Horde Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build V7.0 deck-horde combat with three-lane pirate pressure, an 8-crew dynamic defense, knockback/downed/overboard feedback, and a hard 40-active-boarder cap while preserving V6.3–V6.9 behavior.

**Architecture:** Add one late-loaded compatibility layer, `js/27_v70_deck_horde.js`, after `js/26_v69_side_retreat.js` and before `js/60_input_loop.js`. V7.0 wraps existing globals instead of rewriting stable V6.3–V6.9 core files. Per-frame crowd state is precomputed once into reusable counters/hash buffers; deaths/overboard removals are finalized only after the older V6.8 update wrapper has completed, preventing double-release into `boarderPool`.

**Tech Stack:** Vanilla JavaScript, Canvas 2D, Node.js `assert` + `vm` regression tests, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-02-v7-deck-horde-design.md`

## Global Constraints

- Keep V6.9 endless waves at exactly 15 seconds.
- Keep all enemy ships as non-ranged troop carriers.
- Keep troop carriers disappearing immediately after unloading.
- Keep 8 player crew.
- Never weaken the existing physical-contact guard inside `deployBoarder(e)`.
- Keep V6.4 boarding channels released only on real `fight` entry.
- Keep V6.8 pools, spatial hashing, visual caps, and `clamp(f.t/f.dur,0,1)` sink-FX fix.
- `V70_MAX_ACTIVE_BOARDERS = 40`.
- `V70_MAX_DOWNED = 10`.
- No new all-pairs pirate crowd loop and no per-pirate per-frame temporary arrays/Sets.

---

### Task 1: Add V7.0 RED regression

**Files:**
- Create: `tests/v7_0_deck_horde.test.js`
- Create temporarily: `.github/workflows/v70-deck-horde.yml`

**Interfaces:**
- Consumes: current `index.html`, V6.6 deck AI, V6.8 performance layer, V6.9 wave/cleanup layers.
- Produces: executable regression contract for all V7.0 requirements.

- [ ] **Step 1: Write the failing test**

Create `tests/v7_0_deck_horde.test.js`:

```js
const fs=require('fs');
const assert=require('assert');
const vm=require('vm');
const read=p=>fs.readFileSync(p,'utf8');
const index=read('index.html');
const path='js/27_v70_deck_horde.js';
assert(fs.existsSync(path),'V7.0 deck-horde layer must exist');
const v70=read(path);

assert.match(index,/V7\.0/);
assert.match(index,/js\/27_v70_deck_horde\.js/);
assert.ok(index.indexOf('js/26_v69_side_retreat.js')<index.indexOf('js/27_v70_deck_horde.js'));
assert.ok(index.indexOf('js/27_v70_deck_horde.js')<index.indexOf('js/60_input_loop.js'));
assert.match(v70,/const\s+V70_MAX_ACTIVE_BOARDERS\s*=\s*40\b/);
assert.match(v70,/const\s+V70_MAX_DOWNED\s*=\s*10\b/);
for(const fn of [
  'v70LaneForY','ensureV70Lane','v70ActiveBoarderCount','v70RefreshFrameCache',
  'chooseV70BoarderTarget','chooseV70CrewTarget','applyV70Impact','queueV70Death',
  'flushV70PendingDeaths','updateV70Downed','drawV70Downed'
]) assert(new RegExp(`function\\s+${fn}`).test(v70),`${fn} missing`);
assert.match(v70,/deployBoarder\s*=\s*function/);
assert.match(v70,/enterBoarderFight\s*=\s*function/);
assert.match(v70,/damageBoarder\s*=\s*function/);
assert.match(v70,/new\s+V68SpatialHash\s*\(/,'V7.0 must reuse V6.8 spatial hash class');
assert.doesNotMatch(v70,/for\s*\([^)]*g\.boarders[^)]*\)\s*for\s*\([^)]*g\.boarders/,'no all-pairs pirate loop');

const helper=v70.match(/\/\* V7\.0 DECK HORDE HELPERS START \*\/([\s\S]*?)\/\* V7\.0 DECK HORDE HELPERS END \*\//);
assert(helper,'helper block must be extractable');
const ctx={Math,g:{boarders:[],v70Downed:[],crew:[]},DECK_COMBAT_BOUNDS:{minX:300,maxX:590,minY:285,maxY:835},clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),dist:(x1,y1,x2,y2)=>Math.hypot(x2-x1,y2-y1),isV67Sailor:c=>/^sailor/.test(c.id||'')};
vm.createContext(ctx);vm.runInContext(helper[1],ctx);
assert.equal(ctx.v70LaneForY(350),0);
assert.equal(ctx.v70LaneForY(560),1);
assert.equal(ctx.v70LaneForY(780),2);
```

Later tasks append runtime assertions to this same test rather than creating duplicate test files.

- [ ] **Step 2: Add temporary CI**

Create `.github/workflows/v70-deck-horde.yml`:

```yaml
name: V7.0 Deck Horde
on:
  push:
    branches: [ main ]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - name: Check JavaScript syntax
        run: for f in js/*.js; do node --check "$f"; done
      - name: Run V7.0 regression
        run: node tests/v7_0_deck_horde.test.js
```

- [ ] **Step 3: Trigger and observe RED**

If workflow creation itself does not trigger, make a comment-only edit in the V7 test. Expected result: JS syntax passes, V7.0 regression fails because `js/27_v70_deck_horde.js` is absent.

- [ ] **Step 4: Record RED run id**

Keep the failing run id for final red/green evidence.

---

### Task 2: Three-lane state, frame cache, and 40-active gate

**Files:**
- Create: `js/27_v70_deck_horde.js`
- Modify: `tests/v7_0_deck_horde.test.js`

**Interfaces:**
- Consumes: current V6.8-pooled `deployBoarder`, V6.6 `enterBoarderFight`, `V68SpatialHash`.
- Produces: constants, stable `assaultLane`, cached lane pressure, cached target loads, reusable fight spatial hash, active-count gate.

- [ ] **Step 1: Extend RED with lane stability/cap assertions**

```js
const b={y:360,boardingLaneY:360};
assert.equal(ctx.ensureV70Lane(b),0);
b.y=780;
assert.equal(ctx.ensureV70Lane(b),0,'lane must not oscillate after assignment');
ctx.g.boarders=Array.from({length:39},(_,i)=>({hp:10,state:'fight',assaultLane:i%3}));
ctx.g.v70Downed=[{state:'downed'}];
assert.equal(ctx.v70ActiveBoarderCount(),40);
```

Expected: FAIL before production code exists.

- [ ] **Step 2: Add helper block with constants inside the marker**

```js
/* V7.0：甲板人潮近战。 */
/* V7.0 DECK HORDE HELPERS START */
const V70_MAX_ACTIVE_BOARDERS=40;
const V70_MAX_DOWNED=10;
const V70_LANE_Y=[380,560,740];
const V70_CREW_IDS=['captain','sailor1','sailor2','sailor3','sailor4','gunner','archer','drummer'];
const v70Pressure=[0,0,0];
const v70TargetLoads={captain:0,sailor1:0,sailor2:0,sailor3:0,sailor4:0,gunner:0,archer:0,drummer:0};
function v70LaneForY(y){return y<470?0:y>650?2:1;}
function ensureV70Lane(b){if(!Number.isFinite(b.assaultLane))b.assaultLane=v70LaneForY(Number.isFinite(b.boardingLaneY)?b.boardingLaneY:b.y);return b.assaultLane;}
function v70ActiveBoarderCount(){let n=g.v70Downed?g.v70Downed.length:0;for(const b of g.boarders)if(b.hp>0&&(b.state==='plank'||b.state==='swing'||b.state==='climb'||b.state==='fight'))n++;return n;}
/* V7.0 DECK HORDE HELPERS END */
```

- [ ] **Step 3: Add reusable spatial/counter frame cache outside helper marker**

```js
const v70FightGrid=new V68SpatialHash(96);
const v70Near=new Set();
function v70RefreshFrameCache(){
  v70Pressure[0]=v70Pressure[1]=v70Pressure[2]=0;
  for(const id of V70_CREW_IDS)v70TargetLoads[id]=0;
  v70FightGrid.clear();
  for(const b of g.boarders){
    if(b.hp<=0)continue;
    if(b.state==='plank'||b.state==='swing'||b.state==='climb'||b.state==='fight')v70Pressure[ensureV70Lane(b)]++;
    if(b.state==='fight'){
      v70FightGrid.insertPoint(b,b.x,b.y);
      if(b.targetCrewId&&v70TargetLoads[b.targetCrewId]!==undefined)v70TargetLoads[b.targetCrewId]++;
    }
  }
}
function v70LocalClusterCount(b,r=105){
  let n=0;v70FightGrid.queryAABBInto(v70Near,b.x-r,b.y-r,b.x+r,b.y+r);
  for(const o of v70Near)if(o.hp>0&&o.state==='fight'&&dist(b.x,b.y,o.x,o.y)<=r)n++;
  return n;
}
```

This is one O(n) cache build per frame plus local hash queries; it replaces per-pirate scans of all pirates.

- [ ] **Step 4: Gate deployment before delegating to existing guarded implementation**

```js
const _deployBoarderV70=deployBoarder;
deployBoarder=function(e){
  if(v70ActiveBoarderCount()>=V70_MAX_ACTIVE_BOARDERS)return false;
  return _deployBoarderV70(e);
};
```

- [ ] **Step 5: Assign stable lane only on real fight entry**

```js
const _enterBoarderFightV70=enterBoarderFight;
enterBoarderFight=function(b){_enterBoarderFightV70(b);ensureV70Lane(b);};
```

- [ ] **Step 6: Run V7 test and commit**

Expected: lane/cap/static architecture assertions green; targeting/impact assertions still red.

Commit: `feat: add V7.0 lane cache and boarder cap`.

---

### Task 3: Pirate encirclement and 8-crew dynamic defense

**Files:**
- Modify: `js/27_v70_deck_horde.js`
- Modify: `tests/v7_0_deck_horde.test.js`

**Interfaces:**
- Consumes: `isV67Sailor`, cached `v70Pressure`, cached `v70TargetLoads`, `v70FightGrid`, V6.6 crew movement.
- Produces: front/back role scoring, target-load balancing without O(n²), pressure-based crew targeting/idle anchors.

- [ ] **Step 1: Add failing target tests**

Use an 8-crew fixture. Verify:
- an upper-lane pirate before breakthrough prefers captain/sailor over a slightly nearer backliner;
- after `b.x<455`, backliners are eligible;
- high upper pressure makes a front sailor prefer an upper-lane fight target;
- cached target load causes equally placed pirates to spread across crew.

- [ ] **Step 2: Add front-role/target helpers inside helper block**

```js
function isV70FrontCrew(c){return !!c&&(c.id==='captain'||isV67Sailor(c));}
function setV70BoarderTarget(b,c){
  const old=b.targetCrewId;if(old&&v70TargetLoads[old]>0)v70TargetLoads[old]--;
  b.targetCrewId=c?c.id:null;if(c&&v70TargetLoads[c.id]!==undefined)v70TargetLoads[c.id]++;
  return c;
}
function chooseV70BoarderTarget(b){
  const lane=ensureV70Lane(b),laneY=V70_LANE_Y[lane],broken=b.x<455;
  let best=null,bestScore=Infinity;
  for(const c of g.crew){
    if(!c.alive)continue;
    const front=isV70FrontCrew(c);
    let score=dist(b.x,b.y,c.x,c.y)+Math.abs(c.y-laneY)*.45+(v70TargetLoads[c.id]||0)*72;
    if(!broken)score+=front?-150:125;else if(front)score-=20;
    if(score<bestScore){best=c;bestScore=score;}
  }
  return setV70BoarderTarget(b,best);
}
function v70DesiredFrontLane(c){
  const home={captain:1,sailor1:0,sailor2:2,sailor3:0,sailor4:2}[c.id]??1;
  let max=0;if(v70Pressure[1]>v70Pressure[max])max=1;if(v70Pressure[2]>v70Pressure[max])max=2;
  return v70Pressure[max]>=v70Pressure[home]+3?max:home;
}
```

- [ ] **Step 3: Override pirate crew target selection**

Wrap `chooseBoarderCrewTarget`. Keep a living current front-line target before breakthrough; otherwise call `chooseV70BoarderTarget`.

- [ ] **Step 4: Implement player target choice using cached pressure/hash**

```js
function chooseV70CrewTarget(c){
  const front=isV70FrontCrew(c),desired=front?v70DesiredFrontLane(c):1;
  let best=null,bestScore=Infinity;
  for(const b of g.boarders){
    if(b.hp<=0||b.state!=='fight')continue;
    let score=dist(c.x,c.y,b.x,b.y);
    if(front)score+=Math.abs(ensureV70Lane(b)-desired)*145;
    if(c.id==='gunner')score-=v70LocalClusterCount(b,105)*34;
    if(score<bestScore){best=b;bestScore=score;}
  }
  return best;
}
```

Override global `chooseCrewCombatTarget` with `chooseV70CrewTarget`.

- [ ] **Step 5: Keep front/middle/back formation roles**

Wrap `crewCombatProfile` so drummer becomes true backline (`min:145, preferred:185, speed:76`); retain V6.6 archer/gunner and V6.7 sailors. Wrap `moveCrewCombat`: if a front crew member has no target, move toward an idle anchor around `{x:500,y:V70_LANE_Y[v70DesiredFrontLane(c)]}`; if it has a target, delegate to the old movement. This creates pressure-based补位 without fixed permanent slots.

- [ ] **Step 6: Run tests and commit**

Commit: `feat: add V7.0 encirclement and dynamic defense`.

---

### Task 4: Hit-stun, knockback, downed, overboard, safe pooling

**Files:**
- Modify: `js/27_v70_deck_horde.js`
- Modify: `tests/v7_0_deck_horde.test.js`

**Interfaces:**
- Consumes: existing `damageBoarder`, `updateBoarder`, V6.8 `emitPirateOverboard`, `boarderPool.release`, Canvas unit helpers.
- Produces: delayed death finalization after V6.8 snapshot recycling, max-10 downed visuals, safe pool release.

- [ ] **Step 1: Add failing impact/death tests**

Verify:
- damage `<27` sets short hit-stun and does not change `assaultLane`;
- damage `>=27` pushes 25–55px;
- a pushed-out pirate becomes pending overboard, not immediately spliced while `v70InsideUpdate=true`;
- post-update flush removes it, emits overboard feedback, and releases exactly once;
- downed list never exceeds 10;
- expired downed body releases exactly once.

- [ ] **Step 2: Add persistent death state**

```js
const v70PendingDeaths=[];
let v70InsideUpdate=false;
function ensureV70State(){if(!g.v70Downed)g.v70Downed=[];return g.v70Downed;}
function detachV70Boarder(b){const i=g.boarders.indexOf(b);if(i>=0)g.boarders.splice(i,1);}
function releaseV70Boarder(b){if(boarderPool&&boarderPool.release)boarderPool.release(b);}
```

- [ ] **Step 3: Add impact without detaching during inner update**

```js
function v70NearestLivingCrew(b){let best=null,bd=Infinity;for(const c of g.crew)if(c.alive){const d=dist(b.x,b.y,c.x,c.y);if(d<bd){bd=d;best=c;}}return best;}
function applyV70Impact(b,d){
  if(!b||b.hp<=0)return false;
  b.v70HitStun=Math.max(b.v70HitStun||0,d>=27?.12:.07);
  if(d<27)return false;
  const src=v70NearestLivingCrew(b);let dx=src?b.x-src.x:1,dy=src?b.y-src.y:0,len=Math.hypot(dx,dy)||1;
  const push=clamp(25+(d-27)*1.35,25,55);b.x+=dx/len*push;b.y+=dy/len*push;
  if(b.x<DECK_COMBAT_BOUNDS.minX||b.x>DECK_COMBAT_BOUNDS.maxX||b.y<DECK_COMBAT_BOUNDS.minY||b.y>DECK_COMBAT_BOUNDS.maxY){queueV70Death(b,'overboard');return true;}
  return true;
}
```

- [ ] **Step 4: Queue death instead of immediate removal inside V6.8 snapshot window**

```js
function queueV70Death(b,kind){
  if(!b||b.v70DeathPending)return false;
  b.v70DeathPending=kind||'downed';v70PendingDeaths.push(b);return true;
}
function queueV70Downed(b){
  const a=ensureV70State();detachV70Boarder(b);b.state='downed';b.v70DownT=.5+Math.random()*.3;b.v70DeathPending=null;
  while(a.length>=V70_MAX_DOWNED)releaseV70Boarder(a.shift());
  a.push(b);return true;
}
function dropV70Overboard(b){
  detachV70Boarder(b);b.v70DeathPending=null;
  if(typeof emitPirateOverboard==='function')emitPirateOverboard(b);else splashFx(b.x,b.y,.7);
  releaseV70Boarder(b);return true;
}
function flushV70PendingDeaths(){
  for(let i=0;i<v70PendingDeaths.length;i++){
    const b=v70PendingDeaths[i],kind=b.v70DeathPending;
    if(kind==='overboard')dropV70Overboard(b);else queueV70Downed(b);
  }
  v70PendingDeaths.length=0;
}
```

- [ ] **Step 5: Wrap damage and preserve existing reward code**

```js
const _damageBoarderV70=damageBoarder;
damageBoarder=function(b,d,x,y){
  if(!b||b.hp<=0)return;
  const before=b.hp;_damageBoarderV70(b,d,x,y);
  if(before>0&&b.hp<=0){queueV70Death(b,Math.random()<.7?'downed':'overboard');return;}
  applyV70Impact(b,d);
};
```

If `damageBoarder` is called outside `update()`, call `flushV70PendingDeaths()` immediately after queuing because no V6.8 snapshot is active. Implement this by checking `v70InsideUpdate` in the wrapper.

- [ ] **Step 6: Pause AI during hit-stun**

```js
const _updateBoarderV70=updateBoarder;
updateBoarder=function(b,dt){if((b.v70HitStun||0)>0){b.v70HitStun=Math.max(0,b.v70HitStun-dt);return;}return _updateBoarderV70(b,dt);};
```

- [ ] **Step 7: Update/release max-10 downed bodies**

```js
function updateV70Downed(dt){
  const a=ensureV70State();let w=0;
  for(let i=0;i<a.length;i++){const b=a[i];b.v70DownT-=dt;if(b.v70DownT<=0){releaseV70Boarder(b);continue;}a[w++]=b;}a.length=w;
}
```

- [ ] **Step 8: Draw downed bodies without allocating temporary objects**

```js
function drawV70Downed(){
  for(const b of ensureV70State()){
    ctx.save();ctx.translate(b.x,b.y);ctx.rotate(1.35);ctx.globalAlpha=clamp(b.v70DownT/.25,0,1);
    figureBody(0,0,'#f2f2f2','#3a3f4a');figureHead(0,0,'band',b.band||'#3a3f4a');ctx.restore();
  }
  ctx.globalAlpha=1;
}
```

Wrap `drawBoardingRoutes` to call previous route drawing then `drawV70Downed()`. In the main loop this places downed bodies before live pirates.

- [ ] **Step 9: Run tests and commit**

Commit: `feat: add V7.0 melee impact and death feedback`.

---

### Task 5: Outer update integration, menu, and version publish

**Files:**
- Modify: `js/27_v70_deck_horde.js`
- Modify: `index.html`
- Modify: `tests/v7_0_deck_horde.test.js`
- Modify old tests only where they require an old page version string.

**Interfaces:**
- Consumes: current V6.9 update/menu/HUD chain.
- Produces: pre-frame cache refresh, post-frame death flush/downed timer, V7.0 publication.

- [ ] **Step 1: Add safe outer update wrapper**

```js
const _updateV70=update;
update=function(dt){
  v70RefreshFrameCache();
  v70InsideUpdate=true;
  try{_updateV70(dt);}finally{v70InsideUpdate=false;}
  flushV70PendingDeaths();
  updateV70Downed(dt);
};
```

This guarantees pending boarders remain in `g.boarders` until V6.8 `recycleSnapshot()` has finished, so V7.0 owns their later pool release exactly once.

- [ ] **Step 2: Publish V7.0 entry order**

Change title/portrait text to `V7.0 · 甲板人潮近战` and load:

```html
<script src="js/25_v69_endless_waves.js"></script>
<script src="js/26_v69_side_retreat.js"></script>
<script src="js/27_v70_deck_horde.js"></script>
<script src="js/60_input_loop.js"></script>
```

Keep a retained-features comment mentioning V6.6/V6.8/V6.9 so old regression intent is explicit.

- [ ] **Step 3: Override menu only**

V7 menu copy must mention three-lane encirclement, 8-crew dynamic defense, knockback/downed/overboard, 40 active cap, and retained 15-second endless waves. Do not replace V6.9 `drawHUD` countdown wrapper.

- [ ] **Step 4: Update old publish-version tests without weakening behavior assertions**

Replace assertions that require the top-level page to literally say V6.6/V6.8/V6.9 with script-load or retained-feature assertions. Keep all behavioral checks unchanged.

- [ ] **Step 5: Run V7 test and commit**

Commit: `feat: publish V7.0 deck horde combat`.

---

### Task 6: Full regression, workflow cleanup, final Pages verification

**Files:**
- Modify temporarily, then delete: `.github/workflows/v70-deck-horde.yml`

**Interfaces:**
- Consumes: every `tests/*.test.js`.
- Produces: fresh V6.3–V7.0 verification evidence.

- [ ] **Step 1: Expand CI to full suite**

```yaml
      - name: Run full regression suite
        run: for f in tests/*.test.js; do echo "== $f =="; node "$f"; done
```

- [ ] **Step 2: Require GREEN**

Fresh workflow must show:
- every `js/*.js` passes `node --check`;
- all existing V6 regression tests pass;
- V7.0 test passes.

If anything fails, use systematic debugging and identify the failing behavior before editing.

- [ ] **Step 3: Re-check exact invariants**

Verify source still contains:
- `V69_WAVE_INTERVAL=15`;
- V6.9 carrier cleanup loaded before V7;
- enemy `shoot:false` behavior;
- V6.8 `deployBoarder` contact guard;
- `const p=clamp(f.t/f.dur,0,1);` in `js/40_scene.js`.

- [ ] **Step 4: Delete temporary CI workflow**

After the full suite is green, delete `.github/workflows/v70-deck-horde.yml`.

- [ ] **Step 5: Compare final main to tested GREEN commit**

The only diff after the tested GREEN commit may be removal of the temporary workflow. Any production/test change after GREEN requires another full verification run.

- [ ] **Step 6: Verify GitHub Pages**

Wait for the Pages run attached to final `main`; verify build and deploy both conclude `success` before reporting deployment success.
