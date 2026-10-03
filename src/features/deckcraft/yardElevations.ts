import type {DeckData,YardFeature} from './types';
import {sampleSiteHeight} from './siteSurface';
import {hardscapeSelection} from './hardscapeCatalogue';

export type YardElevationField='heightIn'|'baseElevationIn';
export function yardGradeIn(data:DeckData,f:YardFeature){return sampleSiteHeight(data,f.xFt*12,f.zFt*12)??NaN;}
export function yardSurfaceIn(data:DeckData,f:YardFeature){return f.finishedElevationIn??yardGradeIn(data,f)+(f.kind==='retaining-wall'?(f.baseElevationIn??0):0)+f.heightIn;}
export function yardElevationEdit(f:YardFeature,field:YardElevationField,value:number):YardFeature{
 if(f.kind==='water-feature')throw Error('Choose a patio or wall to change its elevation.');
 if(field!=='heightIn'&&field!=='baseElevationIn'||field==='baseElevationIn'&&f.kind!=='retaining-wall')throw Error('Only a wall has a separate base elevation.');
 const min=field==='baseElevationIn'?-120:f.kind==='patio'?-24:6,max=field==='baseElevationIn'?120:f.kind==='patio'?48:72;
 if(!Number.isFinite(value)||value<min||value>max)throw Error(`Enter ${min} to ${max} inches for ${field==='baseElevationIn'?'wall base elevation':f.kind==='patio'?'patio surface':'wall height'}.`);
 const cap=hardscapeSelection(f)?.cap;if(field==='heightIn'&&cap&&value<cap.heightMm/25.4)throw Error('The wall height must accommodate its selected cap.');
 if(value===(f[field]??0))return f;
 return {...f,[field]:value,...(f.finishedElevationIn!==undefined?{finishedElevationIn:f.finishedElevationIn+value-(f[field]??0),...(f.wallTopSteps?{wallTopSteps:f.wallTopSteps.map(step=>({...step,elevationIn:step.elevationIn+value-(f[field]??0)}))}:{})}:{})};
}
/** Full supplier courses, aligned to the requested top. Fractional height is
 * resolved by additional burial, never by squeezing or stretching a block. */
export function yardWallCourses(f:YardFeature,grade:number){
 const s=hardscapeSelection(f),armour=f.productId==='armour-stone',course=s?s.unit.heightMm/25.4:armour?18:6,cap=s?.cap?s.cap.heightMm/25.4:s||armour?0:3,base=grade+(f.baseElevationIn??0),top=f.finishedElevationIn??base+Math.max(1,f.heightIn),h=Math.max(1,top-base);
 // Techo-Bloc's wall installation guide requires at least 6 in or 10% of
 // exposed height. Other systems retain one planning course pending their
 // system/site design; selecting a nominal block is not structural approval.
 // https://www.techo-bloc.com/assets/1c/4a/1c4aed24-6f26-4b1e-b146-52b958de92ed/TB2025_Installation-guide_WALLS_EN_V2.pdf
 const minimumBurialIn=s?.product.brand==='Techo-Bloc'?Math.max(course,6,h*.1):course;
 const count=s?Math.ceil(Math.max(0,h-cap+minimumBurialIn)/course-1e-9):Math.ceil((h+course-cap)/course-1e-9),bottom=s?top-cap-count*course:base-course;
 return {course,cap,base,top,bottom,count,minimumBurialIn,burialIn:base-bottom};
}
