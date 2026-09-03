const fs=require('fs');
const vm=require('vm');
const assert=require('assert');

let captured=[];
const ctx={console,Math};ctx.globalThis=ctx;
ctx.V8ShipGrid={integrity:()=>1};
ctx.V8Battle={newGame:()=>({enemies:[],player:null,kills:0,time:0}),targetForPlayer:()=>null};
ctx.V8Projectile={spawn:(state,opts)=>{captured.push(Object.assign({},opts));return opts;}};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('js/v8/33_v972_player_attack.js','utf8'),ctx,{filename:'js/v8/33_v972_player_attack.js'});
const A=ctx.V972PlayerAttack,P=ctx.V8Projectile;
assert(A,'player attack module must load');
assert.strictEqual(A.prepareState({}).playerAmmoType,'solid','player ammo defaults to solid');
assert.strictEqual(A.prepareState({playerAmmoType:'chain'}).playerAmmoType,'chain','valid selected ammo survives prepareState');
assert.strictEqual(A.prepareState({playerAmmoType:'bad'}).playerAmmoType,'solid','invalid selected ammo falls back to solid');
const state=A.prepareState({playerShellAttack:72,playerAttackAuto:false,playerAmmoType:'chain',enemies:[]});
P.spawn(state,{side:'player',x:0,y:0,vx:10,vy:0});
assert.strictEqual(captured[0].damage,72,'ammo switching must keep common attack stat');
assert.strictEqual(captured[0].attackPower,72,'ammo switching must keep common armor attack stat');
assert.strictEqual(captured[0].ammoType,'chain','new player projectile locks selected ammo at spawn');
P.spawn(state,{side:'enemy',x:0,y:0,vx:-10,vy:0,damage:20});
assert.notStrictEqual(captured[1].ammoType,'chain','enemy projectile must not inherit player ammo');

const ui=fs.readFileSync('js/v8/49_v102_ammo_control.js','utf8');
assert(ui.includes('dahanhai.playerAmmoType'),'ammo selection must persist independently');
for(const type of ['solid','chain','explosive'])assert(ui.includes(`data-ammo="${type}"`),`ammo UI must expose ${type}`);
assert(!/setAttack\s*\(/.test(ui),'ammo switching must not rewrite attack power');
assert(!/setAuto\s*\(/.test(ui),'ammo switching must not toggle AUTO');

const attackControl=fs.readFileSync('js/v8/48_v976_attack_control.js','utf8');
assert(/raw\s*=\s*localStorage\.getItem/.test(attackControl),'attack preference reader must inspect raw storage');
assert(/raw===null/.test(attackControl),'missing attack preference must use fallback instead of Number(null)');
console.log('V10.2 player ammo tests passed');
