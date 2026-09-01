const fs = require('fs');
const assert = require('assert');
const vm = require('vm');

const model = fs.readFileSync('js/10_model.js','utf8');
const combat = fs.readFileSync('js/20_combat_skills.js','utf8');
const boarding = fs.readFileSync('js/21_boarding_update.js','utf8');
const scene = fs.readFileSync('js/40_scene.js','utf8');
const hud = fs.readFileSync('js/50_hud_overlay.js','utf8');
const levels = fs.readFileSync('js/55_levels.js','utf8');
const auto = fs.readFileSync('js/56_auto_cannon.js','utf8');
const hp = fs.readFileSync('js/57_infinite_ship_hp.js','utf8');
const melee = fs.readFileSync('js/59_melee_test_mode.js','utf8');
const input = fs.readFileSync('js/60_input_loop.js','utf8');
const index = fs.readFileSync('index.html','utf8');

assert(!/const\s+SLOTS\s*=/.test(model), 'V6 core must not define fixed SLOTS');
assert(!/slotBlocked\s*\(/.test(model), 'V6 core must not use slotBlocked');
assert(!/chooseDockSlot\s*\(/.test(model), 'V6 core must not use chooseDockSlot');
assert(!/slotTargetY\s*\(/.test(model), 'V6 core must not use slotTargetY');
assert(!/slot:null/.test(model), 'enemy spawn must not create slot');
assert(/contactX/.test(model), 'enemy model must expose contactX');
assert(/contactY/.test(model), 'enemy model must expose contactY');
assert(/targetContactY/.test(model), 'enemy model must expose targetContactY');
assert(/function\s+contactPointAtY/.test(model), 'contactPointAtY helper missing');
assert(/function\s+berthingCandidateYs/.test(model), 'continuous candidate scan missing');
assert(/function\s+berthingTargetBlocked/.test(model), 'berthing occupancy check missing');
assert(/function\s+findBestBerthingY/.test(model), 'smart berthing target finder missing');
assert(/function\s+assignBerthingTarget/.test(model), 'stable target assignment missing');
assert(/function\s+lockEnemyContact/.test(model), 'contact lock helper missing');
assert(/function\s+clearEnemyContact/.test(model), 'contact clear helper missing');
assert(/sloop\s*:\{s:0\.42,/.test(model), 'sloop scale must be 0.42');
assert(/gunship\s*:\{s:0\.56,/.test(model), 'gunship scale must be 0.56');
assert(/manowar\s*:\{s:0\.68,/.test(model), 'manowar scale must be 0.68');

assert(!/SLOTS\./.test(boarding), 'boarding routes must not depend on fixed SLOTS');
assert(!/chooseDockSlot\s*\(/.test(boarding), 'boarding must not reserve fixed slots');
assert(!/slotTargetY\s*\(/.test(boarding), 'boarding must use dynamic contactY');
assert(/targetContactY/.test(boarding), 'closing ships must steer toward smart targetContactY');
assert(/assignBerthingTarget\(e/.test(boarding), 'closing ships must assign/reassign smart berth targets');
assert(/berthRepathT/.test(boarding), 'blocked targets must be periodically reconsidered');
assert(/berthWaitT/.test(boarding), 'no-space behavior must use slowed waiting');
assert(/contactY/.test(boarding), 'boarding must consume dynamic contactY');
assert(/e\.state!=='docked'/.test(boarding) && /!e\.contact/.test(boarding), 'deployBoarder must require docked contact');
assert(/clearEnemyContact\(e\)/.test(combat), 'sinking a ship must clear its contact data');

assert(!/SLOTS\./.test(scene), 'scene docking gear must be dynamic');
assert(/Number\.isFinite\(e\.contactX\)/.test(scene), 'gear draw must validate dynamic contactX');
assert(/contactY/.test(scene), 'gear draw must use dynamic contactY');
assert(/clamp\(f\.t\/f\.dur,0,1\)/.test(scene), 'sink FX clamp regression must remain');
assert(!/rot\s*>\s*0\.9/.test(input), 'main loop must not gate boarding gear by rotation');
assert(/e\.state==='docked'&&e\.contact/.test(input.replace(/\s+/g,'')), 'main loop must draw gear only for real docked contact');

assert(!/上舷|下舷|双舷/.test(hud), 'HUD/menu must not expose fixed boarding slots');
assert(/state==='docked'&&e\.contact/.test(hud.replace(/\s+/g,'')), 'HUD docked count must require real contact');

assert(!/41_collision_visual\.js/.test(index), 'old collision visual patch must not load');
assert(!/58_berthing_contact_fix\.js/.test(index), 'old berthing patch must not load');
assert(/V6\.3/.test(index), 'index must publish V6.3');

assert(/const deployed=_deployBoarderLevel\(e\)/.test(levels));
assert(/if\(!deployed\)return false/.test(levels));
assert(/return true/.test(levels));
assert(/state\.autoCannon=false/.test(auto));
assert(/if\(!g\.autoCannon\)return false/.test(auto));
assert(/state\.infiniteShipHP=true/.test(hp));
assert(/g\.player\.hp=g\.player\.max/.test(hp));
assert(/b\.state==='fight'/.test(melee));
assert(/g\.arrows\.length=0/.test(melee));

// Execute the real model helpers with a minimal browser/game stub.
const ctx={
  console,Math,
  FAST:false,
  rand:(a,b)=>a+(b-a)*0.5,
  clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
  window:{},
};
vm.createContext(ctx);
vm.runInContext(model,ctx);

const smart=vm.runInContext(`(()=>{
  function make(type,y,x=1000,state='closing',target=null,contact=false){
    const t=TYPES[type];
    return {type,t,s:t.s,x,y,state,rot:0,gone:false,contact,targetContactY:target};
  }

  g.enemies=[];
  const solo=make('sloop',520);
  g.enemies.push(solo);
  const free=findBestBerthingY(solo);

  const docked=make('sloop',520,560,'docked',520,true);
  docked.contactX=playerHullRightX(520);docked.contactY=520;
  const trailing=make('sloop',520,1000,'closing',null,false);
  g.enemies=[docked,trailing];
  const diverted=findBestBerthingY(trailing);

  const ahead=make('sloop',600,850,'closing',600,false);
  const behind=make('sloop',600,1100,'closing',null,false);
  g.enemies=[ahead,behind];
  const queued=findBestBerthingY(behind);

  const stable=make('sloop',700,1000,'closing',700,false);
  g.enemies=[stable];
  const first=assignBerthingTarget(stable);
  stable.y=710;
  const kept=assignBerthingTarget(stable);

  const blocked=[];
  for(const y of berthingCandidateYs(make('manowar',560))){
    const o=make('manowar',y,560,'docked',y,true);
    o.contactX=playerHullRightX(y);o.contactY=y;blocked.push(o);
  }
  const noSpace=make('manowar',560,1100,'closing',null,false);
  g.enemies=[...blocked,noSpace];
  const none=findBestBerthingY(noSpace);

  return {free,diverted,queued,first,kept,none};
})()`,ctx);

assert(Math.abs(smart.free-520)<1, 'free ship should keep its natural Y');
assert(Math.abs(smart.diverted-520)>40, 'docked ship should force a nearby continuous alternate Y');
assert(Math.abs(smart.queued-600)>40, 'trailing closing ship should avoid the ahead ship target');
assert.strictEqual(smart.first,700, 'first smart target should use current free Y');
assert.strictEqual(smart.kept,700, 'valid targetContactY must stay stable instead of oscillating');
assert.strictEqual(smart.none,null, 'fully occupied contact edge should return no berth and wait');

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

console.log('PASS: V6.3 smart free boarding regression');
