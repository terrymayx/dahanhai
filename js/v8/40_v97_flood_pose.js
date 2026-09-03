(function(root){
  'use strict';
  const R=root.V8Render;
  if(!R||typeof R.shipVisualPose!=='function')throw new Error('V9.7 flood pose requires base renderer');
  const originalPose=R.shipVisualPose;
  R.shipVisualPose=function(ship,state){
    const pose=originalPose(ship,state);
    if(!ship)return pose;
    const flood=Math.max(0,Math.min(1,ship.floodLevel||0));
    const v99=!!root.V99Buoyancy;
    if((flood>0||v99)&&ship.state==='active'){
      pose.y+=(ship.__v97FloodSinkOffset||0);
      pose.rotation+=(ship.__v97FloodRoll||0);
      if(v99&&Number.isFinite(ship.__v99Trim)){
        const trim=ship.__v99Trim;
        if(ship.kind==='player')pose.y+=trim*18;
        else pose.x+=trim*18;
      }
    }
    return pose;
  };
  root.V97FloodPose={active:true,version:'9.9-compatible'};
})(typeof globalThis!=='undefined'?globalThis:this);
