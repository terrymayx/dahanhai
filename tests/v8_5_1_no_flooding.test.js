const fs=require('fs');
const vm=require('vm');
const assert=require('assert');

const html=fs.readFileSync('index.html','utf8');
const overlay=fs.readFileSync('js/v8/45_damage_overlay.js','utf8');

assert(fs.existsSync('js/v8/36_damage_model.js'),'V8.5.1 damage-only module must remain available');
assert(!html.includes('36_damage_flooding.js'),'active entry must not load flooding module');
assert(html.includes('36_damage_model.js?v=8.6.0'),'active V8.6 entry must load the damage-only model');
assert(html.includes('V8.6 · 部件损伤与结构应力'),'page must identify current V8.6 build');

for(const token of ['进水','漏水','flooding','leaks','draft','drawLeak','applyDraft']){
  assert(!overlay.includes(token),`damage overlay must not contain flooding token: ${token}`);
}
for(const token of ['进水','漏水','flooding','leaks','draft']){
  assert(!html.includes(token),`active entry must not contain flooding token: ${token}`);
}

const ctx={console,Math,setTimeout,clearTimeout};ctx.globalThis=ctx;vm.createContext(ctx);
for(const f of ['js/v8/00_v8_base.js','js/v8/10_ship_grid.js','js/v8/20_projectiles.js','js/v8/30_battle.js','js/v8/35_combat_tuning.js','js/v8/36_damage_model.js']){
  vm.runInContext(fs.readFileSync(f,'utf8'),ctx,{filename:f});
}
const B=ctx.V8Battle,G=ctx.V8ShipGrid;
assert.strictEqual(typeof G.damageStage,'function','damage stages must remain available');
const state=B.newGame();
const enemy=B.spawnEnemy(state,'gunship',{x:1200,y:560});
for(const ship of [state.player,enemy]){
  assert(!Object.prototype.hasOwnProperty.call(ship,'leaks'),'ship must not own leaks');
  assert(!Object.prototype.hasOwnProperty.call(ship,'flooding'),'ship must not own flooding');
  assert(!Object.prototype.hasOwnProperty.call(ship,'draft'),'ship must not own draft');
}

const hull=enemy.cells.find(c=>c.type==='hull');
assert(hull,'enemy must contain hull cells');
const speedBefore=enemy.speed;
G.damageCell(enemy,hull,999);
if(typeof state.onCellDestroyed==='function'){
  const pos=G.cellCenterWorld(enemy,hull);
  state.onCellDestroyed(enemy,hull,pos,{vx:1,vy:0,damage:999,side:'player',penetration:78});
}
assert(!Object.prototype.hasOwnProperty.call(enemy,'leaks'),'destroyed hull must not create leaks');
assert(!Object.prototype.hasOwnProperty.call(enemy,'flooding'),'destroyed hull must not create flooding');
assert(!Object.prototype.hasOwnProperty.call(enemy,'draft'),'destroyed hull must not create draft');
assert.strictEqual(enemy.speed,speedBefore,'destroyed hull must not apply flooding speed penalties');
assert.strictEqual(state.shake,0,'damage model must preserve no-shake behavior');

console.log('V8.5.1 no-flooding compatibility tests passed');
