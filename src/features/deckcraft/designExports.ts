import type {DeckData} from './types';
import type {DeckTakeoff,Box,Member,V3} from './deckTakeoff';
import {getHardwareLayout} from './hardwareLayout';
import {extrasLayout} from './extrasLayout';
import {getStairBoards} from './stairBoards';
import {catalogueAccessoryLayout} from './catalogueAccessories';
import {getLightingProduct} from './lightingCatalogue';
import {buildHouseGeometry} from './components/viewer3d/houseGeometry';
import {buildYardModel} from './yardModel';
import {stairVeneerLayout} from './stairVeneerLayout';
import {stringerCutProfile} from './components/viewer3d/stringerProfile';
import type {PlanPoint} from './lib/deckGeometry';

export type ExportMesh={name:string;vertices:V3[];faces:number[][]};
const add=(a:V3,b:V3):V3=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const scale=(a:V3,s:number):V3=>({x:a.x*s,y:a.y*s,z:a.z*s});
const cross=(a:V3,b:V3):V3=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
const norm=(a:V3):V3=>scale(a,1/(Math.hypot(a.x,a.y,a.z)||1));
const faces=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]];
function prism(name:string,center:V3,x:V3,y:V3,z:V3):ExportMesh{
  const signs=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
  return {name,vertices:signs.map(([a,b,c])=>add(center,add(scale(x,a/2),add(scale(y,b/2),scale(z,c/2))))),faces};
}
function boxMesh(name:string,b:Box):ExportMesh{
  if(b.polygon?.length)return extrudePolygon(name,b.polygon,(p,t)=>({x:p.x,y:b.y-b.h/2+t*b.h,z:p.y}));
  const a=b.angle||0;return prism(name,b,{x:Math.cos(a)*b.w,y:0,z:-Math.sin(a)*b.w},{x:0,y:b.h,z:0},{x:Math.sin(a)*b.d,y:0,z:Math.cos(a)*b.d});
}
/** Ear clipping keeps concave notches and clipped corners instead of filling their bounds. */
function extrudePolygon(name:string,input:PlanPoint[],at:(p:PlanPoint,t:number)=>V3):ExportMesh{
  const poly=input.filter((p,i)=>{const q=input[(i+input.length-1)%input.length];return Math.hypot(p.x-q.x,p.y-q.y)>1e-7;});
  const turn=(a:PlanPoint,b:PlanPoint,c:PlanPoint)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  const area=poly.reduce((sum,p,i)=>{const q=poly[(i+1)%poly.length];return sum+p.x*q.y-q.x*p.y;},0);
  if(area<0)poly.reverse();
  const remaining=poly.map((_,i)=>i),triangles:number[][]=[];
  while(remaining.length>3){let found=false;for(let i=0;i<remaining.length;i++){
    const a=remaining[(i+remaining.length-1)%remaining.length],b=remaining[i],c=remaining[(i+1)%remaining.length];
    if(Math.abs(turn(poly[a],poly[b],poly[c]))<1e-7){remaining.splice(i,1);found=true;break;}
    if(turn(poly[a],poly[b],poly[c])<0)continue;
    if(remaining.some(k=>k!==a&&k!==b&&k!==c&&turn(poly[a],poly[b],poly[k])>=-1e-7&&turn(poly[b],poly[c],poly[k])>=-1e-7&&turn(poly[c],poly[a],poly[k])>=-1e-7))continue;
    triangles.push([a,b,c]);remaining.splice(i,1);found=true;break;
  }if(!found)throw new Error(`Cannot triangulate ${name}; the outline needs review.`);}
  if(remaining.length===3)triangles.push([...remaining]);
  const n=poly.length,vertices=[...poly.map(p=>at(p,0)),...poly.map(p=>at(p,1))];
  const fs=[...triangles.map(t=>[...t].reverse()),...triangles.map(t=>t.map(i=>i+n)),...poly.map((_,i)=>[i,(i+1)%n,(i+1)%n+n,i+n])];
  const volume=fs.reduce((sum,face)=>sum+face.slice(1,-1).reduce((s,_,i)=>{const a=vertices[face[0]],b=vertices[face[i+1]],c=vertices[face[i+2]],bc=cross(b,c);return s+(a.x*bc.x+a.y*bc.y+a.z*bc.z)/6;},0),0);
  return {name,vertices,faces:volume<0?fs.map(face=>[...face].reverse()):fs};
}
function stringerMesh(name:string,m:Member,model:DeckTakeoff):ExportMesh{
  const poly=stringerCutProfile(m,model);
  const yaw=-Math.atan2(m.b.z-m.a.z,m.b.x-m.a.x),c=Math.cos(yaw),sn=Math.sin(yaw);
  return extrudePolygon(name,poly,(p,t)=>({x:m.a.x+c*p.x+sn*(t-.5)*m.width,y:p.y,z:m.a.z-sn*p.x+c*(t-.5)*m.width}));
}
function memberMesh(name:string,m:Member):ExportMesh{
  const axis={x:m.b.x-m.a.x,y:m.b.y-m.a.y,z:m.b.z-m.a.z},direction=norm(axis);
  const side=norm(cross(direction,Math.abs(direction.y)>.99?{x:1,y:0,z:0}:{x:0,y:1,z:0}));
  const vertical=norm(cross(side,direction));return prism(name,scale(add(m.a,m.b),.5),axis,scale(vertical,m.depth),scale(side,m.width));
}
function cylinder(name:string,x:number,z:number,bottom:number,top:number,radius:number):ExportMesh{
  const count=16,vertices:V3[]=[];for(const y of [bottom,top])for(let i=0;i<count;i++){const a=i/count*Math.PI*2;vertices.push({x:x+Math.cos(a)*radius,y,z:z+Math.sin(a)*radius});}
  const fs:number[][]=[Array.from({length:count},(_,i)=>count-1-i),Array.from({length:count},(_,i)=>i+count)];
  for(let i=0;i<count;i++)fs.push([i,(i+1)%count,(i+1)%count+count,i+count]);return {name,vertices,faces:fs};
}

/** Inch-scale solids from the same takeoff used by the estimate and viewer. */
export function deckExportMeshes(data:DeckData,model:DeckTakeoff):ExportMesh[]{
  const out:ExportMesh[]=[];
  for(const part of buildHouseGeometry(data,data.width*12).parts)out.push({name:`house_${part.name}`,vertices:part.vertices.map(([x,y,z])=>({x,y,z})),faces:part.faces});
  const boxes=(name:string,items:Box[])=>items.forEach((b,i)=>out.push(boxMesh(`${name}_${i+1}`,b)));
  const members=(name:string,items:Member[])=>items.forEach((m,i)=>out.push(memberMesh(`${name}_${i+1}`,m)));
  const yard=buildYardModel(data,model);
  for(const b of yard.boxes)out.push(boxMesh(`yard_${b.id}`,b));
  for(const m of yard.members)out.push(memberMesh(`yard_${m.id}`,m));
  model.levels.forEach((l,index)=>{
    const name=`level_${index+1}`;
    boxes(`${name}_board`,l.boards.map(b=>({x:b.cx+l.offset.x,y:l.top-.5,z:b.cy+l.offset.z,w:b.length,h:1,d:b.width??data.boardWidth,angle:-b.angleDeg*Math.PI/180,polygon:b.polygon?.map(p=>({x:p.x+l.offset.x,y:p.y+l.offset.z}))})));
    members(`${name}_joist`,l.joists);members(`${name}_beam`,l.beams);members(`${name}_blocking`,l.blocking);
    members(`${name}_rim`,l.rim??[]);
    const postBase=data.foundation==='Deck Blocks'?6.5:4.5;
    boxes(`${name}_post`,l.supports.filter(p=>p.y>postBase).map(p=>({x:p.x,y:(p.y+postBase)/2,z:p.z,w:5.5,h:p.y-postBase,d:5.5})));
    l.supports.forEach((p,i)=>{
      const depth=data.foundationDepthIn??48;
      if(data.foundation==='Deck Blocks')out.push(boxMesh(`${name}_deck_block_${i}`,{x:p.x,y:3,z:p.z,w:12,h:6,d:12}));
      else if(data.foundation==='Helical Piles'){
        out.push(cylinder(`${name}_pile_shaft_${i}`,p.x,p.z,-depth,2,1.4));
        out.push(cylinder(`${name}_pile_helix_${i}`,p.x,p.z,-depth+4,-depth+4.3,6));
      }else out.push(cylinder(`${name}_concrete_pier_${i}`,p.x,p.z,-depth,2,6));
      out.push(boxMesh(`${name}_post_base_${i}`,{x:p.x,y:data.foundation==='Deck Blocks'?6.25:4.25,z:p.z,w:7,h:.4,d:7}));
    });
  });
  boxes('stair_tread_board',getStairBoards(data,model));boxes('closed_stair_riser',model.riserBoards);model.stringers.forEach((m,i)=>out.push(stringerMesh(`stair_stringer_${i+1}`,m,model)));
  const veneer=stairVeneerLayout(data,model);boxes('stair_veneer_2x6',veneer.woodBoxes);boxes('stair_veneer_angle',veneer.bracketBoxes);
  boxes('railing_post',model.railing.posts.map(p=>({x:p.x,y:p.y+model.railing.height/2,z:p.z,w:3.5,h:model.railing.height,d:3.5})));
  members('rail',model.railing.rails);members('baluster',model.railing.balusters);members('glass_panel',model.railing.glass);
  const hardware=getHardwareLayout(data,model);
  boxes('joist_hanger',hardware.hangers.map(p=>({x:p.x,y:p.y,z:p.z,w:1.8,h:6,d:1.7})));
  boxes('ledger_bolt',hardware.ledgerBolts.map(p=>({x:p.x,y:p.y,z:p.z,w:.5,h:.5,d:3})));
  boxes(hardware.hidden?'hidden_clip':'deck_screw',hardware.screws.map(p=>({x:p.x,y:p.y-.6,z:p.z,w:hardware.hidden?.6:.18,h:hardware.hidden?.12:1.2,d:hardware.hidden?.4:.18})));
  const extras=extrasLayout(data,model);boxes('bench_privacy_pergola_wood',extras.wood);boxes('extra_metal',extras.metal);boxes('drainage',extras.drainage);boxes('privacy_panel',extras.panels);
  const accessories=catalogueAccessoryLayout(data,model);members('manufacturer_fascia',accessories.fascia);boxes('joist_tape',accessories.tape);boxes('ledger_flashing',accessories.flashing);
  extras.fixtures.forEach((p,i)=>{
    const product=getLightingProduct(p.productId),dim=product?.dimensionsIn??{},g=product?.geometry,h=dim.height??(g==='bollard'?18:g==='transformer'?12:1),w=dim.length??dim.diameter??dim.width??2,d=dim.diameter??dim.width??2;
    const y=p.y+(g==='bollard'||g==='spot'?h/2:g==='pendant'?-18-h/2:g==='ceiling'?-h/2:0);
    out.push(boxMesh(`light_${p.productId}_${i+1}`,{x:p.x,y,z:p.z,w,h,d,angle:p.angle}));
  });
  if(out.some(m=>!m.vertices.every(v=>[v.x,v.y,v.z].every(Number.isFinite))))throw new Error('The export contains an invalid coordinate. Review the design dimensions.');
  return out;
}
const f=(n:number)=>Number(n.toFixed(5)).toString();
export function exportDeckOBJ(data:DeckData,model:DeckTakeoff):string{
  const lines=['# Golden Maple Deck Studio — modeled construction solids','# Units: inches; X along house, Y up, Z toward yard.','# Planning model; fixture/hardware envelopes are schematic. Engineering and site confirmation required.'];let offset=1;
  for(const m of deckExportMeshes(data,model)){lines.push(`o ${m.name}`,...m.vertices.map(v=>`v ${f(v.x)} ${f(v.y)} ${f(v.z)}`),...m.faces.map(face=>`f ${face.map(i=>i+offset).join(' ')}`));offset+=m.vertices.length;}
  return lines.join('\n')+'\n';
}
export function exportDeckDXF(data:DeckData,model:DeckTakeoff):string{
  const lines=['0','SECTION','2','HEADER','9','$ACADVER','1','AC1015','9','$INSUNITS','70','1','0','ENDSEC','0','SECTION','2','ENTITIES'];
  // DXF is Z-up: convert the shared model's (x,y,z) to (x,z,y).
  const point=(v:V3,i:number)=>[String(10+i),f(v.x),String(20+i),f(v.z),String(30+i),f(v.y)];
  for(const m of deckExportMeshes(data,model))for(const face of m.faces){
    // Fan triangulation is safe for these convex box/cylinder faces.
    for(let i=1;i<face.length-1;i++){
      const a=m.vertices[face[0]],b=m.vertices[face[i]],c=m.vertices[face[i+1]];
      lines.push('0','3DFACE','8',m.name,...point(a,0),...point(b,1),...point(c,2),...point(c,3));
    }
  }
  lines.push('0','ENDSEC','0','EOF');return lines.join('\n')+'\n';
}
