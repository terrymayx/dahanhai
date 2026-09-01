const fs = require('fs');
const assert = require('assert');
const vm = require('vm');

const boarding = fs.readFileSync('js/21_boarding_update.js','utf8');
const combat = fs.readFileSync('js/20_combat_skills.js','utf8');
const scene = fs.readFileSync('js/40_scene.js','utf8');
const index = fs.readFileSync('index.html','utf8');

assert(/V6\.5/.test(index), 'index must publish V6.5');
assert(/V6\.4 BOARDING QUEUE START/.test(boarding), 'V6.4 boarding queue helper block missing');
assert(/function\s+boardingChannelCount/.test(boarding), 'boardingChannelCount missing');
assert(/function\s+boardingChannelBusy/.test(boarding), 'boardingChannelBusy missing');
assert(/function\s+chooseBoardingChannel/.test(boarding), 'chooseBoardingChannel missing');
assert(/boardingChannel:channel/.test(boarding), 'transit boarder must record its boarding channel');
assert(/boardingLaneY:laneY/.test(boarding), 'transit boarder must record its lane Y');
assert(/if\(channel<0\)returnfalse/.test(boarding.replace(/\s+/g,'')), 'busy channels must block deployment');
assert(/e\.deployT=\.12/.test(boarding), 'busy ship must poll for the next free channel instead of stacking boarders');
assert(/e\.type==='manowar'&&chooseBoardingChannel\(e\)>=0\?\.16/.test(boarding.replace(/\s+/g,'')), 'manowar must quickly fill its second free channel');

const helperMatch = boarding.match(/\/\* V6\.4 BOARDING QUEUE START \*\/([\s\S]*?)\/\* V6\.4 BOARDING QUEUE END \*\//);
assert(helperMatch, 'queue helper block must be extractable for behavior tests');
const ctx = {g:{boarders:[]}};
vm.createContext(ctx);
vm.runInContext(helperMatch[1],ctx);

const sloop = {type:'sloop'};
const manowar = {type:'manowar'};
const other = {type:'sloop'};
assert.strictEqual(ctx.boardingChannelCount(sloop),1,'sloop must use one boarding channel');
assert.strictEqual(ctx.boardingChannelCount(manowar),2,'manowar must use two boarding channels');

ctx.g.boarders=[];
assert.strictEqual(ctx.chooseBoardingChannel(sloop),0,'free sloop channel should be available');
ctx.g.boarders=[{ship:sloop,hp:10,boardingChannel:0,state:'plank'}];
assert.strictEqual(ctx.chooseBoardingChannel(sloop),-1,'sloop cannot launch a second pirate into an occupied channel');

ctx.g.boarders=[{ship:manowar,hp:10,boardingChannel:0,state:'swing'}];
assert.strictEqual(ctx.chooseBoardingChannel(manowar),1,'manowar must use its second channel while channel 0 is busy');
ctx.g.boarders.push({ship:manowar,hp:10,boardingChannel:1,state:'climb'});
assert.strictEqual(ctx.chooseBoardingChannel(manowar),-1,'manowar must wait when both channels are busy');

ctx.g.boarders=[{ship:sloop,hp:10,boardingChannel:0,state:'fight'}];
assert.strictEqual(ctx.chooseBoardingChannel(sloop),0,'channel must release once the previous pirate reaches fight state');
ctx.g.boarders=[{ship:other,hp:10,boardingChannel:0,state:'plank'}];
assert.strictEqual(ctx.chooseBoardingChannel(sloop),0,'different enemy ships must not block each other channels');

assert(/if\(b\.state==='fight'\)\{b\.ship=null;continue;\}/.test(combat.replace(/\s+/g,'')), 'fight boarders must remain after mother ship sinks');
assert(/b\.hp=0/.test(combat), 'unfinished transit boarders must be removed when mother ship sinks');
assert(/constrem=e\.t\.pir-e\.deployed/.test(scene.replace(/\s+/g,'')), 'undeployed pirates must remain visibly waiting on enemy deck');

console.log('PASS: V6.5 preserves V6.4 boarding queue regression');