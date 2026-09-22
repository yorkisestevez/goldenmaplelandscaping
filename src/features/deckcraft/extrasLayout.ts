import type {DeckData} from './types';
import type {Box,DeckTakeoff} from './deckTakeoff';
import {activeLightingItems,isSystemProduct,MAX_FIXTURE_QTY} from './lightingSystem';
import {getHouseConfig} from './houseSettings';
import {finishedFasciaOffset} from './lib/finishedFootprint';
import {getTerrainConfig} from './yardSettings';
import {screenLengthIn,screenOn,screenProduct} from './privacyScreens';
import {getHouseContact} from './houseContact';
import {getHousePlacement} from './housePlacement';

export type FixturePlacement={productId:string;x:number;y:number;z:number;angle:number;zone?:string};
/** A stock manufacturer panel, drawn by finish; the cut pattern shown is illustrative. */
export type PrivacyPanelBox=Box&{finish:'Black'|'White';design:string;screenId:string};
/** Drag frame for one drawn screen: position along `edge` maps back to the screen's offsetPct. */
export type PrivacyScreenHandle={id:string;x:number;y:number;z:number;w:number;h:number;angle:number;edge:{x:number;z:number;dx:number;dz:number;available:number;len:number;reversed:boolean}};
/** Inverse of the layout placement: a point along the edge (model inches) → offsetPct.
 * null when the screen fills its edge and has no room to slide. */
export function screenOffsetFromPoint(handle:PrivacyScreenHandle,px:number,pz:number):number|null{
  const {x,z,dx,dz,available,len,reversed}=handle.edge,room=available-len;
  if(room<=.5)return null;
  const pct=Math.min(100,Math.max(0,((px-x)*dx+(pz-z)*dz-12-len/2)/room*100));
  return Math.round(reversed?100-pct:pct);
}
/** Physical accessory layouts in model inches; also consumed by CAD/model export. */
export function extrasLayout(data:DeckData,model:DeckTakeoff){
  const wood:Box[]=[],metal:Box[]=[],drainage:Box[]=[],fixtures:FixturePlacement[]=[],warnings:string[]=[];
  const level=model.levels[0],fp=level.footprint,top=level.top;
  const terrain=getTerrainConfig(data);
  const contact=getHouseContact(data,fp);
  const edges=fp.outline.map((p,i)=>{const q=fp.outline[(i+1)%fp.outline.length],len=Math.hypot(q.x-p.x,q.y-p.y);return {p,q,len,dx:(q.x-p.x)/len,dz:(q.y-p.y)/len,index:i};}).filter(e=>e.len>24&&!contact.isContactEdge(e.index));
  // Prefer side edges; keep the principal front stair approach clear.
  edges.sort((a,b)=>Math.abs(b.dz)-Math.abs(a.dz)||b.len-a.len);
  function allocate(inches:number,callback:(x:number,z:number,len:number,angle:number,dx:number,dz:number)=>void){let left=inches;
    for(const e of edges){if(left<=0)break;const len=Math.min(left,Math.max(0,e.len-24));if(len<=0)continue;
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
  function screen(x:number,z:number,len:number,angle:number,dx:number,dz:number,heightIn:number,lit:boolean){
    for(let slat=0;slat<Math.round(heightIn/6);slat++)wood.push({x:x+dz*10,y:top+3+slat*6,z:z-dx*10,w:len,h:5.5,d:1,angle});
    const bays=Math.ceil(len/72);for(let i=0;i<=bays;i++){const t=-len/2+len*i/bays,px=x+dx*t+dz*10,pz=z+dz*t-dx*10;metal.push({x:px,y:top+heightIn/2,z:pz,w:3.5,h:heightIn,d:3.5,angle});
      if(lit)privacyMounts.push({x:px-dz*2.6,z:pz+dx*2.6,y:top+heightIn-10,angle});}
  }
  if(data.privacyScreens){
    const ys=fp.outline.map(p=>p.y),xs=fp.outline.map(p=>p.x),cx=(Math.min(...xs)+Math.max(...xs))/2,cz=(Math.min(...ys)+Math.max(...ys))/2;
    const midX=(e:typeof edges[number])=>(e.p.x+e.q.x)/2,midZ=(e:typeof edges[number])=>(e.p.y+e.q.y)/2;
    const onSide={Left:(e:typeof edges[number])=>Math.abs(e.dz)>.7&&midX(e)<cx,Right:(e:typeof edges[number])=>Math.abs(e.dz)>.7&&midX(e)>cx,Front:(e:typeof edges[number])=>Math.abs(e.dx)>.7&&midZ(e)>cz,Back:(e:typeof edges[number])=>Math.abs(e.dx)>.7&&midZ(e)<cz};
    data.privacyScreens.forEach((s,i)=>{
      if(!screenOn(s))return;
      const product=screenProduct(s),label=`Privacy screen ${i+1} (${s.side} edge)`,skipped=product.pricedBySqft?'it is priced but not drawn':'it is not drawn';
      const e=edges.filter(onSide[s.side]).sort((a,b)=>b.len-a.len)[0];
      if(!e){warnings.push(`${label} has no exposed ${s.side.toLowerCase()} edge on this deck; ${skipped}. Choose another side.`);return;}
      const available=e.len-24;let len=Math.min(screenLengthIn(s),available),panels=s.panels??1;
      if(product.panel&&product.post){
        // Stock panels cannot be trimmed: draw the whole panels that fit.
        const fit=Math.floor((available-product.post.widthIn)/(product.panel.widthIn+product.post.widthIn));
        if(fit<1){warnings.push(`${label} does not fit that edge; ${skipped}.`);return;}
        if(fit<panels){warnings.push(`${label} fits ${fit} of ${panels} ${product.name} panels on that edge.`);panels=fit;}
        len=panels*product.panel.widthIn+(panels+1)*product.post.widthIn;
      }else{
        if(len<=0){warnings.push(`${label} does not fit that edge; ${skipped}.`);return;}
        if(s.lengthFt*12>available+.5)warnings.push(`${label} fits ${(len/12).toFixed(1)} of ${s.lengthFt} ft on that edge.`);
      }
      // 0% = house end on side edges, left end on front/back edges, whatever the outline winding.
      const reversed=Math.abs(e.dz)>.7?e.dz<0:e.dx<0,pct=reversed?100-s.offsetPct:s.offsetPct;
      const t=12+(available-len)*pct/100+len/2,x=e.p.x+e.dx*t-e.dz*14,z=e.p.y+e.dz*t+e.dx*14;
      if(model.treads.some(tr=>Math.abs(tr.y-top)<9&&Math.hypot(tr.x-x,tr.z-z)<len/2+24)){warnings.push(`${label} overlaps the stair opening; ${skipped}. Slide it along the edge or shorten it.`);return;}
      const angle=-Math.atan2(e.dz,e.dx),heightIn=product.post?product.post.heightIn:s.heightFt*12;
      if(product.panel&&product.post){
        const {widthIn:pw,heightIn:ph,thicknessIn}=product.panel,{widthIn:postW,heightIn:postH}=product.post;
        const at=(along:number)=>({x:x+e.dx*along+e.dz*10,z:z+e.dz*along-e.dx*10});
        for(let k=0;k<=panels;k++){const along=-len/2+postW/2+k*(pw+postW),q=at(along);metal.push({x:q.x,y:top+postH/2,z:q.z,w:postW,h:postH,d:postW,angle});if(s.lights)privacyMounts.push({x:q.x-e.dz*(postW/2+.85),z:q.z+e.dx*(postW/2+.85),y:top+postH-10,angle});}
        for(let k=0;k<panels;k++){const q=at(-len/2+postW+k*(pw+postW)+pw/2);panelBoxes.push({x:q.x,y:top+3+ph/2,z:q.z,w:pw,h:ph,d:thicknessIn,angle,finish:s.finish??'Black',design:s.design??product.designs[0],screenId:s.id});}
      }else screen(x,z,len,angle,e.dx,e.dz,heightIn,s.lights);
      screenHandles.push({id:s.id,x:x+e.dz*10,y:top+heightIn/2,z:z-e.dx*10,w:len,h:heightIn,angle,edge:{x:e.p.x,z:e.p.y,dx:e.dx,dz:e.dz,available,len,reversed}});
    });
  }else{
    const screenRemaining=allocate(Math.max(0,data.privacySqft)/6*12,(x,z,len,angle,dx,dz)=>screen(x,z,len,angle,dx,dz,72,false));
    if(screenRemaining>.1)warnings.push(`Privacy layout fits ${(data.privacySqft-screenRemaining/2).toFixed(1)} of ${data.privacySqft} requested square feet at 6 ft high.`);
  }
  function inside(x:number,z:number){let odd=false;for(let i=0,j=fp.outline.length-1;i<fp.outline.length;j=i++){const a=fp.outline[i],b=fp.outline[j];if((a.y>z)!==(b.y>z)&&x<(b.x-a.x)*(z-a.y)/(b.y-a.y)+a.x)odd=!odd;}return odd;}
  // Largest centred rectangle contained by the actual polygon, sampled at 6-inch increments.
  let pergolaArea=0;
  if(data.pergolaSqft>0){let best={x:0,z:0,w:0,d:0};const wanted=data.pergolaSqft*144;
    const cell=12,cols=Math.max(0,Math.floor((fp.bounds.w-12)/cell)),rows=Math.max(0,Math.floor((fp.bounds.h-12)/cell));
    const runs=Array.from({length:rows},()=>Array(cols).fill(0));
    for(let row=0;row<rows;row++)for(let col=cols-1;col>=0;col--){const x=6+col*cell,z=6+row*cell;const fits=[[x,z],[x+cell,z],[x,z+cell],[x+cell,z+cell]].every(([px,pz])=>inside(px,pz));runs[row][col]=fits?1+(runs[row][col+1]||0):0;}
    for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){let available=Infinity;for(let end=row;end<rows;end++){available=Math.min(available,runs[end][col]);if(available<2)break;const d=(end-row+1)*cell,w=Math.min(available*cell,Math.floor(wanted/d/6)*6);if(d>=24&&w>=24&&w*d>best.w*best.d)best={x:6+col*cell,z:6+row*cell,w,d};}}
    const {x,z,w,d}=best;pergolaArea=w*d/144;
    if(w&&d){for(const px of [x+3,x+w-3])for(const pz of [z+3,z+d-3])wood.push({x:px,y:top+48,z:pz,w:5.5,h:96,d:5.5});for(const pz of [z,z+d])wood.push({x:x+w/2,y:top+97,z:pz,w:w+12,h:9.25,d:3});for(let px=x;px<=x+w;px+=16)wood.push({x:px,y:top+104,z:z+d/2,w:1.5,h:7.25,d:d+18});for(let pz=z;pz<=z+d;pz+=12)wood.push({x:x+w/2,y:top+109,z:pz,w:w+18,h:1.5,d:1.5});}
    if(pergolaArea<data.pergolaSqft-1)warnings.push(`Pergola layout fits ${pergolaArea.toFixed(1)} of ${data.pergolaSqft} requested square feet within the footprint.`);
  }
  if(data.hasDrainage)for(const l of model.levels){if(l.top<24){warnings.push('Under-deck drainage needs at least 24 in of model clearance; raise the deck or remove drainage.');continue;}for(const j of l.joists){const len=Math.hypot(j.b.x-j.a.x,j.b.z-j.a.z);drainage.push({x:(j.a.x+j.b.x)/2,y:j.a.y-6,z:(j.a.z+j.b.z)/2,w:Math.max(4,data.joistSpacing-1.5),h:.15,d:len,angle:Math.atan2(j.b.x-j.a.x,j.b.z-j.a.z)});}drainage.push({x:l.offset.x+l.footprint.bounds.w/2,y:l.top-20,z:l.offset.z+l.footprint.bounds.h-2,w:l.footprint.bounds.w,h:3,d:4});drainage.push({x:l.offset.x+3,y:Math.max(4,(l.top-20)/2),z:l.offset.z+l.footprint.bounds.h+1,w:3,h:Math.max(3,l.top-20),d:3});}
  const perimeter=edges.reduce((s,e)=>s+e.len,0);
  function perimeterPoint(index:number,count:number){let t=(index+.5)*perimeter/Math.max(1,count);for(const e of edges){if(t<=e.len)return {x:e.p.x+e.dx*t-e.dz*4,z:e.p.y+e.dz*t+e.dx*4,angle:-Math.atan2(e.dz,e.dx)};t-=e.len;}return {x:6,z:6,angle:0};}
  const selected=activeLightingItems(data),counts=new Map<string,number>(),indices=new Map<string,number>();
  for(const item of selected)counts.set(item.zone,(counts.get(item.zone)??0)+item.qty);
  const house=getHouseConfig(data),houseVisible=data.houseVisible!==false,houseLeft=getHousePlacement(data).x0;
  let utilityIndex=0;
  for(const item of selected)for(let i=0;i<item.qty;i++){
    const index=indices.get(item.zone)??0;indices.set(item.zone,index+1);
    const p=perimeterPoint(index,counts.get(item.zone)??1),g=item.geometry,d=item.dimensionsIn,zone=item.zone;
    let y=top+.15;
    if(isSystemProduct(item)){
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
      const post=model.railing.posts[index%Math.max(1,model.railing.posts.length)];
      if(!post){warnings.push(`${item.name}: the posts zone requires railing posts.`);continue;}
      p.x=post.x;p.z=post.z+1.9+(d.width??1)/2;y=post.y+model.railing.height-7-Math.floor(index/model.railing.posts.length)*8;p.angle=0;
      if(g==='recessed'){p.z=post.z;y=post.y+model.railing.height+.18;}
      if(!['wall','recessed','undercap'].includes(g)){warnings.push(`${item.name} cannot use a post mount; choose a compatible fixture or installation zone.`);continue;}
      if((d.length??d.diameter??d.width??2)>3.5)warnings.push(`${item.name} is wider than a modeled 3.5 in railing post; a manufacturer-approved mounting plate or another location is required.`);
    }else if(zone==='stairs'){
      const t=model.treads[index%Math.max(1,model.treads.length)];
      if(!t){warnings.push(`${item.name}: the stairs zone needs a stair flight.`);continue;}
      const a=t.angle??0,nx=Math.sin(a),nz=Math.cos(a),along=[0,-1,1][Math.floor(index/model.treads.length)%3]*t.w*.25;
      p.x=t.x+Math.cos(a)*along;p.z=t.z-Math.sin(a)*along;p.angle=a;
      if(g==='recessed')y=t.y+t.h/2+.15;
      else if(g==='wall'||g==='undercap'){
        const mount=t.d/2-(g==='undercap'?.1:model.stairSupport.treadNosingIn-(d.width??1)/2);
        p.x+=nx*mount;p.z+=nz*mount;y=t.y-t.h/2-(g==='undercap'?.55:2.7);
        if((d.length??d.diameter??d.width??2)>t.w-4){warnings.push(`${item.name} is too long for this tread; choose a shorter fixture or a deck/house location.`);continue;}
      }else{warnings.push(`${item.name} is not a recessed or surface stair fixture; choose its intended installation zone.`);continue;}
    }else if(zone==='house'&&g==='wall'){
      if(!houseVisible){warnings.push(`${item.name}: enable the house to place wall fixtures.`);continue;}
      p.x=houseLeft+12+(house.widthFt*12-24)*(index+.5)/(counts.get(zone)??1);p.z=2;y=Math.min(house.storeys*house.storeyHeightIn-12,top+66);p.angle=0;
      // Move clear of real openings, keeping the fixture attached to an opaque wall.
      for(const o of house.openings.filter(o=>o.facade==='Front')){const ox=houseLeft+o.offsetPct/100*house.widthFt*12;if(Math.abs(p.x-ox)<o.widthIn/2+5&&y>o.bottomIn-5&&y<o.bottomIn+o.heightIn+5)y=Math.min(house.storeys*house.storeyHeightIn-8,o.bottomIn+o.heightIn+7);}
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
  return {wood,metal,drainage,fixtures,warnings:[...new Set(warnings)],pergolaArea,privacyMounts,panels:panelBoxes,screenHandles};
}
