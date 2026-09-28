'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const canvas = $('race'), ctx = canvas.getContext('2d', { alpha: false });
  const clamp = (n,a,b) => Math.min(b,Math.max(a,n));
  const lerp = (a,b,t) => a+(b-a)*t;
  const ease = t => (1-Math.cos(t*Math.PI))/2;
  const pct = n => ((n%1)+1)%1;
  const icons = {rusty:'🦊',luna:'🐱',bolt:'🤖',pip:'🐸',zed:'🧙',coco:'🐼',blaze:'🐲',ivy:'🧝'};
  const rideIcons = {kart:'🏎️',bike:'🏍️',truck:'🛻',pod:'🛸'};
  const mapIcons = {meadows:'☀',frost:'❄',ember:'🌋',neon:'🌙'};
  const ui = {char:0,vehicle:0,map:0};
  let map=MAPS[0], road=[], length=0, boxes=[], pads=[], W=0,H=0,DPR=1;
  let state='menu', player={}, bots=[], hazards=[], particles=[];
  let controls={left:false,right:false,gas:false,brake:false,drift:false}, touchMode=false;
  let timer=0, countdown=0, lastCount=4, messageTime=0, renderTime=0, lastFrame=0, accum=0, flashTime=0, finishOrder=[];
  let skyOffset=0, best=null;
  function resize(){DPR=Math.min(devicePixelRatio||1,2); W=Math.max(1,innerWidth); H=Math.max(1,innerHeight); canvas.width=Math.round(W*DPR);canvas.height=Math.round(H*DPR);ctx.setTransform(DPR,0,0,DPR,0,0)}
  addEventListener('resize',resize);resize();
  function safeBest(){try{return JSON.parse(localStorage.getItem('kart-rush-best')||'{}')}catch{return {}}}
  function saveBest(t){try{const data=safeBest();const key=map.id+'-'+LAPS; if(!data[key]||t<data[key])data[key]=t;localStorage.setItem('kart-rush-best',JSON.stringify(data))}catch{}}
  function fmt(t){let m=Math.floor(t/60),s=Math.floor(t%60),ms=Math.floor(t*100)%100;return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(ms).padStart(2,'0')}`}
  function renderChoices(){
    $('characters').innerHTML=CHARS.map((c,i)=>`<button class="choice ${i===ui.char?'active':''}" data-set="char" data-index="${i}" aria-label="${c.name}, ${c.kind}" aria-pressed="${i===ui.char}"><span class="icon">${icons[c.id]}</span><span class="name">${c.name}</span></button>`).join('');
    $('vehicles').innerHTML=VEHICLES.map((v,i)=>`<button class="choice ${i===ui.vehicle?'active':''}" data-set="vehicle" data-index="${i}" aria-label="${v.name}" aria-pressed="${i===ui.vehicle}"><span class="icon">${rideIcons[v.id]}</span><span class="name">${v.name}</span></button>`).join('');
    $('maps').innerHTML=MAPS.map((m,i)=>`<button class="choice ${i===ui.map?'active':''}" data-set="map" data-index="${i}" aria-label="${m.name}, ${m.diff}" aria-pressed="${i===ui.map}"><span class="map-swatch" style="--sky:${m.sky[0]};--hill:${m.hills[0]};--road:${m.road[0]}"></span><span class="name">${mapIcons[m.id]} ${m.name}</span><span class="detail">${m.diff}</span></button>`).join('');
    const c=CHARS[ui.char],v=VEHICLES[ui.vehicle],m=MAPS[ui.map];
    $('character-info').textContent=`${c.kind} · ${c.bio}`;$('vehicle-info').textContent=v.desc;$('map-info').textContent=m.desc;
    $('stats').innerHTML=`<span>SPEED <b>${'▰'.repeat(Math.round((c.spd+v.spd)/2))}</b></span><span>ACCEL <b>${'▰'.repeat(Math.round((c.acc+v.acc)/2))}</b></span><span>GRIP <b>${'▰'.repeat(Math.round((c.han+v.han)/2))}</b></span>`;
    best=safeBest()[m.id+'-'+LAPS];$('start').innerHTML=best?`START RACE <span>BEST ${fmt(best)} ↗</span>`:'START RACE <span>↗</span>';
  }
  $('menu').addEventListener('click',e=>{const b=e.target.closest('[data-set]');if(!b)return;ui[b.dataset.set]=Number(b.dataset.index);map=MAPS[ui.map];Sound.init();Sound.sfx.click();renderChoices()});
  renderChoices();
  function buildTrack(){map=MAPS[ui.map];road=[];let y=0;
    const add=(curve,height)=>{const prev=road.length?road[road.length-1].y:y;road.push({curve,y:prev+height});y=prev+height};
    for(const [enter,hold,leave,bend,hill] of map.spec){
      const a=Math.max(1,Math.round(enter*map.scale)),b=Math.max(1,Math.round(hold*map.scale)),c=Math.max(1,Math.round(leave*map.scale));let total=a+b+c;
      for(let i=0;i<total;i++){let strength=i<a?ease(i/a):i<a+b?1:ease((total-i)/c);const target=y+(hill*SEG/6)*Math.sin(Math.PI*(i+1)/total);add(bend*strength,(target-y)*.12)}
    }
    for(let i=0;i<30;i++)add(0,-y/(30-i));
    length=road.length*SEG;
    boxes=map.boxes.map((n,i)=>({z:(n*map.scale*SEG)%length,x:[-.58,.48,0,.66][i%4],cool:0}));
    pads=map.pads.map((n,i)=>({z:(n*map.scale*SEG)%length,x:[.52,-.5,0,-.35][i%4]}));
  }
  function heightAt(z){let v=pct(z/length)*road.length,i=Math.floor(v);return lerp(road[i].y,road[(i+1)%road.length].y,v-i)}
  function segment(z){return road[Math.floor(pct(z/length)*road.length)]}
  function reset(){buildTrack();timer=0;countdown=3.8;lastCount=4;hazards=[];particles=[];finishOrder=[];skyOffset=0;
    player={z:0,x:0,speed:0,boost:0,stun:0,star:0,drift:0,driftDir:0,slide:0,item:null,charges:0,lastLap:0,place:1,invuln:0};
    bots=Array.from({length:7},(_,i)=>({name:BOT_NAMES[(i+ui.map*3)%BOT_NAMES.length],z:(i+1)*SEG*3,x:[-.65,.5,-.2,.73,-.8,.24,0][i],lane:[-.65,.5,-.2,.73,-.8,.24,0][i],speed:MAXSP_BASE*(.76+i*.017),char:CHARS[(i+ui.char+1)%CHARS.length],veh:VEHICLES[i%VEHICLES.length],phase:i*2.4,stun:0,boost:0,star:0,lap:0,itemTimer:7+i*2,finished:false}));
    state='countdown';$('menu').classList.add('hidden');$('overlay').classList.add('hidden');$('hud').classList.remove('hidden');$('item-hud').classList.remove('hidden');$('touch').classList.toggle('hidden',!touchMode);$('countdown').classList.remove('hidden');$('toast').textContent='';
    Sound.init();Sound.music(map);updateHud();
  }
  function setPause(value){if(value){if(state!=='racing')return;state='paused';$('overlay-tag').textContent='MID-RACE PIT STOP';$('overlay-title').textContent='PAUSED';$('overlay-text').textContent='Breathe. The road can wait.';$('results').innerHTML='';$('overlay').classList.remove('hidden');$('resume').classList.remove('hidden');Sound.engine(0,false)}else if(state==='paused'){state='racing';$('overlay').classList.add('hidden');lastFrame=performance.now()}}
  function backToMenu(){state='menu';Sound.stopMusic();Sound.engine(0,false);$('hud').classList.add('hidden');$('item-hud').classList.add('hidden');$('touch').classList.add('hidden');$('overlay').classList.add('hidden');$('countdown').classList.add('hidden');$('menu').classList.remove('hidden');controls={left:false,right:false,gas:false,brake:false,drift:false};renderChoices()}
  $('start').onclick=reset;$('pause').onclick=()=>setPause(true);$('resume').onclick=()=>setPause(false);$('retry').onclick=reset;$('back').onclick=backToMenu;
  $('sound').onclick=()=>{Sound.init();Sound.mute(!Sound.isMuted());$('sound').textContent=Sound.isMuted()?'♪̸':'♪'};
  function toast(msg,dur=1.5){$('toast').textContent=msg;messageTime=dur}
  function burst(x,y,color,n=12){for(let i=0;i<n;i++)particles.push({x,y,vx:(Math.random()-.5)*350,vy:(Math.random()-.5)*260,life:.4+Math.random()*.5,color,size:2+Math.random()*5})}
  function collect(){if(player.item)return;const types=['mushroom','mushroom3','banana','gshell','rshell','star','bolt','oil'];const trailing=(player.place-1)/7;let weights=[22,12,16,14,8,5+trailing*18,1+trailing*16,10],sum=weights.reduce((a,b)=>a+b,0),r=Math.random()*sum,choice=0;while(r>weights[choice]&&choice<weights.length-1)r-=weights[choice++];player.item=types[choice];player.charges=choice===1?3:1;Sound.sfx.box();toast('ITEM! '+ITEMS[player.item].name,1.1);updateHud()}
  function attack(bot,how){if(!bot||bot.stun>0||bot.star>0)return;bot.stun=how==='bolt'?2.8:1.4;bot.speed*=.55;burst(W/2,H*.7,'#ffe36e',8)}
  function hit(){if(player.invuln>0||player.star>0)return;player.stun=1.15;player.invuln=1.8;player.speed*=.38;player.drift=0;Sound.sfx.hit();toast('SPUN OUT!',1.2);flashTime=.2}
  function useItem(){if(state!=='racing'||!player.item)return;const id=player.item;
    if(id==='mushroom'||id==='mushroom3'){player.boost=2.5;player.speed=Math.max(player.speed,MAXSP_BASE*1.15);Sound.sfx.boost();toast('TURBO!',1)}
    else if(id==='star'){player.star=7;player.boost=7;Sound.sfx.star();toast('INVINCIBLE!',1.2)}
    else if(id==='bolt'){bots.forEach(b=>{if(b.z>player.z)attack(b,'bolt')});Sound.sfx.bolt();toast('LIGHTNING!',1.3);flashTime=.4}
    else if(id==='banana'||id==='oil'){hazards.push({type:id,z:player.z-SEG*1.8,x:player.x,life:13,owner:'player'});Sound.sfx.throw();toast(id==='banana'?'BANANA DROPPED':'OIL SLICK!',1)}
    else {hazards.push({type:id,z:player.z+SEG*2,x:player.x,life:7,owner:'player',speed:id==='rshell'?MAXSP_BASE*2.4:MAXSP_BASE*1.6});Sound.sfx.throw();toast(id==='rshell'?'HOMING SHELL!':'SHELL AWAY!',1)}
    player.charges--;if(player.charges<=0)player.item=null;updateHud();
  }
  function rank(){return 1+bots.filter(b=>b.z>player.z).length}
  function finish(){state='finished';Sound.engine(0,false);Sound.stopMusic();Sound.sfx.win();saveBest(timer);$('overlay-tag').textContent='CHECKERED FLAG';$('overlay-title').textContent=player.place===1?'CHAMPION!':`${ordinal(player.place)} PLACE`;$('overlay-text').textContent=`${map.name} · ${fmt(timer)} · ${CHARS[ui.char].name} in the ${VEHICLES[ui.vehicle].name}`;
    const places=[{name:'YOU · '+CHARS[ui.char].name,z:player.z,me:true},...bots.map(b=>({name:b.name,z:b.z}))].sort((a,b)=>b.z-a.z);
    $('results').innerHTML=places.map((p,i)=>`<div class="row ${p.me?'me':''}">${i+1}. ${p.name}</div>`).join('');$('overlay').classList.remove('hidden');$('resume').classList.add('hidden');$('touch').classList.add('hidden');$('countdown').classList.add('hidden')}
  function ordinal(n){return n===1?'1ST':n===2?'2ND':n===3?'3RD':`${n}TH`}
  function crossed(old,z,target){const before=Math.floor((old-target)/length),after=Math.floor((z-target)/length);return after>before}
  function update(dt){
    if(state==='countdown'){countdown-=dt;let n=Math.ceil(countdown);if(n<lastCount){lastCount=n;Sound.sfx[n<=0?'go':'beep']();$('countdown').textContent=n<=0?'GO!':String(n)}if(countdown<=-.65){state='racing';$('countdown').classList.add('hidden')}return}
    if(state!=='racing')return;
    timer+=dt;messageTime=Math.max(0,messageTime-dt);if(!messageTime)$('toast').textContent='';flashTime=Math.max(0,flashTime-dt);$('flash').style.background=flashTime>0?'#fff9':'';$('flash').style.opacity=flashTime>0?String(flashTime):'0';
    player.boost=Math.max(0,player.boost-dt);player.star=Math.max(0,player.star-dt);player.stun=Math.max(0,player.stun-dt);player.invuln=Math.max(0,player.invuln-dt);
    const character=CHARS[ui.char],vehicle=VEHICLES[ui.vehicle],max=MAXSP_BASE*(.76+(character.spd+vehicle.spd)*.042),acc=MAXSP_BASE*(.22+(character.acc+vehicle.acc)*.032),ratio=player.speed/max;
    let accelerating=(touchMode||controls.gas)&&!controls.brake;
    if(player.stun>0)accelerating=false;
    if(accelerating)player.speed+=acc*dt;else player.speed-=max*(controls.brake?.9:.33)*dt;
    if(player.boost>0)player.speed=Math.max(player.speed,max*1.22);
    player.speed=clamp(player.speed,0,max*(player.boost>0?1.38:1));
    const curve=segment(player.z).curve;
    let steer=(Number(controls.right)-Number(controls.left));
    const grip=map.grip/9*(.55+(character.han+vehicle.han)*.072);
    if(controls.drift&&steer&&ratio>.38){player.drift+=dt;player.driftDir=steer;player.slide=lerp(player.slide,steer*.32,dt*4);if(Math.random()<dt*8)burst(W/2+steer*26,H*.91,'#ffd75e',2)}
    else {if(player.drift>.7){player.boost=Math.max(player.boost,player.drift>2?2.4:1.3);Sound.sfx.boost();toast(player.drift>2?'SUPER MINI-TURBO!':'MINI-TURBO!',.8)}player.drift=0;player.slide=lerp(player.slide,0,dt*5)}
    player.x+=steer*dt*(.8+grip*.8)*(ratio*.7+.2)+(player.slide*dt*.45);
    player.x-=curve*ratio*ratio*dt*.018/(grip+.15);
    if(Math.abs(player.x)>1.03){player.speed-=max*dt*.8;if(Math.abs(player.x)>1.43)player.x=Math.sign(player.x)*1.43}
    player.speed=clamp(player.speed,0,max*1.38);
    const old=player.z;player.z+=player.speed*dt;skyOffset+=curve*dt*ratio*.08+steer*dt*.07;
    for(const box of boxes)if(!player.item&&crossed(old,player.z,box.z)&&Math.abs(player.x-box.x)<.35)collect();
    for(const pad of pads)if(crossed(old,player.z,pad.z)&&Math.abs(player.x-pad.x)<.33){player.boost=Math.max(player.boost,1.7);Sound.sfx.boost();toast('BOOST PAD!',.7)}
    for(const b of bots){b.phase+=dt;b.stun=Math.max(0,b.stun-dt);b.boost=Math.max(0,b.boost-dt);b.star=Math.max(0,b.star-dt);b.itemTimer-=dt;
      let target=b.lane+Math.sin(b.phase*.72)*.17;b.x=lerp(b.x,target,dt*1.3);
      const bmax=MAXSP_BASE*(.79+(bots.indexOf(b)*.017)+Math.sin(b.phase*.17)*.035);
      const desired=b.stun>0?bmax*.3:b.boost>0?bmax*1.25:bmax;
      b.speed=lerp(b.speed,desired,dt*(b.stun>0?3:.32));b.z+=b.speed*dt;
      if(b.itemTimer<=0){b.itemTimer=8+Math.random()*10;if(Math.abs(b.z-player.z)<SEG*28&&Math.random()<.55){if(b.z>player.z&&Math.abs(b.x-player.x)<.55&&player.star<=0){hazards.push({type:'gshell',z:b.z-SEG*2,x:b.x,life:6,owner:'bot',speed:-MAXSP_BASE*1.7})}else if(b.z<player.z&&Math.random()<.4)b.boost=2.5}}}
    for(const h of hazards){h.life-=dt;if(h.speed){h.z+=h.speed*dt;if(h.type==='rshell'){const ahead=bots.filter(b=>b.z>h.z&&b.z<h.z+SEG*36).sort((a,b)=>a.z-b.z)[0];if(ahead)h.x=lerp(h.x,ahead.x,dt*2)}}
      if(h.owner==='bot'&&Math.abs(h.z-player.z)<SEG*1.2&&Math.abs(h.x-player.x)<.28){hit();h.life=0}
      else if(h.owner==='player')for(const b of bots)if(Math.abs(h.z-b.z)<SEG*1.2&&Math.abs(h.x-b.x)<.28){attack(b);h.life=0;break}}
    hazards=hazards.filter(h=>h.life>0&&Math.abs(h.z-player.z)<length);
    for(const b of bots)if(Math.abs(b.z-player.z)<SEG*.9&&Math.abs(b.x-player.x)<.23){if(player.star>0){attack(b);player.speed*=.99}else if(player.invuln<=0&&b.stun<=0){let heavy=character.wgt+vehicle.wgt >= b.char.wgt+b.veh.wgt;if(!heavy)hit();else {attack(b);Sound.sfx.bump()}player.x=clamp(player.x+(player.x>b.x?.13:-.13),-1.42,1.42)}}
    const lap=Math.min(LAPS,Math.floor(player.z/length)+1);if(lap>player.lastLap&&player.lastLap>0){Sound.sfx.lap();toast(lap===LAPS?'FINAL LAP!':`LAP ${lap}!`,2)}player.lastLap=lap;
    player.place=rank();Sound.engine(player.speed/max,true);if(player.z>=length*LAPS){player.place=rank();finish()}updateHud();
    particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=480*dt;p.life-=dt});particles=particles.filter(p=>p.life>0);
  }
  function updateHud(){if(!player||state==='menu')return;$('place').textContent=ordinal(player.place||1);$('lap').textContent=`LAP ${Math.min(LAPS,Math.floor(player.z/length)+1)} / ${LAPS}`;$('clock').textContent=fmt(timer);$('speed').innerHTML=`${Math.round(player.speed/MAXSP_BASE*205)} <small>KM/H</small>`;const item=player.item&&ITEMS[player.item];$('item-icon').textContent=item?item.icon:'?';$('item-name').textContent=item?item.name+(player.charges>1?' ×'+player.charges:''):'NO ITEM'}
  // Pseudo-3D roadway: scan the course from the camera towards the horizon.
  function project(z,y,cx,camY,camZ){const d=Math.max(1,z-camZ),scale=CAMD/d;return{x:W/2+scale*cx*W/2,y:H/2-scale*(y-camY)*H/2,w:scale*ROADW*W/2,scale}}
  function poly(color,...coords){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(coords[0],coords[1]);for(let i=2;i<coords.length;i+=2)ctx.lineTo(coords[i],coords[i+1]);ctx.closePath();ctx.fill()}
  function background(){const night=map.theme==='night',lava=map.theme==='lava';let sky=ctx.createLinearGradient(0,0,0,H*.75);sky.addColorStop(0,map.sky[0]);sky.addColorStop(1,map.sky[1]);ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);const horizon=H*.47,drift=skyOffset*80;
    ctx.fillStyle=night?'#d8efff':lava?'#ffc277':'#fff8d8';ctx.beginPath();ctx.arc(W*(night?.79:.78)-drift*.1,H*.16,Math.min(W,H)*.06,0,Math.PI*2);ctx.fill();
    if(night){ctx.fillStyle='#c7e2fe';for(let i=0;i<45;i++){let x=pct(Math.sin(i*127.1)*461+drift*.00005)*W,y=(.04+pct(Math.sin(i*77.2)*64)*.34)*H;ctx.fillRect(x,y,i%5===0?2:1,i%5===0?2:1)}}
    for(let layer=0;layer<2;layer++){ctx.fillStyle=map.hills[layer];ctx.beginPath();ctx.moveTo(0,H);let shift=drift*(layer+.5),base=horizon+layer*H*.04;
      for(let x=-50;x<=W+80;x+=20){let v=x+shift,peaks=Math.sin(v*.005+layer*2)*H*.065+Math.sin(v*.017+layer)*H*.025+Math.sin(v*.038)*H*.01;let buildings=map.theme==='night'?Math.floor(Math.sin(v*.055)*3)*H*.019:0;ctx.lineTo(x,base-peaks-buildings)}ctx.lineTo(W,H);ctx.fill()}
    if(!night&&!lava){ctx.fillStyle='#ffffff90';for(let i=0;i<5;i++){let x=pct((i*.263+skyOffset*.012))*W,y=H*(.11+(i%3)*.065);ctx.beginPath();ctx.ellipse(x,y,35+i%3*12,9,0,0,Math.PI*2);ctx.fill()}}
  }
  function quad(p1,p2,l1,l2,color){poly(color,p1.x-l1,p1.y,p2.x-l2,p2.y,p2.x+l2,p2.y,p1.x+l1,p1.y)}
  function drawDecor(x,y,s,type,side){if(s<.13||y>H*1.2)return;ctx.save();ctx.translate(x,y);ctx.scale(s,s);let size=105;
    if(type==='tree'||type==='pine'){ctx.fillStyle='#614025';ctx.fillRect(-6,-95,12,95);ctx.fillStyle=type==='pine'?'#245d53':'#27713e';for(let i=0;i<3;i++){ctx.beginPath();if(type==='pine'){ctx.moveTo(0,-145+i*27);ctx.lineTo(-42+i*5,-52+i*24);ctx.lineTo(42-i*5,-52+i*24)}else{ctx.arc((i-1)*23,-106-i%2*12,30,0,7)}ctx.fill()}if(type==='pine'){ctx.fillStyle='#dff0f9';ctx.fillRect(-20,-102,40,5)}}
    else if(type==='rock'){ctx.fillStyle='#442d2b';poly('#49302c',-40,0,-31,-65,-12,-90,20,-80,48,0);poly('#ff8d35',-12,-90,20,-80,9,-43,-5,-48)}
    else{ctx.fillStyle=side%2?'#224461':'#1b304d';ctx.fillRect(-32,-size,64,size);ctx.fillStyle='#ff5aa6';ctx.fillRect(-33,-size,66,4);ctx.fillStyle='#ffc75e';for(let a=-20;a<25;a+=17)for(let b=-size+13;b<0;b+=20)if((a+b)%3!==0)ctx.fillRect(a,b,8,9)}ctx.restore()}
  function drawBox(x,y,s){let size=clamp(s*W*47,5,45),t=renderTime*3;ctx.save();ctx.translate(x,y-size/2);ctx.rotate(Math.sin(t)*.12);ctx.fillStyle='#562ece';ctx.fillRect(-size/2,-size/2,size,size);ctx.strokeStyle='#e4cbff';ctx.lineWidth=Math.max(1,size*.08);ctx.strokeRect(-size/2,-size/2,size,size);ctx.fillStyle='#fff';ctx.font=`900 ${Math.round(size*.8)}px 'Barlow Condensed'`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('?',0,1);ctx.restore()}
  function kart(x,y,scale,color,alt,kind,steer=0,spin=0){if(scale<.12)return;ctx.save();ctx.translate(x,y);ctx.rotate(steer*.045+spin);ctx.scale(scale,scale);
    ctx.fillStyle='#10182070';ctx.beginPath();ctx.ellipse(0,0,42,12,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#222433';ctx.fillRect(-48,-27,16,23);ctx.fillRect(32,-27,16,23);ctx.fillRect(-44,-64,17,23);ctx.fillRect(27,-64,17,23);
    poly('#1e2733',-30,-13,-29,-50,-15,-63,15,-63,29,-50,30,-13);poly(color,-32,-16,-29,-47,-19,-60,19,-60,29,-47,32,-16);poly('#fff9',-18,-22,0,-42,18,-22);ctx.fillStyle=alt;ctx.beginPath();ctx.ellipse(0,-64,19,25,0,0,7);ctx.fill();ctx.fillStyle=color;ctx.beginPath();ctx.arc(0,-76,22,0,7);ctx.fill();ctx.font='26px serif';ctx.textAlign='center';ctx.fillText(kind,0,-70);ctx.restore()}
  function drawRoad(){const camZ=player.z-PLAYERZ,camY=heightAt(player.z)+CAMH,base=Math.floor(camZ/SEG),basePct=pct(camZ/SEG)*SEG;let curveX=0,dx=-road[((base%road.length)+road.length)%road.length].curve*basePct/SEG,maxY=H,drawables=[];
    for(let n=0;n<DRAW;n++){let idx=((base+n)%road.length+road.length)%road.length,seg=road[idx],next=road[(idx+1)%road.length];let z1=(base+n)*SEG,z2=z1+SEG;
      if(n>0&&idx===0){/* vertical continuity at the seam */}
      const wrap1=Math.floor((base+n)/road.length),wrap2=Math.floor((base+n+1)/road.length);
      let p1=project(z1,seg.y,curveX-player.x*ROADW,camY,camZ),p2=project(z2,next.y,curveX+dx-player.x*ROADW,camY,camZ);
      if(wrap1!==wrap2)p2.y=project(z2,road[road.length-1].y,curveX+dx-player.x*ROADW,camY,camZ).y;
      curveX+=dx;dx+=seg.curve;
      drawables.push({p1,p2,seg,idx,n});
    }
    for(let k=0;k<drawables.length;k++){const {p1,p2,idx,n}=drawables[k];if(p2.y>=maxY||p1.y<=p2.y||p2.y>=H||p1.w>W*20)continue;
      const alternating=Math.floor(idx/3)%2,clip=maxY;
      ctx.save();ctx.beginPath();ctx.rect(0,0,W,clip);ctx.clip();
      ctx.fillStyle=map.grass[alternating];ctx.fillRect(0,p2.y,W,Math.max(1,p1.y-p2.y));
      quad(p1,p2,p1.w*1.18,p2.w*1.18,map.rumble[alternating]);quad(p1,p2,p1.w,p2.w,map.road[alternating]);
      if(Math.floor(idx/3)%2===0){for(let lane=-1;lane<=1;lane+=2){let a=p1.x+lane*p1.w/3,b=p2.x+lane*p2.w/3;poly(map.lane,a-p1.w*.009,p1.y,b-p2.w*.009,p2.y,b+p2.w*.009,p2.y,a+p1.w*.009,p1.y)}}
      if(idx<3){quad(p1,p2,p1.w,p2.w,'#ffffff');for(let stripe=-4;stripe<4;stripe++)if(stripe%2===0){poly('#202634',p1.x+p1.w*stripe/4,p1.y,p2.x+p2.w*stripe/4,p2.y,p2.x+p2.w*(stripe+1)/4,p2.y,p1.x+p1.w*(stripe+1)/4,p1.y)}}
      const inView=(z)=>Math.floor(pct(z/length)*road.length)===idx;
      if(n%18===0&&n>3){let size=clamp(p1.w/ROADW*750,0,4.2);drawDecor(p1.x-p1.w*1.5,p1.y,size,map.decor,idx);drawDecor(p1.x+p1.w*1.5,p1.y,size,map.decor,idx+1)}
      for(const box of boxes)if(inView(box.z))drawBox(p1.x+box.x*p1.w,p1.y,p1.scale);
      for(const pad of pads)if(inView(pad.z)){let a=p1.x+pad.x*p1.w,ww=p1.w*.18;poly('#46e7ff',a-ww,p1.y,a-ww*.4,p2.y,a+ww*.4,p2.y,a+ww,p1.y)}
      for(const hazard of hazards)if(inView(hazard.z)){let x=p1.x+hazard.x*p1.w,size=clamp(p1.w*.16,5,36);ctx.font=`${size}px serif`;ctx.textAlign='center';ctx.fillText(hazard.type==='gshell'?'🟢':hazard.type==='rshell'?'🔴':hazard.type==='oil'?'🛢️':'🍌',x,p1.y)}
      for(const bot of bots)if(inView(bot.z)&&bot.z>camZ&&bot.z<camZ+DRAW*SEG){let x=p1.x+bot.x*p1.w,sc=clamp(p1.w/ROADW*16,.12,2.1);kart(x,p1.y,sc,bot.char.color,bot.char.alt,icons[bot.char.id],0,bot.stun>0?Math.sin(renderTime*28)*.25:0);if(sc>.35){ctx.font=`800 ${clamp(sc*10,8,18)}px 'DM Sans'`;ctx.fillStyle='#fff';ctx.textAlign='center';ctx.fillText(bot.name,x,p1.y-sc*105)}}
      ctx.restore();maxY=Math.min(maxY,p2.y);
    }
  }
  function drawPlayer(){if(!player||state==='menu')return;let wobble=player.stun>0?Math.sin(renderTime*32)*.23:0;let speed=player.speed/MAXSP_BASE;
    if(player.boost>0&&state==='racing'){ctx.fillStyle='#faca32';for(let side of [-1,1]){poly('#ffa03d',W/2+side*34,H*.9,W/2+side*31,H*(.9+.09*Math.random()),W/2+side*23,H*.9)}}
    kart(W/2+player.slide*W*.055,H*.91,clamp(W/450,.78,1.7),CHARS[ui.char].color,CHARS[ui.char].alt,icons[CHARS[ui.char].id],Number(controls.right)-Number(controls.left),wobble);
    if(player.star>0){ctx.strokeStyle='#ffed78';ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(W/2,H*.80,Math.min(W*.12,95),Math.min(H*.13,100),0,0,7);ctx.stroke()}
    if(player.invuln>0&&Math.floor(renderTime*12)%2===0){ctx.fillStyle='#ffffff54';ctx.fillRect(W/2-40,H*.7,80,H*.2)}
    if(speed>1){ctx.strokeStyle='#ffffff65';ctx.lineWidth=3;for(let i=0;i<8;i++){let side=i<4?-1:1;let x=W/2+side*(90+(i%4)*60),y=H*(.3+i%4*.17);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+side*35,y+65);ctx.stroke()}}
  }
  function minimap(){if(state==='menu')return;let mw=90,mh=85,x=W-mw-18,y=H-mh-(touchMode?108:17);if(x<120||y<100)return;ctx.fillStyle='#142031b8';ctx.fillRect(x-6,y-5,mw+12,mh+12);ctx.strokeStyle='#e9f1fa88';ctx.lineWidth=2;ctx.beginPath();for(let i=0;i<=90;i++){let a=i/90*Math.PI*2,r=.65+.12*Math.sin(a*3+1)+.06*Math.sin(a*5);let px=x+mw/2+Math.cos(a)*r*mw*.51,py=y+mh/2+Math.sin(a)*r*mh*.51;i?ctx.lineTo(px,py):ctx.moveTo(px,py)}ctx.stroke();for(const b of bots){let a=pct(b.z/length)*Math.PI*2;ctx.fillStyle=b.char.color;ctx.beginPath();ctx.arc(x+mw/2+Math.cos(a)*mw*.35,y+mh/2+Math.sin(a)*mh*.35,3,0,7);ctx.fill()}let a=pct(player.z/length)*Math.PI*2;ctx.fillStyle='#ffdd49';ctx.beginPath();ctx.arc(x+mw/2+Math.cos(a)*mw*.35,y+mh/2+Math.sin(a)*mh*.35,5,0,7);ctx.fill()}
  function render(){renderTime=performance.now()/1000;ctx.clearRect(0,0,W,H);background();if(state!=='menu'){drawRoad();for(const p of particles){ctx.fillStyle=p.color;ctx.globalAlpha=clamp(p.life,0,1);ctx.fillRect(p.x,p.y,p.size,p.size)}ctx.globalAlpha=1;drawPlayer();minimap()}else{ctx.fillStyle=map.road[0];poly(map.road[0],W*.39,H*.63,W*.61,H*.63,W*1.05,H,W*-.05,H);kart(W/2,H*.88,clamp(W/470,.9,2),CHARS[ui.char].color,CHARS[ui.char].alt,icons[CHARS[ui.char].id])}}
  function frame(now){let dt=Math.min((now-lastFrame)/1000||0,.08);lastFrame=now;accum+=dt;let loops=0;while(accum>=1/60&&loops++<5){update(1/60);accum-=1/60}if(loops>=5)accum=0;render();requestAnimationFrame(frame)}requestAnimationFrame(frame);
  function key(e,on){let key=e.code;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','ShiftLeft','ShiftRight'].includes(key))e.preventDefault();if(state==='menu'&&on&&key==='Enter'){reset();return}if((key==='Escape'||key==='KeyP')&&on){setPause(state==='racing');return}if(key==='KeyM'&&on){$('sound').click();return}if(key==='Space'&&on&&!e.repeat){useItem();return}const lookup={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ArrowUp:'gas',KeyW:'gas',ArrowDown:'brake',KeyS:'brake',ShiftLeft:'drift',ShiftRight:'drift'};if(lookup[key])controls[lookup[key]]=on}
  addEventListener('keydown',e=>key(e,true));addEventListener('keyup',e=>key(e,false));addEventListener('blur',()=>{controls={left:false,right:false,gas:false,brake:false,drift:false};if(state==='racing')setPause(true)});
  const touch=('ontouchstart'in window)||navigator.maxTouchPoints>0||matchMedia('(pointer:coarse)').matches;touchMode=touch;
  document.querySelectorAll('#touch button').forEach(button=>{let action=button.dataset.control;const down=e=>{e.preventDefault();button.setPointerCapture?.(e.pointerId);button.classList.add('pressed');if(action==='item')useItem();else controls[action]=true};const up=e=>{e.preventDefault();button.classList.remove('pressed');if(action!=='item')controls[action]=false};button.addEventListener('pointerdown',down);button.addEventListener('pointerup',up);button.addEventListener('pointercancel',up);button.addEventListener('lostpointercapture',up)});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='racing')setPause(true)});
  // Exposed only for non-invasive smoke tests.
  window.KartRush={getState:()=>({state,lap:player?.lastLap||0,place:player?.place||0,speed:player?.speed||0,item:player?.item||null,trackLength:length,bots:bots.length,map:map.id}),start:reset,back:backToMenu};
})();
