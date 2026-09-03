const assert=require('assert'),fs=require('fs');
assert(fs.existsSync('js/v8/38_v100_bending.js'),'V10 bending module should exist');
const src=fs.readFileSync('js/v8/38_v100_bending.js','utf8');
for(const t of ['SECTION_COUNT=12','BEND_FATIGUE_RATIO=.85','BEND_CRACK_RATIO=1','BEND_BREAK_RATIO=1.20','BEND_SNAP_RATIO=1.55','function rebuildSections','function evaluate','function forceSectionBreak'])assert(src.includes(t),t);
assert(src.includes('__v100BendingDirty'),'bending cache should be event-invalidated');
assert(!src.includes('for(const cell of ship.cells){ // frame'),'must not full-scan every frame');
console.log('V10 bending contract passed');
