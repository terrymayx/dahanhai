'use strict';
const {assert,makeContext,makeState,loadV105Core,loadV104,load}=require('./v10_5_test_helpers');
const ctx=makeContext(),st=makeState(ctx);loadV105Core(ctx);loadV104(ctx);load('js/v8/36_v105_crew_bridge.js',ctx);
const Crew=ctx.V105Crew,Bridge=ctx.V105CrewBridge,V104=ctx.V104Boarding;Crew.prepareBattle(st);const enemy=st.enemies[0];
const chosen=enemy.crew.find(c=>c.boardingEligible&&c.alive);assert.ok(chosen);
V104.beginBoarding(st,enemy);Bridge.mapPersistentBoarders(st,enemy);assert.ok(st.boarding.boarders.length>0);assert.ok(st.boarding.boarders.includes(chosen));
assert.strictEqual(st.boarding.boarders.find(c=>c.id===chosen.id),chosen);assert.equal(chosen.ownerShipId,'enemy-1');assert.equal(chosen.currentShipId,'player');
for(const c of st.player.crew.filter(c=>c.alive))assert.equal(Crew.canOccupyShip(c,enemy,st.boarding),false);
console.log('V10.5 boarding roster: PASS');
