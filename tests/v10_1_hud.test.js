const fs=require('fs');
const assert=require('assert');
const src=fs.readFileSync('js/v8/47_v97_status_overlay.js','utf8');
assert(src.includes('船体应力'),'HUD should show bending stress');
assert(src.includes('舱水'),'HUD should show compartment water levels');
assert(src.includes('危险区'),'HUD should show critical longitudinal region');
assert(src.includes('阶段'),'HUD should show progressive break stage');
console.log('V10.1 HUD contract passed');
