import {registerStairTargetsRuntime,type StairTarget,STAIR_TARGET_LIMITS} from './stairTargets';
export function validateStairTargets(value:unknown):StairTarget[]{
 if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||value.length>STAIR_TARGET_LIMITS.count)throw Error('Keep up to 32 explicit stair targets.');
 const descriptors=Object.getOwnPropertyDescriptors(value),ids=new Set<string>();
 if(Reflect.ownKeys(value).some(k=>typeof k!=='string'||k!=='length'&&(!/^(0|[1-9]\d*)$/.test(k)||Number(k)>=value.length)))throw Error('Stair targets must be plain data.');
 return Array.from({length:value.length},(_,i)=>{
  const entry=descriptors[i];if(!entry||!('value'in entry)||!entry.enumerable)throw Error('Every stair target must be present as plain data.');const raw=entry.value;
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||![Object.prototype,null].includes(Object.getPrototypeOf(raw)))throw Error('Each stair target must be an object.');
  const d=Object.getOwnPropertyDescriptors(raw),keys=Reflect.ownKeys(raw),allowed=['flightId','elevationIn','riserCount','treadDepthIn','surface','patioId'];
  if(keys.some(k=>typeof k!=='string'||!allowed.includes(k)||!('value'in d[k])||!d[k].enumerable)||!allowed.slice(0,5).every(k=>d[k]&&'value'in d[k]))throw Error('Unsupported or missing stair target field.');
  const get=(key:string)=>d[key]?.value,flightId=get('flightId'),elevationIn=get('elevationIn'),riserCount=get('riserCount'),treadDepthIn=get('treadDepthIn'),surface=get('surface'),patioId=get('patioId');
  if(typeof flightId!=='string'||!/^grade-(path|\d{1,2})$/.test(flightId)||ids.has(flightId))throw Error('Use a unique current grade-flight target ID.');ids.add(flightId);
  if(typeof elevationIn!=='number'||!Number.isFinite(elevationIn)||Math.abs(elevationIn)>STAIR_TARGET_LIMITS.elevationIn)throw Error('Stair termination elevation must be finite and within the site datum limits.');
  if(typeof riserCount!=='number'||!Number.isInteger(riserCount)||riserCount<1||riserCount>28)throw Error('Use 1–28 whole risers.');
  if(typeof treadDepthIn!=='number'||!Number.isFinite(treadDepthIn)||treadDepthIn<10||treadDepthIn>24)throw Error('Tread going must be between 10 and 24 inches.');
  if(surface!=='terrain'&&surface!=='patio')throw Error('Choose terrain or patio for the stair termination.');
  if(surface==='patio'&&(typeof patioId!=='string'||!/^[\w:.-]{1,100}$/.test(patioId)))throw Error('A patio target needs its current patio ID.');
  if(surface==='terrain'&&patioId!==undefined)throw Error('Terrain targets cannot reference a patio.');
  return {flightId,elevationIn,riserCount,treadDepthIn,surface,...(surface==='patio'?{patioId}: {})} as StairTarget;
 });
}

registerStairTargetsRuntime({validateStairTargets});
