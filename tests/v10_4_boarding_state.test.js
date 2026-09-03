'use strict';
const {assert,makeContext,makeState,loadBoarding}=require('./v10_4_test_helpers');
const ctx=makeContext(),st=makeState(ctx),V=loadBoarding(ctx),e=st.enemies[0];
assert.equal(typeof V.ensureState,'function');
V.ensureState(st);assert.equal(st.boarding.active,false);
V.startApproach(st,e);assert.equal(e.__v104BoardingMode,'boardingApproach');
V.beginBoarding(st,e);assert.equal(st.boarding.active,true);assert.equal(st.boarding.enemyShipId,e.id);assert.equal(e.__v104BoardingMode,'boardingLocked');
console.log('V10.4 boarding state: PASS');
