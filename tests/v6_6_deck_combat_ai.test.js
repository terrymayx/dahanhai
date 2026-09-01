const fs = require('fs');
const assert = require('assert');
const vm = require('vm');

const aiPath='js/22_deck_combat_ai.js';
const index = fs.readFileSync('index.html','utf8');
assert(fs.existsSync(aiPath), 'V6.6 deck combat AI layer must exist');
const ai = fs.readFileSync(aiPath,'utf8');

assert(/V6\.6/.test(index), 'index must publish V6.6');
assert(/22_deck_combat_ai\.js/.test(index), 'index must load V6.6 deck combat AI layer');
assert(/V6\.6 DECK COMBAT AI START/.test(ai), 'V6.6 deck combat AI helper block missing');
assert(/function\s+crewCombatProfile/.test(ai), 'crewCombatProfile missing');
assert(/function\s+enterBoarderFight/.test(ai), 'enterBoarderFight missing');
assert(/function\s+boarderAttackPoint/.test(ai), 'boarderAttackPoint missing');
assert(/function\s+chooseBoarderCrewTarget/.test(ai), 'chooseBoarderCrewTarget missing');
assert(/function\s+moveCrewCombat/.test(ai), 'moveCrewCombat missing');
assert(/function\s+separateDeckFighters/.test(ai), 'separateDeckFighters missing');
assert(/function\s+separateCrewFormation/.test(ai), 'separateCrewFormation missing');
assert(/updateBoarder=function/.test(ai), 'V6.6 must replace boarder fight movement');
assert(/enterBoarderFight\(b\)/.test(ai), 'boarding transitions must enter fight through V6.6 helper');
assert(/chooseBoarderCrewTarget\(b\)/.test(ai), 'fight boarders must use distributed crew targeting');
assert(/moveCrewCombat\(c,tgt,dt\)/.test(ai), 'crew must use role-aware combat movement');
assert(/separateDeckFighters\(\)/.test(ai), 'deck fighters must run local separation');
assert(/separateCrewFormation\(\)/.test(ai), 'crew must run formation separation');

const helperMatch = ai.match(/\/\* V6\.6 DECK COMBAT AI START \*\/([\s\S]*?)\/\* V6\.6 DECK COMBAT AI END \*\//);
assert(helperMatch, 'V6.6 helper block must be extractable');
const ctx = {
  Math,
  g:{boarders:[],crew:[]},
  clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
  dist:(x1,y1,x2,y2)=>Math.hypot(x2-x1,y2-y1),
};
vm.createContext(ctx);
vm.runInContext(helperMatch[1],ctx);

const captain={id:'captain',x:450,y:600,homeX:450,homeY:600,alive:true};
const archer={id:'archer',x:450,y:360,homeX:450,homeY:360,alive:true};
const gunner={id:'gunner',x:500,y:610,homeX:500,homeY:610,alive:true};
const cp=ctx.crewCombatProfile(captain),ap=ctx.crewCombatProfile(archer),gp=ctx.crewCombatProfile(gunner);
assert(ap.preferred>gp.preferred, 'archer must prefer a longer combat distance than gunner');
assert(gp.min>cp.min, 'gunner must keep more minimum distance than captain');

const target={x:450,y:560,alive:true,id:'captain'};
const b0={x:520,y:560,hp:10,state:'fight',fightSlot:0};
const b2={x:520,y:560,hp:10,state:'fight',fightSlot:2};
const p0=ctx.boarderAttackPoint(b0,target),p2=ctx.boarderAttackPoint(b2,target);
assert(Math.hypot(p0.x-p2.x,p0.y-p2.y)>24, 'different fight slots must produce separated attack points');

const c1={id:'captain',x:400,y:500,alive:true};
const c2={id:'gunner',x:500,y:500,alive:true};
const existing={x:450,y:540,hp:10,state:'fight',targetCrewId:'captain'};
const newcomer={x:450,y:540,hp:10,state:'fight',targetCrewId:null};
ctx.g.crew=[c1,c2];ctx.g.boarders=[existing,newcomer];
const chosen=ctx.chooseBoarderCrewTarget(newcomer);
assert.strictEqual(chosen.id,'gunner','new boarder should prefer the equally close less-loaded crew target');

const closeArcher={id:'archer',x:450,y:500,homeX:450,homeY:360,alive:true};
const nearPirate={x:400,y:500,hp:10,state:'fight'};
const archerBefore=closeArcher.x;
ctx.moveCrewCombat(closeArcher,nearPirate,0.2);
assert(closeArcher.x>archerBefore,'archer must retreat when a pirate is inside minimum range');

const farGunner={id:'gunner',x:310,y:600,homeX:500,homeY:610,alive:true};
const farPirate={x:540,y:600,hp:10,state:'fight'};
const gunnerBefore=farGunner.x;
ctx.moveCrewCombat(farGunner,farPirate,0.2);
assert(farGunner.x>gunnerBefore,'gunner must close distance when target is outside preferred bomb range');

const f1={x:450,y:600,hp:10,state:'fight'},f2={x:451,y:600,hp:10,state:'fight'};
ctx.g.boarders=[f1,f2];
ctx.separateDeckFighters();
assert(Math.hypot(f1.x-f2.x,f1.y-f2.y)>=27,'fight boarders must separate instead of stacking on one point');

const u1={id:'captain',x:450,y:600,alive:true},u2={id:'gunner',x:451,y:600,alive:true};
ctx.g.crew=[u1,u2];
ctx.separateCrewFormation();
assert(Math.hypot(u1.x-u2.x,u1.y-u2.y)>=31,'crew must keep formation spacing instead of overlapping');

console.log('PASS: V6.6 deck combat AI regression');
