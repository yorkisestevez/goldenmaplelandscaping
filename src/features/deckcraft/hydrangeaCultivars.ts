/** Hydrangea species built by the in-repo hydrangea models (viewer3d/hydrangea) instead of the shared shrub GLB.
 * Render only: saved designs keep their species record and the rounded-shrub asset id. */
export type HydrangeaCultivar='limelight'|'annabelle'|'endless-summer';
const BY_SPECIES:Record<string,HydrangeaCultivar>={
 'hydrangea-paniculata':'limelight',
 'hydrangea-arborescens-annabelle':'annabelle',
 'hydrangea-macrophylla-endless-summer':'endless-summer',
};
export const hydrangeaCultivar=(speciesId?:string):HydrangeaCultivar|undefined=>speciesId?BY_SPECIES[speciesId]:undefined;
/** Triangles at each level of detail for a palette-size plant, measured from the builder (check-hydrangeas keeps them
 * within 30 %): the render-level budget spends on these instead of the shrub GLB's. */
export const HYDRANGEA_TRIANGLES:Record<HydrangeaCultivar,[number,number,number]>={limelight:[34618,5448,3512],annabelle:[30332,5998,3568],'endless-summer':[14414,3030,2054]};
export const hydrangeaTriangleCounts=(speciesId?:string)=>{const c=hydrangeaCultivar(speciesId);return c?HYDRANGEA_TRIANGLES[c]:undefined;};
