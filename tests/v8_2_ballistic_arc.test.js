const fs=require('fs');
const vm=require('vm');
const assert=require('assert');
const ctx={console,Math};ctx.globalThis=ctx;vm.createContext(ctx);
for(const f of ['js/v8/00_v8_base.js','js/v8/10_ship_grid.js','js/v8/20_projectiles.js','js/v8/30_battle.js'])vm.runInContext(fs.readFileSync(f,'utf8'),ctx,{filename:f});
const P=ctx.V8Projectile,B=ctx.V8Battle;

// Projectile core must keep a real visual-height parabola without changing x/y collision logic,
// while respecting the later shallow-arc combat cap.
const state={projectiles:[],enemies:[]};
const p=P.spawn(state,{x:100,y:100,vx:400,vy:0,side:'player',life:3,arcHeight:120,flightTime:1});
assert.strictEqual(p.arcHeight,32,'player projectile arc must be capped at the shallow 32px trajectory');
assert.strictEqual(p.z,0,'ballistic projectile must start at sea-level height');
assert(p.vz>0,'ballistic projectile must start with positive vertical velocity');
assert(p.gravity>0,'ballistic projectile must have downward gravity');
P.updateAll(state,.5);
assert(p.z>30&&p.z<=32.01,'projectile should reach the shallow-arc apex halfway through the flight');
P.updateAll(state,.5);
assert(p.z>=0&&p.z<1,'projectile should return to sea-level near the intended landing time');

// Real battle shots must still use a visible but restrained arc: player <=32, enemy <=22.
const battle=B.newGame();
const enemy=B.spawnEnemy(battle,'sloop',{x:1200,y:520});
B.firePlayer(battle,enemy);
const playerShot=battle.projectiles[battle.projectiles.length-1];
assert(playerShot.arcHeight>0&&playerShot.arcHeight<=32,'player cannonballs must use a visible shallow arc capped at 32');
assert(playerShot.flightTime>0,'player cannonballs must have a flight time tied to their target distance');
B.fireEnemy(battle,enemy);
const enemyShot=battle.projectiles[battle.projectiles.length-1];
assert(enemyShot.arcHeight>0&&enemyShot.arcHeight<=22,'enemy cannonballs must use a shallower arc capped at 22');
assert(enemyShot.arcHeight<playerShot.arcHeight,'enemy cannonballs should use a lower arc than the player');

const render=fs.readFileSync('js/v8/40_render.js','utf8');
assert(render.includes('p.z'),'renderer must use projectile height when drawing the cannonball');
assert(render.includes('shadow')||render.includes('projectileShadow'),'renderer must draw a sea-level projectile shadow');
console.log('V8.2 shallow ballistic arc compatibility tests passed');
