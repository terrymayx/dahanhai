(function(root){
  'use strict';

  const TYPES=['standard','solid','chain','explosive'];
  const PLAYER_TYPES=['solid','chain','explosive'];
  const LABELS={standard:'普通弹',solid:'实心弹',chain:'链弹',explosive:'爆裂弹'};

  function freezeProfile(profile){
    const cellDamage=Object.freeze(Object.assign({},profile.cellDamage||{}));
    return Object.freeze(Object.assign({},profile,{cellDamage}));
  }

  const PROFILES=Object.freeze({
    standard:freezeProfile({
      armorAttackScale:1,baseDamageScale:1,cellDamage:{},
      blastRadiusScale:1,splashDamageScale:1,fractureScale:1,fatigueScale:1,fireScale:1,chunkDamageScale:1
    }),
    solid:freezeProfile({
      armorAttackScale:1.30,baseDamageScale:1,
      cellDamage:{hull:1.20,beam:1.30,core:1.20,powder:1.15,mast:.75,rudder:.85,cannon:.90},
      blastRadiusScale:.35,splashDamageScale:.30,fractureScale:.72,fatigueScale:.78,fireScale:1,chunkDamageScale:1.15
    }),
    chain:freezeProfile({
      armorAttackScale:.65,baseDamageScale:.70,
      cellDamage:{hull:.55,deck:.70,beam:.45,core:.40,powder:.45,mast:2.40,rudder:1.60,cannon:1.35},
      blastRadiusScale:.25,splashDamageScale:.20,fractureScale:.45,fatigueScale:.55,fireScale:1,chunkDamageScale:.60
    }),
    explosive:freezeProfile({
      armorAttackScale:.75,baseDamageScale:.80,
      cellDamage:{hull:.85,deck:1.05,beam:.75,core:.70,powder:.90,mast:.90,rudder:.90,cannon:1},
      blastRadiusScale:1.50,splashDamageScale:1.15,fractureScale:1.60,fatigueScale:1.75,fireScale:1.85,chunkDamageScale:1.05
    })
  });

  function normalizeType(type){return TYPES.includes(type)?type:'standard';}
  function normalizePlayerType(type){return PLAYER_TYPES.includes(type)?type:'solid';}
  function profileFor(type){return PROFILES[normalizeType(type)];}
  function directDamageScale(type,cellType){
    const p=profileFor(type),specific=Object.prototype.hasOwnProperty.call(p.cellDamage,cellType)?p.cellDamage[cellType]:1;
    return p.baseDamageScale*specific;
  }
  function labelFor(type){return LABELS[normalizeType(type)]||LABELS.standard;}

  root.V102Ammo={TYPES,PLAYER_TYPES,LABELS,PROFILES,normalizeType,normalizePlayerType,profileFor,directDamageScale,labelFor};
})(typeof globalThis!=='undefined'?globalThis:this);
