'use strict';
const {assert,makeContext,makeState,loadV105Core,load}=require('./v10_5_test_helpers');
const ctx=makeContext(),st=makeState(ctx);loadV105Core(ctx);load('js/v8/44_v105_crew_posts.js',ctx);load('js/v8/36_v105_staffing_bridge.js',ctx);
const Crew=ctx.V105Crew,Posts=ctx.V105CrewPosts,Staff=ctx.V105StaffingBridge;Crew.prepareBattle(st);Posts.assignPosts(st.player);
assert.equal(Staff.turnScale(st.player),1);const helm=st.player.crew.find(c=>c.role==='helmsman');Crew.killCrew(helm,{kind:'test'});Posts.refreshStaffing(st.player);assert.ok(Staff.turnScale(st.player)<=0.7&&Staff.turnScale(st.player)>=0.35);
const g=Posts.gunGroups(st.player)[0],gunner=st.player.crew.find(c=>c.id===g.assignedCrewId);if(gunner)Crew.killCrew(gunner,{kind:'test'});Posts.refreshStaffing(st.player);assert.ok(Staff.reloadScaleForGroup(st.player,g.id)<=1);
assert.ok(Posts.firefightingScale(st.player)>0&&Posts.firefightingScale(st.player)<=1);
console.log('V10.5 staffing effects: PASS');
