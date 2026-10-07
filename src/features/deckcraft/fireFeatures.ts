import type {YardFeature} from './types';
import {fireProduct} from './yardSettings';
import {registerFireFeatureCheck} from './yardFinishedSettings';
export {FIRE_PRODUCTS,fireProduct,newFireFeature} from './yardSettings';

/**
 * Fire features (yard kind 'fire-feature'): a stone-bodied fire pit or table placed in the yard, priced at the cost
 * estimator's fire pit allowance (yardTakeoff.ts) and drawn by the lazy Fire3D view. The products and a new feature are
 * in yardSettings.ts (re-exported here) because they ship with the first estimate and the pricing worker. This module,
 * the full validation, loads with the advanced yard runtime (fireFeatureModel.ts), which every design with a fire
 * feature needs, and registers the check that validateYardFinishedSettings runs.
 */
// Clearances come from designRules.ts FIRE_CLEARANCE, read only by the lazy model and editor (fireFeatureModel.ts).
// Settings that belong to patios and walls; a fire feature has none of them.
const NOT_FIRE=['outline','wallPath','curves','inlays','hardscape','pathSpine','baseElevationIn','wallConstruction','finishedElevationIn','patioSlope','groundFit','wallTopSteps','stoneSteps','stepAssembly','pavingInterface'] as const;
/** Why this fire feature cannot be built as saved, or ''. Run by validateYardFinishedSettings on every edit and load. */
export function fireFeatureProblem(f:YardFeature):string{
 const p=fireProduct(f),w=f.widthFt*12,d=f.depthFt*12,s=f.supportFeatureId,in_=(v:number,a:number,b:number)=>v>=a-1e-6&&v<=b+1e-6;
 if(!p)return 'Choose a wood-burning fire ring, a gas fire bowl or a linear gas fire table.';
 if(!in_(w,p.min,p.max))return `A ${p.name.toLowerCase()} is ${p.min} to ${p.max} in ${p.round?'across':'long'}.`;
 if(p.round?Math.abs(w-d)>1e-6:!in_(d,18,24))return p.round?'A round fire feature is as deep as it is wide.':'A linear fire table is 18 to 24 in deep.';
 if(!in_(f.heightIn,12,24))return 'A fire feature body is 12 to 24 in high.';
 if(s!==undefined&&(typeof s!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(s)||s===f.id))return 'A fire feature can only stand on a patio in this design.';
 return NOT_FIRE.some(k=>f[k]!==undefined)?'A fire feature takes only its product, size, height, position and the patio it stands on.':'';
}
registerFireFeatureCheck(fireFeatureProblem);
