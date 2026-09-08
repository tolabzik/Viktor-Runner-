/* Original office characters, rewards and events. */
(() => {
'use strict';
let h;
const specs={cleaner:[68,96,2],guard:[72,108,5],smm:[62,99,2],supportBoss:[118,148,8]};
const names={cleaner:'УБОРЩИЦА',guard:'ОХРАННИК',smm:'SMM-МЕНЕДЖЕР',supportBoss:'БОСС · ПОДДЕРЖКА'};
const reasons={cleaner:'Виктор наступил на только что вымытый пол.',guard:'Пропуск есть. Согласования на выход — нет.',smm:'Виктора задержали на съёмку корпоративного рилса.',supportBoss:'Поддержка отправила Виктора на дополнительное согласование.'};
const lines={cleaner:['Я только помыла!','Ноги! У меня тут KPI.','Обходите через отпуск.','Бахилы где, Виктор?'],guard:['Пропуск предъявите!','Выход по согласованию.','А ноутбук чей?','Без заявки не выпущу.'],smm:['Виктор, снимем рилс!','Улыбнись для контента!','Ещё дубль. Последний.','Нам нужен живой охват!'],supportBoss:['Заявка принята. Бежать поздно.','Сейчас будет первая линия!','Перезагружал? Не помогло?','Поддержка уже в пути.']};
const jokes=[
'Срочно — это когда письмо ещё не написали, а ответ уже нужен.',
'Это могло быть письмом. Но стало совещанием.',
'Виктор вышел из чата. Чат вышел за Виктором.',
'Мы тут как семья. Поэтому отпуск согласует вся родня.',
'Пятница, 18:01. «Тут буквально на пять минут».',
'Задача маленькая. Просто переписать всё.',
'Работа не волк. Но уже догоняет.',
'Ничего не трогай. Оно держится на одном Викторе.',
'Согласовано. Теперь согласуй согласование.',
'Мы оптимизировали процессы. Теперь ты работаешь за троих.',
'Встреча о сокращении встреч перенесена на три встречи.',
'В офисе два состояния: кофе кончился и дедлайн горит.',
'Статус задачи: мысленно приступил.',
'Виктор не опоздал. Он применил гибкий график.',
'Контент-план утверждён. Реальность пока воздержалась.',
'Уберите кружку с сервера. Это не подогрев.',
'На проде не тестируем. Только проверяем гипотезы.',
'Ваше письмо очень важно. Особенно всем в копии.',
'Из бонусов — дружный коллектив. Из премии — спасибо.',
'Шабашка найдена. Бухгалтерия этого не видела.',
'Дедлайн вчера. ТЗ завтра. Классика.',
'Нам нужен проактивный отдых после работы.',
'За переработки начислены новые переработки.',
'Не баг, а корпоративная особенность.'];
const signs=['ИРИ · 5 ЭТАЖ','ИРИ · 6 ЭТАЖ','ПЕРЕГОВОРКИ →','КОФЕ НЕ ТРОГАТЬ','ПРОД ДЕРЖИТСЯ','ЗАЯВКА В РАБОТЕ','СРОЧНО ДО ВЧЕРА','ТИШЕ: ИДЁТ СОЗВОН','ПЯТНИЦА НЕ СПАСЁТ','ТЗ БУДЕТ ПОТОМ','ВЫХОД ПО ЗАЯВКЕ','СОГЛАСУЙ СОГЛАСОВАНИЕ'];
function safeReward(g,kind,x){if(!g.grounds.some(s=>x>s.x+24&&x<s.x+s.w-24))return;let top=h.FLOOR;for(const s of g.solids)if(x>s.x-20&&x<s.x+s.w+20)top=Math.min(top,s.y);h.pickup(kind,x,top-64);}
function populate(g,x,index){
 if(index===0){safeReward(g,'sidejob',x+425);return;}
 const candidates=g.enemies.filter(e=>e.origin>=x&&e.origin<x+1120&&e.type!=='drone');
 if(candidates.length&&(index<=3||h.random()<.78)){const e=candidates.at(-1),regular=['cleaner','guard','smm'],kind=index<=3?regular[index-1]:h.choose(regular);const [w,height,hp]=specs[kind];Object.assign(e,{type:kind,w,h:height,hp,maxhp:hp,y:h.FLOOR-height,baseY:h.FLOOR-height,timer:1+h.random(),bubbleTime:0,dash:0,warning:0});}
 // A light recurring boss closes each office location. Eight HP and slow attacks keep it approachable.
 if(index>=3&&index%4===3){h.enemy('supportBoss',x+850);const boss=g.enemies.at(-1);Object.assign(boss,{vx:-8,timer:1.4,bubbleTime:0,warning:0,swing:0,origin:x+850});h.sign(x+690,'ПОДДЕРЖКА ВПЕРЕДИ','danger');}
 if(index%2===0)safeReward(g,'sidejob',x+400);if(index%3===0)safeReward(g,'grow',x+945);if(index%2===1)h.sign(x+65,h.choose(signs),'normal');
}
function say(e){e.bubble=h.choose(lines[e.type]);e.bubbleTime=2.4;}
function tickEnemy(e,g,p,dt){
 if(!specs[e.type])return;e.bubbleTime=Math.max(0,(e.bubbleTime||0)-dt);e.swing=Math.max(0,(e.swing||0)-dt);const distance=e.x-p.x;if(distance< -170||distance>680)return;
 if(e.type==='supportBoss'){
   if(e.warning>0){e.warning-=dt;if(e.warning<=0){e.swing=.42;const sy=e.y+67,a=Math.atan2(p.y+p.h*.55-sy,p.x-e.x);g.enemyBullets.push({x:e.x+18,y:sy,w:28,h:14,vx:Math.cos(a)*205,vy:Math.sin(a)*205,life:3.5,rotation:0,kind:'batwave'});}}
   else if(e.timer<=0&&distance>85&&distance<560){e.warning=.72;e.timer=3.25;say(e);}
   return;
 }
 if(e.type==='cleaner'&&e.timer<=0){g.puddles.push({x:e.x-25,y:h.FLOOR-6,w:104,h:12,life:7});e.timer=3.1;say(e);}
 if(e.type==='guard'){if(e.warning>0){e.warning-=dt;if(e.warning<=0)e.dash=.75;}else if(e.dash>0){e.dash-=dt;const nx=e.x-dt*175,safe=g.grounds.some(s=>nx>=s.x+8&&nx+e.w<=s.x+s.w-8),blocked=g.solids.some(s=>nx<s.x+s.w&&nx+e.w>s.x&&e.y+e.h>s.y&&e.y<s.y+s.h);if(safe&&!blocked)e.x=nx;if(e.dash<=0)e.origin=e.x;}else if(e.timer<=0&&distance>130&&distance<460){e.warning=.7;e.timer=4.8;say(e);}}
 if(e.type==='smm'&&e.timer<=0&&distance>95){const sy=e.y+34,a=Math.atan2(p.y+p.h*.55-sy,p.x-e.x);g.enemyBullets.push({x:e.x,y:sy,w:18,h:16,vx:Math.cos(a)*240,vy:Math.sin(a)*240,life:4,rotation:0,kind:'like'});e.timer=2.8;say(e);}
}
function tick(g,dt){
 g.puddles=g.puddles.filter(q=>(q.life-=dt)>0&&q.x>h.camera()-200);const p=g.player;p.slow=Math.max(0,(p.slow||0)-dt);
 for(const q of g.puddles)if(p.coffee<=0&&p.x+p.w>q.x&&p.x<q.x+q.w&&p.y+p.h>h.FLOOR-10){p.slow=Math.max(p.slow,1.2);if(!q.hit){q.hit=true;h.floatText(p.x,p.y-10,'СКОЛЬЗКО!','#8edfea');}}
 if(g.elapsed>=g.nextJoke){g.nextJoke=g.elapsed+11+h.random()*6;let i=Math.floor(h.random()*jokes.length);if(i===g.lastJoke)i=(i+1)%jokes.length;g.lastJoke=i;const el=document.getElementById('officeJoke');el.textContent=jokes[i];el.classList.add('visible');g.jokeUntil=g.elapsed+5.5;}
 if(g.elapsed>(g.jokeUntil||0))document.getElementById('officeJoke').classList.remove('visible');
}
function drawPuddles(g){const {ellipse,line,text,ctx}=h;for(const q of g.puddles){const x=q.x-h.camera();if(x< -120||x>h.W+120)continue;ctx.save();ctx.globalAlpha=Math.min(1,q.life/1.5);ellipse(x+50,h.FLOOR-1,54,7,'#70d5dd70');line(x+20,h.FLOOR-4,x+53,h.FLOOR-4,'#d2ffff99',2);ctx.fillStyle='#ffd071';ctx.beginPath();ctx.moveTo(x+80,h.FLOOR-30);ctx.lineTo(x+64,h.FLOOR-3);ctx.lineTo(x+96,h.FLOOR-3);ctx.closePath();ctx.fill();text('!',x+80,h.FLOOR-8,16,'#49351d',900,'center');ctx.restore();}}
function heart(x,y,size,color){const {ctx}=h;ctx.save();ctx.translate(x,y);ctx.scale(size/12,size/12);ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(0,10);ctx.bezierCurveTo(-19,-3,-9,-17,0,-7);ctx.bezierCurveTo(10,-17,19,-3,0,10);ctx.fill();ctx.restore();}
function drawReward(i){const {round,rect,line,ellipse,text}=h,premium=i.type==='grow',c=premium?'#d2f56a':'#ffd07a';ellipse(0,3,26,26,c+'18');round(-21,-18,42,36,7,'#152b35',c);if(premium){round(-13,-10,26,20,3,c);rect(-4,-14,8,5,'#f3ffc1');text('₽',0,6,18,'#34502a',900,'center');ellipse(12,-10,6,6,'#ffe1a0');text('+',12,-7,10,'#785a20',900,'center');}else{round(-15,-9,30,20,2,'#f2debb');line(-14,-8,0,3,'#b58956',1.5);line(14,-8,0,3,'#b58956',1.5);round(-3,-1,6,7,2,'#c99a45');}round(-36,22,72,15,4,'#13232ce8');text(premium?'ПРЕМИЯ':'ШАБАШКА',0,32,8,c,800,'center');}
function bubble(e){if(e.bubbleTime<=0||!e.bubble)return;const {ctx,round,text}=h,w=Math.min(188,Math.max(118,e.bubble.length*5.5));round(e.w/2-w/2,-56,w,26,7,'#f0eadb','#ffffff88');ctx.fillStyle='#f0eadb';ctx.beginPath();ctx.moveTo(e.w/2-5,-30);ctx.lineTo(e.w/2+2,-23);ctx.lineTo(e.w/2+8,-30);ctx.fill();text(e.bubble,e.w/2,-39,10,'#263540',700,'center');}
function draw(e,t){
 const {ctx,ellipse,line,round,rect,text}=h,step=Math.sin(e.phase*9),swing=step*5,skin='#e3ad87',shade='#b47f64';ellipse(e.w/2,e.h+2,e.w*.53,5,'#0b192d55');
 if(e.type==='supportBoss'){
   const warn=e.warning>0&&Math.floor(e.warning*10)%2===0;ctx.save();ctx.translate(e.w/2,8);ctx.rotate((e.swing||0)>0?-.12+Math.sin((.42-e.swing)/.42*Math.PI)*.18:0);
   ctx.beginPath();ctx.roundRect(-56,0,112,112,14);ctx.clip();ctx.drawImage(h.assets.boss,-56,0,112,112);ctx.restore();
   line(42,116,36+swing*.25,144,'#2e3440',10);line(75,116,80-swing*.25,144,'#2e3440',10);round(25+swing*.25,139,27,8,3,'#ece5dc');round(69-swing*.25,139,28,8,3,'#ece5dc');
   if(e.swing>0){ctx.save();ctx.translate(77,55);ctx.rotate(-.8+Math.sin((.42-e.swing)/.42*Math.PI)*1.45);round(0,-5,72,10,5,'#f080ab','#ffbfd5');round(64,-8,17,16,8,'#ef719f');ctx.restore();}
   if(warn){ellipse(59,-12,15,15,'#ff9ab6');text('!',59,-6,20,'#50283a',900,'center');}
   round(9,-36,100,17,5,'#271c2aee','#ff9ab688');text('МИНИ-БОСС',59,-24,9,'#ffc1d5',900,'center');
 }else if(e.type==='cleaner'){
 line(24,68,22+swing,90,'#344d58',8);line(43,68,45-swing,90,'#344d58',8);round(12+swing,87,18,9,4,'#e7cfab');round(36-swing,87,18,9,4,'#e7cfab');ctx.fillStyle='#4f9696';ctx.beginPath();ctx.moveTo(19,33);ctx.lineTo(47,33);ctx.lineTo(55,75);ctx.lineTo(12,75);ctx.closePath();ctx.fill();round(24,43,19,26,3,'#d4d1a9');round(26,55,15,9,2,'#9cbbaf');ellipse(36,19,15,18,skin);ellipse(48,12,10,9,'#725653');round(20,3,27,8,4,'#c17b9c');line(23,5,42,5,'#edabc2',2);ellipse(45,8,4,5,'#e1a0b7');ellipse(31,19,2,2,'#273842');ellipse(41,19,2,2,'#273842');line(31,29,42,27,shade,2);line(19,41,8,57+step*2,skin,8);line(46,40,59,52+step*3,skin,8);ellipse(7,57,5,6,'#efd581');ellipse(59,53,5,6,'#efd581');line(57,31,73+step*7,89,'#ceb488',4);round(60+step*7,84,28,8,3,'#8999ae');for(let k=0;k<6;k++)line(63+k*4+step*7,90,61+k*5+step*7,98,'#d6e0d5',2);
 }else if(e.type==='guard'){
 line(27,77,25+swing,100,'#203343',13);line(49,77,51-swing,100,'#203343',13);round(13+swing,99,24,9,3,'#15242d');round(40-swing,99,23,9,3,'#15242d');round(13,35,48,46,9,'#415c70','#718797');line(36,36,37,78,'#243b4e',2);rect(15,74,45,6,'#192e3c');round(32,74,11,6,1,'#d7ba71');round(44,45,11,14,2,'#dac778');text('ОХР',49,54,5,'#294657',800,'center');ellipse(38,21,17,19,skin);round(18,4,37,11,4,'#2a4257');round(13,12,46,5,2,'#162e42');ellipse(38,8,4,4,'#dcc679');line(26,21,33,23,'#463a32',2);line(41,23,48,21,'#463a32',2);ellipse(30,25,2,2,'#233440');ellipse(45,25,2,2,'#233440');round(30,31,16,4,2,'#6b4c3e');line(15,42,4,65-swing,'#415c70',11);line(59,43,66,59,'#415c70',11);ellipse(4,67-swing,6,6,skin);ellipse(65,59,6,7,skin);round(58,39,12,21,3,'#1c2e3e');line(65,39,65,29,'#172b3b',3);rect(61,44,6,4,'#a0c3b8');if(e.warning>0||e.dash>0){ellipse(38,-10,12,12,'#ff986d');text('!',38,-4,17,'#412828',900,'center');}
 }else{
 line(22,71,18+swing,92,'#3d3e67',9);line(41,71,44-swing,92,'#3d3e67',9);round(8+swing,91,21,8,3,'#f3edde');rect(9+swing,97,20,2,'#db96c8');round(36-swing,91,21,8,3,'#f3edde');rect(37-swing,97,20,2,'#db96c8');round(9,35,41,42,8,'#b775b1','#dda5ca');round(19,60,22,11,3,'#975f99');line(25,39,23,54,'#efd3d7',1.5);line(34,39,36,53,'#efd3d7',1.5);ellipse(30,20,15,19,skin);ellipse(28,9,17,10,'#654d3e');round(17,16,12,8,3,'#203847');round(32,16,12,8,3,'#203847');line(28,19,34,19,'#203847',2);line(20,19,24,18,'#b6d9dc',1);line(36,19,40,18,'#b6d9dc',1);line(26,31,36,30,'#a66b56',2);line(12,42,3,61+swing,'#b775b1',9);ellipse(3,63+swing,5,6,skin);line(47,43,56,26,'#b775b1',9);ellipse(56,25,5,6,skin);round(49,8,16,26,4,'#ffe28a','#fff1c1');round(52,11,10,19,2,'#34515e');heart(57,20,4,'#efa8d0');line(-6,64,-6,12,'#91a7b7',2);ctx.strokeStyle='#e0dcff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(-6,9,11,0,Math.PI*2);ctx.stroke();
 }
 text(names[e.type],e.w/2,e.h+19,8,'#e0e6da',800,'center');bubble(e);
}
window.Office={bind:hooks=>{h=hooks;},specs,names,reasons,populate,tickEnemy,tick,draw,drawPuddles,drawReward,heart};
})();
