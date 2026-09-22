import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {getFootprint,getStairPlacement} from '../src/features/deckcraft/lib/deckGeometry';
import {getHouseContact} from '../src/features/deckcraft/houseContact';
const inside=(p:{x:number;y:number},poly:{x:number;y:number}[])=>{let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++)if((poly[i].y>p.y)!==(poly[j].y>p.y)&&p.x<(poly[j].x-poly[i].x)*(p.y-poly[i].y)/(poly[j].y-poly[i].y)+poly[i].x)c=!c;return c;};
let cases=0;
for(const shape of ['Rectangle','L-Shape','Multi-corner','Curved'] as const)
for(const pattern of ['Straight','Diagonal','Herringbone'] as const)
for(const stairType of ['Straight','Landing','Winder'] as const){
 const d={...structuredClone(DEFAULT_DECK),shape,pattern,stairType,height:72,width:24,length:24,cutoutWidth:8,cutoutLength:8,cutoutWidth2:4,cutoutLength2:4,levels:2,height2:36};
 const m=buildDeckTakeoff(d);
 assert(m.levels.every(l=>l.boards.every(b=>b.length>0&&b.length<=192+.001)));
 for(const l of m.levels)for(const member of [...l.joists,...l.beams,...(l.rim||[])])assert(Math.hypot(member.b.x-member.a.x,member.b.z-member.a.z)<=192+.001,'All framing fits stock');
 for(const l of m.levels){
  for(const b of l.blocking.filter(b=>b.role==='board-end'))assert(inside({x:(b.a.x+b.b.x)/2-l.offset.x,y:(b.a.z+b.b.z)/2-l.offset.z},l.footprint.outline),'Board-end backing remains inside clipped footprint');
  for(const j of l.joists)for(const [key,point]of [['spliceStart',j.a],['spliceEnd',j.b]] as const)if(j[key])assert(l.beams.some(b=>Math.abs(b.a.z-point.z)<.01&&point.x>=b.a.x-.01&&point.x<=b.b.x+.01),'Joist splice bears on beam');
  for(const b of l.beams)for(const [key,point]of [['spliceStart',b.a],['spliceEnd',b.b]] as const)if(b[key])assert(l.supports.some(p=>Math.abs(p.x-point.x)<.01&&Math.abs(p.z-point.z)<6),'Beam splice bears on post');
  for(const r of l.rim||[])if(r.spliceEnd)assert(l.blocking.some(b=>b.role==='rim-splice-backing'&&Math.hypot((b.a.x+b.b.x)/2-r.b.x,(b.a.z+b.b.z)/2-r.b.z)<2),'Rim splice has physical backing');
 }
 assert.equal(m.quantities.totalRisers,m.flights.reduce((n,f)=>n+f.risers,0));
 assert.equal(m.quantities.stairTreads,m.treads.length);
 assert(m.flights.every(f=>f.rise<=7.75&&f.rise>0));
 assert(m.connections.length===1);
 if(pattern==='Herringbone'){const angles=new Set(m.levels[0].boards.map(b=>b.angleDeg));assert(angles.has(45)&&angles.has(135));assert(m.levels[0].boards.every(b=>b.polygon?.length));}
 if(stairType==='Landing')assert(m.levels.some(l=>l.kind==='landing'));
 if(stairType==='Winder')assert.equal(m.treads.filter(t=>t.kind==='winder').length,3);
 const fp=getFootprint(d),p=getStairPlacement(d,fp)!;const a=fp.outline[p.edgeIndex!],b=fp.outline[(p.edgeIndex!+1)%fp.outline.length];
 assert(Math.abs((p.origin.x-a.x)*(b.y-a.y)-(p.origin.y-a.y)*(b.x-a.x))<.001,'Stairs on polygon edge');
 cases++;
}
for(const level2Position of ['Front','Left','Right'] as const)for(const height2 of [24,36,72]){
 const m=buildDeckTakeoff({...DEFAULT_DECK,levels:2,height:36,height2,level2Position});
 const f=m.flights.find(f=>f.kind==='connection');if(height2===36)assert(!f);else assert.equal(Math.abs(f!.start.y-f!.end.y),Math.abs(36-height2));
 cases++;
}
const inlay=buildDeckTakeoff({...DEFAULT_DECK,pattern:'Herringbone',hasInlay:true,inlayLf:6});
assert(inlay.levels[0].boards.some(b=>b.role==='inlay'));
const inlayLength=inlay.levels[0].boards.filter(b=>b.role==='inlay').reduce((n,b)=>n+b.length,0);assert(Math.abs(inlayLength-72)<.01,'Requested inlay replaces exactly selected length');
const plain=buildDeckTakeoff({...DEFAULT_DECK,width:40,length:40,height:72,stairType:'Winder'});
assert.equal(plain.treads.length,Math.ceil(72/7.75)-1,'Winder flight has every intermediate riser surface exactly once');
for(const stairType of ['Straight','Landing','Winder'] as const)for(const height of [12,36,72,108,144]){
 const m=buildDeckTakeoff({...DEFAULT_DECK,height,stairType});
 assert(m.stringers.every(b=>Math.hypot(b.b.x-b.a.x,b.b.y-b.a.y,b.b.z-b.a.z)<=192),'Stringers fit stock, long runs add a supported landing');
 assert.equal(m.quantities.totalRisers,Math.ceil(height/7.75));
}
for(const stairOffset of [0,25,50,75,100]){
 const d={...DEFAULT_DECK,shape:'Curved' as const,stairOffset,stairWidth:48};const fp=getFootprint(d),stair=getStairPlacement(d,fp)!;
 assert(stair.width>=48-.001,'Curved deck has a full-width real flat stair opening');assert(Math.abs(stair.outward.x)<.001,'Curved opening bears on a horizontal chord');
}
const flush=buildDeckTakeoff({...DEFAULT_DECK,levels:2,height:36,height2:36,width2:8});assert.equal(flush.connections[0].opening.width,96,'Same-elevation sections join across shared width');
for(const stairWidth of [36,48,72,120])for(const stairTurn of ['Left','Right'] as const){
 const m=buildDeckTakeoff({...DEFAULT_DECK,height:72,stairType:'Winder',stairWidth,stairTurn}),w=m.levels.find(l=>l.kind==='winder')!;
 assert.equal(w.beams.length,6,'Each winding tread has inner/outer chord support');
 for(const tread of m.treads.filter(t=>t.kind==='winder')){
  const low=Math.min(...tread.polygon!.map(p=>p.y)),high=Math.max(...tread.polygon!.map(p=>p.y));
  const rows=[low,...w.joists.filter(j=>j.role==='winder-infill'&&Math.abs(j.a.y-(tread.y-.5-j.depth/2))<.01).map(j=>j.a.z),high].sort((a,b)=>a-b);
  for(let i=1;i<rows.length;i++)assert(rows[i]-rows[i-1]<=7+.01,'Winder plank framing span does not exceed7in');
 }
}
// Stairs never open through the house wall, even when a stale design still asks for the Back side.
for(const deckType of ['Attached','Add-on'] as const)for(const stairFlights of [1,3]){
  const d={...DEFAULT_DECK,deckType,stairPosition:'Back' as const,stairFlights},fp=getFootprint(d),contact=getHouseContact(d,fp),model=buildDeckTakeoff(d);
  assert(contact.contacts.length===1,'The main deck has one ledger contact');
  for(const f of model.flights)assert(f.start.z>1,'No stair flight starts on the house wall');
  assert(!model.railing.rails.some(r=>contact.onContact({x:r.a.x,y:r.a.z},{x:r.b.x,y:r.b.z})),'No railing along the ledger');
  cases++;
}
console.log(`DECK GEOMETRY OK — ${cases} polygon, herringbone, landing/winder, connection, rise and framing-stock scenarios.`);
