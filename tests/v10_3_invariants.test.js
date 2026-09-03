const fs=require('fs'),assert=require('assert');
const proj=fs.readFileSync('js/v8/20_projectiles.js','utf8'),ammo=fs.readFileSync('js/v8/34_v102_ammo.js','utf8'),attack=fs.readFileSync('js/v8/33_v972_player_attack.js','utf8');
assert(proj.includes("else p.dead=true; // one cannonball = one foremost live layer"),'one-shell-one-layer invariant must remain');
assert(proj.includes("side==='player'?32:22"),'arc caps 32/22 must remain');
for(const t of ['solid','chain','explosive'])assert(ammo.includes(t),`V10.2 ammo ${t} must remain`);
assert(attack.includes('MIN_ATTACK=24')&&attack.includes('MAX_ATTACK=240'),'player attack range 24-240 must remain');
console.log('V10.3 inherited invariants passed');
