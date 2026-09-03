const fs=require('fs'),assert=require('assert');
const path='js/v8/35_v103_broadside.js';assert(fs.existsSync(path),'V10.3 broadside module must exist');
const src=fs.readFileSync(path,'utf8'),battle=fs.readFileSync('js/v8/30_battle.js','utf8');
for(const token of ['updateEnemyHeading','fireEnemyBroadside','ENEMY_TURN_DEG','sloop:32','gunship:25','manowar:18','RUDDER_TURN_SCALE=.35'])assert(src.includes(token),`missing ${token}`);
assert(src.includes("ammoType:'standard'")||src.includes('ammoType:"standard"'),'enemy broadside shells must remain standard ammo');
assert(src.includes('wrapAngle'),'enemy heading must rotate by wrapped shortest-angle logic');
assert(battle.includes('updateEnemyHeading')||battle.includes('V103Broadside'),'battle update must invoke V103 enemy heading/broadside path');
console.log('V10.3 enemy broadside contract passed');
