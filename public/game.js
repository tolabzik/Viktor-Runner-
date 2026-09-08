(() => {
'use strict';
/* VIKTOR RUNNER 2.0: Canvas engine, shared records and original office characters. */
const W = 1280, H = 720, FLOOR = 588, GRAVITY = 1780, CHUNK = 1120, SECTOR = 4480;
const $ = id => document.getElementById(id);
const canvas = $('game'), ctx = canvas.getContext('2d', {alpha:false});
const assets = {}, input = {left:false,right:false,down:false,jump:false,fire:false};
const held = new Set();
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const lerp = (a,b,t) => a+(b-a)*t;
const overlap = (a,b) => a.x<b.x+b.w && a.x+a.w>b.x && a.y<b.y+b.h && a.y+a.h>b.y;
const mod = (n,m) => ((n%m)+m)%m;
const TAU = Math.PI*2;
let seed = 1;
function random(){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;}
const rnd = (a,b) => a+random()*(b-a);
const choose = xs => xs[Math.floor(random()*xs.length)];
function hash(n){let s=Math.sin(n*127.1+311.7)*43758.5453;return s-Math.floor(s);}
function readStore(key,fallback){try{return localStorage.getItem(key)??fallback;}catch{return fallback;}}
function writeStore(key,value){try{localStorage.setItem(key,String(value));}catch{/* File/private mode can disable persistence. */}}
let best = Number(readStore('vikor.best','0')) || 0;
let state = 'loading', beforeHelp='menu', game=null, camera=0, visualTime=0, accumulator=0, lastTime=0;
let shake=0, flash=0, toastUntil=0, hudClock=0, bgCache=new Map();
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse=matchMedia('(pointer: coarse)').matches;
const THEMES = [
 {name:'ОПЕНСПЕЙС',tag:'ПИСЬМА САМИ СЕБЯ НЕ ПРОЧИТАЮТ',sky1:'#294353',sky2:'#ddba92',wall:'#283640',trim:'#789b9b',accent:'#d2f56a',floor:'#35434a',kind:'office'},
 {name:'СЕРВЕРНАЯ',tag:'НЕ ТРОГАЙ. ЭТО ПРОД.',sky1:'#1e203d',sky2:'#63558b',wall:'#232737',trim:'#665c97',accent:'#b59bff',floor:'#303340',kind:'server'},
 {name:'АРХИВ',tag:'НУЖНЫЙ ДОКУМЕНТ В САМОМ НИЗУ',sky1:'#443733',sky2:'#e1ba7d',wall:'#3a3432',trim:'#a48d6b',accent:'#ffd479',floor:'#47413a',kind:'archive'},
 {name:'ПЕРЕГОВОРНАЯ',tag:'ЭТО МОГЛО БЫ БЫТЬ ПИСЬМОМ',sky1:'#213e53',sky2:'#90b9c7',wall:'#293a45',trim:'#719aaf',accent:'#7bdaef',floor:'#364751',kind:'meeting'},
 {name:'КРЫША',tag:'ДО СВОБОДЫ ОДИН ПРЫЖОК',sky1:'#24213e',sky2:'#ac7393',wall:'#30303e',trim:'#84748c',accent:'#f5a0cf',floor:'#393744',kind:'roof'}
];
const WEAPONS = [
 {name:'ПИСТОЛЕТ',rate:.24,speed:1000,damage:1,color:'#fce491'},
 {name:'АВТОМАТ',rate:.085,speed:1250,damage:1,color:'#d2f56a'},
 {name:'ДРОБОВИК',rate:.58,speed:890,damage:1,color:'#89ddf5'},
 {name:'РАКЕТНИЦА',rate:.9,speed:650,damage:6,color:'#ffac7a'}
];

/* Sound is generated locally. No audio files, autoplay, or external requests. */
const sound = {
 ctx:null,master:null,on:readStore('vikor.sound','1')==='1',beat:0,nextBeat:0,
 init(){try{if(!this.ctx){this.ctx=new (window.AudioContext||window.webkitAudioContext)();this.master=this.ctx.createGain();this.master.gain.value=this.on?.18:0;this.master.connect(this.ctx.destination);}if(this.ctx.state==='suspended')this.ctx.resume().catch(()=>{});}catch{this.on=false;}this.updateIcon();},
 updateIcon(){const p=this.on?'M11 5 6 9H3v6h3l5 4V5m5 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14':'M11 5 6 9H3v6h3l5 4V5m5 4 5 6m0-6-5 6';$('soundIcon').innerHTML=`<path d="${p}"/>`;$('soundButton').title=`Звук: ${this.on?'включён':'выключен'} (M)`;$('soundButton').setAttribute('aria-label',this.on?'Выключить звук':'Включить звук');$('pauseSoundButton').textContent=this.on?'Звук: включён':'Звук: выключен';},
 toggle(){this.on=!this.on;this.init();if(this.master)this.master.gain.setTargetAtTime(this.on?.18:0,this.ctx.currentTime,.05);writeStore('vikor.sound',this.on?'1':'0');this.updateIcon();},
 tone(freq,duration=.09,type='square',vol=.15,end=null,delay=0){if(!this.on||!this.ctx)return;try{const t=this.ctx.currentTime+delay,o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);if(end)o.frequency.exponentialRampToValueAtTime(Math.max(20,end),t+duration);g.gain.setValueAtTime(.001,t);g.gain.linearRampToValueAtTime(vol,t+.007);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g);g.connect(this.master);o.start(t);o.stop(t+duration+.02);}catch{}},
 fx(name){if(!this.on)return;switch(name){case'jump':this.tone(230,.15,'square',.19,660);break;case'coin':this.tone(1046,.07,'sine',.3);this.tone(1568,.14,'sine',.24,null,.055);break;case'shoot':this.tone(160,.07,'sawtooth',.14,45);break;case'auto':this.tone(220,.04,'square',.10,80);break;case'shotgun':this.tone(95,.13,'sawtooth',.25,30);break;case'rocket':this.tone(220,.22,'sawtooth',.24,35);break;case'boom':this.tone(65,.28,'sawtooth',.38,22);this.tone(103,.17,'triangle',.28,30);break;case'hit':this.tone(170,.2,'sawtooth',.32,42);break;case'stomp':this.tone(110,.09,'square',.27,360);break;case'power':[440,554,659,880].forEach((f,i)=>this.tone(f,.13,'square',.17,null,i*.075));break;case'block':this.tone(300,.06,'triangle',.24,180);break;case'empty':this.tone(160,.035,'triangle',.14);break;case'over':[440,392,330,220].forEach((f,i)=>this.tone(f,.3,'triangle',.23,null,i*.17));break;}},
 tick(){if(!this.ctx||!this.on||state!=='playing')return;const now=this.ctx.currentTime;if(this.nextBeat<now-.5)this.nextBeat=now;if(now>=this.nextBeat){const melody=[330,0,494,0,440,392,330,0,294,0,392,0,440,494,392,0,262,0,330,392,440,0,392,0,294,0,370,0,494,440,392,0];const i=this.beat%32;if(melody[i])this.tone(melody[i],.105,'triangle',.072);if(i%4===0)this.tone([82.4,73.4,65.4,73.4][Math.floor(i/8)],.19,'triangle',.11);if(i%4===2)this.tone(900,.024,'square',.015,180);this.nextBeat=now+.175;this.beat++;}}
};

function notify(title,subtitle='',seconds=2.4){$('toastTitle').textContent=title;$('toastSubtitle').textContent=subtitle;$('toast').classList.add('show');toastUntil=visualTime+seconds;}
function syncScreens(){for(const [id,s] of [['menu','menu'],['pauseScreen','paused'],['overScreen','over'],['helpScreen','help']])$(id).hidden=state!==s;const play=state==='playing'||state==='paused';$('hud').hidden=!play;$('weapons').hidden=!play;$('touchControls').hidden=state!=='playing';$('officeJoke').hidden=state!=='playing';if(state!=='playing'){$('tutorial').hidden=true;$('effect').hidden=true;}if(state==='menu')$('menuBest').textContent=`${best.toLocaleString('ru-RU')} м`;}
function clearInput(){held.clear();pointerHolds.clear();Object.keys(input).forEach(k=>input[k]=false);document.querySelectorAll('.touch-button').forEach(b=>b.classList.remove('pressed'));}
let starting=false;
async function startGame(){
 if(starting||!['menu','over'].includes(state)||RunnerOnline.isOpen())return;
 starting=true;sound.init();$('startButton').disabled=true;$('retryButton').disabled=true;
 try{const ticket=await RunnerOnline.begin();if(!ticket?.invalid)resetGame(ticket);}finally{starting=false;$('startButton').disabled=false;$('retryButton').disabled=false;}
}
function resetGame(ticket=null){
 if(state==='loading')return;
 sound.init();sound.nextBeat=0;clearInput();seed=ticket?.seed||(Date.now()^Math.floor(performance.now()*10000))>>>0||1;
 game={seed,ticket,sidejobs:0,bonuses:0,puddles:[],nextJoke:11,lastJoke:-1,jokeUntil:0,elapsed:0,dist:0,coins:0,kills:0,score:0,combo:0,comboTime:0,generated:0,chunk:0,grounds:[],solids:[],blocks:[],pickups:[],enemies:[],bullets:[],enemyBullets:[],particles:[],texts:[],decor:[],pulses:[],speed:230,sector:0,lastMilestone:0,reason:'',shots:0,
 player:{x:145,y:FLOOR-118,w:38,h:118,vy:0,vx:230,hp:3,form:1,formTime:0,coffee:0,inv:1,onGround:true,coyote:.11,buffer:0,jumpHold:0,fireTime:0,weapon:0,ammo:[Infinity,90,18,5],phase:0,duck:false,muzzle:0,angle:0,recoil:0,prevY:FLOOR-118}};
 $('officeJoke').classList.remove('visible');camera=0;shake=0;flash=0;accumulator=0;state='playing';generateAhead();syncScreens();updateHUD();$('tutorial').hidden=false;$('tutorial').innerHTML=coarse?'Виктор бежит сам. <kbd>↑</kbd> — прыжок · <kbd>◎</kbd> — огонь':'Виктор бежит сам. <kbd>ПРОБЕЛ</kbd> — прыжок · <kbd>X / J</kbd> — огонь';$('toast').classList.remove('show');
}
function backToMenu(){state='menu';clearInput();game=null;camera=0;syncScreens();$('toast').classList.remove('show');}
function pauseGame(){if(state==='playing'){state='paused';clearInput();syncScreens();}else if(state==='paused'){state='playing';syncScreens();}}
function endGame(reason){if(state!=='playing')return;state='over';clearInput();game.reason=reason;const d=game.dist,isBest=d>best;if(isBest){best=d;writeStore('vikor.best',best);}$('finalDistance').textContent=d.toLocaleString('ru-RU');$('finalCoins').textContent=game.coins;$('finalKills').textContent=game.kills;$('newRecord').hidden=!isBest;$('overReason').textContent=reason+' Завтра точно уйдёшь вовремя.';sound.fx('over');syncScreens();$('toast').classList.remove('show');RunnerOnline.finish(game);}
function openHelp(){if(state==='loading')return;beforeHelp=state;state='help';clearInput();syncScreens();}
function closeHelp(){state=beforeHelp==='playing'?'playing':beforeHelp;syncScreens();}

/* Seeded, bounded procedural chunks. Every route has ground or a jumpable gap. */
function ground(x,w){game.grounds.push({x,y:FLOOR,w,h:H-FLOOR+160});}
function solid(type,x,w,h,top=FLOOR-h,extra={}){const o={type,x,y:top,w,h,baseY:top,...extra};game.solids.push(o);return o;}
function block(type,x,y,content='coin'){game.blocks.push({type,x,y,w:46,h:46,content,used:false,bump:0,dead:false,hp:type==='paper'?1:999});}
function pickup(type,x,y,extra={}){game.pickups.push({type,x,y,w:type==='coin'?24:34,h:type==='coin'?24:34,phase:rnd(0,TAU),dead:false,...extra});}
function coinLine(x,y,n=5,step=39){for(let i=0;i<n;i++)pickup('coin',x+i*step,y-Math.sin(i/(Math.max(1,n-1))*Math.PI)*18);}
function coinArc(x,y,n=7,step=38){for(let i=0;i<n;i++)pickup('coin',x+i*step,y-Math.sin(i/(Math.max(1,n-1))*Math.PI)*70);}
function enemy(type,x,y=FLOOR){const specs={bot:[46,44,1],printer:[65,61,3],drone:[53,41,2],...Office.specs};const [w,h,hp]=specs[type];game.enemies.push({type,x,y:y-h,w,h,hp,maxhp:hp,origin:x,baseY:y-h,vx:-rnd(25,50),phase:rnd(0,TAU),timer:rnd(1.7,3.7),hurt:0,dead:false});}
function sign(x,text,kind='normal',y=FLOOR){game.decor.push({type:'sign',x,y,w:140,h:72,text,kind});}
function generateAhead(){while(game.generated<game.player.x+W*2.5){generateChunk(game.generated,game.chunk++);game.generated+=CHUNK;}}
function generateChunk(x,index){
 const difficulty=Math.min(1,index/30);
 let type=index===0?-1:index===1?0:index===2?1:index===3?2:Math.floor(random()*8);
 if(type===1){const gap=120+difficulty*35;ground(x,580);ground(x+580+gap,CHUNK-580-gap);}else ground(x,CHUNK);
 if(type===-1){coinLine(x+360,FLOOR-85,4);solid('desk',x+610,132,68);coinArc(x+550,FLOOR-132,6,39);block('bonus',x+870,FLOOR-230,'grow');coinLine(x+884,FLOOR-84,3);enemy('bot',x+1050);sign(x+430,'ПРОБЕЛ = ПРЫЖОК','lime');Office.populate(game,x,index);return;}
 const base=x+170;
 switch(type){
 case 0: solid('desk',base+65,138,68);solid('copier',base+420,82,93);coinArc(base+20,FLOOR-125,6);coinLine(base+400,FLOOR-162,4);block('bonus',base+725,FLOOR-230,choose(['ammo','coffee','coin']));enemy('bot',base+655);break;
 case 1: solid('desk',base+50,125,64);coinArc(x+465,FLOOR-145,8,40);sign(x+370,'ОСТОРОЖНО, РЕМОНТ','danger');pickup('ammo',x+920,FLOOR-62);enemy('bot',x+990);break;
 case 2: solid('desk',base,135,68);solid('platform',base+190,155,18,FLOOR-132,{oneWay:true});solid('platform',base+420,150,18,FLOOR-188,{oneWay:true});coinLine(base+200,FLOOR-190,4);coinLine(base+429,FLOOR-245,4);pickup('coffee',base+485,FLOOR-239);enemy('printer',base+690);block('bonus',base+815,FLOOR-230,'ammo');break;
 case 3: for(let i=0;i<3;i++)block('paper',base+250+i*48,FLOOR-193);block('bonus',base+250+48,FLOOR-241,choose(['grow','heart','ammo']));enemy('printer',base+50);enemy('bot',base+740);coinLine(base+110,FLOOR-85,4);solid('copier',base+545,84,85);coinLine(base+536,FLOOR-150,3);break;
 case 4: solid('platform',base+185,260,34,FLOOR-235,{oneWay:false});solid('desk',base-15,116,61);coinLine(base+210,FLOOR-291,5);enemy('drone',base+650,FLOOR-166);pickup(choose(['grow','ammo']),base+500,FLOOR-64);coinLine(base+630,FLOOR-86,6);break;
 case 5: pickup('shrink',base+5,FLOOR-50);sign(base+95,'S / ↓ = ПРИСЕСТЬ','violet');solid('duct',base+330,300,125,FLOOR-210);coinLine(base+355,FLOOR-44,7,34);pickup('heart',base+795,FLOOR-54);enemy('bot',base+915);break;
 case 6: solid('spring',base+55,70,20);coinArc(base+135,FLOOR-280,8,42);solid('platform',base+320,185,18,FLOOR-175,{oneWay:true,moving:true,phase:rnd(0,TAU)});pickup('grow',base+400,FLOOR-237);enemy('drone',base+620,FLOOR-175);solid('desk',base+825,136,68);break;
 case 7: enemy('bot',base+55);enemy('printer',base+380);enemy('drone',base+780,FLOOR-152);pickup('ammo',base+200,FLOOR-65);coinLine(base+530,FLOOR-95,6);block('bonus',base+640,FLOOR-230,choose(['grow','coffee','heart']));break;
 }
 // Supplies are generous enough that all four weapons remain useful in a long run.
 if(index%3===0)pickup('ammo',x+1030,FLOOR-73);
 if(index%5===0)pickup('heart',x+80,FLOOR-72);
 if(index%4===0)sign(x+50,THEMES[Math.floor(x/SECTOR)%5].name);Office.populate(game,x,index);
}

function resizePlayer(form,duck=false){
 const p=game.player,oldBottom=p.y+p.h,newW=38*form,desired=(duck?72:118)*form;
 const proposed={x:p.x+(p.w-newW)/2,y:oldBottom-desired,w:newW,h:desired};
 if(desired>p.h||newW>p.w){
  const obstacles=game.solids.concat(game.blocks).filter(s=>!s.dead&&!s.oneWay&&s.type!=='spring');
  // Growing next to a desk nudges Viktor aside instead of trapping him inside it.
  for(const s of obstacles){if(!overlap(proposed,s)||oldBottom<=s.y+.1)continue;
   if(p.x+p.w<=s.x+.15)proposed.x=s.x-newW-.2;
   else if(p.x>=s.x+s.w-.15)proposed.x=s.x+s.w+.2;
   else return false;
  }
  if(obstacles.some(s=>overlap(proposed,s)&&oldBottom>s.y+.1))return false;
 }
 p.x=proposed.x;p.form=form;p.h=desired;p.w=newW;p.y=proposed.y;p.duck=duck;return true;
}
function queueJump(){if(state!=='playing')return;game.player.buffer=.14;input.jump=true;}
function jump(){const p=game.player;p.vy=-690*(p.form<1?1.07:1);p.onGround=false;p.coyote=0;p.buffer=0;p.jumpHold=.2;emit(p.x+p.w/2,p.y+p.h,7,'#c3c8b1',70,'dust');sound.fx('jump');}
function selectWeapon(i){if(!game||state!=='playing')return;i=mod(i,4);game.player.weapon=i;game.player.fireTime=Math.min(game.player.fireTime,.12);updateHUD();}
function shoot(){
 const p=game.player,wi=p.weapon,w=WEAPONS[wi];if(p.ammo[wi]<=0){sound.fx('empty');p.weapon=0;notify('ПАТРОНЫ КОНЧИЛИСЬ','Пистолет всегда с тобой',1.5);p.fireTime=.2;updateHUD();return;}
 if(wi>0)p.ammo[wi]--;
 const sx=p.x+p.w+15*p.form,sy=p.y+p.h*(p.duck?.43:.44);
 let angle=0,nearest=Infinity;
 for(const e of game.enemies){if(e.dead)continue;const dx=e.x+e.w/2-sx,dy=e.y+e.h/2-sy;if(dx>0&&dx<650&&Math.abs(dy)<240&&dx<nearest){nearest=dx;angle=Math.atan2(dy,dx);}}
 if(mouse.active&&input.fire){angle=Math.atan2(mouse.y-sy,mouse.x+camera-sx);angle=clamp(angle,-1.15,1.15);}
 p.angle=angle;p.muzzle=.055;p.recoil=1;p.fireTime=w.rate;game.shots++;
 const n=wi===2?6:1;
 for(let i=0;i<n;i++){const a=angle+(wi===2?(i-2.5)*.06:wi===1?rnd(-.025,.025):0);game.bullets.push({x:sx,y:sy,px:sx,py:sy,vx:Math.cos(a)*w.speed,vy:Math.sin(a)*w.speed,w:wi===3?17:10,h:wi===3?9:4,life:1.5,damage:w.damage,weapon:wi,color:w.color,dead:false});}
 sound.fx(['shoot','auto','shotgun','rocket'][wi]);
 if(wi===2)shake=Math.max(shake,2);if(wi===3)shake=Math.max(shake,4);
 if(wi!==3)emit(sx-20,sy,1,'#dcb972',70,'shell');
}
function takeDamage(reason='Офис победил.',fall=false){
 const p=game.player;if(state!=='playing'||(!fall&&(p.inv>0||p.coffee>0)))return;
 if(p.form>1&&!fall){resizePlayer(1,p.duck);p.formTime=0;notify('ПРЕМИЯ СГОРЕЛА','Большой Виктор выдержал удар',1.8);}else{p.hp--;if(!fall){resizePlayer(.7,p.duck);p.formTime=6;}if(p.hp<=0){emit(p.x+p.w/2,p.y+p.h/2,32,'#d2f56a',220,'paper');endGame(reason);return;}}
 p.inv=2;flash=.18;shake=9;sound.fx('hit');emit(p.x+p.w/2,p.y+p.h*.5,12,'#f59988',110,'spark');updateHUD();
}
function killEnemy(e,stomp=false){if(e.dead)return;e.dead=true;game.kills++;game.combo++;game.comboTime=2;game.score+=100;sound.fx(stomp?'stomp':'boom');emit(e.x+e.w/2,e.y+e.h/2,16,e.type==='printer'?'#dbdeda':'#f5829e',170,'paper');floatText(e.x+e.w/2,e.y-10,game.combo>1?`КОМБО ×${game.combo} · +100`:'+100','#d2f56a');if(random()<.28)pickup('coin',e.x+e.w/2,e.y-20,{vy:-160,falling:true});if(e.type==='printer'&&random()<.25)pickup('ammo',e.x+e.w/2,e.y);}
function explode(x,y,damage=6){emit(x,y,28,'#ffc36d',270,'spark');game.pulses.push({x,y,r:5,life:.35,max:.35});shake=Math.max(shake,8);sound.fx('boom');for(const e of game.enemies){if(!e.dead&&Math.hypot(e.x+e.w/2-x,e.y+e.h/2-y)<140){e.hp-=damage;if(e.hp<=0)killEnemy(e);else e.hurt=.12;}}for(const b of game.blocks){if(b.type==='paper'&&!b.dead&&Math.hypot(b.x+23-x,b.y+23-y)<130)breakBlock(b);} }
function breakBlock(b){if(b.dead)return;b.dead=true;emit(b.x+23,b.y+23,12,'#c6ac7c',180,'paper');floatText(b.x+23,b.y,'АРХИВ СПИСАН','#ede2c5');sound.fx('block');}
function hitBlock(b){if(b.dead)return;b.bump=.18;sound.fx('block');if(b.type==='paper'){if(game.player.form>1){breakBlock(b);}else{emit(b.x+23,b.y+43,4,'#c9b486',60,'dust');}return;}if(!b.used){b.used=true;if(b.content==='coin'){game.coins+=5;game.score+=125;floatText(b.x+23,b.y-12,'+5 МОНЕТ','#ffdc80');emit(b.x+23,b.y,12,'#ffdc80',150,'spark');sound.fx('coin');checkCoinLife();}else{pickup(b.content,b.x+23,b.y-24,{vy:-210,falling:true});}}}
function checkCoinLife(){game.nextLifeCoins??=100;while(game.coins>=game.nextLifeCoins){game.nextLifeCoins+=100;game.player.hp=Math.min(3,game.player.hp+1);notify('100 МОНЕТ — +1 ЗДОРОВЬЕ','Корпоративная страховка сработала');sound.fx('power');}}
function collect(item){item.dead=true;const p=game.player;const x=item.x,y=item.y;
 if(item.type==='coin'){game.coins++;game.score+=25;sound.fx('coin');emit(x,y,5,'#fbdc80',90,'spark');checkCoinLife();return;}
 sound.fx('power');emit(x,y,16,item.type==='shrink'?'#be9cff':'#d2f56a',140,'spark');
 switch(item.type){case'sidejob':game.sidejobs++;game.score+=500;p.ammo[1]+=30;notify('ШАБАШКА ЗАКРЫТА','+500 очков · +30 патронов к автомату');floatText(x,y,'+500 · ШАБАШКА','#ffd07a');break;case'grow':game.bonuses++;game.score+=1000;if(resizePlayer(1.42,p.duck)){p.formTime=20;}else{p.formTime=20;p.pendingGrow=true;}notify('ВИКТОР ПОЛУЧИЛ ПРЕМИЮ','+1000 очков · 20 секунд: рост, защита и разбивание коробок');floatText(x,y,'ПОВЫШЕНИЕ ↑','#d2f56a');break;
 case'shrink':resizePlayer(.62,p.duck);p.formTime=10;p.pendingGrow=false;notify('РЕЖИМ «МЕНЯ ЗДЕСЬ НЕТ»','10 секунд: маленький Виктор проходит под препятствиями');break;
 case'coffee':p.coffee=8;notify('КОФЕЙНЫЙ РАЖ','8 секунд: неуязвимость и повышенная скорость');break;
 case'heart':p.hp=Math.min(3,p.hp+1);floatText(x,y,'+ ЗДОРОВЬЕ','#ffafac');break;
 case'ammo':p.ammo[1]+=60;p.ammo[2]+=10;p.ammo[3]+=3;floatText(x,y,'БОЕЗАПАС +','#a5e1f2');notify('КАНЦЕЛЯРИЯ ДОСТАВЛЕНА','+60 автомат · +10 дробовик · +3 ракеты',1.7);break;}
 updateHUD();
}
function emit(x,y,count,color,speed=120,type='spark'){if(!game)return;for(let i=0;i<count;i++){const a=rnd(0,TAU),s=rnd(speed*.25,speed);game.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-speed*.25,life:rnd(.25,.65),max:.65,color,size:rnd(2,5),rotation:rnd(0,TAU),type});}if(game.particles.length>260)game.particles.splice(0,game.particles.length-260);}
function floatText(x,y,text,color='#fff'){game.texts.push({x,y,text,color,life:1,max:1});}

function update(dt){
 const g=game,p=g.player;g.elapsed+=dt;Office.tick(g,dt);g.speed=230+Math.min(135,g.dist*.045);p.prevY=p.y;
 p.inv=Math.max(0,p.inv-dt);p.coffee=Math.max(0,p.coffee-dt);p.fireTime-=dt;p.muzzle=Math.max(0,p.muzzle-dt);p.recoil=Math.max(0,p.recoil-dt*12);p.buffer-=dt;p.coyote-=dt;p.jumpHold-=dt;
 if(p.formTime>0){p.formTime-=dt;if(p.formTime<=0){if(!resizePlayer(1,input.down)){p.formTime=.25;}}}
 if(p.pendingGrow&&resizePlayer(1.42,input.down)){p.pendingGrow=false;p.formTime=20;}
 resizePlayer(p.form,input.down);
 const speed=g.speed*(p.coffee>0?1.16:1)*(input.left?.36:input.right?1.3:1)*(p.duck?.78:1)*(p.slow>0?.63:1);
 p.vx=lerp(p.vx,speed,Math.min(1,dt*9));p.phase+=dt*p.vx*.055;
 if(p.buffer>0&&p.coyote>0)jump();
 if(input.jump&&p.jumpHold>0&&p.vy<0)p.vy-=dt*640;
 if(!input.jump&&p.vy<-255)p.vy+=dt*2500;
 p.vy=Math.min(1000,p.vy+GRAVITY*dt);
 const collisions=g.solids.concat(g.blocks.filter(b=>!b.dead));
 for(const s of g.solids){if(s.moving){s.prevY=s.y;s.y=s.baseY+Math.sin(g.elapsed*1.25+s.phase)*28;}}
 // Horizontal collision ignores one-way ledges and spring pads.
 p.x+=p.vx*dt;
 for(const s of collisions){if(s.dead||s.oneWay||s.type==='spring')continue;if(overlap(p,s)){if(s.type==='paper'&&p.form>1){breakBlock(s);continue;}if(p.vx>=0){p.x=s.x-p.w-.05;p.vx=0;}else p.x=s.x+s.w+.05;}}
 const oldBottom=p.y+p.h,oldTop=p.y;p.y+=p.vy*dt;p.onGround=false;
 for(const s of g.grounds.concat(collisions)){
 if(s.dead||p.x+p.w<=s.x||p.x>=s.x+s.w)continue;
 if(p.vy>=0&&oldBottom<=s.y+Math.max(4,(s.prevY??s.y)-s.y+2)&&p.y+p.h>=s.y){
 p.y=s.y-p.h;p.vy=0;p.onGround=true;p.coyote=.11;
 if(s.type==='spring'){p.vy=-1000;p.onGround=false;p.coyote=0;p.jumpHold=.08;s.bounce=.25;sound.fx('jump');emit(p.x+p.w/2,s.y,10,'#d2f56a',160,'spark');}
 }else if(!s.oneWay&&p.vy<0&&oldTop>=s.y+s.h-2&&p.y<s.y+s.h){p.y=s.y+s.h+.1;p.vy=30;if(s.type==='bonus'||s.type==='paper')hitBlock(s);}
 }
 if(p.onGround&&p.buffer>0)jump();
 if(p.onGround&&p.vx>30&&Math.sin(p.phase)>0.97&&random()<.5)emit(p.x+p.w/2,FLOOR,1,'#b5c2bc',35,'dust');
 if(input.fire&&p.fireTime<=0)shoot();
 if(p.y>H+160){takeDamage('Виктор ушёл этажом ниже.',true);if(state!=='playing')return;let safe=g.grounds.find(s=>s.x+s.w>p.x+150&&s.x<p.x+1000);if(!safe){generateAhead();safe=g.grounds[g.grounds.length-1];}p.x=Math.max(p.x+55,safe.x+55);p.y=FLOOR-p.h-8;p.vy=0;p.inv=2.5;camera=Math.max(0,p.x-285);}
 g.dist=Math.max(g.dist,Math.floor((p.x-145)/10));
 camera=lerp(camera,Math.max(0,p.x-280),Math.min(1,dt*6));p.x=Math.max(p.x,camera+20);
 const sector=Math.floor(p.x/SECTOR);if(sector!==g.sector){g.sector=sector;notify(THEMES[sector%5].name,THEMES[sector%5].tag,2.8);sound.fx('power');}
 const milestone=Math.floor(g.dist/1000);if(milestone>g.lastMilestone){g.lastMilestone=milestone;notify(`${milestone} КМ БЕЗ ПЕРЕРЫВА`,'Отдел кадров обеспокоен. Так держать.');p.hp=Math.min(3,p.hp+1);}
 generateAhead();
 for(const b of g.blocks)b.bump=Math.max(0,b.bump-dt);
 for(const s of g.solids)if(s.bounce)s.bounce=Math.max(0,s.bounce-dt);
 for(const i of g.pickups){if(i.dead)continue;if(i.falling){i.vy+=GRAVITY*.48*dt;i.y+=i.vy*dt;let land=FLOOR-23;for(const s of collisions)if(!s.dead&&i.x>=s.x-15&&i.x<=s.x+s.w+15&&s.y>i.y-18&&s.y<land)land=s.y-21;if(i.y>=land){i.y=land;i.vy=0;i.falling=false;}}if(overlap(p,{x:i.x-i.w/2,y:i.y-i.h/2,w:i.w,h:i.h}))collect(i);}
 for(const e of g.enemies){
 if(e.dead||e.x>camera+W+140)continue;e.hurt=Math.max(0,e.hurt-dt);e.phase+=dt;
 if(e.type==='drone'){e.y=e.baseY+Math.sin(e.phase*2)*26;e.x+=Math.sin(e.phase*.7)*dt*30;}else{e.x+=e.vx*dt;if(Math.abs(e.x-e.origin)>55)e.vx*=-1;}
 e.timer-=dt;Office.tickEnemy(e,g,p,dt);if(e.type==='printer'&&e.timer<=0&&e.x>p.x+130&&e.x<p.x+680){const sy=e.y+26,dx=p.x-e.x,dy=p.y+p.h*.5-sy,angle=Math.atan2(dy,dx);g.enemyBullets.push({x:e.x,y:sy,w:16,h:9,vx:Math.cos(angle)*260,vy:Math.sin(angle)*260,life:4,rotation:0});e.timer=3.3;emit(e.x,sy,3,'#ffffff',60,'paper');}
 if(overlap(p,e)){
 if(p.coffee>0){killEnemy(e);continue;}
 if(p.vy>60&&p.prevY+p.h<=e.y+Math.min(23,e.h*.45)){e.hp-=p.form>1?4:3;if(e.hp<=0)killEnemy(e,true);else{e.hurt=.2;sound.fx('stomp');}p.y=e.y-p.h;p.vy=input.jump?-580:-420;p.coyote=0;p.onGround=false;emit(e.x+e.w/2,e.y,9,'#e2e5de',120,'spark');}
 else takeDamage(Office.reasons[e.type]||(e.type==='printer'?'Принтер объявил забастовку.':e.type==='drone'?'Проверка службы безопасности.':'Бот отправил Виктора на доработку.'));
 }
 }
 for(const b of g.bullets){if(b.dead)continue;b.px=b.x;b.py=b.y;b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;if(b.life<=0){b.dead=true;continue;}const hit={x:Math.min(b.x,b.px)-3,y:Math.min(b.y,b.py)-3,w:Math.abs(b.x-b.px)+b.w,h:Math.abs(b.y-b.py)+b.h};
 for(const e of g.enemies){if(e.dead||!overlap(hit,e))continue;b.dead=true;if(b.weapon===3){explode(b.x,b.y,b.damage);}else{e.hp-=b.damage;e.hurt=.13;emit(b.x,b.y,5,b.color,100,'spark');if(e.hp<=0)killEnemy(e);}break;}
 if(b.dead)continue;for(const o of g.blocks){if(o.dead||!overlap(hit,o))continue;if(o.type==='paper'){if(b.weapon===3)explode(b.x,b.y,b.damage);else breakBlock(o);b.dead=true;}else if(!o.used){hitBlock(o);b.dead=true;}else b.dead=true;break;}
 }
 for(const b of g.enemyBullets){b.x+=b.vx*dt;b.y+=b.vy*dt;b.rotation+=dt*5;b.life-=dt;if(overlap(p,b)){takeDamage(b.kind==='like'?'Виктор попал в воронку контент-маркетинга.':'Принтер засыпал Виктора бумагой.');b.life=0;}if(b.y>FLOOR||b.x<camera-40)b.life=0;}
 for(const q of g.particles){q.life-=dt;q.x+=q.vx*dt;q.y+=q.vy*dt;q.vy+=dt*(q.type==='dust'?60:500);q.rotation+=dt*6;}
 for(const t of g.texts){t.life-=dt;t.y-=dt*36;}
 for(const q of g.pulses){q.life-=dt;q.r+=dt*380;}
 g.comboTime-=dt;if(g.comboTime<=0)g.combo=0;
 const cutoff=camera-500;
 g.grounds=g.grounds.filter(o=>o.x+o.w>cutoff);g.solids=g.solids.filter(o=>o.x+o.w>cutoff);g.blocks=g.blocks.filter(o=>!o.dead&&o.x>cutoff);g.pickups=g.pickups.filter(o=>!o.dead&&o.x>cutoff);g.enemies=g.enemies.filter(o=>!o.dead&&o.x>cutoff);g.decor=g.decor.filter(o=>o.x+o.w>cutoff);g.bullets=g.bullets.filter(o=>!o.dead&&o.x<camera+W+300);g.enemyBullets=g.enemyBullets.filter(o=>o.life>0);g.particles=g.particles.filter(o=>o.life>0);g.texts=g.texts.filter(o=>o.life>0);g.pulses=g.pulses.filter(o=>o.life>0);
 shake=Math.max(0,shake-dt*28);flash=Math.max(0,flash-dt);
 hudClock-=dt;if(hudClock<=0){updateHUD();hudClock=.1;}sound.tick();
}
function updateHUD(){if(!game)return;const p=game.player;$('distance').textContent=String(game.dist).padStart(4,'0');$('coinCount').textContent=game.coins;$('liveScore').textContent=RunnerOnline.scoreFor(game).toLocaleString('ru-RU');$('formLabel').textContent=p.form>1?'ПОВЫШЕН':p.form<1?'НЕЗАМЕТЕН':'В НОРМЕ';$('health').setAttribute('aria-label',`Здоровье: ${p.hp} из 3`);[...$('health').children].forEach((n,i)=>n.classList.toggle('off',i>=p.hp));const theme=THEMES[game.sector%5];$('zoneName').textContent=theme.name;$('zoneSector').textContent=`СЕКТОР ${String(game.sector+1).padStart(2,'0')} / СМЕНА ИДЁТ`;$('zoneProgress').style.width=`${mod(game.player.x,SECTOR)/SECTOR*100}%`;document.querySelectorAll('.weapon').forEach((b,i)=>{b.classList.toggle('active',i===p.weapon);b.classList.toggle('empty',p.ammo[i]<=0);b.querySelector('b').textContent=i===0?'∞':p.ammo[i];b.setAttribute('aria-pressed',String(i===p.weapon));});let text='',remaining=0,total=1;if(p.coffee>0){text='КОФЕЙНЫЙ РАЖ';remaining=p.coffee;total=8;}else if(p.formTime>0){text=p.form>1?'ПОВЫШЕНИЕ ↑':'РЕЖИМ НЕВИДИМКИ';remaining=p.formTime;total=p.form>1?20:10;}$('effect').hidden=!text||state!=='playing';if(text){$('effectLabel').textContent=text;$('effectTime').textContent=Math.ceil(remaining)+'с';$('effectMeter').style.width=`${clamp(remaining/total,0,1)*100}%`;}if(game.elapsed>8)$('tutorial').hidden=true;}

/* Original office artwork, drawn as layered vector scenery. */
function rect(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(x,y,w,h);}
function round(x,y,w,h,r,color,stroke=null){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(color){ctx.fillStyle=color;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}}
function line(x1,y1,x2,y2,color,width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
function text(s,x,y,size=12,color='#fff',weight=500,align='left'){ctx.fillStyle=color;ctx.font=`${weight} ${size}px "Segoe UI",Arial,sans-serif`;ctx.textAlign=align;ctx.textBaseline='alphabetic';ctx.fillText(s,x,y);ctx.textAlign='left';}
function ellipse(x,y,rx,ry,color){ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,TAU);ctx.fill();}
function bolt(x,y,s,color){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x+s*.15,y-s);ctx.lineTo(x-s*.65,y+s*.12);ctx.lineTo(x-s*.07,y+s*.12);ctx.lineTo(x-s*.25,y+s);ctx.lineTo(x+s*.65,y-s*.2);ctx.lineTo(x+s*.1,y-s*.2);ctx.closePath();ctx.fill();}
function plant(x,y,s=1){ctx.save();ctx.translate(x,y);ctx.scale(s,s);round(-15,-34,30,34,4,'#987d62');rect(-18,-36,36,7,'#b49c7d');for(let i=0;i<7;i++){let a=(i-3)*.36;ctx.save();ctx.rotate(a);line(0,-30,0,-78-(i%3)*15,'#5d8270',2);ctx.fillStyle=i%2?'#779d76':'#516f61';ctx.beginPath();ctx.ellipse(i%2?8:-9,-65-(i%3)*12,9,24,a*.35,0,TAU);ctx.fill();ctx.restore();}ctx.restore();}
function backgroundDesk(x,y,accent,kind='office'){
 round(x,y,180,10,3,'#778486');rect(x+9,y+10,6,62,'#3c4d56');rect(x+163,y+10,6,62,'#3c4d56');round(x+105,y+12,52,57,3,'#4c5e65');for(let i=0;i<3;i++){line(x+107,y+30+i*16,x+155,y+30+i*16,'#2f4049');line(x+123,y+23+i*16,x+136,y+23+i*16,'#9aa3a1',2);}
 round(x+26,y-60,84,53,4,'#172830','#637c83');rect(x+31,y-55,74,42,'#24454c');rect(x+37,y-49,26,3,accent+'aa');for(let i=0;i<5;i++){rect(x+37,y-41+i*5,24+(i%3)*9,2,i%2?'#769287':'#5b888e');rect(x+82,y-47+i*7,15,3,accent+'44');}rect(x+63,y-7,8,8,'#465c65');round(x+51,y-2,35,3,1,'#9aaba8');round(x+124,y-16,13,16,2,'#ddceab');ctx.strokeStyle='#ddceab';ctx.lineWidth=3;ctx.beginPath();ctx.arc(x+139,y-9,5,-1.5,1.5);ctx.stroke();
 // Office chair in a deeper layer.
 round(x+183,y-7,40,47,8,'#23343e','#566974');rect(x+199,y+39,6,24,'#708187');line(x+202,y+61,x+178,y+67,'#728389',3);line(x+202,y+61,x+225,y+66,'#728389',3);ellipse(x+178,y+68,4,3,'#14202a');ellipse(x+225,y+68,4,3,'#14202a');
}
function drawBackground(theme,cam,t){
 const sky=ctx.createLinearGradient(0,65,0,FLOOR);sky.addColorStop(0,theme.sky1);sky.addColorStop(1,theme.sky2);ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
 // Far skyline is independent of the room layer for a restrained parallax effect.
 const far=cam*.075;
 for(let i=Math.floor(far/92)-1;i<Math.floor(far/92)+17;i++){const x=i*92-far,bh=70+hash(i+30)*160;rect(x,407-bh,68+hash(i+3)*22,bh,'#243746a9');rect(x+8,400-bh,53,bh,'#27374466');for(let row=0;row<Math.floor(bh/18)-1;row++)for(let col=0;col<4;col++)if(hash(i*113+row*7+col)>.45)rect(x+9+col*13,420-bh+row*17,5,7,hash(i+row+col)>.62?'#f8d4a666':'#b7ced436');}
 if(theme.kind==='roof'){for(let i=0;i<34;i++)ellipse(hash(i+70)*W,65+hash(i+35)*240,hash(i+80)+.3,hash(i+80)+.3,'#f5dff0a0');ellipse(1060-far*.1%800,128,27,27,'#d7becdbb');}
 const offset=mod(cam*.23,480);
 if(theme.kind!=='roof'){
 rect(0,0,W,87,'#15232e');rect(0,84,W,24,theme.wall);rect(0,104,W,5,theme.trim+'99');
 for(let i=-1;i<4;i++){
 const x=i*480-offset;
 rect(x+10,108,26,381,theme.wall);rect(x+440,108,43,381,theme.wall);
 if(theme.kind==='server'){
 rect(x+35,108,405,380,'#202633');
 for(let k=0;k<3;k++){const xx=x+49+k*127;round(xx,152,115,310,7,'#141c29','#56657b');round(xx+8,164,99,281,3,'#273445');for(let row=0;row<9;row++){round(xx+13,174+row*28,89,22,3,'#182430');rect(xx+20,181+row*28,49,3,'#465466');rect(xx+20,188+row*28,35,2,'#374559');ellipse(xx+84,185+row*28,2.2,2.2,row%3===0?'#b59bff':'#69d5c1');ellipse(xx+93,185+row*28,2,2,'#e1bd6f');}rect(xx+12,453,90,4,'#50576c');}text('INFRASTRUCTURE / 24:7',x+60,139,10,'#b8a2e6',500);line(x+46,470,x+424,470,'#7c5baf',2);
 }else if(theme.kind==='archive'){
 rect(x+36,107,405,382,'#3c3530');for(let row=0;row<3;row++){const yy=186+row*101;rect(x+58,yy,361,6,'#867052');for(let j=0;j<11;j++){const xx=x+65+j*31;const hh=56+hash(j+row*23+i*5)*25;round(xx,yy-hh,25,hh,2,['#7b8c80','#b0a078','#8a7b76','#718992'][mod(j+row,4)]);rect(xx+9,yy-hh+8,9,25,'#d8cfb2');ellipse(xx+13,yy-10,3,3,'#39433f');} }rect(x+54,129,7,356,'#7e6b50');rect(x+419,129,7,356,'#7e6b50');text('АРХИВ / НЕ УДАЛЯТЬ',x+125,126,11,'#ddceab',600);
 }else{
 // Transparent architectural glass over the skyline.
 rect(x+36,112,403,292,theme.kind==='meeting'?'#c5e6ec18':'#bed2d816');rect(x+39,115,397,5,'#bad0cd44');for(let j=0;j<3;j++){rect(x+37+j*135,111,5,298,theme.wall);rect(x+40+j*135,111,2,295,'#8aaba855');}rect(x+37,273,402,6,theme.wall);rect(x+33,405,410,14,'#6e8587');rect(x+36,418,406,68,theme.wall);line(x+39,431,x+435,431,'#90a29c22');
 ctx.fillStyle='#ebecd710';ctx.beginPath();ctx.moveTo(x+65,114);ctx.lineTo(x+115,114);ctx.lineTo(x+311,400);ctx.lineTo(x+260,400);ctx.fill();
 // Blinds, clock, wall notices.
 for(let j=0;j<4;j++)rect(x+42,121+j*7,389,2,'#23374344');
 }
 // Suspended ceiling light.
 line(x+212,8,x+212,55,'#889b9d70');round(x+115,54,194,11,4,'#698284');round(x+119,63,185,4,2,theme.accent+'b0');ctx.fillStyle=theme.accent+'06';ctx.beginPath();ctx.moveTo(x+120,70);ctx.lineTo(x+304,70);ctx.lineTo(x+360,388);ctx.lineTo(x+50,388);ctx.fill();
 }
 }else{
 for(let i=-1;i<5;i++){const x=i*340-mod(cam*.24,340);rect(x,465,340,58,'#393748');rect(x,462,340,7,'#8b7c92');for(let k=0;k<6;k++)rect(x+k*61,406,4,59,'#747184');line(x,409,x+340,409,'#9b8e9e',3);round(x+135,419,95,43,5,'#565668','#868497');for(let j=0;j<5;j++)line(x+145,429+j*6,x+220,429+j*6,'#353849',2);}
 }
 // The back of the floor and skirting give the office a proper sense of depth.
 rect(0,487,W,101,theme.floor);rect(0,485,W,7,'#111e2b99');line(0,494,W,494,'#b9c8be22');
 for(let y=505;y<FLOOR;y+=23)line(0,y,W,y,'#b0bdb311');
 for(let i=-1;i<15;i++){const x=i*110-mod(cam*.44,110);line(x,488,x-110,588,'#bdc9be12');}
 const furnishing=mod(cam*.4,650);
 for(let i=-1;i<3;i++){const x=i*650-furnishing;
 if(theme.kind==='office'){backgroundDesk(x+100,460,theme.accent);plant(x+435,519,.74);round(x+18,366,53,83,4,'#d4cbaa');rect(x+26,376,35,3,'#7c8c7e');for(let k=0;k<5;k++)rect(x+25,388+k*9,24+(k%2)*13,2,'#8f967e');}
 else if(theme.kind==='meeting'){backgroundDesk(x+95,463,theme.accent);round(x+389,315,130,92,4,'#bccbc8','#718c95');line(x+403,389,x+420,368,'#7ba59c',3);line(x+420,368,x+447,378,'#7ba59c',3);line(x+447,378,x+489,337,'#7ba59c',3);line(x+450,407,x+450,480,'#7e929b',4);line(x+420,482,x+480,482,'#7e929b',3);plant(x+565,519,.78);}
 else if(theme.kind==='server'){round(x+352,441,85,58,4,'#374558','#61758b');for(let j=0;j<3;j++)line(x+361,451+j*12,x+426,451+j*12,'#172b37',3);line(x+30,513,x+580,513,'#6c5aa7',3);line(x+80,522,x+425,522,'#436d81',2);}
 else if(theme.kind==='archive'){round(x+108,442,81,62,2,'#998465');rect(x+143,444,12,58,'#bfac84');round(x+194,461,63,43,2,'#b09a75');rect(x+219,463,10,38,'#d1bd91');plant(x+524,519,.7);}
 else{round(x+134,485,102,48,5,'#5e5b6e','#8d8299');for(let j=0;j<7;j++)line(x+144+j*12,492,x+144+j*12,525,'#363847',3);rect(x+442,430,18,105,'#656278');round(x+430,415,42,24,5,'#9b8ba0');}
 }
 // Subtle vignette, not a full-screen opacity layer over the hero.
 const vignette=ctx.createLinearGradient(0,0,0,H);vignette.addColorStop(0,'#0b13283b');vignette.addColorStop(.5,'#0b132800');vignette.addColorStop(1,'#0b132833');ctx.fillStyle=vignette;ctx.fillRect(0,0,W,H);
}
function drawGround(o,theme){const x=o.x-camera;if(x>W+40||x+o.w< -40)return;const start=Math.max(-20,x),end=Math.min(W+20,x+o.w);const grad=ctx.createLinearGradient(0,FLOOR,0,H);grad.addColorStop(0,'#34444c');grad.addColorStop(1,'#18242e');ctx.fillStyle=grad;ctx.fillRect(start,FLOOR,end-start,H-FLOOR);rect(start,FLOOR,end-start,5,theme.accent);rect(start,FLOOR+5,end-start,10,'#849990');rect(start,FLOOR+15,end-start,6,'#1a2a32');
 for(let xx=Math.floor((start+camera)/95)*95-camera;xx<end;xx+=95){if(xx>=start)line(xx,FLOOR+22,xx,H,'#738c951b');}
 line(start,649,end,649,'#849da426');line(start,654,end,654,'#0a1c29');line(start,702,end,702,'#8fa5ad14');
 for(let xx=Math.floor((start+camera)/190)*190-camera+18;xx<end;xx+=190){if(xx>start+3&&xx+13<end){round(xx,668,13,3,1,'#69837d66');round(xx+17,668,5,3,1,'#d2f56a66');}}
 // Visible construction edge next to generated gaps.
 if(x>0&&game&&!game.grounds.some(s=>s!==o&&Math.abs(s.x+s.w-o.x)<1)){rect(x,FLOOR+5,9,H-FLOOR,'#171f29');for(let yy=FLOOR+22;yy<H;yy+=24){ctx.fillStyle='#c39b57';ctx.beginPath();ctx.moveTo(x,yy);ctx.lineTo(x+9,yy-9);ctx.lineTo(x+9,yy+2);ctx.lineTo(x,yy+11);ctx.fill();}}
 if(x+o.w<W&&game&&!game.grounds.some(s=>s!==o&&Math.abs(o.x+o.w-s.x)<1)){const ex=x+o.w-9;rect(ex,FLOOR+5,9,H-FLOOR,'#171f29');for(let yy=FLOOR+22;yy<H;yy+=24){ctx.fillStyle='#c39b57';ctx.beginPath();ctx.moveTo(ex,yy);ctx.lineTo(ex+9,yy-9);ctx.lineTo(ex+9,yy+2);ctx.lineTo(ex,yy+11);ctx.fill();}}
}
function drawSolid(o,theme){const x=o.x-camera,y=o.y,w=o.w,h=o.h;if(x>W+90||x+w<-90)return;
 ctx.save();ctx.translate(x,y);
 if(o.type==='desk'){
 ellipse(w/2,h+2,w*.52,6,'#08162042');round(7,11,w-14,h-11,3,'#485861');rect(13,15,8,h-15,'#7c8e92');rect(w-22,15,8,h-15,'#7c8e92');round(w-59,17,34,h-26,2,'#708183');line(w-56,37,w-28,37,'#415962');line(w-48,29,w-37,29,'#c4d1c4',2);line(w-48,50,w-37,50,'#c4d1c4',2);round(-5,0,w+10,12,3,'#c5b994');rect(-3,0,w+6,3,'#e9dcac');rect(3,12,w-6,3,'#172b3566');
 // Flat office equipment stays close to the collision surface.
 round(24,-6,46,6,2,'#8a9c9e');line(27,-6,65,-6,'#d1d7c8',2);round(w-35,-12,13,12,2,'#e2c792');ctx.strokeStyle='#d7c399';ctx.lineWidth=2;ctx.beginPath();ctx.arc(w-20,-6,4,-1.3,1.4);ctx.stroke();
 }else if(o.type==='copier'){
 ellipse(w/2,h+2,w*.52,5,'#08162050');round(0,5,w,h-5,5,'#b4bfc0','#314a56');round(3,0,w-6,12,3,'#dae2dc');rect(8,14,w-16,22,'#59737c');round(12,17,26,14,2,'#a9d7c2');rect(15,21,17,2,'#4c857b');ellipse(w-15,25,3,3,'#d2f56a');round(12,47,w-24,8,2,'#3e5863');rect(17,47,w-34,4,'#eef0df');line(7,68,w-7,68,'#829b9f');round(28,h-16,24,4,2,'#778c91');rect(7,h-1,12,5,'#203844');rect(w-19,h-1,12,5,'#203844');
 }else if(o.type==='platform'){
 ellipse(w/2,h+8,w*.48,5,'#0e1c262b');round(0,0,w,h,4,'#687d84','#99ada6');rect(0,0,w,3,theme.accent);rect(7,8,w-14,3,'#3b5260');for(let i=12;i<w-20;i+=35){rect(i,-13,22,13,'#718e8c');rect(i+5,-12,3,11,'#d1cba7');}if(o.moving){line(w/2,h,w/2,h+18,'#b1a0e0',2);ellipse(w/2,h+21,3,3,'#b59bff');}
 }else if(o.type==='duct'){
 round(0,0,w,h,6,'#8e9d9e','#c0c9bd');rect(3,3,w-6,8,'#b7c4bd');for(let i=18;i<w-18;i+=27){round(i,24,9,h-43,2,'#4d626d');rect(i+2,26,2,h-48,'#273f4b');}rect(0,h-10,w,10,'#c5b070');for(let xx=0;xx<w;xx+=25){ctx.fillStyle='#3f4546';ctx.beginPath();ctx.moveTo(xx,h);ctx.lineTo(xx+10,h-10);ctx.lineTo(xx+20,h-10);ctx.lineTo(xx+10,h);ctx.fill();}text('ВЕНТИЛЯЦИЯ',w/2,19,9,'#344b53',700,'center');
 }else if(o.type==='spring'){
 const squeeze=(o.bounce||0)>0?5:0;round(0,h-6,w,6,3,'#7e9689');ctx.strokeStyle='#d2f56a';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(12,h-5);ctx.lineTo(20,6+squeeze);ctx.lineTo(30,h-5);ctx.lineTo(40,6+squeeze);ctx.lineTo(50,h-5);ctx.lineTo(59,6+squeeze);ctx.stroke();round(-2,squeeze,w+4,6,3,'#d2f56a');
 }
 ctx.restore();
}
function drawBlock(b){const x=b.x-camera,y=b.y-Math.sin((b.bump/.18)*Math.PI)*9;if(x>W+50||x<-70)return;
 if(b.type==='bonus'){
 const fill=b.used?'#56646d':'#d2e97a',edge=b.used?'#8a9798':'#f1ffad';round(x+3,y+4,46,46,6,'#0e263459');round(x,y,46,46,5,fill,edge);rect(x+5,y+4,36,3,b.used?'#74848a':'#ebfc9e');rect(x+5,y+39,36,3,b.used?'#3c505b':'#9caf51');text(b.used?'·':'?',x+23,y+33,b.used?29:31,b.used?'#b7c7c8':'#3b5024',800,'center');for(const [xx,yy]of [[6,8],[38,8],[6,36],[38,36]])ellipse(x+xx,y+yy,1.3,1.3,b.used?'#adbbb866':'#769e54');
 }else{
 round(x+3,y+4,46,46,3,'#14273666');round(x,y,46,46,3,'#b49b75','#d1bd94');rect(x+18,y+1,10,44,'#d9c398');line(x+1,y+23,x+45,y+23,'#8f7652');rect(x+5,y+31,9,7,'#746d54');rect(x+7,y+32,5,2,'#cfbd97');
 }
}
function drawPickup(i,t){const x=i.x-camera,y=i.y+Math.sin(t*3.5+i.phase)*4;if(x>W+60||x<-60)return;ctx.save();ctx.translate(x,y);
 if(i.type==='sidejob'||i.type==='grow'){Office.drawReward(i);ctx.restore();return;}
 if(i.type==='coin'){
 const sx=.45+Math.abs(Math.sin(t*2.6+i.phase))*.55;ctx.scale(sx,1);ellipse(0,0,13,15,'#f6c55c22');ellipse(0,0,11,13,'#a56d2e');ellipse(-1,-1,9.5,11.5,'#f5cf6b');ellipse(-1.5,-1,6.8,8.3,'#ffe99a');bolt(-1,-1,5,'#ae853d');ellipse(-4,-7,2,1.4,'#fff2c3');
 }else{
 const colors={grow:'#d2f56a',shrink:'#b99bff',coffee:'#ffd47d',heart:'#ffa5a1',ammo:'#8ed8ec'};const c=colors[i.type];ellipse(0,3,22,22,c+'10');round(-17,-18,34,35,8,'#142b37e8',c+'a0');rect(-10,14,20,2,c+'77');
 if(i.type==='grow'){round(-11,-8,22,19,2,c);rect(-11,-11,10,4,c);line(0,7,0,-5,'#344c22',2.5);line(0,-5,-5,0,'#344c22',2.5);line(0,-5,5,0,'#344c22',2.5);}
 else if(i.type==='shrink'){round(-9,-11,18,24,3,c);rect(-3,-14,6,5,'#d8caff');line(0,-5,0,6,'#4e3d7c',2);line(0,6,-4,2,'#4e3d7c',2);line(0,6,4,2,'#4e3d7c',2);}
 else if(i.type==='coffee'){round(-10,-8,17,18,3,'#fff0c9');ctx.strokeStyle=c;ctx.lineWidth=3;ctx.beginPath();ctx.arc(9,0,6,-1.4,1.4);ctx.stroke();rect(-11,-10,20,4,c);bolt(-2,1,6,'#98703c');line(-4,-14,-2,-18,'#fff1c677',1.5);line(3,-14,5,-19,'#fff1c677',1.5);}
 else if(i.type==='heart'){ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(0,10);ctx.bezierCurveTo(-20,-2,-9,-17,0,-6);ctx.bezierCurveTo(10,-17,19,-2,0,10);ctx.fill();}
 else if(i.type==='ammo'){round(-12,-7,24,19,3,'#7397a1');round(-6,-11,12,5,2,null,c);rect(-12,-3,24,4,c);bolt(0,5,5,'#d5f0dc');}
 }ctx.restore();
}
function drawEnemy(e,t){const x=e.x-camera,y=e.y;if(x>W+90||x+e.w<-90)return;ctx.save();ctx.translate(x,y);if(e.hurt>0){ctx.globalAlpha=.6+.4*Math.sin(t*75);}
 if(Office.specs[e.type]){Office.draw(e,t);}else if(e.type==='bot'){
 const step=Math.sin(e.phase*12);ellipse(e.w/2,e.h+2,25,5,'#0e192b55');line(12,34,9+step*5,43,'#b56578',5);line(33,34,35-step*5,43,'#b56578',5);round(0,8,46,28,8,'#d17b88','#f1b0b0');round(4,11,38,17,5,'#26394a');ellipse(14,20,4,4,'#f7e6ad');ellipse(31,20,4,4,'#f7e6ad');line(23,8,23,0,'#c08e9e',2);ellipse(23,-1,3,3,'#ffbbac');rect(7,32,31,3,'#934b67');line(-1,18,-7,26,'#e2a29d',4);line(47,18,53,25,'#e2a29d',4);
 }else if(e.type==='printer'){
 ellipse(33,63,37,5,'#0e192b55');round(4,17,57,39,6,'#b8b9b3','#e4dbca');round(0,5,65,18,4,'#636f7a','#aab8bd');round(7,0,46,7,2,'#e3dcc8');rect(15,-9,36,15,'#e9e6d8');for(let k=0;k<3;k++)rect(20,-5+k*4,24,1,'#adb3ac');round(9,27,46,16,3,'#30303e');rect(15,31,12,4,'#fa8392');rect(37,31,12,4,'#fa8392');rect(14,43,37,6,'#536070');rect(18,43,28,4,'#e9e6d8');rect(7,56,11,6,'#465466');rect(47,56,11,6,'#465466');ellipse(57,14,2,2,'#ff8795');
 }else{
 ellipse(26,e.h+65,26,4,'#10162620');line(3,18,-11,8,'#7085a0',4);line(50,18,64,8,'#7085a0',4);ellipse(-12,7,16+Math.sin(t*90)*3,2,'#bad8daaa');ellipse(65,7,16+Math.sin(t*90)*3,2,'#bad8daaa');round(0,9,53,25,11,'#778ca4','#b8ced1');round(7,14,39,14,6,'#27394a');ellipse(26,21,7,6,'#fa8b9f');ellipse(26,21,3,3,'#ffe5bc');line(9,32,7,41,'#b1b8bc',3);line(44,32,46,41,'#b1b8bc',3);
 }
 if(e.hp<e.maxhp){round(1,-22,e.w-2,3,1,'#0f202d');round(1,-22,(e.w-2)*e.hp/e.maxhp,3,1,'#ffa092');}
 ctx.restore();
}
function drawGun(x,y,angle,weapon,s=1,muzzle=false,recoil=0){ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(s,s);ctx.translate(-recoil*3,0);
 // Forearm bridges the photographic cutout and the illustrated weapon.
 line(-10,8,4,3,'#b97959',7);line(-10,6,4,1,'#d7a17e',5);round(-14,3,5,7,1,'#563c2f');
 if(weapon===0){round(-1,-6,24,8,2,'#bbc5c5','#2a3d49');rect(20,-4,7,4,'#526875');round(4,1,7,12,2,'#42515d');rect(2,-8,3,2,'#b9c5b3');}
 else if(weapon===1){round(-10,-5,45,9,2,'#4b6268','#a9b8ad');rect(25,-4,25,4,'#a0b0a9');rect(48,-5,6,6,'#344a56');round(4,3,7,11,2,'#7c8565');ctx.fillStyle='#465b62';ctx.beginPath();ctx.moveTo(17,4);ctx.lineTo(25,4);ctx.lineTo(28,17);ctx.lineTo(19,16);ctx.fill();rect(-20,-4,12,11,'#9c9271');rect(6,-9,12,4,'#71857f');rect(11,-8,5,2,'#d2f56a');}
 else if(weapon===2){round(-14,-4,54,7,2,'#657c83','#c6cfbd');rect(37,-3,18,5,'#a9b9b9');round(18,1,19,7,2,'#b49364');rect(-15,0,14,8,'#a38c68');round(3,1,7,12,2,'#566972');}
 else{round(-20,-10,62,19,5,'#687c65','#c4caae');ellipse(43,-1,7,10,'#344c4d');ellipse(45,-1,3,6,'#d3c699');round(2,8,8,10,2,'#455656');rect(-12,-12,9,2,'#e8ae70');rect(8,-6,11,9,'#d4b876');bolt(13,-1,4,'#5e7054');}
 if(muzzle){const length=weapon===0?29:weapon===3?51:58;ctx.fillStyle='#fff5bb';ctx.beginPath();ctx.moveTo(length,-1);ctx.lineTo(length+10,-10);ctx.lineTo(length+10,-4);ctx.lineTo(length+26,-1);ctx.lineTo(length+10,3);ctx.lineTo(length+10,10);ctx.closePath();ctx.fill();ellipse(length+8,-1,13,7,'#ffcc6b44');}
 ctx.restore();
}
function drawHero(p,t,menu=false){
 const x=menu?940:p.x-camera+p.w*.5,feet=menu?FLOOR+2:p.y+p.h;
 const height=menu?514:p.h;const phase=menu?0:p.phase;const bob=menu?Math.sin(t*1.5)*1.3:p.onGround?Math.abs(Math.sin(phase))*1.7:0;
 const s=height/628;
 if(!menu){const groundShadow=clamp(1-Math.max(0,FLOOR-feet)/240,.2,1);ellipse(x,FLOOR+2,25*p.form*groundShadow,5*p.form*groundShadow,'#0717255c');}
 else ellipse(x,FLOOR+3,93,13,'#06152475');
 ctx.save();ctx.translate(x,feet-bob);
 if(!menu&&p.inv>0&&p.coffee<=0&&Math.floor(t*12)%2===0)ctx.globalAlpha=.42;
 if(!menu&&p.coffee>0){ctx.shadowColor='#e5f995';ctx.shadowBlur=14;ellipse(0,-height*.5,height*.37,height*.57,'#e8ff9922');}
 if(!menu&&p.form>1){ctx.shadowColor='#d2f56a';ctx.shadowBlur=6;}
 if(menu){ctx.drawImage(assets.hero,-height*215/628/2,-height,height*215/628,height);}
 else{
 ctx.scale(s,s);
 const crouch=p.duck;
 const swing=p.onGround&&!crouch?Math.sin(phase)*.36:!p.onGround?.24:0;
 // Legs pivot independently at their hips, rather than sliding a static photo.
 ctx.save();ctx.translate(-19,-286);ctx.rotate(-swing);ctx.drawImage(assets.leg_back,-88,-342,215,628);ctx.restore();
 ctx.save();ctx.translate(27,-294);ctx.rotate(swing);ctx.drawImage(assets.leg_front,-134,-334,215,628);ctx.restore();
 ctx.drawImage(assets.torso,-107,-628,215,628);
 // A subtly oversized photographic head reads clearly at gameplay scale.
 ctx.drawImage(assets.hero,79,4,86,108,-42,-642,101,125);
 }
 ctx.restore();
 if(!menu){const gx=x+height*.12,gy=feet-height*.55-bob;drawGun(gx,gy,p.angle,p.weapon,p.form*(p.duck?.9:1),p.muzzle>0,p.recoil);
 if(p.coffee>0&&Math.floor(t*12)%2===0)ellipse(x-18,feet-height*.55,3,3,'#eaf6a9');}
}
function drawSign(d){const x=d.x-camera,y=d.y;if(x>W+160||x+d.w<-160)return;const color=d.kind==='danger'?'#f0bf7b':d.kind==='violet'?'#c1adf1':'#cfe49a';line(x+59,y-7,x+59,y-50,'#9eb0a8',4);round(x,y-77,120,33,4,'#243a43ee',color+'80');text(d.text,x+60,y-56,d.text.length>19?8:9,color,700,'center');ellipse(x+59,y-4,25,4,'#10232b42');}
function drawParticles(){
 for(const b of game.bullets){const x=b.x-camera;if(b.weapon===3){ctx.save();ctx.translate(x,b.y);ctx.rotate(Math.atan2(b.vy,b.vx));round(-8,-4,17,8,3,'#a7bca2');rect(-3,-3,8,6,'#dca977');ctx.fillStyle='#fcb771';ctx.beginPath();ctx.moveTo(-8,-3);ctx.lineTo(-19-Math.random()*6,0);ctx.lineTo(-8,3);ctx.fill();ctx.restore();}else{line(x-b.vx*.011,b.y-b.vy*.011,x,b.y,b.color,2.5);ellipse(x,b.y,3,2,'#fff8db');}}
 for(const b of game.enemyBullets){ctx.save();ctx.translate(b.x-camera,b.y);ctx.rotate(b.kind==='like'?Math.sin(b.rotation)*.15:b.rotation);if(b.kind==='like')Office.heart(0,0,11,'#f198c6');else{rect(-8,-5,16,10,'#edddc0');rect(-5,-2,10,1,'#d9818c');}ctx.restore();}
 for(const q of game.pulses){ctx.globalAlpha=clamp(q.life/q.max,0,1);ellipse(q.x-camera,q.y,q.r,q.r,'#ffce7944');ctx.strokeStyle='#ffdc9b';ctx.lineWidth=3;ctx.beginPath();ctx.arc(q.x-camera,q.y,q.r,0,TAU);ctx.stroke();}
 ctx.globalAlpha=1;
 for(const p of game.particles){ctx.save();ctx.translate(p.x-camera,p.y);ctx.globalAlpha=clamp(p.life/.3,0,1);ctx.rotate(p.rotation);if(p.type==='dust')ellipse(0,0,p.size,p.size*.55,p.color+'55');else rect(-p.size/2,-p.size/2,p.size,p.type==='paper'?p.size*1.5:p.size*.7,p.color);ctx.restore();}
 for(const t of game.texts){ctx.globalAlpha=clamp(t.life/.25,0,1);text(t.text,t.x-camera,t.y,14,t.color,800,'center');}ctx.globalAlpha=1;
}
function render(){
 ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;
 const isMenu=!game||state==='menu'||state==='loading'||(state==='help'&&beforeHelp==='menu');
 const theme=THEMES[isMenu?0:game.sector%5];
 ctx.save();if(!isMenu&&shake>0&&!reducedMotion)ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake*.6);
 drawBackground(theme,isMenu?110+Math.sin(visualTime*.045)*45:camera,visualTime);
 if(isMenu){
 // An atmospheric attract screen uses the supplied friend photo, not a stand-in.
 const halo=ctx.createRadialGradient(955,350,30,955,350,260);halo.addColorStop(0,'#d3ec852c');halo.addColorStop(.65,'#d3ec8513');halo.addColorStop(1,'#d3ec8500');ctx.fillStyle=halo;ctx.fillRect(680,70,580,535);
 ctx.strokeStyle='#d9eba32c';ctx.lineWidth=1;ctx.beginPath();ctx.arc(950,330,189,0,TAU);ctx.stroke();ctx.strokeStyle='#d9eba312';ctx.beginPath();ctx.arc(950,330,214,0,TAU);ctx.stroke();
 for(const [xx,yy]of [[720,136],[1150,136],[720,532],[1150,532]]){line(xx-6,yy,xx+6,yy,'#d2e89b99');line(xx,yy-6,xx,yy+6,'#d2e89b99');}
 camera=0;drawGround({x:0,w:W,y:FLOOR,h:132},theme);drawSolid({type:'desk',x:1165,y:FLOOR-67,w:130,h:67},theme);drawPickup({x:757,y:280,type:'coin',phase:0},visualTime);drawPickup({x:806,y:240,type:'coin',phase:1},visualTime);drawPickup({x:1105,y:301,type:'grow',phase:0},visualTime);
 drawHero(null,visualTime,true);
 text('AUTHORIZED PERSONNEL ONLY',949,652,9,'#c3d0b97a',500,'center');text('ID 001  /  V. RUNNER',950,670,8,'#d2f56a66',500,'center');
 }else{
 // Dark space under the floor remains visible through construction gaps.
 rect(0,FLOOR,W,H-FLOOR,'#111b29');
 for(const d of game.decor)drawSign(d);
 for(const o of game.grounds)drawGround(o,theme);Office.drawPuddles(game);
 for(const o of game.solids)drawSolid(o,theme);
 for(const b of game.blocks)drawBlock(b);
 for(const p of game.pickups)drawPickup(p,visualTime);
 for(const e of game.enemies)drawEnemy(e,visualTime);
 drawHero(game.player,visualTime);
 drawParticles();
 if(flash>0){ctx.fillStyle=`rgba(245,118,120,${flash*1.25})`;ctx.fillRect(0,0,W,H);}
 // Distance labels make the procedural route feel like a real office floor.
 if(game.dist>20){const marker=Math.floor((camera+W*.6)/1000)*1000;const mx=marker-camera;if(mx>60&&mx<W-60){line(mx,FLOOR+26,mx,FLOOR+43,'#b1c9bb50');text(`${Math.floor(marker/10)} М`,mx,FLOOR+59,9,'#a5b9ae70',500,'center');}}
 }
 ctx.restore();
}

/* Input: auto-running, keyboard, pointer aiming, and independent multitouch. */
const keyMap={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ArrowDown:'down',KeyS:'down',Space:'jump',ArrowUp:'jump',KeyW:'jump',KeyX:'fire',KeyJ:'fire'};
const mouse={active:false,x:0,y:0};
const pointerHolds=new Map();
function refreshInput(){for(const action of Object.keys(input)){input[action]=[...held].some(code=>keyMap[code]===action)||[...pointerHolds.values()].includes(action);}}
window.addEventListener('keydown',e=>{
 if(RunnerOnline.isOpen())return;
 if(e.target?.closest?.('input,textarea,select,[contenteditable=true]')){if(e.code==='Enter'&&!e.repeat){e.preventDefault();startGame();}return;}
 if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)&&['playing','paused','menu'].includes(state))e.preventDefault();
 if(e.code==='Enter'&&!e.repeat){if(state==='menu'||state==='over')startGame();else if(state==='paused')pauseGame();return;}
 if((e.code==='Escape'||e.code==='KeyP')&&!e.repeat){if(state==='help')closeHelp();else pauseGame();return;}
 if(e.code==='KeyM'&&!e.repeat){sound.toggle();return;}
 if(e.code==='KeyH'&&!e.repeat){state==='help'?closeHelp():openHelp();return;}
 if(state!=='playing')return;
 if(/^Digit[1-4]$/.test(e.code)){selectWeapon(Number(e.code.slice(-1))-1);return;}
 if(e.code==='KeyQ'&&!e.repeat){selectWeapon(game.player.weapon+1);return;}
 if(keyMap[e.code]){if(keyMap[e.code]==='jump'&&!held.has(e.code))queueJump();held.add(e.code);refreshInput();mouse.active=false;}
});
window.addEventListener('keyup',e=>{held.delete(e.code);refreshInput();});
function pointerPosition(e){const r=canvas.getBoundingClientRect(),cover=getComputedStyle(canvas).objectFit==='cover',scale=cover?Math.max(r.width/W,r.height/H):Math.min(r.width/W,r.height/H),ox=(r.width-W*scale)/2,oy=(r.height-H*scale)/2;mouse.x=(e.clientX-r.left-ox)/scale;mouse.y=(e.clientY-r.top-oy)/scale;}
canvas.addEventListener('pointermove',e=>{if(e.pointerType==='mouse'){pointerPosition(e);mouse.active=true;}});
canvas.addEventListener('pointerdown',e=>{if(state!=='playing'||e.pointerType!=='mouse'||e.button!==0)return;e.preventDefault();pointerPosition(e);mouse.active=true;pointerHolds.set(e.pointerId,'fire');refreshInput();canvas.setPointerCapture(e.pointerId);});
window.addEventListener('pointerup',e=>{pointerHolds.delete(e.pointerId);refreshInput();document.querySelectorAll('.touch-button').forEach(b=>{if(![...pointerHolds.values()].includes(b.dataset.input))b.classList.remove('pressed');});});
window.addEventListener('pointercancel',e=>{pointerHolds.delete(e.pointerId);refreshInput();document.querySelectorAll('.touch-button').forEach(b=>b.classList.remove('pressed'));});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
for(const button of document.querySelectorAll('[data-input]')){button.addEventListener('pointerdown',e=>{e.preventDefault();if(state!=='playing')return;const action=button.dataset.input;pointerHolds.set(e.pointerId,action);button.setPointerCapture(e.pointerId);button.classList.add('pressed');if(action==='jump')queueJump();refreshInput();mouse.active=false;});}
$('startButton').addEventListener('click',startGame);$('retryButton').addEventListener('click',startGame);$('pauseButton').addEventListener('click',pauseGame);$('resumeButton').addEventListener('click',pauseGame);$('pauseMenuButton').addEventListener('click',backToMenu);$('overMenuButton').addEventListener('click',backToMenu);$('helpButton').addEventListener('click',()=>state==='help'?closeHelp():openHelp());$('closeHelpButton').addEventListener('click',closeHelp);$('soundButton').addEventListener('click',()=>sound.toggle());$('pauseSoundButton').addEventListener('click',()=>sound.toggle());
$('fullscreenButton').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if($('stage').requestFullscreen)await $('stage').requestFullscreen();else notify('ПОЛНЫЙ ЭКРАН','Поверни телефон горизонтально',2);}catch{notify('ПОЛНЫЙ ЭКРАН НЕДОСТУПЕН','Игра продолжает работать в окне',2);}});
for(const b of document.querySelectorAll('.weapon'))b.addEventListener('click',()=>selectWeapon(Number(b.dataset.weapon)));
window.addEventListener('viktor:board-open',()=>{if(state==='playing')pauseGame();clearInput();});
window.addEventListener('blur',()=>{clearInput();pointerHolds.clear();if(state==='playing')pauseGame();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='playing')pauseGame();});
function frame(now){const dt=Math.min((now-lastTime)/1000||0,1/20);lastTime=now;visualTime+=dt;if(state==='playing'){accumulator+=dt;let steps=0;while(accumulator>=1/120&&steps<7&&state==='playing'){update(1/120);accumulator-=1/120;steps++;}}else accumulator=0;render();if(toastUntil<visualTime)$('toast').classList.remove('show');requestAnimationFrame(frame);}
async function boot(){try{await Promise.all(Object.entries(ASSET_DATA).map(([name,data])=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{assets[name]=image;resolve();};image.onerror=()=>reject(new Error('Не удалось загрузить изображение: '+name));image.src=data;})));ViktorSprites.prepare(assets);$('avatar').src=assets.portrait;$('loading').hidden=true;$('startButton').disabled=false;state='menu';syncScreens();sound.updateIcon();lastTime=performance.now();requestAnimationFrame(frame);}catch(error){$('loading').innerHTML='<div>Не удалось открыть графику. Обнови страницу.</div>';console.error(error);}}
// A test surface is deliberately available only when opened with ?test=1.
if(location.hostname==='127.0.0.1'&&new URLSearchParams(location.search).has('test'))window.__VIKTOR_TEST__={get state(){return state;},get game(){return game;},get input(){return input;},get camera(){return camera;},start:resetGame,step:update,render,jump:queueJump,hitBlock,collect:type=>collect({type,x:game.player.x,y:game.player.y,dead:false}),hurt:(fall=false)=>takeDamage('Тест столкновения.',fall),end:()=>endGame('Тест завершён.'),pause:pauseGame,resize:resizePlayer,shoot,selectWeapon,generateAhead,generateChunk,enemy,pickup,Office,assets,teleport(x){game.player.x=x;game.player.y=FLOOR-game.player.h;camera=x-280;generateAhead();},snapshot(){return {state,distance:game?.dist,health:game?.player.hp,form:game?.player.form,grounds:game?.grounds.length,enemies:game?.enemies.length,pickups:game?.pickups.length,shots:game?.shots};}};
Office.bind({ctx,rect,round,line,text,ellipse,random,rnd,choose,pickup,enemy,sign,notify,floatText,emit,killEnemy,FLOOR,W,camera:()=>camera});
boot();
})();
