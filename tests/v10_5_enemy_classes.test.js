'use strict';
const {assert,makeContext,makeState,loadV105Core,loadV104,loadV105AI}=require('./v10_5_test_helpers');
const ctx=makeContext(),st=makeState(ctx,'manowar');loadV105Core(ctx);loadV104(ctx);const AI=loadV105AI(ctx),Crew=ctx.V105Crew;Crew.prepareBattle(st);
const enemy=st.enemies[0],archer=enemy.crew.find(c=>c.combatClass==='archer'),elite=enemy.crew.find(c=>c.combatClass==='eliteCaptain'),sword=enemy.crew.find(c=>c.combatClass==='swordsman');assert.ok(archer&&sword);assert.ok(!elite||enemy.crew.filter(c=>c.combatClass==='eliteCaptain').length===1);
ctx.V104Boarding.beginBoarding(st,enemy);const captain=st.player.crew.find(c=>c.role==='captain');st.boarding.captain=captain;
archer.currentShipId='player';archer.state='fight';archer.x=captain.x+70;archer.y=captain.y;const d0=Math.hypot(archer.x-captain.x,archer.y-captain.y);AI.updateEnemyClass(st,archer,.2);const d1=Math.hypot(archer.x-captain.x,archer.y-captain.y);assert.ok(d1>=d0-8);
if(elite){elite.currentShipId='player';elite.state='fight';elite.x=captain.x+18;elite.y=captain.y;elite.heavyTimer=0;AI.updateEnemyClass(st,elite,.7);assert.ok(elite.state==='heavyWindup'||elite.heavyWindup>=0||elite.attackTimer>=0);}
console.log('V10.5 enemy classes: PASS');
