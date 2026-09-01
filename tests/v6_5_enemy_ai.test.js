const fs = require('fs');
const assert = require('assert');
const vm = require('vm');

const model = fs.readFileSync('js/10_model.js','utf8');
const boarding = fs.readFileSync('js/21_boarding_update.js','utf8');
const index = fs.readFileSync('index.html','utf8');

assert(/V6\.5/.test(index), 'index must publish V6.5');
assert(/V6\.5 ENEMY AI START/.test(model), 'V6.5 enemy AI helper block missing');
assert(/function\s+enemyAIProfile/.test(model), 'enemyAIProfile missing');
assert(/function\s+berthingScanStep/.test(model), 'berthingScanStep missing');
assert(/function\s+berthingClearance/.test(model), 'berthingClearance missing');
assert(/function\s+gunshipLaneBlocked/.test(model), 'gunshipLaneBlocked missing');
assert(/function\s+findGunshipLane/.test(model), 'findGunshipLane missing');
assert(/function\s+assignGunshipLane/.test(model), 'assignGunshipLane missing');
assert(/enemyAIProfile\(e\)/.test(boarding), 'closing behavior must consume type-specific AI profiles');
assert(/assignGunshipLane\(e/.test(boarding), 'gunships must maintain separated firing lanes');
assert(!/const\s+SLOTS\s*=/.test(model), 'V6.5 must not restore fixed boarding slots');

const ctx={
  console,Math,
  FAST:false,
  rand:(a,b)=>a+(b-a)*0.5,
  clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
  window:{},
};
vm.createContext(ctx);
vm.runInContext(model,ctx);

const result=vm.runInContext(`(()=>{
  function make(type,y,x=1000,state='closing'){
    const t=TYPES[type];
    return {type,t,s:t.s,x,y,state,rot:0,gone:false,contact:false,targetContactY:null,
      rangeY:y,naturalRangeY:y,rangeRepathT:0};
  }

  const sloop=make('sloop',560);
  const manowar=make('manowar',560);
  const gunship=make('gunship',500,1400,'ranged');
  const ps=enemyAIProfile(sloop),pm=enemyAIProfile(manowar),pg=enemyAIProfile(gunship);

  const upper=make('sloop',455,560,'docked'); upper.contact=true;upper.contactY=455;
  const lower=make('sloop',665,560,'docked'); lower.contact=true;lower.contactY=665;
  g.enemies=[upper,lower,sloop];
  const sloopBlocked=berthingTargetBlocked(sloop,560);
  g.enemies=[upper,lower,manowar];
  const manowarBlocked=berthingTargetBlocked(manowar,560);

  const ahead=make('sloop',600,850,'closing');ahead.targetContactY=600;
  const behind=make('sloop',600,1100,'closing');
  g.enemies=[ahead,behind];
  const diverted=findBestBerthingY(behind);

  const first=make('gunship',470,1350,'ranged');first.rangeY=470;first.naturalRangeY=470;
  const second=make('gunship',500,1450,'approach');second.rangeY=500;second.naturalRangeY=500;
  g.enemies=[first,second];
  const secondLane=findGunshipLane(second);
  const separated=Math.abs(secondLane-first.rangeY);

  return {
    ps,pm,pg,
    sloopBlocked,manowarBlocked,
    sloopCandidates:berthingCandidateYs(sloop).length,
    manowarCandidates:berthingCandidateYs(manowar).length,
    diverted,separated,
  };
})()`,ctx);

assert(result.ps.berthClearance < result.pm.berthClearance, 'sloop must accept tighter boarding gaps than manowar');
assert(result.ps.berthStep < result.pm.berthStep, 'sloop must scan boarding space more finely than manowar');
assert(result.ps.repath < result.pm.repath, 'sloop must reconsider a blocked berth faster than manowar');
assert.strictEqual(result.sloopBlocked,false,'sloop should fit a narrow but valid gap');
assert.strictEqual(result.manowarBlocked,true,'manowar must reject the same narrow gap');
assert(result.sloopCandidates>result.manowarCandidates,'sloop must probe more candidate contact Ys');
assert(Math.abs(result.diverted-600)>40,'trailing ship must steer away from an ahead closing ship target');
assert(result.separated>=result.pg.rangedSeparation,'gunships must choose separated firing lanes');

console.log('PASS: V6.5 enemy combat AI regression');
