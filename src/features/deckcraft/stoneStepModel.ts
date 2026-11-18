import type {YardFeature} from './types';
import type {SiteSurface} from './siteSurface';
import {integrateSiteFeatureFill,sitePolygonsBelowGround} from './siteSurface';
import {stoneStepBlanks} from './stoneSteps';
import {yardArea,yardSolidCells,yardClip} from './yardModel';
import type {YardBox} from './yardModel';
import {abovePlane,planeVolume,subtractPlanes} from './yardElevationGeometry';
export function buildStoneStepModel(f:YardFeature,site:SiteSurface|undefined,ground:{x:number;z:number;constant:number}){
 const {stock:s,rise,blanks}=stoneStepBlanks(f),boxes:YardBox[]=[],formations:{featureId:string;polys:{x:number;y:number}[][];bottom:number}[]=[];
 const warnings:string[]=[],bearingRows:{row:number;courses:number;topIn:number;formationIn:number}[]=[];
 const q={stoneStepPieces:blanks.length,stoneStepCuts:blanks.filter(b=>b.cut).length,stoneStepAreaSqft:0,buriedTreadAreaSqft:0,stoneStepRisers:s.riserCount,stoneStepRiseIn:rise,stoneSupportStepPieces:0,stoneSupportStepCuts:0,stoneFillerPieces:0,stoneFillerCuts:0,stoneSupportVolumeYd3:0,unsupportedBearingAreaSqft:0,paverPieces:0,paverAreaSqft:0,baseYd3:0,beddingYd3:0,raisedFillYd3:0};
 const add=(role:YardBox['role'],polygon:{x:number;y:number}[],top:number,h:number,id:string,stonePart?:YardBox['stonePart'])=>{if(h<=0)return;const xs=polygon.map(v=>v.x),zs=polygon.map(v=>v.y);boxes.push({id,unitId:role==='stone-step'?id:undefined,featureId:f.id,role,polygon,...(stonePart?{stonePart,stepFlightId:'flight-1',stepRow:Number(id.match(/-(?:stone|support)-(\d+)-/)?.[1]??0)}:{}),color:role==='stone-step'?f.color:role==='base'?'#92958e':'#b0a489',x:(Math.min(...xs)+Math.max(...xs))/2,z:(Math.min(...zs)+Math.max(...zs))/2,y:top-h/2,w:Math.max(...xs)-Math.min(...xs),d:Math.max(...zs)-Math.min(...zs),h});};
 for(const b of blanks){
  add('stone-step',b.polygon,b.topIn,s.stockThicknessIn,`${f.id}-stone-${b.row}-${b.slot}`,'tread');
  q.stoneStepAreaSqft+=yardArea([b.polygon]);
  const exposed=yardClip([b.polygon],blanks.filter(other=>other.row>b.row).map(other=>other.polygon),'difference');
  q.buriedTreadAreaSqft+=site?yardArea(sitePolygonsBelowGround(site,exposed,b.topIn+.075)):yardSolidCells(exposed).reduce((n,p)=>n+yardArea([abovePlane(p,subtractPlanes(ground,{x:0,z:0,constant:b.topIn+.075}))]),0);
 }
 let claimed:{x:number;y:number}[][]=[];
 for(let row=0;row<s.riserCount;row++){
  const units=blanks.filter(b=>b.row===row),first=units[0],last=units.at(-1)!;
  // The support is continuous under the joints between stock units.
  const footprint=[first.polygon[0],last.polygon[1],last.polygon[2],first.polygon[3]];
  // Lowest tread owns any horizontal overlap; supporting base is never charged twice.
  const basePolys=yardClip([footprint],claimed,'difference');claimed=yardClip([...claimed,footprint]);
  const support=s.support,stock=support?.kind==='filler'?support:s,courses=support?.courses[row]??0,unitBottom=first.topIn-s.stockThicknessIn,bearing=unitBottom-courses*stock.stockThicknessIn,bottom=bearing-s.settingBedIn-s.baseDepthIn;
  const supportUnits:{polygon:{x:number;y:number}[];cut:boolean}[]=[];
  if(courses){
   if(support!.kind==='full-step')supportUnits.push(...units.map(b=>({polygon:b.polygon,cut:b.cut})));
   else{
    const width=f.widthFt*12,depth=f.depthFt*12,a=f.rotationDeg*Math.PI/180,c=Math.cos(a),sin=Math.sin(a),world=(x:number,z:number)=>({x:f.xFt*12+c*x-sin*z,y:f.zFt*12+sin*x+c*z}),front=-depth/2+row*s.treadRunIn;
    for(let z=front;z<front+s.stockDepthIn-1e-6;z+=stock.stockDepthIn+stock.jointIn)for(let x=-width/2;x<width/2-1e-6;x+=stock.stockWidthIn+stock.jointIn){const right=Math.min(width/2,x+stock.stockWidthIn),back=Math.min(front+s.stockDepthIn,z+stock.stockDepthIn);supportUnits.push({polygon:[world(x,z),world(right,z),world(right,back),world(x,back)],cut:right-x<stock.stockWidthIn-1e-6||back-z<stock.stockDepthIn-1e-6});}
   }
   q.unsupportedBearingAreaSqft+=yardArea(yardClip(units.map(b=>b.polygon),supportUnits.map(b=>b.polygon),'difference'));
   for(let course=0;course<courses;course++)for(const [slot,b] of supportUnits.entries()){
    add('stone-step',b.polygon,unitBottom-course*stock.stockThicknessIn,stock.stockThicknessIn,`${f.id}-support-${row}-${course}-${slot}`,support!.kind==='full-step'?'support-step':'filler');
    q.stoneSupportVolumeYd3+=yardArea([b.polygon])*stock.stockThicknessIn/324;
    if(support!.kind==='full-step'){q.stoneSupportStepPieces++;if(b.cut)q.stoneSupportStepCuts++;}else{q.stoneFillerPieces++;if(b.cut)q.stoneFillerCuts++;}
   }
  }
  bearingRows.push({row,courses,topIn:bearing,formationIn:bottom});
  for(const [i,p] of yardSolidCells(basePolys).entries()){add('bedding',p,bearing,s.settingBedIn,`${f.id}-bed-${row}-${i}`);add('base',p,bearing-s.settingBedIn,s.baseDepthIn,`${f.id}-base-${row}-${i}`);}
  q.baseYd3+=yardArea(basePolys)*s.baseDepthIn/324;q.beddingYd3+=yardArea(basePolys)*s.settingBedIn/324;
  q.raisedFillYd3+=site?integrateSiteFeatureFill(site,basePolys,bottom):yardSolidCells(basePolys).reduce((n,p)=>{const delta=subtractPlanes({x:0,z:0,constant:bottom},ground);return n+Math.max(0,planeVolume(abovePlane(p,delta),delta))/46656;},0);
  formations.push({featureId:f.id,polys:basePolys,bottom});
 }
 if(q.unsupportedBearingAreaSqft>.001)warnings.push(`${q.unsupportedBearingAreaSqft.toFixed(3)} sq ft of tread bearing lies over filler joints or gaps. Record a compatible bearing/joint detail; no bridging or mortar is assumed.`);
 if(s.support)warnings.push(`Solid support courses ${s.support.courses.join(', ')}; bearing tops ${bearingRows.map(r=>r.topIn.toFixed(3)).join(', ')} in and foundation bottoms ${bearingRows.map(r=>r.formationIn.toFixed(3)).join(', ')} in. Stock remains full thickness; stepped foundations require recorded bearing, frost, drainage and installation details.`);
 return {boxes,formations,quantities:q,warnings,bearingRows};
}
