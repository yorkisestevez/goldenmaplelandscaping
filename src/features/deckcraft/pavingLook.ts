import type {PlanPoint} from './lib/deckGeometry';
import type {DeckData,YardFeature} from './types';
import {yardArea,yardClip} from './yardModel';
import {yardFeatureOutline,yardPathEnvelope} from './yardPathGeometry';
import {patioTopPlane,planeAt} from './patioPlane';

/** What makes two patios the same paving (pavingJoin.ts lays touching ones as one surface). Kept apart from the
 * laying so a new patio can take its neighbour's paving (joinNewPatio) without loading the yard runtime. */
const TOUCH_IN=.25,JOIN_LENGTH_IN=6;
/** Where a patio's joints run: its rotation plus its bond's own angle, in degrees within [0, 360). */
export const pavingDirection=(f:YardFeature)=>(((f.rotationDeg+(f.hardscape?.angleDeg??0))%360)+360)%360;
const canonical=(v:unknown):unknown=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.entries(v as Record<string,unknown>).filter(([,x])=>x!==undefined).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,x])=>[k,canonical(x)])):v;
/** Stock, colour and bond; the bond's angle is compared as a direction (pavingDirection) instead. */
export function pavingLook(f:YardFeature){const {angleDeg:_angle,...bond}=f.hardscape??{angleDeg:0};return JSON.stringify(canonical([f.productId,f.color,f.hardscape?bond:null]));}
export const plainPatio=(f:YardFeature)=>f.kind==='patio'&&!f.stoneSteps&&!f.stepAssembly;
/** True when `outline` overlaps `footprints` or runs along one of their edges for JOIN_LENGTH_IN or more. */
export function pavingTouches(outline:PlanPoint[][],footprints:PlanPoint[][]){
 if(!outline.length||!footprints.length)return false;
 if(yardArea(yardClip(outline,footprints,'intersection'))>.001)return true;
 const rim=yardClip(footprints.flatMap(ring=>yardPathEnvelope([...ring,ring[0]],2*TOUCH_IN)));
 return yardArea(yardClip(outline,rim,'intersection'))*144>=TOUCH_IN*JOIN_LENGTH_IN;
}
const outlineOf=(f:YardFeature)=>{try{return yardFeatureOutline(f);}catch{return [];}};
/**
 * A patio drawn touching an existing patio continues it: the same stock, colour and bond running the same way, and
 * the same finished plane (its level at its own centre and its fall, turned into its own axes), so the two are laid as
 * one surface. The first touching patio, in design order, is the one continued. Any of it can be changed afterwards.
 */
export function joinNewPatio(data:Pick<DeckData,'yardFeatures'>,f:YardFeature):YardFeature{
 if(!plainPatio(f))return f;
 const outline=outlineOf(f),g=(data.yardFeatures??[]).find(g=>g.enabled&&g.id!==f.id&&plainPatio(g)&&pavingTouches(outline,outlineOf(g)));
 if(!g)return f;
 const {hardscape:_own,...rest}=f,next:YardFeature={...rest,productId:g.productId,color:g.color,...(g.hardscape?{hardscape:{...g.hardscape,angleDeg:((Math.round((pavingDirection(g)-f.rotationDeg)*1e6)/1e6%360)+360)%360}}:{})};
 if(g.finishedElevationIn===undefined)return next;
 const plane=patioTopPlane(g,0),a=f.rotationDeg*Math.PI/180,c=Math.cos(a),s=Math.sin(a),pct=(n:number)=>Math.abs(n)<1e-12?0:n*100;
 return {...next,finishedElevationIn:planeAt(plane,f.xFt*12,f.zFt*12),patioSlope:{xPct:pct(c*plane.x+s*plane.z),zPct:pct(-s*plane.x+c*plane.z)},...(g.groundFit?{groundFit:{...g.groundFit}}:{})};
}
