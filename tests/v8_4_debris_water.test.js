const fs=require('fs');
const vm=require('vm');
const assert=require('assert');
const ctx={console,Math,setTimeout,clearTimeout};ctx.globalThis=ctx;
vm.createContext(ctx);
for(const f of ['js/v8/00_v8_base.js','js/v8/10_ship_grid.js','js/v8/20_projectiles.js','js/v8/30_battle.js']){
  vm.runInContext(fs.readFileSync(f,'utf8'),ctx,{filename:f});
}
const B=ctx.V8Battle;

function makeStateAndShip(){
  const s=B.newGame();
  const ship=B.spawnEnemy(s,'gunship',{x:1000,y:500});
  B.ensureShipPhysics(ship);
  ship.physics.impulseX=8;ship.physics.impulseY=-3;
  return {s,ship,live:ship.cells.filter(c=>c.alive)};
}

{
  const {s,ship,live}=makeStateAndShip();
  B.createDebrisClusters(s,ship,[live.slice(0,8)]);
  const c=s.debrisClusters[s.debrisClusters.length-1];
  assert(c,'multi-cell component must create a debris cluster');
  assert.strictEqual(c.phase,'airborne','new debris must begin airborne');
  assert(Number.isFinite(c.airTime)&&c.airTime>=.35&&c.airTime<=.55,'airborne duration must be bounded');
  assert(Number.isFinite(c.floatTime)&&c.floatTime>=.6&&c.floatTime<=1.5,'float duration must be bounded');
  assert(Math.abs(c.vx)>0||Math.abs(c.vy)>0,'debris must inherit/receive motion');

  const phases=new Set([c.phase]);
  let splashCountAtFloat=null;
  for(let i=0;i<420&&s.debrisClusters.includes(c);i++){
    B.updateDebrisClusters(s,1/60);
    phases.add(c.phase);
    if(c.phase==='float'&&splashCountAtFloat==null)splashCountAtFloat=s.fx.filter(f=>f.k==='waterSplash').length;
  }
  assert(phases.has('float'),'debris must enter a floating phase');
  assert(phases.has('sink'),'debris must enter a sinking phase');
  assert(c.splashDone,'debris must remember that it already splashed');
  assert(splashCountAtFloat>=1,'airborne-to-float transition must splash once');
}

{
  const a=makeStateAndShip(),b=makeStateAndShip();
  B.createDebrisClusters(a.s,a.ship,[a.live.slice(0,2)]);
  B.createDebrisClusters(b.s,b.ship,[b.live.slice(0,12)]);
  const small=a.s.debrisClusters[a.s.debrisClusters.length-1];
  const large=b.s.debrisClusters[b.s.debrisClusters.length-1];
  assert(large.life>small.life,'larger debris clusters must remain afloat/sink longer');
}

console.log('V8.4 debris water tests passed');
