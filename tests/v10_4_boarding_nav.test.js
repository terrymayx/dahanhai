'use strict';
const {assert,makeContext,makeState,loadBoarding}=require('./v10_4_test_helpers');
const ctx=makeContext(),st=makeState(ctx),V=loadBoarding(ctx);
const nav1=V.buildWalkable(st);assert.ok(nav1.nodes.length>0);
const dead=st.player.cells.find(c=>c.type==='deck');assert.ok(dead);dead.alive=false;V.markStructureDirty(st.player);
const nav2=V.buildWalkable(st);assert.equal(nav2.byKey[dead.gx+','+dead.gy],undefined);assert.notEqual(nav1.revision,nav2.revision);
console.log('V10.4 boarding nav: PASS');
