'use strict';
const {assert,makeContext,makeState,loadBoarding}=require('./v10_4_test_helpers');
for(const [kind,min,max] of [['sloop',4,6],['gunship',7,9],['manowar',10,14]]){
  const ctx=makeContext(),st=makeState(ctx,kind),V=loadBoarding(ctx);V.beginBoarding(st,st.enemies[0]);V.spawnBoardingWave(st,st.enemies[0]);
  assert.ok(st.boarding.enemyTotal>=min&&st.boarding.enemyTotal<=max,kind+' wave count');
  assert.ok(st.boarding.boarders.every(u=>['waiting','boardingJump','land','fight'].includes(u.state)));
}
console.log('V10.4 boarding wave: PASS');
