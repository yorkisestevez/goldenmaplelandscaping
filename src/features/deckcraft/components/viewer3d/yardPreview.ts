import type {YardBox,YardModel} from '../../yardModel';

export const MAX_DETAILED_PREVIEW_PAVERS=6000;
export function hasSimplifiedPaving(model:YardModel){return model.quantities.paverPieces>MAX_DETAILED_PREVIEW_PAVERS&&model.features.some(f=>!f.excluded&&f.config.kind==='patio'&&!f.config.hardscape);}

/** Preview only: the full model remains unchanged for quantities, inspection and exports.
 * Bedding cells already contain the exact patio perimeter, overlap and support cutouts.
 */
export function yardPreviewBoxes(model:YardModel,detailed=false):YardBox[]{
 if(detailed||!hasSimplifiedPaving(model))return model.boxes;
 // Supplier recipes retain their exact stock geometry and swatch UVs, including
 // mixed-size layouts. Only the legacy generic preview uses its simplification.
 const supplierIds=new Set(model.features.filter(f=>f.config.hardscape).flatMap(f=>f.boxes.filter(b=>b.role==='paver').map(b=>b.id)));
 const boxes=model.boxes.filter(b=>b.role!=='paver'||supplierIds.has(b.id));
 for(const f of model.features){
  if(f.excluded||f.config.kind!=='patio'||f.config.hardscape)continue;
  const sample=f.boxes.find(b=>b.role==='paver');if(!sample)continue;
  const top=sample.y+sample.h/2;
  for(const cell of f.boxes.filter(b=>b.role==='bedding'))boxes.push({...cell,id:cell.id+'-simplified-paving-preview',role:'paver',color:sample.color,y:top-sample.h/2,h:sample.h,illustrative:true});
 }
 return boxes;
}
