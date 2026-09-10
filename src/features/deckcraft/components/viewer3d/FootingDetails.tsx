import {useMemo,useEffect} from 'react';
import * as THREE from 'three';
import {Html,Line} from '@react-three/drei';
import {type DeckData} from '../../types';
import {type DeckTakeoff} from '../../deckTakeoff';
function helixGeometry(radius:number,pitch:number){
  const points:number[]=[],indices:number[]=[],steps=80,thickness=.375;
  for(let i=0;i<=steps;i++){
    const t=i/steps*Math.PI*2,y=i/steps*pitch;
    for(const level of [-thickness/2,thickness/2])for(const r of [1.55,radius])points.push(Math.cos(t)*r,y+level,Math.sin(t)*r);
    if(i<steps){const a=i*4,b=a+4;
      indices.push(a,a+1,b+1,a,b+1,b,a+2,b+2,b+3,a+2,b+3,a+3,a,b,a+2,a+2,b,b+2,a+1,a+3,b+1,a+3,b+3,b+1);
    }
  }
  indices.push(0,2,1,1,2,3);const last=steps*4;indices.push(last,last+1,last+2,last+1,last+3,last+2);
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}
export default function FootingDetails({data,model,cutaway}:{data:DeckData;model:DeckTakeoff;cutaway:boolean}){
  const depth=data.foundationDepthIn??48;
  const helical=data.foundation==='Helical Piles',blocks=data.foundation==='Deck Blocks';
  const helix=useMemo(()=>helixGeometry(6,4),[]);useEffect(()=>()=>helix.dispose(),[helix]);
  const supports=model.levels.flatMap(l=>l.supports),saddleOffset=blocks?2:0;
  const steel=useMemo(()=>new THREE.MeshStandardMaterial({color:'#aab2b5',metalness:0.86,roughness:0.34,side:THREE.DoubleSide}),[]);useEffect(()=>()=>steel.dispose(),[steel]);
  return <group name="footings">
    {cutaway&&<><Line points={[[0,0,0],[model.levels[0].footprint.bounds.w,0,0],[model.levels[0].footprint.bounds.w,0,model.levels[0].footprint.bounds.h],[0,0,model.levels[0].footprint.bounds.h],[0,0,0]]} color="#879381" lineWidth={1} dashed dashSize={6} gapSize={4}/><Html position={[model.levels[0].footprint.bounds.w+8,0,model.levels[0].footprint.bounds.h]}><span style={{fontSize:10,color:'#5a6452',whiteSpace:'nowrap'}}>Ground level</span></Html><mesh receiveShadow rotation={[-Math.PI/2,0,0]} position={[model.levels[0].footprint.bounds.w/2,-depth-10,model.levels[0].footprint.bounds.h/2]}><planeGeometry args={[1800,1800]}/><meshStandardMaterial color="#c9b79b" roughness={1}/></mesh></>}
    {supports.map((p,i)=><group key={i} position={[p.x,0,p.z]} name={`footing-${i+1}`}>
      {blocks?<mesh castShadow receiveShadow position={[0,3,0]}><boxGeometry args={[12,6,12]}/><meshStandardMaterial color="#b4b1a5" roughness={0.95}/></mesh>:helical?<>
        <mesh castShadow receiveShadow position={[0,(9-depth)/2,0]} material={steel}><cylinderGeometry args={[1.5,1.5,Math.max(1,depth-3),24]}/></mesh>
        <mesh position={[0,-depth+8,0]} geometry={helix} material={steel}/>
        <mesh position={[0,-depth+3,0]} rotation={[Math.PI,0,0]} material={steel}><coneGeometry args={[1.5,6,16]}/></mesh>
        <mesh castShadow position={[0,3,0]} material={steel}><boxGeometry args={[8,0.6,8]}/></mesh>
      </>:<>
        <mesh castShadow receiveShadow position={[0,(-depth+3)/2,0]}><cylinderGeometry args={[data.soilCondition==='Clay'||data.soilCondition==='Fill'?8:6,8,depth+3,32]}/><meshStandardMaterial color="#b0ada2" roughness={0.98}/></mesh>
        <mesh receiveShadow position={[0,-depth+3,0]}><cylinderGeometry args={[10,12,6,32]}/><meshStandardMaterial color="#969488" roughness={1}/></mesh>
      </>}
      {/* Foundation anchor and elevated post saddle. Top beam caps live in HardwareDetails. */}
      <mesh position={[0,3.35+saddleOffset,0]} material={steel}><cylinderGeometry args={[.85,.85,.18,24]}/></mesh>
      <mesh position={[0,3.7+saddleOffset,0]} material={steel}><cylinderGeometry args={[.68,.68,.5,6]}/></mesh>
      <mesh position={[0,3.6+saddleOffset,0]} material={steel}><cylinderGeometry args={[.45,.45,1.4,12]}/></mesh>
      <mesh position={[0,4.25+saddleOffset,0]} material={steel}><boxGeometry args={[6.5,0.4,6.5]}/></mesh>
      {[-1,1].map(side=><group key={side}>
        <mesh castShadow position={[side*2.9,7+saddleOffset,0]} material={steel}><boxGeometry args={[0.25,6,5.5]}/></mesh>
        {[-1.5,1.5].map(z=><group key={z}>
          <mesh position={[side*3.07,7+saddleOffset,z]} rotation={[0,0,Math.PI/2]} material={steel}><cylinderGeometry args={[.5,.5,.12,20]}/></mesh>
          <mesh position={[side*3.26,7+saddleOffset,z]} rotation={[0,0,Math.PI/2]} material={steel}><cylinderGeometry args={[.34,.34,.3,6]}/></mesh>
        </group>)}
      </group>)}
    </group>)}
    {cutaway&&!blocks&&supports.length>0&&<group>
      <Line points={[[-20,0,model.levels[0].footprint.bounds.h+20],[-20,-depth,model.levels[0].footprint.bounds.h+20]]} color="#4b4237" lineWidth={1.4}/>
      {[0,-depth].map(y=><Line key={y} points={[[-25,y,model.levels[0].footprint.bounds.h+20],[-15,y,model.levels[0].footprint.bounds.h+20]]} color="#4b4237" lineWidth={1.4}/>)}
      <Html position={[-24,-depth/2,model.levels[0].footprint.bounds.h+20]} center><span style={{background:'#fffcf5',padding:'6px 9px',borderRadius:5,fontSize:11,whiteSpace:'nowrap',color:'#443c31',border:'1px solid #cfc6b6'}}>{depth} in below grade</span></Html>
    </group>}
  </group>;
}
