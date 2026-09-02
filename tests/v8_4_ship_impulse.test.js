const fs=require('fs');
const vm=require('vm');
const assert=require('assert');
const ctx={console,Math,setTimeout,clearTimeout};ctx.globalThis=ctx;
vm.createContext(ctx);
for(const f of ['js/v8/00_v8_base.js','js/v8/10_ship_grid.js','js/v8/20_projectiles.js','js/v8/30_battle.js']){
  vm.runInContext(fs.readFileSync(f,'utf8'),ctx,{filename:f});
}
const G=ctx.V8ShipGrid,B=ctx.V8Battle;
assert(B&&G,'V8 modules must load');
assert.strictEqual(typeof B.ensureShipPhysics,'function','V8.4 must expose ensureShipPhysics');
assert.strictEqual(typeof B.applyHitImpulse,'function','V8.4 must expose applyHitImpulse');
assert.strictEqual(typeof B.updateShipPhysics,'function','V8.4 must expose updateShipPhysics');
assert(G.IMPACT_FORCE,'V8.4 must expose material impact force table');

const sloop=G.createTemplateShip('sloop','enemy',800,420);
const manowar=G.createTemplateShip('manowar','enemy',800,680);
B.ensureShipPhysics(sloop);B.ensureShipPhysics(manowar);
assert(sloop.physics.mass<manowar.physics.mass,'small ships must react more than heavy ships');

const deck=sloop.cells.find(c=>c.alive&&c.type==='deck');
const beam=sloop.cells.find(c=>c.alive&&(c.type==='beam'||c.type==='core'));
assert(deck&&beam,'fixture must contain deck and beam cells');
const projectile={vx:900,vy:0,damage:24,side:'player'};

B.applyHitImpulse(sloop,deck,G.cellCenterWorld(sloop,deck),projectile);
const deckImpulse=Math.hypot(sloop.physics.impulseX,sloop.physics.impulseY);
const deckResponse=Math.abs(sloop.physics.roll)+Math.abs(sloop.physics.angularVelocity);
assert(deckResponse>0,'off-center deck hit must produce visible rotational response');

for(const k of ['impulseX','impulseY','offsetX','offsetY','roll','angularVelocity'])sloop.physics[k]=0;
B.applyHitImpulse(sloop,beam,G.cellCenterWorld(sloop,beam),projectile);
const beamImpulse=Math.hypot(sloop.physics.impulseX,sloop.physics.impulseY);
const beamResponse=Math.abs(sloop.physics.roll)+Math.abs(sloop.physics.angularVelocity);
assert(beamImpulse>deckImpulse,'beam material must impart more linear impulse than deck');
assert(beamResponse>0,'beam hit must still create rotational/roll feedback even near the center');

const before=Math.hypot(sloop.physics.impulseX,sloop.physics.impulseY);
for(let i=0;i<180;i++)B.updateShipPhysics(sloop,1/60);
assert(Math.hypot(sloop.physics.impulseX,sloop.physics.impulseY)<before*.15,'impulse must decay');
assert(Math.abs(sloop.physics.offsetX)<3&&Math.abs(sloop.physics.offsetY)<3,'visual offset must spring back near zero');
assert(Math.abs(sloop.physics.roll)<.03,'roll must settle near zero');
console.log('V8.4 ship impulse tests passed');
