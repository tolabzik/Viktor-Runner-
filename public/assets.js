/* Body layers are clipped from the supplied photograph, without external assets. */
const ASSET_DATA = { hero: 'assets/hero.webp' };
window.ViktorSprites = {
 prepare(assets) {
  const image=assets.hero;
  function part(points){const c=document.createElement('canvas');c.width=215;c.height=628;const x=c.getContext('2d');x.beginPath();points.forEach(([a,b],i)=>i?x.lineTo(a,b):x.moveTo(a,b));x.closePath();x.clip();x.drawImage(image,0,0);return c;}
  assets.torso=part([[0,0],[215,0],[215,381],[182,381],[182,321],[128,352],[49,330],[47,380],[0,380]]);
  assets.leg_back=part([[60,320],[119,327],[119,389],[99,518],[111,628],[24,628],[33,477]]);
  assets.leg_front=part([[118,322],[183,318],[177,463],[178,563],[215,583],[215,626],[103,627],[103,530],[113,389]]);
  const p=document.createElement('canvas');p.width=100;p.height=120;p.getContext('2d').drawImage(image,76,3,95,123,0,0,100,120);assets.portrait=p.toDataURL('image/png');
 }
};
