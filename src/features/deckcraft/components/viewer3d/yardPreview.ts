import {yardClip,yardPaverProfiles,type YardBox,type YardModel} from '../../yardModel';
import {planeAt,planeNormalScale} from '../../yardElevationGeometry';

export const MAX_DETAILED_PREVIEW_PAVERS=6000;
/** The boxes of the features on show. A paver two joined patios share (pavingJoin.ts) is drawn once, as the whole stone,
 * from the earlier patio's fragment; with one of the patios hidden it is drawn from the fragments on show only. */
export function visibleYardBoxes(boxes:YardBox[],shown:(featureId:string)=>boolean):YardBox[]{
 const hiddenUnits=new Set(boxes.filter(b=>b.unitId&&!shown(b.featureId)).map(b=>b.unitId)),parts=new Map<string,YardBox[]>(),out:YardBox[]=[];
 for(const b of boxes){
  if(!shown(b.featureId))continue;
  if(!b.unitId||!hiddenUnits.has(b.unitId)){out.push(b);continue;}
  const part={...b};parts.set(b.unitId,[...(parts.get(b.unitId)??[]),part]);out.push(part);
 }
 for(const group of parts.values())group.forEach((b,i)=>{if(i){b.renderDuplicate=true;delete b.renderContours;}else{delete b.renderDuplicate;b.renderContours=yardClip(group.map(p=>p.polygon!));}});
 return out;
}
export function hasSimplifiedPaving(model:YardModel){return model.quantities.paverPieces>MAX_DETAILED_PREVIEW_PAVERS&&model.features.some(f=>!f.excluded&&f.config.kind==='patio'&&!f.config.hardscape&&!f.config.flagstone);}

/** Preview only: the full model remains unchanged for quantities, inspection and exports.
 * Bedding cells already contain the exact patio perimeter, overlap and support cutouts. Every cell draws its joints
 * from the patio's own bond (patternFrame): the corner its rows start from, so cells and a joined patio (pavingRootId)
 * carry one pattern across their seams.
 */
export function yardPreviewBoxes(model:YardModel,detailed=false):YardBox[]{
 if(detailed||!hasSimplifiedPaving(model))return model.boxes;
 // Supplier recipes retain their exact stock geometry and swatch UVs, including
 // mixed-size layouts. Only the legacy generic preview uses its simplification.
 const supplierIds=new Set(model.features.filter(f=>f.config.hardscape||f.config.flagstone).flatMap(f=>f.boxes.filter(b=>b.role==='paver').map(b=>b.id)));
 const boxes=model.boxes.filter(b=>b.role!=='paver'||supplierIds.has(b.id));
 for(const f of model.features){
  if(f.excluded||f.config.kind!=='patio'||f.config.hardscape||f.config.flagstone)continue;
  const sample=f.boxes.find(b=>b.role==='paver');if(!sample)continue;
  const top=sample.y+sample.h/2,root=model.features.find(g=>g.config.id===f.pavingRootId)?.config??f.config,row=(yardPaverProfiles[root.productId as keyof typeof yardPaverProfiles]?.rows??[{depth:12,lengths:[24]}])[0];
  const angle=root.rotationDeg*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),u=-root.widthFt*6,v=-root.depthFt*6,patternFrame={x:root.xFt*12+c*u-s*v,z:root.zFt*12+s*u+c*v,angle,w:row.lengths[0]+.125,d:row.depth+.125};
  for(const cell of f.boxes.filter(b=>b.role==='bedding')){
   if(f.topPlane){const scale=planeNormalScale(f.topPlane),shift=sample.h/scale,polygon=cell.polygon?.map(p=>({x:p.x-f.topPlane!.x*shift,y:p.y-f.topPlane!.z*shift})),x=cell.x-f.topPlane.x*shift,z=cell.z-f.topPlane.z*shift;boxes.push({...cell,id:cell.id+'-simplified-paving-preview',role:'paver',color:sample.color,x,z,polygon,y:planeAt(f.topPlane,x,z)-sample.h/(2*scale),h:sample.h,topPlane:f.topPlane,normalThicknessIn:sample.h,illustrative:true,patternFrame});}
   else boxes.push({...cell,id:cell.id+'-simplified-paving-preview',role:'paver',color:sample.color,y:top-sample.h/2,h:sample.h,illustrative:true,patternFrame});
  }
 }
 return boxes;
}
