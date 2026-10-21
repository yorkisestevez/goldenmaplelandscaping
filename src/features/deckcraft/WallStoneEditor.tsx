import type {YardFeature} from './types';
import {GUILLOTINED_WALL,WALL_STONES,WALL_STONE_COURSES_IN,wallStoneOf} from './wallStones';

/** Picking a product from the list. A guillotined wall starts as Carr Orillia Grey in 14 in courses, its bed as deep
 * as the course and drawn in the stone's colour. */
export function wallProductPatch(f:YardFeature,productId:string):Partial<YardFeature>{
 const patch:Partial<YardFeature>={productId,hardscape:undefined,depthFt:f.kind==='retaining-wall'?Math.max(.5,f.depthFt):f.depthFt};
 if(productId!==GUILLOTINED_WALL)return patch;
 const {stone,courseIn}=wallStoneOf({});return {...patch,wallStone:{stoneId:stone.id,courseIn},depthFt:courseIn/12,color:stone.hex};
}
/** Any edit that moves a wall off the guillotined product (the list or the material picker) drops its stone choice. */
export function withoutStaleStone(f:YardFeature,patch:Partial<YardFeature>):Partial<YardFeature>{
 return f.wallStone&&patch.productId!==undefined&&patch.productId!==GUILLOTINED_WALL?{...patch,wallStone:undefined}:patch;
}

/** The stone and course of a guillotined armour stone wall. */
export default function WallStoneEditor({feature,onChange}:{feature:YardFeature;onChange:(patch:Partial<YardFeature>)=>void}){
 const {stone,courseIn}=wallStoneOf(feature);
 return <>
  <label className="dd-field"><span>Wall stone</span><select aria-label="Wall stone" value={stone.id} onChange={e=>{const next=WALL_STONES.find(s=>s.id===e.target.value)!;onChange({wallStone:{stoneId:next.id,courseIn},color:next.hex});}}>{WALL_STONES.map(s=><option value={s.id} key={s.id}>{s.name} (Carr)</option>)}</select></label>
  <label className="dd-field"><span>Course height</span><select aria-label="Course height" value={courseIn} onChange={e=>{const next=Number(e.target.value);onChange({wallStone:{stoneId:stone.id,courseIn:next},depthFt:next/12});}}>{WALL_STONE_COURSES_IN.map(h=><option value={h} key={h}>{h} in</option>)}</select></label>
  <p className="dd-note">Carr Landscape Depot guillotined wallstone: flat tops and beds, random 24–48 in lengths, as deep as the course. Confirm the size and stock with Carr.</p>
 </>;
}
