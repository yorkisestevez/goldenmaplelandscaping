import './wallStationRuntime';
import './wallTopStepsRuntime';
import type {DeckData,YardFeature} from './types';
import {yardSurfaceIn} from './yardElevations';
import {validateYardFinishedSettings} from './yardFinishedSettings';
export type YardFinishedEdit={action:'pin'}|{action:'level';elevationIn:number}|{action:'slope';xPct:number;zPct:number}|{action:'steps';steps:{stationIn:number;elevationIn:number}[]}
 /** Ground fit: grade the measured ground round a patio at slopeRatio run per rise; null leaves the ground as measured. Turning it on fixes an unfixed patio at its current top. */
 |{action:'groundFit';slopeRatio:number|null;
  /** 'stone' holds the patio's raised side with a stone edge course instead of a fill bank; null goes back to banks;
   * absent keeps what the patio has. */
  lowEdge?:'stone'|null};
export function editYardFinished(data:DeckData,f:YardFeature,edit:YardFinishedEdit):YardFeature{
 if(!edit||typeof edit!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(edit)))throw Error('Use a plain finished-level operation.');const ds=Object.getOwnPropertyDescriptors(edit),action=ds.action;if(!action||!('value'in action)||!action.enumerable)throw Error('Choose an explicit finished-level operation.');const keys:Record<string,string[]>={pin:['action'],level:['action','elevationIn'],slope:['action','xPct','zPct'],steps:['action','steps'],groundFit:['action','slopeRatio']},allowed=action.value==='groundFit'&&ds.lowEdge?['action','slopeRatio','lowEdge']:keys[action.value];if(!allowed||Reflect.ownKeys(edit).length!==allowed.length||allowed.some(k=>!ds[k]||!ds[k].enumerable||!('value'in ds[k])))throw Error('Invalid finished-level operation fields.');
 if(f.kind==='water-feature'||f.kind==='fire-feature')throw Error('Choose a patio or wall.');
 if(edit.action==='groundFit'){if(f.kind!=='patio')throw Error('Only patios can have the ground graded round them.');if(ds.lowEdge&&edit.lowEdge!=='stone'&&edit.lowEdge!==null)throw Error("Hold the patio's raised edge with 'stone', or null for banks.");if(edit.slopeRatio===null){if(edit.lowEdge==='stone')throw Error('Choose a bank ratio to hold the raised edge with stone.');const {groundFit:_off,...rest}=f;return validateYardFinishedSettings(rest);}if(f.stoneSteps||f.stepAssembly)throw Error('Steps keep their own ground. Grade round a flat patio instead.');if(!data.siteModel)throw Error('Measure the ground before grading round a patio.');}
 const target=f.finishedElevationIn??yardSurfaceIn(data,f);if(!Number.isFinite(target))throw Error('Survey the feature centre before converting its finished level.');
 const next={...f,finishedElevationIn:target,...(f.kind==='patio'?{patioSlope:f.patioSlope??{xPct:0,zPct:0}}:{})};
 if(edit.action==='level'){const delta=edit.elevationIn-target;next.finishedElevationIn=edit.elevationIn;if(next.wallTopSteps)next.wallTopSteps=next.wallTopSteps.map(s=>({...s,elevationIn:s.elevationIn+delta}));}
 else if(edit.action==='slope'){if(f.kind!=='patio')throw Error('Only patios have surface slopes.');next.patioSlope={xPct:edit.xPct,zPct:edit.zPct};}
 else if(edit.action==='steps'){if(f.kind!=='retaining-wall')throw Error('Only walls have stepped tops.');next.wallTopSteps=edit.steps.map(s=>({...s}));}
 else if(edit.action==='groundFit'){const low=ds.lowEdge?edit.lowEdge:f.groundFit?.lowEdge;next.groundFit=low==='stone'?{slopeRatio:edit.slopeRatio as number,lowEdge:'stone'}:{slopeRatio:edit.slopeRatio as number};}
 else if(edit.action!=='pin')throw Error('Choose a finished-level operation.');
 return validateYardFinishedSettings(next);
}
import './yardModelAdvancedRuntime';
