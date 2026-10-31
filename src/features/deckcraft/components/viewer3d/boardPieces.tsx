import {useEffect,useLayoutEffect,useMemo,useRef} from 'react';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type {Box} from '../../deckTakeoff';
import type {PlanPoint} from '../../lib/deckGeometry';
import {offsetPolygons,polygonCut} from '../../lib/polygonCuts';

/**
 * How a deck board reads as a board, not a slab: a real eased edge that turns into the light on its own, and the dark
 * cavity under the gaps between boards. Without the cavity the gaps show the sunlit joists and ground under the deck
 * and the field reads as one smooth surface.
 */
/** Capped composite and dressed decking have about a 1/8 in radius on their top edges. */
export const BOARD_EASE_IN=.125;
/** Segments round the ease: enough that the normals turn through the radius, so its highlight is a soft line. */
export const BOARD_EASE_SEGMENTS=2;
/** The cavity under the gaps: near-black, matte, just under the board undersides. */
export const GAP_UNDERLAY={color:'#0b0a09',dropIn:.06,thickIn:.25};

/** A board's own geometry at its real size (never a unit box scaled per instance, which would stretch the ease). UVs
 * run along the board at 48 in per repeat and across its face 0 to 1, as the board shader expects (surfaceShaders.ts). */
export function boardPieceGeometry(w:number,h:number,d:number){
  const g=new RoundedBoxGeometry(w,h,d,BOARD_EASE_SEGMENTS,Math.min(BOARD_EASE_IN,h/4,d/4)),pos=g.getAttribute('position'),uv=g.getAttribute('uv');
  for(let i=0;i<uv.count;i++)uv.setXY(i,(pos.getX(i)+w/2)/48,h>d?(pos.getY(i)+h/2)/h:(pos.getZ(i)+d/2)/d);
  return g;
}

/** A cut piece (mitre, clipped corner, curve facet) as FinishedBoards draws it: its own outline, not its bounding box. */
const isCut=(b:Box)=>{
  if(!b.polygon)return false;
  const area=Math.abs(b.polygon.reduce((s,p,i)=>{const q=b.polygon![(i+1)%b.polygon!.length];return s+p.x*q.y-q.x*p.y;},0))/2;
  return b.polygon.length!==4||Math.abs(area-b.w*b.d)>.01;
};
const underlayTop=(b:Box)=>b.y-b.h/2-GAP_UNDERLAY.dropIn;
/** One dark slab under each square board, wider and longer by the gap, so neighbouring slabs meet under every gap and joint. */
export function gapUnderlayBoxes(boards:readonly Box[],gap:number):Box[]{
  const grow=gap+.02;
  return boards.filter(b=>!isCut(b)).map(b=>({x:b.x,y:underlayTop(b)-GAP_UNDERLAY.thickIn/2,z:b.z,w:b.w+grow,h:GAP_UNDERLAY.thickIn,d:b.d+grow,angle:b.angle}));
}
/** Under a cut piece, its own outline grown by half the gap at each edge, so a cut edge never shows a dark wedge. The
 * growth's mitred points are squared off at the piece's own box grown the same, so a sharp tip stays a sharp tip. */
export function gapUnderlayPolygons(boards:readonly Box[],gap:number):{y:number;points:PlanPoint[]}[]{
  const grow=gap/2+.01;
  return boards.filter(isCut).flatMap(b=>{
    const a=-(b.angle||0),u={x:Math.cos(a),y:Math.sin(a)},n={x:-u.y,y:u.x},along=b.polygon!.map(p=>p.x*u.x+p.y*u.y),across=b.polygon!.map(p=>p.x*n.x+p.y*n.y);
    const [u0,u1,v0,v1]=[Math.min(...along)-grow,Math.max(...along)+grow,Math.min(...across)-grow,Math.max(...across)+grow];
    const box=[[u0,v0],[u1,v0],[u1,v1],[u0,v1]].map(([s,t])=>({x:u.x*s+n.x*t,y:u.y*s+n.y*t}));
    return polygonCut(offsetPolygons([b.polygon!],-grow),[box]).map(points=>({y:underlayTop(b),points}));
  });
}

/** The cut pieces' cavities as one flat mesh, facing up. */
function polygonUnderlayGeometry(shapes:{y:number;points:PlanPoint[]}[]){
  const position:number[]=[],index:number[]=[];
  for(const {y,points} of shapes){
    const base=position.length/3,contour=points.map(p=>new THREE.Vector2(p.x,p.y));
    for(const p of points)position.push(p.x,y,p.y);
    for(const [a,b,c] of THREE.ShapeUtils.triangulateShape(contour,[]))index.push(base+a,base+b,base+c);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(position,3));
  g.setAttribute('normal',new THREE.Float32BufferAttribute(position.map((_,i)=>i%3===1?1:0),3));
  g.setIndex(index);
  return g;
}

/** The cavity under a field of boards (inches, inside the viewer's 1/12 scale group). Casts no shadow of its own. */
export function GapUnderlay({boards,gap}:{boards:readonly Box[];gap:number}){
  const ref=useRef<THREE.InstancedMesh>(null),invalidate=useThree(s=>s.invalidate);
  const items=useMemo(()=>gapUnderlayBoxes(boards,gap),[boards,gap]);
  const cut=useMemo(()=>{const shapes=gapUnderlayPolygons(boards,gap);return shapes.length?polygonUnderlayGeometry(shapes):null;},[boards,gap]);
  useEffect(()=>()=>cut?.dispose(),[cut]);
  const material=useMemo(()=>new THREE.MeshStandardMaterial({color:GAP_UNDERLAY.color,roughness:1,metalness:0,side:THREE.DoubleSide}),[]);
  useEffect(()=>()=>material.dispose(),[material]);
  useLayoutEffect(()=>{
    const mesh=ref.current;if(!mesh)return;const m=new THREE.Matrix4(),q=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0);
    items.forEach((b,i)=>{q.setFromAxisAngle(up,b.angle||0);m.compose(new THREE.Vector3(b.x,b.y,b.z),q,new THREE.Vector3(b.w,b.h,b.d));mesh.setMatrixAt(i,m);});
    mesh.count=items.length;mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();invalidate();
  },[items,invalidate]);
  return <>
    {items.length>0&&<instancedMesh name="board-gap-underlay" key={items.length} ref={ref} args={[undefined,undefined,items.length]} material={material} receiveShadow><boxGeometry args={[1,1,1]}/></instancedMesh>}
    {cut&&<mesh name="board-gap-underlay-cut" geometry={cut} material={material} receiveShadow/>}
  </>;
}
