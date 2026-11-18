import type {YardFeature} from './types';
import {plainAssembly,validateStoneSteps} from './stoneSteps';
export {validateStoneSteps};
export function validatePavingInterface(f:YardFeature,value:unknown):NonNullable<YardFeature['pavingInterface']>{
 if(f.kind!=='retaining-wall')throw Error('Only retaining walls support a paving interface.');
 const p=plainAssembly(value,['jointIn'],['jointIn','supportNote']);
 if(typeof p.jointIn!=='number'||!Number.isFinite(p.jointIn)||p.jointIn<0||p.jointIn>6||p.supportNote!==undefined&&(typeof p.supportNote!=='string'||!p.supportNote.trim()||p.supportNote.length>800||/[\u0000-\u001f]/.test(p.supportNote)))throw Error('Record a valid paving joint and support note.');
 return p as NonNullable<YardFeature['pavingInterface']>;
}

export function hardscapeAssemblyQuoteScopes(active:import('./yardModel').YardFeatureModel[]):import('./yardTakeoff').PublicYardSection[]{
 const unknown:import('./yardTakeoff').PublicYardSection[]=[],stoneStairs=active.filter(f=>f.config.stoneSteps||f.config.stepAssembly),walls=active.filter(f=>f.config.kind==='retaining-wall');
 for(const f of stoneStairs){
  const rows:[string,string,number,string][]=[['supply','tread stock supply and cuts',f.quantities.stoneStepPieces,'units'],['install','tread installation and lifting',f.quantities.stoneStepRisers,'risers'],['support','bearing, drainage and landing connections',1,'assembly']];
  if(f.quantities.stoneSupportStepPieces)rows.push(['support-supply','full-size supporting step stock and cuts',f.quantities.stoneSupportStepPieces,'units']);
  if(f.quantities.stoneFillerPieces)rows.push(['filler-supply','filler block stock and cuts',f.quantities.stoneFillerPieces,'units']);
  for(const [key,suffix,label] of [['stepRiserBlocks','riser-supply','riser wall blocks'],['stepSupportBlocks','block-support-supply','support wall blocks'],['stepLandingPieces','landing-supply','landing tread stock']] as const)if(f.quantities[key])rows.push([suffix,label,f.quantities[key],'units']);
  if(f.quantities.stepEngineeredFillYd3)rows.push(['engineered-fill','engineered stair-body fill supply and installation',f.quantities.stepEngineeredFillYd3,'yd³']);
  if(f.config.stepAssembly?.retainsGround)rows.push(['retaining-grid','default geogrid supply and installation allowance — length/spacing pending',1,'assembly'],['retaining-drainage','retaining drainage, burial, outlet and engineering inputs',1,'assembly']);
  const supporting=(f.quantities.stoneSupportStepPieces??0)+(f.quantities.stoneFillerPieces??0)+(f.quantities.stepRiserBlocks??0)+(f.quantities.stepSupportBlocks??0);if(supporting)rows.push(['support-install','support-unit installation and lifting',supporting,'units']);
  for(const [suffix,label,quantity,unit] of rows)unknown.push({id:`stone-stairs-${f.config.id}-${suffix}`,label:`${f.config.name}: ${label}`,amountCents:null,quantity,unit,featureIds:[f.config.id],note:'Treads and supporting units are separate measured scopes. Shared excavation, base and bedding are below the complete solid columns; reconcile package supply, cutting and installation inclusions. Recorded dimensions do not verify bearing or construction approval.'});
 }
 for(const f of walls.filter(f=>f.config.pavingInterface))unknown.push({id:`wall-paving-${f.config.id}`,label:`${f.config.name}: paving-to-wall support and joint detail`,amountCents:null,quantity:f.quantities.wallLengthLf,unit:'ft interface',featureIds:[f.config.id],note:'Confirm load transfer, drainage continuity, reinforcement cover and edge restraint. Fill is partitioned below the modeled paving formation; the connection still requires a recorded execution detail.'});
 return unknown;
}
