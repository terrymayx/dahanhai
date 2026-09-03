const fs=require('fs'),assert=require('assert');
for(const f of ['js/v8/35_v103_broadside.js','js/v8/47_v97_status_overlay.js','js/v8/41_render_v9.js','js/v8/42_v103_muzzle_smoke.js','js/v8/49_v103_broadside_control.js'])assert(fs.existsSync(f),`missing ${f}`);
const broad=fs.readFileSync('js/v8/35_v103_broadside.js','utf8'),hud=fs.readFileSync('js/v8/47_v97_status_overlay.js','utf8'),smoke=fs.readFileSync('js/v8/42_v103_muzzle_smoke.js','utf8'),control=fs.readFileSync('js/v8/49_v103_broadside_control.js','utf8');
for(const token of ['batteryStatus','muzzleSmoke','applyRecoil'])assert(broad.includes(token),`missing ${token}`);
for(const token of ['左舷','右舷','当前射界','请转舵'])assert(hud.includes(token)||control.includes(token),`missing HUD/control text ${token}`);
for(const token of ['oldDraw',"f.k==='muzzleSmoke'",'ellipse','globalAlpha'])assert(smoke.includes(token),`smoke renderer missing ${token}`);
assert(broad.includes("k:'muzzle'")&&broad.includes("k:'muzzleSmoke'"),'each real gun fire path must emit muzzle flash and smoke');
console.log('V10.3 HUD/FX contract passed');
