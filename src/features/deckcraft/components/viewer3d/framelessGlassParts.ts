import * as THREE from 'three';
import type {V3} from '../../deckTakeoff';
import {GLASS,HANDRAIL,SHOE,SPIGOT,type FramelessGlassLayout} from '../../framelessGlass';

/**
 * Where each piece of a frameless glass railing goes (FramelessGlass3D.tsx draws them), apart from the component so
 * check-deck-frameless-glass can test the matrices: one unit box or cylinder per piece, as an instance matrix.
 */
const vec=(p:V3)=>new THREE.Vector3(p.x,p.y,p.z);
const UP=new THREE.Vector3(0,1,0);
/** A box whose sides stay vertical while its top and bottom follow a/b (a raked stair panel or shoe). Always
 * right-handed: a mirrored instance matrix turns the box inside out (an InstancedMesh never flips its winding per
 * instance), and inside-out glass showed only its far face, a pure mirror of the sky's ground. The box is centred, so
 * turning its thickness round leaves it where it was. */
export function sheared(a:THREE.Vector3,b:THREE.Vector3,height:number,normal:THREE.Vector3,thick:number,centreLift:number){
  const along=b.clone().sub(a),up=new THREE.Vector3(0,height,0),side=along.clone().cross(up).dot(normal)<0?-thick:thick;
  const m=new THREE.Matrix4().makeBasis(along,up,normal.clone().multiplyScalar(side));
  return m.setPosition(a.clone().add(b).multiplyScalar(.5).add(new THREE.Vector3(0,centreLift,0)));
}
function rod(position:THREE.Vector3,axis:THREE.Vector3,radius:number,length:number){
  return new THREE.Matrix4().compose(position,new THREE.Quaternion().setFromUnitVectors(UP,axis.clone().normalize()),new THREE.Vector3(radius,length,radius));
}

export type FramelessGlassParts=Record<'glass'|'edges'|'shoes'|'gaskets'|'bolts'|'spigots'|'plates'|'rails'|'brackets',THREE.Matrix4[]>;

/** The railing's pieces: 1/2 in panels with polished edges, the base shoe with its gaskets and anchors, or spigots with
 * their plates, and on the stairs a round handrail on glass brackets. */
export function framelessGlassParts(layout:FramelessGlassLayout):FramelessGlassParts{
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
}
