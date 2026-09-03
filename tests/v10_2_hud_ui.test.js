const fs=require('fs');
const vm=require('vm');
const assert=require('assert');
const ctx={console,Math};ctx.globalThis=ctx;
ctx.V8Config={W:960,H:540};
ctx.V8Render={draw(){},shipVisualPose:s=>({x:s.x||0,y:s.y||0})};
ctx.V9VectorShip={hullProfile:()=>({orientation:'horizontal',halfBeam:20,halfLength:50})};
ctx.V8ShipGrid={localToGrid:()=>({gx:0,gy:0}),cellCenterWorld:(ship,cell)=>({x:ship.x||0,y:ship.y||0})};
ctx.V972PlayerAttack={getAttack:s=>s.playerShellAttack||72,isAuto:()=>false,resolveTarget:s=>s.focus||null};
ctx.V954ImpactExplosion={blastRadiusScale:()=>1};
ctx.V102Ammo={
  normalizePlayerType:t=>['solid','chain','explosive'].includes(t)?t:'solid',
  labelFor:t=>({solid:'实心弹',chain:'链弹',explosive:'爆裂弹'}[t]||'实心弹')
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('js/v8/47_v97_status_overlay.js','utf8'),ctx,{filename:'js/v8/47_v97_status_overlay.js'});
const H=ctx.V97StatusOverlay;
assert(H,'status overlay must load');
assert.strictEqual(H.ammoLabel({playerAmmoType:'solid'}),'实心弹');
assert.strictEqual(H.ammoLabel({playerAmmoType:'chain'}),'链弹');
assert.strictEqual(H.ammoLabel({playerAmmoType:'explosive'}),'爆裂弹');

let state={playerAmmoType:'solid'};
let target={cells:[{type:'mast',alive:true,hp:26,maxHp:26}]};
assert.strictEqual(H.tacticalHint(state,target,target.cells[0]),'建议：链弹打桅杆');
assert.strictEqual(state.playerAmmoType,'solid','tactical hint must never change selected ammo');

target={cells:[{type:'hull',alive:true,hp:60,maxHp:60,armorHp:90,armorMax:100,fracture:0,fatigue:0}]};
assert.strictEqual(H.tacticalHint(state,target,target.cells[0]),'建议：实心弹破甲');

target={cells:[{type:'hull',alive:true,hp:20,maxHp:60,armorHp:20,armorMax:100,fracture:.78,fatigue:.72}]};
assert.strictEqual(H.tacticalHint(state,target,target.cells[0]),'建议：爆裂弹扩大破坏');

const src=fs.readFileSync('js/v8/47_v97_status_overlay.js','utf8');
for(const text of ['建议：链弹打桅杆','建议：实心弹破甲','建议：爆裂弹扩大破坏'])assert(src.includes(text),`HUD must contain ${text}`);
console.log('V10.2 HUD and tactical hint tests passed');
