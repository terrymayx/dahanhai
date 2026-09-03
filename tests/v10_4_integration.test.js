'use strict';
const fs=require('fs');
const assert=require('assert');
const html=fs.readFileSync('index.html','utf8');
assert.ok(html.indexOf('V10.4')>=0);
const required=['44_v104_boarding.js?v=10.4.0','36_v104_boarding_bridge.js?v=10.4.0','45_v104_boarding_render.js?v=10.4.0','49_v104_boarding_control.js?v=10.4.0'];
for(const item of required)assert.ok(html.indexOf(item)>=0,item+' missing');
const versions=[];
for(const line of html.split('\n')){const i=line.indexOf('?v=');if(i>=0){const rest=line.slice(i+3);const j=rest.indexOf('"');versions.push(j>=0?rest.slice(0,j):rest);}}
assert.ok(versions.length>20);
assert.ok(versions.every(v=>v==='10.4.0'));
console.log('V10.4 integration: PASS');
