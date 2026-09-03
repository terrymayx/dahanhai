'use strict';
const fs=require('fs');
const assert=require('assert');
const html=fs.readFileSync('index.html','utf8');
assert.ok(/<title>大航海时代 V\d+\.\d+/.test(html),'entry title should expose a current Dahanhai version');
const required=['44_v104_boarding.js','36_v104_boarding_bridge.js','45_v104_boarding_render.js','49_v104_boarding_control.js'];
for(const item of required)assert.ok(html.indexOf(item)>=0,item+' missing');
const versions=[];
for(const line of html.split('\n')){const i=line.indexOf('?v=');if(i>=0){const rest=line.slice(i+3);const j=rest.indexOf('"');versions.push(j>=0?rest.slice(0,j):rest);}}
assert.ok(versions.length>20);
assert.strictEqual(new Set(versions).size,1,'all runtime scripts must share one cache key');
const parts=versions[0].split('.').map(Number);
assert.ok(parts.length===3&&parts.every(Number.isFinite),'runtime cache key must be semver');
assert.ok(parts[0]>10||(parts[0]===10&&parts[1]>=4),'runtime version must retain V10.4 or later');
assert.ok(html.indexOf('44_v104_boarding.js')<html.indexOf('36_v104_boarding_bridge.js'),'boarding core must load before boarding bridge');
assert.ok(html.indexOf('45_v104_boarding_render.js')<html.indexOf('36_v104_boarding_bridge.js'),'boarding renderer must load before battle bridge wrapping completes');
assert.ok(html.indexOf('36_v104_boarding_bridge.js')<html.indexOf('50_input_loop.js'),'boarding bridge must install before input loop');
assert.ok(html.indexOf('50_input_loop.js')<html.indexOf('49_v104_boarding_control.js'),'boarding control must load after input loop');
console.log('V10.4 integration: PASS');
