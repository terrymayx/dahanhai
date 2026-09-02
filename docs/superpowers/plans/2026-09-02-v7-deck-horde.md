# V7.0 Deck Horde Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build V7.0 deck-horde combat with three-lane pirate pressure, an 8-crew dynamic defense, knockback/downed/overboard feedback, and a hard 40-active-boarder cap while preserving V6.3–V6.9 behavior.

**Architecture:** Add one late-loaded compatibility layer, `js/27_v70_deck_horde.js`, after `js/26_v69_side_retreat.js` and before `js/60_input_loop.js`. It wraps existing global functions (`deployBoarder`, `enterBoarderFight`, `chooseBoarderCrewTarget`, `chooseCrewCombatTarget`, `moveCrewCombat`, `damageBoarder`, `updateBoarder`, `update`, `drawPirate`, `drawBoardingRoutes`, `drawMenu`) instead of rewriting V6.3–V6.9 core files. New crowd state uses fixed reusable arrays/counters and existing V6.8 `boarderPool`/particle helpers.

**Tech Stack:** Vanilla JavaScript, Canvas 2D, Node.js `assert` + `vm` regression tests, GitHub Actions for remote test execution.

**Spec:** `docs/superpowers/specs/2026-09-02-v7-deck-horde-design.md`

## Global Constraints

- Preserve V6.9 infinite waves at exactly 15 seconds per wave.
- Preserve troop-carrier enemy ships and V6.9 unload-then-disappear behavior.
- Preserve enemy remote fire suppression.
- Preserve the 8-player-crew roster.
- Preserve the physical-contact guard in `deployBoarder(e)`; V7.0 may only block deployment before delegating to the existing guarded implementation.
- Preserve V6.4 channel release only when a pirate actually enters `fight`.
- Preserve V6.8 object pools, spatial hash, FX caps, and `clamp(f.t/f.dur,0,1)` sink-FX regression fix.
- `V70_MAX_ACTIVE_BOARDERS = 40`.
- `V70_MAX_DOWNED = 10`.
- No new full O(n²) pirate-pirate crowd loop.

---

### Task 1: Add V7.0 regression harness and observe RED

**Files:**
- Create: `tests/v7_0_deck_horde.test.js`
- Create temporarily: `.github/workflows/v70-deck-horde.yml`

**Interfaces:**
- Consumes: current `index.html`, `js/22_deck_combat_ai.js`, `js/24_v68_feedback_perf.js`, `js/25_v69_endless_waves.js`, `js/26_v69_side_retreat.js`.
- Produces: a regression executable that later tasks must make green.

- [ ] **Step 1: Write the failing V7.0 test**

Create `tests/v7_0_deck_horde.test.js` with assertions covering the final contract:

```js
const fs=require('fs');
const assert=require('assert');
const vm=require('vm');
const read=p=>fs.readFileSync(p,'utf8');
const index=read('index.html');
const path='js/27_v70_deck_horde.js';
assert(fs.existsSync(path),'V7.0 deck-horde layer must exist');
const v70=read(path);

assert.match(index,/V7\.0/,'page must publish V7.0');
assert.match(index,/js\/27_v70_deck_horde\.js/,'index must load V7.0 after V6.9 cleanup');
assert.ok(index.indexOf('js/26_v69_side_retreat.js') < index.indexOf('js/27_v70_deck_horde.js'));
assert.ok(index.indexOf('js/27_v70_deck_horde.js') < index.indexOf('js/60_input_loop.js'));
assert.match(v70,/const\s+V70_MAX_ACTIVE_BOARDERS\s*=\s*40\b/);
assert.match(v70,/const\s+V70_MAX_DOWNED\s*=\s*10\b/);
for(const fn of [
  'v70LaneForY','ensureV70Lane','v70ActiveBoarderCount','v70LanePressure',
  'chooseV70BoarderTarget','chooseV70CrewTarget','applyV70Impact','queueV70Downed',
  'dropV70Overboard','updateV70Downed','drawV70Downed'
]) assert(new RegExp(`function\\s+${fn}`).test(v70),`${fn} missing`);
assert.match(v70,/deployBoarder\s*=\s*function/,'deployment cap wrapper missing');
assert.match(v70,/enterBoarderFight\s*=\s*function/,'lane assignment on fight entry missing');
assert.match(v70,/damageBoarder\s*=\s*function/,'impact/death wrapper missing');
assert.match(v70,/V68SpatialHash|v68PirateGrid/,'V7.0 must reuse spatial-partitioning infrastructure');
assert.doesNotMatch(v70,/for\s*\([^)]*g\.boarders[^)]*\)\s*for\s*\([^)]*g\.boarders/,'do not add all-pairs pirate loops');

// Helper block must be VM-testable without the full browser.
const helper=v70.match(/\/\* V7\.0 DECK HORDE HELPERS START \*\/([\s\S]*?)\/\* V7\.0 DECK HORDE HELPERS END \*\//);
assert(helper,'helper block must be extractable');
const ctx={Math,g:{boarders:[],v70Downed:[],crew:[]},DECK_COMBAT_BOUNDS:{minX:300,maxX:590,minY:285,maxY:835},clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),dist:(x1,y1,x2,y2)=>Math.hypot(x2-x1,y2-y1)};
vm.createContext(ctx);vm.runInContext(helper[1],ctx);
assert.equal(ctx.v70LaneForY(350),0);
assert.equal(ctx.v70LaneForY(560),1);
assert.equal(ctx.v70LaneForY(780),2);
```

Add runtime assertions after helper setup for front-line targeting, lane pressure, and active-count behavior as later tasks introduce those helpers.

- [ ] **Step 2: Add temporary CI workflow**

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

- [ ] **Step 3: Trigger CI without touching production code**

Make a harmless comment-only test edit if creating the workflow does not trigger itself.

Expected: JavaScript syntax passes; `tests/v7_0_deck_horde.test.js` fails because `js/27_v70_deck_horde.js` does not exist.

- [ ] **Step 4: Record RED commit/run id**

Keep the failing run id for final red/green evidence.

---

### Task 2: Implement three-lane assault and the 40-active-boarder gate

**Files:**
- Create: `js/27_v70_deck_horde.js`
- Modify: `tests/v7_0_deck_horde.test.js`

**Interfaces:**
- Consumes: `deployBoarder(e)`, `enterBoarderFight(b)`, `chooseBoarderCrewTarget(b)`, `DECK_COMBAT_BOUNDS`, `boarderPool`.
- Produces: `V70_MAX_ACTIVE_BOARDERS`, `V70_MAX_DOWNED`, `v70LaneForY(y)`, `ensureV70Lane(b)`, `v70ActiveBoarderCount()`, `v70LanePressure(out)`, `chooseV70BoarderTarget(b)`.

- [ ] **Step 1: Extend RED tests for lane stability and cap**

Add dynamic assertions equivalent to:

```js
const b={y:360,boardingLaneY:360};
assert.equal(ctx.ensureV70Lane(b),0);
b.y=780;
assert.equal(ctx.ensureV70Lane(b),0,'assault lane must stay stable after assignment');
ctx.g.boarders=Array.from({length:39},(_,i)=>({hp:10,state:'fight',assaultLane:i%3}));
ctx.g.v70Downed=[{state:'downed'}];
assert.equal(ctx.v70ActiveBoarderCount(),40);
```

Expected: FAIL before implementation.

- [ ] **Step 2: Add helper block and constants**

Start `js/27_v70_deck_horde.js` with:

```js
/* V7.0：甲板人潮近战。三路包围、8 人动态防线、击退/倒地/落水、40 人活跃上限。 */
const V70_MAX_ACTIVE_BOARDERS=40;
const V70_MAX_DOWNED=10;
const V70_LANE_Y=[380,560,740];
const v70Pressure=[0,0,0];

/* V7.0 DECK HORDE HELPERS START */
function v70LaneForY(y){return y<470?0:y>650?2:1;}
function ensureV70Lane(b){
  if(!Number.isFinite(b.assaultLane))b.assaultLane=v70LaneForY(Number.isFinite(b.boardingLaneY)?b.boardingLaneY:b.y);
  return b.assaultLane;
}
function v70ActiveBoarderCount(){return g.boarders.length+(g.v70Downed?g.v70Downed.length:0);}
function v70LanePressure(out=v70Pressure){
  out[0]=out[1]=out[2]=0;
  for(const b of g.boarders)if(b.hp>0&&(b.state==='plank'||b.state==='swing'||b.state==='climb'||b.state==='fight'))out[ensureV70Lane(b)]++;
  return out;
}
/* V7.0 DECK HORDE HELPERS END */
```

- [ ] **Step 3: Gate deployment without weakening physical contact**

Wrap the already V6.8-pooled implementation:

```js
const _deployBoarderV70=deployBoarder;
deployBoarder=function(e){
  if(v70ActiveBoarderCount()>=V70_MAX_ACTIVE_BOARDERS)return false;
  return _deployBoarderV70(e);
};
```

This wrapper never returns true on its own; the existing physical-contact/channel guards still decide actual deployment.

- [ ] **Step 4: Assign a stable lane on true fight entry**

```js
const _enterBoarderFightV70=enterBoarderFight;
enterBoarderFight=function(b){_enterBoarderFightV70(b);ensureV70Lane(b);};
```

- [ ] **Step 5: Run V7 test and commit**

Run `node tests/v7_0_deck_horde.test.js`; expected remaining failures are target/defense/impact helpers, while lane/cap assertions pass.

Commit: `feat: add V7.0 lane pressure and boarder cap`.

---

### Task 3: Implement pirate encirclement and 8-crew dynamic defense

**Files:**
- Modify: `js/27_v70_deck_horde.js`
- Modify: `tests/v7_0_deck_horde.test.js`

**Interfaces:**
- Consumes: `isV67Sailor(c)`, `chooseBoarderCrewTarget`, `chooseCrewCombatTarget`, `moveCrewCombat`, `crewCombatProfile`, `g.crew`.
- Produces: `isV70FrontCrew(c)`, `v70DesiredFrontLane(c,pressure)`, `chooseV70BoarderTarget(b)`, `chooseV70CrewTarget(c)`.

- [ ] **Step 1: Add failing targeting tests**

Use an 8-crew fixture containing `captain`, `sailor1`…`sailor4`, `gunner`, `archer`, `drummer`. Assert that an upper-lane pirate initially picks a captain/sailor in or near upper lane even if a backliner is slightly closer; then move the pirate left of the breakthrough X threshold and assert a backliner may become eligible. Assert that a sailor prefers a target in the highest-pressure lane.

- [ ] **Step 2: Implement front/back role helpers and pirate scoring**

Use stable scoring with no per-boarder temporary arrays:

```js
function isV70FrontCrew(c){return !!c&&(c.id==='captain'||isV67Sailor(c));}
function v70TargetLoad(id,except){let n=0;for(const b of g.boarders)if(b!==except&&b.hp>0&&b.state==='fight'&&b.targetCrewId===id)n++;return n;}
function chooseV70BoarderTarget(b){
  const lane=ensureV70Lane(b),laneY=V70_LANE_Y[lane],broken=b.x<455;
  let best=null,bestScore=Infinity;
  for(const c of g.crew){
    if(!c.alive)continue;
    const front=isV70FrontCrew(c);
    let score=dist(b.x,b.y,c.x,c.y)+Math.abs(c.y-laneY)*.45+v70TargetLoad(c.id,b)*72;
    if(!broken)score+=front?-150:125;
    else if(front)score-=20;
    if(score<bestScore){best=c;bestScore=score;}
  }
  b.targetCrewId=best?best.id:null;return best;
}
```

Override `chooseBoarderCrewTarget` to retain a still-valid current target unless it violates the pre-breakthrough front-line rule; otherwise delegate to `chooseV70BoarderTarget`.

- [ ] **Step 3: Implement lane-pressure defense targeting**

Use pressure counters and role defaults:

```js
function v70DesiredFrontLane(c,p=v70LanePressure()){
  const home={captain:1,sailor1:0,sailor2:2,sailor3:0,sailor4:2}[c.id]??1;
  let max=0;if(p[1]>p[max])max=1;if(p[2]>p[max])max=2;
  return p[max]>=p[home]+3?max:home;
}
function chooseV70CrewTarget(c){
  const p=v70LanePressure(),front=isV70FrontCrew(c),desired=front?v70DesiredFrontLane(c,p):1;
  let best=null,bestScore=Infinity;
  for(const b of g.boarders){
    if(b.hp<=0||b.state!=='fight')continue;
    let score=dist(c.x,c.y,b.x,b.y);
    if(front)score+=Math.abs(ensureV70Lane(b)-desired)*145;
    if(c.id==='gunner')score-=boarderClusterCount(b,105)*34;
    if(score<bestScore){best=b;bestScore=score;}
  }
  return best;
}
```

Override global `chooseCrewCombatTarget` to call `chooseV70CrewTarget`.

- [ ] **Step 4: Keep formation roles while idle**

Wrap `crewCombatProfile` so drummer gets backline safety (`min:145, preferred:185, speed:76`) while archer/gunner retain their existing V6.6 profiles and sailors remain V6.7 melee profiles. Wrap `moveCrewCombat`: when a front crew member has no target, move toward X≈500 and `V70_LANE_Y[v70DesiredFrontLane(...)]`; otherwise delegate to existing combat movement.

- [ ] **Step 5: Run tests and commit**

Expected: lane/cap/target/defense tests green; impact/death tests still red.

Commit: `feat: add V7.0 encirclement and dynamic defense`.

---

### Task 4: Implement hit-stun, knockback, downed bodies, and overboard kills

**Files:**
- Modify: `js/27_v70_deck_horde.js`
- Modify: `tests/v7_0_deck_horde.test.js`

**Interfaces:**
- Consumes: current `damageBoarder`, `updateBoarder`, V6.8 `emitPirateOverboard`, `splashFx`, `boarderPool.release`, `drawPirate`.
- Produces: `applyV70Impact(b,d)`, `queueV70Downed(b)`, `dropV70Overboard(b)`, `updateV70Downed(dt)`, `drawV70Downed()`.

- [ ] **Step 1: Add failing impact/death tests**

Test these behaviors with simple objects/stubs:
- damage ≥27 produces knockback distance in the 25–55px band;
- light damage sets a short hit-stun but does not change `assaultLane`;
- a pirate pushed beyond deck bounds goes through `dropV70Overboard`, is removed from active boarders, and calls a stubbed pool release;
- downed list never exceeds 10;
- expired downed object is returned to pool.

- [ ] **Step 2: Initialize downed storage**

```js
function ensureV70State(){if(!g.v70Downed)g.v70Downed=[];return g.v70Downed;}
ensureV70State();
```

- [ ] **Step 3: Add impact source and knockback**

Avoid creating arrays; scan the 8 crew directly:

```js
function v70NearestLivingCrew(b){let best=null,bd=Infinity;for(const c of g.crew)if(c.alive){const d=dist(b.x,b.y,c.x,c.y);if(d<bd){bd=d;best=c;}}return best;}
function applyV70Impact(b,d){
  if(!b||b.hp<=0)return false;
  b.v70HitStun=Math.max(b.v70HitStun||0,d>=27?.12:.07);
  if(d<27)return false;
  const src=v70NearestLivingCrew(b);let dx=src?b.x-src.x:1,dy=src?b.y-src.y:0,len=Math.hypot(dx,dy)||1;
  const push=clamp(25+(d-27)*1.35,25,55);
  b.x+=dx/len*push;b.y+=dy/len*push;
  if(b.x<DECK_COMBAT_BOUNDS.minX||b.x>DECK_COMBAT_BOUNDS.maxX||b.y<DECK_COMBAT_BOUNDS.minY||b.y>DECK_COMBAT_BOUNDS.maxY)return dropV70Overboard(b);
  return true;
}
```

- [ ] **Step 4: Own downed lifecycle outside `g.boarders`**

Because the V6.4 core filters `g.boarders` by `hp>0`, move dead bodies into `g.v70Downed` so old AI never targets them:

```js
function detachV70Boarder(b){const i=g.boarders.indexOf(b);if(i>=0)g.boarders.splice(i,1);}
function releaseV70Boarder(b){if(typeof boarderPool!=='undefined'&&boarderPool&&boarderPool.release)boarderPool.release(b);}
function queueV70Downed(b){
  const a=ensureV70State();detachV70Boarder(b);b.state='downed';b.v70DownT=.5+Math.random()*.3;
  while(a.length>=V70_MAX_DOWNED)releaseV70Boarder(a.shift());
  a.push(b);return true;
}
function dropV70Overboard(b){
  detachV70Boarder(b);if(typeof emitPirateOverboard==='function')emitPirateOverboard(b);else splashFx(b.x,b.y,.7);
  releaseV70Boarder(b);return true;
}
```

- [ ] **Step 5: Wrap damage without double rewards**

Capture the existing V6.x damage function and only add V7 state after it has awarded gold/reward flags:

```js
const _damageBoarderV70=damageBoarder;
damageBoarder=function(b,d,x,y){
  if(!b||b.hp<=0)return;
  const was=b.hp;_damageBoarderV70(b,d,x,y);
  if(was>0&&b.hp<=0){
    if(Math.random()<.7)queueV70Downed(b);else dropV70Overboard(b);
    return;
  }
  applyV70Impact(b,d);
};
```

If mutating `g.boarders` from an active core loop causes a test/runtime regression, use a `v70DeathPending` flag and drain it in the outer V7 `update()` wrapper after the prior update returns. Do not alter reward code in `js/20_combat_skills.js` unless this fallback is required.

- [ ] **Step 6: Pause pirate AI during hit-stun**

```js
const _updateBoarderV70=updateBoarder;
updateBoarder=function(b,dt){
  if((b.v70HitStun||0)>0){b.v70HitStun=Math.max(0,b.v70HitStun-dt);return;}
  return _updateBoarderV70(b,dt);
};
```

- [ ] **Step 7: Update and draw downed bodies**

```js
function updateV70Downed(dt){
  const a=ensureV70State();let w=0;
  for(let i=0;i<a.length;i++){const b=a[i];b.v70DownT-=dt;if(b.v70DownT<=0){releaseV70Boarder(b);continue;}a[w++]=b;}a.length=w;
}
function drawV70Downed(){
  for(const b of ensureV70State()){
    ctx.save();ctx.translate(b.x,b.y);ctx.rotate(1.35);ctx.globalAlpha=clamp(b.v70DownT/.25,0,1);ctx.translate(-b.x,-b.y);drawPirate({...b,state:'downed',hp:0,max:b.max||1});ctx.restore();
  }
}
```

Avoid the object spread in production if profiling/test review flags per-frame allocation; preferred final implementation is a dedicated direct Canvas draw using `figureBody`/`figureHead` with no temporary object.

Wrap `drawBoardingRoutes` to call the previous function and then `drawV70Downed()`, placing downed bodies before live pirates are drawn by `60_input_loop.js`.

- [ ] **Step 8: Run tests and commit**

Commit: `feat: add V7.0 melee impact and death feedback`.

---

### Task 5: Integrate V7.0 update/menu/entry and preserve V6.9 behavior

**Files:**
- Modify: `js/27_v70_deck_horde.js`
- Modify: `index.html`
- Modify: `tests/v7_0_deck_horde.test.js`
- Modify old version-string assertions only where needed: `tests/v6_6_deck_combat_ai.test.js`, `tests/v6_8_feedback_perf.test.js`, `tests/v6_9_endless_troop_waves.test.js`

**Interfaces:**
- Consumes: current `update`, `drawMenu`, V6.9 HUD/wave functions.
- Produces: V7 post-update lifecycle and V7 title/menu copy.

- [ ] **Step 1: Add late update wrapper**

```js
const _updateV70=update;
update=function(dt){
  _updateV70(dt);
  updateV70Downed(dt);
  v70LanePressure();
};
```

Do not alter V6.9 `waveClock` or `V69_WAVE_INTERVAL`.

- [ ] **Step 2: Publish V7.0 in `index.html`**

Change title/portrait text to `V7.0 · 甲板人潮近战` and load:

```html
<script src="js/25_v69_endless_waves.js"></script>
<script src="js/26_v69_side_retreat.js"></script>
<script src="js/27_v70_deck_horde.js"></script>
<script src="js/60_input_loop.js"></script>
```

Keep an HTML comment mentioning retained V6.6/V6.8/V6.9 behavior so old regression intent remains explicit.

- [ ] **Step 3: Override menu only, not wave HUD timer**

Set V7 menu bullets to communicate:
- three-lane pirate encirclement;
- 8-crew dynamic defense;
- knockback/downed/overboard feedback;
- 40 active pirate cap;
- V6.9 15-second endless wave rules retained.

Do not replace V6.9 `drawHUD` countdown wrapper.

- [ ] **Step 4: Update old tests only for publish-version expectations**

Where tests assert `/V6\.6/`, `/V6\.8/`, or `/V6\.9/` in `index.html`, change them to assert either the retained feature marker/comment or the corresponding script load, not that the page's top-level version must remain old. Do not weaken behavioral assertions.

- [ ] **Step 5: Run V7.0 test**

Run: `node tests/v7_0_deck_horde.test.js`
Expected: PASS.

Commit: `feat: publish V7.0 deck horde combat`.

---

### Task 6: Full regression, cleanup, and Pages verification

**Files:**
- Modify temporarily: `.github/workflows/v70-deck-horde.yml`
- Delete after green: `.github/workflows/v70-deck-horde.yml`

**Interfaces:**
- Consumes: every regression in `tests/*.test.js`.
- Produces: fresh CI evidence that V6.3–V7.0 remain green.

- [ ] **Step 1: Expand temporary workflow to full suite**

```yaml
      - name: Run full regression suite
        run: for f in tests/*.test.js; do echo "== $f =="; node "$f"; done
```

- [ ] **Step 2: Run and inspect fresh GREEN workflow**

Required evidence:
- every `js/*.js` passes `node --check`;
- V6 free boarding/V6.4/V6.5/V6.6/V6.7/V6.8/V6.9 tests pass;
- V7.0 test passes.

If failure occurs, use systematic debugging; do not patch by guessing.

- [ ] **Step 3: Verify exact invariants before cleanup**

Check repository source for:
- `V69_WAVE_INTERVAL=15` unchanged;
- V6.9 transport cleanup still loaded before V7;
- `TYPES.*.shoot=false` behavior retained;
- `deployBoarder` physical-contact guard still present in V6.8 implementation;
- `const p=clamp(f.t/f.dur,0,1);` still present in `js/40_scene.js`.

- [ ] **Step 4: Delete temporary CI workflow**

Delete `.github/workflows/v70-deck-horde.yml` after the green full-suite run.

- [ ] **Step 5: Compare final main to tested GREEN commit**

The only diff after the tested GREEN commit should be removal of the temporary workflow. If any production/test file differs, rerun verification on the final code instead of claiming success.

- [ ] **Step 6: Verify final GitHub Pages deployment**

Wait for the Pages run attached to the final `main` commit and verify both build and deploy conclude `success` before reporting deployment success.
