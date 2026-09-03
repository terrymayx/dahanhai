'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
function load(rel,ctx){const src=fs.readFileSync(rel,'utf8');vm.runInNewContext(src,ctx,{filename:rel});return src;}
function makeContext(){
  const ctx={console,Math,Date,setTimeout,clearTimeout};ctx.globalThis=ctx;ctx.window=ctx;ctx.DHH={};
  load('js/v8/10_ship_grid.js',ctx);
  return ctx;
}
function makeState(ctx,kind='sloop'){
  const G=ctx.V8ShipGrid,p=G.createTemplateShip('player','player',300,480),e=G.createTemplateShip(kind,'enemy',640,480);
  p.id='player';e.id='enemy-1';p.state='active';e.state='active';
  return{time:0,state:'playing',paused:false,player:p,enemies:[e],fx:[],texts:[],projectiles:[],kills:0,gold:0};
}
function loadBoarding(ctx){load('js/v8/44_v104_boarding.js',ctx);return ctx.V104Boarding||(ctx.DHH&&ctx.DHH.V104Boarding);}
module.exports={assert,load,makeContext,makeState,loadBoarding};
