const fs = require('fs');
const assert = require('assert');

const model = fs.readFileSync('js/10_model.js','utf8');
const boarding = fs.readFileSync('js/21_boarding_update.js','utf8');
const scene = fs.readFileSync('js/40_scene.js','utf8');
const hud = fs.readFileSync('js/50_hud_overlay.js','utf8');
const index = fs.readFileSync('index.html','utf8');

assert(!/const\s+SLOTS\s*=/.test(model), 'V6 core must not define fixed SLOTS');
assert(!/slotBlocked\s*\(/.test(model), 'V6 core must not use slotBlocked');
assert(!/chooseDockSlot\s*\(/.test(model), 'V6 core must not use chooseDockSlot');
assert(!/slot:null/.test(model), 'enemy spawn must not create slot');
assert(/contactX/.test(model), 'enemy model must expose contactX');
assert(/contactY/.test(model), 'enemy model must expose contactY');
assert(/function\s+contactPointForEnemy/.test(model), 'dynamic contact point helper missing');
assert(/function\s+lockEnemyContact/.test(model), 'contact lock helper missing');
assert(!/SLOTS\./.test(boarding), 'boarding routes must not depend on fixed SLOTS');
assert(!/上舷|下舷/.test(hud), 'HUD must not expose fixed boarding slots');
assert(!/41_collision_visual\.js/.test(index), 'old collision visual patch must not load');
assert(!/58_berthing_contact_fix\.js/.test(index), 'old berthing patch must not load');
assert(/clamp\(f\.t\/f\.dur,0,1\)/.test(scene), 'sink FX clamp regression must remain');

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
