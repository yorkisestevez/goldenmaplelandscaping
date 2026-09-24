import {getHousePlacement} from '../housePlacement';
import {getHouseConfig} from '../houseSettings';
import {activeWrap,wrapBlockers} from '../lib/wrapGeometry';
import type {PlanPoint} from '../lib/deckGeometry';
import type {DeckData,DeckShape,HousePlacement} from '../types';
import {chooseShape,setWing,splitLevel} from './deckShapeActions';

/**
 * The plan editor's arithmetic (PlanEditor.tsx), pure so the checks can run it: the handles a design has, their limits
 * and values, what a drag or a key does to a value, and the one patch a finished gesture commits. Values are feet, as the
 * Deck section's fields take them; positions are plan inches (x along the deck-facing wall from the deck's left end, y
 * out from the wall).
 */
export const PLAN_STEP_FT=0.5;
export const DECK_SIZE_FT=[4,60] as const;
export type PlanHandleId='depth'|'width-right'|'width-left'|'slide'|'cutout-width'|'cutout-depth'|'cutout2-width'|'cutout2-depth';
export interface PlanHandle{id:PlanHandleId;label:string;orientation:'horizontal'|'vertical';min:number;max:number;value:number;text:string;x:number;y:number}

const round2=(n:number)=>Math.round(n*100)/100;
/** A figure in feet, as the size heading writes it: 16, 16.5, 12.25. */
export const fmtFt=(ft:number)=>String(round2(ft));
export const clampFt=(value:number,min:number,max:number)=>round2(Math.min(max,Math.max(min,value)));

/**
 * A slider key: the arrows move 0.5 ft (Shift: 1 ft), Up and Right making the value larger as sliders do; Home and End
 * go to the limits. Null for any other key.
 */
export function keyValue(key:string,shift:boolean,value:number,min:number,max:number):number|null{
  const step=shift?1:PLAN_STEP_FT;
  const next=key==='ArrowUp'||key==='ArrowRight'?value+step:key==='ArrowDown'||key==='ArrowLeft'?value-step:key==='Home'?min:key==='End'?max:null;
  return next===null?null:clampFt(next,min,max);
}

/** How far a drag moves a handle's value (feet), from the pointer's travel in plan inches. */
export function dragDelta(id:PlanHandleId,dxIn:number,dyIn:number):number{
  switch(id){
    case 'depth':return dyIn/12;
    case 'width-right':case 'slide':case 'cutout2-width':return dxIn/12;
    case 'width-left':case 'cutout-width':return -dxIn/12;
    case 'cutout-depth':case 'cutout2-depth':return -dyIn/12;
  }
}

/** A drag in progress. Nothing about the design changes until it ends. */
export interface Gesture{id:PlanHandleId;pointerId:number;x:number;y:number;start:number;value:number;min:number;max:number}
export const beginGesture=(h:PlanHandle,pointerId:number,x:number,y:number):Gesture=>({id:h.id,pointerId,x,y,start:h.value,value:h.value,min:h.min,max:h.max});
/** The value under the pointer, in 0.5 ft steps from where the drag began and within the handle's limits. */
export function moveGesture(g:Gesture,dxIn:number,dyIn:number):Gesture{
  const value=clampFt(g.start+Math.round(dragDelta(g.id,dxIn,dyIn)/PLAN_STEP_FT)*PLAN_STEP_FT,g.min,g.max);
  return value===g.value?g:{...g,value};
}
/** The one value a finished drag commits, or null when it ends where it began. */
export const endGesture=(g:Gesture):number|null=>g.value!==g.start?g.value:null;

const deckIn=(data:DeckData)=>Math.max(12,(Number(data.width)||0)*12);
/**
 * The house placement that puts the house's left corner at `x0` (plan inches, clamped by the overlap rule every design
 * keeps), in the design's own anchor. Undefined when the design has no placement and would not need one.
 */
export function placementAt(data:DeckData,x0:number):HousePlacement|undefined{
  const anchor=data.housePlacement?.anchor??'center',W=deckIn(data),HW=getHousePlacement(data).widthIn,overlap=Math.min(24,W,HW);
  const x=Math.min(W-overlap,Math.max(overlap-HW,x0)),offsetIn=round2(x-(anchor==='left'?0:anchor==='right'?W-HW:W/2-HW/2));
  return !data.housePlacement&&anchor==='center'&&Math.abs(offsetIn)<.005?undefined:{anchor,offsetIn};
}
/**
 * A new width from one end of the deck: the other end stays where it is against the house (a house that follows the
 * deck's width, as the default one does, needs no placement for that). A wrap-around places the house itself.
 */
function widthPatch(data:DeckData,widthFt:number,end:'left'|'right'):Partial<DeckData>{
  if(data.houseVisible===false||activeWrap(data))return {width:widthFt};
  const next={...data,width:widthFt},before=getHousePlacement(data),HW=getHousePlacement(next).widthIn;
  const x0=end==='right'?before.x0:before.x1-deckIn(data)+deckIn(next)-HW,placement=placementAt(next,x0);
  return placement?{width:widthFt,housePlacement:placement}:{width:widthFt};
}

/** The deck's position along the wall: its left end, in feet from the house's left corner (more is further right). */
const slideLimits=(data:DeckData)=>{const W=deckIn(data),HW=getHousePlacement(data).widthIn,overlap=Math.min(24,W,HW);return {min:round2((overlap-W)/12),max:round2((HW-overlap)/12)};};
/** In words: where each end of the deck is against the house. */
export function describeSlide(data:DeckData):string{
  const {x0,x1}=getHousePlacement(data),W=deckIn(data);
  const end=(gap:number)=>Math.abs(gap)<.5?'at the house corner':gap>0?`${fmtFt(gap/12)} ft in from the house corner`:`${fmtFt(-gap/12)} ft past the house corner`;
  return `Left end ${end(-x0)}; right end ${end(x1-W)}`;
}

/** The patch one handle's value makes: exactly what its Deck or House field would set. */
export function handlePatch(data:DeckData,id:PlanHandleId,value:number):Partial<DeckData>{
  switch(id){
    case 'depth':return {length:value};
    case 'width-right':return widthPatch(data,value,'right');
    case 'width-left':return widthPatch(data,value,'left');
    case 'slide':{const placement=placementAt(data,-value*12);return placement?{housePlacement:placement}:{};}
    case 'cutout-width':return {cutoutWidth:value};
    case 'cutout-depth':return {cutoutLength:value};
    case 'cutout2-width':return {cutoutWidth2:value};
    case 'cutout2-depth':return {cutoutLength2:value};
  }
}
/** Where the deck drawn with `patch` sits in the plan as it is drawn now: a left-end width change keeps the right end in
 * place, and a slide moves the deck along the house. Plan inches along x. */
export function ghostShift(data:DeckData,id:PlanHandleId,value:number,start:number):number{
  return id==='width-left'?(Number(data.width)-value)*12:id==='slide'?(value-start)*12:0;
}

/** The handles a design has, placed on its main outline (plan inches). A custom outline sizes itself, and a wrap-around
 * decides the ends it is fastened round. */
export function planHandles(data:DeckData,outline:PlanPoint[]):PlanHandle[]{
  const xs=outline.map(p=>p.x),ys=outline.map(p=>p.y),maxX=Math.max(...xs),minX=Math.min(...xs),maxY=Math.max(...ys);
  const mid=(v:number[])=>(Math.min(...v)+Math.max(...v))/2;
  const custom=data.shape==='Custom',wrap=activeWrap(data),W=Number(data.width),L=Number(data.length),[lo,hi]=DECK_SIZE_FT,out:PlanHandle[]=[];
  const add=(id:PlanHandleId,label:string,orientation:PlanHandle['orientation'],min:number,max:number,value:number,text:string,x:number,y:number)=>out.push({id,label,orientation,min,max,value:clampFt(value,min,max),text,x,y});
  if(!custom){
    add('depth','Deck depth, front edge','vertical',lo,hi,L,`${fmtFt(L)} ft deep`,mid(outline.filter(p=>p.y>=maxY-.5).map(p=>p.x)),maxY);
    // Each end's handle sits halfway along that side in front of the wall. A wing's outer end stays with its wing, so
    // a one-sided wrap-around is sized from its other end, and a two-sided one takes its width from the house.
    const side=(x:number)=>{const v=outline.filter(p=>Math.abs(p.x-x)<.5).map(p=>p.y);return (Math.max(0,Math.min(...v))+Math.max(...v))/2;};
    if(!wrap?.right)add('width-right','Deck width, right end','horizontal',lo,hi,W,`${fmtFt(W)} ft wide`,maxX,side(maxX));
    if(!wrap?.left)add('width-left','Deck width, left end','horizontal',lo,hi,W,`${fmtFt(W)} ft wide`,minX,side(minX));
  }
  if(data.houseVisible!==false&&!wrap){
    const {min,max}=slideLimits(data),x0=getHousePlacement(data).x0;
    add('slide','Deck position along the house','horizontal',min,max,-x0/12,describeSlide(data),(minX+maxX)/2,Math.min(maxY/2,30));
  }
  // A cut-out handle keeps at least 1 ft, so the corner it moves never disappears under it (the Deck section's fields
  // still take a cut-out to 0).
  if(!wrap&&(data.shape==='L-Shape'||data.shape==='Multi-corner')){
    const Win=Math.max(12,W*12),Lin=Math.max(12,L*12),cw=Math.min(Number(data.cutoutWidth)*12,Win*.8),cl=Math.min(Number(data.cutoutLength)*12,Lin*.8);
    if(cw>0&&cl>0){
      add('cutout-width','Corner cut-out width, front right','horizontal',1,round2(W*.8),Number(data.cutoutWidth),`${fmtFt(cw/12)} ft wide`,Win-cw,Lin-cl/2);
      add('cutout-depth','Corner cut-out depth, front right','vertical',1,round2(L*.8),Number(data.cutoutLength),`${fmtFt(cl/12)} ft deep`,Win-cw/2,Lin-cl);
      const cw2=Math.min(Number(data.cutoutWidth2)*12,Math.max(0,Win-cw)*.8),cl2=Math.min(Number(data.cutoutLength2)*12,Lin*.8);
      if(data.shape==='Multi-corner'&&cw2>0&&cl2>0){
        add('cutout2-width','Second cut-out width, front left','horizontal',1,round2(Math.max(0,W-Number(data.cutoutWidth))*.8),Number(data.cutoutWidth2),`${fmtFt(cw2/12)} ft wide`,cw2,Lin-cl2/2);
        add('cutout2-depth','Second cut-out depth, front left','vertical',1,round2(L*.8),Number(data.cutoutLength2),`${fmtFt(cl2/12)} ft deep`,cw2/2,Lin-cl2);
      }
    }
  }
  return out;
}

/** The live figure beside a drag: the new size, the cut-out, or where the deck sits against the house. */
export function gestureFigure(data:DeckData,id:PlanHandleId,value:number):string{
  const next={...data,...handlePatch(data,id,value)};
  if(id==='slide')return describeSlide(next);
  if(id.startsWith('cutout2'))return `Cut-out ${fmtFt(Number(next.cutoutWidth2))} × ${fmtFt(Number(next.cutoutLength2))} ft`;
  if(id.startsWith('cutout'))return `Cut-out ${fmtFt(Number(next.cutoutWidth))} × ${fmtFt(Number(next.cutoutLength))} ft`;
  return `${fmtFt(Number(next.width))} × ${fmtFt(Number(next.length))} ft · ${Math.round(Number(next.width)*Number(next.length))} sq ft`;
}

/**
 * The shape shortcuts on the drawing (the same actions as the Deck section, from deckShapeActions.ts): the patch to
 * apply (none when nothing changes), the status line to show, and whether the Deck section should open.
 */
export type PlanShortcutId=DeckShape|'wrap-left'|'wrap-right'|'wrap-both'|'split';
const SHAPE_WORDS:Record<DeckShape,string>={Rectangle:'a rectangle','L-Shape':'an L-shape','Multi-corner':'a multi-corner deck',Curved:'a curved front',Custom:'your own outline'};
const lower=(s:string)=>s.charAt(0).toLowerCase()+s.slice(1);
export function planShortcut(data:DeckData,id:PlanShortcutId):{patch:Partial<DeckData>|null;status:string;openDeck?:boolean}{
  if(id==='split'){
    if(data.levels>=2)return {patch:{levels:1},status:'Back to one level.'};
    if(data.shape==='Custom')return {patch:null,status:'A custom outline is one level. Choose another shape for a split level.'};
    return {patch:splitLevel(data),status:'Added a lower level one step down across the front. Adjust it in Deck shape & size.'};
  }
  if(id==='wrap-left'||id==='wrap-right'||id==='wrap-both'){
    if(data.deckType!=='Attached'&&data.deckType!=='Add-on')return {patch:null,status:'Attach the deck to the house (Attached or Add-on) to wrap it around a corner.'};
    const want={left:id!=='wrap-right',right:id!=='wrap-left'},on=!!data.wrap?.left===want.left&&!!data.wrap?.right===want.right;
    // Pressing the wrap already on takes the wrap-around off.
    const target=on?{left:false,right:false}:want,house=getHouseConfig(data);
    let next=data,patch:Partial<DeckData>={},fix='';
    for(const side of ['left','right'] as const)if(!!next.wrap?.[side]!==target[side]){const r=setWing(next,house,side,target[side]);patch={...patch,...r.patch};next={...next,...r.patch};fix=r.status||fix;}
    return {patch,status:on?'Wrap-around removed.':[`Wrapped round ${id==='wrap-both'?'both house corners':`the ${id==='wrap-left'?'left':'right'} house corner`}.`,fix].filter(Boolean).join(' ')};
  }
  if(data.shape===id)return {patch:null,status:'',openDeck:id==='Custom'};
  const patch=chooseShape(data,id),paused=data.wrap&&(data.wrap.left||data.wrap.right)?wrapBlockers({...data,...patch}):[];
  const done=id==='Custom'?'Now your own outline: shape it in Deck shape & size.':`Now ${SHAPE_WORDS[id]}.${id==='L-Shape'||id==='Multi-corner'?' Drag the gold cut-out handles to size the corner.':''}`;
  return {patch,status:paused.length?`${done} The wrap-around is paused: ${lower(paused[0])}`:done,openDeck:id==='Custom'};
}
