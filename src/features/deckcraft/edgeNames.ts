import type {DeckData,HouseConfig,HouseFinish} from './types';
import {pruneDeckFinishes} from './deckPartFinishes';
import {getFootprint} from './lib/deckGeometry';
import {getHouseContact} from './houseContact';
import {angledStairAllowed,angledStairFits,isChamferEdgeId} from './lib/cornerChamfers';
const liveWalls=(h:HouseConfig,f:Record<string,HouseFinish>)=>Object.entries(f).filter(([id])=>id.startsWith('main-')||h.footprint?.rects.some(b=>id.startsWith(b.id+'-')));
export function pruneEdgeNames(input:DeckData):DeckData{
  // Part and railing colours the deck can no longer take go quietly (deckPartFinishes.ts).
  input=pruneDeckFinishes(input);
  // A glass mount and finish belong to a frameless glass railing only.
  if(input.railingType!=='Frameless Glass'&&(input.glassMount!==undefined||input.glassFinish!==undefined)){const {glassMount:_m,glassFinish:_f,...rest}=input;input=rest;}
  // The finishes of house walls whose block was removed go too, so a block added later never picks them up.
  const h=input.houseConfig,f=h?.wallFinishes,walls=f&&liveWalls(h!,f),data=walls&&walls.length<Object.keys(f).length?{...input,houseConfig:{...h!,wallFinishes:walls.length?Object.fromEntries(walls):undefined}}:input;
  if(!data.stairEdgeId&&!data.level2EdgeId&&!data.level3?.edgeId)return data;
  const fp=getFootprint(data,1),contact=getHouseContact(data,fp);
  const edge=(id:string)=>{const i=fp.edgeIds?.indexOf(id)??-1;return i>=0&&!contact.isContactEdge(i)?i:-1;};
  const face=(i:number)=>{const a=fp.outline[i],b=fp.outline[(i+1)%fp.outline.length];return Math.hypot(b.x-a.x,b.y-a.y);};
  const stairOk=(id:string)=>{const i=edge(id);return i>=0&&(!isChamferEdgeId(id)||(angledStairAllowed(data)&&angledStairFits(face(i),data.stairWidth)));};
  const levelOk=(id:string)=>edge(id)>=0&&!isChamferEdgeId(id);
  const dropStair=!!data.stairEdgeId&&!stairOk(data.stairEdgeId),dropL2=!!data.level2EdgeId&&!levelOk(data.level2EdgeId);
  const dropL3=!!data.level3?.edgeId&&(data.level3.parent!==1||!levelOk(data.level3.edgeId));
  if(!dropStair&&!dropL2&&!dropL3)return data;
  const next={...data};
  if(dropStair)delete next.stairEdgeId;
  if(dropL2)delete next.level2EdgeId;
  if(dropL3&&next.level3){const {edgeId:_edge,...level3}=next.level3;next.level3=level3;}
  return next;
}

