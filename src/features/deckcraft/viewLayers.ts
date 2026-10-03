/** Preview-only state. Never pass this through design persistence or takeoff. */
export const VIEW_LAYER_LABELS={
  skirting:'Skirting boards',skirtingFraming:'Skirting support framing',
  deckBoards:'Deck boards & borders',fascia:'Fascia finish',joists:'Joists',blocking:'Blocking & breaker supports',beams:'Beams',rim:'Rim framing',supportPosts:'Support posts',footings:'Footings / piles',stairBoards:'Stair treads & risers',stringers:'Stair framing / stringers',railings:'Railings',hardware:'Connectors & screws',extras:'Benches, privacy & pergola',drainage:'Under-deck drainage',lighting:'Light fixtures',house:'House',ground:'Ground / grass',
} as const;
export type ViewLayer=keyof typeof VIEW_LAYER_LABELS;
export type ViewLayers=Record<ViewLayer,boolean>;
export const ALL_VIEW_LAYERS=Object.keys(VIEW_LAYER_LABELS) as ViewLayer[];
export const allViewLayers=(visible:boolean):ViewLayers=>Object.fromEntries(ALL_VIEW_LAYERS.map(k=>[k,visible])) as ViewLayers;
export const FINISHED_VIEW:ViewLayers={...allViewLayers(true),hardware:false};
export const VIEW_PRESETS={
  finished:FINISHED_VIEW,
  framing:{...allViewLayers(false),joists:true,blocking:true,beams:true,rim:true,supportPosts:true,stringers:true,skirtingFraming:true},
  foundations:{...allViewLayers(false),supportPosts:true,footings:true},
  connections:{...allViewLayers(false),joists:true,blocking:true,beams:true,rim:true,supportPosts:true,stringers:true,hardware:true,skirtingFraming:true},
} satisfies Record<string,ViewLayers>;
export type ViewPreset=keyof typeof VIEW_PRESETS;
export function resolveViewLayers(explicit?:ViewLayers,structure=false,cutaway=false,hardware=false):ViewLayers{
  if(explicit)return explicit;
  // Map legacy mode props for callers without independent layer controls.
  return {...FINISHED_VIEW,deckBoards:!structure,fascia:!structure,hardware:hardware||structure,house:!cutaway,ground:!cutaway};
}
export const matchingViewPreset=(layers:ViewLayers)=>(Object.keys(VIEW_PRESETS) as ViewPreset[]).find(p=>ALL_VIEW_LAYERS.every(k=>VIEW_PRESETS[p][k]===layers[k]));
