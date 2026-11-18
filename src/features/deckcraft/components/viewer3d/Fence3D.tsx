import * as THREE from 'three';
import {useLayoutEffect,useMemo,useRef} from 'react';
import type {DeckData} from '../../types';
import type {Fence,FencePoint,FenceStyle} from '../../fences';
import {fenceLayout,type FenceSpan} from '../../fenceRuntime';
import {isObjectVisible} from '../../editorOrganization';
import {sampleSiteHeight} from '../../siteSurface';
import {getTerrainConfig} from '../../yardSettings';

/** A fence part: a box (inches) centred at x/z, its base at y, turned to run along the fence. */
interface Part {x:number;y:number;z:number;w:number;h:number;d:number;angle:number;tint:number}
/** Ground under a plan point, in inches: the measured site, or the yard's slope setting (as landscape objects stand). */
const groundIn=(data:DeckData,p:FencePoint)=>{const measured=sampleSiteHeight(data,p.xIn,p.zIn);if(measured!==undefined)return measured;const t=getTerrainConfig(data);return t.elevationIn+p.zIn*t.slopePct/100;};
const along=(s:FenceSpan,t:number):FencePoint=>({xIn:s.start.xIn+(s.end.xIn-s.start.xIn)*t,zIn:s.start.zIn+(s.end.zIn-s.start.zIn)*t});
const length=(s:FenceSpan)=>Math.hypot(s.end.xIn-s.start.xIn,s.end.zIn-s.start.zIn);
const angleOf=(s:FenceSpan)=>-Math.atan2(s.end.zIn-s.start.zIn,s.end.xIn-s.start.xIn);
// A stable per-piece tint (0.92–1.08) so boards read as separate boards, not a painted slab.
const tint=(i:number)=>.92+((Math.sin(i*12.9898)*43758.5453)%1+1)%1*.16;

/** Each style's looks: post section and colour, infill and its colour, and how the infill is built. */
const LOOK:Record<FenceStyle,{post:number;postColor:string;infill:string;metal?:boolean}>={
  'wood-privacy':{post:3.5,postColor:'#8b7350',infill:'#9a8458'},
  'horizontal-cedar':{post:3.5,postColor:'#8f5a36',infill:'#a8693f'},
  'vinyl-privacy':{post:5,postColor:'#f1f0ea',infill:'#f4f3ee'},
  'aluminum-picket':{post:2,postColor:'#1d1f22',infill:'#1d1f22',metal:true},
  'chain-link':{post:2.375,postColor:'#9aa3a8',infill:'#a7afb3',metal:true},
};
const CEDAR='#a8693f';

/** Builds a fence's posts, rails and infill (boards, panels, pickets or mesh) on the ground, gates closed in their openings. */
function fenceParts(data:DeckData,f:Fence){
  const {spans,gates,posts}=fenceLayout(f),h=f.heightFt*12,look=LOOK[f.style],infill:Part[]=[],frame:Part[]=[],mesh:Part[]=[];
  const wood=f.style==='wood-privacy'&&f.wood==='cedar'?CEDAR:look.infill;
  // Infill for one span or gate leaf; a gate gets a frame round its infill.
  const fill=(s:FenceSpan,gate:boolean)=>{
    const len=length(s),a=angleOf(s),g0=groundIn(data,s.start),g1=groundIn(data,s.end),base=Math.max(g0,g1),mid=along(s,.5),clear=2;
    if(len<.5)return;
    const bar=(t0:number,t1:number,y:number,height:number,depth:number,list:Part[],shade=1)=>{const c=along(s,(t0+t1)/2);list.push({x:c.xIn,y,z:c.zIn,w:(t1-t0)*len,h:height,d:depth,angle:a,tint:shade});};
    if(f.style==='wood-privacy'||f.style==='aluminum-picket'){
      // Vertical boards (5.5 in with a 1/4 in gap as they dry) or pickets (5/8 in at 4 in centres) follow the ground, racked.
      const pitch=f.style==='wood-privacy'?5.75:4,width=f.style==='wood-privacy'?5.5:.625,n=Math.max(1,Math.round(len/pitch));
      for(let i=0;i<n;i++){const t=(i+.5)/n,p=along(s,t),g=groundIn(data,p);infill.push({x:p.xIn,y:g+clear,z:p.zIn,w:Math.min(width,len/n),h:h-clear,d:f.style==='wood-privacy'?.75:.625,angle:a,tint:f.style==='wood-privacy'?tint(i+Math.round(s.start.xIn)):1});}
      // Rails: two for wood (behind the boards), three for aluminum.
      const rails=f.style==='wood-privacy'?[10,h-12]:[3,h-6,h-1];for(const y of rails)bar(0,1,base+y,f.style==='wood-privacy'?3.5:1.25,f.style==='wood-privacy'?1.5:1,frame);
    }else if(f.style==='horizontal-cedar'){
      // 5.5 in boards with 3/4 in gaps, stepped to the higher post.
      const n=Math.floor((h-clear)/6.25);for(let i=0;i<n;i++){const y=base+clear+i*6.25;infill.push({x:mid.xIn,y,z:mid.zIn,w:len,h:5.5,d:.75,angle:a,tint:tint(i+Math.round(s.start.zIn))});}
    }else if(f.style==='vinyl-privacy'){
      // A tongue-and-groove panel between a bottom and top rail, stepped to the higher post.
      bar(0,1,base+clear,4,1.5,frame);bar(0,1,base+clear+4,h-clear-10,1,infill);bar(0,1,base+h-6,6,1.75,frame);
    }else{
      // Chain link: a top rail, a tension wire at the bottom and the woven mesh between.
      bar(0,1,base+h-1.6,1.6,1.6,frame);bar(0,1,base+clear,.25,.25,frame);mesh.push({x:mid.xIn,y:base+clear,z:mid.zIn,w:len,h:h-clear-1.6,d:.2,angle:a,tint:1});
    }
    // A gate's frame: its sides and a diagonal-free top and bottom, a shade darker than its infill.
    if(gate){bar(0,.03,base+clear,h-clear,2,frame,.8);bar(.97,1,base+clear,h-clear,2,frame,.8);bar(0,1,base+clear,2,2,frame,.8);bar(0,1,base+h-2,2,2,frame,.8);}
  };
  spans.forEach(s=>fill(s,false));
  for(const g of gates){if(g.gate.kind==='double'){fill({start:g.start,end:along(g,.5)},true);fill({start:along(g,.5),end:g.end},true);}else fill(g,true);}
  // Posts stand 2 in above the fence (wood and vinyl caps), from the ground at each post.
  const postParts=posts.map(p=>({x:p.xIn,y:groundIn(data,p),z:p.zIn,w:look.post,h:h+(look.metal?1:2),d:look.post,angle:0,tint:1}));
  return {infill,frame,mesh,posts:postParts,infillColor:wood,postColor:f.style==='wood-privacy'&&f.wood==='cedar'?CEDAR:look.postColor,metal:!!look.metal,round:f.style==='chain-link'};
}

const unitBox=new THREE.BoxGeometry(1,1,1).translate(0,.5,0),unitPost=new THREE.CylinderGeometry(.5,.5,1,12).translate(0,.5,0);
/** One instanced batch of boxes (inches → feet). */
function Batch({parts,color,metal,round=false,opacity=1,name}:{parts:Part[];color:string;metal:boolean;round?:boolean;opacity?:number;name:string}){
  const mesh=useRef<THREE.InstancedMesh>(null);
  const material=useMemo(()=>new THREE.MeshStandardMaterial({color,roughness:metal?.45:.85,metalness:metal?.6:0,transparent:opacity<1,opacity,depthWrite:opacity>=1}),[color,metal,opacity]);
  useLayoutEffect(()=>{
    const m=mesh.current;if(!m)return;const o=new THREE.Object3D(),c=new THREE.Color();
    parts.forEach((p,i)=>{o.position.set(p.x/12,p.y/12,p.z/12);o.rotation.set(0,p.angle,0);o.scale.set(p.w/12,p.h/12,p.d/12);o.updateMatrix();m.setMatrixAt(i,o.matrix);m.setColorAt(i,c.set('#ffffff').multiplyScalar(p.tint));});
    m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;m.computeBoundingSphere();
  },[parts]);
  useLayoutEffect(()=>()=>material.dispose(),[material]);
  // A new count builds a new mesh (key), so the old one and its instance buffers are disposed with it. The unit
  // geometry is shared, and InstancedMesh.dispose leaves geometry and material alone.
  return parts.length?<instancedMesh key={parts.length} ref={mesh} name={name} args={[round?unitPost:unitBox,material,parts.length]} castShadow receiveShadow/>:null;
}

/** The design's fences in 3D (S9c), loaded with the landscape renderer only when a design has fences. */
export default function Fence3D({data}:{data:DeckData}){
  const built=useMemo(()=>(data.fences??[]).filter(f=>isObjectVisible(data.editorOrganization,f.id)).map(f=>({f,parts:fenceParts(data,f)})),[data]);
  return <group name="fences">{built.map(({f,parts})=><group key={f.id} name={`fence-${f.id}`} userData={{fenceId:f.id}}>
    <Batch name="fence-posts" parts={parts.posts} color={parts.postColor} metal={parts.metal} round={parts.round}/>
    <Batch name="fence-frame" parts={parts.frame} color={parts.postColor} metal={parts.metal}/>
    <Batch name="fence-infill" parts={parts.infill} color={parts.infillColor} metal={parts.metal}/>
    <Batch name="fence-mesh" parts={parts.mesh} color={parts.infillColor} metal opacity={.35}/>
  </group>)}</group>;
}
