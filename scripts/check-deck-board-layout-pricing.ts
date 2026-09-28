import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {DEFAULT_DECK,DECK_SETTINGS} from '../src/features/deckcraft/defaults';
import {calculateDeckReleaseEstimate,deckReleaseData} from '../src/features/deckcraft/deckRelease';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {boardFinishPlan,colourRef,deckColourRef,parseColourRef} from '../src/features/deckcraft/boardFinishes';
import {layoutBoardStock,boardLayoutAllowance,layoutAutomaticBreakerLf,BOARD_LAYOUT_SUPPORT_QUOTE,BOARD_LAYOUT_POLICY} from '../src/features/deckcraft/boardLayoutPricing';
import {deckBoardStock} from '../src/features/deckcraft/stockPlan';
import {parseDesign,serializeDesign,validateDesign} from '../src/features/deckcraft/designPersistence';
import {describeDesign} from '../src/features/deckcraft/designFacts';
import {proposalFinishes} from '../src/features/deckcraft/proposalModel';
import {ProposalSheet} from '../src/features/deckcraft/ProposalSheet';
import type {DeckData,BoardLayoutConfig} from '../src/features/deckcraft/types';
let checks=0;
const ok=(v:unknown,message:string)=>{assert(v,message);checks++;};
const close=(a:number,b:number,message:string)=>ok(Math.abs(a-b)<1e-7,message);
const base=(patch:Partial<DeckData>={}):DeckData=>deckReleaseData({...structuredClone(DEFAULT_DECK),deckingMaterial:'tt_prime_plus',deckingColor:'Coconut Husk',width:20,length:12,stairFlights:0,...patch});
const price=(d:DeckData)=>calculateDeckReleaseEstimate(d,DECK_SETTINGS);
const layout=(patch:Partial<BoardLayoutConfig>={}):BoardLayoutConfig=>({regions:[],breakers:[],pieces:[],...patch});
const rect=[{x:20,y:20},{x:160,y:20},{x:160,y:110},{x:20,y:110}];
const cocoa=colourRef('tt_prime_plus','Dark Cocoa'),reserve=colourRef('tt_reserve','Dark Roast'),unpriced=colourRef('tt_terrain_plus','Dark Oak');
const cuts=(s:ReturnType<typeof layoutBoardStock>)=>s.bins.flatMap(b=>b.cutsIn).sort((a,b)=>a-b);
{
  const d=base(),m=buildDeckTakeoff(d);
  ok(JSON.stringify(layoutBoardStock(d,m,1.1))===JSON.stringify(deckBoardStock(m,1.1)),'Absent custom layout delegates byte-for-byte to the original stock plan');
  const empty=base({boardLayout:layout()});
  ok(JSON.stringify(price(d))===JSON.stringify(price(empty)),'An empty layout adds no price, model metadata or quote scope');
}
// A containing cut can leave two longitudinally overlapping polygons from ONE physical stock board.
{
  const d=base({boardLayout:layout({regions:[{id:'physical',level:1,polygon:rect,angleDeg:17}]})}),m=buildDeckTakeoff(d),original=m.levels[0].boards[0];
  const source={cx:50,cy:2.75,lengthIn:100,widthIn:5.5,angleDeg:0};
  const board=(polygon:{x:number;y:number}[])=>({...original,cx:50,cy:2.75,length:100,width:5.5,angleDeg:0,polygon,layoutStockId:'single-stock',layoutStockSource:source});
  const isolated={...m,levels:[{...m.levels[0],boards:[board([{x:0,y:0},{x:100,y:0},{x:100,y:2},{x:0,y:2}]),board([{x:0,y:3.5},{x:100,y:3.5},{x:100,y:5.5},{x:0,y:5.5}])]}]};
  const stock=layoutBoardStock(d,isolated,1);
  ok(cuts(stock).length===1,'Overlapping cut fragments order one physical stock cut');close(cuts(stock)[0],100,'The retained stock projection is 100 inches, not 200');
  const automatic={...isolated,levels:isolated.levels.map(l=>({...l,boards:l.boards.map(b=>({...b,role:'breaker' as const}))}))};
  close(layoutAutomaticBreakerLf(automatic),100/12,'Automatic breaker fitting unions retained spans after layout carving');
}
const fixtures:DeckData[]=[];
{
  const d=base({boardWidth:3.5}),inactive=base({...d,boardLayout:layout({regions:[{id:'saved-lower',level:2,polygon:rect,angleDeg:17,colour:reserve}],pieces:[{id:'saved-third',level:3,cx:40,cy:40,lengthIn:80,widthIn:3.5,angleDeg:23,colour:cocoa}]})}),before=price(d),after=price(inactive);
  close(after.total,before.total,'Retained absent-level edits never change current material or labour totals');
  ok(JSON.stringify(after.stockSchedule)===JSON.stringify(before.stockSchedule),'Inactive custom edits leave purchased main-stock width and cuts unchanged');
  ok(JSON.stringify(after.model.quantities)===JSON.stringify(before.model.quantities),'Absent-level layout has no current installed quantity');
  ok(!after.sections.some(s=>s.title.startsWith('Custom board-layout')),'An entirely inactive layout creates no current custom construction or stock scope');
  ok(after.flags.some(f=>/absent deck level\(s\) 2, 3.*retained but inactive/.test(f)),'Retained absent-level edits are explicitly flagged for restoration or removal');
  ok(parseDesign(serializeDesign(inactive)).boardLayout?.regions[0].level===2,'Inactive saved level geometry is preserved rather than silently deleted');
  const outside=base({...d,boardLayout:layout({regions:[{id:'off-deck',level:1,polygon:rect.map(p=>({x:p.x+500,y:p.y})),angleDeg:17,colour:reserve}]})}),offPrice=price(outside);
  close(offPrice.total,before.total,'Wholly off-deck records never convert untouched narrow main boards to custom pricing');
  ok(!offPrice.sections.some(s=>s.title.startsWith('Custom board-layout')),'Wholly off-deck records create no installed custom scope');
  ok(offPrice.flags.some(f=>/currently place no boards.*inactive/.test(f)),'Wholly off-deck saved records explicitly report their inactive state');
  ok(describeDesign(outside,offPrice).proposalFacts.some(f=>f.includes('0 placed directional area(s)')),'Proposal facts count surviving placed regions rather than saved off-deck records');
}
for(const angleDeg of [0,17,45,90,133])for(const colour of [undefined,cocoa,reserve,unpriced])fixtures.push(base({boardLayout:layout({regions:[{id:'area-A',level:1,polygon:rect,angleDeg,colour}],breakers:[{id:'break-A',level:1,start:{x:12,y:120},end:{x:200,y:120},widthIn:5.5,colour}],pieces:[{id:'piece-A',level:1,cx:90,cy:60,lengthIn:200,widthIn:5.5,angleDeg:31,colour}]})}));
for(const [index,d] of fixtures.entries()){
  const e=price(d),m=e.model!,finish=boardFinishPlan(d,m),custom=m.levels.flatMap(l=>l.boards).filter(b=>b.layoutId),stock=layoutBoardStock(d,m,1.1,{straight:1.1,diagonal:1.15});
  ok(custom.length>0,`${index}: custom geometry reaches the shared estimate model`);
  ok(stock.unresolved.length===0&&stock.orderedBoards>=stock.bins.length,`${index}: stock joints and waste are accounted for, with no free oversize cuts`);
  close(e.sections.filter(s=>s.title!=='HST (13%)').reduce((n,s)=>n+s.total,0),e.subtotal,`${index}: every priced section reconciles to subtotal`);
  close(e.hst,e.subtotal*.13,`${index}: HST once on the complete priced portion`);close(e.total,e.subtotal+e.hst,`${index}: final total reconciles`);
  ok(e.quoteRequired?.includes(BOARD_LAYOUT_SUPPORT_QUOTE),`${index}: unmodelled supports and fastening remain an explicit construction quote`);
  const support=e.sections.find(s=>s.title==='Custom board-layout construction review');
  ok(support?.quoteRequired&&support.total===0&&support.items.every(i=>i.cost===null),`${index}: pending construction is never presented as a free priced scope`);
  ok(e.sections.find(s=>s.title==='Labour (Construction & Build)')?.items.some(i=>/cutting\/fitting allowance/.test(i.spec??'')),`${index}: installation planning allowance is disclosed in Labour`);
  const colour=d.boardLayout!.regions[0].colour;
  if(colour){
    finish.colours.forEach((rows,li)=>rows.forEach((ref,bi)=>{if(m.levels[li].boards[bi].layoutColour===colour)ok(ref===colour,`${index}: exact area/breaker/piece colour takes precedence`);}));
    const row=e.sections.find(s=>s.title==='Custom board-layout stock')?.items.find(i=>i.name.includes(parseColourRef(colour)!.color.name));
    ok(!!row&&Number(row.qty)>0,`${index}: own product stock has a dedicated purchase line`);
    if(colour===unpriced)ok(row!.cost===null&&e.quoteRequired?.some(q=>q.includes('Dark Oak')),`${index}: unpriced catalogue collection stays quote-required`);
    else {
      const rate=parseColourRef(colour)!.material.costPerSqft!,markup=1+(d.materialMarkup??25)/100;
      close(row!.cost!,Number(row!.qty)*16*BOARD_LAYOUT_POLICY.stockWidthIn/12*rate*markup,`${index}: own catalogue rate charges full purchased width and length`);
    }
    ok(proposalFinishes(d,m).some(t=>t.key===colour&&t.uses.includes('Custom board layout')),`${index}: proposal names the actual manufacturer colour and use`);
  }
  const facts=describeDesign(d,e).proposalFacts;
  ok(facts.some(f=>f.includes('Custom board layout:'))&&facts.some(f=>/supports, fasteners/.test(f)),`${index}: proposal describes direction, placed breaker LF and construction gaps`);
  const restored=parseDesign(serializeDesign(d));
  ok(JSON.stringify(restored.boardLayout)===JSON.stringify(validateDesign(d).boardLayout),`${index}: layout and catalogue colour survive JSON round-trip`);
  if(index===7){const html=renderToStaticMarkup(createElement(ProposalSheet,{data:d,estimate:e,facts,reviewItems:e.flags,image:null,date:'September 26, 2026'}));ok(html.includes('Custom board-layout stock')&&html.includes(BOARD_LAYOUT_SUPPORT_QUOTE)&&html.includes('Dark Oak'), 'Printable proposal preserves priced layout stock, pending support and supplier colour scope');}
}
{
  const d=base({boardWidth:3.5,boardLayout:layout({pieces:[{id:'long-rectangle',level:1,cx:120,cy:70,lengthIn:240,widthIn:3.5,angleDeg:0,colour:cocoa}]})}),m=buildDeckTakeoff(d),finish=boardFinishPlan(d,m);
  const kept=finish.stock.find(g=>g.kind==='layout')!.boards,keys=new Set(kept.map(b=>`${b.level}:${b.index}`));
  const partial={...m,levels:m.levels.map((l,li)=>({...l,boards:l.boards.filter((_,bi)=>keys.has(`${li}:${bi}`))}))},s=layoutBoardStock(d,partial,1,undefined,m);
  ok(JSON.stringify(cuts(s))===JSON.stringify([48,192]),'A requested 240-inch piece purchases its full original rectangle once across physical stock joints');
  const e=price(d),row=e.sections.find(s=>s.title==='Custom board-layout stock')!.items[0];
  close(row.cost!,Number(row.qty)*16*5.5/12*parseColourRef(cocoa)!.material.costPerSqft!*(1+(d.materialMarkup??25)/100),'A 3.5-inch rip still purchases a full 5.5-inch board');
  ok(e.stockSchedule?.filter(s=>s.section.includes('decking')).every(s=>s.section==='5.5 in decking'),'Every custom cut schedule identifies purchased width rather than the drawn rip width');
  const allowance=boardLayoutAllowance(d,m,320);
  close(allowance.pieceEndLf,4*3.5/12,'Fitting allowance includes both ends of each requested stock-length piece');
  ok(allowance.fittingDays>0,'Inserted stock has an explicit positive fitting planning allowance');
}
{
  const d=base({boardLayout:layout({pieces:[{id:'stable-piece',level:1,cx:110,cy:60,lengthIn:80,widthIn:5.5,angleDeg:23}]})}),m=buildDeckTakeoff(d),p=boardFinishPlan(d,m),bi=m.levels[0].boards.findIndex(b=>b.layoutId==='stable-piece'),a=p.addresses[0][bi]!;
  const painted=base({...d,boardColours:[{lv:1,role:a.role,scope:'piece',course:a.course,at:a.at,colour:cocoa}]}),paint=boardFinishPlan(painted,buildDeckTakeoff(painted));
  ok(paint.matched.length===1,'Custom physical board addresses accept their exact saved colour override');
  ok(parseDesign(serializeDesign(painted)).boardColours?.[0].course===a.course,'Encoded custom address survives persistence without truncation');
  const other=base({...painted,boardLayout:layout({pieces:[{...d.boardLayout!.pieces[0],id:'different-piece'}]})}),next=boardFinishPlan(other,buildDeckTakeoff(other));
  ok(next.unmatched.length===1&&next.colours.every(l=>l.every(c=>c!==cocoa)),'Changing physical piece identity never moves a saved colour onto the replacement board');
  const own=base({...painted,boardLayout:layout({pieces:[{...d.boardLayout!.pieces[0],colour:deckColourRef(d)}]})}),ownFinish=boardFinishPlan(own,buildDeckTakeoff(own));
  ok(ownFinish.colours[0].every((c,i)=>!ownFinish.addresses[0][i]?.course.startsWith('lp:')||c===null),'Explicit main colour overrides an older board paint rather than inheriting it');
}
console.log(`DeckCraft custom board-layout pricing: ${fixtures.length} layout combinations plus focused stock, inactive-layout and persistence fixtures; ${checks} checks passed.`);
