/**
 * Natural flagstone patios and walkways (NS2), laid the way Dan Preston lays them: large irregular stones cut to fit
 * with one even joint (1.5 in default), permeable chips in the joints and under the stone, 2 in stone on a 1 in chip
 * bed over the clear-stone base. Every line is quote required; nothing here adds a price. Designs without the
 * flagstone field are untouched (legacy parity, saved-design migration and the boulder golden guard that in lint).
 */
import '../src/features/deckcraft/yardModelAdvancedRuntime';
import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import type {DeckData,YardFeature} from '../src/features/deckcraft/types';
import {buildYardModel,needsAdvancedYard,yardArea,yardClip} from '../src/features/deckcraft/yardModel';
import {buildYardTakeoff} from '../src/features/deckcraft/yardTakeoff';
import {parseDesign,serializeDesign} from '../src/features/deckcraft/designPersistence';
import {DEFAULT_FLAGSTONE,FLAGSTONE_CHIPS,FLAGSTONE_PRODUCT_ID,FLAGSTONE_THICKNESS_IN,flagstoneSpec} from '../src/features/deckcraft/flagstone';
import {flagstoneLayout,flagstoneLocalOutline} from '../src/features/deckcraft/flagstoneLayout';
import {BOULDER_STONES} from '../src/features/deckcraft/boulderStones';
import {createDeckAgentController,type AgentResponse,type DeckAgentHostState} from '../src/features/deckcraft/designer/deckAgentController';
import {assistantPlanSchemaForContext,buildAssistantContext} from '../src/features/deckcraft/designer/assistantPlan';
import type {PlanPoint} from '../src/features/deckcraft/lib/deckGeometry';
import {hasAdvancedYard} from '../src/features/deckcraft/designExtensionPresence';
import {yardPreviewBoxes,MAX_DETAILED_PREVIEW_PAVERS} from '../src/features/deckcraft/components/viewer3d/yardPreview';
import {joinNewPatio} from '../src/features/deckcraft/pavingLook';

let checks=0;const ok=(value:unknown,message:string)=>{assert.ok(value,message);checks++;},eq=(a:unknown,b:unknown,message:string)=>{assert.deepEqual(a,b,message);checks++;};
const near=(a:number,b:number,tolerance:number,message:string)=>ok(Math.abs(a-b)<=tolerance,`${message} (${a} vs ${b})`);
const median=(v:number[])=>{const s=[...v].sort((a,b)=>a-b);return s[Math.floor(s.length/2)];};
const area=(p:PlanPoint[])=>Math.abs(p.reduce((n,v,i)=>{const q=p[(i+1)%p.length];return n+v.x*q.y-q.x*v.y;},0)/2);
function segDist(p:PlanPoint,a:PlanPoint,b:PlanPoint){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
const polyDist=(a:PlanPoint[],b:PlanPoint[])=>Math.min(...a.flatMap(p=>b.map((q,i)=>segDist(p,q,b[(i+1)%b.length]))),...b.flatMap(p=>a.map((q,i)=>segDist(p,q,a[(i+1)%a.length]))));
const patio=(over:Partial<YardFeature>={}):YardFeature=>({id:'flag-patio',kind:'patio',name:'Flagstone patio',enabled:true,xFt:8,zFt:26,widthFt:16,depthFt:12,heightIn:0,rotationDeg:0,productId:FLAGSTONE_PRODUCT_ID,color:BOULDER_STONES[0].colour,flagstone:{...DEFAULT_FLAGSTONE},...over});
const design=(...yardFeatures:YardFeature[]):DeckData=>({...structuredClone(DEFAULT_DECK),yardFeatures});

// 1. The saved spec: strict, defaults per the owner's rulings (1.5 in joints, black permeable chips, granite).
{
 eq(DEFAULT_FLAGSTONE,{stone:'granite',jointIn:1.5,jointColour:'black'},'Defaults: granite, 1.5 in joints, black chips');
 ok(FLAGSTONE_THICKNESS_IN===2,'Stone is nominally 2 in');
 eq(flagstoneSpec({stone:'limestone',jointIn:2,jointColour:'tan'}),{stone:'limestone',jointIn:2,jointColour:'tan'},'A valid spec is copied');
 for(const [label,bad] of [['an unknown stone',{...DEFAULT_FLAGSTONE,stone:'marble'}],['a joint under 1 in',{...DEFAULT_FLAGSTONE,jointIn:.5}],['a joint over 3 in',{...DEFAULT_FLAGSTONE,jointIn:3.5}],['an unknown chip colour',{...DEFAULT_FLAGSTONE,jointColour:'red'}],['an extra key',{...DEFAULT_FLAGSTONE,price:1}],['a stone in an array',{...DEFAULT_FLAGSTONE,stone:['granite']}],['chips in an array',{...DEFAULT_FLAGSTONE,jointColour:['tan']}],['a stone object that prints as granite',{...DEFAULT_FLAGSTONE,stone:{toString:()=>'granite'}}],['a non-object','granite'],['an empty array',[]],['an array of the spec',[DEFAULT_FLAGSTONE]]] as const)ok(flagstoneSpec(bad)===undefined,`Refuses ${label}`);
 const saved=serializeDesign(design(patio())),reopened=parseDesign(saved);
 eq(reopened.yardFeatures![0].flagstone,DEFAULT_FLAGSTONE,'A flagstone patio saves and reopens with its spec');
 eq(serializeDesign(reopened),saved,'…byte for byte');
 for(const [label,bad] of [['the flagstone product without a spec',patio({flagstone:undefined})],['a spec on a paver product',patio({productId:'permacon-melville'})],['a bad spec',patio({flagstone:{...DEFAULT_FLAGSTONE,jointIn:9}})]] as const)assert.throws(()=>parseDesign(serializeDesign(design(bad))),undefined,`Refuses ${label}`),checks++;
 ok(needsAdvancedYard(design(patio())),'Flagstone is laid by the advanced yard runtime');
 ok(hasAdvancedYard(JSON.parse(serializeDesign(design(patio())))),'A saved, linked or imported flagstone design loads that runtime before it is drawn');
}

// 2. The layout: large irregular stones cut to fit, one even joint, straight cuts at the edge, deterministic.
const outlines:[string,PlanPoint[]][]=[['16 × 12 ft rectangle',flagstoneLocalOutline(patio())[0]],['L-shaped patio',[{x:-120,y:-90},{x:120,y:-90},{x:120,y:0},{x:0,y:0},{x:0,y:90},{x:-120,y:90}]],['4 ft walkway with a bend',[{x:-200,y:-24},{x:40,y:-24},{x:120,y:60},{x:86,y:94},{x:20,y:24},{x:-200,y:24}]]];
for(const [name,outline] of outlines)for(const jointIn of [1.5,2.5]){
 const stones=flagstoneLayout([outline],'seed-a',jointIn),again=flagstoneLayout([outline],'seed-a',jointIn),other=flagstoneLayout([outline],'seed-b',jointIn);
 eq(stones,again,`${name}: the same patio lays the same stones`);ok(JSON.stringify(stones)!==JSON.stringify(other),`${name}: another patio lays different stones`);
 const areas=stones.map(s=>area(s.polygon)),total=areas.reduce((a,b)=>a+b,0),outlineArea=area(outline);
 ok(Math.min(...areas)>=72,`${name}: no stone under 0.5 sq ft (${Math.min(...areas).toFixed(0)} in²)`);
 ok(median(areas)>=360,`${name}: large slabs, median at least 2.5 sq ft (${(median(areas)/144).toFixed(2)})`);
 const mean=total/areas.length,cv=Math.sqrt(areas.reduce((n,a)=>n+(a-mean)**2,0)/areas.length)/mean;ok(cv>.2,`${name}: stone sizes vary (cv ${cv.toFixed(2)})`);
 ok(total/outlineArea>.8&&total/outlineArea<.97,`${name}: stones cover the patio less the joints (${(total/outlineArea).toFixed(3)})`);
 for(const s of stones)near(yardArea(yardClip([s.polygon],[outline],'intersection'))*144,area(s.polygon),.5,`${name}: stone ${s.id} lies inside the outline`);
 const sides=stones.map(s=>s.polygon.length);ok(median(sides)>=4&&median(sides)<=7,`${name}: stones are mostly 4- to 7-sided (median ${median(sides)})`);
 let tight=Infinity;for(const s of stones){let nearest=Infinity;for(const t of stones)if(t!==s){const d=polyDist(s.polygon,t.polygon);nearest=Math.min(nearest,d);tight=Math.min(tight,d);}ok(nearest<=jointIn+.05,`${name}: stone ${s.id} sits one joint from a neighbour (${nearest.toFixed(3)})`);}
 ok(tight>=jointIn-.05,`${name}: no two stones closer than the ${jointIn} in joint (${tight.toFixed(3)})`);
 const edgeStones=stones.filter(s=>s.polygon.some(p=>outline.some((q,i)=>segDist(p,q,outline[(i+1)%outline.length])<1e-3)));ok(edgeStones.length>=3,`${name}: edge stones are cut straight to the outline`);
}
// Size extremes: the smallest patios still get stones; the largest (60 × 60 ft) lays the same field twice.
{
 const rect=(w:number,d:number)=>[[{x:-w*6,y:-d*6},{x:w*6,y:-d*6},{x:w*6,y:d*6},{x:-w*6,y:d*6}]];
 ok(flagstoneLayout(rect(2,2),'tiny',1.5).length>=1&&flagstoneLayout(rect(3,8),'path',1.5).length>=3,'Small patios and narrow paths still get whole stones');
 const big=flagstoneLayout(rect(60,60),'estate',1.5);ok(big.length>400,`A 60 × 60 ft patio lays a full field (${big.length} stones)`);eq(big,flagstoneLayout(rect(60,60),'estate',1.5),'…the same every time');
}

// Concave outlines on many seeds: a stone pinched at a notch never leaves a sliver or a gap under one joint.
{
 const notch=[{x:-120,y:-90},{x:120,y:-90},{x:120,y:90},{x:24,y:90},{x:24,y:-42},{x:-24,y:-42},{x:-24,y:90},{x:-120,y:90}],acute=[{x:-120,y:-90},{x:120,y:-90},{x:120,y:90},{x:10,y:90},{x:0,y:-60},{x:-10,y:90},{x:-120,y:90}];
 for(const [name,outline] of [['4 ft notch',notch],['acute notch',acute]] as const)for(let seed=0;seed<8;seed++)for(const jointIn of [1,1.5,3]){
  const stones=flagstoneLayout([outline],'concave-'+seed,jointIn);ok(Math.min(...stones.map(s=>area(s.polygon)))>=72,`${name} seed ${seed}: no sliver at a ${jointIn} in joint`);
  let tight=Infinity;for(let i=0;i<stones.length;i++)for(let j=i+1;j<stones.length;j++)tight=Math.min(tight,polyDist(stones[i].polygon,stones[j].polygon));ok(tight>=jointIn-.05,`${name} seed ${seed}: stones stay a full ${jointIn} in joint apart (${tight.toFixed(3)})`);
 }
}

// 3. The yard model: each stone a 2 in slab of the chosen stone; chips bed it and fill the joints to 1/8 in below.
{
 const data=design(patio({flagstone:{stone:'limestone',jointIn:1.5,jointColour:'black'},color:BOULDER_STONES[1].colour})),model=buildYardModel(data),f=model.features[0];
 const stones=f.boxes.filter(b=>b.role==='paver'),bedding=f.boxes.filter(b=>b.role==='bedding'),top=f.topIn;
 ok(stones.length>10&&stones.every(b=>b.naturalStone&&b.unitId?.startsWith('flag-patio-flag-')&&Math.abs(b.h-2)<1e-9&&b.color===BOULDER_STONES[1].colour),'Every stone is a 2 in natural stone slab in the stone colour');
 ok(bedding.length>0&&bedding.every(b=>Math.abs(b.y+b.h/2-(top-1/8))<1e-9&&Math.abs(b.h-(1+2-1/8))<1e-9&&b.color===FLAGSTONE_CHIPS.black),'Chips bed the stone and fill the joints to 1/8 in below its top');
 const q=f.quantities,face=q.flagstoneFaceSqft,planArea=q.paverAreaSqft;
 ok(face>planArea*.8&&face<planArea*.97,'Stone face area is the patio less its joints');
 near(q.flagstoneTonnes,face*2/12*0.0283168466*2.69,1e-6,'Stone weight: face × 2 in × limestone density');
 near(q.jointChipYd3,(planArea-face)*(2-1/8)/324,1e-9,'Joint chips: joint area × filled depth');
 near(q.beddingYd3,planArea/324,1e-9,'Chip bed: 1 in over the patio');
 ok(f.warnings.every(w=>!/Paver module|Unknown paver/.test(w)),'No paver wording on a flagstone patio');
 const moved=buildYardModel(design(patio({xFt:11,zFt:30,rotationDeg:35,flagstone:{stone:'limestone',jointIn:1.5,jointColour:'black'}}))).features[0];
 eq(new Set(moved.boxes.filter(b=>b.role==='paver').map(b=>b.unitId)),new Set(stones.map(b=>b.unitId)),'Moving or turning the patio keeps the same stones');
 // A sloped patio is laid in its own plane: stones cover the sloped face as they do a level one.
 for(const pct of [20,30]){const sloped=buildYardModel(design(patio({widthFt:20,depthFt:20,finishedElevationIn:6,patioSlope:{xPct:0,zPct:pct}}))).features[0],level=buildYardModel(design(patio({widthFt:20,depthFt:20}))).features[0];near(sloped.quantities.flagstoneFaceSqft/sloped.quantities.surfaceAreaSqft,level.quantities.flagstoneFaceSqft/level.quantities.surfaceAreaSqft,.015,`A ${pct} % slope is covered like level ground`);}
 const scopes=f.assemblyQuoteScopes??[];
 eq(scopes.map(s=>[s.id,s.unit]),[['flag-patio-flagstone','sq ft'],['flag-patio-flagstone-weight','tonne'],['flag-patio-flagstone-joints','cu yd'],['flag-patio-flagstone-bed','cu yd'],['flag-patio-flagstone-base','cu yd']],'Flagstone lines: supply and setting, stone weight, joint chips, chip bed, clear base');
 ok(scopes.every(s=>s.amountCents===null),'Every flagstone line is quote required');
 ok(/Limestone/.test(scopes[0].label+scopes[0].note!)&&/1\.5 in/.test(scopes[0].note!)&&/black/i.test(scopes[2].note!),'Lines name the stone, the joint and the chip colour');
}

// Joining and the simplified preview: a patio drawn against a flagstone patio continues its stone; a very large paver
// layout elsewhere never lays a flat preview slab over the flagstone.
{
 const touching:YardFeature={...patio({id:'second',name:'Second',xFt:24,flagstone:undefined,productId:'permacon-melville',color:'#9a9488'})};
 const joined=joinNewPatio({yardFeatures:[patio()]},touching);ok(joined.productId===FLAGSTONE_PRODUCT_ID&&JSON.stringify(joined.flagstone)===JSON.stringify(DEFAULT_FLAGSTONE)&&joined.color===patio().color,'A patio drawn against flagstone continues the same flagstone');
 const huge:YardFeature={...patio({id:'big',name:'Big pavers',xFt:-40,zFt:60,widthFt:60,depthFt:60,flagstone:undefined,productId:'permacon-vendome',color:'#9a9488'})},model=buildYardModel(design(huge,patio()));
 ok(model.quantities.paverPieces>MAX_DETAILED_PREVIEW_PAVERS,'The mixed design is past the detailed-preview limit');
 const preview=yardPreviewBoxes(model).filter(b=>b.featureId==='flag-patio'&&b.role==='paver');ok(preview.length>10&&preview.every(b=>b.naturalStone),'Flagstone keeps its own stones in the simplified preview, with no slab over them');
}

// 4. The takeoff: no paver freight, no generic paver line, no price; a paver patio next to it prices as before.
{
 const paver:YardFeature={...patio({id:'pavers',name:'Paver patio',xFt:30,productId:'permacon-melville',color:'#9a9488'}),flagstone:undefined};
 const alone=buildYardTakeoff(design(paver)),both=buildYardTakeoff(design(paver,patio()));
 ok(!both.materials.some(m=>m.productId===FLAGSTONE_PRODUCT_ID),'Flagstone never enters the paver materials (or their freight)');
 ok(!both.sections.some(s=>s.id.startsWith('unknown-')&&!!s.featureIds?.includes('flag-patio')),'No generic paving line for flagstone');
 eq(both.materials,alone.materials,'The paver patio\'s materials are unchanged by a flagstone patio beside it');
 const flagLines=JSON.stringify(both).match(/"flag-patio-flagstone[^"]*"/g)??[];ok(flagLines.length>=5,'The flagstone lines reach the takeoff');
}

// 5. The agent API and the assistant carry the spec.
{
 let state:DeckAgentHostState={data:design(),view:'plan',openSections:[],canUndo:false,canRedo:false,ready:true};
 const api=createDeckAgentController({getState:()=>state,commitDesign:next=>{state={...state,data:next};},undo:()=>{},redo:()=>{},setView:()=>{},openSection:()=>{},waitForRender:async()=>{}});
 const r=await api.execute({id:'fs-1',commands:[{type:'design.patch',patch:{yardFeatures:[patio()]}}]}) as AgentResponse;
 ok(r.ok&&state.data.yardFeatures?.[0].flagstone?.jointColour==='black',`The agent can place a flagstone patio (${r.ok===false?r.error.message:''})`);
 const schema=JSON.stringify(assistantPlanSchemaForContext(buildAssistantContext(api.read())));ok(schema.includes('"flagstone"'),'The assistant schema knows the flagstone field');
}

console.log(`NATURAL FLAGSTONE OK — ${checks} checks: strict spec, irregular cut-to-fit stones with even joints, chips to 1/8 in, quote-only lines, no paver freight, agent and assistant fields.`);
