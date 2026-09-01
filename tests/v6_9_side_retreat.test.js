// V6.9 side-retreat RED/GREEN regression.
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const assert=require('assert');
const root=path.join(__dirname,'..');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const file=path.join(root,'js/26_v69_side_retreat.js');
assert.ok(fs.existsSync(file),'V6.9 side-retreat layer must exist');
assert.match(index,/js\/26_v69_side_retreat\.js/,'index must load side-retreat layer');
const code=fs.readFileSync(file,'utf8');

const upper={t:{pir:3,sp:100},state:'docked',deployed:3,contact:true,contactY:420,y:420,x:700,gone:false};
const lower={t:{pir:3,sp:100},state:'docked',deployed:3,contact:true,contactY:700,y:700,x:700,gone:false};
const upperPirates=[0,1,2].map(()=>({ship:upper,hp:40,state:'fight'}));
const lowerPirates=[0,1,2].map(()=>({ship:lower,hp:40,state:'fight'}));
const g={enemies:[upper,lower],boarders:[...upperPirates,...lowerPirates]};
const ctx={g,PLAYER_COLLIDER:{cy:560},H:1080,SPD:1,update:()=>{},clearEnemyContact:e=>{e.contact=false;e.contactY=null;},Math};
vm.createContext(ctx);vm.runInContext(code,ctx);

assert.equal(ctx.v69TroopsAboard(upper),true,'all deployed pirates in fight means unloading is complete');
assert.equal(ctx.beginV69SideRetreat(upper),true,'upper ship should start side retreat');
assert.equal(upper.state,'retreatSide');assert.equal(upper.retreatSide,-1);assert.equal(upper.contact,false);
assert.equal(ctx.beginV69SideRetreat(lower),true,'lower ship should start side retreat');
assert.equal(lower.retreatSide,1);assert.equal(lower.contact,false);

const uy=upper.y,ly=lower.y;
ctx.updateV69SideRetreat(upper,.5);ctx.updateV69SideRetreat(lower,.5);
assert.ok(upper.y<uy,'upper ship must move upward');
assert.ok(lower.y>ly,'lower ship must move downward');
assert.ok(g.boarders.every(b=>b.hp>0&&b.state==='fight'),'pirates already aboard must continue fighting');

const crossing={t:{pir:3,sp:100},state:'docked',deployed:3,contact:true,contactY:420,y:420};
g.boarders.push({ship:crossing,hp:40,state:'plank'});
assert.equal(ctx.v69TroopsAboard(crossing),false,'ship must not leave while a live pirate is still crossing');
console.log('PASS: V6.9 side retreat regression');
