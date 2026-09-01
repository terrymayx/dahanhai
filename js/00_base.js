'use strict';
/* ================= 基础 ================= */
const W=1920, H=1080;
const cv=document.getElementById('cv'), ctx=cv.getContext('2d');
let vs=1, vx=0, vy=0, DPR=1;
function resize(){
  DPR=Math.min(window.devicePixelRatio||1,2);
  cv.width=innerWidth*DPR; cv.height=innerHeight*DPR;
  cv.style.width=innerWidth+'px'; cv.style.height=innerHeight+'px';
  vs=Math.min(innerWidth/W, innerHeight/H);
  vx=(innerWidth-W*vs)/2; vy=(innerHeight-H*vs)/2;
}
addEventListener('resize',resize); resize();
const FAST=/fast/i.test(location.search);
const SPD=FAST?1.9:1;
const rand=(a,b)=>a+Math.random()*(b-a);
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const dist=(x1,y1,x2,y2)=>Math.hypot(x2-x1,y2-y1);
function rr(x,y,w,h,r){ ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
function circle(x,y,r){ ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); }
function txt(s,x,y,size,fill,stroke,lw,align){
  ctx.font='bold '+size+'px "Microsoft YaHei","PingFang SC",sans-serif';
  ctx.textAlign=align||'center'; ctx.textBaseline='alphabetic';
  if(stroke){ ctx.lineWidth=lw||4; ctx.strokeStyle=stroke; ctx.lineJoin='round'; ctx.strokeText(s,x,y); }
  ctx.fillStyle=fill; ctx.fillText(s,x,y); }

/* 路径（与场景图同一套形状数据） */
const P_HULL=new Path2D("M 430 238 C 505 260, 552 306, 566 366 C 588 424, 602 492, 602 560 C 602 662, 588 764, 556 828 C 546 856, 505 874, 430 874 C 355 874, 314 856, 304 828 C 272 764, 258 662, 258 560 C 258 492, 272 424, 294 366 C 308 306, 355 260, 430 238 Z");
const P_DECK=new Path2D("M 430 262 C 494 282, 534 318, 548 372 C 568 426, 582 494, 582 560 C 582 654, 570 748, 542 812 C 532 838, 496 852, 430 852 C 364 852, 328 838, 318 812 C 290 748, 278 654, 278 560 C 278 494, 292 426, 312 372 C 326 318, 366 282, 430 262 Z");
const E_HULL=new Path2D("M -235 0 C -220 -62, -172 -110, -105 -130 C -30 -152, 90 -152, 165 -130 C 202 -118, 226 -88, 228 -48 C 230 -18, 230 18, 228 48 C 226 88, 202 118, 165 130 C 90 152, -30 152, -105 130 C -172 110, -220 62, -235 0 Z");
const E_DECK=new Path2D("M -219 0 C -206 -54, -162 -98, -100 -116 C -30 -134, 84 -134, 151 -116 C 184 -106, 204 -80, 206 -46 C 208 -16, 208 16, 206 46 C 204 80, 184 106, 151 116 C 84 134, -30 134, -100 116 C -162 98, -206 54, -219 0 Z");
const SWIRL=new Path2D("M0,0 C10,-16 34,-16 42,2 C30,-6 14,-4 8,8");
const SPARK=new Path2D("M0,-10 L2.6,-2.6 L10,0 L2.6,2.6 L0,10 L-2.6,2.6 L-10,0 L-2.6,-2.6 Z");

/* ================= 音效（WebAudio 合成） ================= */
let AC=null;
function ac(){ try{ if(!AC) AC=new (window.AudioContext||window.webkitAudioContext)();
  if(AC.state==='suspended') AC.resume(); }catch(e){} return AC; }
function tone(f0,f1,dur,type,vol,delay){ const a=ac(); if(!a)return;
  const t=a.currentTime+(delay||0), o=a.createOscillator(), g=a.createGain();
  o.type=type||'square'; o.frequency.setValueAtTime(f0,t);
  o.frequency.exponentialRampToValueAtTime(Math.max(1,f1),t+dur);
  g.gain.setValueAtTime(vol||.1,t); g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  o.connect(g); g.connect(a.destination); o.start(t); o.stop(t+dur+.02); }
function noise(dur,vol,fc){ const a=ac(); if(!a)return;
  const n=Math.floor(a.sampleRate*dur), buf=a.createBuffer(1,n,a.sampleRate), d=buf.getChannelData(0);
  for(let i=0;i<n;i++) d[i]=(Math.random()*2-1)*(1-i/n);
  const s=a.createBufferSource(); s.buffer=buf;
  const f=a.createBiquadFilter(); f.type='lowpass'; f.frequency.value=fc||800;
  const g=a.createGain(); g.gain.value=vol||.2;
  s.connect(f); f.connect(g); g.connect(a.destination); s.start(); }
const sfx={
  fire(){ tone(150,40,.3,'square',.13); noise(.22,.16,900); },
  boom(){ noise(.5,.28,500); tone(90,28,.4,'sine',.18); },
  hit(){ tone(220,70,.12,'triangle',.1); },
  arrow(){ tone(900,1500,.07,'sine',.05); },
  alarm(){ tone(660,660,.12,'square',.09); tone(520,520,.14,'square',.09,.16); },
  coin(){ tone(880,1760,.12,'sine',.07); },
  cast(){ tone(480,940,.16,'sine',.1); },
  slash(){ noise(.08,.1,2400); },
  die(){ tone(300,60,.5,'sawtooth',.08); },
  win(){ tone(523,523,.15,'triangle',.12); tone(659,659,.15,'triangle',.12,.15); tone(784,784,.3,'triangle',.12,.3); },
  lose(){ tone(330,330,.3,'triangle',.12); tone(262,262,.3,'triangle',.12,.3); tone(196,196,.6,'triangle',.12,.6); }
};
