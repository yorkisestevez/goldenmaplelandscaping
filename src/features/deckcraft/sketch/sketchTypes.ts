import type {DeckData} from '../types';
import {cleanSketchOutline,sketchOutlineProblem} from './sketchGeometry';
import {cleanStairPath} from './sketchStairPath';

export interface SketchPoint {x:number;y:number}
export type SketchKind='house'|'deck'|'landing'|'stairs'|'patio'|'retaining-wall';
export interface SketchShape {id:string;kind:SketchKind;points:SketchPoint[];label:string;widthFt?:number;depthFt?:number;heightIn?:number;drawing?:'edge-path';riserCount?:number;treadDepthIn?:number}
export interface SketchDocument {version:1;shapes:SketchShape[]}
export interface SketchResult {ok:boolean;patch?:Partial<DeckData>;errors:string[];warnings:string[];summary:string[]}
export const SKETCH_LIMITS={shapes:31,rawPoints:2048,outlinePoints:64,coordinate:10000,label:80} as const;

function object(value:unknown,keys:string[],name:string):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw new Error(`${name} must be a plain object.`);
  if(Object.getOwnPropertySymbols(value).length)throw new Error(`${name} has unsupported fields.`);
  for(const [key,d] of Object.entries(Object.getOwnPropertyDescriptors(value)))if(!keys.includes(key)||!('value' in d)||!d.enumerable)throw new Error(`${name} has an unknown or unsafe field: ${key}.`);
  return value as Record<string,unknown>;
}
function array(value:unknown,min:number,max:number,name:string):unknown[]{
  if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||value.length<min||value.length>max||Object.getOwnPropertySymbols(value).length)throw new Error(`${name} needs ${min}–${max} items.`);
  for(const [key,d] of Object.entries(Object.getOwnPropertyDescriptors(value)))if(key!=='length'&&(!/^(0|[1-9][0-9]*)$/.test(key)||Number(key)>=value.length||!('value' in d)||!d.enumerable))throw new Error(`${name} has unsafe array fields.`);
  for(let i=0;i<value.length;i++)if(!Object.hasOwn(value,i))throw new Error(`${name} cannot contain missing items.`);
  return value;
}
function number(value:unknown,min:number,max:number,name:string):number {if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw new Error(`${name} must be a number between ${min} and ${max}.`);return value;}
/** Shared canvas coordinates, typed feet/inches only. Labels are never interpreted as measurements. */
export function parseSketchDocument(value:unknown):SketchDocument {
  const d=object(value,['version','shapes'],'Sketch');if(d.version!==1)throw new Error('This sketch version is unsupported.');
  const ids=new Set<string>();
  const shapes=array(d.shapes,1,SKETCH_LIMITS.shapes,'Sketch shapes').map((value,index):SketchShape=>{
    const s=object(value,['id','kind','points','label','widthFt','depthFt','heightIn','drawing','riserCount','treadDepthIn'],`Shape ${index+1}`);
    if(typeof s.id!=='string'||!/^[A-Za-z0-9_-]{1,64}$/.test(s.id)||ids.has(s.id))throw new Error('Give every sketch shape a unique id.');ids.add(s.id);
    if(!['house','deck','landing','stairs','patio','retaining-wall'].includes(s.kind as string))throw new Error(`Choose a supported deck, house or yard shape for shape ${index+1}.`);
    if(typeof s.label!=='string'||!s.label.trim()||s.label.length>80||/[\u0000-\u001f]/.test(s.label))throw new Error(`Give shape ${index+1} a label of 1–80 characters.`);
    if(s.drawing!==undefined&&(!['stairs','retaining-wall'].includes(s.kind as string)||s.drawing!=='edge-path'))throw Error('Only stairs and retaining walls can use an open edge path.');
    if(s.kind==='retaining-wall'&&s.drawing!=='edge-path')throw Error('Draw a retaining wall as an open edge path.');
    const path=s.drawing==='edge-path',wall=s.kind==='retaining-wall';
    const label=s.label.trim(),raw=array(s.points,path?2:3,2048,`${label} points`).map(v=>{const p=object(v,['x','y'],`${label} point`);return {x:number(p.x,-10000,10000,`${label} across coordinate`),y:number(p.y,-10000,10000,`${label} out coordinate`)};});
    // Refuse crossings before simplification; cleanup must never make an invalid scribble look buildable.
    const rawProblem=path?null:sketchOutlineProblem(cleanSketchOutline(raw,false));if(rawProblem)throw new Error(`${label}: ${rawProblem}`);
    const points=wall?raw:path?cleanStairPath(raw):cleanSketchOutline(raw),problem=path?null:sketchOutlineProblem(points);if(problem)throw new Error(`${label}: ${problem}`);
    if(path&&(points.length<2||points.length>(wall?64:9)||Math.hypot(points[0].x-points.at(-1)!.x,points[0].y-points.at(-1)!.y)<.01))throw Error(`${label}: draw an open ${wall?'wall':'stair'} path with 2–${wall?64:9} points.`);
    if(points.length>64)throw new Error(`${label}: simplify the drawing to no more than 64 corners.`);
    const shape:SketchShape={id:s.id,kind:s.kind as SketchKind,points,label};
    if(path)shape.drawing='edge-path';
    if(s.riserCount!==undefined){if(s.kind!=='stairs')throw Error('Riser count belongs to stairs.');shape.riserCount=number(s.riserCount,1,32,`${label} riser count`);if(!Number.isInteger(shape.riserCount))throw Error('Use a whole number of risers.');}
    if(s.treadDepthIn!==undefined){if(s.kind!=='stairs')throw Error('Tread depth belongs to stairs.');shape.treadDepthIn=number(s.treadDepthIn,10,24,`${label} tread depth`);}
    // A retaining wall's width is its total path run, which shares the 240 ft path-wall limit.
    if(s.widthFt!==undefined)shape.widthFt=number(s.widthFt,1/12,s.kind==='retaining-wall'?240:120,`${label} width (feet)`);
    if(s.depthFt!==undefined)shape.depthFt=number(s.depthFt,1/12,120,`${label} depth (feet)`);
    if(s.heightIn!==undefined)shape.heightIn=number(s.heightIn,s.kind==='patio'?-24:0,900,`${label} height (inches)`);
    return shape;
  });
  return {version:1,shapes};
}
