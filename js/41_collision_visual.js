/* 接舷视觉必须等待真实船体接触 */
const _drawDockedGearContact=drawDockedGear;
drawDockedGear=function(e){
  if(!e||e.state!=='docked'||!e.contact||!shipsTouchPlayer(e))return;
  _drawDockedGearContact(e);
};
