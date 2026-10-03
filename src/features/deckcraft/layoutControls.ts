import type {DeckData,DeckShape} from './types';
import type {DeckTakeoff} from './deckTakeoff';
import {getStairPlacement,type EdgeName,type PlanPoint,type StairPlacement} from './lib/deckGeometry';

export function landingSplit(total:number,requested?:number){
  // Keep each modeled run within the existing 14-riser split convention.
  const min=Math.max(1,total-14),max=Math.min(14,total-1);
  const upper=Math.max(min,Math.min(max,Number.isFinite(requested)?Math.round(requested!):Math.ceil(total/2)));
  return {upper,lower:total-upper,min,max};
}
export function layoutExitDeck(data:DeckData,model:DeckTakeoff){return model.levels[data.levels>1&&data.height2<=data.height?1:0];}
export function layoutEdges(data:DeckData,model:DeckTakeoff):EdgeName[]{
  const attached=data.deckType==='Attached'||data.deckType==='Add-on';
  const occupied=data.levels>1?(data.height2<=data.height?(data.level2Position==='Left'?'Right':data.level2Position==='Right'?'Left':'Back'):(data.level2Position??'Front')):null;
  const deck=layoutExitDeck(data,model);
  return (['Front','Left','Right',...(!attached?['Back']:[])] as EdgeName[]).filter(edge=>edge!==occupied&&!!getStairPlacement({...data,stairFlights:1,stairPosition:edge},deck.footprint));
}
export function layoutOpening(data:DeckData,model:DeckTakeoff,edge:EdgeName,offset=data.stairOffset):StairPlacement{
  return getStairPlacement({...data,stairFlights:1,stairPosition:edge,stairOffset:offset},layoutExitDeck(data,model).footprint)!;
}
/** Pointer location -> clamped offset on the same edge selected by the shared engine. */
export function stairOffsetAtPoint(data:DeckData,model:DeckTakeoff,edge:EdgeName,point:PlanPoint){
  const deck=layoutExitDeck(data,model),a=layoutOpening(data,model,edge,0),b=layoutOpening(data,model,edge,100);
  const dx=b.origin.x-a.origin.x,dy=b.origin.y-a.origin.y,denom=dx*dx+dy*dy;
  if(denom<.0001)return 50;
  const x=point.x-deck.offset.x-a.origin.x-a.along.x*a.width/2,y=point.y-deck.offset.z-a.origin.y-a.along.y*a.width/2;
  return Math.round(Math.max(0,Math.min(1,(x*dx+y*dy)/denom))*100);
}
/** Translate walking-down left/right into the legacy edge-local turn sign. */
export function stairTurnForDirection(opening:StairPlacement,direction:'Left'|'Right'){
  const left={x:opening.outward.y,y:-opening.outward.x},dot=left.x*opening.along.x+left.y*opening.along.y;
  return (direction==='Left'?dot:-dot)<0?'Left' as const:'Right' as const;
}
export function shapePatch(data:DeckData,shape:DeckShape,corner:'Left'|'Right'='Right'):Partial<DeckData>{
  return {shape,cutoutCorner:corner,...(shape==='L-Shape'||shape==='Multi-corner'?{
    cutoutWidth:Math.min(data.cutoutWidth||data.width/3,data.width*.8),cutoutLength:Math.min(data.cutoutLength||data.length/3,data.length*.8),
    ...(shape==='Multi-corner'?{cutoutWidth2:Math.min(data.cutoutWidth2||data.width/4,Math.max(0,data.width-Math.min(data.cutoutWidth||data.width/3,data.width*.8))*.8),cutoutLength2:Math.min(data.cutoutLength2||data.length/3,data.length*.8)}:{}),
  }:{})};
}
