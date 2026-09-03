(function(root){
  'use strict';
  const R=root.V8Render;
  if(!R||typeof R.shipVisualPose!=='function')throw new Error('V9.7 flood pose requires base renderer');
  const originalPose=R.shipVisualPose;
  R.shipVisualPose=function(ship,state){
    const pose=originalPose(ship,state);
    if(!ship)return pose;
    const flood=Math.max(0,Math.min(1,ship.floodLevel||0));
    if(flood>0&&ship.state==='active'){
      pose.y+=(ship.__v97FloodSinkOffset||0);
      pose.rotation+=(ship.__v97FloodRoll||0);
    }
    return pose;
  };
  root.V97FloodPose={active:true};
})(typeof globalThis!=='undefined'?globalThis:this);