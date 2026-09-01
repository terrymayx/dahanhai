/* V5.8 甲板近战测试模式：弓箭手不再远程打敌船，海盗上甲板后恢复射击 */

if(g.meleeTestMode==null)g.meleeTestMode=true;

const _newGameMeleeTestMode=newGame;
newGame=function(){
  const state=_newGameMeleeTestMode();
  state.meleeTestMode=true;
  return state;
};

const _updateMeleeTestMode=update;
update=function(dt){
  const archer=g.crew.find(c=>c.id==='archer');
  let restoreAlive=null;
  let restoreRange=null;

  if(g.meleeTestMode&&archer&&archer.alive){
    const aliveBoarders=g.boarders.filter(b=>b.hp>0);
    const deckBoarder=aliveBoarders.some(b=>b.state==='fight');

    if(!deckBoarder){
      if(aliveBoarders.length===0){
        // 没有登船目标时，临时视为不可行动，阻止原逻辑自动射远处敌船。
        restoreAlive=archer.alive;
        archer.alive=false;
      }else{
        // 只有跳板/荡索/翻舷中的海盗时先不射，等真正进入甲板 fight 状态。
        restoreRange=archer.rg;
        archer.rg=0;
      }
    }
  }

  _updateMeleeTestMode(dt);

  if(archer){
    if(restoreAlive!==null)archer.alive=restoreAlive;
    if(restoreRange!==null)archer.rg=restoreRange;
  }

  // 测试模式下清掉远程阶段遗留的箭，避免旧箭继续击沉接近中的敌船。
  if(g.meleeTestMode&&!g.boarders.some(b=>b.hp>0&&b.state==='fight'))g.arrows.length=0;
};
