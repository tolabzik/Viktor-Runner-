from pathlib import Path
from playwright.sync_api import sync_playwright
import json
root=Path(__file__).resolve().parents[1]
from browser_smoke import html_for_test, attach_api
html=html_for_test()
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1440,'height':960})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 attach_api(page)
 page.set_content(html)
 page.wait_for_function("window.__VIKTOR_TEST__?.state==='menu'")
 results=page.evaluate('''() => {
 const t=window.__VIKTOR_TEST__,results=[];
 const assert=(name,pass,data={})=>results.push({name,pass,...data});
 const reset=()=>{t.start();t.game.player.inv=0;t.game.player.x=200;t.game.player.y=588-t.game.player.h;};
 const frames=n=>{for(let i=0;i<n;i++)t.step(1/120);};
 reset();const initial=t.game.player.y;t.jump();let peak=initial;for(let i=0;i<115;i++){t.step(1/120);peak=Math.min(peak,t.game.player.y);}assert('Held jump height and landing',initial-peak>160 && t.game.player.onGround,{height:initial-peak,landed:t.game.player.onGround});
 reset();t.jump();frames(8);t.input.jump=false;let peak2=initial;for(let i=0;i<105;i++){t.step(1/120);peak2=Math.min(peak2,t.game.player.y);}assert('Variable jump height',initial-peak2<130&&initial-peak2>20,{height:initial-peak2});
 reset();t.collect('grow');assert('Growth updates collider',t.game.player.form===1.42&&t.game.player.h>165&&Math.abs(t.game.player.y+t.game.player.h-588)<.01,{form:t.game.player.form,height:t.game.player.h});
 t.hurt();assert('Growth absorbs one hit',t.game.player.hp===3&&t.game.player.form===1);
 t.game.player.inv=0;t.hurt();assert('Damage shrinks Viktor',t.game.player.hp===2&&t.game.player.form<1);
 const hp=t.game.player.hp;t.hurt();assert('Damage cooldown prevents repeated hit',t.game.player.hp===hp);
 reset();t.collect('shrink');assert('Mini form fits ducts',t.game.player.h<85&&t.game.player.form===.62);
 reset();t.collect('coffee');t.hurt();assert('Coffee grants invulnerability',t.game.player.hp===3&&t.game.player.coffee===8);
 reset();t.game.player.hp=1;t.collect('heart');assert('Health pickup',t.game.player.hp===2);
 reset();t.game.coins=98;t.game.player.hp=2;const bonus={type:'bonus',x:500,y:300,content:'coin',used:false};t.hitBlock(bonus);assert('Crossing 100 coins grants health',t.game.player.hp===3&&t.game.coins===103);
 reset();for(let i=0;i<4;i++){t.selectWeapon(i);const before=t.game.player.ammo[i];t.shoot();assert('Weapon '+(i+1)+' creates projectiles',t.game.bullets.some(b=>b.weapon===i));if(i>0)assert('Weapon '+(i+1)+' uses one ammo',t.game.player.ammo[i]===before-1);}
 t.selectWeapon(1);t.game.player.ammo[1]=0;t.shoot();assert('Empty weapon falls back to pistol',t.game.player.weapon===0);
 reset();t.game.enemies=[{type:'bot',x:410,y:544,w:46,h:44,hp:1,maxhp:1,origin:410,vx:0,phase:0,timer:10,hurt:0,dead:false}];t.shoot();frames(35);assert('Projectile kills enemy',t.game.kills===1,{kills:t.game.kills});
 reset();t.game.enemies=[{type:'bot',x:200,y:544,w:46,h:44,hp:1,maxhp:1,origin:200,vx:0,phase:0,timer:10,hurt:0,dead:false}];t.game.player.y=544-t.game.player.h-2;t.game.player.vy=250;frames(3);assert('Stomp bounces and kills',t.game.kills===1&&t.game.player.vy<0);
 reset();t.game.player.x=610-t.game.player.w-.05;t.collect('grow');assert('Can grow beside a solid without overlap',t.game.player.form===1.42&&t.game.player.x+t.game.player.w<=610,{x:t.game.player.x,w:t.game.player.w});
 reset();t.resize(1,true);assert('Crouch reduces collision height',t.game.player.h===72);t.resize(1,false);assert('Stand restores collision height',t.game.player.h===118);
 reset();const paper={type:'paper',x:400,y:370,w:46,h:46,dead:false};t.game.blocks.push(paper);t.collect('grow');t.hitBlock(paper);assert('Big Viktor breaks boxes',paper.dead===true);
 reset();const p=t.game.player;p.y=1000;t.step(1/120);assert('Pit costs health and respawns safely',p.hp===2&&p.y<588&&t.state==='playing');
 reset();t.game.player.hp=1;t.game.player.inv=0;t.hurt(true);assert('Last health ends run',t.state==='over');t.start();assert('Restart resets counters and ammo',t.game.dist===0&&t.game.coins===0&&t.game.player.ammo[1]===90);
 t.pause();assert('Pause changes state',t.state==='paused');t.pause();assert('Resume changes state',t.state==='playing');
 reset();t.teleport(20000);t.step(1/120);assert('Procedural generation reaches all 5 sectors',t.game.sector===4&&t.game.generated>20000+1280,{sector:t.game.sector,generated:t.game.generated});
 return results;
}''')
 print(json.dumps(results,ensure_ascii=False,indent=2))
 (root/'tests/artifacts/mechanics-results.json').write_text(json.dumps({'results':results,'errors':errors},ensure_ascii=False,indent=2))
 print('PASS',sum(r['pass'] for r in results),'/',len(results),'BROWSER ERRORS',errors)
 assert all(r['pass'] for r in results) and not errors
 browser.close()
