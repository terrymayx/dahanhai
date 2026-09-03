'use strict';
const {assert,makeContext,makeState,loadBoarding}=require('./v10_4_test_helpers');
const ctx=makeContext(),st=makeState(ctx),V=loadBoarding(ctx);V.beginBoarding(st,st.enemies[0]);V.spawnBoardingWave(st,st.enemies[0]);
const c=st.boarding.captain,b=st.boarding.boarders[0];b.state='fight';b.x=c.x+10;b.y=c.y;b.hp=40;b.maxHp=40;c.faceX=1;c.faceY=0;V.captainAttack(st);assert.ok(b.hp<40);
for(const u of st.boarding.boarders){u.hp=0;u.state='dead';}st.boarding.pendingSpawns=0;V.checkBoardingOutcome(st);assert.equal(st.boarding.active,false);assert.equal(st.boarding.result,'defended');
const st2=makeState(ctx);V.beginBoarding(st2,st2.enemies[0]);st2.boarding.captain.hp=0;V.checkBoardingOutcome(st2);assert.equal(st2.state,'lose');
console.log('V10.4 boarding combat: PASS');
