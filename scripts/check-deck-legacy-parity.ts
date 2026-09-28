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
import {legacyScenarios} from './deck-legacy-scenarios';

// Existing designs must build, draw and price exactly as before while the house/wrap
// work refactors the geometry core. Run with --update only when a change is owner-approved.
// --report prints the price change per scenario (for the owner, before any --update) and writes nothing.
const GOLDEN=new URL('./deck-legacy-golden.json',import.meta.url);
const update=process.argv.includes('--update'),report=process.argv.includes('--report');

const base=():DeckData=>structuredClone(DEFAULT_DECK);
const scenarios=legacyScenarios();

// Rounded, -0-free JSON so identity-transform refactors do not trip on float noise.
const stable=(value:unknown)=>JSON.stringify(value,(_k,v)=>typeof v==='number'?(Object.is(v,-0)||Math.abs(v)<5e-7?0:Math.round(v*1e6)/1e6):v);
const digest=(value:unknown)=>createHash('sha256').update(stable(value)).digest('hex').slice(0,20);

function fingerprint(patch:Partial<DeckData>){
  const d:DeckData={...base(),...patch};
  try{
    const estimate=calculateEstimate(d),model=estimate.model;
    // Issues/flags are fingerprinted apart from geometry and price, so a new
    // "confirm before construction" warning can never mask a build or price change.
    const {model:_model,flags,...priced}=estimate,{issues,...geometry}=model;
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
