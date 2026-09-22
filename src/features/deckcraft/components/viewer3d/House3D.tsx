import {useEffect,useMemo} from 'react';
import * as THREE from 'three';
import type {DeckData,HouseConfig} from '../../types';
import type {Box} from '../../deckTakeoff';
import {getHousePlacement} from '../../housePlacement';
import {getHouseBlocks,type HouseBlockPlan} from '../../houseFootprint';
import {houseLayout} from './houseLayout';
import HouseParts from './HouseParts';
import HouseFacade from './HouseFacade';
import type {HouseInteraction} from './houseInteraction';

import {houseRoofMesh,blockRoofMesh,blockGableMesh,houseWallSpecs,type HouseMesh} from './houseGeometry';

/** Three.js adapter for the exact roof mesh used by CAD exports. */
/** Three.js adapter for the exact roof mesh used by CAD exports. */
export function buildHouseRoof(layout:ReturnType<typeof houseLayout>){return meshGeometry(houseRoofMesh(layout));}
function meshGeometry(mesh:HouseMesh){
 const positions:number[]=[],uvs:number[]=[];
 for(const face of mesh.faces)for(let i=1;i<face.length-1;i++)for(const index of [face[0],face[i],face[i+1]]){const v=mesh.vertices[index];positions.push(...v);uvs.push(v[2]/96,v[0]/96);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.computeVertexNormals();geometry.computeBoundingBox();return geometry;
}

/** A bump-out, wing or garage: its own roof, gable ends, plinth, soffit and gutters. Walls come with the house's facades. */
function HouseBlock3D({block,config,map,metal}:{block:HouseBlockPlan;config:HouseConfig;map:THREE.Texture;metal:boolean}){
 const roof=useMemo(()=>meshGeometry(blockRoofMesh(block,config)),[block,config]);
 const gable=useMemo(()=>{const m=blockGableMesh(block,config.claddingColor,'gable');return m?meshGeometry(m):null;},[block,config.claddingColor]);
 useEffect(()=>()=>roof.dispose(),[roof]);useEffect(()=>()=>gable?.dispose(),[gable]);
 const {x0,x1,y0,y1}=block.rect,bx=(x0+x1)/2,bz=(y0+y1)/2,h=block.wallHeightIn,w=x1-x0,d=y1-y0;
 // Gutters run along the eaves: the sides parallel to the ridge.
 const gutters=block.ridge==='z'?[x0-10,x1+10].map(x=>({x,y:h-2,z:bz,w:5,h:4,d:d+24})):[y0-10,y1+10].map(z=>({x:bx,y:h-2,z,w:w+24,h:4,d:5}));
 return <group name={`house-block-${block.id}`}>
  <HouseParts items={[{x:bx,y:4,z:bz,w:w+1,h:8,d:d+1}]} color="#93968d" name="house-block-plinth"/>
  <mesh geometry={roof} castShadow receiveShadow><meshStandardMaterial color={config.roofColor} map={map} bumpMap={map} bumpScale={metal?.06:.12} metalness={metal?.6:0} roughness={metal?.4:.92} side={THREE.DoubleSide}/></mesh>
  {gable&&<mesh geometry={gable} castShadow receiveShadow><meshStandardMaterial color={config.claddingColor} roughness={.9} side={THREE.DoubleSide}/></mesh>}
  <HouseParts items={[{x:bx,y:h-.75,z:bz,w:w+20,h:1.5,d:d+20}]} color={config.trimColor} name="house-block-soffit"/>
  <HouseParts items={block.roofShape==='Flat'?[]:gutters} color={config.trimColor} name="house-block-gutters"/>
 </group>;
}

function roofTexture(metal:boolean){const size=256,pixels=new Uint8Array(size*size*4);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const row=Math.floor(y/24),seam=metal?x%42<2:y%24<2||(x+(row%2)*32)%64<2,n=Math.abs(Math.sin(x*127.1+y*311.7)*43758.5453)%1,t=seam?.69:.92+n*.08,i=(y*size+x)*4;pixels[i]=pixels[i+1]=pixels[i+2]=Math.round(255*t);pixels[i+3]=255;}const tex=new THREE.DataTexture(pixels,size,size);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.colorSpace=THREE.SRGBColorSpace;tex.generateMipmaps=true;tex.minFilter=THREE.LinearMipmapLinearFilter;tex.magFilter=THREE.LinearFilter;tex.needsUpdate=true;return tex;}

export default function House3D({data,width,...interaction}:{data:DeckData;width:number}&HouseInteraction){
 // Keyed on the placed house, so moving the house (placement, wrap, deck width) rebuilds it too.
 const placement=getHousePlacement(data),placeKey=`${placement.x0}:${placement.x1}:${placement.depthIn}`;
 const layout=useMemo(()=>houseLayout(data,width),[data.houseConfig,data.deckType,data.houseVisible,data.houseWallHeightIn,data.houseDoorWidthIn,data.houseDoorOffset,data.height,width,placeKey]);
 const blocks=useMemo(()=>getHouseBlocks(data),[layout]);
 const walls=useMemo(()=>houseWallSpecs(data,layout.config,blocks),[layout,blocks]);
 const {minX,maxX,depth,wallHeight,roofRise,config}=layout,cx=(minX+maxX)/2,evening=data.sceneLighting==='Evening',metal=config.roofFinish==='Metal';
 const roof=useMemo(()=>buildHouseRoof(layout),[layout]),map=useMemo(()=>roofTexture(metal),[metal]);
 useEffect(()=>()=>roof.dispose(),[roof]);useEffect(()=>()=>map.dispose(),[map]);
 const gable=useMemo(()=>{if(config.roofShape!=='Gable')return null;const shape=new THREE.Shape();shape.moveTo(minX,wallHeight);shape.lineTo(cx,wallHeight+roofRise);shape.lineTo(maxX,wallHeight);shape.closePath();const g=new THREE.ExtrudeGeometry(shape,{depth:depth,bevelEnabled:false});g.translate(0,0,-depth);return g;},[config.roofShape,minX,maxX,cx,wallHeight,roofRise,depth]);
 useEffect(()=>()=>gable?.dispose(),[gable]);
 const gableSkin=useMemo(()=>{const boxes:Box[]=[];if(!gable)return boxes;const pitch=config.cladding==='Brick'?2.625:7;for(let y=wallHeight;y<wallHeight+roofRise;y+=pitch){const h=Math.min(pitch-.2,wallHeight+roofRise-y),span=(maxX-minX)*(1-(y+h-wallHeight)/roofRise);if(span<=0)continue;for(const z of [.3,-depth-.3])boxes.push({x:cx,y:y+h/2,z,w:span,h,d:.6});}return boxes;},[gable,config.cladding,wallHeight,roofRise,minX,maxX,depth,cx]);
 if(!layout.visible)return null;
 return <group name="complete-editable-house">
  {walls.map(f=><group key={f.wall.id} name={`house-${f.name}-facade`} position={f.origin} rotation={[0,f.yaw,0]}><HouseFacade span={f.span} height={f.height} openings={f.openings} hidden={f.hidden} config={config} evening={evening} {...interaction}/></group>)}
  <HouseParts items={[{x:cx,y:4,z:-depth/2,w:maxX-minX+1,h:8,d:depth+1}]} color="#93968d" name="house-foundation-plinth"/>
  <mesh geometry={roof} castShadow receiveShadow><meshStandardMaterial color={config.roofColor} map={map} bumpMap={map} bumpScale={metal?.06:.12} metalness={metal?.6:0} roughness={metal?.4:.92} side={THREE.DoubleSide}/></mesh>
  <HouseParts items={[{x:cx,y:wallHeight-.75,z:-depth/2,w:maxX-minX+20,h:1.5,d:depth+20}]} color={config.trimColor} name="eave-soffit"/>
  {gable&&<><mesh geometry={gable} castShadow receiveShadow><meshStandardMaterial color={config.claddingColor} roughness={.9}/></mesh><HouseParts items={gableSkin} color={config.claddingColor} name="gable-cladding"/>{[-1,1].map(side=><mesh key={side} position={[cx+side*((maxX-minX)/4+6),wallHeight+roofRise/2-1.5,12.25]} rotation={[0,0,-side*Math.atan2(roofRise,(maxX-minX)/2+12)]} castShadow><boxGeometry args={[Math.hypot((maxX-minX)/2+12,roofRise),3,1.5]}/><meshStandardMaterial color={config.trimColor} roughness={.8}/></mesh>)}</>}
  <HouseParts items={[minX-10,maxX+10].flatMap(x=>[{x,y:wallHeight-2,z:-depth/2,w:5,h:4,d:depth+24},{x,y:(wallHeight-2)/2,z:-depth+6,w:3,h:wallHeight-2,d:3}])} color={config.trimColor} name="gutters-and-downspouts"/>
  {blocks.slice(1).map(block=><HouseBlock3D key={block.id} block={block} config={config} map={map} metal={metal}/>)}
 </group>;
}
