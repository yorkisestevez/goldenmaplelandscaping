import {useEffect,useLayoutEffect,useMemo,useRef} from 'react';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import type {V3} from '../../deckTakeoff';
import {GLASS,GLASS_FINISH_HEX,HANDRAIL,SHOE,SPIGOT,type FramelessGlassLayout} from '../../framelessGlass';
import {SCENE_LOOK} from './sceneLook';
import {useFixtureLit} from './fixtureLighting';

const vec=(p:V3)=>new THREE.Vector3(p.x,p.y,p.z);
const UP=new THREE.Vector3(0,1,0);
/** A box whose sides stay vertical while its top and bottom follow a/b (a raked stair panel or shoe). */
function sheared(a:THREE.Vector3,b:THREE.Vector3,height:number,normal:THREE.Vector3,thick:number,centreLift:number){
  const m=new THREE.Matrix4().makeBasis(b.clone().sub(a),new THREE.Vector3(0,height,0),normal.clone().multiplyScalar(thick));
  return m.setPosition(a.clone().add(b).multiplyScalar(.5).add(new THREE.Vector3(0,centreLift,0)));
}
function rod(position:THREE.Vector3,axis:THREE.Vector3,radius:number,length:number){
  return new THREE.Matrix4().compose(position,new THREE.Quaternion().setFromUnitVectors(UP,axis.clone().normalize()),new THREE.Vector3(radius,length,radius));
}

function Batch({matrices,shape,material,name,shadow=true,order}:{matrices:THREE.Matrix4[];shape:'box'|'cylinder'|'hex';material:THREE.Material;name:string;shadow?:boolean;order?:number}){
  const mesh=useRef<THREE.InstancedMesh>(null),invalidate=useThree(s=>s.invalidate);
  useLayoutEffect(()=>{
    if(!mesh.current)return;matrices.forEach((m,i)=>mesh.current!.setMatrixAt(i,m));
    mesh.current.count=matrices.length;mesh.current.instanceMatrix.needsUpdate=true;mesh.current.computeBoundingSphere();invalidate();
  },[matrices,invalidate]);
  if(!matrices.length)return null;
  return <instancedMesh ref={mesh} key={matrices.length} args={[undefined,material,matrices.length]} castShadow={shadow} receiveShadow={shadow} name={name} renderOrder={order}>
    {shape==='box'?<boxGeometry args={[1,1,1]}/>:<cylinderGeometry args={[1,1,1,shape==='hex'?6:20]}/>}
  </instancedMesh>;
}

/**
 * A frameless glass railing (framelessGlass.ts): 1/2 in panels with polished edges standing in a base shoe (on the deck
 * or on the rim face) or on spigots, and on the stairs a round handrail on glass brackets. No posts, no top rail.
 */
export default function FramelessGlass3D({layout}:{layout:FramelessGlassLayout}){
  const hex=GLASS_FINISH_HEX[layout.finish];
  const materials=useMemo(()=>{
    // The same glass as the framed glass panels; depthWrite stays off so the ambient occlusion pass skips it.
    const glass=new THREE.MeshPhysicalMaterial({color:'#e5f1eb',roughness:.065,metalness:0,transmission:.87,ior:1.52,thickness:.5,attenuationColor:'#92bda6',attenuationDistance:150,transparent:true,opacity:1,depthWrite:false,envMapIntensity:1.25});
    glass.userData.photoRole='glass';
    const metal=layout.finish==='Black'?new THREE.MeshPhysicalMaterial({color:hex,...SCENE_LOOK.powderCoat}):new THREE.MeshStandardMaterial({color:hex,metalness:.9,roughness:.3});
    return {glass,metal,
      edge:new THREE.MeshStandardMaterial({color:'#6d9b88',metalness:.1,roughness:.18,transparent:true,opacity:.32}),
      rubber:new THREE.MeshStandardMaterial({color:'#19201f',metalness:0,roughness:.85}),
      stainless:new THREE.MeshStandardMaterial({color:'#bdc4c6',metalness:.93,roughness:.24})};
  },[layout.finish,hex]);
  useEffect(()=>()=>Object.values(materials).forEach(m=>m.dispose()),[materials]);
  // Shoes, spigots, handrail and clamps catch the night's step and post lights; the glass stays as it is.
  useFixtureLit(materials.metal);useFixtureLit(materials.rubber);useFixtureLit(materials.stainless);
  const parts=useMemo(()=>{
    const glass:THREE.Matrix4[]=[],edges:THREE.Matrix4[]=[],shoes:THREE.Matrix4[]=[],gaskets:THREE.Matrix4[]=[],bolts:THREE.Matrix4[]=[];
    const spigots:THREE.Matrix4[]=[],plates:THREE.Matrix4[]=[],rails:THREE.Matrix4[]=[],brackets:THREE.Matrix4[]=[];
    const normalOf=(run:number)=>{const o=layout.runs[run].out;return new THREE.Vector3(o.x,0,o.y);};
    for(const p of layout.panels){
      const a=vec(p.a),b=vec(p.b),n=normalOf(p.run);
      glass.push(sheared(a,b,p.height,n,GLASS.thick,p.height/2));
      // Polished edges: the top and both ends catch the light, as real frameless glass does.
      const top=[a.clone().setY(a.y+p.height),b.clone().setY(b.y+p.height)];
      edges.push(rod(top[0].clone().add(top[1]).multiplyScalar(.5),top[1].clone().sub(top[0]),.035,top[0].distanceTo(top[1])));
      for(const e of [a,b])edges.push(rod(e.clone().setY(e.y+p.height/2),UP,.035,p.height));
    }
    for(const s of layout.shoes){
      const a=vec(s.a),b=vec(s.b),n=new THREE.Vector3(s.out.x,0,s.out.y),along=b.clone().sub(a),len=along.length();if(len<1)continue;
      shoes.push(sheared(a,b,SHOE.h,n,SHOE.w,-SHOE.h/2));
      // Rubber gaskets either side of the glass, just proud of the shoe's top.
      for(const side of [-1,1]){const d=n.clone().multiplyScalar(side*(GLASS.thick/2+.14));gaskets.push(sheared(a.clone().add(d),b.clone().add(d),.18,n,.26,.09));}
      if(s.fascia){
        // Anchor bolts through the shoe into the rim, about every 12 in.
        const count=Math.max(2,Math.round(len/12));
        for(let i=0;i<count;i++){const c=a.clone().lerp(b,(i+.5)/count).addScaledVector(n,SHOE.w/2+.05);c.y-=SHOE.h*.55;bolts.push(rod(c,n,.28,.12));}
      }
    }
    for(const s of layout.spigots){
      const at=vec(s.at),n=new THREE.Vector3(s.out.x,0,s.out.y);
      if(s.side)spigots.push(rod(at.clone().addScaledVector(n,SPIGOT.standoff/2),n,SPIGOT.d/2*.9,SPIGOT.standoff+.5));
      else{spigots.push(rod(at.clone().setY(at.y+SPIGOT.h/2),UP,SPIGOT.d/2,SPIGOT.h));plates.push(rod(at.clone().setY(at.y+.2),UP,SPIGOT.plate/2,.4));}
    }
    for(const h of layout.handrails){const a=vec(h.a),b=vec(h.b);rails.push(rod(a.clone().add(b).multiplyScalar(.5),b.clone().sub(a),HANDRAIL.d/2,a.distanceTo(b)));}
    for(const {run,at} of layout.brackets){
      // Each bracket reaches from the handrail back to the glass it is bolted through.
      const n=normalOf(run),c=vec(at).addScaledVector(n,HANDRAIL.standoff/2+GLASS.thick/4);c.y-=HANDRAIL.d/2;
      brackets.push(rod(c,n,.3,HANDRAIL.standoff+GLASS.thick/2));
    }
    return {glass,edges,shoes,gaskets,bolts,spigots,plates,rails,brackets};
  },[layout]);
  return <group name="frameless-glass-railing">
    <Batch matrices={parts.glass} shape="box" material={materials.glass} name="frameless-glass-panels" shadow={false} order={2}/>
    <Batch matrices={parts.edges} shape="cylinder" material={materials.edge} name="frameless-glass-polished-edges" shadow={false}/>
    <Batch matrices={parts.shoes} shape="box" material={materials.metal} name="frameless-glass-base-shoe"/>
    <Batch matrices={parts.gaskets} shape="box" material={materials.rubber} name="frameless-glass-shoe-gaskets"/>
    <Batch matrices={parts.bolts} shape="hex" material={materials.stainless} name="frameless-glass-shoe-anchors"/>
    <Batch matrices={parts.spigots} shape="cylinder" material={materials.metal} name="frameless-glass-spigots"/>
    <Batch matrices={parts.plates} shape="cylinder" material={materials.metal} name="frameless-glass-spigot-plates"/>
    <Batch matrices={parts.rails} shape="cylinder" material={materials.metal} name="frameless-glass-handrail"/>
    <Batch matrices={parts.brackets} shape="cylinder" material={materials.metal} name="frameless-glass-handrail-brackets"/>
  </group>;
}
