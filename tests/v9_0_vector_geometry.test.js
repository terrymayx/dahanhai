const fs=require('fs');
const vm=require('vm');
const assert=require('assert');

assert(fs.existsSync('js/v8/38_vector_ship.js'),'V9.0 vector ship module must exist');

const ctx={console,Math};ctx.globalThis=ctx;vm.createContext(ctx);
for(const f of ['js/v8/10_ship_grid.js','js/v8/38_vector_ship.js']){
  vm.runInContext(fs.readFileSync(f,'utf8'),ctx,{filename:f});
}
const V=ctx.V9VectorShip,G=ctx.V8ShipGrid;
assert(V,'V9VectorShip must be exported');
assert.strictEqual(typeof V.hullProfile,'function');
assert.strictEqual(typeof V.traceHullPath,'function');
assert.strictEqual(typeof V.traceDeckPath,'function');
assert.strictEqual(typeof V.damageSeed,'function');

const player=G.createTemplateShip('player','player',0,0);
const sloop=G.createTemplateShip('sloop','enemy',0,0);
const gunship=G.createTemplateShip('gunship','enemy',0,0);
const manowar=G.createTemplateShip('manowar','enemy',0,0);

const pp=V.hullProfile(player),sp=V.hullProfile(sloop),gp=V.hullProfile(gunship),mp=V.hullProfile(manowar);
assert.strictEqual(pp.orientation,'vertical','player flagship must use a vertical ship silhouette');
assert.strictEqual(sp.orientation,'horizontal','enemy ships must use a horizontal ship silhouette');
assert(pp.length>pp.beam,'player hull must be longer than it is wide');
assert(sp.length>sp.beam,'sloop hull must be longer than it is wide');
assert(gp.fullness>sp.fullness,'gunship must be visually fuller than sloop');
assert(mp.fullness>gp.fullness,'manowar must be visually fuller than gunship');
assert(sp.bowTaper<sp.sternTaper,'enemy bow must taper more sharply than stern');
assert.notStrictEqual(V.damageSeed(3,7),V.damageSeed(4,7),'damage seed must vary by grid cell');
assert.strictEqual(V.damageSeed(3,7),V.damageSeed(3,7),'damage seed must be deterministic');

console.log('V9.0 vector geometry tests passed');
