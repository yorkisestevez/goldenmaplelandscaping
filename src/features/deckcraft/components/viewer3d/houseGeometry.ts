import type {DeckData,HouseConfig,HouseOpening} from '../../types';
import type {Box} from '../../deckTakeoff';
import {clampHouseOpening} from '../../houseSettings';
import {getHouseBlocks,getHouseWalls,openingHidden,openingWallId,SIDE_FACADE,type HouseBlockPlan,type HouseWallPlan} from '../../houseFootprint';
import {houseLayout,roofRiseOver} from './houseLayout';
import {houseWallParts} from './houseWallParts';

export type HouseVertex=[number,number,number];
export interface HouseMesh {name:string;color:string;vertices:HouseVertex[];faces:number[][]}

/** Roof rise (inches) over a block, at the studio's fixed pitch. */
export function blockRoofRise(block:Pick<HouseBlockPlan,'rect'|'roofShape'|'ridge'>,pitch?:number){
 const w=block.rect.x1-block.rect.x0,d=block.rect.y1-block.rect.y0;
 return block.roofShape==='Flat'?6:roofRiseOver(block.roofShape==='Hip'?Math.min(w,d):block.ridge==='x'?d:w,pitch);
}

/** Roof over one block rectangle with a 12 in eave all round. Gable ridges run along z (plan y) or x. */
function roofMesh({x0,x1,y0,y1,h,r,shape,ridge,color,name}:{x0:number;x1:number;y0:number;y1:number;h:number;r:number;shape:HouseConfig['roofShape'];ridge:'x'|'z';color:string;name:string}):HouseMesh{
 const l=x0-12,right=x1+12,f=y1+12,b=y0-12,cx=(x0+x1)/2,flat=shape==='Flat';
 const a:HouseVertex=[l,h+(flat?6:0),f],bb:HouseVertex=[right,a[1],f],c:HouseVertex=[right,a[1],b],d:HouseVertex=[l,a[1],b],polys:HouseVertex[][]=[];
 if(flat)polys.push([a,bb,c,d]);
 else if(shape==='Gable'&&ridge==='x'){const cz=(f+b)/2,rl:HouseVertex=[l,h+r,cz],rr:HouseVertex=[right,h+r,cz];polys.push([a,bb,rr,rl],[rl,rr,c,d]);}
 else if(shape==='Gable'){const rf:HouseVertex=[cx,h+r,f],rb:HouseVertex=[cx,h+r,b];polys.push([a,rf,rb,d],[rf,bb,c,rb]);}
 else if(right-l>=f-b){const rl:HouseVertex=[l+(f-b)/2,h+r,(f+b)/2],rr:HouseVertex=[right-(f-b)/2,h+r,(f+b)/2];polys.push([a,bb,rr,rl],[d,c,rr,rl],[a,d,rl],[bb,c,rr]);}
 else {const rf:HouseVertex=[cx,h+r,f-(right-l)/2],rb:HouseVertex=[cx,h+r,b+(right-l)/2];polys.push([a,d,rb,rf],[bb,c,rb,rf],[a,bb,rf],[d,c,rb]);}
 const mesh:HouseMesh={name,color,vertices:[],faces:[]},boundary=new Map<string,{a:HouseVertex;b:HouseVertex;count:number}>(),t=flat?6:4;
 const triangle=(p:HouseVertex,q:HouseVertex,s:HouseVertex,up?:boolean)=>{const nx=(q[1]-p[1])*(s[2]-p[2])-(q[2]-p[2])*(s[1]-p[1]),ny=(q[2]-p[2])*(s[0]-p[0])-(q[0]-p[0])*(s[2]-p[2]),nz=(q[0]-p[0])*(s[1]-p[1])-(q[1]-p[1])*(s[0]-p[0]);if(nx*nx+ny*ny+nz*nz<1e-10)return;if(up!==undefined&&(ny>0)!==up)[q,s]=[s,q];const i=mesh.vertices.length;mesh.vertices.push(p,q,s);mesh.faces.push([i,i+1,i+2]);};
 const lower=(p:HouseVertex):HouseVertex=>[p[0],p[1]-t,p[2]];
 for(const face of polys){for(let i=1;i<face.length-1;i++){triangle(face[0],face[i],face[i+1],true);triangle(lower(face[0]),lower(face[i]),lower(face[i+1]),false);}for(let i=0;i<face.length;i++){const x=face[i],y=face[(i+1)%face.length],key=[x.join(':'),y.join(':')].sort().join('|'),found=boundary.get(key);if(found)found.count++;else boundary.set(key,{a:x,b:y,count:1});}}
 for(const {a:x,b:y,count} of boundary.values())if(count===1){triangle(x,y,lower(y));triangle(x,lower(y),lower(x));}
 return mesh;
}

export function houseRoofMesh(layout:ReturnType<typeof houseLayout>):HouseMesh{
 const {minX,maxX,depth,wallHeight,roofRise,config}=layout;
 return roofMesh({x0:minX,x1:maxX,y0:-depth,y1:0,h:wallHeight,r:roofRise,shape:config.roofShape,ridge:config.ridge==='x'?'x':'z',color:config.roofColor,name:'roof'});
}
export function blockRoofMesh(block:HouseBlockPlan,config:HouseConfig):HouseMesh{
 const {x0,x1,y0,y1}=block.rect;
 return roofMesh({x0,x1,y0,y1,h:block.wallHeightIn,r:blockRoofRise(block,config.roofPitch),shape:block.roofShape,ridge:block.ridge,color:config.roofColor,name:`${block.id}_roof`});
}
/** Triangular gable-end walls of a gable-roofed block. */
export function blockGableMesh(block:HouseBlockPlan,color:string,name:string,pitch?:number):HouseMesh|null{
 if(block.roofShape!=='Gable')return null;
 const {x0,x1,y0,y1}=block.rect,h=block.wallHeightIn,r=blockRoofRise(block,pitch);
 if(block.ridge==='x'){const cz=(y0+y1)/2;return {name,color,vertices:[[x0,h,y1],[x0,h+r,cz],[x0,h,y0],[x1,h,y1],[x1,h+r,cz],[x1,h,y0]],faces:[[0,1,2],[3,5,4],[0,3,4,1],[1,4,5,2],[0,2,5,3]]};}
 const cx=(x0+x1)/2;
 return {name,color,vertices:[[x0,h,y1],[cx,h+r,y1],[x1,h,y1],[x0,h,y0],[cx,h+r,y0],[x1,h,y0]],faces:[[0,2,1],[3,4,5],[0,1,4,3],[1,2,5,4],[0,3,5,2]]};
}

export interface HouseWallSpec{wall:HouseWallPlan;block:HouseBlockPlan;
  /** Mesh name prefix: 'Front' … 'Right' on the main block (as always), '<block id>_<side>' on blocks. */
  name:string;span:number;height:number;origin:HouseVertex;yaw:number;
  /** Local x stretches inside another block. */
  hidden:[number,number][];
  openings:HouseOpening[]}
const YAW={front:0,back:Math.PI,left:-Math.PI/2,right:Math.PI/2};

/** Every house wall in its facade frame: local x runs along the wall (offsetPct 0 → 100 %), local +z points outward. */
export function houseWallSpecs(data:DeckData,config:HouseConfig,blocks:HouseBlockPlan[]=getHouseBlocks(data)):HouseWallSpec[]{
 const walls=getHouseWalls(data,blocks);
 return walls.map(wall=>{
  const block=blocks.find(b=>b.id===wall.blockId)!,r=block.rect,cx=(r.x0+r.x1)/2,cz=(r.y0+r.y1)/2,span=wall.lengthIn;
  const origin:HouseVertex=wall.side==='front'?[cx,0,r.y1]:wall.side==='back'?[cx,0,r.y0]:wall.side==='left'?[r.x0,0,cz]:[r.x1,0,cz];
  const openings=config.openings.filter(o=>openingWallId(o,config)===wall.id&&!openingHidden(o,walls,config)).map(o=>clampHouseOpening(o,config));
  return {wall,block,name:block.id==='main'?SIDE_FACADE[wall.side]:`${block.id}_${wall.side}`,span,height:block.wallHeightIn,origin,yaw:YAW[wall.side],hidden:wall.covered.map(([s,e])=>[s-span/2,e-span/2] as [number,number]),openings};
 });
}

export const GARAGE_DOOR_COLOR='#e4e2da';
export const DOOR_SLAB_COLOR='#4a5452';
export const WINDOW_FRAME_COLOR='#e9e6dc';
const GLASS='#c1d1d3';

/**
 * The solid faces of an opening in its facade frame, as exported (the 3D view adds finer detail).
 * A door without a style keeps the studio's original single glass panel.
 */
export function openingFaces(o:HouseOpening,x:number,y:number):[string,string,Box][]{
 const w=o.widthIn-3,h=o.heightIn-3;
 if(o.type==='Garage')return [['panel',GARAGE_DOOR_COLOR,{x,y,z:.8,w,h,d:1.5}]];
 if(!o.style)return [['glass',GLASS,{x,y,z:.8,w,h,d:.24}]];
 if(o.type==='Window'){
  const frame=WINDOW_FRAME_COLOR;
  if(o.style==='Double-hung')return [['glass',GLASS,{x,y:y+h/4,z:.8,w,h:h/2,d:.24}],['sash',GLASS,{x,y:y-h/4,z:1.6,w,h:h/2,d:.24}],['meeting_rail',frame,{x,y,z:1.2,w,h:2,d:1.2}]];
  if(o.style==='Slider')return [['glass',GLASS,{x:x-w/4,y,z:.8,w:w/2,h,d:.24}],['sash',GLASS,{x:x+w/4,y,z:1.6,w:w/2,h,d:.24}],['meeting_stile',frame,{x,y,z:1.2,w:2,h,d:1.2}]];
  if(o.style==='Casement'&&w>40)return [['glass',GLASS,{x,y,z:.8,w,h,d:.24}],['mullion',frame,{x,y,z:1.2,w:2.5,h,d:1.4}]];
  if(o.style==='Awning')return [['glass',GLASS,{x,y,z:.8,w,h,d:.24}],['bottom_rail',frame,{x,y:y-h/2+1.25,z:1.4,w,h:2.5,d:1.4}]];
  // Picture (and a single casement): one pane with a deeper sill.
  return [['glass',GLASS,{x,y,z:.8,w,h,d:.24}],['sill',frame,{x,y:y-h/2-1,z:2.2,w:w+4,h:1.5,d:3}]];
 }
 if(o.type!=='Door')return [['glass',GLASS,{x,y,z:.8,w,h,d:.24}]];
 if(o.style==='Single')return [['slab',DOOR_SLAB_COLOR,{x,y,z:.8,w,h,d:1.75}],['lite',GLASS,{x,y:y+h*.22,z:1.7,w:w*.5,h:h*.3,d:.24}]];
 if(o.style==='French')return [['glass',GLASS,{x,y,z:.8,w,h,d:.24}],['stile',DOOR_SLAB_COLOR,{x,y,z:1.2,w:3,h,d:1.75}]];
 // Sliding patio door: a fixed pane and a sliding sash that overlaps it by 2 in, set further out.
 return [['glass',GLASS,{x:x-w/4-.5,y,z:.8,w:w/2+1,h,d:.24}],['sash',GLASS,{x:x+w/4+.5,y,z:2.2,w:w/2+1,h,d:.24}],['meeting_stile',DOOR_SLAB_COLOR,{x,y,z:1.5,w:2.5,h,d:1.75}]];
}

export function buildHouseGeometry(data:DeckData,width:number):{parts:HouseMesh[]}{
 const layout=houseLayout(data,width),{config,minX,maxX,depth,wallHeight}=layout,cx=(minX+maxX)/2,parts:HouseMesh[]=[];
 if(!layout.visible)return {parts};
 const box=(name:string,color:string,b:Box,origin:HouseVertex=[0,0,0],yaw=0)=>{const vertices:HouseVertex[]=[];for(const z of [-b.d/2,b.d/2])for(const y of [-b.h/2,b.h/2])for(const x of [-b.w/2,b.w/2]){const px=b.x+x,pz=b.z+z;vertices.push([origin[0]+px*Math.cos(yaw)+pz*Math.sin(yaw),origin[1]+b.y+y,origin[2]-px*Math.sin(yaw)+pz*Math.cos(yaw)]);}parts.push({name,color,vertices,faces:[[0,2,3,1],[4,5,7,6],[0,1,5,4],[2,6,7,3],[0,4,6,2],[1,3,7,5]]});};
 const blocks=getHouseBlocks(data),specs=houseWallSpecs(data,config,blocks);
 const facade=(f:HouseWallSpec)=>{houseWallParts(f.span,f.height,f.openings,f.hidden).forEach((b,i)=>box(`${f.name}_wall_${i}`,config.claddingColor,b,f.origin,f.yaw));for(const o of f.openings){const x=-f.span/2+f.span*o.offsetPct/100,y=o.bottomIn+o.heightIn/2;for(const [part,color,b] of openingFaces(o,x,y))box(`${f.name}_${o.type}_${o.id}_${part}`,color,b,f.origin,f.yaw);for(const s of [-1,1]){box(`${o.id}_jamb_${s}`,config.trimColor,{x:x+s*(o.widthIn/2+1.5),y,z:1.8,w:3,h:o.heightIn+6,d:2.2},f.origin,f.yaw);box(`${o.id}_trim_${s}`,config.trimColor,{x,y:y+s*(o.heightIn/2+1.5),z:1.8,w:o.widthIn,h:3,d:2.2},f.origin,f.yaw);}}};
 // The main block builds exactly as it always has; attached blocks follow with their own names.
 for(const f of specs.filter(s=>s.block.id==='main'))facade(f);
 parts.push(houseRoofMesh(layout));
 // Gable ends face the deck and the street (ridge front to back, the original look) or the sides.
 const mainGable=blockGableMesh(blocks[0],config.claddingColor,'gable_walls',config.roofPitch);if(mainGable)parts.push(mainGable);
 box('foundation','#93968d',{x:cx,y:4,z:-depth/2,w:maxX-minX+1,h:8,d:depth+1});
 box('soffit',config.trimColor,{x:cx,y:wallHeight-.75,z:-depth/2,w:maxX-minX+20,h:1.5,d:depth+20});
 for(const block of blocks.slice(1)){
  const {x0,x1,y0,y1}=block.rect,bx=(x0+x1)/2,bz=(y0+y1)/2;
  for(const f of specs.filter(s=>s.block===block))facade(f);
  parts.push(blockRoofMesh(block,config));
  const gable=blockGableMesh(block,config.claddingColor,`${block.id}_gable_walls`,config.roofPitch);if(gable)parts.push(gable);
  box(`${block.id}_foundation`,'#93968d',{x:bx,y:4,z:bz,w:x1-x0+1,h:8,d:y1-y0+1});
  box(`${block.id}_soffit`,config.trimColor,{x:bx,y:block.wallHeightIn-.75,z:bz,w:x1-x0+20,h:1.5,d:y1-y0+20});
 }
 return {parts};
}
