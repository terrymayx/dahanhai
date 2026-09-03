const fs=require('fs'),assert=require('assert');
const path='js/v8/35_v103_broadside.js',bridgePath='js/v8/36_v103_battle_bridge.js';
assert(fs.existsSync(path),'V10.3 broadside module must exist');assert(fs.existsSync(bridgePath),'V10.3 battle bridge must exist');
const src=fs.readFileSync(path,'utf8'),bridge=fs.readFileSync(bridgePath,'utf8');
for(const token of ['updateEnemyHeading','fireEnemyBroadside','ENEMY_TURN_DEG','sloop:32','gunship:25','manowar:18','RUDDER_TURN_SCALE=.35'])assert(src.includes(token),`missing ${token}`);
assert(src.includes("ammoType:'standard'")||src.includes('ammoType:"standard"'),'enemy broadside shells must remain standard ammo');
assert(src.includes('wrapAngle'),'enemy heading must rotate by wrapped shortest-angle logic');
for(const token of ['updateBattle','fireEnemyBroadside','__v103FireT'])assert(bridge.includes(token),`battle bridge missing ${token}`);
console.log('V10.3 enemy broadside contract passed');
