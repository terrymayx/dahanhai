const fs=require('fs');
const assert=require('assert');
const render=fs.readFileSync('js/v8/40_render.js','utf8');
const overlay=fs.readFileSync('js/v8/45_damage_overlay.js','utf8');
assert(render.includes('root.V9VectorShip'),'renderer must bind V9 vector ship module');
assert(render.includes('Vector.drawShipLocal(ctx,ship,state)'),'ship rendering must delegate to V9 vector body');
assert(render.includes('Vector.drawDebrisClusterLocal(ctx,cluster)'),'debris rendering must delegate to organic V9 fragments');
assert(!overlay.includes("ctx.fillRect(p.x-s*.45"),'damage overlay must not paint square critical cells');
console.log('V9.0 renderer integration contract passed');
