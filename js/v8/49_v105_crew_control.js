(function(root){
  'use strict';
  root.DHH=root.DHH||{};
  const V104Control=root.DHH.V104BoardingControl||null;

  function forceMovementOnly(state,input){
    if(!state||!(state.boarding&&state.boarding.active))return input||null;
    const current=input||state.__v104CaptainInput||{x:0,y:0};
    state.__v104CaptainInput={x:Number(current.x)||0,y:Number(current.y)||0,attack:false};
    return state.__v104CaptainInput;
  }
  function install(){
    if(!V104Control||V104Control.__v105MovementOnly)return false;
    const oldSample=V104Control.sample;
    V104Control.sample=function(state){const result=typeof oldSample==='function'?oldSample(state):null;return forceMovementOnly(state,result);};
    V104Control.__v105MovementOnly=true;return true;
  }
  const api={installed:install(),movementOnly:true,forceMovementOnly,__v104CaptainInput:true};
  root.V105CrewControl=api;root.DHH.V105CrewControl=api;
})(typeof globalThis!=='undefined'?globalThis:this);
