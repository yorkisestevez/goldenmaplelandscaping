import type {DeckData} from './types';
/** Only authoritative fixed levels belong in this comparison; sampled ground
 * levels are allowed to change with the grading operation. */
type FinishedData=Pick<DeckData,'yardFeatures'|'pools'>;
export function fixedSiteLevels(data:FinishedData){
 const levels=new Map<string,number>();
 for(const f of data.yardFeatures??[]){
  if(f.finishedElevationIn!==undefined)levels.set(`${f.id}:finished`,f.finishedElevationIn);
  for(const [i,s] of (f.wallTopSteps??[]).entries())levels.set(`${f.id}:wall:${i}`,s.elevationIn);
  if(f.stoneSteps)levels.set(`${f.id}:lower`,f.stoneSteps.lowerElevationIn);
  for(const p of f.stepAssembly?.flights??[]){levels.set(`${f.id}:${p.id}:lower`,p.lowerElevationIn);levels.set(`${f.id}:${p.id}:upper`,p.upperElevationIn);}
  for(const p of f.stepAssembly?.landings??[])levels.set(`${f.id}:${p.id}:landing`,p.elevationIn);
 }
 for(const p of data.pools??[])levels.set(`${p.id}:coping`,p.copingTopElevationIn);
 return levels;
}
export function fixedSiteLevelChanges(before:FinishedData,after:FinishedData){
 const a=fixedSiteLevels(before),b=fixedSiteLevels(after);
 return [...new Set([...a.keys(),...b.keys()])].filter(id=>a.get(id)!==b.get(id)).map(id=>({id,before:a.get(id),after:b.get(id)}));
}
