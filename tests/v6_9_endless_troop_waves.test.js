// V6.9 RED/GREEN regression trigger.
const fs=require('fs');
const path=require('path');
const assert=require('assert');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

const index=read('index.html');
const model=read('js/10_model.js');
const update=read('js/21_boarding_update.js');
const fx=read('js/40_scene.js');
const v68=read('js/24_v68_feedback_perf.js');
const v69Path=path.join(root,'js/25_v69_endless_waves.js');
assert.ok(fs.existsSync(v69Path),'V6.9 layer must exist');
const v69=read('js/25_v69_endless_waves.js');

assert.match(index,/V6\.9/,'page must publish V6.9');
assert.match(index,/js\/25_v69_endless_waves\.js/,'index must load V6.9 layer');
assert.doesNotMatch(index,/js\/55_levels\.js/,'level system must not load');
assert.doesNotMatch(index,/js\/59_melee_test_mode\.js/,'old melee-test archer suppression must not load');

assert.match(model,/sloop\s*:\{[^}]*pir\s*:\s*3[^}]*shoot\s*:\s*false/i,'sloop must remain troop carrier');
assert.match(v69,/Object\.assign\(TYPES\.gunship\s*,\s*\{[^}]*pir\s*:\s*5[^}]*role\s*:\s*['"]board['"][^}]*shoot\s*:\s*false/i,'gunship must become 5-pirate troop carrier');
assert.match(v69,/Object\.assign\(TYPES\.manowar\s*,\s*\{[^}]*pir\s*:\s*8[^}]*shoot\s*:\s*false/i,'manowar must become 8-pirate troop carrier');
assert.doesNotMatch(v69,/TYPES\.\w+\.role\s*=\s*['"]ranged['"]/i,'V6.9 must not create ranged enemy roles');

assert.match(v69,/const\s+V69_WAVE_INTERVAL\s*=\s*15\b/,'wave interval must be exactly 15 seconds');
assert.match(v69,/function\s+v69WaveShipCount\s*\(/,'wave ship-count helper must exist');
assert.match(v69,/Math\.min\(10\s*,\s*3\s*\+\s*Math\.floor\(\(wave\s*-\s*1\)\s*\/\s*2\)\)/,'wave count must cap at 10');
assert.match(v69,/function\s+startV69Wave\s*\(/,'endless wave starter must exist');
assert.match(v69,/waveClock/,'wave timer state must exist');
assert.match(v69,/nextWaveIn/,'next-wave countdown state must exist');
assert.match(v69,/while\s*\(g\.waveClock\s*>=\s*V69_WAVE_INTERVAL\)/,'wave timer must catch up without waiting for previous waves to clear');
assert.match(v69,/g\.state\s*===\s*['"]win['"][^\n]*g\.state\s*=\s*['"]playing['"]/,'endless mode must suppress normal win state');

assert.match(v69,/function\s+chooseV69ArcherTarget\s*\(/,'archer target helper must exist');
const targetFn=v69.match(/function\s+chooseV69ArcherTarget\s*\(\)\s*\{([\s\S]*?)\n\}/);
assert.ok(targetFn,'archer target helper body must be readable');
const body=targetFn[1];
const fightPos=body.indexOf("state==='fight'");
const transitPos=Math.min(...['plank','swing','climb'].map(s=>body.indexOf(`state==='${s}'`)).filter(n=>n>=0));
const shipPos=body.indexOf('g.enemies');
assert.ok(fightPos>=0&&transitPos>fightPos&&shipPos>transitPos,'archer priority must be fight boarder -> transit boarder -> enemy ship');
assert.match(v69,/function\s+fireV69Archer\s*\(/,'continuous archer fire helper must exist');
assert.match(v69,/v69ArcherT/,'archer automatic fire timer must exist');
assert.match(v69,/g\.arrows\.push\(/,'archer must launch arrows at ship targets');
assert.match(v69,/damageBoarder\(/,'archer must damage boarding targets');

assert.match(update,/deployBoarder\(e\)/,'boarding deployment must remain in battle loop');
assert.match(fx,/const p=clamp\(f\.t\/f\.dur,0,1\);/,'FX progress clamp regression must remain');
assert.match(v68,/V68SpatialHash/,'V6.8 spatial hash must remain');
assert.match(v68,/enemyPool/,'V6.8 enemy pool must remain');

console.log('PASS: V6.9 endless troop wave regression');
