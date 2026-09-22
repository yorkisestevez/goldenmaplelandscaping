import type {DeckData,DoorStyle,GarageDoorStyle,HouseConfig,HouseOpening,WindowStyle} from './types';
import {clampHouseOpening,getHouseConfig} from './houseSettings';
import {getHouseBlocks,getHouseWalls,openingHidden,openingWallId,SIDE_FACADE,type HouseWallPlan} from './houseFootprint';

/**
 * Adding, restyling and removing house doors and windows. All of it is appearance: openings never
 * change the deck, its quantities or its price.
 */
export const MAX_HOUSE_OPENINGS=24;
export const WINDOW_STYLES:readonly WindowStyle[]=['Double-hung','Casement','Picture','Slider','Awning'];
export const GARAGE_DOOR_STYLES:readonly GarageDoorStyle[]=['Panel','Carriage','Flush','Glass'];

/** A ready-made opening: its look and a sensible size. `sillIn` is the bottom above that wall's floor. */
export interface OpeningPreset{key:string;type:HouseOpening['type'];style?:HouseOpening['style'];label:string;widthIn:number;heightIn:number;sillIn:number}
const preset=(type:HouseOpening['type'],style:HouseOpening['style']|undefined,label:string,widthIn:number,heightIn:number,sillIn:number):OpeningPreset=>({key:`${type}:${style??''}`,type,...(style?{style}:{}),label,widthIn,heightIn,sillIn});
export const OPENING_PRESETS:readonly OpeningPreset[]=[
  preset('Door',undefined,'Glass panel door',36,84,0),
  preset('Door','Single','Single door with lite',36,80,0),
  preset('Door','French','French doors',60,80,0),
  preset('Door','Sliding','Sliding patio door',72,80,0),
  preset('Window',undefined,'Standard window',48,54,30),
  preset('Window','Double-hung','Double-hung window',32,60,24),
  preset('Window','Casement','Casement window',48,48,32),
  preset('Window','Picture','Picture window',72,54,24),
  preset('Window','Slider','Sliding window',60,36,42),
  preset('Window','Awning','Awning window',36,20,58),
  ...GARAGE_DOOR_STYLES.map(style=>preset('Garage',style,`Garage door (${style.toLowerCase()})`,108,84,0)),
];
export const presetFor=(o:Pick<HouseOpening,'type'|'style'>)=>OPENING_PRESETS.find(p=>p.type===o.type&&p.style===o.style)??OPENING_PRESETS.find(p=>p.type===o.type&&!p.style)??OPENING_PRESETS.find(p=>p.type===o.type)!;
/** Plain name, e.g. "French doors" or "Casement window". */
export const openingLabel=(o:Pick<HouseOpening,'type'|'style'>)=>presetFor(o).label;
/** The looks an opening of this type can take (a door can become French doors, never a casement window). */
export const stylesFor=(type:HouseOpening['type'])=>OPENING_PRESETS.filter(p=>p.type===type);

/** Floor height (above grade) behind a wall: that block's floor, else the house floor, else the deck. */
export function wallFloorIn(data:DeckData,wallId:string){
  const house=getHouseConfig(data),block=getHouseBlocks(data).find(b=>b.id===wallId.split('-')[0]);
  return block?.floorHeightIn??(block?.kind==='garage'?4:house.floorHeightIn??data.height);
}

/** Walls an opening can go on: every wall with a stretch not covered by another block. */
export const openableWalls=(data:DeckData)=>getHouseWalls(data).filter(w=>w.exposed.length>0);

/** Centre (inches from the wall's start) for a new opening: the widest clear stretch, which takes the
 * whole opening while the wall has room. On a crowded wall it is still the widest gap, so any overlap
 * (reported by the editor) is as small as it can be. Null when the wall has no clear stretch at all. */
function clearSpot(wall:HouseWallPlan,openings:HouseOpening[],house:HouseConfig){
  const taken=openings.filter(o=>openingWallId(o,house)===wall.id).map(o=>{const at=wall.lengthIn*o.offsetPct/100;return [at-o.widthIn/2-12,at+o.widthIn/2+12] as [number,number];});
  let free:[number,number][]=wall.exposed.map(([s,e])=>[s+6,e-6]);
  for(const [l,r] of taken)free=free.flatMap(([a,b])=>r<=a||l>=b?[[a,b]]:[...(l>a?[[a,l]]:[]),...(r<b?[[r,b]]:[])] as [number,number][]);
  const best=free.filter(([a,b])=>b>a).sort((p,q)=>(q[1]-q[0])-(p[1]-p[0]))[0];
  return best?(best[0]+best[1])/2:null;
}

/**
 * A new opening from a preset on a wall, centred in the widest clear stretch of that wall. On a wall
 * too crowded for it, the editor reports the overlap. Null when the house already has the maximum
 * number of openings or the wall has no visible stretch.
 */
export function newHouseOpening(data:DeckData,presetKey:string,wallId:string,id=`opening-${Date.now().toString(36)}`):HouseOpening|null{
  const house=getHouseConfig(data),p=OPENING_PRESETS.find(q=>q.key===presetKey);
  if(!p||house.openings.length>=MAX_HOUSE_OPENINGS)return null;
  const walls=getHouseWalls(data),wall=walls.find(w=>w.id===wallId&&w.exposed.length>0);if(!wall)return null;
  const widthIn=Math.min(p.widthIn,wall.lengthIn-12),widest=wall.exposed.reduce((best,s)=>s[1]-s[0]>best[1]-best[0]?s:best);
  const at=clearSpot(wall,house.openings.filter(o=>!openingHidden(o,walls,house)),house)??(widest[0]+widest[1])/2;
  const main=wall.blockId==='main';
  const opening:HouseOpening={id,type:p.type,facade:SIDE_FACADE[wall.side],...(main?{}:{wallId:wall.id}),...(p.style?{style:p.style as DoorStyle}:{}),offsetPct:at/wall.lengthIn*100,bottomIn:wallFloorIn(data,wall.id)+p.sillIn,widthIn,heightIn:p.heightIn};
  return clampHouseOpening(opening,house);
}

/** The house with one more opening (or unchanged when none can be added). */
export function addHouseOpening(data:DeckData,presetKey:string,wallId:string,id?:string):{houseConfig:HouseConfig;added:HouseOpening|null}{
  const house=getHouseConfig(data),added=newHouseOpening(data,presetKey,wallId,id);
  return {houseConfig:added?{...house,openings:[...house.openings,added]}:house,added};
}
export const removeHouseOpening=(house:HouseConfig,id:string):HouseConfig=>({...house,openings:house.openings.filter(o=>o.id!==id)});
/** Restyles an opening within its type, keeping its size and place. */
export const restyleHouseOpening=(house:HouseConfig,id:string,style:HouseOpening['style']):HouseConfig=>({...house,openings:house.openings.map(o=>o.id!==id?o:style?{...o,style}:(({style:_,...rest})=>rest)(o))});
