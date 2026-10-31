import {useEffect,useMemo} from 'react';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type {DeckLevel} from '../../deckTakeoff';
import type {PlanPoint} from '../../lib/deckGeometry';

/**
 * How a deck board reads as a board, not a slab: a real eased edge that turns into the light on its own, and the dark
 * cavity under the gaps between boards. Without the cavity the gaps show the sunlit joists and ground under the deck
 * and the field reads as one smooth surface.
 */
/** Capped composite and dressed decking have about a 1/8 in radius on their top edges. */
export const BOARD_EASE_IN=.125;
/** Segments round the ease: enough that the normals turn through the radius, so its highlight is a soft line. */
export const BOARD_EASE_SEGMENTS=2;
/** The cavity under the gaps: near-black, matte, just under the 1 in decking. */
export const GAP_UNDERLAY={color:'#0b0a09',boardIn:1,dropIn:.06};

/** A board's own geometry at its real size (never a unit box scaled per instance, which would stretch the ease). UVs
 * run along the board at 48 in per repeat and across its face 0 to 1, as the board shader expects (surfaceShaders.ts). */
export function boardPieceGeometry(w:number,h:number,d:number){
  const g=new RoundedBoxGeometry(w,h,d,BOARD_EASE_SEGMENTS,Math.min(BOARD_EASE_IN,h/4,d/4)),pos=g.getAttribute('position'),uv=g.getAttribute('uv');
  for(let i=0;i<uv.count;i++)uv.setXY(i,(pos.getX(i)+w/2)/48,h>d?(pos.getY(i)+h/2)/h:(pos.getZ(i)+d/2)/d);
  return g;
}

/** Each level's cavity: its decking outline, just under the boards. It follows the deck's own edge exactly, so it closes
 * every gap and joint and never shows past the outer boards, a mitre or a clipped corner. */
export function gapUnderlayOutlines(levels:readonly Pick<DeckLevel,'top'|'offset'|'footprint'|'deckingFootprint'>[]):{y:number;points:PlanPoint[]}[]{
  return levels.map(l=>({y:l.top-GAP_UNDERLAY.boardIn-GAP_UNDERLAY.dropIn,points:(l.deckingFootprint??l.footprint).outline.map(p=>({x:p.x+l.offset.x,y:p.y+l.offset.z}))}));
}

/** The cavities as one flat mesh, seen from above through the gaps. */
function outlineGeometry(shapes:{y:number;points:PlanPoint[]}[]){
  const position:number[]=[],index:number[]=[];
  for(const {y,points} of shapes){
    const base=position.length/3;
    for(const p of points)position.push(p.x,y,p.y);
    for(const [a,b,c] of THREE.ShapeUtils.triangulateShape(points.map(p=>new THREE.Vector2(p.x,p.y)),[]))index.push(base+a,base+b,base+c);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(position,3));
  g.setAttribute('normal',new THREE.Float32BufferAttribute(position.map((_,i)=>i%3===1?1:0),3));
  g.setIndex(index);
  return g;
}

/** The cavity under every level's boards (inches, inside the viewer's 1/12 scale group). Casts no shadow of its own. */
export function GapUnderlay({levels}:{levels:readonly DeckLevel[]}){
  const geometry=useMemo(()=>outlineGeometry(gapUnderlayOutlines(levels)),[levels]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  const material=useMemo(()=>new THREE.MeshStandardMaterial({color:GAP_UNDERLAY.color,roughness:1,metalness:0,side:THREE.DoubleSide}),[]);
  useEffect(()=>()=>material.dispose(),[material]);
  return <mesh name="board-gap-underlay" geometry={geometry} material={material} receiveShadow/>;
}
