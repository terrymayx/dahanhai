const fs = require('fs');
const assert = require('assert');

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
assert(/function\s+contactPointForEnemy/.test(model), 'dynamic contact point helper missing');
assert(/function\s+lockEnemyContact/.test(model), 'contact lock helper missing');
assert(/function\s+clearEnemyContact/.test(model), 'contact clear helper missing');

assert(!/SLOTS\./.test(boarding), 'boarding routes must not depend on fixed SLOTS');
assert(!/chooseDockSlot\s*\(/.test(boarding), 'boarding must not reserve fixed slots');
assert(!/slotTargetY\s*\(/.test(boarding), 'boarding must use dynamic contactY');
assert(/contactY/.test(boarding), 'boarding must consume dynamic contactY');
assert(/function\s+findLocalBerthingOffset/.test(boarding), 'local berthing avoidance missing');
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
assert(/V6\.0/.test(index), 'index must publish V6.0');

assert(/const deployed=_deployBoarderLevel\(e\)/.test(levels));
assert(/if\(!deployed\)return false/.test(levels));
assert(/return true/.test(levels));
assert(/state\.autoCannon=false/.test(auto));
assert(/if\(!g\.autoCannon\)return false/.test(auto));
assert(/state\.infiniteShipHP=true/.test(hp));
assert(/g\.player\.hp=g\.player\.max/.test(hp));
assert(/b\.state==='fight'/.test(melee));
assert(/g\.arrows\.length=0/.test(melee));

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

console.log('PASS: V6.0 free boarding regression');
