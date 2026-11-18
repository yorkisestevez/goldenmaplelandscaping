import {useEffect,useMemo} from 'react';
import * as THREE from 'three';
import {showcaseRoofTrim,type ShowcaseRoofShape} from './showcaseHouseRoof';

function TrimMesh({positions,color,name}:{positions:number[];color:string;name:string}){
 const geometry=useMemo(()=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();return g;},[positions]);
 useEffect(()=>()=>geometry.dispose(),[geometry]);
 if(positions.length<9)return null;
 return <mesh name={name} geometry={geometry} castShadow receiveShadow><meshStandardMaterial color={color} roughness={name.includes('soffit')?.9:.72}/></mesh>;
}
/** Showcase only: the subject roof's eave fascia and overhang soffit. */
export default function ShowcaseRoofShell({x0,x1,y0,y1,wallTop,rise,shape,ridge,fascia,soffit}:{x0:number;x1:number;y0:number;y1:number;wallTop:number;rise:number;shape:ShowcaseRoofShape;ridge:'x'|'z';fascia:string;soffit:string}){
 const trim=useMemo(()=>showcaseRoofTrim({x0,x1,y0,y1,wallTop,rise,shape,ridge}),[x0,x1,y0,y1,wallTop,rise,shape,ridge]);
 return <group name="showcase-roof-trim">{trim.fascia.length>0&&<TrimMesh positions={trim.fascia} color={fascia} name="showcase-fascia"/>}{trim.soffit.length>0&&<TrimMesh positions={trim.soffit} color={soffit} name="showcase-soffit"/>}</group>;
}
