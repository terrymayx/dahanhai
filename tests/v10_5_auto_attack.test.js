'use strict';
const {assert,makeContext,makeState,loadV105Core,loadV104,loadV105AI}=require('./v10_5_test_helpers');
const ctx=makeContext(),st=makeState(ctx);loadV105Core(ctx);loadV104(ctx);const AI=loadV105AI(ctx),Crew=ctx.V105Crew;
Crew.prepareBattle(st);ctx.V104Boarding.beginBoarding(st,st.enemies[0]);const captain=st.player.crew.find(c=>c.role==='captain');st.boarding.captain=captain;
const enemy=st.enemies[0].crew.find(c=>c.boardingEligible);enemy.currentShipId='player';enemy.state='fight';enemy.x=captain.x+10;enemy.y=captain.y;st.boarding.boarders=[enemy];
const hp=enemy.hp,x=captain.x,y=captain.y;AI.updateCaptainBoarding(st,.6);assert.ok(enemy.hp<hp);assert.equal(captain.x,x);assert.equal(captain.y,y);
enemy.x=captain.x+200;enemy.y=captain.y;const x2=captain.x,y2=captain.y;AI.updateCaptainBoarding(st,.6);assert.equal(captain.x,x2);assert.equal(captain.y,y2);
console.log('V10.5 captain auto attack: PASS');
