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
import {outlinePreset} from '../src/features/deckcraft/lib/outlineEdits';
import {chooseShape,splitLevel} from '../src/features/deckcraft/designer/deckShapeActions';
import {beginGesture,clampFt,describeSlide,endGesture,ghostShift,handlePatch,keyValue,moveGesture,planHandles,planShortcut,type PlanHandleId} from '../src/features/deckcraft/designer/planEditMath';
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
const built:Built[]=Object.entries(planSheetCases()).map(([name,c])=>{
  const data=deckReleaseData(c.data),estimate=calculateDeckReleaseEstimate(data);
  return {name,data,model:estimate.model as DeckTakeoff,yard:c.withYard?estimate.yardModel as YardModel:undefined,withData:c.withData};
});
const contractor=(c:Built)=>renderToStaticMarkup(createElement(ConstructionPlan,{model:c.model,...(c.withData?{data:c.data}:{}),...(c.yard?{yard:c.yard}:{})}));
// The site plan as the page draws it: with the design, and without a yard.
const site=(c:Built)=>renderToStaticMarkup(createElement(ConstructionPlan,{model:c.model,data:c.data,variant:'site'}));
const count=(text:string,part:string)=>text.split(part).length-1;
const viewBoxOf=(svg:string)=>/^<svg viewBox="([^"]+)"/.exec(svg)?.[1];

// 1. The contractor plan, byte for byte.
{
  const current=Object.fromEntries(built.map(c=>{const markup=contractor(c);return [c.name,{sha256:digest(markup),bytes:Buffer.byteLength(markup)}];}));
  if(update||!existsSync(GOLDEN)){
    assert(update,'deck-plan-sheet-golden.json is missing: it was captured from the contractor plan before R4 and must not be regenerated silently.');
    const note='ConstructionPlan default (contractor) markup, captured from bd5fd89 before R4 added the site variant. Regenerate only for an owner-approved change to the contractor plan.';
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
  const custom=planShortcut(d0,'Custom');ok(JSON.stringify(custom.patch)===JSON.stringify(chooseShape(d0,'Custom'))&&custom.openDeck===true,'Draw my own starts an outline and opens the Deck section');
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
  ok(panel.includes('<ConstructionPlan model={estimate.model} data={data} variant="site"/>')&&panel.includes('framingPlan=<ConstructionPlan model={estimate.model} data={data}/>'),'The Plan tab draws the site plan and the Framing tab the contractor plan');
  ok(panel.includes("const show3d=mounted&&hasWebGL&&mode!=='plan'&&mode!=='drawing';")&&page.includes("desktopOnly=window.matchMedia?.('(min-width: 761px) and (pointer: fine)').matches?[loadViewer]:[];")&&page.includes(',...desktopOnly])load()'),'The 3D viewer loads for a 3D view, and ahead of time on a desktop only');
  ok(read('src/features/deckcraft/pdfAssets.ts').includes('createElement(ConstructionPlan,{model,data})')&&read('src/features/deckcraft/ProposalSheet.tsx').includes('<ConstructionPlan model={estimate.model} data={data}/>'),'The PDF and the printable proposal draw the contractor plan');
  // One commit per gesture: a pointer move only moves the ghost; the design changes when the drag ends.
  const move=/const onPointerMove=[\s\S]*?\n {2}\};/.exec(editor)?.[0]??'';
  ok(move.includes('moveGesture(')&&!/update\(|commit\(/.test(move),'A pointer move never changes the design');
  ok(/const onPointerUp=[\s\S]*?endGesture\(g\);if\(value!==null\)commit\(g\.id,value\);/.test(editor),'The end of a drag commits once');
  ok(editor.includes('role="slider"')&&editor.includes('aria-valuetext=')&&editor.includes('aria-valuemin=')&&editor.includes('aria-valuemax='),'Handles are sliders with a text value');
  ok(/\.dd-plan-handle\{[^}]*width:44px;height:44px[^}]*touch-action:none/.test(css)&&css.includes('.dd-canvas>.dd-site-plan,.dd-plan-editor{touch-action:pan-y}'),'Handles are 44 px and keep the pointer; the rest of the plan lets the page scroll');
}

console.log(`DECK PLAN SHEET OK — ${built.length} designs: the contractor plan is byte-identical to its golden; the site plan hides the framing and keeps the deck, stairs, railing and inlays; one frame for the plan and its editor; the editor's arithmetic and wiring; ${checks} checks.`);

