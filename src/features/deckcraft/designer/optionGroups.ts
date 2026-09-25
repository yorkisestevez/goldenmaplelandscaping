import {DECKING_CATALOGUE,RAILING_CATALOGUE} from '../manufacturerCatalog';
import type {DeckData} from '../types';
import {selectPatch} from './selectPatch';
import type {SectionId} from './sections';

/**
 * The option groups whose price effect each option shows (R6), and what picking an option does to the design. The
 * section bodies render these choices and apply these patches, and optionDeltas.ts prices exactly the same patches, so a
 * delta beside an option is what picking it does to the priced subtotal. Pure: no engine, no React.
 */
export const BOARD_LAYOUTS=['Straight','Diagonal','Picture Frame','Herringbone'] as const;
export const FASTENERS=['Face','Hidden'] as const;
export const BORDER_ROWS=[0,1,2] as const;
export const RAILING_STYLES=['None','Wood Picket','Aluminum','Cable','Glass Panels','Frameless Glass','Fortress AL13','TT Classic','TT Impression'] as const;
export const STAIR_FLIGHTS=[0,1,2,3] as const;
export const STAIR_LAYOUTS=['Straight','Landing','Winder'] as const;
export const FOUNDATIONS=['Concrete Piers','Helical Piles','Deck Blocks'] as const;
/** The decking collections offered (hidden ones stay out). */
export const COLLECTIONS=DECKING_CATALOGUE.filter(m=>!m.isHidden);

/** Picking a collection takes its first colour. */
export const collectionPatch=(m:{id:string;colors:readonly {name:string}[]}):Partial<DeckData>=>({deckingMaterial:m.id,deckingColor:m.colors[0].name});
/** Picking a manufacturer railing takes its base style; the generic choice ('') drops it. */
export function catalogueRailingPatch(id:string):Partial<DeckData>{
  const rail=RAILING_CATALOGUE.find(r=>r.id===id);
  return rail?{catalogueRailingId:rail.id,railingType:rail.baseType}:{catalogueRailingId:undefined};
}

export type OptionGroupId='collection'|'pattern'|'fasteningSystem'|'pictureFrameRows'|'railingType'|'catalogueRailing'|'stairFlights'|'stairType'|'foundation';
export interface OptionChoice{value:string;label:string;patch:Partial<DeckData>}
export interface OptionGroup{id:OptionGroupId;current:string;choices:OptionChoice[]}

const count=(n:number,one:string,many:string)=>`${n} ${n===1?one:many}`;
const LABELS:Partial<Record<OptionGroupId,(v:number)=>string>>={stairFlights:v=>count(v,'flight','flights'),pictureFrameRows:v=>count(v,'row','rows')};
/** A select's group: its choices, each with the patch the select makes (selectPatch). */
function selectGroup(id:OptionGroupId&keyof DeckData,choices:readonly (string|number)[],data:DeckData):OptionGroup{
  return {id,current:String(data[id]),choices:choices.map(v=>({value:String(v),label:typeof v==='number'?LABELS[id]?.(v)??String(v):v,patch:selectPatch(id,v)}))};
}

/** A section's option groups, in page order; a section without any has none. */
export function optionGroups(section:SectionId,data:DeckData):OptionGroup[]{
  switch(section){
    case 'boards':return [
      {id:'collection',current:data.deckingMaterial,choices:COLLECTIONS.map(m=>({value:m.id,label:m.name,patch:collectionPatch(m)}))},
      selectGroup('pattern',BOARD_LAYOUTS,data),selectGroup('fasteningSystem',FASTENERS,data),selectGroup('pictureFrameRows',BORDER_ROWS,data),
    ];
    case 'stairs':return [
      selectGroup('railingType',RAILING_STYLES,data),
      {id:'catalogueRailing',current:data.catalogueRailingId??'',choices:[{value:'',label:'Generic style',patch:catalogueRailingPatch('')},...RAILING_CATALOGUE.map(r=>({value:r.id,label:r.name,patch:catalogueRailingPatch(r.id)}))]},
      selectGroup('stairFlights',STAIR_FLIGHTS,data),selectGroup('stairType',STAIR_LAYOUTS,data),
    ];
    case 'site':return [selectGroup('foundation',FOUNDATIONS,data)];
    default:return [];
  }
}
