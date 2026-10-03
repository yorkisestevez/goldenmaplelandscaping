import type {DeckData} from './types';
import type {Box,DeckTakeoff,Member} from './deckTakeoff';
import type {PlanPoint} from './lib/deckGeometry';
import {pergolaProduct,pergolaSize,pergolaVariant} from './pergolaCatalog';
import {buildYardModel,yardClip,yardArea} from './yardModel';
import {getHouseBlocks} from './houseFootprint';
import {getHouseConfig} from './houseSettings';
const rect=(x:number,z:number,w:number,d:number,a=0):PlanPoint[]=>[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>({x:x+Math.cos(a)*u*w/2-Math.sin(a)*v*d/2,y:z+Math.sin(a)*u*w/2+Math.cos(a)*v*d/2}));
const overlap=(a:PlanPoint[],b:PlanPoint[][])=>yardArea(yardClip([a],b,'intersection'))>0.001;
export function pergolaLayout(data:DeckData,model:DeckTakeoff,extraBoxes:Box[]=[],checkConflicts=true){
 const sel=data.pergola,p=sel&&pergolaProduct(sel),v=sel&&pergolaVariant(sel);if(!sel||!p||!v)return null;
 const dim=pergolaSize(sel),a=sel.rotationDeg*Math.PI/180,c=Math.cos(a),s=Math.sin(a),x=sel.xFt*12,z=sel.zFt*12;
 const yard=checkConflicts||sel.target.kind==='patio'?buildYardModel(data,model):{features:[]},deck=sel.target.kind==='deck'?model.levels.filter(l=>l.kind!=='landing'&&l.kind!=='winder')[sel.target.level]:undefined;
 const patio=sel.target.kind==='patio'?yard.features.find(f=>f.config.id===(sel.target.kind==='patio'?sel.target.featureId:'')&&f.config.kind==='patio'&&!f.excluded):undefined;
 const base=deck?.top??patio?.topIn??0,surface=deck?[(deck.deckingFootprint??deck.footprint).outline.map(q=>({x:q.x+deck.offset.x,y:q.y+deck.offset.z}))]:patio?.footprints??[];
 const footprint=rect(x,z,dim.widthIn,dim.depthIn,a),warnings:string[]=[],post=p.postIn??5;
 if(!surface.length)warnings.push('Aluminum pergola: selected support surface is missing or disabled.');
 else if(yardArea(yardClip([footprint],surface,'difference'))>.001)warnings.push('Aluminum pergola: full roof footprint extends beyond the selected surface. Move the kit or choose a larger surface; kit dimensions are unchanged.');
 const H=dim.heightIn,roofLow=base+H-8,roofHigh=base+H+Math.max(0,Math.abs(Math.sin(sel.louverDeg*Math.PI/180))*4-3.6);
 if(!checkConflicts)return {footprint,base,roofHigh,dimensions:dim,warnings,conceptual:!v.dimensions||p.custom};
 const postPolys:PlanPoint[][]=[];
 for(const px of [-1,1])for(const pz of [-1,1]){const lx=px*(dim.widthIn-post)/2,lz=pz*(dim.depthIn-post)/2;postPolys.push(rect(x+c*lx-s*lz,z+s*lx+c*lz,post,post,a));}
 const obstacles:{name:string;poly:PlanPoint[];lo:number;hi:number}[]=[];
 const box=(name:string,b:Box)=>obstacles.push({name,poly:b.polygon??rect(b.x,b.z,b.w,b.d,-(b.angle??0)),lo:b.y-b.h/2,hi:b.y+b.h/2});
 const member=(name:string,m:Member)=>{const dx=m.b.x-m.a.x,dz=m.b.z-m.a.z,len=Math.hypot(dx,dz);obstacles.push({name,poly:rect((m.a.x+m.b.x)/2,(m.a.z+m.b.z)/2,len||m.width,m.width,Math.atan2(dz,dx)),lo:Math.min(m.a.y,m.b.y)-m.depth/2,hi:Math.max(m.a.y,m.b.y)+m.depth/2});};
 model.treads.forEach(b=>box('stairs',b));model.railing.posts.forEach(q=>box('railings',{...q,y:q.y+model.railing.height/2,w:3.5,d:3.5,h:model.railing.height}));
 [...model.railing.rails,...model.railing.glass,...model.railing.balusters].forEach(m=>member('railings',m));extraBoxes.forEach(b=>box('deck extras',b));
 model.levels.filter(l=>l!==deck).forEach(l=>{obstacles.push({name:'another deck elevation',poly:l.footprint.outline.map(q=>({x:q.x+l.offset.x,y:q.y+l.offset.z})),lo:l.top-12,hi:l.top});});
 yard.features.filter(f=>f!==patio).forEach(f=>{f.boxes.forEach(b=>box(f.config.name,b));f.members.forEach(m=>member(f.config.name,m));});
 // Conservative solid wall/block and eave envelopes; an opening is not a pergola passage.
if(data.houseVisible!==false)for(const block of getHouseBlocks(data)){
 const {x0,x1,y0,y1}=block.rect,cx=(x0+x1)/2,cz=(y0+y1)/2,w=x1-x0,d=y1-y0,H=block.wallHeightIn;
 obstacles.push({name:'house',poly:rect(cx,cz,w,d),lo:0,hi:H});
 const config=getHouseConfig(data),span=block.roofShape==='Hip'?Math.min(w,d):block.ridge==='x'?d:w,rise=block.roofShape==='Flat'?6:config.roofPitch===undefined?span*.24:span/2*config.roofPitch/12;
 obstacles.push({name:'house roof / eave clearance (conservative envelope)',poly:rect(cx,cz,w+24,d+24),lo:H-2,hi:H+rise});
}
 for(const o of obstacles){const roofHit=o.hi>=roofLow&&o.lo<=roofHigh&&overlap(footprint,[o.poly]);const postHit=o.hi>base+.1&&o.lo<H+base&&postPolys.some(poly=>overlap(poly,[o.poly]));if(roofHit||postHit)warnings.push(`Aluminum pergola: ${roofHit?'roof clearance':'post'} conflicts with ${o.name}.`);}
 if(patio&&data.terrainConfig?.slopePct)warnings.push('Aluminum pergola: sloped patio terrain requires individual post elevations and footing review; preview posts share the patio centre datum.');
 if(!v.dimensions||p.custom)warnings.push('Aluminum pergola: conceptual dimensions; obtain matching manufacturer drawings before confirming fit.');
 warnings.push('Aluminum pergola: post centres, profiles and connections are illustrative. 3D fit does not verify structural suitability, anchors, snow/wind ratings or drainage discharge.');
 return {footprint,base,roofHigh,dimensions:dim,warnings:[...new Set(warnings)],conceptual:!v.dimensions||p.custom};
}
