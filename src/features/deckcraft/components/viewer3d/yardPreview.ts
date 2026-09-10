import type {YardBox,YardModel} from '../../yardModel';

export const MAX_DETAILED_PREVIEW_PAVERS=6000;
export function hasSimplifiedPaving(model:YardModel){return model.quantities.paverPieces>MAX_DETAILED_PREVIEW_PAVERS;}

/** Preview only: the full model remains unchanged for quantities, inspection and exports.
 * Bedding cells already contain the exact patio perimeter, overlap and support cutouts.
 */
export function yardPreviewBoxes(model:YardModel,detailed=false):YardBox[]{
 if(detailed||!hasSimplifiedPaving(model))return model.boxes;
 const boxes=model.boxes.filter(b=>b.role!=='paver');
 for(const f of model.features){
  if(f.excluded||f.config.kind!=='patio')continue;
  const sample=f.boxes.find(b=>b.role==='paver');if(!sample)continue;
  const top=sample.y+sample.h/2;
  for(const cell of f.boxes.filter(b=>b.role==='bedding'))boxes.push({...cell,id:cell.id+'-simplified-paving-preview',role:'paver',color:sample.color,y:top-sample.h/2,h:sample.h,illustrative:true});
 }
 return boxes;
}
