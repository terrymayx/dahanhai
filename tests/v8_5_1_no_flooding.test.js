const fs=require('fs');
const vm=require('vm');
const assert=require('assert');

const html=fs.readFileSync('index.html','utf8');
const overlay=fs.readFileSync('js/v8/45_damage_overlay.js','utf8');

assert(fs.existsSync('js/v8/36_damage_model.js'),'V8.5.1 damage-only module must remain available');
assert(!html.includes('36_damage_flooding.js'),'removed V8.5 experimental flooding module must stay unloaded');
assert(/36_damage_model\.js\?v=[0-9]+\.[0-9]+\.[0-9]+/.test(html),'active entry must load the damage model with the current cache key');
assert(/<title>大航海时代 V\d+(?:\.\d+)?/.test(html),'page must identify an active V8.5-derived build');

// The old V8.5 damage-only stack must still remain flooding-free when loaded by itself.
// Later active releases may deliberately add their own separate flooding/buoyancy modules.
const ctx={console,Math,setTimeout,clearTimeout};ctx.globalThis=ctx;vm.createContext(ctx);
for(const f of ['js/v8/00_v8_base.js','js/v8/10_ship_grid.js','js/v8/20_projectiles.js','js/v8/30_battle.js','js/v8/35_combat_tuning.js','js/v8/36_damage_model.js']){
  vm.runInContext(fs.readFileSync(f,'utf8'),ctx,{filename:f});
}
const B=ctx.V8Battle,G=ctx.V8ShipGrid;
assert.strictEqual(typeof G.damageStage,'function','damage stages must remain available');
const state=B.newGame();
const enemy=B.spawnEnemy(state,'gunship',{x:1200,y:560});
for(const ship of [state.player,enemy]){
  assert(!Object.prototype.hasOwnProperty.call(ship,'leaks'),'damage-only stack must not own legacy leaks');
  assert(!Object.prototype.hasOwnProperty.call(ship,'flooding'),'damage-only stack must not own legacy flooding');
  assert(!Object.prototype.hasOwnProperty.call(ship,'draft'),'damage-only stack must not own legacy draft');
}

const hull=enemy.cells.find(c=>c.type==='hull');
assert(hull,'enemy must contain hull cells');
const speedBefore=enemy.speed;
G.damageCell(enemy,hull,999);
if(typeof state.onCellDestroyed==='function'){
  const pos=G.cellCenterWorld(enemy,hull);
  state.onCellDestroyed(enemy,hull,pos,{vx:1,vy:0,damage:999,side:'player',penetration:78});
}
assert(!Object.prototype.hasOwnProperty.call(enemy,'leaks'),'damage-only destroyed hull must not create legacy leaks');
assert(!Object.prototype.hasOwnProperty.call(enemy,'flooding'),'damage-only destroyed hull must not create legacy flooding');
assert(!Object.prototype.hasOwnProperty.call(enemy,'draft'),'damage-only destroyed hull must not create legacy draft');
assert.strictEqual(enemy.speed,speedBefore,'damage-only hull destruction must not apply legacy flooding speed penalties');
assert.strictEqual(state.shake,0,'damage model must preserve no-shake behavior');

assert(!overlay.includes('ship.leaks')&&!overlay.includes('ship.draft'),'current overlay must not revive obsolete V8.5 legacy leak/draft fields');
console.log('V8.5.1 damage-only no-flooding compatibility tests passed');
