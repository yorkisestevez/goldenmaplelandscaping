import {useEffect,useLayoutEffect,useMemo} from 'react';
import * as THREE from 'three';
import {useThree} from '@react-three/fiber';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type {YardFeatureModel,YardModel} from '../../yardModel';
import type {DeckData} from '../../types';
import {isObjectVisible} from '../../editorOrganization';
import {fireProduct} from '../../fireFeatures';
import {scanMaterial} from './houseSurfaces';
import {applyWallDaylight} from './wallDaylight';
import {useFixtureLit} from './fixtureLighting';
import {useRenderQuality} from './SceneRenderQuality';

/**
 * Fire features (fireFeatureModel.ts), a lazy chunk the viewer loads only when the design has one. Model inches, inside
 * the viewer's 1/12 group. The stone body wears the scanned masonry the wall blocks use (Yard3D's 'wall-block': the rock
 * scans at an 18 in repeat, daylit like a wall); a dark steel ring or burner sits in its top; a ground pad is gravel.
 * The flame is a few additive cones, faint by day and bright (HDR, so it blooms) in the night lighting preview, when a
 * warm point light also lights the yard round it. The light stays mounted at zero by day so switching day and night
 * never recompiles the scene's materials; at most two fire features carry one. The inspection view shows the build
 * (pad, body, ring or burner) without flame or light.
 */
const STONE_REPEAT_IN=18,GRAVEL_REPEAT_IN=8,MAX_FIRE_LIGHTS=2;
const fract=(v:number)=>v-Math.floor(v);
/** UVs in repeats from local positions: tops and bottoms in plan, sides around or along the face. */
function planarUvs(g:THREE.BufferGeometry,repeatIn:number,aroundRadius?:number){
 const p=g.getAttribute('position'),n=g.getAttribute('normal'),old=g.getAttribute('uv'),uv=new Float32Array(p.count*2);
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i),nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i)),nz=Math.abs(n.getZ(i));
  const [s,t]=ny>.5?[x,z]:aroundRadius!==undefined?[old.getX(i)*2*Math.PI*aroundRadius,y]:nx>nz?[z,y]:[x,y];
  uv[i*2]=s/repeatIn;uv[i*2+1]=t/repeatIn;
 }
 g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));return g;
}
/** Additive flame cones [x, base y, z, radius, height], bright yellow at the base to a dark orange tip. */
function flameGeometry(cones:readonly (readonly [number,number,number,number,number])[]){
 const parts=cones.map(([x,y,z,r,h])=>{const g=new THREE.ConeGeometry(r,h,10,4,true);g.deleteAttribute('uv');g.deleteAttribute('normal');g.translate(x,y+h/2,z);const p=g.getAttribute('position'),c=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++){const t=Math.min(1,Math.max(0,(p.getY(i)-y)/h)),k=Math.pow(1-t,1.6);c[i*3]=k;c[i*3+1]=(.66-.36*t)*k;c[i*3+2]=(.24-.2*t)*k;}
  g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));return g;});
 const merged=mergeGeometries(parts);parts.forEach(g=>g.dispose());return merged;
}
function FireFeature({feature,lit,light,inspection}:{feature:YardFeatureModel;lit:boolean;light:boolean;inspection:boolean}){
 const c=feature.config,product=fireProduct(c)!,body=feature.boxes.find(b=>b.role==='fire-body')!,pad=feature.boxes.find(b=>b.role==='fire-pad');
 const r=c.widthFt*6,w=c.widthFt*12,d=c.depthFt*12,h=body.h,top=body.y+h/2,inner=r-4,wood=product.fuel==='wood';
 const invalidate=useThree(s=>s.invalidate),gl=useThree(s=>s.gl),quality=useRenderQuality(),anisotropy=Math.min(quality.anisotropy,gl.capabilities.getMaxAnisotropy());
 const stone=useMemo(()=>applyWallDaylight(scanMaterial('rock',c.color,{roughness:.9,normalScale:.8,anisotropy,onLoad:invalidate})),[c.color,anisotropy,invalidate]);
 const gravel=useMemo(()=>scanMaterial('rock','#8f8b82',{roughness:.97,normalScale:.5,anisotropy,onLoad:invalidate}),[anisotropy,invalidate]);
 useFixtureLit(stone);useFixtureLit(gravel);
 useEffect(()=>()=>stone.dispose(),[stone]);useEffect(()=>()=>gravel.dispose(),[gravel]);
 const shape=JSON.stringify([product.id,w,d,h,pad?.h]);
 const geometry=useMemo(()=>{
  const sides=product.round?planarUvs(new THREE.CylinderGeometry(r,r,h,48,1,true),STONE_REPEAT_IN,r):planarUvs(new THREE.BoxGeometry(w,h,d),STONE_REPEAT_IN);
  // Round bodies: a stone cap ring round the open top that the steel insert or the burner sits in.
  const cap=product.round?planarUvs(new THREE.RingGeometry(inner,r,48,1).rotateX(-Math.PI/2),STONE_REPEAT_IN):null;
  const padGeometry=pad?(product.round?planarUvs(new THREE.CylinderGeometry(r+6,r+6,pad.h,48),GRAVEL_REPEAT_IN,r+6):planarUvs(new THREE.BoxGeometry(w+12,pad.h,d+12),GRAVEL_REPEAT_IN)):null;
  const jitter=(i:number)=>fract(Math.sin(i*12.9898+c.id.length*78.233)*43758.5453);
  type Cone=[number,number,number,number,number];
  const ringCount=Math.max(10,Math.round(2*Math.PI*inner*.55/3.2)),lineCount=Math.max(8,Math.round((w-16)/3.2));
  const cones:Cone[]=wood?[[0,-7,0,Math.min(5,inner*.3),16],...[0,1,2,3].map((i):Cone=>[Math.cos(i*1.7)*inner*.35,-7,Math.sin(i*1.7)*inner*.35,Math.min(3.4,inner*.2),9+5*jitter(i)])]
   :product.round?Array.from({length:ringCount},(_,i):Cone=>{const t=i/ringCount*2*Math.PI;return [Math.cos(t)*inner*.55,-.6,Math.sin(t)*inner*.55,1.1,4.5+3.5*jitter(i)];})
   :Array.from({length:lineCount},(_,i):Cone=>[-(w-16)/2+(w-16)*i/(lineCount-1),.3,0,1.1,4.5+3.5*jitter(i)]);
  return {sides,cap,padGeometry,flames:flameGeometry(cones)};
 },[shape]);// `shape` names every size these depend on; the position moves with the group.
 useEffect(()=>()=>{geometry.sides.dispose();geometry.cap?.dispose();geometry.padGeometry?.dispose();geometry.flames?.dispose();},[geometry]);
 const flame=useMemo(()=>new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}),[]);
 useLayoutEffect(()=>{flame.color.setScalar(lit?2.6:.4);invalidate();},[flame,lit,invalidate]);
 useEffect(()=>()=>flame.dispose(),[flame]);
 const glow=lit?.9:0,steel=<meshStandardMaterial color="#2b2c2c" roughness={.5} metalness={.55} side={THREE.DoubleSide}/>;
 return <group name={`fire-feature-${c.id}`} position={[c.xFt*12,0,c.zFt*12]} rotation={[0,-c.rotationDeg*Math.PI/180,0]}>
  {pad&&geometry.padGeometry&&<mesh name="fire-pad" geometry={geometry.padGeometry} material={gravel} position={[0,pad.y,0]} receiveShadow/>}
  <mesh name="fire-body" geometry={geometry.sides} material={stone} position={[0,body.y,0]} castShadow receiveShadow/>
  {geometry.cap&&<mesh geometry={geometry.cap} material={stone} position={[0,top,0]} castShadow receiveShadow/>}
  <group position={[0,top,0]}>
   {wood?<>
    {/* The steel insert (10 in deep, its lip 1/2 in proud), an ash bed and three logs. */}
    <mesh name="fire-ring" position={[0,-4.75,0]}><cylinderGeometry args={[inner,inner,10.5,48,1,true]}/>{steel}</mesh>
    <mesh position={[0,.5,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[inner-.6,inner+1.2,48]}/>{steel}</mesh>
    <mesh position={[0,-8,0]} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[inner,40]}/><meshStandardMaterial color="#2a2622" roughness={1} emissive="#ff4a12" emissiveIntensity={glow}/></mesh>
    {[0,1,2].map(i=><mesh key={i} position={[0,-6,0]} rotation={[0,i*Math.PI/3,Math.PI/2]} castShadow><cylinderGeometry args={[2,2.2,inner*1.3,10]}/><meshStandardMaterial color="#5b4330" roughness={.9} emissive="#ff5a1f" emissiveIntensity={glow*.25}/></mesh>)}
   </>:product.round?<>
    {/* Fire glass in a steel pan 1 in down, with the burner ring in it. */}
    <mesh position={[0,-.5,0]}><cylinderGeometry args={[inner,inner,1,48,1,true]}/>{steel}</mesh>
    <mesh position={[0,-1,0]} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[inner,40]}/><meshStandardMaterial color="#24343c" roughness={.22} metalness={.1} emissive="#ff6a22" emissiveIntensity={glow*.4}/></mesh>
    <mesh name="fire-burner" position={[0,-.6,0]} rotation={[-Math.PI/2,0,0]}><torusGeometry args={[inner*.55,.5,8,48]}/>{steel}</mesh>
   </>:<>
    <mesh name="fire-burner" position={[0,.15,0]}><boxGeometry args={[w-8,.3,d-8]}/><meshStandardMaterial color="#24343c" roughness={.22} metalness={.1} emissive="#ff6a22" emissiveIntensity={glow*.4}/></mesh>
    <mesh position={[0,.4,0]}><boxGeometry args={[w-16,.3,1]}/>{steel}</mesh>
   </>}
   {!inspection&&geometry.flames&&<mesh name="fire-flame" geometry={geometry.flames} material={flame} renderOrder={4} raycast={()=>null}/>}
   {light&&<pointLight position={[0,10,0]} color={wood?'#ff8a3d':'#ff9f52'} intensity={lit?(wood?22:product.round?14:16):0} distance={20} decay={2}/>}
  </group>
 </group>;
}
/** `data` gives the night preview as the viewer reads it: the Evening scene with the lighting preview on. */
export default function Fire3D({yard,data,inspection}:{yard:YardModel;data:DeckData;inspection:boolean}){
 const evening=data.sceneLighting==='Evening',on=data.lightingPreviewOn!==false,fires=yard.features.filter(f=>!f.excluded&&f.config.kind==='fire-feature'&&f.boxes.some(b=>b.role==='fire-body')&&isObjectVisible(data.editorOrganization,f.config.id));
 return <group name="fire-features">{fires.map((f,i)=><FireFeature key={f.config.id} feature={f} lit={evening&&on&&!inspection} light={i<MAX_FIRE_LIGHTS} inspection={inspection}/>)}</group>;
}
