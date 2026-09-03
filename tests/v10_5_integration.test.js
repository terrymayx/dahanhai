'use strict';
const fs=require('fs'),assert=require('assert');
const html=fs.readFileSync('index.html','utf8');
assert.ok(html.includes('V10.5'));
const required=['44_v105_crew.js?v=10.5.0','44_v105_crew_posts.js?v=10.5.0','44_v105_crew_ai.js?v=10.5.0','44_v105_crew_damage.js?v=10.5.0','36_v105_staffing_bridge.js?v=10.5.0','36_v105_crew_bridge.js?v=10.5.0','45_v105_crew_render.js?v=10.5.0','49_v105_crew_control.js?v=10.5.0'];
for(const item of required)assert.ok(html.includes(item),item+' missing');
const versions=[];for(const line of html.split('\n')){const i=line.indexOf('?v=');if(i>=0){const rest=line.slice(i+3),j=rest.indexOf('"');versions.push(j>=0?rest.slice(0,j):rest);}}
assert.ok(versions.length>20);assert.ok(versions.every(v=>v==='10.5.0'));
const ctl=fs.readFileSync('js/v8/49_v105_crew_control.js','utf8');assert.ok(ctl.includes('__v104CaptainInput'));assert.ok(!ctl.includes("keys.Space=true"));
console.log('V10.5 integration: PASS');
