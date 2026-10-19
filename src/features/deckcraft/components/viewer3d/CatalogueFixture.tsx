import {SCENE_LOOK} from './sceneLook';
import {DEFAULT_KELVIN,FLUSH_LENS_PROUD_IN,FLUSH_TRIM_IN,POOL_FACE_IN,POOL_LENS_IN,POOL_LIGHT_ID,ROUND_FLUSH_TOP_IN,WELL_FACE_IN,WELL_LENS_IN,linearFlushGround,narrowSpot,roundFlushGround} from '../../fixtureLight';
import {kelvinColour,lensGlow} from './fixtureLighting';

type ProductShape={id?:string;name:string;geometry:string;finish?:string;colorTemperatureK?:number;dimensionsIn:{height?:number;width?:number;length?:number;diameter?:number;mountingDepth?:number}};

/** Dark bars across the well-light lens, three ways, clipped to the aperture. */
function Honeycomb({radius,y}:{radius:number;y:number}){
 const pitch=.24,thick=.028,bars=[];
 const metal=<meshStandardMaterial color="#141618" metalness={.72} roughness={.34}/>;
 for(const rot of [0,Math.PI/3,-Math.PI/3]){
  const c=Math.cos(rot),s=Math.sin(rot),n=Math.floor(radius/pitch);
  for(let i=-n;i<=n;i++){
   const off=i*pitch,half=Math.sqrt(Math.max(0,radius*radius-off*off));
   if(half<.08)continue;
   bars.push(<mesh key={`${rot}:${i}`} position={[-s*off,y,c*off]} rotation={[0,rot,0]}><boxGeometry args={[half*2,.012,thick]}/>{metal}</mesh>);
  }
 }
 return <group name="honeycomb-louver">{bars}</group>;
}

/** Family envelopes use published dimensions where available. Unspecified
 * profile/cord/stem details are illustrative and disclosed in the catalogue. */
export default function CatalogueFixture({product,evening,enabled=true}:{product:ProductShape;evening:boolean;enabled?:boolean}){
 const {geometry:g,dimensionsIn:d}=product,finish=(product.finish||'').toLowerCase();
 const color=finish.includes('white')?'#e6e5df':finish.includes('rose')?'#a99084':finish.includes('silver')||finish.includes('steel')?'#a7afb1':'#272d2c';
 // Silver and steel finishes are bare metal; the others are powder coat (sceneLook.ts).
 const dark=finish.includes('silver')||finish.includes('steel')?<meshStandardMaterial color={color} metalness={.6} roughness={.4}/>:<meshPhysicalMaterial color={color} {...SCENE_LOOK.powderCoat}/>;
 // The lens in the product's rated colour temperature, bright enough at night for tone mapping to compress, not clip.
 const lit=<meshStandardMaterial color="#fff6e8" emissive={kelvinColour(product.colorTemperatureK??DEFAULT_KELVIN)} emissiveIntensity={lensGlow(enabled,evening)}/>;
 const diameter=d.diameter??d.width??2.2,w=d.width??d.diameter??2.5,h=d.height??3,depth=d.length??1.5;
 if(g==='recessed'){
  // The body stays under the paver. A dark trim ring and a lens a millimetre or two thick are all that show.
  const height=d.height??d.mountingDepth??1.4,proud=FLUSH_LENS_PROUD_IN,trim=FLUSH_TRIM_IN,lensY=trim+proud/2;
  if(linearFlushGround(d)){const length=d.length??diameter,width=d.width??diameter;return <group name="recessed-catalogue-housing"><mesh position={[0,-height/2,0]}><boxGeometry args={[length*.92,height,width*.92]}/>{dark}</mesh><mesh position={[0,trim/2,0]}><boxGeometry args={[length,trim,width]}/>{dark}</mesh><mesh position={[0,lensY,0]}><boxGeometry args={[length*.86,proud,width*.62]}/>{lit}</mesh></group>;}
  // Round paver lights and the stainless well light: the face is dead flush, and only a thin ring shows around the lens.
  if(product.id&&roundFlushGround(product.id)){
   const top=ROUND_FLUSH_TOP_IN,well=product.id==='inground_2ss',faceR=well?WELL_FACE_IN/2:diameter/2,lensR=well?WELL_LENS_IN/2:Math.max(.12,faceR-.06);
   return <group name="recessed-catalogue-housing"><mesh position={[0,-height/2,0]}><cylinderGeometry args={[lensR*.92,lensR*.88,height,24]}/>{dark}</mesh><mesh position={[0,top/2,0]}><cylinderGeometry args={[faceR,faceR,top,40]}/>{dark}</mesh><mesh position={[0,top+.006,0]}><cylinderGeometry args={[lensR,lensR,.012,36]}/>{lit}</mesh>{well&&<Honeycomb radius={lensR*.9} y={top+.016}/>}</group>;
  }
  const r=diameter/2;return <group name="recessed-catalogue-housing"><mesh position={[0,-height/2,0]}><cylinderGeometry args={[r*.92,r*.88,height,24]}/>{dark}</mesh><mesh position={[0,trim/2,0]}><cylinderGeometry args={[r,r,trim,32]}/>{dark}</mesh><mesh position={[0,lensY,0]}><cylinderGeometry args={[r*.72,r*.72,proud,32]}/>{lit}</mesh></group>;
 }
 // A wet-niche pool light is flush in the pool wall: a thin stainless ring and a frosted lens, nothing standing proud.
 if(product.id===POOL_LIGHT_ID){const ring=<meshStandardMaterial color="#b9c0c2" metalness={.75} roughness={.3}/>,lens=<meshStandardMaterial color="#f4f1e6" roughness={.25} emissive={kelvinColour(product.colorTemperatureK??DEFAULT_KELVIN)} emissiveIntensity={lensGlow(enabled,evening)*.22}/>;return <group name="pool-niche-housing"><mesh position={[0,0,.06]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[POOL_FACE_IN/2,POOL_FACE_IN/2,.12,48]}/>{ring}</mesh><mesh position={[0,0,.14]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[POOL_LENS_IN/2,POOL_LENS_IN/2,.06,48]}/>{lens}</mesh></group>;}
 if(g==='wall'){const faceH=d.diameter??h,bodyDepth=d.diameter?(d.height??d.length??1):depth;return <group name="wall-catalogue-housing"><mesh rotation={[d.diameter?Math.PI/2:0,0,0]}>{d.diameter?<cylinderGeometry args={[diameter/2,diameter/2,bodyDepth,24]}/>:<boxGeometry args={[w,faceH,bodyDepth]}/>}{dark}</mesh><mesh position={[0,-faceH/2-.02,bodyDepth*.23]}><boxGeometry args={[w*.72,.08,Math.min(bodyDepth*.55,1)]}/>{lit}</mesh></group>;}
 if(g==='undercap'){const length=d.length??12,height=d.height??.5,width=d.width??.7;return <group name="linear-catalogue-housing"><mesh><boxGeometry args={[length,height,width]}/>{dark}</mesh><mesh position={[0,-height/2-.025,0]}><boxGeometry args={[Math.max(.2,length-.25),.05,width*.7]}/>{lit}</mesh></group>;}
 if(g==='bollard'){const height=d.height??24,r=(d.diameter??d.width??2)/2;return <group name="bollard-catalogue-housing"><mesh position={[0,height/2,0]}><cylinderGeometry args={[r,r,height,20]}/>{dark}</mesh><mesh position={[0,height-1.5,0]}><cylinderGeometry args={[r*1.04,r*1.04,1.2,20]}/>{lit}</mesh><mesh position={[0,.12,0]}><cylinderGeometry args={[r*1.5,r*1.5,.25,20]}/>{dark}</mesh></group>;}
 if(g==='spot'){const height=d.height??5.5,r=diameter/2,length=d.length??3.5;return <group name="spot-catalogue-housing"><mesh position={[0,height*.25,0]}><cylinderGeometry args={[.18,.18,height*.5,10]}/>{dark}</mesh><group position={[0,height*.65,0]} rotation={[Math.PI/3,0,0]}><mesh><cylinderGeometry args={[r,r,length,24]}/>{dark}</mesh><mesh position={[0,length/2+.025,0]}><cylinderGeometry args={[r*.8,r*.8,.05,24]}/>{lit}</mesh>{product.id&&narrowSpot(product.id)&&<mesh name="glare-cowl" position={[0,length/2+1.1,0]}><cylinderGeometry args={[r*1.02,r*1.02,2.2,24,1,true]}/>{dark}</mesh>}</group></group>;}
 if(g==='pendant'){const height=d.height??5,r=diameter/2;return <group name="pendant-catalogue-housing"><mesh position={[0,-9,0]}><cylinderGeometry args={[.07,.07,18,8]}/>{dark}</mesh><mesh position={[0,-18-height/2,0]}><cylinderGeometry args={[r,r,height,24]}/>{dark}</mesh><mesh position={[0,-18-height-.03,0]}><cylinderGeometry args={[r*.82,r*.82,.06,24]}/>{lit}</mesh><mesh position={[0,-.1,0]}><cylinderGeometry args={[1,1,.2,16]}/>{dark}</mesh></group>;}
 if(g==='ceiling'){const height=d.height??2,r=diameter/2;return <group name="ceiling-catalogue-housing"><mesh position={[0,-height/2,0]}><cylinderGeometry args={[r,r,height,24]}/>{dark}</mesh><mesh position={[0,-height-.025,0]}><cylinderGeometry args={[r*.83,r*.83,.05,24]}/>{lit}</mesh></group>;}
 if(g==='transformer'){const width=d.width??6,height=d.height??9,length=d.length??3;return <group name="transformer-catalogue-housing"><mesh><boxGeometry args={[width,height,length]}/>{dark}</mesh><mesh position={[0,height*.18,length/2+.04]}><planeGeometry args={[width*.6,height*.23]}/><meshStandardMaterial color="#50645c" roughness={.7}/></mesh>{[-1,0,1].map(x=><mesh key={x} position={[x*width*.22,-height/2-.3,0]}><cylinderGeometry args={[.2,.2,.6,10]}/>{dark}</mesh>)}</group>;}
 if(g==='cable')return <group name="purchased-cable-coil">{[0,1,2,3].map(i=><mesh key={i} position={[0,i*.25,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[3+i*.18,.12,8,32]}/>{dark}</mesh>)}</group>;
 return <group name="accessory-catalogue-envelope"><mesh><boxGeometry args={[w,h,Math.min(depth,5)]}/>{dark}</mesh>{[-1,1].map(side=><mesh key={side} position={[side*(w/2+.22),0,0]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.22,.22,.44,10]}/>{dark}</mesh>)}</group>;
}
