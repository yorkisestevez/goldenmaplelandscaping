import './wallStationRuntime';
import './wallTopStepsRuntime';
import type {DeckData,YardFeature} from './types';
import {yardSurfaceIn} from './yardElevations';
import {validateYardFinishedSettings} from './yardFinishedSettings';
export type YardFinishedEdit={action:'pin'}|{action:'level';elevationIn:number}|{action:'slope';xPct:number;zPct:number}|{action:'steps';steps:{stationIn:number;elevationIn:number}[]};
export function editYardFinished(data:DeckData,f:YardFeature,edit:YardFinishedEdit):YardFeature{
 if(!edit||typeof edit!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(edit)))throw Error('Use a plain finished-level operation.');const ds=Object.getOwnPropertyDescriptors(edit),action=ds.action;if(!action||!('value'in action)||!action.enumerable)throw Error('Choose an explicit finished-level operation.');const keys:Record<string,string[]>={pin:['action'],level:['action','elevationIn'],slope:['action','xPct','zPct'],steps:['action','steps']},allowed=keys[action.value];if(!allowed||Reflect.ownKeys(edit).length!==allowed.length||allowed.some(k=>!ds[k]||!ds[k].enumerable||!('value'in ds[k])))throw Error('Invalid finished-level operation fields.');
 if(f.kind==='water-feature')throw Error('Choose a patio or wall.');
 const target=f.finishedElevationIn??yardSurfaceIn(data,f);if(!Number.isFinite(target))throw Error('Survey the feature centre before converting its finished level.');
 const next={...f,finishedElevationIn:target,...(f.kind==='patio'?{patioSlope:f.patioSlope??{xPct:0,zPct:0}}:{})};
 if(edit.action==='level'){const delta=edit.elevationIn-target;next.finishedElevationIn=edit.elevationIn;if(next.wallTopSteps)next.wallTopSteps=next.wallTopSteps.map(s=>({...s,elevationIn:s.elevationIn+delta}));}
 else if(edit.action==='slope'){if(f.kind!=='patio')throw Error('Only patios have surface slopes.');next.patioSlope={xPct:edit.xPct,zPct:edit.zPct};}
 else if(edit.action==='steps'){if(f.kind!=='retaining-wall')throw Error('Only walls have stepped tops.');next.wallTopSteps=edit.steps.map(s=>({...s}));}
 else if(edit.action!=='pin')throw Error('Choose a finished-level operation.');
 return validateYardFinishedSettings(next);
}
import './yardModelAdvancedRuntime';
