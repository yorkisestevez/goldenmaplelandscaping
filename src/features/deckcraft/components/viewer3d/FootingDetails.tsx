import {Html,Line} from '@react-three/drei';
import type {DeckData} from '../../types';
import type {DeckTakeoff} from '../../deckTakeoff';
import {foundationSolids,foundationRadialSegments} from '../../foundationDatums';
/** The same local-datum foundation solids are used by takeoff and mesh exports. */
export default function FootingDetails({data,model,cutaway}:{data:DeckData;model:DeckTakeoff;cutaway:boolean}){
 const supports=model.foundationSupports.filter(f=>f.gradeElevationIn!==null),dimension=supports.find(f=>f.depthIn>0),pending=model.foundationQuantities.foundationCoveragePending;
 return <group name="footings">
  {supports.map(f=>{const solids=foundationSolids(f);return <group key={f.id} userData={{pickPartId:f.id}} name={f.id}>
   {solids.boxes.filter(b=>b.part!=='post').map((b,i)=><mesh key={`${b.part}-${i}`} castShadow receiveShadow position={[b.x,b.y,b.z]}><boxGeometry args={[b.w,b.h,b.d]}/><meshStandardMaterial color={b.part==='deck-block'?'#b4b1a5':'#aab2b5'} metalness={b.part==='post-base'?.86:0} roughness={b.part==='post-base'?.34:.95}/></mesh>)}
   {solids.cylinders.map(p=><mesh key={p.part} castShadow receiveShadow position={[p.x,(p.top+p.bottom)/2,p.z]}><cylinderGeometry args={[p.radius,p.radius,p.top-p.bottom,foundationRadialSegments(data)]}/><meshStandardMaterial color={p.part==='concrete-pier'?'#b0ada2':'#aab2b5'} metalness={p.part==='concrete-pier'?0:.86} roughness={p.part==='concrete-pier'?.98:.34}/></mesh>)}
  </group>;})}
  {cutaway&&dimension&&<group>
   <Line points={[[dimension.x-16,dimension.gradeElevationIn!,dimension.z],[dimension.x-16,dimension.bottomElevationIn!,dimension.z]]} color="#4b4237" lineWidth={1.4}/>
   {[dimension.gradeElevationIn!,dimension.bottomElevationIn!].map(y=><Line key={y} points={[[dimension.x-20,y,dimension.z],[dimension.x-12,y,dimension.z]]} color="#4b4237" lineWidth={1.4}/>)}
   <Html position={[dimension.x-22,(dimension.gradeElevationIn!+dimension.bottomElevationIn!)/2,dimension.z]} center><span style={{background:'#fffcf5',padding:'6px 9px',borderRadius:5,fontSize:11,whiteSpace:'nowrap',color:'#443c31',border:'1px solid #cfc6b6'}}>{dimension.depthIn} in below local proposed grade / planning depth</span></Html>
  </group>}
  {cutaway&&pending>0&&<Html position={[0,data.height+12,0]}><span style={{background:'#fffcf5',padding:'6px 9px',fontSize:11,color:'#7c3d13'}}>{pending} foundation footprint{pending===1?'':'s'} need survey coverage; ground depth pending.</span></Html>}
 </group>;
}
