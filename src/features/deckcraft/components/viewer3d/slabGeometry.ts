import * as THREE from 'three';
import type {SkirtingSlab} from '../../skirting';
import {slabPlanPoint} from '../../lib/mitredSlabs';
import {boardVariation} from './surfaceShaders';
const COURSE_IN=5.5;

/**
 * One geometry for many skirting pieces, each a slab with its bottom and top at both ends (a trapezoid on a slope).
 * The first UV set follows the boards: 48 in per swatch repeat along the grain (up a vertical board) and one unit per
 * board course across it, each course its own strip of the swatch (surfaceShaders.ts); with courses off, the whole slab
 * is one piece. The second, in world inches, carries the lattice's open pattern. aVar picks each slab's grain.
 */
export function slabGeometry(slabs:SkirtingSlab[],grain:'along'|'up',courses=true,eased=false){
  const pos:number[]=[],uv:number[]=[],uv1:number[]=[],variation:number[]=[];
  for(const s of slabs){
    const pick=boardVariation(s.grainAnchor?.x??(s.a.x+s.b.x)/2,s.grainAnchor?.y??(s.a.y+s.b.y)/2);
    const dx=s.b.x-s.a.x,dz=s.b.y-s.a.y,len=Math.hypot(dx,dz)||1,ux=dx/len,uz=dz/len;
    if(eased){
      const points=[slabPlanPoint(s,0,-1),slabPlanPoint(s,1,-1),slabPlanPoint(s,1,1),slabPlanPoint(s,0,1)];
      const shape=new THREE.Shape();points.forEach((p,i)=>i?shape.lineTo(p.x,p.y):shape.moveTo(p.x,p.y));shape.closePath();
      const height=Math.min(s.topA-s.bottomA,s.topB-s.bottomB),c=Math.max(0,Math.min(.035,s.thick/8,height/8,len/16));
      const source=new THREE.ExtrudeGeometry(shape,{depth:Math.max(.001,height-2*c),bevelEnabled:c>0,bevelSize:c,bevelThickness:c,bevelOffset:-c,bevelSegments:1,curveSegments:1});
      const p=source.getAttribute('position');
      for(let i=0;i<p.count;i++){
        const x=p.getX(i),z=p.getY(i),along=(x-s.a.x)*ux+(z-s.a.y)*uz,t=Math.max(0,Math.min(1,along/len));
        const bottom=s.bottomA+(s.bottomB-s.bottomA)*t,top=s.topA+(s.topB-s.topA)*t,y=top-c-p.getZ(i)*(top-bottom-2*c)/Math.max(.001,height-2*c);
        const across=Math.max(0,Math.min(.99999,(y-bottom)/Math.max(.001,top-bottom)));
        pos.push(x,y,z);uv.push(...(grain==='along'?[(along+(s.grainOffset??0))/48,courses?y/COURSE_IN:across]:[y/48,courses?along/COURSE_IN:t*.99999]));
        uv1.push((x*ux+z*uz)/12,y/12);variation.push(...pick);
      }
      source.dispose();continue;
    }
    const corner=(end:number,top:number,side:number)=>{
      const p=slabPlanPoint(s,end as 0|1,side?1:-1),bottom=end?s.bottomB:s.bottomA,height=end?s.topB:s.topA,y=top?height:bottom,x=p.x,z=p.y;
      const along=(x-s.a.x)*ux+(z-s.a.y)*uz+(s.grainOffset??0);
      pos.push(x,y,z);
      uv.push(...(grain==='along'?[along/48,courses?y/COURSE_IN:top*.99999]:[y/48,courses?along/COURSE_IN:end*.99999]));variation.push(...pick);
      uv1.push((x*ux+z*uz)/12,y/12);
    };
    const quad=(c:[number,number,number][])=>{for(const i of dx*s.out.y-dz*s.out.x>=0?[0,1,2,0,2,3]:[0,2,1,0,3,2])corner(...c[i]);};
    quad([[0,0,1],[1,0,1],[1,1,1],[0,1,1]]);quad([[1,0,0],[0,0,0],[0,1,0],[1,1,0]]);
    quad([[0,1,1],[1,1,1],[1,1,0],[0,1,0]]);quad([[0,0,0],[1,0,0],[1,0,1],[0,0,1]]);
    quad([[0,0,0],[0,0,1],[0,1,1],[0,1,0]]);quad([[1,0,1],[1,0,0],[1,1,0],[1,1,1]]);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('uv1',new THREE.Float32BufferAttribute(uv1,2));g.setAttribute('aVar',new THREE.Float32BufferAttribute(variation,4));
  g.computeVertexNormals();g.computeBoundingSphere();return g;
}
