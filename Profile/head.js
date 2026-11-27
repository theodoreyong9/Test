/* The head of Aiwa in the browser: the same scanned face as in the application (aiwa-head.bin, credited on the page), bent by its blend shapes,
   lit as skin, drawn with WebGL. A port of HeadMesh, HeadRig and HeadAnimator of the application; the mouth follows the words being spoken
   (the browser gives the position of each word, not the sound). */
(function(){
'use strict';
var S={JAW_OPEN:0,AA:1,OH:2,OU:3,EE:4,PP:5,BLINK_L:6,BLINK_R:7,SMILE_L:8,SMILE_R:9,BROWS_UP_C:10,BROWS_UP_L:11,BROWS_UP_R:12,BROWS_DOWN_L:13,BROWS_DOWN_R:14,EYES_LEFT:15,EYES_RIGHT:16,EYES_UP:17,EYES_DOWN:18,FUNNEL:19,
  FF:20,SS:21,CHEEK_SQUINT_L:22,CHEEK_SQUINT_R:23,EYE_SQUINT_L:24,EYE_SQUINT_R:25,MOUTH_LEFT:26,MOUTH_RIGHT:27,PUCKER:28,SNEER:29,FROWN_L:30,FROWN_R:31,JAW_LEFT:32,JAW_RIGHT:33};
var NSHAPES=34,NMARKS=13;
/* the scanned head is tilted by about 3 degrees (the line of its eyes rises to the right): this turns it level */
var LEVEL_ROLL=-0.025;

function parse(buf){
  var dv=new DataView(buf),o=0;
  var v=dv.getInt32(o,true);o+=4; var t=dv.getInt32(o,true);o+=4;
  function floats(n){ var a=new Float32Array(n); for(var i=0;i<n;i++){ a[i]=dv.getFloat32(o,true); o+=4; } return a; }
  var marks=floats(NMARKS*3),pos=floats(v*3),nor=floats(v*3);
  var idx=new Uint16Array(t*3); for(var i=0;i<t*3;i++){ idx[i]=dv.getUint16(o,true); o+=2; }
  var col=new Float32Array(v*3); for(var i=0;i<v*3;i++){ col[i]=dv.getUint8(o++)/255; }
  var n=dv.getInt32(o,true);o+=4;
  var si=[],sd=[];
  for(var k=0;k<n;k++){ var c=dv.getInt32(o,true);o+=4; var ids=new Uint16Array(c); for(var j=0;j<c;j++){ ids[j]=dv.getUint16(o,true); o+=2; } si.push(ids); sd.push(floats(c*3)); }
  return {v:v,t:t,pos:pos,nor:nor,idx:idx,col:col,si:si,sd:sd};
}

/* the rig: bends, turns, lights and sorts */
function Rig(m){
  this.m=m; var v=m.v;
  this.xy=new Float32Array(v*2); this.rgba=new Float32Array(v*4); this.sorted=new Uint16Array(m.idx.length);
  this.pos=new Float32Array(v*3); this.depth=new Float32Array(v); this.keys=new Float64Array(m.t);
  var ids=m.si[S.EYES_RIGHT]||[]; this.eyeL=[]; this.eyeR=[];
  for(var i=0;i<ids.length;i++){ (m.pos[ids[i]*3]<0?this.eyeL:this.eyeR).push(ids[i]); }
}
function ss(a,b,x){ var t=Math.min(1,Math.max(0,(x-a)/(b-a))); return t*t*(3-2*t); }
Rig.prototype.update=function(pose,cx,cy,size){
  var m=this.m,scale=size*0.36,pos=this.pos,n=m.nor,xy=this.xy,rgba=this.rgba,depth=this.depth;
  var roll=pose.roll+LEVEL_ROLL,cyaw=Math.cos(pose.yaw),syaw=Math.sin(pose.yaw),cpit=Math.cos(pose.pitch),spit=Math.sin(pose.pitch),crol=Math.cos(roll),srol=Math.sin(roll);
  pos.set(m.pos);
  for(var k=0;k<NSHAPES;k++){
    var w=pose.w[k]; if(w<0.004||k>=m.si.length) continue;
    var ids=m.si[k],d=m.sd[k];
    for(var j=0;j<ids.length;j++){ var q=ids[j]*3; pos[q]+=d[j*3]*w; pos[q+1]+=d[j*3+1]*w; pos[q+2]+=d[j*3+2]*w; }
  }
  for(var i=0;i<this.eyeL.length;i++){ pos[this.eyeL[i]*3]+=-0.001; }
  for(var i=0;i<this.eyeR.length;i++){ pos[this.eyeR[i]*3]+=0.013; }
  var hx=-0.45*0.5,hy=0.62*0.5,hz=(0.64+1)*0.5,hl=Math.sqrt(hx*hx+hy*hy+hz*hz),lit=0.88+0.12*pose.awake,c=m.col;
  for(var i=0;i<m.v;i++){
    var px=pos[i*3],py=pos[i*3+1],pz=pos[i*3+2];
    var x1=px*cyaw+pz*syaw,z1=-px*syaw+pz*cyaw,y2=py*cpit-z1*spit,z2=py*spit+z1*cpit,x3=x1*crol-y2*srol,y3=x1*srol+y2*crol;
    var persp=1/(1-z2*0.10);
    xy[i*2]=cx+x3*scale*persp; xy[i*2+1]=cy-(y3+0.05)*scale*persp; depth[i]=z2;
    var nx=n[i*3],ny=n[i*3+1],nz=n[i*3+2];
    var a1=nx*cyaw+nz*syaw,b1=-nx*syaw+nz*cyaw,a2=ny*cpit-b1*spit,b2=ny*spit+b1*cpit;
    var rx=a1*crol-a2*srol,ry=a1*srol+a2*crol,rz=b2;
    var key=Math.max(0,rx*-0.45+ry*0.62+rz*0.64),fill=Math.max(0,rx*0.70+ry*-0.15+rz*0.35);
    var f=1-Math.min(1,Math.max(0,rz)),fres=f*f*f;
    var spec=Math.pow(Math.max(0,(rx*hx+ry*hy+rz*hz)/hl),24);
    var shade=0.36+key*0.62+fill*0.20;
    var r=c[i*3]*shade+spec*0.22+fres*0.06,g=c[i*3+1]*shade+spec*0.20+fres*0.06,b=c[i*3+2]*shade+spec*0.18+fres*0.08;
    var rim=Math.max(Math.abs(px)/0.95,(py-0.2)/0.55);
    var edge=1-ss(0.55,1,rim)*(1-ss(-0.05,0.45,rz));
    var low=1-ss(-1.0,-1.55,py);
    var a=Math.min(1,Math.max(0,edge*(0.25+0.75*low)));
    rgba[i*4]=Math.min(1,Math.max(0,r*lit)); rgba[i*4+1]=Math.min(1,Math.max(0,g*lit)); rgba[i*4+2]=Math.min(1,Math.max(0,b*lit)); rgba[i*4+3]=a;
  }
  var idx=m.idx,keys=this.keys;
  for(var t=0;t<m.t;t++){ var z=depth[idx[t*3]]+depth[idx[t*3+1]]+depth[idx[t*3+2]]; keys[t]=Math.floor((z+6)*100000)*1048576+t; }
  keys.sort();
  var sorted=this.sorted;
  for(var k=0;k<m.t;k++){ var t=keys[k]%1048576; sorted[k*3]=idx[t*3]; sorted[k*3+1]=idx[t*3+1]; sorted[k*3+2]=idx[t*3+2]; }
};

/* the animator: eyes that look, blinks, a head that is never still, some gestures, a mouth that follows the voice */
function Animator(){
  this.t=0; this.jaw=0;this.round=0;this.spread=0;this.hissS=0;this.press=0;this.slow=0;this.nodAt=-9;this.lastNod=-9;this.prevEnv=0;this.syllable=1;this.skew=0;
  this.gx=0;this.gy=0;this.tx=0;this.ty=0;this.nextGaze=1.2;this.hx=0;this.hy=0;
  this.blinkAt=2.5;this.blinkLeft=0;this.again=false;this.blink=0;
  this.gesture=null;this.gStart=0;this.gAmp=1;this.gSide=1;this.nextGesture=2.5;
  this.yaw=0;this.pitch=0;this.roll=0; this.fx=null;
}
function follow(c,t,r,dt){ return c+(t-c)*(1-Math.exp(-dt*r)); }
function sm(x){ var v=Math.min(1,Math.max(0,x)); return v*v*(3-2*v); }
function hold(u){ return sm(u/.25)*(1-sm((u-.75)/.25)); }
function s2(u,n){ return Math.sin(2*Math.PI*n*u); }
function fxNew(){ return {yaw:0,pitch:0,roll:0,gx:0,gy:0,bl:0,br:0,w:new Float32Array(NSHAPES)}; }
var GESTURES=[
  {d:1.9,sp:true,wt:1.0,f:function(u,h,a,side,o){ o.roll+=side*.07*h*a; o.yaw+=side*.03*h*a; o.pitch+=.015*h*a; o.w[side<0?S.BROWS_UP_L:S.BROWS_UP_R]+=.5*h*a; }},
  {d:1.0,sp:true,wt:1.0,f:function(u,h,a,side,o){ o.pitch+=.045*a*h*(.5-.5*Math.cos(4*Math.PI*u)); o.w[S.BROWS_UP_C]+=.12*h*a; }},
  {d:1.3,sp:true,wt:.6,f:function(u,h,a,side,o){ o.yaw+=side*.06*a*h*s2(u,2); o.w[S.FROWN_L]+=.3*h*a; o.w[S.FROWN_R]+=.3*h*a; o.w[S.BROWS_UP_L]+=.15*h*a; }},
  {d:1.7,sp:false,wt:1.0,f:function(u,h,a,side,o){ var l=side<0; o.w[l?S.SMILE_L:S.SMILE_R]+=.55*h*a; o.w[l?S.CHEEK_SQUINT_L:S.CHEEK_SQUINT_R]+=.35*h*a; o.w[l?S.EYE_SQUINT_L:S.EYE_SQUINT_R]+=.3*h*a; o.w[l?S.BROWS_UP_R:S.BROWS_UP_L]+=.35*h*a; o.w[l?S.MOUTH_LEFT:S.MOUTH_RIGHT]+=.25*h*a; o.roll+=side*.025*h*a; }},
  {d:1.7,sp:true,wt:1.1,f:function(u,h,a,side,o){ o.gx+=side*.75*h*a; o.gy+=.1*h*a; o.yaw+=side*.035*h*a; }},
  {d:1.0,sp:false,wt:.5,f:function(u,h,a,side,o){ o.w[S.BROWS_UP_C]+=.65*h*a; o.w[S.BROWS_UP_L]+=.3*h*a; o.w[S.BROWS_UP_R]+=.3*h*a; o.w[S.JAW_OPEN]+=.14*h*a; o.pitch+=-.02*h*a; }},
  {d:2.8,sp:false,wt:.7,f:function(u,h,a,side,o){ var sw=side*.8*a*h*s2(u,1); o.gx+=sw; o.yaw+=sw*.05; o.gy+=.05*h; }},
  {d:2.0,sp:false,wt:.9,f:function(u,h,a,side,o){ o.gx+=-Math.max(-1,Math.min(1,side))*.45*h*a; o.gy+=.5*h*a; o.w[S.EYE_SQUINT_L]+=.4*h*a; o.w[S.EYE_SQUINT_R]+=.4*h*a; o.w[S.BROWS_DOWN_L]+=.25*h*a; o.w[S.BROWS_DOWN_R]+=.25*h*a; o.w[S.PUCKER]+=.25*h*a; o.roll+=side*.02*h*a; }},
  {d:.9,sp:true,wt:.35,f:function(u,h,a,side,o){ var b=Math.pow(Math.sin(u*Math.PI),.7); if(side<0) o.bl=Math.max(o.bl,b); else o.br=Math.max(o.br,b); o.w[side<0?S.SMILE_L:S.SMILE_R]+=.35*h*a; o.w[S.CHEEK_SQUINT_L]+=.15*h*a; }}
];
Animator.prototype.noise=function(a,b,c,ph){ var t=this.t; return (Math.sin(t*a+ph)+Math.sin(t*b+ph*1.7+1.3)+Math.sin(t*c+ph*2.3+2.1))/3; };
/* i: open (the mouth), wide (<1 round, >1 spread), hiss, awake, speaks, thinks */
Animator.prototype.step=function(dt0,i){
  var dt=Math.min(.1,Math.max(.001,dt0)); this.t+=dt; var t=this.t,speaking=i.speaks>.3,env=Math.min(1,Math.max(0,i.open));
  if(env>.25&&this.prevEnv<=.25){ this.syllable=.85+Math.random()*.35; this.skew=(Math.random()-.5)*.5; }
  this.jaw=follow(this.jaw,env,env>this.jaw?38:16,dt);
  this.round=follow(this.round,Math.min(1,Math.max(0,(1-i.wide)/.42)),14,dt);
  this.spread=follow(this.spread,Math.min(1,Math.max(0,(i.wide-1)/.28)),14,dt);
  this.hissS=follow(this.hissS,env>.08?Math.min(1,Math.max(0,i.hiss)):0,25,dt);
  this.slow=follow(this.slow,env,1.6,dt);
  this.press=follow(this.press,(speaking&&this.slow>.22&&env<.13&&env<=this.prevEnv+.02)?1:0,30,dt);
  if(speaking&&env-this.slow>.22&&t-this.lastNod>.8){ this.nodAt=t; this.lastNod=t; }
  this.prevEnv=env;
  if(t>this.nextGaze){
    if(i.thinks>.4){ this.tx=-.55+Math.random()*.2; this.ty=.45+Math.random()*.2; this.nextGaze=t+.9+Math.random(); }
    else if(Math.random()<(speaking?.85:.62)){ this.tx=0; this.ty=0; this.nextGaze=t+2+Math.random()*2.5; }
    else { this.tx=(Math.random()-.5)*(speaking?.45:.8); this.ty=(Math.random()-.5)*.4; this.nextGaze=t+.7+Math.random()*.9; }
    if(Math.hypot(this.tx-this.gx,this.ty-this.gy)>.35&&this.blinkLeft<=0) this.blinkAt=Math.min(this.blinkAt,t+.05);
  }
  this.gx=follow(this.gx,this.tx,22,dt); this.gy=follow(this.gy,this.ty,22,dt);
  this.hx=follow(this.hx,this.gx*.35,2.2,dt); this.hy=follow(this.hy,this.gy*.35,2.2,dt);
  if(!this.gesture&&t>this.nextGesture&&i.awake>.3){
    var pool=GESTURES.filter(function(g){ return !speaking||g.sp; }),tot=0; pool.forEach(function(g){ tot+=g.wt; });
    var r=Math.random()*tot,pick=pool[pool.length-1]; for(var k=0;k<pool.length;k++){ r-=pool[k].wt; if(r<=0){ pick=pool[k]; break; } }
    this.gesture=pick; this.gStart=t; this.gAmp=(.75+Math.random()*.25)*(speaking?.6:1); this.gSide=Math.random()<.5?1:-1;
  }
  var fx=this.fx=fxNew();
  if(this.gesture){ var u=(t-this.gStart)/this.gesture.d; if(u>=1){ this.gesture=null; this.nextGesture=t+(speaking?2.5:2.2)+Math.random()*(speaking?3:4.5); } else this.gesture.f(u,hold(u),this.gAmp,this.gSide,fx); }
  var nt=Math.min(1,Math.max(0,(t-this.nodAt)/.45)),nod=(t-this.nodAt<.45)?Math.sin(nt*Math.PI)*.035:0;
  this.yaw=this.hx*.09+this.noise(.37,.61,.93,0)*.018+fx.yaw;
  this.pitch=this.hy*.06+Math.sin(t*1.25)*.006*(.5+.5*i.awake)-nod+(1-i.awake)*.02+this.noise(.29,.47,.83,2)*.010+fx.pitch;
  this.roll=this.noise(.23,.41,.71,4)*.016+fx.roll;
  if(this.blinkLeft>0) this.blinkLeft-=dt;
  else if(t>this.blinkAt){ this.blinkLeft=.20; if(!this.again&&Math.random()<.15){ this.again=true; this.blinkAt=t+.30; } else { this.again=false; this.blinkAt=t+3+Math.random()*2.2; } }
  var bp=this.blinkLeft>0?1-this.blinkLeft/.20:1;
  this.blink=this.blinkLeft>0?Math.pow(Math.min(1,Math.max(0,bp<.35?bp/.35:(1-bp)/.65)),1.2):0;
  this.blink=Math.max(this.blink,(1-i.awake)*.3);
};
Animator.prototype.applyTo=function(pose,i){
  pose.yaw=this.yaw; pose.pitch=this.pitch; pose.roll=this.roll; pose.awake=i.awake;
  var out=new Float32Array(NSHAPES),fx=this.fx,env=this.jaw,self=this;
  function add(s,v){ out[s]+=v; }
  var vowel=(1-this.round)*(1-this.spread)*(1-this.hissS);
  add(S.JAW_OPEN,Math.pow(env,.9)*.30*this.syllable*(1-.45*this.hissS)*(1-.7*this.press));
  add(S.AA,env*vowel*.35); add(S.OU,env*this.round*.6); add(S.OH,env*this.round*.4); add(S.FUNNEL,env*this.round*.3);
  add(S.EE,env*this.spread*(1-this.hissS)*.6); add(S.SS,env*this.hissS*.6); add(S.FF,env*this.hissS*.3); add(S.PP,this.press*.8);
  add(S.MOUTH_LEFT,Math.max(0,this.skew)*env*.4); add(S.MOUTH_RIGHT,Math.max(0,-this.skew)*env*.4);
  add(S.JAW_LEFT,Math.max(0,this.skew)*env*.25); add(S.JAW_RIGHT,Math.max(0,-this.skew)*env*.25);
  var sm_=Math.min(.4,Math.max(0,i.smile*.5)); add(S.SMILE_L,sm_); add(S.SMILE_R,sm_);
  add(S.BLINK_L,Math.max(this.blink,fx.bl)); add(S.BLINK_R,Math.max(this.blink,fx.br));
  var emph=(this.t-this.nodAt<.6)?Math.sin(Math.min(1,Math.max(0,(this.t-this.nodAt)/.6))*Math.PI)*.35:0;
  add(S.BROWS_UP_C,i.brow*.5+i.thinks*.35+emph); add(S.BROWS_UP_L,i.thinks*.2);
  var ex=Math.max(-1,Math.min(1,this.gx+fx.gx)),ey=Math.max(-1,Math.min(1,this.gy+fx.gy));
  var dx=-.0177+ex*.040,dy=-.0275+ey*.040;
  add(S.EYES_LEFT,Math.max(0,dx)/.0375); add(S.EYES_RIGHT,Math.max(0,-dx)/.040); add(S.EYES_UP,Math.max(0,dy)/.044); add(S.EYES_DOWN,Math.max(0,-dy)/.0505);
  for(var k=0;k<NSHAPES;k++){ out[k]+=fx.w[k]; pose.w[k]=Math.min(1,Math.max(0,out[k])); }
};

/* the mouth of what is being said: the browser tells where each word is, the letters of the word give the shape of the mouth */
function visemeOf(ch){
  ch=ch.toLowerCase();
  if('aàâä'.indexOf(ch)>=0) return {o:.78,w:1,h:0};
  if('eéèêë'.indexOf(ch)>=0) return {o:.45,w:1.15,h:0};
  if('iîïy'.indexOf(ch)>=0) return {o:.28,w:1.3,h:0};
  if('oôö'.indexOf(ch)>=0) return {o:.55,w:.7,h:0};
  if('uùûü'.indexOf(ch)>=0) return {o:.3,w:.6,h:0};
  if('pbm'.indexOf(ch)>=0) return {o:0,w:1,h:0};
  if('fv'.indexOf(ch)>=0) return {o:.12,w:1,h:.5};
  if('szxcç'.indexOf(ch)>=0) return {o:.16,w:1.1,h:.8};
  if('jg'.indexOf(ch)>=0) return {o:.2,w:.85,h:.5};
  return {o:.22,w:1,h:0};
}
function Mouth(){ this.word=null; this.start=0; this.per=60; this.speaking=false; this.fallback=false; this.lastBoundary=0; this.began=0; }
Mouth.prototype.begin=function(){ this.speaking=true; this.began=performance.now(); this.lastBoundary=0; this.word=null; this.fallback=false; };
Mouth.prototype.end=function(){ this.speaking=false; this.word=null; };
Mouth.prototype.boundary=function(text,ci,len){
  var m=/^[\p{L}\p{N}']+/u.exec(text.slice(ci)); var w=m?m[0]:text.slice(ci,ci+(len||4)); if(!w) return;
  this.word=w; this.start=performance.now(); this.per=Math.max(45,Math.min(110,260/ Math.max(1,w.length)*1.6)); this.lastBoundary=this.start;
};
Mouth.prototype.sample=function(now){
  if(!this.speaking) return {open:0,wide:1,hiss:0};
  if(!this.lastBoundary&&now-this.began>700) this.fallback=true;   /* a voice that gives no word positions: a rhythm of syllables */
  if(this.fallback){ var p=Math.sin(now/1000*2*Math.PI*3.4); return {open:.28+.3*Math.max(0,p),wide:1+.12*Math.sin(now/230),hiss:0}; }
  if(!this.word) return {open:.05,wide:1,hiss:0};
  var k=Math.floor((now-this.start)/this.per);
  if(k>=this.word.length) return {open:.04,wide:1,hiss:0};
  var v=visemeOf(this.word.charAt(k)); return {open:v.o,wide:v.w,hiss:v.h};
};

/* the drawing */
var VS='attribute vec2 p;attribute vec4 c;uniform vec2 res;varying vec4 v;void main(){v=c;vec2 z=(p/res)*2.0-1.0;gl_Position=vec4(z.x,-z.y,0.0,1.0);}';
var FS='precision mediump float;varying vec4 v;void main(){gl_FragColor=v;}';
function start(canvas,opts){
  opts=opts||{};
  var gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:true});
  if(!gl) return Promise.reject(new Error('no webgl'));
  return fetch(opts.url||'aiwa-head.bin').then(function(r){ if(!r.ok) throw new Error('head'); return r.arrayBuffer(); }).then(function(buf){
    var mesh=parse(buf),rig=new Rig(mesh),anim=new Animator(),mouth=new Mouth();
    function sh(t,src){ var s=gl.createShader(t); gl.shaderSource(s,src); gl.compileShader(s); if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw new Error('shader'); return s; }
    var pr=gl.createProgram(); gl.attachShader(pr,sh(gl.VERTEX_SHADER,VS)); gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,FS)); gl.linkProgram(pr); gl.useProgram(pr);
    var bp=gl.createBuffer(),bc=gl.createBuffer(),bi=gl.createBuffer(),lp=gl.getAttribLocation(pr,'p'),lc=gl.getAttribLocation(pr,'c'),lr=gl.getUniformLocation(pr,'res');
    gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
    var st={awake:1,speaks:0,thinks:0,smile:.15,brow:0,px:0,py:0,mx:0,my:0},pose={yaw:0,pitch:0,roll:0,awake:1,w:new Float32Array(NSHAPES)},last=0,alive=true,sp=0,mm={open:0,wide:1,hiss:0};
    var frameCap=1000/36;
    function resize(){ var d=Math.min(2,window.devicePixelRatio||1),w=Math.round(canvas.clientWidth*d),h=Math.round(canvas.clientHeight*d); if(canvas.width!==w||canvas.height!==h){ canvas.width=w; canvas.height=h; } gl.viewport(0,0,canvas.width,canvas.height); }
    function frame(now){
      if(!alive) return; requestAnimationFrame(frame);
      if(now-last<frameCap) return; var dt=last?(now-last)/1000:1/36; last=now;
      resize();
      var m=mouth.sample(now); mm.open=follow(mm.open,m.open,mouth.speaking?30:14,dt); mm.wide=follow(mm.wide,m.wide,18,dt); mm.hiss=follow(mm.hiss,m.hiss,22,dt);
      sp=follow(sp,mouth.speaking?1:0,8,dt);
      anim.step(dt,{open:mm.open,wide:mm.wide,hiss:mm.hiss,awake:st.awake,speaks:sp,thinks:st.thinks});
      anim.applyTo(pose,{smile:st.smile,brow:st.brow,thinks:st.thinks,awake:st.awake});
      pose.yaw+=st.px*.35+st.mx*.35; pose.pitch+=st.py*.2+st.my*.25;       /* the head turns a little toward the pointer, and against the turn of the phone */
      var s=Math.min(canvas.width,canvas.height);
      rig.update(pose,canvas.width/2,canvas.height/2+s*.03,s);
      gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(lr,canvas.width,canvas.height);
      gl.bindBuffer(gl.ARRAY_BUFFER,bp); gl.bufferData(gl.ARRAY_BUFFER,rig.xy,gl.DYNAMIC_DRAW); gl.enableVertexAttribArray(lp); gl.vertexAttribPointer(lp,2,gl.FLOAT,false,0,0);
      gl.bindBuffer(gl.ARRAY_BUFFER,bc); gl.bufferData(gl.ARRAY_BUFFER,rig.rgba,gl.DYNAMIC_DRAW); gl.enableVertexAttribArray(lc); gl.vertexAttribPointer(lc,4,gl.FLOAT,false,0,0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,bi); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,rig.sorted,gl.DYNAMIC_DRAW);
      gl.drawElements(gl.TRIANGLES,rig.sorted.length,gl.UNSIGNED_SHORT,0);
    }
    requestAnimationFrame(frame);
    /* the phone's own turn, where the browser gives it: the change from how it is usually held (a baseline that follows slowly), full at about 12 degrees */
    var base=null;
    window.addEventListener('deviceorientation',function(e){
      if(e.beta==null||e.gamma==null) return;
      if(!base) base={b:e.beta,g:e.gamma};
      base.b+=(e.beta-base.b)*0.004; base.g+=(e.gamma-base.g)*0.004;
      st.mx=Math.max(-1,Math.min(1,-(e.gamma-base.g)/12)); st.my=Math.max(-1,Math.min(1,(e.beta-base.b)/12));
    },{passive:true});
    window.addEventListener('pointermove',function(e){ st.px=(e.clientX/innerWidth-.5)*2; st.py=(e.clientY/innerHeight-.5)*2; },{passive:true});
    return {
      state:function(o){ for(var k in o) st[k]=o[k]; },
      speaking:function(on){ if(on) mouth.begin(); else mouth.end(); },
      boundary:function(text,ci,len){ mouth.boundary(text,ci,len); },
      stop:function(){ alive=false; }
    };
  });
}
window.AiwaHead={start:start,_parse:parse,_Rig:Rig,_Animator:Animator};
})();
