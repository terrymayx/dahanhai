/* V5.6 临时旗舰无限血：保留受击反馈，但旗舰 HP 永远满值 */
if(g.infiniteShipHP==null)g.infiniteShipHP=true;

const _newGameInfiniteShipHP=newGame;
newGame=function(){
  const state=_newGameInfiniteShipHP();
  state.infiniteShipHP=true;
  return state;
};

const _damagePlayerInfiniteShipHP=damagePlayer;
damagePlayer=function(d,x,y){
  if(!g.infiniteShipHP)return _damagePlayerInfiniteShipHP(d,x,y);
  g.player.hp=g.player.max;
  g.hurtT=.4;
  g.shake=Math.max(g.shake,5);
  g.texts.push({x:x??500,y:y??180,str:'0',t:.8,color:'#8ff0a4',size:28});
  return 0;
};
