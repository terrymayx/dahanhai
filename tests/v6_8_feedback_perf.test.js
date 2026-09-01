const fs=require('fs');
const assert=require('assert');

const index=fs.readFileSync('index.html','utf8');
const scene=fs.readFileSync('js/40_scene.js','utf8');
const v68Path='js/24_v68_feedback_perf.js';
assert(/V6\.8/.test(index),'index must publish V6.8');
assert(new RegExp(v68Path.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).test(index),'V6.8 battle layer must be loaded');
assert(fs.existsSync(v68Path),'V6.8 battle feedback/performance layer missing');
const v68=fs.readFileSync(v68Path,'utf8');

assert(/V6\.8 BATTLE FEEDBACK \+ PERFORMANCE START/.test(v68),'V6.8 marker missing');
assert(/const\s+V68_LIMITS\s*=/.test(v68),'visual hard limits missing');
for(const key of ['fx','smoke','texts','foam','particles'])assert(new RegExp(`${key}\\s*:`).test(v68),`missing ${key} cap`);
assert(/class\s+V68Pool/.test(v68),'object pool helper missing');
assert(/enemyPool/.test(v68)&&/boarderPool/.test(v68)&&/ballPool/.test(v68),'enemy/boarder/ball pools missing');
assert(/particlePool/.test(v68),'particle pool missing');
assert(/function\s+adoptPooledObject/.test(v68),'pooled object adoption helper missing');
assert(/spawnEnemy\s*=\s*function/.test(v68),'enemy spawning must use pool wrapper');
assert(/deployBoarder\s*=\s*function/.test(v68),'boarder deployment must use pool wrapper');
assert(/launchBall\s*=\s*function/.test(v68),'friendly cannonballs must use pool wrapper');

assert(/class\s+V68SpatialHash/.test(v68),'spatial hash missing');
assert(/resolveEnemyShipCollisions\s*=\s*function/.test(v68),'enemy collision must be spatially partitioned');
assert(/separateDeckFighters\s*=\s*function/.test(v68),'deck pirate separation must be spatially partitioned');

for(const fn of ['emitWoodImpact','addHullHole','emitPirateOverboard','emitBrokenPlanks','drawV68EnemyDamage','trimV68Visuals']){
  assert(new RegExp(`function\\s+${fn}`).test(v68),`${fn} missing`);
}
assert(/damageEnemy\s*=\s*function/.test(v68),'enemy damage feedback wrapper missing');
assert(/damageLevel/.test(v68),'ship damage state missing');
assert(/fireLevel/.test(v68),'ship fire state missing');
assert(/holes/.test(v68),'persistent hull holes missing');
assert(/plank/.test(v68)&&/pirateFall/.test(v68),'broken plank / pirate overboard effects missing');
assert(/drawEnemyShip\s*=\s*function/.test(v68),'damaged hull overlay draw wrapper missing');
assert(/drawFxAll\s*=\s*function/.test(v68),'V6.8 transient effect renderer hook missing');

assert(/clamp\(f\.t\/f\.dur,0,1\)/.test(scene),'sink FX clamp regression must remain intact');

console.log('PASS: V6.8 battle feedback + performance regression');
