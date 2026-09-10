import {useMemo,useEffect} from 'react';
import * as THREE from 'three';
import type {DeckTakeoff,Member} from '../../deckTakeoff';
import {stringerCutProfile} from './stringerProfile';
type StairMember=Member&{stair?:{risers:number;rise:number;run:number;top:number;bottom:number}};
function Stringer({member,material,model}:{member:StairMember;material:THREE.Material;model:DeckTakeoff}){
 const geometry=useMemo(()=>{const shape=new THREE.Shape();stringerCutProfile(member,model).forEach((p,i)=>i?shape.lineTo(p.x,p.y):shape.moveTo(p.x,p.y));shape.closePath();
   const g=new THREE.ExtrudeGeometry(shape,{depth:member.width,bevelEnabled:false});g.translate(0,0,-member.width/2);return g;
 },[member,model]);
 useEffect(()=>()=>geometry.dispose(),[geometry]);
 const angle=-Math.atan2(member.b.z-member.a.z,member.b.x-member.a.x);
 return <mesh name="notched-stair-stringer" geometry={geometry} material={material} castShadow receiveShadow position={[member.a.x,0,member.a.z]} rotation={[0,angle,0]}/>;
}
export default function NotchedStringers({model,material}:{model:DeckTakeoff;material:THREE.Material}){
 return <group name="stair-stringers">{model.stringers.map((member,i)=><Stringer key={i} member={member} material={material} model={model}/>)}</group>;
}
