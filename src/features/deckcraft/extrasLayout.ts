import {pergolaLayout} from './pergolaLayout';
import {SIDE_DOT} from './lib/deckGeometry';
import {activeCornerChamfers,isChamferEdgeId} from './lib/cornerChamfers';
import type {DeckData} from './types';
import type {Box,DeckTakeoff} from './deckTakeoff';
import {activeLightingItems,isSystemProduct,MAX_FIXTURE_QTY} from './lightingSystem';
import {getHouseConfig} from './houseSettings';
import {finishedFasciaOffset} from './lib/finishedFootprint';
import {getTerrainConfig} from './yardSettings';
import {screenLengthIn,screenOn,screenProduct} from './privacyScreens';
import {getHouseContact} from './houseContact';
import {getHousePlacement} from './housePlacement';
import {openingWallId} from './houseFootprint';
import {borderLightingPlan} from './borderLighting';
import {edgeSectionId} from './lib/edgeSections';

export type FixturePlacement={productId:string;x:number;y:number;z:number;angle:number;zone?:string};
/** The original EVO HYDE allowance's housing, in inches: the EVO HYDE profile (22 × 16 mm) at the short 180C length,
 * since the allowance itself names no length. Illustrative, not a shop drawing. */
export const LEGACY_HYDE={length:7.09,height:.87,depth:.63};
/** A stock manufacturer panel, drawn by finish; the cut pattern shown is illustrative. */
export type PrivacyPanelBox=Box&{finish:'Black'|'White';design:string;screenId:string};
/** Drag frame for one drawn screen: position along `edge` maps back to the screen's offsetPct. */
export type PrivacyScreenHandle={id:string;x:number;y:number;z:number;w:number;h:number;angle:number;edge:{x:number;z:number;dx:number;dz:number;available:number;len:number;reversed:boolean;clearanceIn?:number}};
/** Inverse of the layout placement: a point along the edge (model inches) → offsetPct.
 * null when the screen fills its edge and has no room to slide. */
export function screenOffsetFromPoint(handle:PrivacyScreenHandle,px:number,pz:number):number|null{
  const {x,z,dx,dz,available,len,reversed,clearanceIn=12}=handle.edge,room=available-len;
  if(room<=.5)return null;
  const pct=Math.min(100,Math.max(0,((px-x)*dx+(pz-z)*dz-clearanceIn-len/2)/room*100));
  return Math.round(reversed?100-pct:pct);
}
type PlanPt={x:number;y:number};
function insidePolygon(poly:PlanPt[],x:number,z:number){let odd=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a.y>z)!==(b.y>z)&&x<(b.x-a.x)*(z-a.y)/(b.y-a.y)+a.x)odd=!odd;}return odd;}
/**
 * A tread's nose: the edge over the riser below, where an under-step light mounts. Straight treads face their stair's
 * outward direction; a winder's nose is its polygon's lower edge (corners 2 to 3), facing away from the tread.
 * angle turns a fixture's local +z to face out over the step below; its local x runs along the nose.
 */
export function treadNose(t:Box){
  if(t.polygon&&t.polygon.length>=4){
    const [a,b]=[t.polygon[2],t.polygon[3]],len=Math.hypot(b.x-a.x,b.y-a.y)||1,mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
    const c={x:t.polygon.reduce((n,p)=>n+p.x,0)/t.polygon.length,y:t.polygon.reduce((n,p)=>n+p.y,0)/t.polygon.length};
    let n={x:(b.y-a.y)/len,y:-(b.x-a.x)/len};if((mid.x-c.x)*n.x+(mid.y-c.y)*n.y<0)n={x:-n.x,y:-n.y};
    return {x:mid.x,z:mid.y,width:len,angle:Math.atan2(n.x,n.y),center:{x:c.x,z:c.y}};
  }
  const a=t.angle??0;return {x:t.x+Math.sin(a)*t.d/2,z:t.z+Math.cos(a)*t.d/2,width:t.w,angle:a,center:{x:t.x,z:t.z}};
}
/** Over something you walk on: a deck level, a landing or a stair tread (plan inches). */
export function walkableAt(model:DeckTakeoff,x:number,z:number){
  if(model.levels.some(l=>insidePolygon(l.footprint.outline.map(p=>({x:p.x+l.offset.x,y:p.y+l.offset.z})),x,z)))return true;
  return model.treads.some(t=>{if(t.polygon)return insidePolygon(t.polygon,x,z);const a=t.angle??0,dx=x-t.x,dz=z-t.z;return Math.abs(dx*Math.cos(a)-dz*Math.sin(a))<=t.w/2&&Math.abs(dx*Math.sin(a)+dz*Math.cos(a))<=t.d/2;});
}
/**
 * The way each railing post faces the walking surface (plan unit vector): across its rail run, or into the corner
 * where two runs meet, toward the deck or stair it guards. A post light or wall fixture mounts on that face.
 */
export function postFacing(model:DeckTakeoff):PlanPt[]{
  const surfaces=[...model.levels.map(l=>{const o=l.footprint.outline;return {x:o.reduce((n,p)=>n+p.x,0)/o.length+l.offset.x,y:o.reduce((n,p)=>n+p.y,0)/o.length+l.offset.z};}),...model.treads.map(t=>({x:t.x,y:t.z}))];
  return model.railing.posts.map(p=>{
    const dirs:PlanPt[]=[];
    for(const r of model.railing.rails){
      const ax=r.a.x-p.x,az=r.a.z-p.z,len=Math.hypot(r.b.x-r.a.x,r.b.z-r.a.z);if(len<1)continue;
      const ux=(r.b.x-r.a.x)/len,uz=(r.b.z-r.a.z)/len,along=-(ax*ux+az*uz),off=Math.abs(ax*uz-az*ux);
      if(off>2||along<-2||along>len+2)continue;
      if(along>2)dirs.push({x:-ux,y:-uz});if(along<len-2)dirs.push({x:ux,y:uz});
    }
    const u=dirs[0]??{x:1,y:0},v=dirs.find(d=>Math.abs(d.x*u.x+d.y*u.y)<.98);
    const b=v?{x:u.x+v.x,y:u.y+v.y}:{x:-u.y,y:u.x},bl=Math.hypot(b.x,b.y)||1,c={x:b.x/bl,y:b.y/bl};
    const candidates=[c,{x:-c.x,y:-c.y}];
    const walk=candidates.find(d=>walkableAt(model,p.x+d.x*12,p.z+d.y*12));
    if(walk)return walk;
    // Neither side lands on a surface within a foot (a post at the foot of a stair): face the nearer surface.
    const near=(d:PlanPt)=>Math.min(...surfaces.map(q=>Math.hypot(p.x+d.x*12-q.x,p.z+d.y*12-q.y)));
    return near(candidates[0])<=near(candidates[1])?candidates[0]:candidates[1];
  });
}
/** Physical accessory layouts in model inches; also consumed by CAD/model export. */
export function extrasLayout(data:DeckData,model:DeckTakeoff){
  const wood:(Box&{screenId?:string})[]=[],metal:(Box&{screenId?:string})[]=[],drainage:Box[]=[],fixtures:FixturePlacement[]=[],warnings:string[]=[];
  const level=model.levels[0],fp=level.footprint,top=level.top;
  const terrain=getTerrainConfig(data);
  const contact=getHouseContact(data,fp);
  const edges=fp.outline.map((p,i)=>{const q=fp.outline[(i+1)%fp.outline.length],len=Math.hypot(q.x-p.x,q.y-p.y);return {p,q,len,dx:(q.x-p.x)/len,dz:(q.y-p.y)/len,index:i};}).filter(e=>e.len>24&&!contact.isContactEdge(e.index));
  // Prefer side edges; keep the principal front stair approach clear.
  edges.sort((a,b)=>Math.abs(b.dz)-Math.abs(a.dz)||b.len-a.len);
  function allocate(inches:number,callback:(x:number,z:number,len:number,angle:number,dx:number,dz:number)=>void){let left=inches;
    for(const e of edges){if(left<=0)break;const len=Math.min(left,Math.max(0,e.len-24));if(len<=0)continue;
      // An angled corner too short for 2 ft of seating or screen after its end clearances gets none.
      if(isChamferEdgeId(fp.edgeIds?.[e.index])&&e.len-24<24)continue;
      const x=e.p.x+e.dx*(12+len/2)-e.dz*14,z=e.p.y+e.dz*(12+len/2)+e.dx*14;
      // Keep seating/screens away from any stair tread projected at the deck edge.
      const blocked=model.treads.some(t=>Math.abs(t.y-top)<9&&Math.hypot(t.x-x,t.z-z)<len/2+24);
      if(blocked)continue;callback(x,z,len,-Math.atan2(e.dz,e.dx),e.dx,e.dz);left-=len;
    }return left;
  }
  const benchRemaining=allocate(Math.max(0,data.benchLf)*12,(x,z,len,angle,dx,dz)=>{
    for(let slat=0;slat<3;slat++)wood.push({x:x-dz*(slat-1)*5.75,y:top+17.5,z:z+dx*(slat-1)*5.75,w:len,h:1,d:5.5,angle});
    for(let seat=0;seat<=Math.ceil(len/48);seat++){const t=-len/2+3+(len-6)*seat/Math.ceil(len/48);for(const side of [-1,1])metal.push({x:x+dx*t-dz*side*6,y:top+8,z:z+dz*t+dx*side*6,w:2,h:16,d:2,angle});}
  });
  if(benchRemaining>.1)warnings.push(`Bench layout fits ${((data.benchLf*12-benchRemaining)/12).toFixed(1)} of ${data.benchLf} requested linear feet; reduce seating or enlarge the deck.`);
  // Inner-face mounts on each post of a lit screen; the inward normal is (-dz, dx).
  const privacyMounts:{x:number;z:number;y:number;angle:number}[]=[];
  const panelBoxes:PrivacyPanelBox[]=[],screenHandles:PrivacyScreenHandle[]=[];
  const screenSpans=new Map<string,{lo:number;hi:number;custom:boolean}[]>();
  function screen(x:number,z:number,len:number,angle:number,dx:number,dz:number,heightIn:number,lit:boolean,screenId?:string,screenTop=top){
    for(let slat=0;slat<Math.round(heightIn/6);slat++)wood.push({x:x+dz*10,y:screenTop+3+slat*6,z:z-dx*10,w:len,h:5.5,d:1,angle,...(screenId?{screenId}:{})});
    const bays=Math.ceil(len/72);for(let i=0;i<=bays;i++){const t=-len/2+len*i/bays,px=x+dx*t+dz*10,pz=z+dz*t-dx*10;metal.push({x:px,y:screenTop+heightIn/2,z:pz,w:3.5,h:heightIn,d:3.5,angle,...(screenId?{screenId}:{})});
      if(lit)privacyMounts.push({x:px-dz*2.6,z:pz+dx*2.6,y:screenTop+heightIn-10,angle});}
  }
  if(data.privacyScreens){
    const ys=fp.outline.map(p=>p.y),xs=fp.outline.map(p=>p.x),cx=(Math.min(...xs)+Math.max(...xs))/2,cz=(Math.min(...ys)+Math.max(...ys))/2;
    const midX=(e:typeof edges[number])=>(e.p.x+e.q.x)/2,midZ=(e:typeof edges[number])=>(e.p.y+e.q.y)/2;
    const onSide={Left:(e:typeof edges[number])=>Math.abs(e.dz)>SIDE_DOT&&midX(e)<cx,Right:(e:typeof edges[number])=>Math.abs(e.dz)>SIDE_DOT&&midX(e)>cx,Front:(e:typeof edges[number])=>Math.abs(e.dx)>SIDE_DOT&&midZ(e)>cz,Back:(e:typeof edges[number])=>Math.abs(e.dx)>SIDE_DOT&&midZ(e)<cz};
    data.privacyScreens.forEach((s,i)=>{
      if(!screenOn(s))return;
      const custom=s.edgeId!==undefined,source=(s.level??1)===1?level:model.levels.find(l=>l.kind==='deck'&&l.index===s.level!-1);
      const product=screenProduct(s),label=`Privacy screen ${i+1} (${s.side} edge)`,skipped=custom?'it is inactive and excluded from current pricing and supplier-quote items; its settings are retained for restore':product.pricedBySqft?'it is priced but not drawn':'it is not drawn';
      if(!source){warnings.push(`${label} has no active deck level ${s.level??1}; ${skipped}. Choose an active level.`);return;}
      const sfp=source.footprint,screenTop=source.top;
      const ownEdges=source===level&&!custom?edges:sfp.outline.map((a,index)=>{const b=sfp.outline[(index+1)%sfp.outline.length],len=Math.hypot(b.x-a.x,b.y-a.y);return {p:{x:a.x+source.offset.x,y:a.y+source.offset.z},q:{x:b.x+source.offset.x,y:b.y+source.offset.z},len,dx:(b.x-a.x)/len,dz:(b.y-a.y)/len,index};}).filter(e=>e.len>(custom?.01:24)&&(source!==level||!contact.isContactEdge(e.index)));
      const centerX=(Math.min(...sfp.outline.map(p=>p.x))+Math.max(...sfp.outline.map(p=>p.x)))/2+source.offset.x,centerZ=(Math.min(...sfp.outline.map(p=>p.y))+Math.max(...sfp.outline.map(p=>p.y)))/2+source.offset.z;
      const side=(e:typeof edges[number])=>s.side==='Left'?Math.abs(e.dz)>SIDE_DOT&&midX(e)<centerX:s.side==='Right'?Math.abs(e.dz)>SIDE_DOT&&midX(e)>centerX:s.side==='Front'?Math.abs(e.dx)>SIDE_DOT&&midZ(e)>centerZ:Math.abs(e.dx)>SIDE_DOT&&midZ(e)<centerZ;
      const e=custom?ownEdges.find(e=>edgeSectionId(sfp,e.index)===s.edgeId):source===level?edges.filter(onSide[s.side]).sort((a,b)=>b.len-a.len)[0]:ownEdges.filter(side).sort((a,b)=>b.len-a.len)[0];
      if(!e){warnings.push(custom?`${label} has no matching exposed saved edge on level ${s.level??1}; ${skipped}. Choose an actual edge again.`:`${label} has no exposed ${s.side.toLowerCase()} edge on this deck; ${skipped}. Choose another side.`);return;}
      const clearance=custom?0:12,available=e.len-2*clearance;let len=Math.min(screenLengthIn(s),available),panels=s.panels??1;
      if(product.panel&&product.post){
        // Stock panels cannot be trimmed: draw the whole panels that fit.
        const fit=Math.floor((available-product.post.widthIn)/(product.panel.widthIn+product.post.widthIn));
        if(fit<1){warnings.push(`${label} does not fit that edge; ${skipped}.`);return;}
        if(fit<panels){warnings.push(`${label} fits ${fit} of ${panels} ${product.name} panels on that edge${custom?`; ${skipped}`:''}.`);if(custom)return;panels=fit;}
        len=panels*product.panel.widthIn+(panels+1)*product.post.widthIn;
      }else{
        if(len<=0){warnings.push(`${label} does not fit that edge; ${skipped}.`);return;}
        if(s.lengthFt*12>available+(custom?1e-6:.5)){warnings.push(`${label} fits ${(len/12).toFixed(1)} of ${s.lengthFt} ft on that edge${custom?`; ${skipped}`:''}.`);if(custom)return;}
      }
      // 0% = house end on side edges, left end on front/back edges, whatever the outline winding.
      const reversed=custom?false:Math.abs(e.dz)>.7?e.dz<0:e.dx<0,pct=reversed?100-s.offsetPct:s.offsetPct;
      const t=clearance+(available-len)*pct/100+len/2,x=e.p.x+e.dx*t-e.dz*14,z=e.p.y+e.dz*t+e.dx*14;
      const lo=t-len/2,hi=t+len/2,key=`${source.index}:${edgeSectionId(sfp,e.index)}`,taken=screenSpans.get(key)??[];
      if(taken.some(o=>(custom||o.custom)&&Math.max(lo,o.lo)<Math.min(hi,o.hi)-.01)){warnings.push(`${label} overlaps another screen on that edge; ${skipped}. Slide it or shorten it.`);return;}
      if(custom){
        const overlaps=(a:{x:number;y:number},b:{x:number;y:number})=>{if(Math.abs((a.x-e.p.x)*e.dz-(a.y-e.p.y)*e.dx)>.5||Math.abs((b.x-e.p.x)*e.dz-(b.y-e.p.y)*e.dx)>.5)return false;const p=(a.x-e.p.x)*e.dx+(a.y-e.p.y)*e.dz,q=(b.x-e.p.x)*e.dx+(b.y-e.p.y)*e.dz;return Math.max(lo,Math.min(p,q))<Math.min(hi,Math.max(p,q))-.01;};
        const stair=model.flights.some(f=>Math.abs(f.start.y-screenTop)<.01&&f.along&&overlaps({x:f.start.x-f.along.x*f.width/2,y:f.start.z-f.along.y*f.width/2},{x:f.start.x+f.along.x*f.width/2,y:f.start.z+f.along.y*f.width/2}));
        const sourceIndex=model.levels.indexOf(source),connection=model.connections.some(c=>{if(c.from!==sourceIndex&&c.to!==sourceIndex)return false;const parent=model.levels[c.from],o=c.opening,d=c.to===sourceIndex?c.run:0,a={x:o.origin.x+parent.offset.x+o.outward.x*d,y:o.origin.y+parent.offset.z+o.outward.y*d};return overlaps(a,{x:a.x+o.along.x*o.width,y:a.y+o.along.y*o.width});});
        const covered=model.levels.some(l=>l!==source&&l.kind==='deck'&&l.top>screenTop+.01&&l.footprint.outline.some((a,i)=>{const b=l.footprint.outline[(i+1)%l.footprint.outline.length];return overlaps({x:a.x+l.offset.x,y:a.y+l.offset.z},{x:b.x+l.offset.x,y:b.y+l.offset.z});}));
        if(stair||connection||covered){warnings.push(`${label} overlaps a stair or level-connection opening; ${skipped}. Choose a clear edge interval.`);return;}
      }
      if(!custom&&model.treads.some(tr=>Math.abs(tr.y-screenTop)<9&&Math.hypot(tr.x-x,tr.z-z)<len/2+24)){warnings.push(`${label} overlaps the stair opening; ${skipped}. Slide it along the edge or shorten it.`);return;}
      const angle=-Math.atan2(e.dz,e.dx),heightIn=product.post?product.post.heightIn:s.heightFt*12;
      if(product.panel&&product.post){
        const {widthIn:pw,heightIn:ph,thicknessIn}=product.panel,{widthIn:postW,heightIn:postH}=product.post;
        const at=(along:number)=>({x:x+e.dx*along+e.dz*10,z:z+e.dz*along-e.dx*10});
        for(let k=0;k<=panels;k++){const along=-len/2+postW/2+k*(pw+postW),q=at(along);metal.push({x:q.x,y:screenTop+postH/2,z:q.z,w:postW,h:postH,d:postW,angle,screenId:s.id});if(s.lights)privacyMounts.push({x:q.x-e.dz*(postW/2+.85),z:q.z+e.dx*(postW/2+.85),y:screenTop+postH-10,angle});}
        for(let k=0;k<panels;k++){const q=at(-len/2+postW+k*(pw+postW)+pw/2);panelBoxes.push({x:q.x,y:screenTop+3+ph/2,z:q.z,w:pw,h:ph,d:thicknessIn,angle,finish:s.finish??'Black',design:s.design??product.designs[0],screenId:s.id});}
      }else screen(x,z,len,angle,e.dx,e.dz,heightIn,s.lights,s.id,screenTop);
      screenHandles.push({id:s.id,x:x+e.dz*10,y:screenTop+heightIn/2,z:z-e.dx*10,w:len,h:heightIn,angle,edge:{x:e.p.x,z:e.p.y,dx:e.dx,dz:e.dz,available,len,reversed,...(custom?{clearanceIn:0}:{})}});
      screenSpans.set(key,[...taken,{lo,hi,custom}]);
    });
  }else{
    const screenRemaining=allocate(Math.max(0,data.privacySqft)/6*12,(x,z,len,angle,dx,dz)=>screen(x,z,len,angle,dx,dz,72,false));
    if(screenRemaining>.1)warnings.push(`Privacy layout fits ${(data.privacySqft-screenRemaining/2).toFixed(1)} of ${data.privacySqft} requested square feet at 6 ft high.`);
  }
  function inside(x:number,z:number){let odd=false;for(let i=0,j=fp.outline.length-1;i<fp.outline.length;j=i++){const a=fp.outline[i],b=fp.outline[j];if((a.y>z)!==(b.y>z)&&x<(b.x-a.x)*(z-a.y)/(b.y-a.y)+a.x)odd=!odd;}return odd;}
  // Largest centred rectangle contained by the actual polygon, sampled at 6-inch increments.
  let pergolaArea=0;
  if(data.pergolaSqft>0&&!data.pergola){let best={x:0,z:0,w:0,d:0};const wanted=data.pergolaSqft*144;
    const cell=12,cols=Math.max(0,Math.floor((fp.bounds.w-12)/cell)),rows=Math.max(0,Math.floor((fp.bounds.h-12)/cell));
    const runs=Array.from({length:rows},()=>Array(cols).fill(0));
    for(let row=0;row<rows;row++)for(let col=cols-1;col>=0;col--){const x=6+col*cell,z=6+row*cell;const fits=[[x,z],[x+cell,z],[x,z+cell],[x+cell,z+cell]].every(([px,pz])=>inside(px,pz));runs[row][col]=fits?1+(runs[row][col+1]||0):0;}
    for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){let available=Infinity;for(let end=row;end<rows;end++){available=Math.min(available,runs[end][col]);if(available<2)break;const d=(end-row+1)*cell,w=Math.min(available*cell,Math.floor(wanted/d/6)*6);if(d>=24&&w>=24&&w*d>best.w*best.d)best={x:6+col*cell,z:6+row*cell,w,d};}}
    const {x,z,w,d}=best;pergolaArea=w*d/144;
    if(w&&d){for(const px of [x+3,x+w-3])for(const pz of [z+3,z+d-3])wood.push({x:px,y:top+48,z:pz,w:5.5,h:96,d:5.5});for(const pz of [z,z+d])wood.push({x:x+w/2,y:top+97,z:pz,w:w+12,h:9.25,d:3});for(let px=x;px<=x+w;px+=16)wood.push({x:px,y:top+104,z:z+d/2,w:1.5,h:7.25,d:d+18});for(let pz=z;pz<=z+d;pz+=12)wood.push({x:x+w/2,y:top+109,z:pz,w:w+18,h:1.5,d:1.5});}
    if(pergolaArea<data.pergolaSqft-1)warnings.push(`Pergola layout fits ${pergolaArea.toFixed(1)} of ${data.pergolaSqft} requested square feet within the footprint.`);
  }
  if(data.hasDrainage)for(const l of model.levels){if(l.top<24){warnings.push('Under-deck drainage needs at least 24 in of model clearance; raise the deck or remove drainage.');continue;}for(const j of l.joists){const len=Math.hypot(j.b.x-j.a.x,j.b.z-j.a.z);drainage.push({x:(j.a.x+j.b.x)/2,y:j.a.y-6,z:(j.a.z+j.b.z)/2,w:Math.max(4,data.joistSpacing-1.5),h:.15,d:len,angle:Math.atan2(j.b.x-j.a.x,j.b.z-j.a.z)});}const clip=l.kind==='deck'&&l.index===0?activeCornerChamfers(data):null,front0=clip?.leftIn??0,front1=l.footprint.bounds.w-(clip?.rightIn??0);drainage.push({x:l.offset.x+(front0+front1)/2,y:l.top-20,z:l.offset.z+l.footprint.bounds.h-2,w:front1-front0,h:3,d:4});drainage.push({x:l.offset.x+front0+3,y:Math.max(4,(l.top-20)/2),z:l.offset.z+l.footprint.bounds.h+1,w:3,h:Math.max(3,l.top-20),d:3});}
  const perimeter=edges.reduce((s,e)=>s+e.len,0);
  function perimeterPoint(index:number,count:number){let t=(index+.5)*perimeter/Math.max(1,count);for(const e of edges){if(t<=e.len)return {x:e.p.x+e.dx*t-e.dz*4,z:e.p.y+e.dz*t+e.dx*4,angle:-Math.atan2(e.dz,e.dx)};t-=e.len;}return {x:6,z:6,angle:0};}
  const border=borderLightingPlan(data,model);warnings.push(...border.warnings);
  const selected=activeLightingItems(data,model),counts=new Map<string,number>(),indices=new Map<string,number>();
  for(const item of selected)counts.set(item.zone,(counts.get(item.zone)??0)+item.qty);
  const house=getHouseConfig(data),houseVisible=data.houseVisible!==false,houseLeft=getHousePlacement(data).x0;
  let utilityIndex=0;
  // Post and step fixtures are counted per product, so a cap light and a post light share each post rather than
  // stacking, and each product spreads over every step on its own.
  const perProduct=new Map<string,number>(),perProductQty=new Map<string,number>();
  for(const item of selected)perProductQty.set(`${item.zone}:${item.id}`,(perProductQty.get(`${item.zone}:${item.id}`)??0)+item.qty);
  const facing=selected.some(i=>i.zone==='posts')?postFacing(model):[],noses=model.treads.map(treadNose);
  for(const item of selected)for(let i=0;i<item.qty;i++){
    const index=indices.get(item.zone)??0;indices.set(item.zone,index+1);
    const key=`${item.zone}:${item.id}`,own=perProduct.get(key)??0;perProduct.set(key,own+1);
    const p=perimeterPoint(index,counts.get(item.zone)??1),g=item.geometry,d=item.dimensionsIn,zone=item.zone;
    let y=top+.15;
    if(zone==='border'){
      const mount=border.mounts[own];if(!mount)continue;
      p.x=mount.x;p.z=mount.z;p.angle=mount.angle;y=mount.y;
    }else if(isSystemProduct(item)){
      const utility=utilityIndex++,column=utility%10,row=Math.floor(utility/10);
      p.x=8+column*12;p.z=houseVisible?2:5;y=top+18+row*16;p.angle=0;
      if(g==='cable'){p.x=10+column*7;p.z=5;y=top-7-row*6;}
      else if(!houseVisible)metal.push({x:p.x,y:top+11+row*8,z:p.z-2,w:3.5,h:22+row*16,d:3.5});
    }else if(g==='pendant'||g==='ceiling'){
      const rafters=wood.filter(b=>Math.abs(b.y-(top+104))<.1&&b.h===7.25);
      if(rafters.length){const r=rafters[index%rafters.length];p.x=r.x;p.z=r.z;y=r.y-r.h/2;}
      else if(houseVisible){p.x=houseLeft+12+(house.widthFt*12-24)*(index+.5)/(counts.get(zone)??1);p.z=7;y=house.storeys*house.storeyHeightIn-1.5;}
      else{warnings.push(`${item.name} needs a ceiling/eave or pergola support; no fixture is placed until that support is included.`);continue;}
    }else if(zone==='privacy'){
      const mount=privacyMounts[index%Math.max(1,privacyMounts.length)];
      if(!mount){warnings.push(`${item.name}: privacy screen lighting needs a screen with “Light this screen” turned on.`);continue;}
      if(g!=='wall'&&g!=='undercap'){warnings.push(`${item.name} cannot mount on a privacy screen post; choose a wall or under-cap fixture.`);continue;}
      p.x=mount.x;p.z=mount.z;p.angle=mount.angle;y=mount.y;
    }else if(zone==='posts'){
      const postIndex=own%Math.max(1,model.railing.posts.length),post=model.railing.posts[postIndex];
      if(!post){warnings.push(`${item.name}: the posts zone requires railing posts.`);continue;}
      // On the post face toward the deck or stair it guards, just under the top rail.
      const f=facing[postIndex]??{x:0,y:1},out=1.9+(d.width??1)/2;
      p.x=post.x+f.x*out;p.z=post.z+f.y*out;y=post.y+model.railing.height-7-Math.floor(own/model.railing.posts.length)*8;p.angle=Math.atan2(f.x,f.y);
      if(g==='recessed'){p.x=post.x;p.z=post.z;y=post.y+model.railing.height+.18;p.angle=0;}
      if(!['wall','recessed','undercap'].includes(g)){warnings.push(`${item.name} cannot use a post mount; choose a compatible fixture or installation zone.`);continue;}
      if((d.length??d.diameter??d.width??2)>3.5)warnings.push(`${item.name} is wider than a modeled 3.5 in railing post; a manufacturer-approved mounting plate or another location is required.`);
    }else if(zone==='stairs'){
      const treads=Math.max(1,model.treads.length),ti=own%treads,t=model.treads[ti];
      if(!t){warnings.push(`${item.name}: the stairs zone needs a stair flight.`);continue;}
      // This product's fixtures on this step, spaced evenly along its nose (one sits in the middle).
      const total=perProductQty.get(key)??1,onStep=Math.floor(total/treads)+(ti<total%treads?1:0),slot=Math.floor(own/treads);
      const nose=noses[ti],a=nose.angle,nx=Math.sin(a),nz=Math.cos(a),ux=Math.cos(a),uz=-Math.sin(a),along=((slot+.5)/onStep-.5)*nose.width;
      p.angle=a;
      if(g==='recessed'){p.x=nose.center.x+ux*along;p.z=nose.center.z+uz*along;y=t.y+t.h/2+.15;}
      else if(g==='wall'||g==='undercap'){
        const legacyHyde=item.id==='evo_hyde',length=legacyHyde?LEGACY_HYDE.length:d.length??d.diameter??d.width??2;
        if(onStep*length+(onStep-1)*2>nose.width-4){warnings.push(`${item.name} is too long for this tread; choose a shorter fixture or a deck/house location.`);continue;}
        // An under-step light tucks up flush under the tread, on the riser face below the nose (the nosing is too shallow
        // to hide it); a riser light sits lower on that face.
        const nosing=t.polygon?0:model.stairSupport.treadNosingIn;
        const inset=nosing-(g==='undercap'?(legacyHyde?LEGACY_HYDE.depth:d.width??.7)/2+.05:(d.width??1)/2);
        p.x=nose.x+ux*along-nx*inset;p.z=nose.z+uz*along-nz*inset;
        y=t.y-t.h/2-(g==='undercap'?(legacyHyde?LEGACY_HYDE.height:d.height??.5)/2:2.7);
      }else{warnings.push(`${item.name} is not a recessed or surface stair fixture; choose its intended installation zone.`);continue;}
    }else if(zone==='house'&&g==='wall'){
      if(!houseVisible){warnings.push(`${item.name}: enable the house to place wall fixtures.`);continue;}
      p.x=houseLeft+12+(house.widthFt*12-24)*(index+.5)/(counts.get(zone)??1);p.z=2;y=Math.min(house.storeys*house.storeyHeightIn-12,top+66);p.angle=0;
      // Move clear of real openings, keeping the fixture attached to an opaque wall.
      for(const o of house.openings.filter(o=>openingWallId(o,house)==='main-front')){const ox=houseLeft+o.offsetPct/100*house.widthFt*12;if(Math.abs(p.x-ox)<o.widthIn/2+5&&y>o.bottomIn-5&&y<o.bottomIn+o.heightIn+5)y=Math.min(house.storeys*house.storeyHeightIn-8,o.bottomIn+o.heightIn+7);}
    }else if(zone==='landscape'||g==='bollard'||g==='spot'){
      // Existing perimeter point is 4 in inboard; place path fittings 24 in beyond it.
      p.x-=Math.sin(p.angle)*28;p.z-=Math.cos(p.angle)*28;y=terrain.elevationIn+p.z*terrain.slopePct/100;p.angle+=Math.PI;
      if(g==='wall'||g==='undercap'){warnings.push(`${item.name} needs a real wall or cap; select the deck, posts or house zone.`);continue;}
    }else if(g==='wall'||g==='undercap'){
      const length=d.length??d.width??4,eligible=edges.filter(e=>e.len>=length+12),edge=eligible[index%Math.max(1,eligible.length)];
      if(!edge){warnings.push(`${item.name} does not fit an exposed deck edge at its full catalogue length.`);continue;}
      const slots=Math.ceil((counts.get(zone)??1)/eligible.length),slot=Math.floor(index/eligible.length),along=edge.len*(slot+.5)/slots;
      if(edge.len/slots<length+2){warnings.push(`${item.name}: selected fixtures would overlap on the available fascia; reduce quantities or choose another supported zone.`);continue;}
      const outward=finishedFasciaOffset(data)+(g==='wall'?(d.width??1)/2:.2);
      p.x=edge.p.x+edge.dx*along+edge.dz*outward;p.z=edge.p.y+edge.dz*along-edge.dx*outward;p.angle=-Math.atan2(edge.dz,edge.dx)+Math.PI;y=top-(g==='undercap'?1.7:4.5);
    }
    fixtures.push({productId:item.id,...p,y,zone});
  }
  for(const item of selected){
    const mounts=item.zone==='posts'?model.railing.posts.length:item.zone==='stairs'?model.treads.length:item.zone==='privacy'?privacyMounts.length:0;
    if(item.qty>=MAX_FIXTURE_QTY&&mounts>item.qty)warnings.push(`${item.name}: ${item.qty} fixtures is the per-product limit in this studio, so ${mounts-item.qty} ${item.zone==='stairs'?'treads':'posts'} stay unlit. Ask us to light the rest.`);
  }
  const pergola=pergolaLayout(data,model,[...wood,...metal,...panelBoxes]);
  warnings.push(...(pergola?.warnings??[]));
  return {...(pergola?{pergola}:{}),wood,metal,drainage,fixtures,warnings:[...new Set(warnings)],pergolaArea,privacyMounts,borderMounts:border.availableMounts,panels:panelBoxes,screenHandles};
}
