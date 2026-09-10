import type {FixturePlacement} from '../../extrasLayout';
import {useMemo} from 'react';
import * as THREE from 'three';
import {getLightingProduct} from '../../lightingCatalogue';
import CatalogueFixture from './CatalogueFixture';

export const MAX_PREVIEW_LIGHTS=16;
export const isIlluminatingFixture=(id:string)=>{const p=getLightingProduct(id);return !!p?.supported&&['recessed','wall','undercap','bollard','spot','pendant','ceiling'].includes(p.geometry);};

function FixtureIllumination({productId}:{productId:string}){
 const product=getLightingProduct(productId),geometry=product?.geometry,recessed=geometry==='recessed',bollard=geometry==='bollard',scope=geometry==='spot',overhead=geometry==='pendant'||geometry==='ceiling',height=product?.dimensionsIn.height??(bollard?19.5:5);
 const lightY=recessed?.5:bollard?height-1.5:scope?height*.65:geometry==='pendant'?-18-height-.1:geometry==='ceiling'?-height-.1:-.7;
 const target=useMemo(()=>{const o=new THREE.Object3D();o.position.set(0,recessed?42:scope?24:overhead?-80:-24,recessed||overhead?0:scope?60:24);return o;},[recessed,scope,overhead]);
 if(productId==='liv')return <pointLight name="liv-area-illumination" position={[0,lightY,0]} color="#ffd09a" intensity={5} distance={12} decay={2} castShadow shadow-mapSize={[256,256]} shadow-camera-near={.08} shadow-normalBias={.01} shadow-bias={-.00002}/>;
 return <><primitive object={target}/><spotLight name={`${productId}-surface-illumination`} target={target} position={[0,lightY,recessed||overhead?0:scope?1:2]} color="#ffd09a" intensity={recessed?3:scope?16:9} distance={scope?20:12} decay={2} angle={scope?.42:recessed?1.25:.9} penumbra={.65} castShadow shadow-mapSize={[512,512]} shadow-camera-near={.025} shadow-normalBias={.008} shadow-bias={-.00001}/></>;
}

/** Product-specific fixture forms; housing dimensions are illustrative, not shop drawings. */
export default function LightingFixtures({items,evening,enabled=true}:{items:FixturePlacement[];evening:boolean;enabled?:boolean}){
  const glow=enabled?(evening?5:1.1):0;
  const active=new Set(items.flatMap((p,i)=>isIlluminatingFixture(p.productId)?[i]:[]).slice(0,MAX_PREVIEW_LIGHTS));
  return <group name="selected-in-lite-products">{items.map((p,i)=>{
    const id=p.productId,product=getLightingProduct(id),recessed=['puck','fusion','hyve'].includes(id),hub=['hub50','hub100','smart_hub150'].includes(id),bollard=id==='ace'||id==='liv';
    const legacy=['puck','fusion','hyve','evo_hyde','wedge','blink','ace','liv','scope','hub50','hub100','smart_hub150','smart_move','smart_bridge','smart_extender','cable_14_2','cable_12_2'].includes(id);
    const blinkScale=(product?.dimensionsIn.diameter??3)/3,livScale=(product?.dimensionsIn.height??19.5)/19.5;
    const light=<meshStandardMaterial color="#ffefd0" emissive="#ffc67d" emissiveIntensity={glow} toneMapped={false}/>;
    const dark=<meshStandardMaterial color="#252a29" roughness={.33} metalness={.65}/>;
    return <group key={`${id}-${i}`} name={`${id}-${i+1}`} position={[p.x,p.y,p.z]} rotation={[0,p.angle,0]}>
      {!legacy&&product&&<CatalogueFixture product={product} evening={evening&&enabled} enabled={enabled}/>}
      <group scale={id==='blink'?[blinkScale,blinkScale,1]:id==='liv'?[1,livScale,1]:[1,1,1]}>
      {recessed&&<><mesh><cylinderGeometry args={[id==='puck'?.55:1.3,id==='puck'?.55:1.3,.28,20]}/>{dark}</mesh><mesh position={[0,.17,0]}><cylinderGeometry args={[id==='puck'?.35:1.02,id==='puck'?.35:1.02,.08,20]}/>{light}</mesh>{id==='hyve'&&[-.5,0,.5].map(x=><mesh key={x} position={[x,.23,0]}><boxGeometry args={[.06,.05,1.75]}/>{dark}</mesh>)}</>}
      {id==='evo_hyde'&&<><mesh><boxGeometry args={[8,.65,1.1]}/>{dark}</mesh><mesh position={[0,-.4,.35]} rotation={[.45,0,0]}><boxGeometry args={[7.4,.12,.65]}/>{light}</mesh></>}
      {id==='wedge'&&<><mesh rotation={[.2,0,0]}><boxGeometry args={[2.8,2.8,1.4]}/>{dark}</mesh><mesh position={[0,-1.35,.5]} rotation={[-.3,0,0]}><boxGeometry args={[2.4,.15,1]}/>{light}</mesh></>}
      {id==='blink'&&<><mesh rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[1.5,1.5,1.2,24]}/>{dark}</mesh><mesh position={[0,-.6,.67]}><sphereGeometry args={[.7,12,8]}/>{light}</mesh></>}
      {bollard&&<><mesh position={[0,9,0]}><boxGeometry args={[1.7,18,1.7]}/>{dark}</mesh><mesh position={[0,18,0]}><boxGeometry args={[id==='ace'?3.3:2.2,3,2.2]}/>{dark}</mesh><mesh position={[0,17.7,id==='ace'?1.15:0]}><boxGeometry args={[1.8,1.3,id==='ace'?.12:2.3]}/>{light}</mesh><mesh position={[0,.1,0]}><boxGeometry args={[3.6,.3,3.6]}/>{dark}</mesh></>}
      {id==='scope'&&<><mesh position={[0,3,0]}><cylinderGeometry args={[.22,.22,6,8]}/>{dark}</mesh><group position={[0,6.5,0]} rotation={[Math.PI/3,0,0]}><mesh><cylinderGeometry args={[1.2,1.2,3.2,20]}/>{dark}</mesh><mesh position={[0,1.65,0]}><cylinderGeometry args={[1,1,.08,20]}/>{light}</mesh></group></>}
      {hub&&<><mesh><boxGeometry args={[id==='smart_hub150'?7:5.5,9,3]}/>{dark}</mesh><mesh position={[0,2,1.52]}><planeGeometry args={[3.5,2]}/><meshStandardMaterial color="#59665f" roughness={.5}/></mesh>{[-1,0,1].map(x=><mesh key={x} position={[x*1.2,-4.5,.4]}><cylinderGeometry args={[.25,.25,1.5,8]}/>{dark}</mesh>)}</>}
      {['smart_move','smart_bridge','smart_extender'].includes(id)&&<><mesh><boxGeometry args={[2.2,3.3,1.7]}/>{dark}</mesh><mesh position={[0,.35,.9]}><sphereGeometry args={[.7,12,8]}/><meshStandardMaterial color={id==='smart_move'?'#d7d9d2':'#8ba4a4'} roughness={.6}/></mesh></>}
      {id.startsWith('cable_')&&<mesh rotation={[Math.PI/2,0,0]}><torusGeometry args={[2,.27,8,20]}/>{dark}</mesh>}
      </group>
      {enabled&&evening&&active.has(i)&&<FixtureIllumination productId={id}/>}
    </group>;
  })}</group>;
}
