import type {FixturePlacement} from '../../extrasLayout';
import {useMemo} from 'react';
import * as THREE from 'three';
import {getLightingProduct} from '../../lightingCatalogue';
import {previewLightPlan} from '../../lightingPreview';
import {fixtureNight,LEGACY_FIXTURE_SHAPES,LEGACY_HYDE,type FixtureSource} from '../../fixtureLight';
import CatalogueFixture from './CatalogueFixture';
import {SCENE_LOOK} from './sceneLook';
import {kelvinColour,lensGlow} from './fixtureLighting';

export {MAX_PREVIEW_LIGHTS,isIlluminatingFixture} from '../../lightingPreview';

/** A long-throw fixture's light as a real three light (fixtureLight.ts decides which fixtures get one). */
function RealLight({productId,source,kelvin,shadow}:{productId:string;source:FixtureSource;kelvin:number;shadow:boolean}){
  const color=useMemo(()=>kelvinColour(kelvin),[kelvin]);
  const target=useMemo(()=>{const [x,y,z]=source.position,[dx,dy,dz]=source.direction,o=new THREE.Object3D();o.position.set(x+dx*24,y+dy*24,z+dz*24);return o;},[source]);
  if(source.kind==='point')return <pointLight name={`${productId}-area-illumination`} position={source.position} color={color} intensity={source.candela} distance={source.rangeFt} decay={2} castShadow={shadow} shadow-mapSize={[256,256]} shadow-camera-near={.08} shadow-normalBias={.01} shadow-bias={-.00002}/>;
  return <><primitive object={target}/><spotLight name={`${productId}-surface-illumination`} target={target} position={source.position} color={color} intensity={source.candela} distance={source.rangeFt} decay={2} angle={source.angle} penumbra={source.penumbra} castShadow={shadow} shadow-mapSize={[512,512]} shadow-camera-near={.025} shadow-normalBias={.008} shadow-bias={-.00001}/></>;
}

/** Product-specific fixture forms; housing dimensions are illustrative, not shop drawings. Near-field fixtures light
 * their surroundings through the fixture light patch (fixtureLighting.ts) and their glow is FixtureGlows. */
export default function LightingFixtures({items,evening,enabled=true}:{items:FixturePlacement[];evening:boolean;enabled?:boolean}){
  const glow=lensGlow(enabled,evening);
  const active=useMemo(()=>previewLightPlan(items),[items]);
  return <group name="selected-in-lite-products">{items.map((p,i)=>{
    const id=p.productId,product=getLightingProduct(id),recessed=['puck','fusion','hyve'].includes(id),hub=['hub50','hub100','smart_hub150'].includes(id),bollard=id==='ace'||id==='liv';
    const legacy=LEGACY_FIXTURE_SHAPES.includes(id),night=fixtureNight(id,p.zone);
    const blinkScale=(product?.dimensionsIn.diameter??3)/3,livScale=(product?.dimensionsIn.height??19.5)/19.5;
    const light=<meshStandardMaterial color="#fff6e8" emissive={kelvinColour(night.kelvin)} emissiveIntensity={glow}/>;
    const dark=<meshPhysicalMaterial color="#252a29" {...SCENE_LOOK.powderCoat}/>;
    return <group key={`${id}-${i}`} name={`${id}-${i+1}`} position={[p.x,p.y,p.z]} rotation={[0,p.angle,0]}>
      {!legacy&&product&&<CatalogueFixture product={product} evening={evening&&enabled} enabled={enabled}/>}
      <group scale={id==='blink'?[blinkScale,blinkScale,1]:id==='liv'?[1,livScale,1]:[1,1,1]}>
      {recessed&&<><mesh><cylinderGeometry args={[id==='puck'?.55:1.3,id==='puck'?.55:1.3,.28,20]}/>{dark}</mesh><mesh position={[0,.17,0]}><cylinderGeometry args={[id==='puck'?.35:1.02,id==='puck'?.35:1.02,.08,20]}/>{light}</mesh>{id==='hyve'&&[-.5,0,.5].map(x=><mesh key={x} position={[x,.23,0]}><boxGeometry args={[.06,.05,1.75]}/>{dark}</mesh>)}</>}
      {/* The diffuser faces straight down under the tread nose: from standing height you see the lit riser, not the bar. */}
      {id==='evo_hyde'&&<><mesh><boxGeometry args={[LEGACY_HYDE.length,LEGACY_HYDE.height,LEGACY_HYDE.depth]}/>{dark}</mesh><mesh position={[0,-LEGACY_HYDE.height/2-.02,0]}><boxGeometry args={[LEGACY_HYDE.length-.6,.05,LEGACY_HYDE.depth*.6]}/>{light}</mesh></>}
      {id==='wedge'&&<><mesh rotation={[.2,0,0]}><boxGeometry args={[2.8,2.8,1.4]}/>{dark}</mesh><mesh position={[0,-1.35,.5]} rotation={[-.3,0,0]}><boxGeometry args={[2.4,.15,1]}/>{light}</mesh></>}
      {id==='blink'&&<><mesh rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[1.5,1.5,1.2,24]}/>{dark}</mesh><mesh position={[0,-.6,.67]}><sphereGeometry args={[.7,12,8]}/>{light}</mesh></>}
      {bollard&&<><mesh position={[0,9,0]}><boxGeometry args={[1.7,18,1.7]}/>{dark}</mesh><mesh position={[0,18,0]}><boxGeometry args={[id==='ace'?3.3:2.2,3,2.2]}/>{dark}</mesh><mesh position={[0,17.7,id==='ace'?1.15:0]}><boxGeometry args={[1.8,1.3,id==='ace'?.12:2.3]}/>{light}</mesh><mesh position={[0,.1,0]}><boxGeometry args={[3.6,.3,3.6]}/>{dark}</mesh></>}
      {id==='scope'&&<><mesh position={[0,3,0]}><cylinderGeometry args={[.22,.22,6,8]}/>{dark}</mesh><group position={[0,6.5,0]} rotation={[Math.PI/3,0,0]}><mesh><cylinderGeometry args={[1.2,1.2,3.2,20]}/>{dark}</mesh><mesh position={[0,1.65,0]}><cylinderGeometry args={[1,1,.08,20]}/>{light}</mesh></group></>}
      {hub&&<><mesh><boxGeometry args={[id==='smart_hub150'?7:5.5,9,3]}/>{dark}</mesh><mesh position={[0,2,1.52]}><planeGeometry args={[3.5,2]}/><meshStandardMaterial color="#59665f" roughness={.5}/></mesh>{[-1,0,1].map(x=><mesh key={x} position={[x*1.2,-4.5,.4]}><cylinderGeometry args={[.25,.25,1.5,8]}/>{dark}</mesh>)}</>}
      {['smart_move','smart_bridge','smart_extender'].includes(id)&&<><mesh><boxGeometry args={[2.2,3.3,1.7]}/>{dark}</mesh><mesh position={[0,.35,.9]}><sphereGeometry args={[.7,12,8]}/><meshStandardMaterial color={id==='smart_move'?'#d7d9d2':'#8ba4a4'} roughness={.6}/></mesh></>}
      {id.startsWith('cable_')&&<mesh rotation={[Math.PI/2,0,0]}><torusGeometry args={[2,.27,8,20]}/>{dark}</mesh>}
      </group>
      {enabled&&evening&&active.has(i)&&night.source&&<RealLight productId={id} source={night.source} kelvin={night.kelvin} shadow={active.get(i)!}/>}
    </group>;
  })}</group>;
}
