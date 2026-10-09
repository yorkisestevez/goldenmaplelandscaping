import {ensureLiveDesignExtensions} from "../src/features/deckcraft/designExtensions";
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ConstructionPlan,{planFrame} from '../src/features/deckcraft/ConstructionPlan';
import {boardFinishPlan} from '../src/features/deckcraft/boardFinishes';
import {calculateDeckReleaseEstimate,deckReleaseData} from '../src/features/deckcraft/deckRelease';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {defaultLevel3} from '../src/features/deckcraft/designPersistence';
import {getHouseConfig} from '../src/features/deckcraft/houseSettings';
import {getHousePlacement} from '../src/features/deckcraft/housePlacement';
import {frontEdges,moveEdge,OUTLINE_PRESETS,outlinePreset} from '../src/features/deckcraft/lib/outlineEdits';
import type {OutlinePoint} from '../src/features/deckcraft/lib/customOutline';
import {availableStairSides,getHouseContact} from '../src/features/deckcraft/houseContact';
import {clampHouseOpening} from '../src/features/deckcraft/houseSettings';
import {activeWrap,edgeNameOf} from '../src/features/deckcraft/lib/wrapGeometry';
import {activeCornerChamfers,angledStairAllowed,angledStairFits,isChamferEdgeId} from '../src/features/deckcraft/lib/cornerChamfers';
import {PLAN_TOOLS} from '../src/features/deckcraft/designer/constants';
import {beginEdgeDrag,edgeLimit,edgeMove,edgeName,edgeSliders,endEdgeDrag,listKeyDelta,moveEdgeDrag,presetPatch,REFUSED,sliderKey} from '../src/features/deckcraft/designer/outlineEditMath';
import {chooseShape,setWingSize,splitLevel} from '../src/features/deckcraft/designer/deckShapeActions';
import {beginGesture,clampFt,describeSlide,endGesture,ghostShift,handlePatch,houseHandles,keyValue,moveGesture,planGhost,planHandles,planShortcut,primaryStair,shapeHandles,stairHandle,stairTargets,type PlanHandleId} from '../src/features/deckcraft/designer/planEditMath';
import {HOUSE_CASES} from './deck-house-finishes-cases';
import type {DeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import type {YardModel} from '../src/features/deckcraft/yardModel';
import type {DeckData} from '../src/features/deckcraft/types';

/**
 * The drawing's plan sheets (redesign R4).
 * 1. The contractor plan (ConstructionPlan's default variant) is byte-identical to the markup captured in
 *    deck-plan-sheet-golden.json before R4 touched the component: it is the PDF's plan picture, the printable
 *    proposal's plan, the Framing tab's plan and what check-deck-corners reads.
 * 2. The site plan (variant "site") hides the framing (joists, beams, supports, blocking, hips, joist arrows, ledgers and
 *    the framing legend) and keeps the house, the deck outline, every board, the stairs, the railing, the inlay outlines
 *    and names, and the accent legend; it adds the 1 ft grid, break lines where it cuts the house off, and dimension
 *    strings for the deck's width and depth.
 * 3. planFrame() is the frame both variants draw in (so the plan editor over the site plan lines up with it).
 * 4. The plan editor's pure arithmetic (planEditMath.ts): limits, 0.5 ft steps, keys, a left-end width change that keeps
 *    the right end against the house, the slide along the wall, the handles each shape has, the shape shortcuts, and one
 *    commit per gesture.
 * 5. Wiring: the page opens on the site plan, the editor is lazy, and the PDF, proposal and Framing tab draw the
 *    contractor plan.
 * Run with --update only when a change to the contractor plan is owner-approved.
 */
let checks=0;const ok=(value:unknown,message:string)=>{assert(value,message);checks++;};
const GOLDEN=new URL('./deck-plan-sheet-golden.json',import.meta.url),update=process.argv.includes('--update');
const digest=(markup:string)=>createHash('sha256').update(markup).digest('hex');
const base=():DeckData=>structuredClone(DEFAULT_DECK);
const house=getHouseConfig({...base(),width:20});
const patio={id:'patio-1',kind:'patio' as const,name:'Patio',enabled:true,xFt:10,zFt:30,widthFt:20,depthFt:16,heightIn:0,rotationDeg:0,productId:'permacon-melville',color:'#aaaaaa'};

/** The designs the golden fingerprints: a plain deck, houses, wraps, finishes, shapes, levels and a yard. */
export function planSheetCases():Record<string,{data:DeckData;withData:boolean;withYard?:boolean}>{
  const split={...base(),width:20,length:14};
  const levels3={...split,...splitLevel(split),levels:3};
  return {
    'default':{data:base(),withData:true},
    'default, model only':{data:base(),withData:false},
    'house hidden':{data:{...base(),houseVisible:false},withData:true},
    'house blocks (bump-out, wing, garage)':{data:HOUSE_CASES['blocks/bump-wing-garage'],withData:true},
    'narrow house placed left':{data:{...base(),width:20,houseConfig:{...house,widthFt:12,depthFt:24},housePlacement:{anchor:'left',offsetIn:24}},withData:true},
    'wrap left with a porch':{data:{...base(),width:22,length:12,houseConfig:{...house,widthFt:26,depthFt:22},wrap:{left:{widthFt:8,runFt:8},porchLeft:{depthFt:8,runFt:10}}},withData:true},
    'wrap both':{data:{...base(),width:20,length:12,houseConfig:{...house,widthFt:26,depthFt:22},wrap:{left:{widthFt:6,runFt:8},right:{widthFt:6,runFt:8}}},withData:true},
    'accent row and rug inlay':{data:{...base(),width:20,boardColours:[{lv:1,role:'field',scope:'course',course:'r5',colour:'tt_prime_plus:Dark Cocoa'}],inlays:[{id:'a',kind:'rug',widthFt:6,depthFt:4}]} as DeckData,withData:true},
    'band and medallion inlays':{data:{...base(),width:20,inlays:[{id:'a',kind:'band',direction:'along',boards:2,atFt:3},{id:'b',kind:'medallion',diameterFt:4,style:'compass'}]},withData:true},
    'custom outline T':{data:{...base(),width:20,length:14,shape:'Custom',customFront:outlinePreset('t',20,14)!},withData:true},
    'angled front corners':{data:{...base(),cornerChamfers:{frontLeftFt:4,frontRightFt:3},height:48},withData:true},
    'L-shape, picture frame, landing stairs':{data:{...base(),width:24,length:20,height:72,shape:'L-Shape',pattern:'Picture Frame',pictureFrameRows:2,stairType:'Landing'},withData:true},
    'multi-corner freestanding, 2 levels':{data:{...base(),width:24,length:20,shape:'Multi-corner',deckType:'Freestanding',levels:2,height2:24,level2Position:'Left'},withData:true},
    'curved, herringbone, winder stairs':{data:{...base(),shape:'Curved',pattern:'Herringbone',stairType:'Winder',height:60},withData:true},
    'split level with a third level':{data:{...levels3,level3:defaultLevel3(levels3)},withData:true},
    'yard patio':{data:{...base(),yardFeatures:[patio]} as DeckData,withData:true,withYard:true},
  };
}

type Built={name:string;data:DeckData;model:DeckTakeoff;yard?:YardModel;withData:boolean};
for(const c of Object.values(planSheetCases()))await ensureLiveDesignExtensions(c.data);
const built:Built[]=Object.entries(planSheetCases()).map(([name,c])=>{
  const data=deckReleaseData(c.data),estimate=calculateDeckReleaseEstimate(data);
  return {name,data,model:estimate.model as DeckTakeoff,yard:c.withYard?estimate.yardModel as YardModel:undefined,withData:c.withData};
});
const contractor=(c:Built)=>renderToStaticMarkup(createElement(ConstructionPlan,{model:c.model,...(c.withData?{data:c.data}:{}),...(c.yard?{yard:c.yard}:{})}));
// The site plan as the page draws it: with the design, and without a yard.
const site=(c:Built)=>renderToStaticMarkup(createElement(ConstructionPlan,{model:c.model,data:c.data,variant:'site'}));
const count=(text:string,part:string)=>text.split(part).length-1;
const viewBoxOf=(svg:string)=>/^<svg viewBox="([^"]+)"/.exec(svg)?.[1];

// Independent semantic guards stay active even when an approved visual baseline changes.
for(const c of built){
 const svg=contractor(c);ok(svg.indexOf("aria-label=\"Deck and stair elevations\"")>svg.lastIndexOf("fill=\"#ddccb1\""),c.name+": elevation labels render above all stair tread fills");const bounds=viewBoxOf(svg)?.split(' ').map(Number)??[];
 ok(!/NaN|Infinity|undefined/.test(svg),c.name+': exported SVG contains no invalid values');
 ok(bounds.length===4&&bounds.every(Number.isFinite)&&bounds[2]>0&&bounds[3]>0,c.name+': positive finite export frame');
 ok(c.model.quantities.area>0,c.name+': positive measured area');
 ok(c.model.quantities.stairTreads===c.model.treads.length,c.name+': stair quantity agrees with drawn tread count');
 ok(c.model.quantities.railingPosts===c.model.railing.posts.length,c.name+': rail post schedule agrees with modeled posts');
 ok(c.model.levels.every(l=>l.kind!=='deck'||l.boards.length>0),c.name+': every deck level retains boards');
}

// 1. The contractor plan, byte for byte.
{
  const current=Object.fromEntries(built.map(c=>{const markup=contractor(c);return [c.name,{sha256:digest(markup),bytes:Buffer.byteLength(markup)}];}));
  if(update||!existsSync(GOLDEN)){
    assert(update,'deck-plan-sheet-golden.json is missing: it was captured from the contractor plan before R4 and must not be regenerated silently.');
    const note='ConstructionPlan default (contractor) markup. Reviewed 2026-10-04 after the owner-requested picture-frame default, stock-length seam policy and railing termination, 2026-10-06 after the owner-approved inside-corner fix (new designs seat railing posts on the boards; designs saved before the 2026-10 rules keep their drawings), 2026-10-07 after wrap-around boards were set to keep one direction across the front and turn beside the house (legacy saves keep the corner-to-corner hip), and 2026-10-08 after new designs anchor wrap field rows on the outer edge and drop hairline rips. The 2026-10-07 golden was written before that last drawing change and did not match the merged sheets. Regenerate only for an owner-approved change to the contractor plan.';
    writeFileSync(GOLDEN,JSON.stringify({note,cases:current},null,1)+'\n');console.log('Plan sheet golden written.');
  }
  const golden=JSON.parse(readFileSync(GOLDEN,'utf8')) as {cases:typeof current};
  ok(Object.keys(golden.cases).join('|')===Object.keys(current).join('|'),'The golden covers the same designs');
  for(const [name,value] of Object.entries(current))ok(golden.cases[name]?.sha256===value.sha256&&golden.cases[name]?.bytes===value.bytes,`${name}: the contractor plan is byte-identical to the golden (${value.bytes} bytes)`);
}

// 2. The site plan: framing hidden, the drawing of the deck kept, the grid, break lines and dimension strings added.
for(const c of built.filter(b=>b.withData)){
  const svg=site(c),base=contractor({...c,yard:undefined}),label=`${c.name} (site plan)`;
  ok(svg.startsWith('<svg viewBox=')&&svg.includes('aria-label="Site plan: the deck against the house"')&&!svg.includes('Deck construction plan'),`${label}: named as the site plan`);
  for(const [part,what] of [['stroke-dasharray="3 2"','joists'],['#826947','beams'],['fill="#545b54"','supports'],['#b27a2c','inlay blocking'],['● Footings','the framing legend'],['Dashed: joists','the framing legend'],['Hip ·','the doubled hips'],['joist direction','joist arrows'],['#9a6a32','ledgers'],['Ledger ','ledger labels'],['display="none"','screen-only parts']] as const)ok(!svg.includes(part),`${label}: no ${what}`);
  ok(svg.includes('class="dd-plan-grid" x=')&&svg.includes('fill="url(#dd-grid-5)"'),`${label}: the 1 ft grid is drawn`);
  for(const [part,what] of [['fill="#e5d7bb"','deck outlines'],['stroke="#ac9572"','boards'],['#ddccb1','stair treads'],['#272e2c','railing and posts'],['stroke="#6b4521"','inlay pieces'],['aria-label="Inlay ','inlay names'],['aria-label="Accent boards"','the accent legend'],['aria-label="House block over the deck"','house blocks over the deck']] as const)ok(count(svg,part)===count(base,part),`${label}: every one of the ${what} (${count(base,part)})`);
  const hasHouse=c.data.houseVisible!==false;
  ok(svg.includes('aria-label="House"')===hasHouse,`${label}: the house is drawn when it is shown`);
  const f=planFrame(c.model,{data:c.data,variant:'site'}),house=getHousePlacement(c.data);
  if(hasHouse){
    ok(f.band===Math.min(house.depthIn,Math.max(96,...(f.wrap?[f.wrap.left?.runIn??0,f.wrap.right?.runIn??0].map(r=>r+24):[]))),`${label}: 8 ft of house (more for a wrap-around's run)`);
    ok(svg.includes('class="dd-break"')===(f.band<house.depthIn-.5||house.x0<f.left-.5||house.x1>f.right+.5),`${label}: a break line wherever the drawing cuts the house off`);
    ok(f.y<-f.band&&f.left<=Math.max(house.x0,f.b.minX-96)+.001,`${label}: the frame holds the house band and up to 8 ft of house past the deck`);
  }
  if(c.data.shape!=='Custom'){
    const W=c.model.levels[0].footprint.bounds.w,D=c.data.shape==='Curved'?c.data.length*12:c.model.levels[0].footprint.bounds.h;
    ok(svg.includes(`aria-label="Deck width ${Math.round(W/12*100)/100} ft"`)&&svg.includes(`aria-label="Deck depth ${Math.round(D/12*100)/100} ft"`),`${label}: dimension strings for the deck's width and depth`);
    ok(f.dims?.width.inches===W&&f.dims?.depth.inches===D,`${label}: the frame gives the editor the same figures`);
  }
}

// 3. One frame for the plan and the editor over it.
for(const c of built){
  const finish=c.withData&&(c.data.boardColours?.length||c.data.inlays?.length)?boardFinishPlan(c.data,c.model):null;
  ok(viewBoxOf(contractor(c))===planFrame(c.model,{data:c.withData?c.data:undefined,yard:c.yard,legendRows:finish?.groups.length?1:0}).viewBox,`${c.name}: planFrame() is the contractor plan's frame`);
  if(c.withData)ok(viewBoxOf(site(c))===planFrame(c.model,{data:c.data,variant:'site'}).viewBox,`${c.name}: planFrame() is the site plan's frame, as the editor computes it`);
}

// 4. The plan editor's arithmetic.
{
  const d0=deckReleaseData(base()),m0=calculateDeckReleaseEstimate(d0).model as DeckTakeoff,handles=(d:DeckData)=>{const m=calculateDeckReleaseEstimate(d).model as DeckTakeoff;return planHandles(d,m.levels[0].footprint.outline);};
  const byId=(d:DeckData,id:PlanHandleId)=>handles(d).find(h=>h.id===id);
  // Keys: 0.5 ft, Shift 1 ft, Up and Right larger, Home and End the limits, clamped.
  ok(keyValue('ArrowUp',false,12,4,60)===12.5&&keyValue('ArrowRight',false,12,4,60)===12.5&&keyValue('ArrowDown',false,12,4,60)===11.5&&keyValue('ArrowLeft',false,12,4,60)===11.5,'Arrow keys move 0.5 ft');
  ok(keyValue('ArrowUp',true,12,4,60)===13&&keyValue('ArrowDown',true,12,4,60)===11,'Shift+arrow moves 1 ft');
  ok(keyValue('Home',false,12,4,60)===4&&keyValue('End',false,12,4,60)===60,'Home and End go to the limits');
  ok(keyValue('ArrowUp',false,59.8,4,60)===60&&keyValue('ArrowDown',true,4.4,4,60)===4&&keyValue('a',false,12,4,60)===null&&keyValue('Enter',false,12,4,60)===null,'Keys stay within the limits and ignore other keys');
  // Drags: 0.5 ft steps from where the drag began, within the limits; the design is not touched until the end.
  const depth=byId(d0,'depth')!;
  ok(depth.min===4&&depth.max===60&&depth.value===12&&depth.orientation==='vertical'&&depth.label==='Deck depth, front edge'&&depth.text==='12 ft deep','The depth handle: 4 to 60 ft, the design\'s depth');
  let g=beginGesture(depth,1,100,100);const before=JSON.stringify(d0);
  const seen:number[]=[];
  for(const dy of [3,9,17,26,40,17,17.5]){g=moveGesture(g,0,dy);seen.push(g.value);}
  ok(seen.join()==='12.5,13,13.5,14,15.5,13.5,13.5',`A drag moves in 0.5 ft steps (to the nearest) from where it began (${seen.join()})`);
  ok(JSON.stringify(d0)===before,'A drag in progress leaves the design alone');
  ok(moveGesture(g,0,5000).value===60&&moveGesture(g,0,-5000).value===4,'A drag stops at 4 and 60 ft');
  ok(moveGesture(beginGesture({...depth,value:12.3},1,0,0),0,6).value===12.8,'A drag keeps a typed fraction and steps from it');
  // One commit per gesture: every move before the end commits nothing; the end commits the last value once, or nothing.
  let commits:number[]=[];
  const drive=(steps:number[])=>{let gg=beginGesture(depth,7,0,0);for(const dy of steps)gg=moveGesture(gg,0,dy);const v=endGesture(gg);if(v!==null)commits.push(v);};
  drive(Array.from({length:40},(_,i)=>i*3));ok(commits.length===1&&commits[0]===22,`Forty moves make one commit, of the last value (${commits.join()})`);
  commits=[];drive([12,24,6,0]);ok(commits.length===0,'A drag that ends where it began commits nothing');
  ok(endGesture(beginGesture(depth,1,0,0))===null,'A press without a move commits nothing');
  ok(JSON.stringify(handlePatch(d0,'depth',14))==='{"length":14}','The depth handle sets the Deck depth field and nothing else');
  // Width from either end. The default house follows the deck's width, so it needs no placement either way.
  const right=byId(d0,'width-right')!,left=byId(d0,'width-left')!;
  ok(right.value===16&&left.value===16&&right.min===4&&right.max===60&&right.x===192&&left.x===0&&right.y===72&&left.y===72,'Width handles sit halfway along each end');
  ok(JSON.stringify(handlePatch(d0,'width-right',20))==='{"width":20}'&&JSON.stringify(handlePatch(d0,'width-left',20))==='{"width":20}','The default house needs no placement for a width change');
  // A house of its own size: the right end keeps the left end in place against the house, the left end the right.
  const fixed=deckReleaseData({...base(),houseConfig:{...getHouseConfig(base()),widthFt:30}}),hp=getHousePlacement(fixed);
  const r20={...fixed,...handlePatch(fixed,'width-right',20)},l20={...fixed,...handlePatch(fixed,'width-left',20)};
  ok(Math.abs(getHousePlacement(r20).x0-hp.x0)<.01,'A right-end drag leaves the deck\'s left end where it was against the house');
  ok(Math.abs(getHousePlacement(l20).x0-(hp.x0+48))<.01&&Math.abs((getHousePlacement(l20).x1-240)-(hp.x1-192))<.01,'A left-end drag shifts the house placement: the right end stays where it was');
  ok(ghostShift(fixed,'width-left',20,16)===-48&&ghostShift(fixed,'width-right',20,16)===0,'The ghost of a left-end drag grows to the left');
  const anchored=deckReleaseData({...fixed,housePlacement:{anchor:'left',offsetIn:-24}});
  const kept=handlePatch(anchored,'width-left',18).housePlacement;
  ok(kept?.anchor==='left'&&kept.offsetIn===0,`A placement keeps its anchor (${JSON.stringify(kept)})`);
  // Sliding along the wall: the house placement, within the overlap rule.
  const slide=byId(fixed,'slide')!,W=192,HW=360;
  ok(slide.min===-(W-24)/12&&slide.max===(HW-24)/12&&Math.abs(slide.value-(-hp.x0/12))<.001,'The slide runs as far as the overlap rule allows');
  ok(slide.text===describeSlide(fixed)&&/^Left end [\d.]+ ft in from the house corner; right end [\d.]+ ft in from the house corner$/.test(slide.text),`The slide says where each end is (${slide.text})`);
  for(const v of [slide.min,0,3.5,slide.max])ok(Math.abs(getHousePlacement({...fixed,...handlePatch(fixed,'slide',v)}).x0-(-v*12))<.01,`Sliding to ${v} ft puts the deck there`);
  ok(ghostShift(fixed,'slide',4,3)===12,'The ghost of a slide moves with it');
  // Which handles each design has.
  const ids=(d:DeckData)=>handles(deckReleaseData(d)).map(h=>h.id).join();
  ok(ids(base())==='depth,width-right,width-left,slide','A rectangle: depth, both ends and the slide');
  ok(ids({...base(),houseVisible:false})==='depth,width-right,width-left','No slide without a house to slide along');
  ok(ids({...base(),shape:'Custom',customFront:outlinePreset('t',16,12)!})==='slide','A custom outline sizes itself');
  ok(ids({...base(),shape:'L-Shape'})==='depth,width-right,width-left,slide,cutout-width,cutout-depth','An L-shape adds its cut-out');
  ok(ids({...base(),width:24,shape:'Multi-corner'})==='depth,width-right,width-left,slide,cutout-width,cutout-depth,cutout2-width,cutout2-depth','A multi-corner deck adds both cut-outs');
  const wrapHouse={...getHouseConfig(base()),widthFt:20,depthFt:20};
  ok(ids({...base(),width:24,houseConfig:wrapHouse,wrap:{left:{widthFt:6,runFt:8}}})==='depth,width-right','A left wing: the right end sizes the deck, and the house is placed by the wrap');
  ok(ids({...base(),width:24,houseConfig:wrapHouse,wrap:{right:{widthFt:6,runFt:8}}})==='depth,width-left','A right wing: the left end sizes the deck');
  ok(ids({...base(),houseConfig:wrapHouse,wrap:{left:{widthFt:6,runFt:8},right:{widthFt:6,runFt:8}}})==='depth','Two wings: the house sets the width');
  ok(!('housePlacement' in handlePatch(deckReleaseData({...base(),width:24,houseConfig:wrapHouse,wrap:{right:{widthFt:6,runFt:8}}}),'width-left',26)),'A wrap-around places the house itself');
  const L=handles(deckReleaseData({...base(),shape:'L-Shape'})),cw=L.find(h=>h.id==='cutout-width')!,cd=L.find(h=>h.id==='cutout-depth')!;
  ok(cw.x===192-96&&cw.y===144-36&&cd.x===192-48&&cd.y===144-72&&cw.min===1&&cw.max===12.8&&cd.max===9.6,'The cut-out handles sit on the notch\'s inner edges, within the Deck section\'s limits');
  const lDrag=moveGesture(beginGesture(cw,1,0,0),-24,0);
  ok(lDrag.value===10&&JSON.stringify(handlePatch(deckReleaseData({...base(),shape:'L-Shape'}),'cutout-width',lDrag.value))==='{"cutoutWidth":10}','Dragging the cut-out\'s edge left widens it');
  // Typing a figure: the Deck section's clamping.
  ok(clampFt(70,4,60)===60&&clampFt(2,4,60)===4&&clampFt(16.25,4,60)===16.25,'A typed figure is clamped to 4–60 ft as the fields clamp it, and not rounded');
  // The shape shortcuts are the Deck section's actions.
  ok(JSON.stringify(planShortcut(d0,'L-Shape').patch)===JSON.stringify(chooseShape(d0,'L-Shape'))&&planShortcut(d0,'L-Shape').status.startsWith('Now an L-shape.'),'L-shape is chooseShape');
  ok(planShortcut(d0,'Rectangle').patch===null,'The shape already chosen changes nothing');
  const custom=planShortcut(d0,'Custom');ok(JSON.stringify(custom.patch)===JSON.stringify(chooseShape(d0,'Custom'))&&custom.tool==='outline',"Draw my own starts an outline and takes the plan's Draw outline tool");
  ok(JSON.stringify(planShortcut(d0,'split').patch)===JSON.stringify(splitLevel(d0))&&JSON.stringify(planShortcut({...d0,levels:2},'split').patch)==='{"levels":1}','Split level is splitLevel, and pressed again goes back to one level');
  const wl=planShortcut(d0,'wrap-left');ok(!!wl.patch?.wrap?.left&&!wl.patch.wrap.right&&wl.status==='Wrapped round the left house corner.',`Wrap left adds the left wing (${wl.status})`);
  const fixedUp=planShortcut(deckReleaseData({...base(),pattern:'Diagonal',shape:'L-Shape'}),'wrap-both');
  ok(!!(fixedUp.patch?.wrap?.left&&fixedUp.patch.wrap.right)&&fixedUp.patch.shape==='Rectangle'&&fixedUp.patch.pattern==='Straight'&&/^Wrapped round both house corners\. Switched to a rectangle, straight boards so the corner can be mitred\.$/.test(fixedUp.status),`Wrap both makes the auto-fix and says so (${fixedUp.status})`);
  ok(planShortcut({...d0,deckType:'Freestanding'},'wrap-right').patch===null,'A freestanding deck is not wrapped');
  const off=planShortcut({...d0,wrap:{left:{widthFt:8,runFt:8}}},'wrap-left');ok(!!off.patch&&'wrap' in off.patch&&off.patch.wrap===undefined&&off.status==='Wrap-around removed.','The wrap already on comes off');
  ok(/The wrap-around is paused: the main deck must be a rectangle/.test(planShortcut({...d0,wrap:{left:{widthFt:8,runFt:8}}},'Curved').status),'A shape that pauses the wrap-around says so');
  ok(m0.levels.length===1,'The default deck has one level');
}

// 5. Wiring.
{
  const read=(p:string)=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
  const panel=read('src/features/deckcraft/designer/PreviewPanel.tsx'),page=read('src/pages/DeckDesigner.tsx'),editor=read('src/features/deckcraft/designer/PlanEditor.tsx'),css=read('src/pages/DeckDesigner.css');
  ok(page.includes("useState<PreviewMode>('plan')"),'The page opens on the site plan');
  ok(panel.includes("export const loadPlanEditor=()=>import('./PlanEditor');")&&panel.includes('const PlanEditor=lazy(loadPlanEditor);')&&![panel,page].some(t=>/from '[./]*(designer\/)?PlanEditor'/.test(t)),'The plan editor is loaded on demand, never with the page');
  ok(panel.includes(`<ConstructionPlan model={displayEstimate.model} data={displayData} yard={displayEstimate.yardModel} variant="site" wholeHouse={tool==='house'}/>`)&&panel.includes('framingPlan=<ConstructionPlan model={estimate.model} data={data}/>'),'The Plan tab draws the site plan and the Framing tab the contractor plan');
  ok(panel.includes("const show3d=mounted&&hasWebGL&&mode!=='plan'&&mode!=='drawing';")&&page.includes("desktopOnly=window.matchMedia?.('(min-width: 761px) and (pointer: fine)').matches?[loadViewer]:[];")&&page.includes(',...desktopOnly])load()'),'The 3D viewer loads for a 3D view, and ahead of time on a desktop only');
  ok(read('src/features/deckcraft/pdfAssets.ts').includes('createElement(ConstructionPlan,{model,data})')&&read('src/features/deckcraft/ProposalSheet.tsx').includes('<ConstructionPlan model={estimate.model} data={data}/>'),'The PDF and the printable proposal draw the contractor plan');
  // One commit per gesture: a pointer move only moves the ghost; the design changes when the drag ends.
  const move=/const onPointerMove=[\s\S]*?\n {2}\};/.exec(editor)?.[0]??'';
  ok(move.includes('moveGesture(')&&!/update\(|commit\(/.test(move),'A pointer move never changes the design');
  ok(/const onPointerUp=[\s\S]*?endGesture\(g\);if\(value!==null\)commit\(g\.id,value\);/.test(editor),'The end of a drag commits once');
  ok(editor.includes('role="slider"')&&editor.includes('aria-valuetext=')&&editor.includes('aria-valuemin=')&&editor.includes('aria-valuemax='),'Handles are sliders with a text value');
  ok(/\.dd-plan-handle\{[^}]*width:44px;height:44px[^}]*touch-action:none/.test(css)&&css.includes('.dd-canvas>.dd-site-plan,.dd-plan-editor{touch-action:pan-y}'),'Handles are 44 px and keep the pointer; the rest of the plan lets the page scroll');
}

// 6. R5: the plan's tools. Draw outline (useOutlineEdit / outlineEditMath), Stairs, House, and the Size & place tool's
//    second-level, wing and angled-corner handles.
const r5={outline:0,stairs:0,house:0,shape:0};
{
  const d0=deckReleaseData(base()),m0=calculateDeckReleaseEstimate(d0).model as DeckTakeoff,deckIn=(d:DeckData)=>Math.max(12,Number(d.width)*12);
  const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
  // 6a. Outline moves are lib/outlineEdits.ts's own, and a refused one is said to be refused.
  const fronts:{name:string;front:OutlinePoint[]}[]=[];
  for(const [W,D] of [[20,14],[24,16],[12,10],[40,30]] as const)for(const p of OUTLINE_PRESETS){const f=outlinePreset(p.id,W,D);if(f)fronts.push({name:`${p.id} ${W}×${D}`,front:f});}
  fronts.push({name:'rectangle at the 4 ft minimum',front:outlinePreset('rectangle',16,4)!});
  let refusals=0,angledFallbacks=0;
  for(const {name,front} of fronts){
    const edges=frontEdges(front),sliders=edgeSliders(front);
    ok(sliders.length===front.length&&sliders.every((s,k)=>s.index===k&&s.label===edgeName(front,k))&&!sliders.some(s=>s.index===edges.length-1),`${name}: a handle for every edge but the left side, named as the outline editor names it`);
    for(const s of sliders){
      const i=s.index,e=edges[i];
      ok(s.orientation===(e.kind==='across'||e.kind==='angled'?'vertical':'horizontal')&&s.min<=s.value&&s.value<=s.max,`${name} ${s.label}: an ${s.orientation} slider within its limits`);
      for(const d of [.5,-.5,1,-1,2.5,-2.5]){
        const lib=moveEdge(front,i,d),fallback=e.kind==='angled'?moveEdge(front,i,d*2):null,mine=edgeMove(front,i,d);
        ok(same(mine,lib??fallback),`${name} ${s.label} ${d} ft: the move is lib/outlineEdits' own`);
        if(!lib&&fallback)angledFallbacks++;r5.outline++;
      }
      for(const [key,shift,d] of [['ArrowUp',false,.5],['ArrowRight',true,1],['ArrowDown',false,-.5],['ArrowLeft',true,-1]] as const){
        const edit=sliderKey(front,i,key,shift),want=edgeMove(front,i,d);
        ok(want?!!edit&&'front' in edit&&same(edit.front,want):!!edit&&'refused' in edit,`${name} ${s.label} ${key}${shift?'+Shift':''}: moves ${d} ft, or is refused`);
        if(edit&&'refused' in edit)refusals++;
      }
      ok(sliderKey(front,i,'a',false)===null&&sliderKey(front,edges.length-1,'ArrowUp',false)===null,`${name} ${s.label}: other keys, and the left side, do nothing`);
      for(const dir of [1,-1] as const){
        const limit=edgeLimit(front,i,dir),key=dir>0?'End':'Home',edit=sliderKey(front,i,key,false),step=e.kind==='angled'?1:.5;
        ok(limit?!!edit&&'front' in edit&&same(edit.front,limit)&&!moveEdge(limit,i,dir*step):edit===null,`${name} ${s.label} ${key}: as far as the rules allow, and no further`);
      }
      // A drag: the edge follows the pointer on the 6 in grid; every front shown fits; a refused spot keeps the last one.
      const axis=(ft:number)=>e.kind==='across'?{dx:0,dy:ft}:e.kind==='angled'?((e.b.x-e.a.x)*(e.b.y-e.a.y)<0?{dx:ft/2,dy:ft/2}:{dx:-ft/2,dy:ft/2}):{dx:ft,dy:0};
      let g=beginEdgeDrag(front,i,1,0,0),lastGood:OutlinePoint[]|null=null;
      for(const ft of [.2,.7,1.4,3,6,12,25,40,-40,-3,1]){
        const {dx,dy}=axis(ft);g=moveEdgeDrag(g,dx,dy);
        const snapped=Math.round(ft*2)/2,lib=snapped?moveEdge(front,i,snapped):null;
        if(snapped===0)ok(g.ghost===null&&!g.refused,`${name} ${s.label}: back where it began, no ghost`);
        else if(lib){ok(same(g.ghost,lib)&&!g.refused&&g.applied===snapped,`${name} ${s.label} dragged ${ft} ft: the ghost is moveEdge(${snapped})`);lastGood=lib;}
        else{ok(g.refused&&same(g.ghost,lastGood),`${name} ${s.label} dragged ${ft} ft: refused, the last outline that fitted stays`);refusals++;}
      }
      ok(same(endEdgeDrag(g),g.applied?g.ghost:null),`${name} ${s.label}: the drag commits the last outline that fitted, once`);
    }
    // The Deck section's keys (down is toward the yard for an across or 45° edge), as the outline editor always had them.
    ok(edges.every(e=>same([listKeyDelta(e,'ArrowUp',false),listKeyDelta(e,'ArrowDown',true),listKeyDelta(e,'ArrowLeft',false),listKeyDelta(e,'ArrowRight',true)],e.kind==='across'||e.kind==='angled'?[-.5,1,null,null]:[null,null,-.5,1])),`${name}: the Deck section's edge keys are unchanged`);
  }
  ok(refusals>20&&angledFallbacks>0,`Refusals happen and are reported (${refusals}); a 45° edge falls back to a whole foot (${angledFallbacks})`);
  ok(endEdgeDrag(beginEdgeDrag(fronts[0].front,1,1,0,0))===null,'A press on an edge without a move commits nothing');
  {let g=beginEdgeDrag(fronts[0].front,1,1,0,0);for(let k=1;k<=40;k++)g=moveEdgeDrag(g,0,k*.05);ok(!!endEdgeDrag(g)&&same(endEdgeDrag(g),moveEdge(fronts[0].front,1,2)),'Forty pointer moves make one outline to commit');}
  ok(REFUSED.startsWith('That change does not fit the outline rules:'),'The refusal is the outline editor\'s own words');
  // Starting shapes: the Deck section's presets, sized to the deck; on a deck that is not an outline yet, it becomes one.
  const rect=deckReleaseData(base()),T=deckReleaseData({...base(),width:20,length:14,shape:'Custom',customFront:outlinePreset('t',20,14)!});
  for(const p of OUTLINE_PRESETS){
    ok(same(presetPatch(T,p.id),outlinePreset(p.id,20,14)?{customFront:outlinePreset(p.id,20,14)}:null),`${p.name}: on an outline, the preset sized to it`);
    const want=outlinePreset(p.id,16,12);ok(same(presetPatch(rect,p.id),want?{shape:'Custom',levels:1,customFront:want}:null),`${p.name}: on a rectangle, the outline shape and the preset`);
  }
  const read=(p:string)=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
  const hook=read('src/features/deckcraft/designer/useOutlineEdit.ts'),outlineUi=read('src/features/deckcraft/designer/OutlineEditor.tsx'),editor=read('src/features/deckcraft/designer/PlanEditor.tsx');
  ok(hook.includes("const apply=(next:OutlinePoint[]|null)=>{if(next){update({customFront:next});setMessage('');onChange?.();return true;}setMessage(REFUSED);return false;};"),'A refused edit leaves the outline and says why (useOutlineEdit)');
  ok(outlineUi.includes('useOutlineEdit(data,update)')&&editor.includes('useOutlineEdit(data,update,')&&outlineUi.includes('{message&&<p className="dd-note" role="alert">{message}</p>}'),'The Deck section and the plan share useOutlineEdit, and the section shows a refusal');
  ok(/if\('front' in edit\)outlineEdit\.apply\(edit\.front\);else onStatus\?\.\(REFUSED\);/.test(editor)&&editor.includes('if(next)outlineEdit.apply(next);if(d.refused)onStatus?.(REFUSED);'),'On the plan, a refused key or drag says why in the plan\'s status line');
  ok(outlineUi.includes('<legend>Custom outline</legend>')&&outlineUi.includes('aria-label="Start from a shape"')&&!outlineUi.includes('<svg'),'The Deck section keeps the Custom outline group and its shapes; the drawing is on the plan');

  // 6b. Stairs: only on the edges the page allows, and where the model then puts them.
  const pageSource=read('src/pages/DeckDesigner.tsx');
  ok(pageSource.includes("const stairEdges=namedEdges.filter(e=>wrap||(data.shape==='Custom'&&!isChamferEdgeId(e.id))||(isChamferEdgeId(e.id)&&angledStairAllowed(data)&&angledStairFits(e.lenIn,data.stairWidth))).map(({lenIn:_len,...e})=>e);"),'The page computes the stair edges as it always has (copied below)');
  const pageStairEdges=(data:DeckData,model:DeckTakeoff)=>{
    const fp=model.levels[0].footprint,ledger=getHouseContact(data,fp),wrap=activeWrap(data);
    const named=fp.edgeIds?fp.outline.flatMap((a,i)=>{const b=fp.outline[(i+1)%fp.outline.length],id=fp.edgeIds![i],len=Math.hypot(b.x-a.x,b.y-a.y);return ledger.isContactEdge(i)||len<36?[]:[{id,name:edgeNameOf(id),ft:(len/12).toFixed(1),lenIn:len}];}):[];
    return named.filter(e=>wrap||(data.shape==='Custom'&&!isChamferEdgeId(e.id))||(isChamferEdgeId(e.id)&&angledStairAllowed(data)&&angledStairFits(e.lenIn,data.stairWidth))).map(({lenIn:_len,...e})=>e);
  };
  const wrapHouse={...getHouseConfig(base()),widthFt:20,depthFt:20};
  const stairCases:Record<string,Partial<DeckData>>={
    'default':{},'no stairs yet':{stairFlights:0},'stairs on the left':{stairPosition:'Left',stairOffset:20},'picture frame':{pattern:'Picture Frame',pictureFrameRows:2},
    'landing stairs':{height:72,stairType:'Landing'},'winder stairs':{height:60,stairType:'Winder'},'wide stairs':{stairWidth:96,width:12},
    'L-shape':{width:24,length:20,shape:'L-Shape'},'multi-corner':{width:24,length:20,shape:'Multi-corner'},'curved':{shape:'Curved'},
    'freestanding':{deckType:'Freestanding'},'narrow house placed left':{width:20,houseConfig:{...house,widthFt:12,depthFt:24},housePlacement:{anchor:'left',offsetIn:24}},
    'wrap left':{width:24,houseConfig:wrapHouse,wrap:{left:{widthFt:6,runFt:8}}},'wrap both':{houseConfig:wrapHouse,wrap:{left:{widthFt:6,runFt:8},right:{widthFt:6,runFt:8}}},
    'custom T':{width:20,length:14,shape:'Custom',customFront:outlinePreset('t',20,14)!},'custom bay':{width:24,length:16,shape:'Custom',customFront:outlinePreset('bay',24,16)!,height:30},
    'angled corners':{cornerChamfers:{frontLeftFt:6,frontRightFt:6},height:36},'split level (the lower level takes the stairs)':{width:20,length:14,...splitLevel({...base(),width:20,length:14})},
    'second level to the left, higher':{width:24,length:16,levels:2,height:24,height2:48,level2Position:'Left'},
  };
  let checkedTargets=0,slid=0;
  for(const [name,patch] of Object.entries(stairCases)){
    const data=deckReleaseData({...base(),...patch}),model=calculateDeckReleaseEstimate(data).model as DeckTakeoff,allowed=pageStairEdges(data,model),sides=availableStairSides(data);
    const targets=stairTargets(data,model,allowed),contact=getHouseContact(data,model.levels[0].footprint);
    ok(targets.length>0,`${name}: the Stairs tool offers somewhere to put them`);
    for(const t of targets){
      const [kind,id]=t.key.split(':');
      ok(kind==='edge'?allowed.some(e=>e.id===id)&&t.level===0:kind==='side'&&sides.includes(id as never),`${name}: "${t.name}" is an edge the page allows (${t.key})`);
      ok(!(t.level===0&&contact.isContactEdge(t.edge)),`${name}: "${t.name}" is never against the house`);
      ok(Object.keys(t.patch).every(k=>['stairEdgeId','stairPosition','stairFlights'].includes(k))&&('stairFlights' in t.patch)===!(data.stairFlights>0),`${name}: "${t.name}" makes the Stairs section's own choice (and a flight when there is none)`);
      const placed=deckReleaseData({...data,...t.patch}),p=primaryStair(placed,calculateDeckReleaseEstimate(placed).model as DeckTakeoff,allowed);
      // The outline can be cut differently once the stairs move, so the edge is compared on the drawing, not by number.
      const on=(q:{x:number;y:number})=>{const len=Math.hypot(t.b.x-t.a.x,t.b.y-t.a.y),u={x:(t.b.x-t.a.x)/len,y:(t.b.y-t.a.y)/len},s=(q.x-t.a.x)*u.x+(q.y-t.a.y)*u.y;return Math.abs((q.x-t.a.x)*u.y-(q.y-t.a.y)*u.x)<1&&s>-1&&s<len+1;};
      ok(!!p&&p.level===t.level&&on(p.centre),`${name}: a tap on "${t.name}" puts the stairs on that edge (${p?`${p.centre.x.toFixed(1)},${p.centre.y.toFixed(1)} on level ${p.level}`:'none'})`);
      checkedTargets++;r5.stairs++;
    }
    ok(new Set(targets.map(t=>`${t.level}/${t.edge}`)).size===targets.length,`${name}: one mark per edge`);
    const p=primaryStair(data,model,allowed),h=stairHandle(data,p);
    if(!(data.stairFlights>0)){ok(p===null&&h===null,`${name}: no stairs, no handle`);continue;}
    ok(!!p&&targets.some(t=>t.level===p.level&&t.edge===p.edge),`${name}: the stairs' own edge is one of the marks`);
    if(!h||!p){ok(!!p&&p.free<6,`${name}: the only stairs without a handle fill their edge`);continue;}
    ok(h.min===0&&h.max===100&&h.step===1&&h.bigStep===10&&h.value===clampFt(Number(data.stairOffset),0,100),`${name}: the handle is the Stairs section's 0–100 % position`);
    ok(keyValue('End',false,h.value,h.min,h.max,h.step,h.bigStep)===100&&keyValue('Home',false,h.value,h.min,h.max,h.step,h.bigStep)===0&&keyValue('ArrowUp',true,95,h.min,h.max,h.step,h.bigStep)===100&&keyValue('ArrowDown',false,50,h.min,h.max,h.step,h.bigStep)===49,`${name}: keys move 1 % (Shift 10 %) and stop at 0 and 100 %`);
    const g0=beginGesture(h,1,0,0);
    ok(moveGesture(g0,h.move!.x*1e5,h.move!.y*1e5).value===100&&moveGesture(g0,-h.move!.x*1e5,-h.move!.y*1e5).value===0,`${name}: a drag stops at the ends of the edge`);
    // Sliding: the model then opens the stairs where the handle was let go.
    const target=h.value>=50?h.value-30:h.value+30,moved=moveGesture(g0,h.move!.x*(target-h.value),h.move!.y*(target-h.value));
    ok(moved.value===target,`${name}: the handle follows the pointer along the edge (${moved.value} for ${target})`);
    const after=deckReleaseData({...data,...handlePatch(data,'stair',moved.value)}),q=primaryStair(after,calculateDeckReleaseEstimate(after).model as DeckTakeoff,allowed);
    const want={x:h.x+h.move!.x*(target-h.value),y:h.y+h.move!.y*(target-h.value)};
    ok(same(handlePatch(data,'stair',moved.value),{stairOffset:target})&&!!q&&q.edge===p.edge&&Math.hypot(q.centre.x-want.x,q.centre.y-want.y)<1,`${name}: the stairs open where the handle was let go (${q?`${q.centre.x.toFixed(1)},${q.centre.y.toFixed(1)}`:'none'} for ${want.x.toFixed(1)},${want.y.toFixed(1)})`);
    slid++;
  }
  ok(checkedTargets>=40&&slid>=10,`Stair marks checked against the model (${checkedTargets}) and handles slid (${slid})`);
  ok(/tool=\{planTool\} setTool=\{setPlanTool\}[^\n]*stairEdges=\{stairEdges\}/.test(pageSource)&&read('src/features/deckcraft/designer/PreviewPanel.tsx').includes('tool={tool} stairEdges={stairEdges}')&&editor.includes('stairTargets(data,model,stairEdges)'),'The Stairs tool is handed the page\'s own stair edges');

  // 6c. House: the wall ends, 12–100 ft, the House field's own change with its openings clamped, the other end kept.
  const houseCases:Record<string,DeckData>={
    'default (follows the deck)':deckReleaseData(base()),'own size':deckReleaseData({...base(),houseConfig:{...getHouseConfig(base()),widthFt:30}}),
    'placed left':deckReleaseData({...base(),width:20,houseConfig:{...house,widthFt:12,depthFt:24},housePlacement:{anchor:'left',offsetIn:24}}),
    'blocks':deckReleaseData(HOUSE_CASES['blocks/bump-wing-garage']),'wrap both':deckReleaseData({...base(),houseConfig:wrapHouse,wrap:{left:{widthFt:6,runFt:8},right:{widthFt:6,runFt:8}}}),
  };
  for(const [name,d] of Object.entries(houseCases)){
    const hs=houseHandles(d,96),hp=getHousePlacement(d),hc=getHouseConfig(d);
    ok(hs.map(h=>h.id).join()==='house-left,house-right'&&hs[0].x===hp.x0&&hs[1].x===hp.x1&&hs.every(h=>h.min===12&&h.max===100&&h.value===hc.widthFt&&h.y===-48),`${name}: a handle on each house wall end, 12 to 100 ft`);
    for(const h of hs){
      const g=beginGesture(h,1,0,0);
      ok(moveGesture(g,h.move!.x*1e4,0).value===100&&moveGesture(g,-h.move!.x*1e4,0).value===12&&keyValue('End',false,h.value,h.min,h.max)===100&&keyValue('Home',false,h.value,h.min,h.max)===12,`${name} ${h.label}: dragged or keyed, the width stays within 12 to 100 ft`);
      for(const v of [12,Math.max(12,hc.widthFt-3.5),hc.widthFt+6,100]){
        const patch=handlePatch(d,h.id,v),next={...d,...patch},nc=patch.houseConfig!;
        ok(nc.widthFt===v&&same(nc.openings,hc.openings.map(o=>clampHouseOpening(o,{...hc,widthFt:v})))&&nc.openings.every(o=>same(clampHouseOpening(o,nc),o)),`${name} ${h.label} → ${v} ft: the House field's own change, every opening clamped to the new walls`);
        ok(Object.keys(patch).every(k=>k==='houseConfig'||k==='housePlacement'),`${name} ${h.label} → ${v} ft: only the house changes`);
        const after=getHousePlacement(deckReleaseData(next));
        if(activeWrap(d))ok(!('housePlacement' in patch),`${name}: a wrap-around places the house itself`);
        else{const W=deckIn(d),HW=v*12,overlap=Math.min(24,W,HW),wanted=h.id==='house-right'?hp.x0:hp.x1-HW,x0=Math.min(W-overlap,Math.max(overlap-HW,wanted));
          ok(Math.abs(after.x0-x0)<.01&&Math.abs(after.x1-after.x0-HW)<.01,`${name} ${h.label} → ${v} ft: the other wall end stays where it was (unless the house would leave the deck: it keeps 2 ft on it)`);}
        r5.house++;
      }
    }
  }
  ok(houseHandles({...deckReleaseData(base()),houseVisible:false},96).length===0,'No house, no house handles');
  ok(read('src/features/deckcraft/HouseEditor.tsx').includes('const change=(patch:Partial<HouseConfig>)=>{const next={...house,...patch};next.openings=next.openings.map(o=>clampHouseOpening(o,next));'),'The House section clamps openings the same way');

  // 6d. Size & place: the second level's depth, the wings and the angled corners, each within its field's limits.
  const split=deckReleaseData({...base(),width:20,length:14,...splitLevel({...base(),width:20,length:14})}),sm=calculateDeckReleaseEstimate(split).model as DeckTakeoff;
  const l2=shapeHandles(split,sm).find(h=>h.id==='level2-depth')!;
  ok(!!l2&&l2.min===4&&l2.max===40&&l2.value===split.length2&&l2.move!.y===12,`A split level has a depth handle on the second level's front edge (${l2?.value} ft)`);
  ok(moveGesture(beginGesture(l2,1,0,0),0,1e5).value===40&&moveGesture(beginGesture(l2,1,0,0),0,-1e5).value===4&&moveGesture(beginGesture(l2,1,0,0),0,30).value===clampFt(split.length2+2.5,4,40),'Its drag follows the pointer and stays within 4 to 40 ft');
  ok(same(handlePatch(split,'level2-depth',12),{length2:12}),'It sets the Second level depth field and nothing else');
  const l2m=sm.levels.find((l,k)=>k>0&&l.kind==='deck'&&l.index===1)!,ghost2=planGhost(split,sm,'level2-depth',12,96)[0];
  ok(Math.abs(Math.max(...ghost2.map(p=>p.y))-Math.min(...ghost2.map(p=>p.y))-144)<.01&&Math.abs(Math.min(...ghost2.map(p=>p.y))-l2m.offset.z)<.01,'Its ghost keeps the level against the deck and draws the new depth');
  ok(!shapeHandles(deckReleaseData({...base(),width:24,length:16,levels:2,level2Position:'Left'}),calculateDeckReleaseEstimate(deckReleaseData({...base(),width:24,length:16,levels:2,level2Position:'Left'})).model as DeckTakeoff).some(h=>h.id==='level2-depth'),'A second level beside the deck keeps its depth in the Deck section');
  for(const [name,patch,ids] of [['wrap left',{width:24,houseConfig:wrapHouse,wrap:{left:{widthFt:6,runFt:8}}},'wing-left'],['wrap right',{width:24,houseConfig:wrapHouse,wrap:{right:{widthFt:6,runFt:8}}},'wing-right'],['wrap both',{houseConfig:wrapHouse,wrap:{left:{widthFt:6,runFt:8},right:{widthFt:7,runFt:8}}},'wing-left,wing-right']] as const){
    const d=deckReleaseData({...base(),...patch} as DeckData),m=calculateDeckReleaseEstimate(d).model as DeckTakeoff,hs=shapeHandles(d,m).filter(h=>h.id.startsWith('wing'));
    ok(hs.map(h=>h.id).join()===ids,`${name}: a width handle at each wing's outer end`);
    for(const h of hs){
      const side=h.id==='wing-left'?'left':'right',cap=ids.includes(',')?24:Math.min(24,Math.floor((d.width*12-48)/12*2)/2);
      ok(h.min===4&&h.max===cap&&h.value===d.wrap![side]!.widthFt,`${name} ${h.label}: 4 ft to ${cap} ft, its field's width`);
      ok(moveGesture(beginGesture(h,1,0,0),h.move!.x*1e4,0).value===cap&&moveGesture(beginGesture(h,1,0,0),-h.move!.x*1e4,0).value===4,`${name} ${h.label}: a drag stays within its limits`);
      ok(same(handlePatch(d,h.id,9),setWingSize(d,side,{widthFt:9})),`${name} ${h.label}: the Deck section's own wing change`);
      const moved=activeWrap({...d,...handlePatch(d,h.id,cap)} as DeckData);ok(!!moved&&moved[side]!.widthIn===cap*12,`${name} ${h.label}: its widest is built as asked`);
      r5.shape++;
    }
  }
  const angled=deckReleaseData({...base(),cornerChamfers:{frontLeftFt:4,frontRightFt:3}}),am=calculateDeckReleaseEstimate(angled).model as DeckTakeoff,ah=shapeHandles(angled,am).filter(h=>h.id.startsWith('chamfer'));
  ok(ah.map(h=>`${h.id}=${h.value}`).join()==='chamfer-left=4,chamfer-right=3','Each angled corner has a handle on its face, at its cut');
  for(const h of ah){
    ok(h.min===2&&h.max<=30&&moveGesture(beginGesture(h,1,0,0),h.move!.x*1e4,h.move!.y*1e4).value===h.max&&moveGesture(beginGesture(h,1,0,0),-h.move!.x*1e4,-h.move!.y*1e4).value===2,`${h.label}: 2 ft to ${h.max} ft, dragged along the corner`);
    const key=h.id==='chamfer-left'?'frontLeftFt':'frontRightFt',next={...angled,...handlePatch(angled,h.id,h.max)},built=activeCornerChamfers(next)!;
    ok(same(handlePatch(angled,h.id,5).cornerChamfers,{...angled.cornerChamfers,[key]:5})&&!built.shrunk&&(key==='frontLeftFt'?built.leftIn:built.rightIn)===h.max*12,`${h.label}: the Deck section's own corner cut, built as asked even at its largest`);
    r5.shape++;
  }
  ok(shapeHandles(d0,m0).length===0,'A plain rectangle has no second-level, wing or corner handles');
  // One commit per gesture for every new handle: forty moves, one value.
  for(const h of [l2,...ah]){let g=beginGesture(h,1,0,0);for(let k=1;k<=40;k++)g=moveGesture(g,h.move!.x*k/40,h.move!.y*k/40);ok(endGesture(g)===clampFt(h.value+1,h.min,h.max)||endGesture(g)===null,`${h.label}: forty moves, one commit`);}
}

// 7. R5 wiring: the tool strip, the whole house for the House tool, and the pointer kept by the handles only.
{
  const read=(p:string)=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
  const panel=read('src/features/deckcraft/designer/PreviewPanel.tsx'),page=read('src/pages/DeckDesigner.tsx'),editor=read('src/features/deckcraft/designer/PlanEditor.tsx'),css=read('src/pages/DeckDesigner.css');
  ok(PLAN_TOOLS.map(t=>t[1]).join('|')==='Select parts|Shape & points|Board layout|Inlays|Rails & screens|Patios & walls|Landscape areas|Size & place|Stairs|House'&&read('src/features/deckcraft/designer/PlanToolPicker.tsx').includes('role="radiogroup" aria-label="Plan tools"')&&read('src/features/deckcraft/designer/PlanToolPicker.tsx').includes('role="radio" aria-checked={tool===id}'),'The plan has one tool at a time, including independently placed inlays and rail and screen sections');
  ok(page.includes("const [planTool,setPlanTool]=useState<PlanTool>('size');")&&page.includes("if(data.shape==='Custom')setPlanTool(t=>t==='size'?'outline':t)"),'The plan opens with size controls and switches custom shapes to point editing');
  const custom=planShortcut(deckReleaseData(base()),'Custom');ok(custom.tool==='outline'&&panel.includes('setTool(r.tool)')&&panel.includes('loadPlanBoundaryEditor')&&!panel.includes('onOpenDeck'),'Draw my own switches to the Draw outline tool and preloads its editor');
  ok(panel.includes(`variant="site" wholeHouse={tool==='house'}/>`)&&editor.includes("planFrame(model,{data,yard,variant:'site',wholeHouse:tool==='house'})"),'The House tool draws the whole house, on the plan and under its editor alike');
  for(const c of built.filter(b=>b.withData&&b.data.houseVisible!==false)){
    const whole=renderToStaticMarkup(createElement(ConstructionPlan,{model:c.model,data:c.data,variant:'site',wholeHouse:true})),f=planFrame(c.model,{data:c.data,variant:'site',wholeHouse:true}),hp=getHousePlacement(c.data);
    ok(viewBoxOf(whole)===f.viewBox&&f.left<=hp.x0+.001&&f.right>=hp.x1-.001&&!/M-?[\d.]+ -?[\d.]+V-?[\d.]+l-7 3l14 6l-7 3V0/.test(whole),`${c.name}: the House tool shows both house wall ends, with no side break lines`);
    ok(renderToStaticMarkup(createElement(ConstructionPlan,{model:c.model,data:c.data,wholeHouse:true}))===contractor({...c,yard:undefined}),`${c.name}: the contractor plan ignores it`);
  }
  // One commit per gesture on the plan, and the overlay never decides contact with the house.
  const move=/const onPointerMove=[\s\S]*?\n {2}\};/.exec(editor)?.[0]??'';
  ok(move.includes('moveEdgeDrag(')&&!/update\(|commit\(|apply\(/.test(move),'An outline edge dragged across the plan changes nothing until it is let go');
  const overlay=[editor,read('src/features/deckcraft/designer/planEditMath.ts'),read('src/features/deckcraft/designer/outlineEditMath.ts')].join('\n');
  ok(!/===\s*'Back'|Math\.abs\([\w.]*\.y\)\s*<|\.y\s*<\s*\.5|isContactEdge|exposedSides\(/.test(overlay),'The plan tools never test the house line or a Back edge themselves (houseContact.ts decides)');
  ok(css.split('touch-action:none').length===2&&/\.dd-plan-handle\{[^}]*touch-action:none/.test(css)&&!/\.dd-outline-plan[^{]*\{[^}]*touch-action:none/.test(css),'Only the handles keep the pointer; the outline lines and the rest of the plan let a phone scroll');
  ok(/\.dd-plan-tools button\{min-height:44px/.test(css)&&/\.dd-plan-target\{[^}]*width:44px;height:44px/.test(css),'The tools and the stair marks are 44 px targets');
  // The workspace's last word on the strip: columns made as needed, never a fixed count that a new tool wraps past.
  const strip=[...read('src/features/deckcraft/designer/workspace.css').matchAll(/\.deck-designer \.dd-plan-tools\{([^}]*)\}/g)].pop()?.[1]??'';
  ok(/grid-template-columns:none/.test(strip)&&/grid-auto-flow:column/.test(strip)&&/grid-auto-columns:minmax\((4[4-9]|[5-9]\d)px,1fr\)/.test(strip)&&/overflow-x:auto/.test(strip),`The ${PLAN_TOOLS.length} plan tools take one row whatever their number, at least 44 px each, scrolling sideways where they cannot fit`);
}
console.log(`R5 plan tools: ${r5.outline} outline moves, ${r5.stairs} stair marks, ${r5.house} house widths, ${r5.shape} wing and corner handles checked.`);

console.log(`DECK PLAN SHEET OK — ${built.length} designs: the contractor plan is byte-identical to its golden; the site plan hides the framing and keeps the deck, stairs, railing and inlays; one frame for the plan and its editor; the editor's arithmetic and wiring; ${checks} checks.`);

