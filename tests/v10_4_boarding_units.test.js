'use strict';
const {assert,makeContext,makeState,loadBoarding}=require('./v10_4_test_helpers');
const ctx=makeContext(),st=makeState(ctx),V=loadBoarding(ctx);
V.beginBoarding(st,st.enemies[0]);
assert.equal(st.boarding.captain.maxHp,140);assert.equal(st.boarding.captain.damage,28);assert.ok(st.boarding.allies.length>=4&&st.boarding.allies.length<=6);
const x=st.boarding.captain.x;V.setCaptainInput(st,{x:1,y:0,attack:false});V.update(st,.1);assert.ok(st.boarding.captain.x>=x);
console.log('V10.4 boarding units: PASS');
