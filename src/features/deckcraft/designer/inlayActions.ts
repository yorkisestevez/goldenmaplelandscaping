import type {DeckData,DeckInlay} from '../types';
import type {DeckLevel,DeckTakeoff} from '../deckTakeoff';
import type {PlanPoint} from '../lib/deckGeometry';
import {partAllowed} from '../boardFinishes';
import {INLAY_LIMITS,levelInlayContext,planInlays,validateDeckInlay,type InlayPlan} from '../lib/inlayGeometry';

export const inlayPlanLevel=(model:DeckTakeoff,level=1)=>model.levels.find(l=>(l.kind??'deck')==='deck'&&(l.index??0)+1===level);
export function inlayLevelAt(model:DeckTakeoff,world:PlanPoint){
 for(const deck of model.levels.filter(l=>(l.kind??'deck')==='deck').sort((a,b)=>b.top-a.top)){
  const point={x:world.x-deck.offset.x,y:world.y-deck.offset.z},poly=deck.footprint.outline;let inside=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)inside=!inside;}
  if(inside)return {level:((deck.index??0)+1) as 1|2|3,point};
 }return null;
}
const finite=(n:number)=>{if(!Number.isFinite(n))throw Error('Enter a finite measurement.');return n;};
const offsets=(i:DeckInlay)=>i.kind==='band'?[i.atFt??0]:[i.dxFt??0,i.dyFt??0];
export function inlayCentre(level:DeckLevel,inlay:DeckInlay):PlanPoint{
 const centre={x:(level.footprint.origin?.x??0)+level.footprint.bounds.w/2,y:(level.footprint.origin?.y??0)+level.footprint.bounds.h/2};
 return inlay.kind==='band'?{x:centre.x+(inlay.direction==='along'?(inlay.atFt??0)*12:0),y:centre.y+(inlay.direction==='across'?(inlay.atFt??0)*12:0)}:{x:centre.x+(inlay.dxFt??0)*12,y:centre.y+(inlay.dyFt??0)*12};
}
export function validateInlayCandidate(data:DeckData,model:DeckTakeoff,inlay:DeckInlay):InlayPlan{
 inlay=validateDeckInlay(inlay);
 for(const ref of [inlay.fill,inlay.kind==='band'?undefined:inlay.frame])if(ref&&!partAllowed(data,ref))throw Error('Choose an inlay colour compatible with the selected decking material.');
 if(!inlay.id||inlay.id.length>64)throw Error('Choose a valid inlay identifier.');
 if(offsets(inlay).some(n=>!Number.isFinite(n)||n<INLAY_LIMITS.offsetFt[0]||n>INLAY_LIMITS.offsetFt[1]))throw Error('Keep the inlay offset within 30 feet of its deck level’s middle.');
 const n=inlay.level??1,level=inlayPlanLevel(model,n);if(!level)throw Error('Choose a deck level that exists.');
 const ctx=levelInlayContext(data,level);
 if(level.wrapZones)ctx.blocked='Inlays are not built on a wrap-around deck.';
 else if(n===1&&data.hasInlay)ctx.blocked='Replace the earlier centre stripe with a band before placing decorative inlays.';
 const others=(data.inlays??[]).filter(i=>i.id!==inlay.id&&(i.level??1)===n);
 const plan=planInlays([...others,inlay],ctx,{boards:false}).at(-1)!;
 if(plan.status!=='ok')throw Error(plan.message??'This inlay does not fit here.');return plan;
}
const saved=(inlays:DeckInlay[]):Partial<DeckData>=>({inlays:inlays.length?inlays:undefined});
export function placeInlayPatch(data:DeckData,model:DeckTakeoff,inlay:DeckInlay,level:1|2|3,point:PlanPoint):Partial<DeckData>{
 inlay=validateDeckInlay(inlay);
 const all=data.inlays??[];if(all.length>=INLAY_LIMITS.max)throw Error(`A design holds up to ${INLAY_LIMITS.max} inlays.`);
 if(all.some(i=>i.id===inlay.id))throw Error('That inlay identifier already exists. Choose Add again.');
 const deck=inlayPlanLevel(model,level);if(!deck)throw Error('Tap an existing deck level.');
 const c=inlayCentre(deck,{...inlay,...(inlay.kind==='band'?{atFt:0}:{dxFt:0,dyFt:0})} as DeckInlay),x=(finite(point.x)-c.x)/12,y=(finite(point.y)-c.y)/12;
 const placed=validateDeckInlay({...inlay,level,...(inlay.kind==='band'?{atFt:inlay.direction==='along'?x:y}:{dxFt:x,dyFt:y})});
 validateInlayCandidate(data,model,placed);return saved([...all,placed]);
}
export function editInlayPatch(data:DeckData,model:DeckTakeoff,id:string,next:DeckInlay):Partial<DeckData>{
 next=validateDeckInlay(next);
 if(!(data.inlays??[]).some(i=>i.id===id)||next.id!==id)throw Error('That inlay is no longer in this design.');
 validateInlayCandidate(data,model,next);return saved(data.inlays!.map(i=>i.id===id?next:i));
}
export function moveInlayPatch(data:DeckData,model:DeckTakeoff,id:string,dxIn:number,dyIn:number):Partial<DeckData>{
 const inlay=data.inlays?.find(i=>i.id===id);if(!inlay)throw Error('That inlay is no longer in this design.');
 finite(dxIn);finite(dyIn);
 const next:DeckInlay=inlay.kind==='band'?{...inlay,atFt:(inlay.atFt??0)+(inlay.direction==='along'?dxIn:dyIn)/12}:{...inlay,dxFt:(inlay.dxFt??0)+dxIn/12,dyFt:(inlay.dyFt??0)+dyIn/12};
 return editInlayPatch(data,model,id,next);
}
export function rotateInlayPatch(data:DeckData,model:DeckTakeoff,id:string,rotationDeg:number):Partial<DeckData>{
 const inlay=data.inlays?.find(i=>i.id===id);if(!inlay)throw Error('That inlay is no longer in this design.');
 if(inlay.kind==='band')throw Error('A band runs across the whole deck. Change its Runs setting to turn it.');
 if(Math.abs(finite(rotationDeg))>360)throw Error('Enter a rotation between −360 and 360 degrees.');
 return editInlayPatch(data,model,id,{...inlay,rotationDeg});
}
export function removeInlayPatch(data:DeckData,id:string):Partial<DeckData>{
 if(!data.inlays?.some(i=>i.id===id))throw Error('That inlay is no longer in this design.');return saved(data.inlays.filter(i=>i.id!==id));
}
