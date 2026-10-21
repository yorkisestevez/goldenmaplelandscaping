import type {DeckData,YardFeature} from './types';
import type {LandscapeObject} from './landscapeTypes';
import {ontarioShowcaseDesign} from './showcaseSample';
import {createPlanningPool,poolRoundedRectangle} from './poolAssembly';
import {newLandscapePlant} from './landscapeCatalogue';
import {POOL_LIGHT_ID} from './poolLightSpec';
import {poolLightPlaces} from './lightingPlacementRules';
import {houseOutline} from './houseFootprint';

/**
 * "Ultimate Outdoor Paradise": the flagship showcase. It is the Ontario showcase estate (deck + LOUSOL louvered
 * pergola, dining, terrace lounge, outdoor kitchen, pool court, fire lounge) plus:
 * - a 7×7 ft spa on the pool's east end, on the pool's long axis, coping to coping, one 12 V underwater light in its
 *   house-side wall (aimed away from the house), no coping light;
 * - a pondless waterfall in the rear bed, centred on the pool's long axis so the pool loungers look at it;
 * - a flowering perennial layer (Ontario natives: coneflower, black-eyed Susan, bee balm, blazing star, butterfly
 *   weed, wild columbine, asters) in front of the existing grasses, plus serviceberries framing the waterfall.
 */
export function ultimateParadiseDesign():DeckData{
 const data=ontarioShowcaseDesign();
 data.customerName='Ultimate Outdoor Paradise';
 const court=data.yardFeatures!.find(f=>f.id==='pool-court')!;
 const pool=data.pools![0];
 const poolHalfIn=18*12;
 // Spa: centred on the pool's long axis, butted to its east coping.
 const spaSide=7*12,spaX=pool.xIn+poolHalfIn+12+spaSide/2,spaZ=pool.zIn;
 const spa={...createPlanningPool({id:'spa',name:'Spa',type:'fiberglass',xIn:spaX,zIn:spaZ,copingTopElevationIn:0,shape:'rounded-rectangle'}),...poolRoundedRectangle(spaSide,spaSide),depthProfile:[{stationIn:0,depthIn:36},{stationIn:spaSide,depthIn:36}]};
 data.pools=[pool,spa];
 // Waterfall in the rear bed, on the pool axis.
 const rear0=court.zFt+court.depthFt/2;
 const fall:YardFeature={id:'waterfall',kind:'water-feature',name:'Pondless waterfall',enabled:true,xFt:pool.xIn/12,zFt:rear0+4.5,widthFt:9,depthFt:5,heightIn:30,rotationDeg:0,productId:'pondless-waterfall',color:'#6f6a62'} as YardFeature;
 data.yardFeatures=[...data.yardFeatures!,fall];
 const fx0=fall.xFt-6.5,fx1=fall.xFt+6.5,fz1=fall.zFt+4;
 // Clear rear-bed plants that would stand in the waterfall or right in front of it.
 let objs=(data.landscapeObjects??[]).filter(o=>!(o.kind==='plant'&&o.xIn/12>fx0&&o.xIn/12<fx1&&o.zIn/12>rear0&&o.zIn/12<fz1));
 const extra:LandscapeObject[]=[];let n=0;
 const grow=(sp:string,x:number,z:number)=>{try{const o=newLandscapePlant(sp,`paradise-${n++}`,x*12,z*12);extra.push({...o,speciesRecord:structuredClone(o.speciesRecord!)});}catch{}};
 grow('amelanchier-canadensis',fx0-1,fall.zFt+1);grow('amelanchier-canadensis',fx1+1,fall.zFt+1);
 const blooms=['echinacea-purpurea','monarda-fistulosa','liatris-spicata','asclepias-tuberosa','rudbeckia-hirta','aquilegia-canadensis','symphyotrichum-novae-angliae'];
 for(let x=-30,i=0;x<=54;x+=4.4,i++)if(x<fx0-1.5||x>fx1+1.5)grow(blooms[i%blooms.length],x,rear0+0.9);
 objs=[...objs,...extra];
 data.landscapeObjects=objs;
 // Spa light: one more niche light in the spa's house-side wall.
 const items=data.lightingSystem!.selectedItems.map(it=>it.productId===POOL_LIGHT_ID&&it.places?{...it,qty:it.qty+Math.min(1,poolLightPlaces(spa,houseOutline(data)).length),places:[...it.places,...poolLightPlaces(spa,houseOutline(data)).slice(0,1)]}:it);
 data.lightingSystem={...data.lightingSystem!,selectedItems:items};
 data.scopeOfWork=(data.scopeOfWork??'').replace('Kitchen, heaters and furniture','Spa, waterfall, kitchen, heaters, furniture');
 return data;
}
