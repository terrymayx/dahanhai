// V6.9 transport-disappear RED/GREEN regression.
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const assert=require('assert');
const root=path.join(__dirname,'..');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const file=path.join(root,'js/26_v69_side_retreat.js');
assert.ok(fs.existsSync(file),'V6.9 transport cleanup layer must exist');
assert.match(index,/js\/26_v69_side_retreat\.js/,'index must load transport cleanup layer');
const code=fs.readFileSync(file,'utf8');

const ship={t:{pir:3,sp:100},state:'docked',deployed:3,contact:true,contactY:420,y:420,x:700,gone:false};
const pirates=[0,1,2].map(()=>({ship,hp:40,state:'fight'}));
const emptyShip={t:{pir:3,sp:100},state:'docked',deployed:3,contact:true,contactY:700,y:700,x:700,gone:false};
const g={enemies:[ship,emptyShip],boarders:[...pirates]};
const ctx={g,update:()=>{},clearEnemyContact:e=>{e.contact=false;e.contactY=null;},Math};
vm.createContext(ctx);vm.runInContext(code,ctx);

assert.equal(ctx.v69TroopsUnloaded(ship),true,'all planned pirates aboard means unloading is complete');
assert.equal(ctx.removeV69TransportShip(ship),true,'finished transport should disappear immediately');
assert.equal(ship.gone,true,'finished transport must be marked gone in place');
assert.equal(ship.contact,false,'disappearing transport must release boarding contact');
assert.equal(ship.y,420,'finished transport must not move before disappearing');
assert.equal(ship.x,700,'finished transport must not move before disappearing');
assert.ok(g.boarders.every(b=>b.hp>0&&b.state==='fight'),'pirates already aboard must continue fighting');

assert.equal(ctx.v69TroopsUnloaded(emptyShip),true,'transport also disappears if all released pirates are already dead');
assert.equal(ctx.removeV69TransportShip(emptyShip),true);
assert.equal(emptyShip.gone,true);

const crossing={t:{pir:3,sp:100},state:'docked',deployed:3,contact:true,contactY:420,y:420,x:700,gone:false};
g.boarders.push({ship:crossing,hp:40,state:'plank'});
assert.equal(ctx.v69TroopsUnloaded(crossing),false,'ship must remain while a live pirate is still crossing');
assert.equal(ctx.removeV69TransportShip(crossing),false);
assert.equal(crossing.gone,false);

assert.doesNotMatch(code,/retreatSide|retreatSpeed|updateV69SideRetreat/,'transport cleanup must not contain side-retreat movement');
console.log('PASS: V6.9 transport disappears after unloading');
