const fs=require('fs');
const assert=require('assert');
const vm=require('vm');

const model=fs.readFileSync('js/10_model.js','utf8');
const v67=fs.readFileSync('js/23_v67_crew_no_ranged.js','utf8');
const index=fs.readFileSync('index.html','utf8');

assert(/V6\.7/.test(index),'index must publish V6.7');
assert(/js\/23_v67_crew_no_ranged\.js/.test(index),'V6.7 battle layer must be loaded');
assert(/V6\.7 CREW \+ NO ENEMY RANGED FIRE START/.test(v67),'V6.7 battle layer marker missing');
assert(/TYPES\.gunship\.shoot=false/.test(v67.replace(/\s+/g,'')),'gunship must be marked non-firing in V6.7');
assert(/eballs\.push=function\(\)/.test(v67.replace(/\s+/g,'')),'V6.7 must suppress enemy cannonball creation at the array entry point');
assert(/state\.eballs\.length=0/.test(v67.replace(/\s+/g,'')),'V6.7 must clear inherited enemy cannonballs');
assert(/startsWith\('sailor'\)/.test(v67),'V6.7 must explicitly classify/draw sailors');

const ctx={
  console,Math,FAST:false,
  rand:(a,b)=>(a+b)/2,
  clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
  window:{},
  update:function(){},
  drawCrew:function(){},drawMenu:function(){},
  figureBody:function(){},figureHead:function(){},circle:function(){},
  ctx:{save(){},restore(){},translate(){},rotate(){},beginPath(){},moveTo(){},quadraticCurveTo(){},stroke(){},fill(){},lineTo(){},closePath(){},set fillStyle(v){},set strokeStyle(v){},set lineWidth(v){},set lineCap(v){}},
  overlay:function(){},txt:function(){},bigButton:function(){},BTN_START:{},
};
vm.createContext(ctx);
vm.runInContext(model,ctx);
ctx.crewCombatProfile=(c)=>({min:18,preferred:34,speed:90});
vm.runInContext(v67,ctx);

const crew=vm.runInContext('CREW_DEF.map(c=>({...c}))',ctx);
assert.strictEqual(crew.length,8,'V6.7 must field eight friendly crew members');
const ids=crew.map(c=>c.id);
for(const id of ['captain','archer','gunner','drummer','sailor1','sailor2','sailor3','sailor4'])assert(ids.includes(id),`missing friendly crew ${id}`);
const sailors=crew.filter(c=>/^sailor\d+$/.test(c.id));
assert.strictEqual(sailors.length,4,'V6.7 must add four melee sailors');
for(const s of sailors){
  assert(s.hp>=90,'sailors need frontline HP');
  assert(s.rg<=90,'sailors must be melee crew');
  assert(s.dmg>=15,'sailors need real melee damage');
}

const state=vm.runInContext('newGame()',ctx);
assert.strictEqual(state.crew.length,8,'new games must start with all eight crew');
const before=state.eballs.length;
const pushed=state.eballs.push({x:1000,y:500,vx:-350,vy:0,life:4});
assert.strictEqual(state.eballs.length,before,'enemy cannonball push must be suppressed');
assert.strictEqual(pushed,before,'suppressed enemy cannonball push must report unchanged length');
assert.strictEqual(vm.runInContext('TYPES.gunship.shoot',ctx),false,'gunship firing flag must be false');

const sailorProfile=ctx.crewCombatProfile({id:'sailor1'});
assert(sailorProfile.preferred<=45&&sailorProfile.min<=25,'sailors must use melee deck-combat spacing');

console.log('PASS: V6.7 eight crew + no enemy ranged flagship attack regression');
