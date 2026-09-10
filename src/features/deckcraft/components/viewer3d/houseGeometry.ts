import type {DeckData,HouseOpening} from '../../types';
import type {Box} from '../../deckTakeoff';
import {clampHouseOpening} from '../../houseSettings';
import {houseLayout} from './houseLayout';
import {houseWallParts} from './houseWallParts';

export type HouseVertex=[number,number,number];
export interface HouseMesh {name:string;color:string;vertices:HouseVertex[];faces:number[][]}
export function houseRoofMesh(layout:ReturnType<typeof houseLayout>):HouseMesh{
 const {minX,maxX,depth,wallHeight:h,roofRise:r,config}=layout,l=minX-12,right=maxX+12,f=12,b=-depth-12,cx=(minX+maxX)/2,flat=config.roofShape==='Flat';
 const a:HouseVertex=[l,h+(flat?6:0),f],bb:HouseVertex=[right,a[1],f],c:HouseVertex=[right,a[1],b],d:HouseVertex=[l,a[1],b],polys:HouseVertex[][]=[];
 if(flat)polys.push([a,bb,c,d]);
 else if(config.roofShape==='Gable'){const rf:HouseVertex=[cx,h+r,f],rb:HouseVertex=[cx,h+r,b];polys.push([a,rf,rb,d],[rf,bb,c,rb]);}
 else if(right-l>=f-b){const rl:HouseVertex=[l+(f-b)/2,h+r,(f+b)/2],rr:HouseVertex=[right-(f-b)/2,h+r,(f+b)/2];polys.push([a,bb,rr,rl],[d,c,rr,rl],[a,d,rl],[bb,c,rr]);}
 else {const rf:HouseVertex=[cx,h+r,f-(right-l)/2],rb:HouseVertex=[cx,h+r,b+(right-l)/2];polys.push([a,d,rb,rf],[bb,c,rb,rf],[a,bb,rf],[d,c,rb]);}
 const mesh:HouseMesh={name:'roof',color:config.roofColor,vertices:[],faces:[]},boundary=new Map<string,{a:HouseVertex;b:HouseVertex;count:number}>(),t=flat?6:4;
 const triangle=(p:HouseVertex,q:HouseVertex,s:HouseVertex,up?:boolean)=>{const nx=(q[1]-p[1])*(s[2]-p[2])-(q[2]-p[2])*(s[1]-p[1]),ny=(q[2]-p[2])*(s[0]-p[0])-(q[0]-p[0])*(s[2]-p[2]),nz=(q[0]-p[0])*(s[1]-p[1])-(q[1]-p[1])*(s[0]-p[0]);if(nx*nx+ny*ny+nz*nz<1e-10)return;if(up!==undefined&&(ny>0)!==up)[q,s]=[s,q];const i=mesh.vertices.length;mesh.vertices.push(p,q,s);mesh.faces.push([i,i+1,i+2]);};
 const lower=(p:HouseVertex):HouseVertex=>[p[0],p[1]-t,p[2]];
 for(const face of polys){for(let i=1;i<face.length-1;i++){triangle(face[0],face[i],face[i+1],true);triangle(lower(face[0]),lower(face[i]),lower(face[i+1]),false);}for(let i=0;i<face.length;i++){const x=face[i],y=face[(i+1)%face.length],key=[x.join(':'),y.join(':')].sort().join('|'),found=boundary.get(key);if(found)found.count++;else boundary.set(key,{a:x,b:y,count:1});}}
 for(const {a:x,b:y,count} of boundary.values())if(count===1){triangle(x,y,lower(y));triangle(x,lower(y),lower(x));}
 return mesh;
}

export function buildHouseGeometry(data:DeckData,width:number):{parts:HouseMesh[]}{
 const layout=houseLayout(data,width),{config,minX,maxX,depth,wallHeight}=layout,cx=(minX+maxX)/2,parts:HouseMesh[]=[];
 if(!layout.visible)return {parts};
 const box=(name:string,color:string,b:Box,origin:HouseVertex=[0,0,0],yaw=0)=>{const vertices:HouseVertex[]=[];for(const z of [-b.d/2,b.d/2])for(const y of [-b.h/2,b.h/2])for(const x of [-b.w/2,b.w/2]){const px=b.x+x,pz=b.z+z;vertices.push([origin[0]+px*Math.cos(yaw)+pz*Math.sin(yaw),origin[1]+b.y+y,origin[2]-px*Math.sin(yaw)+pz*Math.cos(yaw)]);}parts.push({name,color,vertices,faces:[[0,2,3,1],[4,5,7,6],[0,1,5,4],[2,6,7,3],[0,4,6,2],[1,3,7,5]]});};
 const facades:{name:HouseOpening['facade'];span:number;origin:HouseVertex;yaw:number}[]=[{name:'Front',span:maxX-minX,origin:[cx,0,0],yaw:0},{name:'Back',span:maxX-minX,origin:[cx,0,-depth],yaw:Math.PI},{name:'Left',span:depth,origin:[minX,0,-depth/2],yaw:-Math.PI/2},{name:'Right',span:depth,origin:[maxX,0,-depth/2],yaw:Math.PI/2}];
 for(const f of facades){const openings=config.openings.filter(o=>o.facade===f.name).map(o=>clampHouseOpening(o,config));houseWallParts(f.span,wallHeight,openings).forEach((b,i)=>box(`${f.name}_wall_${i}`,config.claddingColor,b,f.origin,f.yaw));for(const o of openings){const x=-f.span/2+f.span*o.offsetPct/100,y=o.bottomIn+o.heightIn/2;box(`${f.name}_${o.type}_${o.id}_glass`,'#c1d1d3',{x,y,z:.8,w:o.widthIn-3,h:o.heightIn-3,d:.24},f.origin,f.yaw);for(const s of [-1,1]){box(`${o.id}_jamb_${s}`,config.trimColor,{x:x+s*(o.widthIn/2+1.5),y,z:1.8,w:3,h:o.heightIn+6,d:2.2},f.origin,f.yaw);box(`${o.id}_trim_${s}`,config.trimColor,{x,y:y+s*(o.heightIn/2+1.5),z:1.8,w:o.widthIn,h:3,d:2.2},f.origin,f.yaw);}}}
 parts.push(houseRoofMesh(layout));
 if(config.roofShape==='Gable'){const r=layout.roofRise;parts.push({name:'gable_walls',color:config.claddingColor,vertices:[[minX,wallHeight,0],[cx,wallHeight+r,0],[maxX,wallHeight,0],[minX,wallHeight,-depth],[cx,wallHeight+r,-depth],[maxX,wallHeight,-depth]],faces:[[0,2,1],[3,4,5],[0,1,4,3],[1,2,5,4],[0,3,5,2]]});}
 box('foundation','#93968d',{x:cx,y:4,z:-depth/2,w:maxX-minX+1,h:8,d:depth+1});
 box('soffit',config.trimColor,{x:cx,y:wallHeight-.75,z:-depth/2,w:maxX-minX+20,h:1.5,d:depth+20});
 return {parts};
}
