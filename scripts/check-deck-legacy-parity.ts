import {createHash} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
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
      extras:digest(extrasLayout(d,model)),
      catalogue:digest(catalogueAccessoryLayout(d,model)),
      exports:digest(deckExportMeshes(d,model).map(m=>[m.name,m.vertices,m.faces])),
      estimate:digest(priced),
      total:Math.round(estimate.total*100)/100,
    };
  }catch(error){return {throws:error instanceof Error?error.message:String(error)};}
}

const current=Object.fromEntries(Object.entries(scenarios).map(([name,patch])=>[name,fingerprint(patch)]));
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
