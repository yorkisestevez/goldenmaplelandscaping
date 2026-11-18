import {disposalBinsFor} from '../../utils/takeoff';
export interface YardEarthwork {soilReusePct?:number;spoilSwellPct?:number;looseSpoilTonnesPerYd3?:number;binPayloadTonnes?:number;binVolumeYd3?:number}
export const EARTHWORK_LIMITS={soilReusePct:[0,100],spoilSwellPct:[0,100],looseSpoilTonnesPerYd3:[.1,3],binPayloadTonnes:[.5,30],binVolumeYd3:[1,40]} as const;
export const EARTHWORK_REQUIRED:readonly {key:keyof YardEarthwork;label:string}[]=[{key:'spoilSwellPct',label:'spoil swell'},{key:'looseSpoilTonnesPerYd3',label:'loose spoil density'},{key:'binVolumeYd3',label:'usable bin volume'},{key:'binPayloadTonnes',label:'bin payload'}];
export const earthworkMissingInputs=(v:YardEarthwork={})=>EARTHWORK_REQUIRED.filter(i=>v[i.key]===undefined);
export function earthworkProblem(v:unknown){
 if(v===undefined)return '';
 if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v))||Object.getOwnPropertySymbols(v).length)return 'Earthwork inputs must be plain values.';
 for(const [k,d]of Object.entries(Object.getOwnPropertyDescriptors(v))){const range=EARTHWORK_LIMITS[k as keyof YardEarthwork];if(!range||!d.enumerable||!('value'in d)||!Number.isFinite(d.value)||d.value<range[0]||d.value>range[1])return 'Invalid soil reuse, swell or hauling input.';}
 return '';
}
/** Bank soil, loose spoil and payload are separate. No soil is reused by
 * default. Keep the established disposal floor while assessing actual bins. */
export function yardEarthworkPlan(bankYd3:number,fillDemandYd3:number,v:YardEarthwork={}){
 const reusedYd3=Math.min(fillDemandYd3,bankYd3*(v.soilReusePct??0)/100),exportBankYd3=Math.max(0,bankYd3-reusedYd3);
 const looseSpoilYd3=v.spoilSwellPct===undefined?null:exportBankYd3*(1+v.spoilSwellPct/100);
 const spoilTonnes=looseSpoilYd3===null||v.looseSpoilTonnesPerYd3===undefined?null:looseSpoilYd3*v.looseSpoilTonnesPerYd3;
 const benchmarkBins=disposalBinsFor(exportBankYd3*27,'full-depth'),volumeBins=looseSpoilYd3===null||v.binVolumeYd3===undefined?null:Math.ceil(looseSpoilYd3/v.binVolumeYd3),payloadBins=spoilTonnes===null||v.binPayloadTonnes===undefined?null:Math.ceil(spoilTonnes/v.binPayloadTonnes);
 return {bankYd3,reusedYd3,exportBankYd3,looseSpoilYd3,spoilTonnes,benchmarkBins,volumeBins,payloadBins,bins:Math.max(benchmarkBins,volumeBins??0,payloadBins??0),inputs:v,missingInputs:earthworkMissingInputs(v),haulingInputsComplete:volumeBins!==null&&payloadBins!==null};
}
