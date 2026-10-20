import {useEffect,useLayoutEffect,useMemo} from 'react';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import type {DeckData} from '../../types';
import type {LandscapeObject} from '../../landscapeTypes';
import {landscapePlacement} from '../../landscapeModelRuntime';
import {plantColorHash} from './foliageLighting';
import {useFixtureLit} from './fixtureLighting';
import {SPECIES_SEASONS,MODEL_SEASONS} from './plantSeasons';

/** Fallen leaves per square foot under a crown, thinning to none a little past its edge. */
const DENSITY=9,REACH=1.3,MAX_PER_TREE=1600,MAX_LEAVES=6000,GRID=5,LEAF_IN=[3,5] as const,BROWN='#8a5a32';

/** A maple leaf: five pointed lobes on a short stalk, light at the middle and darker at the rim, white so the instance
 * colour paints it. */
function leafTexture(){
 const size=128,canvas=document.createElement('canvas');canvas.width=canvas.height=size;
 const g=canvas.getContext('2d')!,c=size/2;
 const lobes:[number,number][]=[[-90,58],[-40,50],[-140,50],[10,34],[-190,34]];
 const grd=g.createRadialGradient(c,c+8,4,c,c+8,60);grd.addColorStop(0,'#ffffff');grd.addColorStop(1,'#c8c8c8');
 g.fillStyle=grd;g.beginPath();g.moveTo(c,c+10);
 for(const [deg,r] of lobes){const a=deg*Math.PI/180,w=.32;g.lineTo(c+Math.cos(a-w)*r*.45,c+8+Math.sin(a-w)*r*.45);g.lineTo(c+Math.cos(a)*r,c+8+Math.sin(a)*r);g.lineTo(c+Math.cos(a+w)*r*.45,c+8+Math.sin(a+w)*r*.45);}
 g.closePath();g.fill();
 g.strokeStyle='rgba(120,120,120,.55)';g.lineWidth=2;for(const [deg,r] of lobes){const a=deg*Math.PI/180;g.beginPath();g.moveTo(c,c+8);g.lineTo(c+Math.cos(a)*r*.85,c+8+Math.sin(a)*r*.85);g.stroke();}
 g.beginPath();g.moveTo(c,c+8);g.lineTo(c,c+30);g.stroke();
 const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;tex.needsUpdate=true;return tex;
}
/** The fall colour a tree drops: its own, unless it keeps its leaves. */
function fallColour(o:LandscapeObject){
 const record=(o.speciesRecord?SPECIES_SEASONS[o.speciesRecord.id]:undefined)??MODEL_SEASONS[o.assetId];
 const leaves=record?.habit==='deciduous-tree'?record.fall.leaves:null;
 return typeof leaves==='string'&&leaves!=='summer'?leaves:null;
}
interface Leaf {x:number;y:number;z:number;yaw:number;size:number;color:string}
/** Fall's fallen leaves under each broadleaf tree in the design, lying on the ground and mulch beneath it. */
export default function FallenLeaves({data,objects}:{data:DeckData;objects:LandscapeObject[]}){
 const invalidate=useThree(s=>s.invalidate);
 const leaves=useMemo(()=>{
  const trees=objects.flatMap(o=>{const colour=o.enabled&&o.kind==='plant'?fallColour(o):null;return colour&&!landscapePlacement(data,o).pendingReason?[{o,colour}]:[];});
  // Many trees share one leaf budget, so a big yard of maples stays as cheap as a few.
  const wanted=trees.map(({o})=>Math.min(MAX_PER_TREE,Math.round(Math.PI*(Math.max(o.widthIn,o.depthIn)/2*REACH/12)**2*DENSITY))),share=Math.min(1,MAX_LEAVES/Math.max(1,wanted.reduce((a,b)=>a+b,0)));
  return trees.flatMap(({o,colour},t)=>{
   const reach=Math.max(o.widthIn,o.depthIn)/2*REACH,count=Math.round(wanted[t]*share),out:Leaf[]=[],base=landscapePlacement(data,o);
   // Ground under the crown on a coarse grid (placement is too costly per leaf); a point a pool or wall claims keeps the
   // tree's own grade.
   const height=(i:number,j:number)=>{const p=landscapePlacement(data,{...o,xIn:o.xIn+(i/(GRID-1)*2-1)*reach,zIn:o.zIn+(j/(GRID-1)*2-1)*reach});return p.pendingReason?base.y:p.y;};
   const grid=Array.from({length:GRID},(_,i)=>Array.from({length:GRID},(_,j)=>height(i,j)));
   const groundAt=(dx:number,dz:number)=>{const fx=Math.min(GRID-1.001,Math.max(0,(dx/reach+1)/2*(GRID-1))),fz=Math.min(GRID-1.001,Math.max(0,(dz/reach+1)/2*(GRID-1))),i=Math.floor(fx),j=Math.floor(fz),u=fx-i,v=fz-j;
    return grid[i][j]*(1-u)*(1-v)+grid[i+1][j]*u*(1-v)+grid[i][j+1]*(1-u)*v+grid[i+1][j+1]*u*v;};
   for(let i=0;i<count;i++){
    const u=plantColorHash(o.id,i*3+101),v=plantColorHash(o.id,i*3+102),w=plantColorHash(o.id,i*3+103);
    // More leaves near the trunk: the radius leans inward.
    const r=reach*Math.pow(u,.6),a=v*Math.PI*2,dx=Math.cos(a)*r,dz=Math.sin(a)*r;
    const color=w<.18?BROWN:colour;
    // They rest on the grass tops and on the mulch (drawn about an inch above grade), not on the bare grade.
    out.push({x:base.x+dx/12,y:groundAt(dx,dz)+.1+w*.015,z:base.z+dz/12,yaw:w*Math.PI*2,size:(LEAF_IN[0]+(LEAF_IN[1]-LEAF_IN[0])*u)/12,color});
   }
   return out;
  });
 },[data,objects]);
 const map=useMemo(()=>leafTexture(),[]);
 const geometry=useMemo(()=>new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2),[]);
 const material=useMemo(()=>new THREE.MeshStandardMaterial({map,color:'#ffffff',roughness:.88,metalness:0,alphaTest:.5,side:THREE.DoubleSide}),[map]);
 useFixtureLit(material);
 useEffect(()=>()=>{map.dispose();geometry.dispose();material.dispose();},[map,geometry,material]);
 const mesh=useMemo(()=>new THREE.InstancedMesh(geometry,material,Math.max(1,leaves.length)),[geometry,material,leaves.length]);
 useEffect(()=>()=>mesh.dispose(),[mesh]);
 useLayoutEffect(()=>{
  const matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),tilt=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0),across=new THREE.Vector3(1,0,0),color=new THREE.Color();
  leaves.forEach((l,i)=>{
   // A leaf curls a little: a slight tilt off the ground, never flat as paint.
   q.setFromAxisAngle(up,l.yaw).multiply(tilt.setFromAxisAngle(across,(plantColorHash(String(i),7)-.5)*.5));
   mesh.setMatrixAt(i,matrix.compose(new THREE.Vector3(l.x,l.y,l.z),q,new THREE.Vector3(l.size,1,l.size)));
   mesh.setColorAt(i,color.set(l.color).offsetHSL((plantColorHash(String(i),3)-.5)*.06,0,(plantColorHash(String(i),5)-.5)*.18));
  });
  mesh.count=leaves.length;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();
  mesh.name='season-fallen-leaves';mesh.receiveShadow=true;mesh.castShadow=false;mesh.raycast=()=>{};invalidate();
 },[leaves,mesh,invalidate]);
 if(!leaves.length)return null;
 return <primitive object={mesh} dispose={null}/>;
}
