import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {calculateDeckReleaseEstimate,deckReleaseData} from '../src/features/deckcraft/deckRelease';
import {DEFAULT_DECK,DECK_SETTINGS} from '../src/features/deckcraft/defaults';
import {pruneEdgeNames} from '../src/features/deckcraft/designPersistence';
import {extrasLayout} from '../src/features/deckcraft/extrasLayout';
import {getHouseConfig} from '../src/features/deckcraft/houseSettings';
import {syncAutoLighting} from '../src/features/deckcraft/lightingSystem';
import {DECKING_CATALOGUE,RAILING_CATALOGUE} from '../src/features/deckcraft/manufacturerCatalog';
import type {DeckData} from '../src/features/deckcraft/types';
import {BOARD_LAYOUTS,BORDER_ROWS,COLLECTIONS,FASTENERS,FOUNDATIONS,RAILING_STYLES,STAIR_FLIGHTS,STAIR_LAYOUTS,optionGroups,type OptionGroup} from '../src/features/deckcraft/designer/optionGroups';
import {acceptPriced,cachedDelta,clearDeltaCache,deltaKey,describeDelta,optionDelta,runOptionDeltas,summarize,type DeltaBase,type Priced} from '../src/features/deckcraft/designer/optionDeltas';
import {createPricingQueue,priceOption,type PricingResult} from '../src/features/deckcraft/designer/optionPricing';
import {priceLedger} from '../src/features/deckcraft/designer/priceLedgerModel';
import {SECTIONS} from '../src/features/deckcraft/designer/sections';
import {selectPatch} from '../src/features/deckcraft/designer/selectPatch';
import {estimateKeyOf} from '../src/features/deckcraft/designer/useDeckEstimate';

/**
 * The price effect beside each option (R6, designer/optionDeltas.ts). Over a set of designs, every option's delta is the
 * difference of two engine runs made here on their own (the design as the page holds it, and the design with the option
 * picked the way the page picks it, lighting sync included), in whole dollars as the schedule shows them. An option
 * that adds a selection to quote says so, and one that turns a priced line into a quote shows no figure; nothing reads
 * "$0". The cache never answers for another design, a cancelled run prices nothing more, and the module the page
 * loads for it never reaches three.js. The section bodies apply the very patches that are priced.
 */
let checks=0;
const ok=(value:unknown,message:string)=>{assert(value,message);checks++;};
const root=fileURLToPath(new URL('../',import.meta.url));
const read=(path:string)=>readFileSync(resolve(root,path),'utf8');
const design=(patch:Partial<DeckData>={})=>deckReleaseData({...structuredClone(DEFAULT_DECK),...patch});
const ZERO=/\$0(?![\d.,])/;

/** The page on its own: the estimate, then the post/step/screen light sync (useDeckEstimate), then the estimate again. */
function settle(d:DeckData){
  let e=calculateDeckReleaseEstimate(d,DECK_SETTINGS);
  const counts={posts:e.model.railing.posts.length,stairs:e.model.treads.length,privacy:extrasLayout(d,e.model).privacyMounts.length};
  const items=syncAutoLighting(d,counts);
  if(JSON.stringify(items)!==JSON.stringify(d.lightingSystem.selectedItems)){d=deckReleaseData({...d,lightingSystem:{...d.lightingSystem,selectedItems:items}});e=calculateDeckReleaseEstimate(d,DECK_SETTINGS);}
  return {design:d,estimate:e};
}
/** The page's update (useDeckDesign): the patch over the design, through the release boundary, stale edge names dropped. */
const picked=(d:DeckData,patch:Partial<DeckData>)=>pruneEdgeNames(deckReleaseData({...d,...patch}));
const baseOf=(d:DeckData,e:ReturnType<typeof calculateDeckReleaseEstimate>):DeltaBase=>({key:estimateKeyOf(d),subtotal:e.subtotal,quotes:e.quoteRequired,lines:priceLedger(e).lines});

// 1. The option groups: the ones the plan names, in the sections that own them, with every choice the page offers.
{
  const ids=(section:Parameters<typeof optionGroups>[0])=>optionGroups(section,design()).map(g=>g.id).join();
  ok(ids('boards')==='collection,pattern,fasteningSystem,pictureFrameRows','Boards & finish: collections, board layout, fasteners and border rows');
  ok(ids('stairs')==='railingType,catalogueRailing,stairFlights,stairType','Stairs & railings: railing styles, manufacturer railing, stair flights and layout');
  ok(ids('site')==='foundation','Site & foundation: the foundation');
  for(const s of SECTIONS)if(!['boards','stairs','site'].includes(s.id))ok(ids(s.id)==='',`${s.name} has no option groups`);
  const all=Object.fromEntries(optionGroups('boards',design()).concat(optionGroups('stairs',design()),optionGroups('site',design())).map(g=>[g.id,g]));
  ok(all.collection.choices.map(c=>c.value).join()===DECKING_CATALOGUE.filter(m=>!m.isHidden).map(m=>m.id).join()&&COLLECTIONS.every(m=>!m.isHidden),'Every collection offered, no hidden one');
  ok(all.catalogueRailing.choices.map(c=>c.value).join()===['',...RAILING_CATALOGUE.map(r=>r.id)].join(),'The generic railing and every manufacturer railing');
  for(const [id,choices] of [['pattern',BOARD_LAYOUTS],['fasteningSystem',FASTENERS],['pictureFrameRows',BORDER_ROWS],['railingType',RAILING_STYLES],['stairFlights',STAIR_FLIGHTS],['stairType',STAIR_LAYOUTS],['foundation',FOUNDATIONS]] as const){
    ok(all[id].choices.map(c=>c.value).join()===choices.map(String).join(),`${id}: the select's choices`);
    ok(all[id].choices.every((c,i)=>JSON.stringify(c.patch)===JSON.stringify(selectPatch(id,choices[i]))),`${id}: each choice is the select's own patch`);
  }
  ok(JSON.stringify(selectPatch('railingType','Cable'))===JSON.stringify({railingType:'Cable',catalogueRailingId:undefined})&&'catalogueRailingId' in selectPatch('railingType','Cable'),'A railing style drops a manufacturer railing');
  ok(selectPatch('pictureFrameRows',0).borderFinish==='Matching'&&!('borderFinish' in selectPatch('pictureFrameRows',1)),'No border rows is a matching border');
  const rail=RAILING_CATALOGUE[0];
  ok(JSON.stringify(all.catalogueRailing.choices[1].patch)===JSON.stringify({catalogueRailingId:rail.id,railingType:rail.baseType})&&'catalogueRailingId' in all.catalogueRailing.choices[0].patch,'A manufacturer railing takes its base style; the generic choice drops it');
  ok(all.collection.choices.every(c=>{const m=DECKING_CATALOGUE.find(x=>x.id===c.value)!;return c.patch.deckingMaterial===m.id&&c.patch.deckingColor===m.colors[0].name;}),'A collection takes its first colour');
  ok(all.stairFlights.choices.map(c=>c.label).join()==='0 flights,1 flight,2 flights,3 flights'&&all.pictureFrameRows.choices[1].label==='1 row','Counts read in words');
}

// 2. The section bodies and the page apply these very patches, and the page's update is `picked`.
{
  const materials=read('src/features/deckcraft/designer/steps/MaterialsStep.tsx'),stairs=read('src/features/deckcraft/designer/steps/StairsStep.tsx'),site=read('src/features/deckcraft/designer/steps/SiteExtrasStep.tsx'),fields=read('src/features/deckcraft/designer/fields.tsx'),history=read('src/features/deckcraft/designer/useDeckDesign.ts'),estimateHook=read('src/features/deckcraft/designer/useDeckEstimate.ts');
  ok(materials.includes('{COLLECTIONS.map(m=>')&&materials.includes('onClick={()=>update(collectionPatch(m))}'),'The collection buttons are the group\'s collections and apply collectionPatch');
  ok(materials.includes("select('pattern','Board layout',BOARD_LAYOUTS,")&&materials.includes("select('fasteningSystem','Fasteners',FASTENERS,")&&materials.includes("select('pictureFrameRows','Border rows',BORDER_ROWS,"),'Boards & finish selects offer the groups\' choices');
  ok(stairs.includes("select('railingType','Railing style',RAILING_STYLES,")&&stairs.includes("select('stairFlights','Number of stair flights',STAIR_FLIGHTS,")&&stairs.includes("select('stairType','Stair layout',STAIR_LAYOUTS,")&&stairs.includes('onChange={e=>update(catalogueRailingPatch(e.target.value))}'),'Stairs & railings offer the groups\' choices and apply their patches');
  ok(site.includes("select('foundation','Foundation preference',FOUNDATIONS,"),'Site & foundation offers the foundations');
  ok(fields.includes('onChange={e=>update(selectPatch(key,typeof choices[0]===\'number\'?Number(e.target.value):e.target.value))}'),'Every select applies selectPatch');
  ok(history.includes('setData(prev=>pruneEdgeNames(deckReleaseData({...prev,...patch})))'),'The page\'s update is the patch through the release boundary with stale edge names dropped');
  ok(estimateHook.includes('const autoCounts={posts:estimate.model.railing.posts.length,stairs:estimate.model.treads.length,privacy:extras.privacyMounts.length};')&&estimateHook.includes('selectedItems:syncAutoLighting(prev,autoCounts)')&&estimateHook.includes('const designKey=estimateKeyOf(data);')&&estimateHook.includes('const estimateKey=designKey+'),'The page\'s light sync and estimate key are the ones measured here');
  for(const [name,src,section] of [['MaterialsStep',materials,'boards'],['StairsStep',stairs,'stairs'],['SiteExtrasStep',site,'part']] as const)ok(src.includes(`useOptionDeltas(${section==='part'?'part':`'${section}'`},data,deltas)`)&&src.includes('<DeltaToggle deltas={effect}/>'),`${name} shows its groups' price effect, with "Show price effect" where it is asked for`);
}

// 3. Wording: "+$1,240", "−$380", "no change", a quote never with a figure alone and never "$0".
{
  const B=(subtotal:number,quotes:string[]=[],lines:[string,number][]=[]):DeltaBase=>({key:'k',subtotal,quotes,lines:lines.map(([title,amount])=>({title,amount}))});
  const N=(subtotal:number,quotes:[string,'supplier'|'builder'][]=[],quotedLines:string[]=[]):Priced=>({subtotal,quotes:quotes.map(([label,kind])=>({label,kind})),quotedLines});
  const text=(b:DeltaBase,n:Priced)=>describeDelta(b,n).text;
  ok(text(B(30000),N(31240))==='+$1,240'&&text(B(30000),N(29620))==='−$380','A dearer option reads "+$1,240", a cheaper one "−$380" (a true minus)');
  ok(text(B(30000),N(30000.4))==='no change'&&describeDelta(B(30000),N(30000.4)).kind==='none','Under a dollar\'s move on the schedule is "no change"');
  ok(describeDelta(B(100.4),N(101.6)).amount===2&&text(B(100.4),N(101.6))==='+$2','The delta is what the schedule\'s whole-dollar subtotal moves by ($100 → $102)');
  ok(text(B(30000,[],[['Railing System',9535]]),N(20465,[['Rail X','supplier']],['Railing System']))==='supplier quote','A priced line turned into a quote reads "supplier quote", with no figure');
  ok(text(B(30000,[],[['Add-ons & Extras',500]]),N(30000,[['Deck skirting (builder quote)','builder']],['Deck skirting']))==='builder quote','A builder quote says so');
  ok(text(B(30000,[],[['Decking',9000]]),N(30904,[['Terrain connections','supplier']],['Terrain stair support connections']))==='+$904 + supplier quote','A quote added beside priced work shows both');
  ok(text(B(30000),N(30000,[['a','supplier'],['b','builder']]))==='supplier and builder quotes','Both kinds at once say so');
  ok(text(B(20160,['Voyage']),N(30000))==='+$9,840 · 1 fewer to quote'&&text(B(20160,['Voyage','Ties']),N(20160,[['Ties','supplier']]))==='no change · 1 fewer to quote','An option that leaves a quote off the list says so');
}

// 4. Over a set of designs, every option's delta is the difference of two engine runs made here.
const house=getHouseConfig(design({width:20}));
const unrated=DECKING_CATALOGUE.find(m=>m.costPerSqft===null&&!m.isHidden)!;
const designs:[string,Partial<DeckData>][]=[
  ['the default deck',{}],
  ['a large L-shape on two levels',{width:24,length:16,shape:'L-Shape',levels:2}],
  ['a wrap round both corners',{width:22,length:12,houseConfig:{...house,widthFt:26,depthFt:22},wrap:{left:{widthFt:8,runFt:8},right:{widthFt:6,runFt:6}}}],
  ['no stairs and no railing',{stairFlights:0,railingType:'None'}],
  [`${unrated.name} decking (a supplier quote)`,{deckingMaterial:unrated.id,deckingColor:unrated.colors[0].name}],
  ['a manufacturer railing (a supplier quote)',{catalogueRailingId:RAILING_CATALOGUE[0].id,railingType:RAILING_CATALOGUE[0].baseType}],
  ['post and step lights that follow the railing and stairs',{autoLighting:{posts:true,stairs:true}}],
  ['a Dark Slate border on a picture frame',{pattern:'Picture Frame',pictureFrameRows:1,borderFinish:'Dark Slate'}],
  ['stairs on an angled corner',{cornerChamfers:{frontLeftFt:6,frontRightFt:6},stairEdgeId:'main-chamfer-right',stairFlights:1,stairType:'Straight',height:36}],
  ['a floating deck on deck blocks with hidden fasteners',{deckType:'Floating',height:12,foundation:'Deck Blocks',fasteningSystem:'Hidden'}],
  ['a landing stair, glass railing and two flights',{stairType:'Landing',railingType:'Glass Panels',stairFlights:2}],
];
let options=0,flips=0,added=0,pruned=0,synced=0;
const seenTexts=new Set<string>();
for(const [label,patch] of designs){
  // The design as the page holds it (after its own light sync) and its live estimate.
  const {design:data,estimate:current}=settle(design(patch));
  ok(JSON.stringify(settle(data).design)===JSON.stringify(data),`${label}: the page's design is settled`);
  const base=baseOf(data,current);
  for(const section of ['boards','stairs','site'] as const)for(const group of optionGroups(section,data)){
    ok(group.choices.some(c=>c.value===group.current),`${label}: ${group.id} knows its current choice (${group.current})`);
    for(const choice of group.choices.filter(c=>c.value!==group.current)){
      const view=optionDelta(base,data,choice.patch),where=`${label}: ${group.id} → ${choice.label}`;
      // The other engine run: the design with the option picked, settled as the page would settle it.
      const pickedDesign=picked(data,choice.patch),next=settle(pickedDesign).estimate;
      if(JSON.stringify(settle(pickedDesign).design)!==JSON.stringify(pickedDesign))synced++;
      if(data.stairEdgeId&&!pickedDesign.stairEdgeId)pruned++;
      const amount=Math.round(next.subtotal)-Math.round(current.subtotal);
      ok(view.amount===amount,`${where}: the delta (${view.amount}) is the difference of two engine runs (${amount})`);
      const had=new Set(current.quoteRequired),adds=[...new Set(next.quoteRequired)].filter(q=>!had.has(q));
      const ledger=priceLedger(next),baseLines=priceLedger(current).lines;
      const flip=ledger.lines.some(l=>l.quotes.length&&l.amount<.005&&baseLines.some(b=>b.title===l.title&&b.amount>=.005));
      if(adds.length){
        added++;if(flip)flips++;
        const kinds=new Set(ledger.quotes.filter(q=>adds.includes(q.label)).map(q=>q.kind)),word=kinds.size>1?'supplier and builder quotes':`${[...kinds][0]} quote`;
        ok(view.kind==='quote'&&(flip||!amount?view.text===word:view.text===`${amount>0?'+':'−'}$${Math.abs(amount).toLocaleString('en-CA')} + ${word}`),`${where}: an option that adds ${adds.length} to quote says "${word}" (${view.text})`);
        if(flip)ok(!view.text.includes('$'),`${where}: a priced line turned into a quote shows no figure (${view.text})`);
      }else{
        ok(view.kind===(amount>0?'up':amount<0?'down':'none')&&/^([+−]\$[\d,]+|no change)( · \d+ fewer to quote)?$/.test(view.text),`${where}: priced, "+$", "−$" or "no change" (${view.text})`);
        if(amount)ok(view.text.startsWith(`${amount>0?'+':'−'}$${Math.abs(amount).toLocaleString('en-CA')}`),`${where}: the figure is the delta (${view.text})`);
      }
      ok(!ZERO.test(view.text),`${where}: never "$0" (${view.text})`);
      seenTexts.add(view.kind);options++;
    }
  }
}
ok(flips>=20&&added>flips,`Quote flips are covered (${flips} flips, ${added} options adding a quote)`);
ok(['up','down','none','quote'].every(k=>seenTexts.has(k)),'Every kind of wording is covered');
ok(pruned>0,`An option that drops a stale stair edge is covered (${pruned})`);
ok(synced>0,`An option the light sync follows is covered (${synced})`);

// 5. The cache: never another design's delta; a run prices one option per slice and stops when cancelled.
{
  clearDeltaCache();
  const a=settle(design()),b=settle(design({width:20}));
  const baseA=baseOf(a.design,a.estimate),baseB=baseOf(b.design,b.estimate);
  const groupsA=optionGroups('boards',a.design),groupsB=optionGroups('boards',b.design);
  const patches=(groups:OptionGroup[])=>groups.flatMap(g=>g.choices.filter(c=>c.value!==g.current).map(c=>c.patch));
  ok(baseA.key!==baseB.key&&patches(groupsA).every(p=>deltaKey(baseA,p)!==deltaKey(baseB,p)),'A delta is keyed by the design\'s estimate key and the option');
  // A run with a hand-driven schedule: each slice prices exactly one option.
  const pending:(()=>void)[]=[];let priced=0;
  const schedule=(work:()=>void)=>{pending.push(work);return ()=>{const i=pending.indexOf(work);if(i>=0)pending.splice(i,1);};};
  runOptionDeltas({base:baseA,data:a.design,groups:groupsA,onPriced:()=>priced++,schedule});
  ok(pending.length===1&&patches(groupsA).every(p=>cachedDelta(baseA,p)===undefined),'Nothing is priced before the first idle slice, and only one slice waits at a time');
  let slices=0;
  while(pending.length){pending.shift()!();slices++;ok(priced===slices&&patches(groupsA).filter(p=>cachedDelta(baseA,p)).length===slices,`Slice ${slices} prices exactly one option`);}
  ok(slices===patches(groupsA).length,`Every option but the current one is priced (${slices})`);
  // Design B: none of A's deltas answers for it, before or after it is priced.
  ok(patches(groupsB).every(p=>cachedDelta(baseB,p)===undefined),'After a design change the cache has nothing for the new design until it is priced');
  const stop=runOptionDeltas({base:baseB,data:b.design,groups:groupsB,onPriced:()=>priced++,schedule});
  pending.shift()!();pending.shift()!();
  stop();
  ok(pending.length===0,'Cancelling a run drops its waiting slice');
  const done=patches(groupsB).filter(p=>cachedDelta(baseB,p)).length;
  ok(done===2,`A cancelled run prices nothing more (${done} of ${patches(groupsB).length})`);
  runOptionDeltas({base:baseB,data:b.design,groups:groupsB,onPriced:()=>priced++,schedule});
  let rest=0;while(pending.length){pending.shift()!();rest++;}
  ok(rest===patches(groupsB).length-2,`A new run prices only what is not cached for this design (${rest})`);
  let differ=0;
  for(const p of patches(groupsB)){
    const cached=cachedDelta(baseB,p)!,fresh=Math.round(settle(picked(b.design,p)).estimate.subtotal)-Math.round(b.estimate.subtotal);
    ok(cached.amount===fresh,`The cached delta is design B's own (${cached.text})`);
    if(cachedDelta(baseA,p)?.text!==cached.text)differ++;
  }
  ok(differ>0,`Designs A and B have different deltas, so a stale one would show (${differ} differ)`);
  // An appearance-only change keeps the estimate key, so the design's deltas stay valid.
  const housed={...a.design,houseConfig:getHouseConfig(a.design)},dressed={...housed,houseConfig:{...housed.houseConfig,claddingColor:'#223344',trimColor:'#f0f0f0'},customerName:'Jane'};
  ok(estimateKeyOf(dressed)===estimateKeyOf(housed)&&estimateKeyOf({...housed,width:20})!==estimateKeyOf(housed),'A change in looks keeps the estimate key; a priced change does not');
  // A delta measured from a base other than the live estimate would not match: the base's own subtotal is used.
  ok(patches(groupsA).every(p=>cachedDelta({...baseA,subtotal:baseA.subtotal+100},p)!.amount===cachedDelta(baseA,p)!.amount-100||cachedDelta(baseA,p)!.kind==='quote'),'The delta is measured from the base it is given, never a remembered one');
}

// 5b. The worker's queue (optionDeltas.worker.ts): one option per task, jobs in order, a cancelled job prices nothing
// more, and its figures give the same delta as pricing on the page.
{
  clearDeltaCache();
  const a=settle(design()),b=settle(design({width:20,stairFlights:2}));
  const baseA=baseOf(a.design,a.estimate),baseB=baseOf(b.design,b.estimate);
  const items=(base:DeltaBase,groups:OptionGroup[])=>groups.flatMap(g=>g.choices.filter(c=>c.value!==g.current).map(c=>({key:deltaKey(base,c.patch),patch:c.patch})));
  const stairsA=items(baseA,optionGroups('stairs',a.design)),boardsB=items(baseB,optionGroups('boards',b.design));
  const tasks:(()=>void)[]=[],results:PricingResult[]=[];
  const receive=createPricingQueue(r=>results.push(r),step=>tasks.push(step));
  receive({job:1,data:a.design,items:stairsA});
  receive({job:2,data:b.design,items:boardsB});
  ok(tasks.length===1&&results.length===0,'Nothing is priced until the queue\'s first task, and one task waits at a time');
  tasks.shift()!();
  ok(results.length===1&&results[0].job===1&&results[0].key===stairsA[0].key&&tasks.length===1,'Each task prices exactly one option, the first job first');
  receive({cancel:1});
  while(tasks.length)tasks.shift()!();
  ok(results.filter(r=>r.job===1).length===1,'A cancelled job prices nothing more');
  ok(results.filter(r=>r.job===2).map(r=>r.key).join()===boardsB.map(i=>i.key).join(),`The next job prices every option it was given, in order (${boardsB.length})`);
  ok(results.every(r=>r.figures&&!('model' in r.figures)),'A result carries the figures the schedule reads, without the model (small to post)');
  for(const r of results)acceptPriced(r);
  for(const {key,patch} of boardsB){
    const fromWorker=cachedDelta(baseB,patch)!,onPage=describeDelta(baseB,summarize(priceOption(b.design,patch)));
    ok(fromWorker&&fromWorker.text===onPage.text&&fromWorker.amount===Math.round(settle(picked(b.design,patch)).estimate.subtotal)-Math.round(b.estimate.subtotal),`The worker's figures give the same delta as the page's own engine run (${key.slice(-30)}: ${fromWorker?.text})`);
  }
  ok(cachedDelta(baseA,stairsA[1].patch)===undefined&&cachedDelta(baseA,stairsA[0].patch)!==undefined,'Only what the worker priced is cached, under its own design');
  const figures=priceOption(a.design,stairsA[0].patch);
  ok(JSON.stringify(summarize(figures))===JSON.stringify(summarize({...settle(picked(a.design,stairsA[0].patch)).estimate})),'The figures summarise as the full estimate does');
}

// 6. The page's side: the base is the live estimate; desktops price at once, phones and Save-Data ask; nothing is saved.
{
  const page=read('src/pages/DeckDesigner.tsx'),hook=read('src/features/deckcraft/designer/useOptionDeltas.tsx'),persistence=read('src/features/deckcraft/designPersistence.ts');
  ok(page.includes('const deltas:DeltaProps={key:estimateKey,subtotal:estimate.subtotal,quotes:estimate.quoteRequired,lines:schedule.lines,shown:deltasShown,setShown:setDeltasShown};')&&page.includes('const schedule=useMemo(()=>priceLedger(estimate),[estimate]);'),'The deltas are measured from the live estimate, its schedule and its key');
  ok(page.includes('const [deltasShown,setDeltasShown]=useState(false);')&&!/deltasShown|optionDelta/i.test(persistence),'"Show price effect" is page state for the visit, never saved');
  ok(hook.includes("window.matchMedia?.('(min-width: 761px) and (pointer: fine)')")&&hook.includes('connection?.saveData)return false'),'A desktop prices options on its own; a phone or Save-Data asks first');
  ok(hook.includes('},[priced,props.key,section,store]);')&&hook.includes('return ()=>{cancelled=true;stop?.();};'),'A run is cancelled when the design (its estimate key) changes or the section closes');
  ok(/const loadOptionDeltas=\(\)=>import\('\.\/optionDeltas'\);/.test(hook)&&!/^import (?!type)[^\n]*'\.\/optionDeltas'/m.test(hook),'The engine side loads on demand, never with a section body');
  const deltas=read('src/features/deckcraft/designer/optionDeltas.ts'),workerSrc=read('src/features/deckcraft/designer/optionDeltas.worker.ts');
  ok(deltas.includes("new Worker(new URL('./optionDeltas.worker.ts',import.meta.url),{type:'module'})")&&deltas.includes('const pricing=schedule?null:pricingWorker();')&&deltas.includes('for(const run of running.values())run.onPage??=runOnPage(run,whenIdle);'),'The page prices in a worker, and on the page one option per idle slice where a worker cannot start');
  ok(workerSrc.includes("const receive=createPricingQueue(result=>scope.postMessage(result),step=>setTimeout(step,0));"),'The worker is the pricing queue, one option per task');
  ok(hook.includes('aria-hidden="true">{d?<DeltaText d={d}/>:\'…\'}</small>')&&hook.includes("const [figure,...note]=d.text.split(' · ');")&&read('src/features/deckcraft/designer/steps/MaterialsStep.tsx').includes('aria-describedby={delta?.id}'),'An option\'s delta is its accessible description, not part of its name');
}

// 7. What the page loads for the deltas never reaches three.js (or the 3D viewer).
{
  const seen=new Set<string>(),bare=new Set<string>();
  const resolveFrom=(from:string,spec:string)=>{const b=resolve(dirname(from),spec);return ['.ts','.tsx','/index.ts'].map(e=>b+e).concat(b).find(f=>/\.(ts|tsx)$/.test(f)&&existsSync(f))??null;};
  const walk=(file:string)=>{
    if(seen.has(file))return;seen.add(file);
    for(const m of readFileSync(file,'utf8').matchAll(/(?:^|\n)\s*(?:import|export)\s+(?!type\b)(?:[^'";]*?\bfrom\s*)?['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)){
      const spec=m[1]??m[2];
      if(spec.startsWith('.')){const next=resolveFrom(file,spec);if(next)walk(next);}else bare.add(spec);
    }
  };
  for(const f of ['optionDeltas.ts','optionGroups.ts','useOptionDeltas.tsx','selectPatch.ts'])walk(resolve(root,'src/features/deckcraft/designer',f));
  ok(seen.size>20,`The delta modules' import graph is read (${seen.size} files)`);
  ok(![...bare].some(s=>/^three\b|^@react-three\//.test(s))&&![...seen].some(f=>/viewer3d/.test(f)),`The option deltas never import three.js or the 3D viewer (${[...bare].join(', ')})`);
  // The worker is built on its own, without code splitting: the engine only, no page code, React or lazy imports.
  const workerSeen=new Set<string>(),workerBare=new Set<string>(),lazy:string[]=[];
  const walkWorker=(file:string)=>{
    if(workerSeen.has(file))return;workerSeen.add(file);
    const src=readFileSync(file,'utf8');
    for(const m of src.matchAll(/\bimport\(\s*['"]([^'"]+)['"]/g))lazy.push(m[1]);
    for(const m of src.matchAll(/(?:^|\n)\s*(?:import|export)\s+(?!type\b)(?:[^'";]*?\bfrom\s*)?['"]([^'"]+)['"]/g)){
      const spec=m[1];
      if(spec.startsWith('.')){const next=resolveFrom(file,spec);if(next)walkWorker(next);}else workerBare.add(spec);
    }
  };
  walkWorker(resolve(root,'src/features/deckcraft/designer/optionDeltas.worker.ts'));
  ok(workerSeen.size>20&&[...workerBare].every(s=>s==='clipper-lib')&&lazy.length===0,`The worker's graph is the engine alone: ${workerSeen.size} files, packages ${[...workerBare].join(', ')||'none'}, ${lazy.length} lazy imports`);
  ok(![...workerSeen].some(f=>/[\\/](designer[\\/](sections|priceLedgerModel|useChangeLedger|fields)|steps[\\/])/.test(f)),'The worker never reaches the sections, the ledger or any section body');
}

console.log(`DECK OPTION DELTAS OK — ${designs.length} designs, ${options} options: each delta the difference of two engine runs in whole dollars, ${flips} quote flips and ${added-flips} added quotes labelled, nothing at $0; cache keyed by design, one option per slice or worker task, cancel stops; the worker is the engine alone; no three.js; ${checks} checks.`);
