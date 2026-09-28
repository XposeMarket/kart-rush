import * as THREE from './vendor/three.module.js';

// Kart Rush: a real WebGL/Three.js racer. Everything in the world is generated locally.
const $ = id => document.getElementById(id);
const canvas = $('race');
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const icons = {rusty:'🦊',luna:'🐱',bolt:'🤖',pip:'🐸',zed:'🧙',coco:'🐼',blaze:'🐲',ivy:'🧝'};
const rideIcons = {kart:'🏎️',bike:'🏍️',truck:'🛻',pod:'🛸'};
const mapIcons = {meadows:'☀',frost:'❄',ember:'🌋',neon:'🌙'};
const ui = {char:0,vehicle:0,map:0};
const input = {left:false,right:false,gas:false,brake:false,drift:false};
const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || matchMedia('(pointer:coarse)').matches;
let world, track, map=MAPS[0], player, bots=[], boxes=[], pads=[], hazards=[], projectiles=[];
let mode='menu', countdown=0, countdownLast=4, elapsed=0, toastTime=0, lastTime=performance.now(), phase=0, best=null;
let renderer, scene, camera, roadCurve, trackLength=0, ground, ambient;
const TRACK_WIDTH=13, LAPS=3, MAX_DT=0.05, UP=new THREE.Vector3(0,1,0);
const mats = new Map();
const material = (color, roughness=0.72, emissive=0) => {
  const key=`${color}:${roughness}:${emissive}`;
  if(!mats.has(key)) mats.set(key,new THREE.MeshStandardMaterial({color,roughness,metalness:roughness<.4?.32:0,emissive,emissiveIntensity:emissive?.22:0}));
  return mats.get(key);
};
const mesh = (g,m,parent,at=[0,0,0]) => {const o=new THREE.Mesh(g,m);o.position.set(...at);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o};
const box = (parent,w,h,d,color,at) => mesh(new THREE.BoxGeometry(w,h,d),material(color),parent,at);
const sphere = (parent,r,color,at) => mesh(new THREE.SphereGeometry(r,12,8),material(color),parent,at);
const cylinder = (parent,rt,rb,h,color,at,segments=9) => mesh(new THREE.CylinderGeometry(rt,rb,h,segments),material(color),parent,at);
const rand = (n) => {const x=Math.sin(n*127.1+ui.map*311.7)*43758.5453;return x-Math.floor(x)};
const mod = (n,m) => ((n%m)+m)%m;
function fmt(t){const m=Math.floor(t/60),s=Math.floor(t%60),cs=Math.floor(t*100)%100;return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(cs).padStart(2,'0')}`}
function ordinal(n){return n===1?'1ST':n===2?'2ND':n===3?'3RD':`${n}TH`}
function saved(){try{return JSON.parse(localStorage.getItem('kart-rush-best')||'{}')}catch{return {}}}
function saveTime(t){try{const data=saved(),key=map.id+'-'+LAPS;if(!data[key]||t<data[key])data[key]=t;localStorage.setItem('kart-rush-best',JSON.stringify(data))}catch{}}
function toast(text,time=1.5){$('toast').textContent=text;toastTime=time}
function renderChoices(){
 $('characters').innerHTML=CHARS.map((c,i)=>`<button class="choice ${i===ui.char?'active':''}" data-set="char" data-index="${i}" aria-label="${c.name}, ${c.kind}" aria-pressed="${i===ui.char}"><span class="icon">${icons[c.id]}</span><span class="name">${c.name}</span></button>`).join('');
 $('vehicles').innerHTML=VEHICLES.map((v,i)=>`<button class="choice ${i===ui.vehicle?'active':''}" data-set="vehicle" data-index="${i}" aria-label="${v.name}" aria-pressed="${i===ui.vehicle}"><span class="icon">${rideIcons[v.id]}</span><span class="name">${v.name}</span></button>`).join('');
 $('maps').innerHTML=MAPS.map((m,i)=>`<button class="choice ${i===ui.map?'active':''}" data-set="map" data-index="${i}" aria-label="${m.name}, ${m.diff}" aria-pressed="${i===ui.map}"><span class="map-swatch" style="--sky:${m.sky[0]};--hill:${m.hills[0]};--road:${m.road[0]}"></span><span class="name">${mapIcons[m.id]} ${m.name}</span><span class="detail">${m.diff}</span></button>`).join('');
 const c=CHARS[ui.char],v=VEHICLES[ui.vehicle],m=MAPS[ui.map];
 $('character-info').textContent=`${c.kind} · ${c.bio}`;$('vehicle-info').textContent=v.desc;$('map-info').textContent=m.desc;
 $('stats').innerHTML=`<span>SPEED <b>${'▰'.repeat(Math.round((c.spd+v.spd)/2))}</b></span><span>ACCEL <b>${'▰'.repeat(Math.round((c.acc+v.acc)/2))}</b></span><span>GRIP <b>${'▰'.repeat(Math.round((c.han+v.han)/2))}</b></span>`;
 best=saved()[m.id+'-'+LAPS];$('start').innerHTML=best?`START 3D RACE <span>BEST ${fmt(best)} ↗</span>`:'START 3D RACE <span>↗</span>';
}
function disposeWorld(){
 if(!world)return;
 scene.remove(world);
 world.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material&&!matsHas(o.material)){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose()}});
 world=null;
}
function matsHas(m){return [...mats.values()].includes(m)}
function point(s,lane=0){const t=mod(s,trackLength)/trackLength,p=roadCurve.getPointAt(t),v=roadCurve.getTangentAt(t).normalize(),side=new THREE.Vector3(v.z,0,-v.x).normalize();return p.addScaledVector(side,lane)}
function direction(s){return roadCurve.getTangentAt(mod(s,trackLength)/trackLength).normalize()}
function positionObject(o,s,lane,lift=0){const p=point(s,lane),v=direction(s);o.position.copy(p);o.position.y+=lift;o.rotation.y=Math.atan2(v.x,v.z)}
function resize(){if(!renderer)return;const w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.75));camera.aspect=w/h;camera.fov=w<h?76:67;camera.updateProjectionMatrix()}
function initRenderer(){if(renderer)return true;
 try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.34;scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(67,innerWidth/innerHeight,.1,1500);resize();addEventListener('resize',resize);return true}
 catch(error){console.error('WebGL unavailable',error);$('menu').classList.remove('hidden');$('start').disabled=true;$('start').textContent='3D NEEDS WEBGL';$('map-info').textContent='Enable hardware acceleration / WebGL in your browser to play.';return false}
}
renderChoices();
$('menu').addEventListener('click',event=>{const button=event.target.closest('[data-set]');if(!button)return;ui[button.dataset.set]=Number(button.dataset.index);map=MAPS[ui.map];Sound.init();Sound.sfx.click();renderChoices()});

function buildCurve(){
 const points=[],N=24;
 for(let i=0;i<N;i++){
  const a=i/N*Math.PI*2;
  let r=map.id==='neon'?104+15*Math.sin(4*a)+8*Math.cos(7*a):map.id==='frost'?109+22*Math.cos(3*a)-10*Math.sin(5*a):map.id==='ember'?111+19*Math.sin(3*a)+12*Math.cos(5*a):108+14*Math.sin(3*a)+9*Math.cos(5*a);
  const y=(map.id==='ember'?3.2:map.id==='frost'?1.9:map.id==='neon'?.35:1.1)*(Math.sin(a*2)+.35*Math.cos(a*3));
  points.push(new THREE.Vector3(Math.sin(a)*r,y,Math.cos(a)*r));
 }
 roadCurve=new THREE.CatmullRomCurve3(points,true,'centripetal',.25);
 roadCurve.arcLengthDivisions=1800;trackLength=roadCurve.getLength();
}
function ribbon(width,offset,height,mat,steps=480){
 const pos=[],uv=[],idx=[];
 for(let i=0;i<=steps;i++){
  const s=i/steps*trackLength;
  for(const side of [-1,1]){const p=point(s,offset+side*width/2);pos.push(p.x,p.y+height,p.z);uv.push(i/steps*32,(side+1)/2)}
  if(i<steps){const j=i*2;idx.push(j,j+2,j+1,j+1,j+2,j+3)}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();
 const road=mesh(g,mat,world);road.castShadow=false;road.receiveShadow=true;return road;
}
function tree(root,i,position,scale=1){
 const g=new THREE.Group();g.position.copy(position);g.scale.setScalar(scale);root.add(g);
 if(map.theme==='snow'){
  cylinder(g,.19,.32,2.6,'#675246',[0,1.25,0],7);
  for(let k=0;k<3;k++)mesh(new THREE.ConeGeometry(2.3-k*.5,3.2-k*.35,7),material(k%2?'#2a8275':'#236e70'),g,[0,2.6+k*.75,0]);
  sphere(g,.32,'#f7ffff',[0,5.75,0]);
 }else if(map.theme==='lava'){
  cylinder(g,0.55,1.55,2.8,'#5f4138',[0,1.1,0],5);
  mesh(new THREE.DodecahedronGeometry(1.45,0),material(i%3?'#7e5044':'#fb7040'),g,[0,3.05,0]);
 }else if(map.theme==='night'){
  const h=5+rand(i+6)*17;
  box(g,3+rand(i)*2,h,3+rand(i+4)*2,i%3?'#193652':'#284266',[0,h/2,0]);
  for(let j=0;j<4;j++)for(let k=0;k<3;k++)if(rand(i*51+j*17+k)>.24){
   box(g,.36,.46,.03,(j+k)%3?'#ffd587':'#f87cd1',[-.95+k*.92,1.8+j*h/5,2.63]);
  }
  box(g,3.4,.16,3.4,i%2?'#ec3991':'#5cdeef',[0,h,0]);
 }else{
  cylinder(g,.23,.38,3.1,'#98614a',[0,1.6,0],7);
  for(let j=0;j<3;j++)sphere(g,1.45-j*.15,i%3?'#26985d':'#4abb6b',[(j-1)*.7,3.25+(j%2)*.8,0]);
 }
}
function decorate(){
 for(let i=0;i<155;i++){
  const s=(i+.3*rand(i+1))/155*trackLength,lane=(i%2?-1:1)*(TRACK_WIDTH/2+11+rand(i+50)*48);
  const p=point(s,lane);p.y=Math.max(p.y,map.theme==='snow'?.4:.2);
  tree(world,i,p,map.theme==='night'?.8+rand(i+36)*.6:.55+rand(i+35)*.8);
 }
 for(let i=0;i<42;i++){
  const s=i/42*trackLength;
  for(const sign of [-1,1]){
   const g=new THREE.Group();world.add(g);positionObject(g,s,sign*(TRACK_WIDTH/2+1.05),.26);
   box(g,.34,.52,2.5,map.theme==='night'?'#f44fba':i%2?'#fff9e1':'#ee4d45',[0,0,0]);
  }
 }
 // Start/finish gantry with a real 3D checkered line.
 for(let j=-6;j<6;j++)for(let k=0;k<2;k++){
  const tile=new THREE.Group();world.add(tile);positionObject(tile,k*.72,(j+.5)*TRACK_WIDTH/12,.09);
  box(tile,TRACK_WIDTH/12,.045,.72,(j+k)%2?'#1e242e':'#f7f3de',[0,0,0]);
 }
 const arch=new THREE.Group();world.add(arch);positionObject(arch,0,0,0);
 for(const side of [-1,1])box(arch,.45,6.7,.45,'#f4ce51',[side*8,3.4,0]);
 box(arch,16.6,.65,.4,'#20283b',[0,7.15,0]);
 for(let i=0;i<9;i++)box(arch,1.7,.16,.05,i%2?'#f5ce55':'#ffffff',[(i-4)*1.78,7.15,.23]);
}
function buildWorld(){
 disposeWorld();map=MAPS[ui.map];world=new THREE.Group();scene.add(world);
 const sky=new THREE.Color(map.sky[0]);scene.background=sky;scene.fog=new THREE.FogExp2(map.theme==='night'?'#17243f':map.fog,map.theme==='night'?.0024:.00165);
 if(ambient){scene.remove(ambient);ambient=null}
 ambient=new THREE.Group();scene.add(ambient);
 ambient.add(new THREE.HemisphereLight(map.theme==='night'?0x7aa8fb:0xe8f8ff,map.theme==='lava'?0x913f26:0x5b7854,map.theme==='night'?2.25:2.9));
 const sun=new THREE.DirectionalLight(map.theme==='lava'?0xffa05a:map.theme==='night'?0x9ca7ff:0xffe5a8,map.theme==='night'?1.5:2.5);sun.position.set(-70,120,65);ambient.add(sun);
 buildCurve();
 ground=mesh(new THREE.PlaneGeometry(1800,1800),material(map.grass[0]),world,[0,-4,0]);ground.rotation.x=-Math.PI/2;ground.castShadow=false;
 ribbon(TRACK_WIDTH+3.6,0,-.15,material(map.theme==='night'?'#e948a2':map.theme==='snow'?'#d6effc':'#eee5c5'));
 ribbon(TRACK_WIDTH+1.3,0,-.08,material(map.theme==='night'?'#272e42':'#e8dfca'));
 ribbon(TRACK_WIDTH,0,.015,material(map.road[0],.95));
 for(const lane of [-TRACK_WIDTH/6,TRACK_WIDTH/6]){
  for(let i=0;i<115;i++){
   if(i%2)continue;
   const o=new THREE.Group();world.add(o);positionObject(o,i/115*trackLength,lane,.105);
   box(o,.13,.025,trackLength/115*.65,map.lane,[0,0,0]);
  }
 }
 decorate();
 boxes=[.07,.23,.41,.58,.75,.90].map((t,i)=>{
  const obj=new THREE.Group();world.add(obj);const core=mesh(new THREE.OctahedronGeometry(1.05),material('#52dfff',.18,0x198dc3),obj,[0,2.1,0]);
  const ring=mesh(new THREE.TorusGeometry(1.2,.12,8,20),material('#ffffff',.25,0x74deff),obj,[0,2.1,0]);ring.rotation.x=.5;
  return {s:t*trackLength,lane:(i%3-1)*3.6,object:obj,core,ring,cool:0};
 });
 pads=[.13,.33,.52,.69,.85].map((t,i)=>{
  const obj=new THREE.Group();world.add(obj);
  box(obj,3.1,.08,4.4,'#153d5a',[0,0,0]);
  for(let j=-1;j<=1;j++)box(obj,.38,.11,2.8,'#44e6ff',[j*.8,.06,0]);
  return {s:t*trackLength,lane:i%2?-3.8:3.8,object:obj,cool:0};
 });
 for(const b of boxes)positionObject(b.object,b.s,b.lane,0);
 for(const p of pads)positionObject(p.object,p.s,p.lane,.14);
}
function createKart(character,vehicle){
 const root=new THREE.Group(),body=new THREE.Group();root.add(body);
 const color=character.color, accent=character.alt;
 if(vehicle.id==='pod'){
  mesh(new THREE.SphereGeometry(1.28,16,8),material(color,.28),body,[0,.82,0]).scale.set(1,.36,1.6);
  box(body,1.7,.28,1.65,accent,[0,.76,-.1]);
  for(const x of [-1,1])sphere(body,.28,'#79f2ff',[x*1.12,.58,.9]);
 }else if(vehicle.id==='bike'){
  for(const z of [-1.05,1.1]){const wheel=cylinder(body,.52,.52,.25,'#20212c',[0,.55,z],14);wheel.rotation.z=Math.PI/2;
   cylinder(body,.19,.19,.27,'#b5b5bf',[0,.55,z],10).rotation.z=Math.PI/2}
  box(body,.82,.48,2.2,color,[0,.85,0]);box(body,1.25,.16,.2,accent,[0,1.25,-.55]);
 }else{
  const truck=vehicle.id==='truck',w=truck?2.3:1.9;
  box(body,w,.46,3.1,color,[0,.76,0]);
  box(body,w*.88,.31,1.2,accent,[0,1.06,.18]);
  box(body,w*.72,.14,.42,'#272d3e',[0,1.06,-1.35]);
  for(const x of [-1,1])for(const z of [-1,1]){
   const wheel=cylinder(body,truck?.68:.49,truck?.68:.49,.32,'#1b202a',[x*(w/2+.05),.48,z*1.05],12);wheel.rotation.z=Math.PI/2;
   cylinder(body,.18,.18,.34,accent,[x*(w/2+.23),.48,z*1.05],9).rotation.z=Math.PI/2;
  }
 }
 // A stylized sculpted driver rather than a flat sprite.
 cylinder(body,.55,.65,.85,character.color,[0,1.45,.1]);
 sphere(body,.67,character.kind==='Panda'?'#f6f4e9':character.kind==='Robot'?'#bacbd8':character.color,[0,2.1,.1]);
 for(const x of [-1,1]){
  if(['Fox','Cat','Dragon','Elf','Panda'].includes(character.kind)){
   const ear=mesh(new THREE.ConeGeometry(.24,.62,6),material(character.color),body,[x*.48,2.72,.1]);ear.rotation.z=-x*.24;
  }else if(character.kind==='Frog')sphere(body,.26,color,[x*.48,2.6,-.1]);
  else if(character.kind==='Robot')box(body,.18,.42,.18,'#61efff',[x*.43,2.69,.1]);
  else sphere(body,.19,accent,[x*.45,2.63,.1]);
  sphere(body,.18,'#ffffff',[x*.29,2.22,.66]);sphere(body,.095,'#161b2d',[x*.28,2.21,.815]);
 }
 if(character.kind==='Wizard')mesh(new THREE.ConeGeometry(.82,1.25,9),material('#54265f'),body,[0,2.96,0]);
 if(character.kind==='Robot')box(body,.68,.13,.08,'#283b49',[0,1.83,.77]);
 for(const x of [-1,1])box(body,.19,.18,.13,'#fff6ca',[x*.53,.82,-1.57]);
 const flame=mesh(new THREE.ConeGeometry(.23,.7,8),material('#ffae25',.4,0xff6700),body,[0,.68,-1.82]);flame.rotation.x=-Math.PI/2;flame.visible=false;
 root.userData={body,flame};return root;
}

function updateHud(){if(!player)return;
 const lap=Math.min(LAPS,Math.floor(player.s/trackLength)+1);
 player.place=1+bots.filter(b=>b.s>player.s).length;
 $('place').textContent=ordinal(player.place);$('lap').textContent=`LAP ${lap} / ${LAPS}`;$('clock').textContent=fmt(elapsed);
 $('speed').innerHTML=`${Math.round(player.speed*3.7)} <small>KM/H</small>`;
 $('item-icon').textContent=player.item?ITEMS[player.item].icon:'?';$('item-name').textContent=player.item?`${ITEMS[player.item].name}${player.charges>1?' ×'+player.charges:''}`:'ITEM BOX';
}
function newRace(){if(!initRenderer())return;
 buildWorld();elapsed=0;phase=0;countdown=3.8;countdownLast=4;hazards=[];projectiles=[];
 const v=VEHICLES[ui.vehicle],c=CHARS[ui.char];
 player={s:4,lane:0,speed:0,drift:0,boost:0,shield:0,stun:0,invuln:0,item:null,charges:0,place:8,model:createKart(c,v)};
 world.add(player.model);
 bots=Array.from({length:7},(_,i)=>{
  const lane=[-3.7,3.7,0,-2.7,2.7,-4.7,4.7][i],bot={s:19+i*13,lane,targetLane:lane,speed:31+i*.75,boost:0,stun:0,phase:i*.77,name:BOT_NAMES[(i+ui.map*3)%BOT_NAMES.length],model:createKart(CHARS[(i+ui.char+1)%CHARS.length],VEHICLES[i%4])};world.add(bot.model);return bot;
 });
 mode='countdown';$('menu').classList.add('hidden');$('overlay').classList.add('hidden');$('hud').classList.remove('hidden');$('item-hud').classList.remove('hidden');$('touch').classList.toggle('hidden',!isTouch);$('countdown').classList.remove('hidden');$('toast').textContent='';
 lastTime=performance.now();Sound.init();Sound.music(map);updateHud();
}
function pause(value){if(value&&mode==='racing'){
 mode='paused';$('overlay-tag').textContent='MID-RACE PIT STOP';$('overlay-title').textContent='PAUSED';$('overlay-text').textContent='Breathe. The road can wait.';$('results').innerHTML='';$('overlay').classList.remove('hidden');$('resume').classList.remove('hidden');Sound.engine(0,false);
 }else if(!value&&mode==='paused'){mode='racing';$('overlay').classList.add('hidden');lastTime=performance.now()}}
function back(){mode='menu';Sound.stopMusic();Sound.engine(0,false);$('hud').classList.add('hidden');$('item-hud').classList.add('hidden');$('touch').classList.add('hidden');$('overlay').classList.add('hidden');$('countdown').classList.add('hidden');$('menu').classList.remove('hidden');Object.keys(input).forEach(k=>input[k]=false);renderChoices()}
function finish(){mode='finished';Sound.engine(0,false);Sound.stopMusic();Sound.sfx.win();saveTime(elapsed);updateHud();
 $('overlay-tag').textContent='CHECKERED FLAG';$('overlay-title').textContent=player.place===1?'CHAMPION!':`${ordinal(player.place)} PLACE`;
 $('overlay-text').textContent=`${map.name} · ${fmt(elapsed)} · ${CHARS[ui.char].name} in the ${VEHICLES[ui.vehicle].name}`;
 const racers=[{name:'YOU · '+CHARS[ui.char].name,s:player.s,me:true},...bots.map(b=>({name:b.name,s:b.s}))].sort((a,b)=>b.s-a.s);
 $('results').innerHTML=racers.map((r,i)=>`<div class="row ${r.me?'me':''}">${i+1}. ${r.name}</div>`).join('');
 $('overlay').classList.remove('hidden');$('resume').classList.add('hidden');$('touch').classList.add('hidden');$('countdown').classList.add('hidden');
}
function hit(){if(player.invuln>0||player.shield>0)return;
 player.speed*=.32;player.stun=1.1;player.invuln=2;player.drift=0;Sound.sfx.hit();toast('SPUN OUT!');$('flash').classList.remove('pop');void $('flash').offsetWidth;$('flash').classList.add('pop');
}
function attack(bot,power=1){if(bot.stun>0)return;bot.speed*=power===2?.25:.43;bot.stun=power===2?2.4:1.3}
function collect(){if(player.item)return;
 const choices=['mushroom','mushroom3','banana','gshell','rshell','star','bolt','oil'];
 const trailing=(player.place-1)/7,weights=[22,11,13,13,10,5+trailing*16,2+trailing*14,10];
 let r=Math.random()*weights.reduce((a,b)=>a+b,0),i=0;while(i<weights.length-1&&r>=weights[i])r-=weights[i++];
 player.item=choices[i];player.charges=i===1?3:1;Sound.sfx.box();toast('ITEM! '+ITEMS[player.item].name,1.1);updateHud();
}
function createHazard(type,s,lane,velocity=0,owner='player'){
 const g=new THREE.Group();world.add(g);
 if(type==='banana'){
  mesh(new THREE.ConeGeometry(.49,1.15,8),material('#ffdd4a'),g,[0,.65,0]).rotation.z=.15;
  sphere(g,.13,'#60442d',[0,1.25,0]);
 }else if(type==='oil'){
  mesh(new THREE.CylinderGeometry(1.05,1.05,.065,18),material('#131725',.24),g,[0,.15,0]);
  mesh(new THREE.TorusGeometry(.84,.07,6,18),material('#7865ac'),g,[0,.21,0]).rotation.x=Math.PI/2;
 }else{
  sphere(g,.68,type==='rshell'?'#ec4c55':'#38c56c',[0,.8,0]);
  mesh(new THREE.ConeGeometry(.34,.6,7),material('#fff1bf'),g,[0,.8,.7]).rotation.x=Math.PI/2;
 }
 const h={type,s,lane,velocity,model:g,owner,life:velocity?6:22};hazards.push(h);return h;
}
function useItem(){if(mode!=='racing'||!player.item)return;
 const item=player.item;
 if(item==='mushroom'||item==='mushroom3'){player.boost=2.5;player.speed=Math.max(player.speed,69);Sound.sfx.boost();toast('TURBO!')}
 else if(item==='star'){player.shield=7;player.boost=7;Sound.sfx.star();toast('INVINCIBLE!')}
 else if(item==='bolt'){bots.filter(b=>b.s>player.s).forEach(b=>attack(b,2));Sound.sfx.bolt();toast('LIGHTNING!')}
 else if(item==='banana'||item==='oil'){createHazard(item,player.s-3,player.lane);Sound.sfx.throw();toast(item==='banana'?'BANANA DROPPED':'OIL SLICK!')}
 else {createHazard(item,player.s+3,player.lane,item==='rshell'?88:66);Sound.sfx.throw();toast(item==='rshell'?'HOMING SHELL!':'SHELL AWAY!')}
 player.charges--;if(player.charges<=0)player.item=null;updateHud();
}
function progressDistance(a,b){return Math.abs(a-b)}
function updatePhysics(dt){
 if(mode==='countdown'){
  countdown-=dt;const number=Math.ceil(countdown);
  if(number<countdownLast){countdownLast=number;$('countdown').textContent=number<=0?'GO!':String(number);Sound.sfx[number<=0?'go':'beep']()}
  if(countdown<=-.6){mode='racing';$('countdown').classList.add('hidden')}
  return;
 }
 if(mode!=='racing')return;
 elapsed+=dt;toastTime=Math.max(0,toastTime-dt);if(!toastTime)$('toast').textContent='';
 player.boost=Math.max(0,player.boost-dt);player.shield=Math.max(0,player.shield-dt);player.stun=Math.max(0,player.stun-dt);player.invuln=Math.max(0,player.invuln-dt);
 const char=CHARS[ui.char],vehicle=VEHICLES[ui.vehicle];
 const max=43+(char.spd+vehicle.spd)*2.5,acc=19+(char.acc+vehicle.acc)*1.5;
 const gas=(isTouch||input.gas)&&!input.brake&&player.stun<=0;
 player.speed=clamp(player.speed+(gas?acc:input.brake?-85:-24)*dt,0,max*(player.boost?1.48:1));
 if(player.boost)player.speed=Math.max(player.speed,max*1.22);
 const steer=Number(input.right)-Number(input.left),ratio=player.speed/max;
 if(input.drift&&steer&&ratio>.35){player.drift+=dt}else if(player.drift){
  if(player.drift>.65){player.boost=Math.max(player.boost,player.drift>2?2.1:1.1);Sound.sfx.boost();toast(player.drift>2?'SUPER MINI-TURBO!':'MINI-TURBO!',.8)}
  player.drift=0;
 }
 player.lane+=steer*dt*(6.4+(char.han+vehicle.han)*.36)*(ratio*.7+.3)*(input.drift?1.22:1);
 player.lane=clamp(player.lane,-TRACK_WIDTH,TRACK_WIDTH);
 if(Math.abs(player.lane)>TRACK_WIDTH/2-.15){player.speed=Math.max(0,player.speed-(map.theme==='snow'?13:19)*dt);if(Math.abs(player.lane)>TRACK_WIDTH/2+2.8)player.lane=Math.sign(player.lane)*(TRACK_WIDTH/2+2.8)}
 player.s+=player.speed*dt;
 for(const bot of bots){
  bot.stun=Math.max(0,bot.stun-dt);bot.boost=Math.max(0,bot.boost-dt);
  bot.targetLane=clamp(bot.targetLane,-4.65,4.65);
  bot.lane=lerp(bot.lane,bot.targetLane,dt*1.1);
  const target=31+(bot.phase*1.9)+Math.sin(elapsed*.18+bot.phase)*2.4+(elapsed>5?4:0);
  bot.speed=lerp(bot.speed,bot.stun?target*.25:bot.boost?target*1.36:target,dt*(bot.stun?3:.5));bot.s+=bot.speed*dt;
  if(Math.random()<dt*.03&&!bot.stun){bot.boost=1.3; if(bot.s>player.s&&bot.s<player.s+18&&Math.abs(bot.lane-player.lane)<1.8&&Math.random()<.12)createHazard('banana',bot.s-3,bot.lane,0,'bot')}
  if(Math.sin(elapsed*.43+bot.phase)> .995)bot.targetLane=clamp(bot.targetLane+(Math.sin(bot.phase*12)*2),-4.6,4.6);
  if(progressDistance(bot.s,player.s)<2.8&&Math.abs(bot.lane-player.lane)<1.65){if(player.shield>0)attack(bot);else if(player.invuln<=0&&player.speed>bot.speed+7)hit()}
 }
 for(const item of boxes){item.cool=Math.max(0,item.cool-dt);if(!item.cool&&progressDistance(item.s+Math.floor(player.s/trackLength)*trackLength,player.s)<3.1&&Math.abs(player.lane-item.lane)<1.95){collect();item.cool=8}}
 for(const pad of pads){pad.cool=Math.max(0,pad.cool-dt);if(!pad.cool&&progressDistance(pad.s+Math.floor(player.s/trackLength)*trackLength,player.s)<3&&Math.abs(player.lane-pad.lane)<2){player.boost=Math.max(player.boost,1.8);pad.cool=3;Sound.sfx.boost();toast('BOOST PAD!',.8)}}
 for(const h of [...hazards]){
  h.life-=dt;if(h.velocity){h.s+=h.velocity*dt;if(h.type==='rshell'){
   const target=bots.filter(b=>b.s>h.s&&b.s<h.s+55).sort((a,b)=>a.s-b.s)[0];if(target)h.lane=lerp(h.lane,target.lane,dt*2.7);
  }}
  if(h.life<=0||h.s<player.s-trackLength){world.remove(h.model);h.model.traverse(o=>o.geometry?.dispose());hazards.splice(hazards.indexOf(h),1);continue}
  if(h.owner==='bot'&&Math.abs(h.s-player.s)<1.8&&Math.abs(h.lane-player.lane)<1.4){hit();h.life=0;continue}
  for(const bot of bots)if(h.owner==='player'&&Math.abs(h.s-bot.s)<1.8&&Math.abs(h.lane-bot.lane)<1.45){attack(bot);h.life=0;break}
 }
 updateHud();Sound.engine(ratio,gas);
 if(player.s>=trackLength*LAPS)finish();
}

const camLook=new THREE.Vector3();let frameRunning=false;
function render(dt){
 if(!renderer||!world||!player)return;
 phase+=dt;
 positionObject(player.model,player.s,player.lane,.25+Math.sin(phase*17)*Math.min(.07,player.speed*.001));
 const tangent=direction(player.s);
 player.model.userData.body.rotation.z=lerp(player.model.userData.body.rotation.z,(Number(input.left)-Number(input.right))*.16-(input.drift?.2:0),dt*6);
 player.model.userData.flame.visible=player.boost>0||player.shield>0;
 player.model.userData.flame.scale.setScalar(.65+Math.sin(phase*29)*.18);
 for(const bot of bots){positionObject(bot.model,bot.s,bot.lane,.25+Math.sin(phase*9+bot.phase)*.035);bot.model.userData.flame.visible=bot.boost>0}
 for(const b of boxes){b.object.visible=b.cool===0;b.core.rotation.y+=dt*1.5;b.ring.rotation.y+=dt*.9;b.core.position.y=2.12+Math.sin(phase*3+b.s)*.25}
 for(const h of hazards){positionObject(h.model,h.s,h.lane,0);if(h.velocity)h.model.rotation.y+=phase*.08}
 const p=point(player.s,player.lane);
 const behind=12+Math.min(player.speed*.035,2),wanted=p.clone().addScaledVector(tangent,-behind).add(new THREE.Vector3(0,6.5,0));
 if(!Number.isFinite(camera.position.x)||camera.position.length()<.1)camera.position.copy(wanted);
 camera.position.lerp(wanted,clamp(dt*13,.01,.6));
 camLook.copy(p).addScaledVector(tangent,2).add(new THREE.Vector3(0,1.1,0));camera.lookAt(camLook);
 camera.fov=lerp(camera.fov,(innerWidth<innerHeight?76:67)+Math.min(player.speed*.075,5),dt*2);camera.updateProjectionMatrix();
 renderer.render(scene,camera);
}
function frame(now){
 if(mode==='menu'){frameRunning=false;return}
 requestAnimationFrame(frame);
 const dt=clamp((now-lastTime)/1000,0,MAX_DT);lastTime=now;
 if(mode!=='paused'&&mode!=='finished')updatePhysics(dt);
 if(world)render(dt);
}
const originalNewRace=newRace;
$('start').onclick=()=>{originalNewRace();if(!frameRunning&&mode==='countdown'){frameRunning=true;requestAnimationFrame(frame)}};
$('retry').onclick=()=>{originalNewRace();if(!frameRunning&&mode==='countdown'){frameRunning=true;requestAnimationFrame(frame)}};
$('pause').onclick=()=>pause(true);$('resume').onclick=()=>pause(false);$('back').onclick=back;
$('sound').onclick=()=>{Sound.init();Sound.mute(!Sound.isMuted());$('sound').textContent=Sound.isMuted()?'♪̸':'♪'};
function key(event,on){
 const k=event.code;
 if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','ShiftLeft','ShiftRight'].includes(k))event.preventDefault();
 if(on&&k==='Space'&&!event.repeat){useItem();return}
 if(on&&(k==='Escape'||k==='KeyP')){pause(mode==='racing');return}
 if(on&&k==='KeyM'){$('sound').click();return}
 const lookup={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ArrowUp:'gas',KeyW:'gas',ArrowDown:'brake',KeyS:'brake',ShiftLeft:'drift',ShiftRight:'drift'};
 if(lookup[k])input[lookup[k]]=on;
}
addEventListener('keydown',e=>key(e,true));addEventListener('keyup',e=>key(e,false));
addEventListener('blur',()=>{Object.keys(input).forEach(k=>input[k]=false);if(mode==='racing')pause(true)});
document.querySelectorAll('#touch button').forEach(button=>{
 const action=button.dataset.control;
 button.addEventListener('pointerdown',event=>{event.preventDefault();button.setPointerCapture?.(event.pointerId);button.classList.add('pressed');if(action==='item')useItem();else input[action]=true});
 const up=event=>{event.preventDefault();button.classList.remove('pressed');if(action!=='item')input[action]=false};
 button.addEventListener('pointerup',up);button.addEventListener('pointercancel',up);button.addEventListener('lostpointercapture',up);
});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='racing')pause(true)});
window.KartRush={getState:()=>({state:mode,engine:'three.js',lap:player?Math.min(3,Math.floor(player.s/trackLength)+1):0,place:player?.place||0,speed:player?.speed||0,item:player?.item||null,trackLength,bots:bots.length,map:map.id,webgl:!!renderer,position:player?.model.position.toArray()||null}),start:()=>{$('start').click()},back};
