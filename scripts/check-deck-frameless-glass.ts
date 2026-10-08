import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DEFAULT_DECK,DECK_SETTINGS} from '../src/features/deckcraft/defaults';
import {calculateEstimate} from '../src/features/deckcraft/calculations';
import {deckExportMeshes} from '../src/features/deckcraft/designExports';
import {guardRuns} from '../src/features/deckcraft/deckTakeoff';
import {getHouseContact} from '../src/features/deckcraft/houseContact';
import {parseDesign,serializeDesign,validateDesign} from '../src/features/deckcraft/designPersistence';
import {describeDesign} from '../src/features/deckcraft/designFacts';
import {designFeatures} from '../src/features/deckcraft/deckAnalytics';
import {syncAutoLighting} from '../src/features/deckcraft/lightingSystem';
import {unconfirmedRates} from '../src/features/deckcraft/rateConfidence';
import {proposalFinishes} from '../src/features/deckcraft/proposalModel';
import {finishedFasciaOffset} from '../src/features/deckcraft/lib/finishedFootprint';
import {RAILING_STYLES,optionGroups} from '../src/features/deckcraft/designer/optionGroups';
import {GLASS,GLASS_MOUNTS,HANDRAIL,SHOE,type FramelessGlassLayout} from '../src/features/deckcraft/framelessGlass';
import {RAILING_COSTS,type DeckData,type GlassMount} from '../src/features/deckcraft/types';

/**
 * Frameless glass railing (framelessGlass.ts): glass panels in a top-mount shoe, a fascia-mount shoe or on spigots,
 * with no posts or top rail, and a handrail on the stair glass. It stands on the same guard runs as every other railing,
 * its glass and hardware are a supplier quote (never $0), and its installation labour is exactly the Glass Panels
 * labour (20 ft per crew-day and the ×1.40 on the job, owner decision 2026-09-25). No existing design changes.
 */
let checks=0;const ok=(value:unknown,message:string)=>{assert(value,message);checks++;};
const near=(a:number,b:number,eps=.01)=>Math.abs(a-b)<=eps;
const base=():DeckData=>structuredClone(DEFAULT_DECK);
const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const estimate=(d:DeckData)=>calculateEstimate(d,DECK_SETTINGS);
const section=(e:ReturnType<typeof estimate>,title:string)=>e.sections.find(s=>s.title===title);
const labour=(e:ReturnType<typeof estimate>)=>section(e,'Labour (Construction & Build)')!.total;

// 1. Nothing changes for a design that doesn't choose it.
{
  const d=base(),e=estimate(d);
  ok(e.model.railing.frameless===undefined&&!('frameless' in e.model.railing),'A framed railing carries no frameless layout (the takeoff fingerprint is unchanged)');
  ok(!/glass/i.test(serializeDesign(d)),'A design without frameless glass saves no glass fields');
  ok(!Object.keys(RAILING_COSTS).includes('Frameless Glass'),'Frameless glass has no rate in RAILING_COSTS');
  ok(!deckExportMeshes(d,e.model).some(m=>/^glass_(base_shoe|spigot|handrail)/.test(m.name)),'No frameless export parts on a framed railing');
}

// 2. Layout invariants over shapes, heights, stairs and every mount.
const designs:[string,Partial<DeckData>][]=[
  ['default 16 × 12 at 36 in',{}],
  ['tall 84 in (42 in guard) with a landing stair',{height:84,stairType:'Landing'}],
  ['winder stair at 60 in',{height:60,stairType:'Winder'}],
  ['L-shape freestanding',{shape:'L-Shape',cutoutWidth:6,cutoutLength:4,deckType:'Freestanding'}],
  ['two levels',{levels:2,width2:12,length2:10,height2:12}],
  ['picture frame, two stair flights',{pattern:'Picture Frame',pictureFrameRows:1,stairFlights:2}],
  ['wide 30 × 14 with a 96 in stair',{width:30,length:14,stairWidth:96}],
];
const surfaceAt=(layout:FramelessGlassLayout,run:number,p:{x:number;z:number})=>{
  const r=layout.runs[run],t=((p.x-r.a.x)*r.u.x+(p.z-r.a.z)*r.u.y)/r.planLength;return r.a.y+(r.b.y-r.a.y)*t;
};
let layouts=0,panelsSeen=0;
for(const [label,patch] of designs)for(const glassMount of GLASS_MOUNTS){
  const d:DeckData={...base(),...patch,railingType:'Frameless Glass',glassMount},e=estimate(d),g=e.model.railing.frameless!,name=`${label}, ${glassMount}`;
  ok(g&&g.mount===glassMount,`${name}: the layout is built with its mount`);
  ok(!e.model.railing.posts.length&&!e.model.railing.rails.length&&!e.model.railing.balusters.length,`${name}: no posts, rails or balusters`);
  ok(e.model.quantities.railingPosts===0&&e.model.quantities.railingSections===0,`${name}: no posts or sections in the quantities`);
  ok(e.model.railing.glass.length===g.panels.length,`${name}: every panel is a glass member (exports and the plan read them)`);
  ok(g.runs.length>0&&g.panels.length>0,`${name}: the guard runs carry glass`);
  const contact=getHouseContact(d,e.model.levels[0].footprint),framed=calculateEstimate({...d,railingType:'Aluminum'},DECK_SETTINGS).model;
  ok(!guardRuns(e.model).some(r=>contact.onContact({x:r.a.x,y:r.a.z},{x:r.b.x,y:r.b.z})),`${name}: no glass along the ledger`);
  ok(near(g.runs.reduce((n,r)=>n+Math.hypot(r.b.x-r.a.x,r.b.y-r.a.y,r.b.z-r.a.z),0)/12,e.model.quantities.railingLf)&&near(e.model.quantities.railingLf,framed.quantities.railingLf),`${name}: the glass stands on the same guard runs (and length) as a framed railing`);
  const railHeight=d.height>71?42:36;ok(g.height===railHeight,`${name}: the guard is ${railHeight} in`);
  for(const [i,r] of g.runs.entries()){
    const panels=g.panels.filter(p=>p.run===i);
    ok(panels.length>0,`${name}: run ${i} has glass`);
    for(const p of panels){
      ok(p.width<=GLASS.maxPanel+1e-6&&p.width>0,`${name}: a panel is at most ${GLASS.maxPanel} in (${p.width.toFixed(2)})`);
      for(const end of [p.a,p.b]){
        const surface=surfaceAt(g,i,end),top=end.y+p.height,bottom=end.y-surface;
        ok(near(top,surface+railHeight,.02),`${name}: the glass top is the guard height above the walking surface`);
        const want=r.sloped?(glassMount==='Spigots'?-4:-1-SHOE.embed):glassMount==='Fascia-mount base shoe'?-1-SHOE.embed:glassMount==='Spigots'?2:SHOE.h-SHOE.embed;
        ok(near(bottom,want,.02),`${name}: the glass bottom sits ${want} in from the surface (${bottom.toFixed(2)})`);
      }
      // Across the run: fascia glass stands outside the rim face, top-mount and spigot glass inside the deck edge.
      const mid={x:(p.a.x+p.b.x)/2,z:(p.a.z+p.b.z)/2},across=(mid.x-r.a.x)*r.out.x+(mid.z-r.a.z)*r.out.y;
      if(r.sloped)ok(across>0,`${name}: stair glass stands outside the stringer`);
      else if(glassMount==='Fascia-mount base shoe')ok(near(across,finishedFasciaOffset(d)+SHOE.w/2)&&across-GLASS.thick/2>.75,`${name}: fascia glass is outside the rim face`);
      else ok(across<0,`${name}: ${glassMount.toLowerCase()} glass is inside the deck edge`);
      panelsSeen++;
    }
    // Consecutive panels on a run are 0.5 in apart.
    for(let k=1;k<panels.length;k++){const gap=Math.hypot(panels[k].a.x-panels[k-1].b.x,panels[k].a.z-panels[k-1].b.z);ok(near(gap,GLASS.gap,.02),`${name}: panels are ${GLASS.gap} in apart (${gap.toFixed(3)})`);}
  }
  ok(glassMount==='Spigots'?g.spigots.length===2*g.panels.length&&!g.shoes.length:!g.spigots.length&&g.shoes.length===g.runs.length,`${name}: 2 spigots a panel, or one shoe a run`);
  ok(g.shoes.every(s=>s.fascia===(s.raked||glassMount==='Fascia-mount base shoe')),`${name}: a shoe is on the fascia for a fascia mount and on every stair`);
  const sloped=g.runs.filter(r=>r.sloped).length;
  ok(g.handrails.length===sloped&&g.handrails.every(h=>g.runs[h.run].sloped),`${name}: a handrail on every stair run and nowhere else`);
  for(const h of g.handrails){
    const brackets=g.brackets.filter(b=>b.run===h.run);ok(brackets.length>=2,`${name}: at least 2 brackets on each handrail`);
    for(const b of brackets)ok(near(b.at.y-surfaceAt(g,h.run,b.at),HANDRAIL.heightIn,.02),`${name}: the handrail is ${HANDRAIL.heightIn} in above the nosings`);
  }
  ok(near(g.quantities.glassSqft,g.panels.reduce((n,p)=>n+p.width*p.height/144,0))&&g.quantities.panels===g.panels.length&&g.quantities.panelSizes.reduce((n,s)=>n+s.count,0)===g.panels.length,`${name}: glass quantities add up`);
  layouts++;
}

// 3. Price: a supplier quote for the glass and hardware; labour exactly on the Glass Panels basis.
for(const [label,patch] of designs)for(const glassMount of GLASS_MOUNTS){
  const d:DeckData={...base(),...patch,railingType:'Frameless Glass',glassMount},e=estimate(d),glass=estimate({...base(),...patch,railingType:'Glass Panels'}),name=`${label}, ${glassMount}`;
  const rail=section(e,'Railing System')!;
  ok(rail.quoteRequired&&rail.total===0&&rail.items.length>0&&rail.items.every(i=>i.cost===null),`${name}: the railing section is a supplier quote with no $0 lines`);
  ok(e.quoteRequired.some(q=>/^Frameless glass railing .*\(supplier quote\)$/.test(q)),`${name}: the quote list names the frameless glass`);
  ok(near(labour(e),labour(glass)),`${name}: installation labour equals the Glass Panels labour (${labour(e).toFixed(2)} vs ${labour(glass).toFixed(2)})`);
  // Frameless has no posts, so Home Depot DTT2Z railing-post anchors drop from Hardware with the posts.
  const postAnchors=(est:typeof e)=>est.connectorSchedule.find(r=>r.name==='Railing post anchors/bolts'),glassAnchors=postAnchors(glass),markup=1+(d.materialMarkup??35)/100;
  const anchorDrop=glassAnchors&&glassAnchors.rate!==null?glassAnchors.qty*glassAnchors.rate*markup:0;
  ok(near(e.subtotal,glass.subtotal-section(glass,'Railing System')!.total-anchorDrop),`${name}: only the railing materials and priced post-anchor hardware leave the priced total`);
  const items=rail.items.map(i=>i.name);
  ok(items.includes('Frameless glass panels')&&items.includes(glassMount==='Spigots'?'Glass spigots':glassMount)&&items.includes('Glass-mounted handrail')===e.model.railing.frameless!.handrails.length>0,`${name}: panels, ${glassMount.toLowerCase()} and the stair handrail are listed`);
  ok(!e.flags.some(f=>f.includes('baluster spacing')),`${name}: no baluster note on glass`);
  ok(e.flags.some(f=>f.includes('engineered load rating'))&&e.flags.some(f=>f.includes('laminated glass or a top cap rail')),`${name}: the glass and load-rating review notes`);
  ok(e.flags.some(f=>f.startsWith('Fascia-mounted glass: add solid blocking'))===(glassMount==='Fascia-mount base shoe'),`${name}: the blocking note only on a fascia mount`);
  ok(e.flags.some(f=>f.startsWith('Stairs with frameless glass'))===(e.model.railing.frameless!.handrails.length>0),`${name}: the handrail note only with stairs`);
}
{
  // A picture-frame overhang that would reach fascia-mounted glass is flagged. 1.5 in is the production standard (and
  // what a saved design without an overhang reopens with); new designs default to a flush frame.
  const framed=estimate({...base(),pattern:'Picture Frame',pictureFrameRows:1,pictureFrameOverhangIn:1.5,railingType:'Frameless Glass',glassMount:'Fascia-mount base shoe'});
  ok(framed.flags.some(f=>f.startsWith('Fascia-mounted glass: the picture-frame boards overhang')),'A 1.5 in picture-frame overhang against fascia glass is flagged');
  const trimmed=estimate({...base(),pattern:'Picture Frame',pictureFrameRows:1,pictureFrameOverhangIn:.5,railingType:'Frameless Glass',glassMount:'Fascia-mount base shoe'});
  ok(!trimmed.flags.some(f=>f.startsWith('Fascia-mounted glass: the picture-frame boards overhang')),'A 0.5 in overhang clears fascia glass');
  const flush=estimate({...base(),railingType:'Frameless Glass',glassMount:'Fascia-mount base shoe'});
  ok(base().pictureFrameRows>0&&base().pictureFrameOverhangIn===0&&flush.model&&!flush.flags.some(f=>f.startsWith('Fascia-mounted glass: the picture-frame boards overhang')),'The default flush (0 in) picture frame clears fascia glass');
}

// 4. No posts, so no post-cap lights.
{
  const d:DeckData={...base(),railingType:'Frameless Glass',autoLighting:{posts:true}},e=estimate(d);
  ok(!syncAutoLighting(d,{posts:e.model.railing.posts.length,stairs:e.model.treads.length,privacy:0}).some(i=>i.zone==='posts'),'Frameless glass takes no automatic post-cap lights');
  ok(/a frameless glass railing has no posts/.test(read('src/features/deckcraft/designer/SimpleLighting.tsx')),'The post-light checkbox says why it is off');
}

// 5. Saving, sharing and pruning.
{
  const d:DeckData={...base(),railingType:'Frameless Glass',glassMount:'Spigots',glassFinish:'Silver'};
  const back=parseDesign(serializeDesign(d));
  ok(back.railingType==='Frameless Glass'&&back.glassMount==='Spigots'&&back.glassFinish==='Silver','A frameless design round-trips with its mount and finish');
  assert.throws(()=>validateDesign({...d,glassMount:'Clamps' as GlassMount}),/glassMount/);checks++;
  assert.throws(()=>validateDesign({...d,glassFinish:'Gold' as never}),/glassFinish/);checks++;
  const pruned=validateDesign({...d,railingType:'Aluminum'});
  ok(pruned.glassMount===undefined&&pruned.glassFinish===undefined,'Another railing drops the glass mount and finish');
  const plain=validateDesign(base());ok(plain.glassMount===undefined&&plain.glassFinish===undefined,'The default design has no glass fields');
}

// 6. Everywhere it is named: plan, exports, facts, proposal, analytics, option list, rate list.
{
  const d:DeckData={...base(),railingType:'Frameless Glass',glassMount:'Top-mount base shoe'},e=estimate(d);
  const names=deckExportMeshes(d,e.model).map(m=>m.name);
  for(const part of ['glass_panel','glass_base_shoe','glass_handrail','glass_handrail_bracket'])ok(names.some(n=>n.startsWith(part)),`The export carries ${part}`);
  const spig={...d,glassMount:'Spigots' as const};ok(deckExportMeshes(spig,estimate(spig).model).some(m=>m.name.startsWith('glass_spigot')),'The export carries glass_spigot');
  ok(/aria-label=\{`Frameless glass railing · \$\{model\.railing\.frameless\.mount\}`\}/.test(read('src/features/deckcraft/ConstructionPlan.tsx')),'The plan draws the frameless glass with its mount');
  const facts=describeDesign(d,e);
  ok(facts.facts.some(f=>/^Frameless glass: \d+ panels in a top-mount base shoe, black powder coat, with a handrail on the stair glass \(supplier quote\)$/.test(f)),`The design facts describe the glass (${facts.facts.find(f=>f.startsWith('Frameless'))})`);
  ok(proposalFinishes(d,e.model).some(t=>t.key==='glass-hardware'&&t.uses.includes('Glass base shoe')),'The proposal shows the glass hardware finish');
  ok(designFeatures(d).includes('deck_frameless_glass'),'Analytics counts frameless glass');
  ok(RAILING_STYLES.indexOf('Frameless Glass')===RAILING_STYLES.indexOf('Glass Panels')+1,'Frameless glass follows Glass Panels in the railing list');
  ok(optionGroups('stairs',d).find(g=>g.id==='railingType')!.choices.some(c=>c.value==='Frameless Glass'),'The railing option group offers it (so its price effect shows)');
  ok(unconfirmedRates().some(r=>r.id==='frameless-glass'&&r.status==='owner-decision'),'The rate list records the frameless glass decision');
  const stairs=read('src/features/deckcraft/designer/steps/StairsStep.tsx');
  ok(stairs.includes('aria-label="Glass railing mount"')&&stairs.includes('aria-label="Glass hardware finish"'),'The Stairs section offers the mount and finish');
  ok(/"check:deck":[^\n]*check-deck-frameless-glass\.ts/.test(read('package.json')),'This check runs in check:deck');
}

console.log(`DECK FRAMELESS GLASS OK — ${layouts} layouts (${panelsSeen} panels) over ${designs.length} designs × ${GLASS_MOUNTS.length} mounts, quotes and labour, lights, saving, naming — ${checks} checks`);
