import type {DeckData} from '../../types';
import type {LandscapeObject} from '../../landscapeTypes';
import {landscapeAsset} from '../../landscapeCatalogue';
import {landscapeSurface} from '../../landscapeSurfaces';
import {landscapeOutlinePaths,insideLandscapeRing} from '../../landscapeOutline';
import {landscapePlacement,raisedBedLevel} from '../../landscapeModelRuntime';
import {inRings,reliefGround,type BedRelief} from './bedRelief';

/**
 * Where each placed plant meets the ground (render only: landscapePlacement, prices and exports are unchanged).
 * In a drawn mulch or stone bed the root flare sits in the mulch, sunk by its form, with the mulch pulled back from the
 * stems (Ontario municipal planting details: flare at or just above grade, mulch held 40–75 mm off stems and trunks).
 * Raised beds keep their soil-top rule, minus the sink. Plants in the lawn stay at grade.
 */
export type PlantForm='tree'|'shrub'|'perennial';
export const PLANT_SEAT:Record<PlantForm,{sinkIn:number;pullIn:number}>={tree:{sinkIn:0,pullIn:3},shrub:{sinkIn:.5,pullIn:2},perennial:{sinkIn:.75,pullIn:1.5}};
/** The mulch lip around the pulled-back collar: 1¾ in wide, rising 0.6 in. */
export const MULCH_LIP={widthIn:1.75,riseIn:.6};
export const plantForm=(o:LandscapeObject):PlantForm=>{const c=landscapeAsset(o.assetId).category;return c==='Trees'?'tree':c==='Shrubs and hedges'?'shrub':'perennial';};
/** Where a model's single trunk or stem meets the ground, as a share of its width and depth from the envelope's centre
 * (the viewer centres the envelope, and a lopsided canopy moves the trunk off it). Measured from the lowest 4 % of each
 * model's vertices; mounded shrubs, grasses and clumps meet the ground across their whole base and stay centred. */
export const STEM_OFFSET:Partial<Record<string,[number,number]>>={'deciduous-tree':[-.05,-.176],'conifer-tree':[-.032,.004],'perennial-bloom':[.023,.093],'perennial-gold':[-.027,.053]};
/** World inches of the stems' centre: the object's position plus its model's stem offset, turned with the object. */
export function stemCentre(o:LandscapeObject){
 const [u,w]=STEM_OFFSET[o.assetId]??[0,0],lx=u*o.widthIn,lz=w*o.depthIn,a=-o.rotationDeg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
 return {x:o.xIn+lx*c+lz*s,z:o.zIn-lx*s+lz*c};
}
/** Stems' radius at the ground: a trunk for trees, the crown of stems for shrubs and perennials. */
export const stemRadiusIn=(o:LandscapeObject)=>{const f=plantForm(o),w=Math.max(o.widthIn,o.depthIn);return f==='tree'?Math.min(6,Math.max(1.5,w*.03)):Math.min(f==='shrub'?4:3,Math.max(1,w*.08));};

export interface PlantSeat{
 /** Offset from landscapePlacement's height to the drawn base, inches. */
 dyIn:number;
 /** World inches of the stems' centre (stemCentre), where the collar and shade ring are centred. */
 x:number;z:number;
 /** Absolute height of the drawn surface at the stems, inches; the ring and collar sit on it. */
 surfaceIn:number;
 form:PlantForm;sinkIn:number;pullIn:number;
 /** The bed whose finish the plant stands in (draped or raised mulch or stone); undefined in the lawn or turf. */
 bed?:LandscapeObject;raised:boolean;
}
const finishBed=(o:LandscapeObject)=>['mulch','aggregate'].includes(landscapeSurface(o.assetId)?.type??'');
/** Seats for every enabled plant, keyed by id. reliefs: bedReliefs (draped beds and their drawn tops). */
export function plantSeats(data:DeckData,objects:LandscapeObject[],reliefs:Map<string,BedRelief>){
 const out=new Map<string,PlantSeat>(),ground=reliefGround(data),draped=[...reliefs.values()];
 const raisedBeds=objects.filter(b=>b.enabled&&b.kind==='bed'&&b.raisedIn!==undefined);
 for(const o of objects.filter(o=>o.enabled&&o.kind==='plant')){
  const placed=landscapePlacement(data,o);if(placed.pendingReason)continue;
  const form=plantForm(o),{sinkIn,pullIn}=PLANT_SEAT[form],baseIn=placed.y*12,{x,z}=stemCentre(o);
  // The last enabled raised bed holding the point (as landscapePlacement's raisedSupport).
  let raised:LandscapeObject|undefined;
  for(let i=raisedBeds.length-1;i>=0;i--){const b=raisedBeds[i],[outer,...holes]=landscapeOutlinePaths(b),p={x:o.xIn,z:o.zIn};if(insideLandscapeRing(p,outer)&&!holes.some(h=>insideLandscapeRing(p,h))&&raisedBedLevel(data,b)){raised=b;break;}}
  if(raised){out.set(o.id,{dyIn:-sinkIn,x,z,surfaceIn:baseIn+.05,form,sinkIn,pullIn,bed:finishBed(raised)?raised:undefined,raised:true});continue;}
  // In the bed where its stems stand (a lopsided tree near an edge can root just outside it).
  const relief=draped.find(r=>inRings(x,z,r.polys));
  if(relief){const surfaceIn=ground.height(x,z)+relief.rise(x,z);out.set(o.id,{dyIn:surfaceIn-sinkIn-baseIn,x,z,surfaceIn,form,sinkIn,pullIn,bed:relief.object,raised:false});continue;}
  // In the lawn or a turf area: at grade (turf keeps today's rule).
  out.set(o.id,{dyIn:0,x,z,surfaceIn:ground.height(x,z),form,sinkIn:0,pullIn,raised:false});
 }
 return out;
}
