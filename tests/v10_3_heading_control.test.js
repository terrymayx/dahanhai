const fs=require('fs'),assert=require('assert');
const broad='js/v8/35_v103_broadside.js',ui='js/v8/49_v103_broadside_control.js';
assert(fs.existsSync(broad),'V10.3 broadside module must exist');assert(fs.existsSync(ui),'V10.3 broadside control module must exist');
const src=fs.readFileSync(broad,'utf8'),control=fs.readFileSync(ui,'utf8');
for(const token of ['PLAYER_TURN_DEG=38','RUDDER_TURN_SCALE=.35','updatePlayerHeading','__v103TurnInput'])assert(src.includes(token),`missing ${token}`);
for(const token of ['↶ 左转','右转 ↷','KeyA','KeyD','ArrowLeft','ArrowRight','pointerdown','pointerup'])assert(control.includes(token),`missing control ${token}`);
assert(control.includes('stopPropagation'),'turn controls must not retarget enemies');
console.log('V10.3 heading control contract passed');
