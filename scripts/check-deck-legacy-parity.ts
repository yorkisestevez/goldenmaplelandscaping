import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {copyFileSync,existsSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {calculateEstimate} from '../src/features/deckcraft/calculations';
import {getHardwareLayout} from '../src/features/deckcraft/hardwareLayout';
import {extrasLayout} from '../src/features/deckcraft/extrasLayout';
import {catalogueAccessoryLayout} from '../src/features/deckcraft/catalogueAccessories';
import {deckExportMeshes} from '../src/features/deckcraft/designExports';
import type {DeckData} from '../src/features/deckcraft/types';
import type {DeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {usesPhysicalElevations} from '../src/features/deckcraft/elevationDatum';
import {stairTargetId} from '../src/features/deckcraft/stairTargets';
import {LEGACY_DEFAULT_DECK,legacyBaseDeck,legacyScenarios} from './deck-legacy-scenarios';

// Existing designs must build, draw and price exactly as before while the house/wrap
// work refactors the geometry core. Run with --update only when a change is owner-approved.
// --report prints the price change per scenario (for the owner, before any --update) and writes nothing.
const GOLDEN=new URL('./deck-legacy-golden.json',import.meta.url);
const update=process.argv.includes('--update'),report=process.argv.includes('--report');

// The scenarios are saved designs, so they are built on the frozen 9b2ee11 default (no frame, no saved overhang, legacy
// build rules), never on the live default new designs start from.
const base=():DeckData=>legacyBaseDeck();
const scenarios=legacyScenarios();
// New designs (owner 2026-10-04/06): a one-row flush picture frame under the 2026-10 build rules. Any other change to the
// live default needs its own saved-design decision, so the frozen base may differ from it only in these three keys.
assert.equal(DEFAULT_DECK.pictureFrameRows,1);assert.equal(DEFAULT_DECK.pictureFrameOverhangIn,0);assert.equal(DEFAULT_DECK.buildRules,'2026-10-struct');
assert.ok(!('pictureFrameOverhangIn' in LEGACY_DEFAULT_DECK)&&!('buildRules' in LEGACY_DEFAULT_DECK)&&LEGACY_DEFAULT_DECK.pictureFrameRows===0,'The legacy base has no frame, no saved overhang and no build rules');
{const {pictureFrameRows:_rows,pictureFrameOverhangIn:_overhang,buildRules:_rules,...rest}=DEFAULT_DECK,{pictureFrameRows:_legacyRows,...legacy}=LEGACY_DEFAULT_DECK;assert.deepEqual(legacy,rest,'The live default differs from the frozen 9b2ee11 default only in the picture frame and build rules');}

// Rounded, -0-free JSON so identity-transform refactors do not trip on float noise.
const stable=(value:unknown)=>JSON.stringify(value,(_k,v)=>typeof v==='number'?(Object.is(v,-0)||Math.abs(v)<5e-7?0:Math.round(v*1e6)/1e6):v);
const digest=(value:unknown)=>createHash('sha256').update(stable(value)).digest('hex').slice(0,20);

const LEGACY_SITE_NOTE='Current crew/excavation floors applied once across all yard features. No separate mobilization fee. Top-up is not separately identifiable for mixed wall/site-condition allowances; coordinate shared operations with the deck scope.';
/** The recorded golden predates optional wall/site/landscape scaffolding. Verify
 * that scaffolding is exactly inert for legacy decks, then fingerprint every
 * pre-existing figure, quantity and geometry against the unchanged golden. */
function legacyPriced(estimate:ReturnType<typeof calculateEstimate>,data:DeckData){
 assert.ok(!data.yardFeatures?.length&&!data.siteModel&&!data.landscapeObjects?.length,'The legacy price projection covers deck-only designs');
 const {model:_model,flags:_flags,...priced}=estimate,copy=structuredClone(priced);
 const newQuantities=['geogridSqft','geogridOrderSqft','geogridPlanningSqft','geogridPlanningOrderSqft','wallFilterFabricSqft','siteEarthworkFillYd3','sharedExcavationYd3','deckFoundationExcavationYd3'] as const;
 for(const quantity of newQuantities)for(const record of [copy.yardModel.quantities,copy.yardTakeoff.quantities]){assert.equal(record[quantity],0,`New ${quantity} must remain zero on a legacy deck`);delete (record as Partial<typeof record>)[quantity];}
 const yard=copy.yardModel;for(const key of ['formationRegions','sharedExcavationRegions'] as const){assert.deepEqual(yard[key],[],`New ${key} must be empty on a legacy deck`);delete (yard as Partial<typeof yard>)[key];}for(const key of ['sharedExcavationYd3','deckFoundationExcavationYd3'] as const){assert.equal(yard[key],0);delete (yard as Partial<typeof yard>)[key];}assert.equal(yard.foundationExcavationPending,false);delete (yard as Partial<typeof yard>).foundationExcavationPending;
 const clearance=copy.yardModel.deckClearance;assert.equal(clearance.stairCoverageComplete,true);assert.equal(clearance.framingCoverageComplete,true);delete (clearance as Partial<typeof clearance>).stairCoverageComplete;delete (clearance as Partial<typeof clearance>).framingCoverageComplete;
 const takeoff=copy.yardTakeoff;assert.deepEqual(takeoff.landscape,{plantCount:0,boulderCount:0,furnitureCount:0,bedAreaSqft:0,mulchYd3:0,edgingLf:0,items:[],warnings:[]});delete (takeoff as Partial<typeof takeoff>).landscape;
 const soil=takeoff.earthwork;for(const key of ['bankYd3','reusedYd3','exportBankYd3','benchmarkBins','bins','pricedYardBins','yardBankYd3','deckFoundationBankYd3'] as const)assert.equal(soil[key],0);for(const key of ['looseSpoilYd3','spoilTonnes','volumeBins','payloadBins'] as const)assert.equal(soil[key],null);assert.deepEqual(soil.inputs,{});assert.equal(soil.haulingInputsComplete,false);delete (takeoff as Partial<typeof takeoff>).earthwork;
 assert.match(takeoff.sharedSiteWork.note,/once/i);assert.match(takeoff.sharedSiteWork.note,/mobilization/i);assert.match(takeoff.sharedSiteWork.note,/coordinate.*deck scope/i);takeoff.sharedSiteWork.note=LEGACY_SITE_NOTE;
 return copy;
}


/** Additive datums and selection identities are excluded only after validating
 * their exact relationship to unchanged legacy geometry. Original quantities,
 * coordinates, prices, exports, warnings and all prior fields stay protected. */
function legacyGeometry(model:DeckTakeoff,data:DeckData){
 assert.ok(!usesPhysicalElevations(data),'Physical elevation designs cannot use the legacy projection');
 const {issues:_issues,...geometry}=structuredClone(model),base=data.foundation==='Deck Blocks'?6.5:4.5,depth=data.foundation==='Deck Blocks'?0:data.foundationDepthIn??48,near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-7,`Derived legacy datum differs: ${a}/${b}`);
 const supports=geometry.levels.flatMap((l,li)=>l.supports.map((p,pi)=>({p,li,pi})));assert.equal(geometry.foundationSupports.length,supports.length);
 for(let i=0;i<supports.length;i++){
  const {p,li,pi}=supports[i],f=geometry.foundationSupports[i];assert.equal(f.id,`footing:${li}:${pi}`);assert.equal(f.levelIndex,li);assert.equal(f.supportIndex,pi);assert.equal(f.x,p.x);assert.equal(f.z,p.z);assert.equal(f.bearingElevationIn,p.y);assert.equal(f.foundation,data.foundation);assert.equal(f.depthIn,depth);assert.equal(f.gradeElevationIn,0);assert.equal(f.bottomElevationIn,-depth);assert.equal(f.headTopElevationIn,data.foundation==='Deck Blocks'?6:2);assert.equal(f.postBaseElevationIn,base);assert.equal(f.postHeightIn,Math.max(0,p.y-base));assert.equal(f.status,p.y<=base?'clearance-pending':'modeled');
 }
 const quantities=geometry.foundationQuantities;near(quantities.supportPostLf,supports.reduce((n,{p})=>n+Math.max(0,p.y-base)/12,0));near(quantities.concretePierYd3,data.foundation==='Concrete Piers'?supports.length*Math.PI*36*(depth+2)/46656:0);near(quantities.pileShaftLf,data.foundation==='Helical Piles'?supports.length*(depth+2)/12:0);assert.equal(quantities.foundationCoveragePending,0);assert.equal(quantities.foundationClearancePending,supports.filter(({p})=>p.y<=base).length);assert.equal(quantities.foundationSoilPending,data.soilCondition==='Unknown'?1:0);
 delete (geometry as Partial<typeof geometry>).foundationSupports;delete (geometry as Partial<typeof geometry>).foundationQuantities;
 for(const tread of geometry.treads){if(tread.flightId!==undefined){assert.ok(geometry.flights.some(f=>f.kind==='grade'&&stairTargetId(f.id)===tread.flightId),'New tread identity names an existing unchanged grade flight');delete (tread as Partial<typeof tread>).flightId;}}
 for(const flight of geometry.flights){if(flight.winderCenter!==undefined||flight.winderRadiusIn!==undefined){const c=flight.winderCenter!,r=flight.winderRadiusIn!;assert.ok(c&&Number.isFinite(r)&&r>0);assert.equal(flight.type,'Winder');assert.equal(flight.risers,2);near(r,12+flight.width/2);near(Math.hypot(flight.start.x-c.x,flight.start.z-c.y),r);near(Math.hypot(flight.end.x-c.x,flight.end.z-c.y),r);near((flight.start.x-c.x)*(flight.end.x-c.x)+(flight.start.z-c.y)*(flight.end.z-c.y),0);near(flight.start.y-flight.end.y,2*flight.rise);delete (flight as Partial<typeof flight>).winderCenter;delete (flight as Partial<typeof flight>).winderRadiusIn;}}
 return geometry;
}

function fingerprint(patch:Partial<DeckData>){
  const d:DeckData={...base(),...patch};
  try{
    const estimate=calculateEstimate(d),model=estimate.model;
    // Issues/flags are fingerprinted apart from geometry and price, so a new
    // "confirm before construction" warning can never mask a build or price change.
    const {model:_model,flags}=estimate,priced=legacyPriced(estimate,d),{issues}=model,geometry=legacyGeometry(model,d);
    return {
      model:digest(geometry),
      issues:digest(issues),
      flags:digest(flags),
      hardware:digest(getHardwareLayout(d,model)),
      // Only the new UI pick identity is excluded; every coordinate, dimension,
      // fixture, price and pre-existing metadata stays protected by the golden.
      extras:digest((()=>{const extras=extrasLayout(d,model),physical=(box:typeof extras.wood[number])=>{const {screenId:_pickIdentity,...rest}=box;return rest;};return {...extras,wood:extras.wood.map(physical),metal:extras.metal.map(physical)};})()),
      catalogue:digest(catalogueAccessoryLayout(d,model)),
      exports:digest(deckExportMeshes(d,model).map(m=>[m.name,m.vertices,m.faces])),
      estimate:digest(priced),
      total:Math.round(estimate.total*100)/100,
    };
  }catch(error){return {throws:error instanceof Error?error.message:String(error)};}
}

const current=Object.fromEntries(Object.entries(scenarios).map(([name,patch])=>[name,fingerprint(patch)]));
// A reviewed warning correction may never conceal a quantity, drawing or price change.
if(process.argv.includes('--accept-reviewed-wording')){
  if(update||report||process.argv.includes('--accept-pricing')||process.argv.includes('--accept-reviewed-drawings'))throw new Error('Wording review must be separate');
  const previous=JSON.parse(readFileSync(GOLDEN,'utf8')) as Record<string,Record<string,unknown>>;
  if(Object.keys(previous).sort().join('|')!==Object.keys(current).sort().join('|'))throw new Error('Wording scenario sets differ');
  for(const [name,value] of Object.entries(current)){
    const next=value as Record<string,unknown>,old=previous[name];
    if('throws' in next||typeof next.flags!=='string')throw new Error(`Invalid wording scenario: ${name}`);
    for(const field of new Set([...Object.keys(old),...Object.keys(next)]))if(field!=='flags'&&stable(old[field])!==stable(next[field]))throw new Error(`Wording acceptance would change ${name}/${field}`);
  }
  const i=process.argv.indexOf('--wording-backup'),path=i>=0?process.argv[i+1]:undefined;
  if(!path||path.startsWith('--')||existsSync(resolve(path)))throw new Error('A new separate --wording-backup is required');
  copyFileSync(GOLDEN,resolve(path));
  const accepted=Object.fromEntries(Object.entries(current).map(([name,next])=>[name,{...previous[name],flags:next.flags}]));
  writeFileSync(GOLDEN,JSON.stringify(accepted,null,1)+'\n');
  console.log('Accepted reviewed wording only; every price, quantity and drawing fingerprint verified unchanged; previous golden backed up.');process.exit(0);
}
// Accept a reviewed drawing correction only with independent old-source reconstruction
// evidence. This mode never changes quantities, hardware, catalogue, issues or prices.
// --review-evidence points to the recorded old/current six drawing fingerprints;
// --drawing-backup is a new file for the exact pre-accept golden. Verification writes nothing.
if(process.argv.includes('--accept-reviewed-drawings')||process.argv.includes('--verify-reviewed-drawings')){
  if(update||report||process.argv.includes('--accept-pricing'))throw new Error('Drawing review cannot be combined with another acceptance mode');
  const arg=(name:string)=>{const i=process.argv.indexOf(name),value=i<0?undefined:process.argv[i+1];if(!value||value.startsWith('--'))throw new Error(`Required ${name} path`);return resolve(value);};
  const evidence=JSON.parse(readFileSync(arg('--review-evidence'),'utf8')) as {version:number;sourceReference:string;reconstructedBefore:Record<string,Record<string,unknown>>;reviewedCurrent:Record<string,Record<string,unknown>>};
  const initialReview=evidence.version===1&&evidence.sourceReference==='5f2aa9ef2037695455d22131fc887f07d4f7a67a';
  const windowOnlyReview=evidence.version===2&&evidence.sourceReference==='accepted-window-source:75db6c6dcf7d0362224ff944b8ab3878363ce22607cf89d9232a18de42633fcc';
  if(!initialReview&&!windowOnlyReview)throw new Error('Unrecognized drawing reconstruction evidence');
  const previous=JSON.parse(readFileSync(GOLDEN,'utf8')) as Record<string,Record<string,unknown>>;
  const fields=['model','issues','hardware','extras','catalogue','exports'] as const,protectedFields=['model','issues','hardware','catalogue'] as const;
  const names=Object.keys(current).sort();
  if(names.length!==213)throw new Error('The reviewed evidence covers exactly 213 legacy scenarios');
  for(const table of [previous,evidence.reconstructedBefore,evidence.reviewedCurrent])if(Object.keys(table).sort().join('\n')!==names.join('\n'))throw new Error('Drawing review scenario sets differ');
  for(const name of names){
    const old=previous[name],next=current[name] as Record<string,unknown>,before=evidence.reconstructedBefore[name],reviewed=evidence.reviewedCurrent[name];
    if('throws' in next)throw new Error(`Cannot accept drawings for ${name}`);
    for(const field of fields){
      if(typeof before[field]!=='string'||before[field]!==old[field])throw new Error(`Old-source reconstruction differs: ${name}/${field}`);
      if(typeof reviewed[field]!=='string'||reviewed[field]!==next[field])throw new Error(`Review evidence is stale: ${name}/${field}`);
    }
    for(const field of protectedFields)if(old[field]!==next[field])throw new Error(`Protected drawing field changed: ${name}/${field}`);
    if(windowOnlyReview){
      if(old.extras!==next.extras)throw new Error(`Window-only review changed fixtures: ${name}`);
      for(const field of ['estimate','total'])if(before[field]!==old[field]||reviewed[field]!==next[field]||old[field]!==next[field])throw new Error(`Window-only review changed pricing: ${name}/${field}`);
    }
  }
  if(process.argv.includes('--verify-reviewed-drawings')){console.log('DRAWING REVIEW VERIFIED — all 213 old-source snapshots reconstructed; current evidence matches and model/issues/hardware/catalogue are unchanged. Nothing written.');process.exit(0);}
  const backup=arg('--drawing-backup');
  if(backup===resolve(fileURLToPath(GOLDEN))||existsSync(backup))throw new Error('Drawing backup must be a new, separate file');
  copyFileSync(GOLDEN,backup);
  const accepted=Object.fromEntries(names.map(name=>{const next=current[name] as Record<string,unknown>;return [name,{...previous[name],extras:next.extras,exports:next.exports}];}));
  writeFileSync(GOLDEN,JSON.stringify(accepted,null,1)+'\n');
  console.log('Accepted reviewed extras and exports only for 213 scenarios; pre-accept golden backed up and all approved pricing fields preserved.');process.exit(0);
}
// Owner-authorized price-book revisions may accept price/wording fingerprints only.
// Every geometry, hardware and export baseline stays intact, including the known
// step-light drawing difference; this never approves or hides a visual change.
if(process.argv.includes('--accept-pricing')){
  const previous=JSON.parse(readFileSync(GOLDEN,'utf8')) as Record<string,Record<string,unknown>>;
  const accepted=Object.fromEntries(Object.entries(current).map(([name,next])=>{
    const old=previous[name];if(!old||'throws' in next)throw new Error(`Cannot accept pricing for ${name}`);
    return [name,{...old,flags:next.flags,estimate:next.estimate,total:next.total}];
  }));
  writeFileSync(GOLDEN,JSON.stringify(accepted,null,1)+'\n');
  console.log('Accepted pricing and review wording only; drawing baselines preserved.');
  process.exit(0);
}
if(!report&&(update||!existsSync(GOLDEN))){
  writeFileSync(GOLDEN,JSON.stringify(current,null,1)+'\n');
  console.log(`Legacy parity golden written: ${Object.keys(current).length} scenarios.`);
}else{
  const golden=JSON.parse(readFileSync(GOLDEN,'utf8')) as Record<string,unknown>;
  if(report){
    const money=(n:number)=>`${n<0?'-':''}$${Math.abs(n).toLocaleString('en-CA',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
    const totalOf=(v:unknown)=>typeof (v as {total?:unknown})?.total==='number'?(v as {total:number}).total:null;
    const rows=Object.keys(current).map(name=>({name,before:totalOf(golden[name]),after:totalOf(current[name])})).filter(r=>r.before!==r.after);
    for(const r of rows){
      const delta=r.before!==null&&r.after!==null?r.after-r.before:null;
      console.log(`${r.name}: ${r.before===null?'(new)':money(r.before)} -> ${r.after===null?'(no price)':money(r.after)}${delta===null?'':`  ${delta>=0?'+':''}${money(delta)} (${(delta/r.before!*100).toFixed(1)}%)`}`);
    }
    const deltas=rows.filter(r=>r.before!==null&&r.after!==null).map(r=>(r.after!-r.before!)/r.before!*100);
    const other=Object.keys(current).filter(name=>totalOf(golden[name])===totalOf(current[name])&&stable(golden[name])!==stable(current[name])).length;
    console.log(`PRICE REPORT — ${rows.length} of ${Object.keys(current).length} scenarios change price${deltas.length?` (from ${Math.min(...deltas).toFixed(1)}% to ${Math.max(...deltas).toFixed(1)}%)`:''}; ${other} more change in drawings, hardware or wording only. The golden was not written.`);
    process.exit(0);
  }
  const drift=Object.keys({...golden,...current}).filter(name=>stable(golden[name])!==stable(current[name]));
  if(drift.length){
    const parts=(name:string)=>{const g=(golden[name]??{}) as Record<string,unknown>,c=(current[name]??{}) as Record<string,unknown>;return Object.keys({...g,...c}).filter(k=>stable(g[k])!==stable(c[k]));};
    const byParts=new Map<string,string[]>();for(const name of drift){const key=parts(name).join('+')||'(missing)';byParts.set(key,[...(byParts.get(key)??[]),name]);}
    for(const [key,names] of byParts)console.error(`DRIFT in ${key}: ${names.length} scenario(s), e.g. ${names.slice(0,4).join(', ')}`);
    console.error(`${drift.length} of ${Object.keys(current).length} legacy scenarios changed. Existing designs must build and price exactly as before.`);
    process.exit(1);
  }
  console.log(`LEGACY PARITY OK — ${Object.keys(current).length} existing-design scenarios build, draw, export and price exactly as before.`);
}
