const assert=require('assert'),fs=require('fs');
const status=fs.readFileSync('js/v8/47_v97_status_overlay.js','utf8');
for(const t of ['舱水','横倾','弯矩'])assert(status.includes(t),`status overlay should include ${t}`);
const legacy=fs.readFileSync('tests/v9_0_damage_visual_contract.test.js','utf8');
assert(!legacy.includes("globalCompositeOperation='destination-out'"),'legacy visual test must not require a specific composite operator');
console.log('V10 HUD and visual contract passed');
