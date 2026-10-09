import type {DeckTakeoff} from '../deckTakeoff';
import {availableStairSides,getHouseContact} from '../houseContact';
import {getHousePlacement} from '../housePlacement';
import {clampHouseOpening,getHouseConfig} from '../houseSettings';
import {activeCornerChamfers,CORNER_CHAMFER_FT} from '../lib/cornerChamfers';
import {edgeFacing,getFootprint,getStairPlacement,type EdgeName,type PlanPoint} from '../lib/deckGeometry';
import {activeWrap,WRAP_MIN_MAIN_LEDGER_IN,WRAP_WING_WIDTH_FT,wrapBlockers} from '../lib/wrapGeometry';
import type {DeckData,DeckShape,HouseConfig,HousePlacement} from '../types';
import type {PlanTool} from './constants';
import {chooseShape,drawOwnOutline,setWing,setWingSize,splitLevel} from './deckShapeActions';

/**
 * The plan editor's arithmetic (PlanEditor.tsx), pure so the checks can run it: the handles a design has, their limits
 * and values, what a drag or a key does to a value, and the one patch a finished gesture commits. Values are feet, as the
 * Deck section's fields take them (a stair's position is a percentage, as its field is); positions are plan inches (x
 * along the deck-facing wall from the deck's left end, y out from the wall).
 */
export const PLAN_STEP_FT=0.5;
export const DECK_SIZE_FT=[4,60] as const;
/** The House section's width field: 12 to 100 ft. */
export const HOUSE_WIDTH_FT=[12,100] as const;
/** The Deck section's second-level depth field: 4 to 40 ft. */
export const LEVEL2_DEPTH_FT=[4,40] as const;
export type PlanHandleId='depth'|'width-right'|'width-left'|'slide'|'cutout-width'|'cutout-depth'|'cutout2-width'|'cutout2-depth'
  |'level2-depth'|'wing-left'|'wing-right'|'chamfer-left'|'chamfer-right'|'house-left'|'house-right'|'stair';
export interface PlanHandle{
  id:PlanHandleId;label:string;orientation:'horizontal'|'vertical';min:number;max:number;value:number;text:string;x:number;y:number;
  /** R5's handles: how far the handle moves on the plan (inches) for one unit of its value, so a drag follows the pointer
   * along that line; R4's handles keep their own directions (dragDelta). */
  move?:{x:number;y:number};
  /** The arrow keys' step and Shift's (default 0.5 and 1 ft). */
  step?:number;bigStep?:number;
}

const round2=(n:number)=>Math.round(n*100)/100;
/** A figure in feet, as the size heading writes it: 16, 16.5, 12.25. */
export const fmtFt=(ft:number)=>String(round2(ft));
export const clampFt=(value:number,min:number,max:number)=>round2(Math.min(max,Math.max(min,value)));
/** Down to the 6 in grid the handles move on. */
const floorHalf=(ft:number)=>Math.floor(ft*2+1e-9)/2;

/**
 * A slider key: the arrows move 0.5 ft (Shift: 1 ft), Up and Right making the value larger as sliders do; Home and End
 * go to the limits. Null for any other key. A handle with steps of its own (a stair's position) passes them.
 */
export function keyValue(key:string,shift:boolean,value:number,min:number,max:number,step=PLAN_STEP_FT,bigStep=1):number|null{
  const by=shift?bigStep:step;
  const next=key==='ArrowUp'||key==='ArrowRight'?value+by:key==='ArrowDown'||key==='ArrowLeft'?value-by:key==='Home'?min:key==='End'?max:null;
  return next===null?null:clampFt(next,min,max);
}

/** How far a drag moves one of R4's handles' values (feet), from the pointer's travel in plan inches. */
export function dragDelta(id:PlanHandleId,dxIn:number,dyIn:number):number{
  switch(id){
    case 'depth':return dyIn/12;
    case 'width-right':case 'slide':case 'cutout2-width':return dxIn/12;
    case 'width-left':case 'cutout-width':return -dxIn/12;
    case 'cutout-depth':case 'cutout2-depth':return -dyIn/12;
    default:return 0;
  }
}

/** A drag in progress. Nothing about the design changes until it ends. */
export interface Gesture{id:PlanHandleId;pointerId:number;x:number;y:number;start:number;value:number;min:number;max:number;move?:{x:number;y:number};step?:number}
export const beginGesture=(h:PlanHandle,pointerId:number,x:number,y:number):Gesture=>({id:h.id,pointerId,x,y,start:h.value,value:h.value,min:h.min,max:h.max,...(h.move?{move:h.move}:{}),...(h.step?{step:h.step}:{})});
/** The value under the pointer, in 0.5 ft steps (or the handle's own) from where the drag began and within the handle's
 * limits. A handle with a line to follow takes the pointer's travel along that line. */
export function moveGesture(g:Gesture,dxIn:number,dyIn:number):Gesture{
  const m=g.move,delta=m?(dxIn*m.x+dyIn*m.y)/(m.x*m.x+m.y*m.y||1):dragDelta(g.id,dxIn,dyIn),step=g.step??PLAN_STEP_FT;
  const value=clampFt(g.start+Math.round(delta/step)*step,g.min,g.max);
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
/**
 * A new house width from one wall end: the House section's own width change (its openings clamped to the new walls by
 * clampHouseOpening, as that field does), and the other wall end stays where it is against the deck. A wrap-around
 * places the house itself.
 */
export function houseWidthPatch(data:DeckData,widthFt:number,end:'left'|'right'):Partial<DeckData>{
  const house=getHouseConfig(data),next:HouseConfig={...house,widthFt};
  next.openings=next.openings.map(o=>clampHouseOpening(o,next));
  if(activeWrap(data))return {houseConfig:next};
  const before=getHousePlacement(data),placement=placementAt({...data,houseConfig:next},end==='right'?before.x0:before.x1-widthFt*12);
  return placement?{houseConfig:next,housePlacement:placement}:{houseConfig:next};
}

/** The deck's position along the wall: its left end, in feet from the house's left corner (more is further right). */
const slideLimits=(data:DeckData)=>{const W=deckIn(data),HW=getHousePlacement(data).widthIn,overlap=Math.min(24,W,HW);return {min:round2((overlap-W)/12),max:round2((HW-overlap)/12)};};
/** In words: where each end of the deck is against the house. */
export function describeSlide(data:DeckData):string{
  const {x0,x1}=getHousePlacement(data),W=deckIn(data);
  const end=(gap:number)=>Math.abs(gap)<.5?'at the house corner':gap>0?`${fmtFt(gap/12)} ft in from the house corner`:`${fmtFt(-gap/12)} ft past the house corner`;
  return `Left end ${end(-x0)}; right end ${end(x1-W)}`;
}

/** The patch one handle's value makes: exactly what its Deck, Stairs or House field would set (a width or house-width
 * drag also keeps the other end where it is). */
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
    case 'level2-depth':return {length2:value};
    case 'wing-left':case 'wing-right':return setWingSize(data,id==='wing-left'?'left':'right',{widthFt:value})??{};
    case 'chamfer-left':return {cornerChamfers:{...data.cornerChamfers,frontLeftFt:value}};
    case 'chamfer-right':return {cornerChamfers:{...data.cornerChamfers,frontRightFt:value}};
    case 'house-left':return houseWidthPatch(data,value,'left');
    case 'house-right':return houseWidthPatch(data,value,'right');
    case 'stair':return {stairOffset:value};
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

/** The second level, as the model built it, and the side of its parent it joins: its depth runs out from that side when
 * it sits in front of or behind the deck. */
function level2(model:DeckTakeoff){
  const i=model.levels.findIndex((l,k)=>k>0&&l.kind==='deck'&&l.index===1),c=model.connections.find(x=>x.to===i);
  return i>0&&c?{level:model.levels[i],outward:c.opening.outward}:null;
}

/**
 * The rest of the Size & place tool's handles (R5), beside planHandles(): the second level's depth (when it sits in front
 * of or behind the deck it joins), each wrap-around wing's width at its outer end, and each angled front corner's cut.
 * Their limits are their Deck section fields', narrowed to what the design can build (a one-sided wing leaves the main
 * deck its ledger; two angled corners leave the front and each side their straight run).
 */
export function shapeHandles(data:DeckData,model:DeckTakeoff):PlanHandle[]{
  const out:PlanHandle[]=[],main=model.levels[0],ox=main.offset.x,oz=main.offset.z,o=main.footprint.outline;
  const L2=level2(model);
  if(data.levels>=2&&L2&&Math.abs(L2.outward.y)>.5){
    const {level:l,outward}=L2,front=outward.y>0,{w,h}=l.footprint.bounds,[lo,hi]=LEVEL2_DEPTH_FT,v=clampFt(Number(data.length2),lo,hi);
    out.push({id:'level2-depth',label:`Second level depth, ${front?'front':'back'} edge`,orientation:'vertical',min:lo,max:hi,value:v,text:`Second level ${fmtFt(v)} ft deep`,x:l.offset.x+w/2,y:front?l.offset.z+h:l.offset.z,move:{x:0,y:front?12:-12}});
  }
  const wrap=activeWrap(data);
  if(wrap){
    const xs=o.map(p=>p.x),one=!(wrap.left&&wrap.right),cap=one?Math.min(WRAP_WING_WIDTH_FT[1],floorHalf((deckIn(data)-WRAP_MIN_MAIN_LEDGER_IN)/12)):WRAP_WING_WIDTH_FT[1];
    for(const side of ['left','right'] as const){
      const wing=wrap[side];if(!wing||cap<WRAP_WING_WIDTH_FT[0])continue;
      const v=clampFt(wing.widthIn/12,WRAP_WING_WIDTH_FT[0],cap),dir=side==='left'?-1:1,name=side==='left'?'Left':'Right';
      out.push({id:side==='left'?'wing-left':'wing-right',label:`${name} wing width, outer end`,orientation:'horizontal',min:WRAP_WING_WIDTH_FT[0],max:cap,value:v,text:`${name} wing ${fmtFt(v)} ft out from the house`,x:ox+(side==='left'?Math.min(...xs):Math.max(...xs)),y:oz-wing.runIn/2,move:{x:dir*12,y:0}});
    }
  }
  const ch=activeCornerChamfers(data);
  if(ch){
    const {w:W,h:L}=main.footprint.bounds,[c0,c1]=CORNER_CHAMFER_FT;
    for(const side of ['left','right'] as const){
      const leg=side==='left'?ch.leftIn:ch.rightIn,other=side==='left'?ch.rightIn:ch.leftIn;if(!leg)continue;
      const max=Math.min(c1,floorHalf((L-36)/12),floorHalf((W-24-other)/12));if(max<c0)continue;
      const v=clampFt(leg/12,c0,max),x=side==='left'?leg/2:W-leg/2;
      out.push({id:side==='left'?'chamfer-left':'chamfer-right',label:`Angled corner, front ${side}`,orientation:'horizontal',min:c0,max,value:v,text:`${fmtFt(v)} ft cut along the front and the side`,x:ox+x,y:oz+L-leg/2,move:{x:side==='left'?6:-6,y:-6}});
    }
  }
  return out;
}

/** The House tool's handles: the house's two wall ends, halfway back in the 8 ft of house the plan draws (`band`). */
export function houseHandles(data:DeckData,band:number):PlanHandle[]{
  if(data.houseVisible===false)return [];
  const {x0,x1}=getHousePlacement(data),[lo,hi]=HOUSE_WIDTH_FT,v=clampFt(getHouseConfig(data).widthFt,lo,hi),text=`House ${fmtFt(v)} ft wide`;
  return ([['house-left','left',x0,-12],['house-right','right',x1,12]] as const).map(([id,side,x,dx])=>({id,label:`House width, ${side} wall`,orientation:'horizontal' as const,min:lo,max:hi,value:v,text,x,y:-band/2,move:{x:dx,y:0}}));
}

// --- Stairs ---
/** The deck levels a stair can leave from: the main deck and the levels built off it (not stair landings or winders). */
const deckLevels=(model:DeckTakeoff)=>model.levels.flatMap((l,i)=>i===0||l.kind==='deck'?[i]:[]);
const SIDE_WORDS:Record<EdgeName,string>={Front:'front edge',Left:'left side',Right:'right side',Back:'back edge'};
const OPPOSITE:Record<EdgeName,EdgeName>={Front:'Back',Back:'Front',Left:'Right',Right:'Left'};
function segment(model:DeckTakeoff,level:number,edge:number){
  const l=model.levels[level],o=l.footprint.outline,a=o[edge],b=o[(edge+1)%o.length];
  return {a:{x:a.x+l.offset.x,y:a.y+l.offset.z},b:{x:b.x+l.offset.x,y:b.y+l.offset.z}};
}

/** Where the stairs are now: the deck edge the first grade flight leaves (found from the built flight, so it is where the
 * model put it), measured the way the Stairs section's position is, from the edge's left or back end. */
export interface PrimaryStair{level:number;edge:number;a:PlanPoint;b:PlanPoint;dir:PlanPoint;outward:PlanPoint;len:number;width:number;free:number;offset:number;centre:PlanPoint;depth:number;name:string}
export function primaryStair(data:DeckData,model:DeckTakeoff,stairEdges:readonly {id:string;name:string}[]=[]):PrimaryStair|null{
  if(data.stairPath||!(Number(data.stairFlights)>0))return null;
  const f=model.flights.find(x=>x.kind==='grade'&&/^grade-0(-upper)?$/.test(x.id));if(!f)return null;
  const S={x:f.start.x,y:f.start.z},width=f.width;
  for(const level of deckLevels(model)){
    const n=model.levels[level].footprint.outline.length;
    for(let edge=0;edge<n;edge++){
      const {a,b}=segment(model,level,edge),len=Math.hypot(b.x-a.x,b.y-a.y);if(len<1)continue;
      const u={x:(b.x-a.x)/len,y:(b.y-a.y)/len},outward={x:u.y,y:-u.x};
      const t=(S.x-a.x)*u.x+(S.y-a.y)*u.y,d=(S.x-a.x)*outward.x+(S.y-a.y)*outward.y;
      // On this edge (a picture frame starts the flight a little way out from it), with the opening on the edge.
      if(d<-1||d>4||t<width/2-1||t>len-width/2+1)continue;
      // The Stairs section's position runs from the edge's left or back end, as getStairPlacement measures it.
      const rev=u.x<-.5||u.y<-.5,dir=rev?{x:-u.x,y:-u.y}:u,base=rev?b:a,along=rev?len-t:t,free=len-width;
      const offset=free>.5?Math.min(100,Math.max(0,(along-width/2)/free*100)):Math.min(100,Math.max(0,Number(data.stairOffset)||0));
      const id=level===0?model.levels[0].footprint.edgeIds?.[edge]:undefined,named=id?stairEdges.find(e=>e.id===id):undefined;
      const name=named?named.name.charAt(0).toLowerCase()+named.name.slice(1):`${SIDE_WORDS[edgeFacing(outward)]}${level>0?' of the lower level':''}`;
      const depth=Math.max(24,Math.hypot(f.end.x-f.start.x,f.end.z-f.start.z)+f.run);
      return {level,edge,a:base,b:rev?a:b,dir,outward,len,width,free,offset,centre:{x:base.x+dir.x*along,y:base.y+dir.y*along},depth,name};
    }
  }
  return null;
}
/** In words: where the stairs sit along their edge. */
export function stairFigure(p:PrimaryStair,offsetPct:number):string{
  const ft=p.free*Math.min(100,Math.max(0,offsetPct))/100/12,end=Math.abs(p.dir.x)>=Math.abs(p.dir.y)?'left':'back';
  return `Stairs ${fmtFt(ft)} ft from the ${end} end of the ${p.name}`;
}
/** The stair opening at another position along the same edge (its flight drawn as deep as it is now), for a drag's ghost. */
export function stairGhost(p:PrimaryStair,offsetPct:number):PlanPoint[]{
  const s=p.free*Math.min(100,Math.max(0,offsetPct))/100,o={x:p.a.x+p.dir.x*s,y:p.a.y+p.dir.y*s},e={x:o.x+p.dir.x*p.width,y:o.y+p.dir.y*p.width},out=p.outward,d=p.depth;
  return [o,e,{x:e.x+out.x*d,y:e.y+out.y*d},{x:o.x+out.x*d,y:o.y+out.y*d}];
}
/** The Stairs tool's handle: the stairs' position along their edge (the Stairs section's 0–100 % field), 1 % a key
 * (Shift 10 %). None when the stairs fill their edge, or were placed where the model could not honour the position. */
export function stairHandle(data:DeckData,p:PrimaryStair|null):PlanHandle|null{
  if(!p||p.free<6)return null;
  const set=Math.min(100,Math.max(0,Number(data.stairOffset)||0));
  if(Math.abs(set-p.offset)>1)return null;
  const v=clampFt(set,0,100);
  return {id:'stair',label:'Stairs, position along the edge',orientation:Math.abs(p.dir.x)>=Math.abs(p.dir.y)?'horizontal':'vertical',min:0,max:100,value:v,text:stairFigure(p,v),x:p.centre.x,y:p.centre.y,move:{x:p.dir.x*p.free/100,y:p.dir.y*p.free/100},step:1,bigStep:10};
}

/**
 * The edges the Stairs tool offers. Only what the page allows: the named edges it passes in (`stairEdges`, computed on the
 * page as the Stairs section's edge menu is), and the stair sides houseContact.ts leaves open (availableStairSides, the
 * Stairs section's location menu), each drawn on the edge the model would open it on. Nothing here decides whether an
 * edge can take a stair. Tapping one makes the patch its field would (adding a flight when there is none).
 */
export interface StairTarget{key:string;name:string;level:number;edge:number;a:PlanPoint;b:PlanPoint;patch:Partial<DeckData>}
export function stairTargets(data:DeckData,model:DeckTakeoff,stairEdges:readonly {id:string;name:string}[]):StairTarget[]{
  if(data.stairPath)return [];
  const levels=model.levels,decks=deckLevels(model);
  // Grade stairs leave from the lowest deck level (the later one on a tie), as the model builds them.
  const exit=decks.reduce((best,i)=>levels[i].top<=levels[best].top?i:best,0);
  const add:Partial<DeckData>=Number(data.stairFlights)>0?{}:{stairFlights:1},out:StairTarget[]=[],main=levels[0].footprint;
  // A named edge sets the stairs' side only on the main deck.
  if(exit===0&&main.edgeIds)for(const e of stairEdges){
    const i=main.edgeIds.indexOf(e.id);
    if(i>=0)out.push({key:`edge:${e.id}`,name:e.name.charAt(0).toLowerCase()+e.name.slice(1),level:0,edge:i,...segment(model,0,i),patch:{stairEdgeId:e.id,...add}});
  }
  // A side a level joins is taken by that join, so the model would move the stairs off it.
  const taken=new Set<EdgeName>(model.connections.flatMap(c=>[...(c.from===exit?[c.opening.edge]:[]),...(c.to===exit?[OPPOSITE[c.opening.edge]]:[])]));
  const contact=exit===0?getHouseContact(data,main):undefined;
  for(const side of availableStairSides(data)){
    if(taken.has(side))continue;
    const p=getStairPlacement({...data,stairFlights:1,stairPosition:side,stairEdgeId:undefined,stairOffset:50},levels[exit].footprint,contact);
    if(!p||p.edgeIndex===undefined||out.some(t=>t.level===exit&&t.edge===p.edgeIndex))continue;
    out.push({key:`side:${side}`,name:`${SIDE_WORDS[side]}${exit>0?' of the lower level':''}`,level:exit,edge:p.edgeIndex,...segment(model,exit,p.edgeIndex),patch:{stairPosition:side,stairEdgeId:undefined,...add}});
  }
  return out;
}

/** The live figure beside a drag: the new size, the cut-out, where the deck sits against the house, a wing, a corner, the
 * house or the second level. (A stair's is stairFigure.) */
export function gestureFigure(data:DeckData,id:PlanHandleId,value:number):string{
  const next={...data,...handlePatch(data,id,value)};
  if(id==='slide')return describeSlide(next);
  if(id.startsWith('cutout2'))return `Cut-out ${fmtFt(Number(next.cutoutWidth2))} × ${fmtFt(Number(next.cutoutLength2))} ft`;
  if(id.startsWith('cutout'))return `Cut-out ${fmtFt(Number(next.cutoutWidth))} × ${fmtFt(Number(next.cutoutLength))} ft`;
  if(id==='level2-depth')return `Second level ${fmtFt(Number(next.width2))} × ${fmtFt(value)} ft`;
  if(id.startsWith('wing'))return `${id==='wing-left'?'Left':'Right'} wing ${fmtFt(value)} ft wide`;
  if(id.startsWith('chamfer'))return `Front ${id==='chamfer-left'?'left':'right'} corner cut ${fmtFt(value)} ft`;
  if(id.startsWith('house'))return `House ${fmtFt(value)} ft wide`;
  return `${fmtFt(Number(next.width))} × ${fmtFt(Number(next.length))} ft · ${Math.round(Number(next.width)*Number(next.length))} sq ft`;
}

/**
 * What a drag of one of R5's handles draws while it lasts (plan inches): the second level at its new depth; the deck with
 * a wing or a corner changed, where it would sit against the house as drawn now; or the house at its new width (and the
 * deck, which a two-sided wrap-around widens with it) with the wall end not being dragged left where it is.
 */
export function planGhost(data:DeckData,model:DeckTakeoff,id:PlanHandleId,value:number,band:number):PlanPoint[][]{
  const next={...data,...handlePatch(data,id,value)},deck=(shift:number)=>getFootprint(next,1).outline.map(p=>({x:p.x+shift,y:p.y}));
  if(id==='level2-depth'){
    const L2=level2(model);if(!L2)return [];
    const {offset,footprint:{bounds:{w,h}}}=L2.level,h2=value*12,y0=L2.outward.y>0?offset.z:offset.z+h-h2;
    return [[{x:offset.x,y:y0},{x:offset.x+w,y:y0},{x:offset.x+w,y:y0+h2},{x:offset.x,y:y0+h2}]];
  }
  if(id==='wing-left'||id==='wing-right')return [deck(getHousePlacement(data).x0-getHousePlacement(next).x0)];
  if(id==='chamfer-left'||id==='chamfer-right')return [deck(0)];
  if(id==='house-left'||id==='house-right'){
    const before=getHousePlacement(data),after=getHousePlacement(next),shift=id==='house-right'?before.x0-after.x0:before.x1-after.x1;
    return [[{x:after.x0+shift,y:-band},{x:after.x1+shift,y:-band},{x:after.x1+shift,y:0},{x:after.x0+shift,y:0}],deck(shift)];
  }
  return [];
}

/**
 * The shape shortcuts on the drawing (the same actions as the Deck section, from deckShapeActions.ts): the patch to
 * apply (none when nothing changes), the status line to show, and the plan tool to switch to ("Draw my own" takes the
 * Draw outline tool).
 */
export type PlanShortcutId=DeckShape|'wrap-left'|'wrap-right'|'wrap-both'|'split';
const SHAPE_WORDS:Record<DeckShape,string>={Rectangle:'a rectangle','L-Shape':'an L-shape','Multi-corner':'a multi-corner deck',Curved:'a curved front',Custom:'your own outline'};
const lower=(s:string)=>s.charAt(0).toLowerCase()+s.slice(1);
export function planShortcut(data:DeckData,id:PlanShortcutId):{patch:Partial<DeckData>|null;status:string;tool?:PlanTool}{
  if(id==='split'){
    if(data.levels>=2)return {patch:{levels:1},status:'Back to one level.'};
    if(data.shape==='Custom'&&!data.deckOutlines?.main)return {patch:null,status:'A custom outline is one level. Choose another shape for a split level.'};
    return {patch:splitLevel(data),status:'Added a lower level one step down across the front. Drag its gold handle to set its depth.'};
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
  // Draw my own keeps the real footprint as free points. The Deck menu's Custom outline stays chooseShape.
  if(id==='Custom'){
    if(data.shape==='Custom'&&data.deckOutlines?.main)return {patch:null,status:'',tool:'outline'};
    return {patch:drawOwnOutline(data),status:'Now your own outline: drag any corner or edge on the plan. Undo is always available.',tool:'outline'};
  }
  if(data.shape===id&&!data.deckOutlines?.main)return {patch:null,status:''};
  const patch=chooseShape(data,id),paused=data.wrap&&(data.wrap.left||data.wrap.right)&&!patch.deckOutlines?.main?wrapBlockers({...data,...patch}):[];
  const done=`Now ${SHAPE_WORDS[id]}.${id==='L-Shape'||id==='Multi-corner'?' Drag the gold cut-out handles to size the corner.':''}`;
  return {patch,status:paused.length?`${done} The wrap-around is paused: ${lower(paused[0])}`:done};
}
