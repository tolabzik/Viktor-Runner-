/* VIKTOR RUNNER 3.1 / SUPPORT BOSS PATCH */
ASSET_DATA.supportBoss='assets/support-boss.webp';
{
 const __supportBossGenerateChunk=generateChunk;
 generateChunk=function(x,index){
   __supportBossGenerateChunk(x,index);
   if(index>=3&&index%4===3&&!game.enemies.some(e=>e.type==='supportBoss'&&!e.dead&&e.x>=x&&e.x<x+1120)){
     game.enemies=game.enemies.filter(e=>e.x<x+690||e.x>x+1030);
     game.enemies.push({type:'supportBoss',x:x+850,y:FLOOR-148,w:118,h:148,hp:6,maxhp:6,origin:x+850,baseY:FLOOR-148,vx:-8,phase:0,timer:1.5,hurt:0,dead:false,warning:0,swing:0,dash:0,bubble:'',bubbleTime:0});
     sign(x+690,'ПОДДЕРЖКА ВПЕРЕДИ','danger');
   }
 };
 const __supportBossUpdate=update;
 update=function(dt){
   __supportBossUpdate(dt);
   if(!game||state!=='playing')return;
   const p=game.player;
   for(const e of game.enemies){
     if(e.dead||e.type!=='supportBoss')continue;
     const oldWarning=e.warning||0;
     e.warning=Math.max(0,oldWarning-dt);e.swing=Math.max(0,(e.swing||0)-dt);e.dash=Math.max(0,(e.dash||0)-dt);e.bubbleTime=Math.max(0,(e.bubbleTime||0)-dt);
     if(oldWarning>0&&e.warning<=0){e.swing=.5;e.dash=.38;e.vx=-62;emit(e.x+e.w*.2,e.y+e.h*.45,8,'#ff91b8',95,'spark');}
     else if(e.dash>0)e.vx=-62;
     else if(e.warning>0)e.vx=0;
     else{
       e.vx=-8;
       const dx=e.x-p.x;
       if(e.timer<=0&&dx>85&&dx<520){e.warning=.72;e.timer=3.4;e.vx=0;e.bubble=choose(['Заявка принята. Бежать поздно.','Сейчас будет первая линия!','Перезагружал? Не помогло?','Поддержка уже в пути.']);e.bubbleTime=2.2;}
     }
   }
 };
 const __supportBossDrawEnemy=drawEnemy;
 drawEnemy=function(e,t){
   if(e.type!=='supportBoss')return __supportBossDrawEnemy(e,t);
   const x=e.x-camera,y=e.y;if(x>W+150||x+e.w<-150)return;
   ctx.save();ctx.translate(x,y);if(e.hurt>0)ctx.globalAlpha=.58+.42*Math.sin(t*75);
   ellipse(e.w/2,e.h+3,58,7,'#0b192d66');
   ctx.save();ctx.translate(e.w/2,7);ctx.rotate((e.swing||0)>0?-.1+Math.sin((.5-e.swing)/.5*Math.PI)*.18:0);ctx.beginPath();ctx.roundRect(-56,0,112,112,14);ctx.clip();ctx.drawImage(assets.supportBoss,-56,0,112,112);ctx.restore();
   const step=Math.sin(e.phase*7)*3;line(42,116,37+step,144,'#303642',10);line(76,116,81-step,144,'#303642',10);round(25+step,139,27,8,3,'#eee8df');round(69-step,139,28,8,3,'#eee8df');
   if(e.swing>0){ctx.save();ctx.translate(77,55);ctx.rotate(-.8+Math.sin((.5-e.swing)/.5*Math.PI)*1.35);round(0,-5,72,10,5,'#ef7fab','#ffc0d7');round(64,-8,18,16,8,'#ed6f9f');ctx.restore();}
   if(e.warning>0&&Math.floor(e.warning*12)%2===0){ellipse(59,-13,15,15,'#ff91b8');text('!',59,-7,20,'#51283a',900,'center');}
   round(9,-38,100,18,5,'#281d2bee','#ff91b899');text('МИНИ-БОСС',59,-25,9,'#ffc2d7',900,'center');
   round(7,-17,104,5,2,'#101a22');round(7,-17,104*e.hp/e.maxhp,5,2,'#ff8eb7');
   if(e.bubbleTime>0&&e.bubble){const bw=Math.min(205,Math.max(128,e.bubble.length*5.3));round(e.w/2-bw/2,-70,bw,25,7,'#f4edf1','#ffbed388');text(e.bubble,e.w/2,-53,10,'#382c34',700,'center');}
   text('БОСС · ПОДДЕРЖКА',e.w/2,e.h+21,8,'#ffd0df',900,'center');ctx.restore();
 };
}
