"""VIKTOR RUNNER 3.1 frontend bundle over the existing leaderboard/API backend."""
from __future__ import annotations

import gzip
import hashlib
from pathlib import Path

import app as legacy

ROOT = Path(__file__).resolve().parent
PARTS = tuple(sorted((ROOT / "public" / "v3").glob("game.js.gz.part*")))
if len(PARTS) != 4:
    raise RuntimeError("Incomplete VIKTOR RUNNER v3 bundle")

_SOURCE = gzip.decompress(b"".join(path.read_bytes() for path in PARTS))
if b"VIKTOR RUNNER 3.0" not in _SOURCE:
    raise RuntimeError("Invalid VIKTOR RUNNER v3 bundle")
for _token in (b"const ASSET_DATA", b"function generateChunk", b"function update(",
               b"function drawEnemy", b"function killEnemy", b"function pickup", b"boot();"):
    if _token not in _SOURCE:
        raise RuntimeError(f"V3 bundle is incompatible with support-boss patch: {_token!r}")

_BOSS_PATCH = r'''
/* VIKTOR RUNNER 3.1 / SUPPORT BOSS PATCH */
ASSET_DATA.supportBoss='data:image/webp;base64,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';
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
 const __supportBossKillEnemy=killEnemy;
 killEnemy=function(e,stomp=false){
   const boss=e&&e.type==='supportBoss'&&!e.dead;
   __supportBossKillEnemy(e,stomp);
   if(boss&&e.dead){pickup('grow',e.x+e.w*.45,e.y+20,{vy:-220,falling:true});pickup('sidejob',e.x+e.w*.7,e.y+30,{vy:-170,falling:true});notify('ПОДДЕРЖКА ПРОЙДЕНА','Босс оставила премию и шабашку',2.5);}
 };
}
'''.encode("utf-8")

_boot = _SOURCE.rfind(b"boot();")
if _boot < 0:
    raise RuntimeError("Unable to locate VIKTOR RUNNER boot sequence")
GAME_JS = _SOURCE[:_boot] + _BOSS_PATCH + b"\n" + _SOURCE[_boot:]
GAME_ETAG = '"' + hashlib.sha256(GAME_JS).hexdigest()[:24] + '"'


def application(environ, start_response):
    path = environ.get("PATH_INFO", "/")
    method = environ.get("REQUEST_METHOD", "GET")
    if path == "/game.js" and method in ("GET", "HEAD"):
        if environ.get("HTTP_IF_NONE_MATCH") == GAME_ETAG:
            start_response("304 Not Modified", [
                ("ETag", GAME_ETAG),
                ("Cache-Control", "no-cache"),
                ("X-Content-Type-Options", "nosniff"),
            ])
            return [b""]
        headers = [
            ("Content-Type", "text/javascript; charset=utf-8"),
            ("Content-Length", str(len(GAME_JS))),
            ("ETag", GAME_ETAG),
            ("Cache-Control", "no-cache"),
            ("X-Content-Type-Options", "nosniff"),
            ("Referrer-Policy", "same-origin"),
        ]
        start_response("200 OK", headers)
        return [b"" if method == "HEAD" else GAME_JS]
    return legacy.application(environ, start_response)
