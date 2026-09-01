const fs=require('fs');
const assert=require('assert');
const vm=require('vm');

const model=fs.readFileSync('js/10_model.js','utf8');
const boarding=fs.readFileSync('js/21_boarding_update.js','utf8');
const deckAI=fs.readFileSync('js/22_deck_combat_ai.js','utf8');
const art=fs.readFileSync('js/30_art_units.js','utf8');
const index=fs.readFileSync('index.html','utf8');

assert(/V6\.7/.test(index),'index must publish V6.7');
assert(/ENEMY_RANGED_FIRE\s*=\s*false/.test(model),'enemy ranged fire must be globally disabled');
assert(/gunship:\{s:0\.56[\s\S]*?shoot:false/.test(model.replace(/\s+/g,'')),'gunship must not be marked as a firing ship');
assert(/ENEMY_RANGED_FIRE&&/.test(boarding.replace(/\s+/g,'')),'enemy projectile creation must be gated by ENEMY_RANGED_FIRE');
assert(/if\(!ENEMY_RANGED_FIRE\)g\.eballs\.length=0/.test(boarding.replace(/\s+/g,'')),'disabled enemy ranged fire must clear enemy cannonballs before they can hit the flagship');

const ctx={console,Math,FAST:false,rand:(a,b)=>(a+b)/2,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),window:{}};
vm.createContext(ctx);
vm.runInContext(model,ctx);
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

assert(/startsWith\('sailor'\)/.test(deckAI),'V6.6 deck AI must explicitly classify sailors as melee crew');
assert(/startsWith\('sailor'\)/.test(art),'sailors need their own crew artwork instead of rendering as drummers');

console.log('PASS: V6.7 eight crew + no enemy ranged flagship attack regression');
