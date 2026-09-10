import {useEffect,useMemo} from 'react';
import * as THREE from 'three';
import type {DeckData,HouseOpening} from '../../types';
import type {Box} from '../../deckTakeoff';
import {clampHouseOpening} from '../../houseSettings';
import {houseLayout} from './houseLayout';
import HouseParts from './HouseParts';
import HouseFacade from './HouseFacade';
import type {HouseInteraction} from './houseInteraction';

import {houseRoofMesh} from './houseGeometry';

/** Three.js adapter for the exact roof mesh used by CAD exports. */
export function buildHouseRoof(layout:ReturnType<typeof houseLayout>){
 const mesh=houseRoofMesh(layout),positions:number[]=[],uvs:number[]=[];
 for(const face of mesh.faces)for(let i=1;i<face.length-1;i++)for(const index of [face[0],face[i],face[i+1]]){const v=mesh.vertices[index];positions.push(...v);uvs.push(v[2]/96,v[0]/96);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.computeVertexNormals();geometry.computeBoundingBox();return geometry;
}

function roofTexture(metal:boolean){const size=256,pixels=new Uint8Array(size*size*4);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const row=Math.floor(y/24),seam=metal?x%42<2:y%24<2||(x+(row%2)*32)%64<2,n=Math.abs(Math.sin(x*127.1+y*311.7)*43758.5453)%1,t=seam?.69:.92+n*.08,i=(y*size+x)*4;pixels[i]=pixels[i+1]=pixels[i+2]=Math.round(255*t);pixels[i+3]=255;}const tex=new THREE.DataTexture(pixels,size,size);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.colorSpace=THREE.SRGBColorSpace;tex.generateMipmaps=true;tex.minFilter=THREE.LinearMipmapLinearFilter;tex.magFilter=THREE.LinearFilter;tex.needsUpdate=true;return tex;}

export default function House3D({data,width,...interaction}:{data:DeckData;width:number}&HouseInteraction){
 const layout=useMemo(()=>houseLayout(data,width),[data.houseConfig,data.deckType,data.houseVisible,data.houseWallHeightIn,data.houseDoorWidthIn,data.houseDoorOffset,data.height,width]);
 const {minX,maxX,depth,wallHeight,roofRise,config}=layout,cx=(minX+maxX)/2,evening=data.sceneLighting==='Evening',metal=config.roofFinish==='Metal';
 const openings=useMemo(()=>config.openings.map(o=>clampHouseOpening(o,config)),[config]);
 const roof=useMemo(()=>buildHouseRoof(layout),[layout]),map=useMemo(()=>roofTexture(metal),[metal]);
 useEffect(()=>()=>roof.dispose(),[roof]);useEffect(()=>()=>map.dispose(),[map]);
 const gable=useMemo(()=>{if(config.roofShape!=='Gable')return null;const shape=new THREE.Shape();shape.moveTo(minX,wallHeight);shape.lineTo(cx,wallHeight+roofRise);shape.lineTo(maxX,wallHeight);shape.closePath();const g=new THREE.ExtrudeGeometry(shape,{depth:depth,bevelEnabled:false});g.translate(0,0,-depth);return g;},[config.roofShape,minX,maxX,cx,wallHeight,roofRise,depth]);
 useEffect(()=>()=>gable?.dispose(),[gable]);
 const gableSkin=useMemo(()=>{const boxes:Box[]=[];if(!gable)return boxes;const pitch=config.cladding==='Brick'?2.625:7;for(let y=wallHeight;y<wallHeight+roofRise;y+=pitch){const h=Math.min(pitch-.2,wallHeight+roofRise-y),span=(maxX-minX)*(1-(y+h-wallHeight)/roofRise);if(span<=0)continue;for(const z of [.3,-depth-.3])boxes.push({x:cx,y:y+h/2,z,w:span,h,d:.6});}return boxes;},[gable,config.cladding,wallHeight,roofRise,minX,maxX,depth,cx]);
 const facadeSpecs:{name:HouseOpening['facade'];span:number;position:[number,number,number];yaw:number}[]=[{name:'Front',span:maxX-minX,position:[cx,0,0],yaw:0},{name:'Back',span:maxX-minX,position:[cx,0,-depth],yaw:Math.PI},{name:'Left',span:depth,position:[minX,0,-depth/2],yaw:-Math.PI/2},{name:'Right',span:depth,position:[maxX,0,-depth/2],yaw:Math.PI/2}];
 if(!layout.visible)return null;
 return <group name="complete-editable-house">
  {facadeSpecs.map(f=><group key={f.name} name={`house-${f.name}-facade`} position={f.position} rotation={[0,f.yaw,0]}><HouseFacade span={f.span} height={wallHeight} openings={openings.filter(o=>o.facade===f.name)} config={config} evening={evening} {...interaction}/></group>)}
  <HouseParts items={[{x:cx,y:4,z:-depth/2,w:maxX-minX+1,h:8,d:depth+1}]} color="#93968d" name="house-foundation-plinth"/>
  <mesh geometry={roof} castShadow receiveShadow><meshStandardMaterial color={config.roofColor} map={map} bumpMap={map} bumpScale={metal?.06:.12} metalness={metal?.6:0} roughness={metal?.4:.92} side={THREE.DoubleSide}/></mesh>
  <HouseParts items={[{x:cx,y:wallHeight-.75,z:-depth/2,w:maxX-minX+20,h:1.5,d:depth+20}]} color={config.trimColor} name="eave-soffit"/>
  {gable&&<><mesh geometry={gable} castShadow receiveShadow><meshStandardMaterial color={config.claddingColor} roughness={.9}/></mesh><HouseParts items={gableSkin} color={config.claddingColor} name="gable-cladding"/>{[-1,1].map(side=><mesh key={side} position={[cx+side*((maxX-minX)/4+6),wallHeight+roofRise/2-1.5,12.25]} rotation={[0,0,-side*Math.atan2(roofRise,(maxX-minX)/2+12)]} castShadow><boxGeometry args={[Math.hypot((maxX-minX)/2+12,roofRise),3,1.5]}/><meshStandardMaterial color={config.trimColor} roughness={.8}/></mesh>)}</>}
  <HouseParts items={[minX-10,maxX+10].flatMap(x=>[{x,y:wallHeight-2,z:-depth/2,w:5,h:4,d:depth+24},{x,y:(wallHeight-2)/2,z:-depth+6,w:3,h:wallHeight-2,d:3}])} color={config.trimColor} name="gutters-and-downspouts"/>
 </group>;
}
