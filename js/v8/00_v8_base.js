(function(root){
  'use strict';
  const Config={W:1920,H:1080,PLAYER_X:430,PLAYER_Y:560,PLAYER_FIRE_INTERVAL:.72,ENEMY_SPAWN_INTERVAL:2.4};
  const Util={
    clamp:(v,a,b)=>v<a?a:v>b?b:v,
    rand:(a,b)=>a+Math.random()*(b-a),
    dist:(x1,y1,x2,y2)=>Math.hypot(x2-x1,y2-y1),
    lerp:(a,b,t)=>a+(b-a)*t,
  };
  root.V8Config=Config;
  root.V8Util=Util;
})(typeof globalThis!=='undefined'?globalThis:this);
