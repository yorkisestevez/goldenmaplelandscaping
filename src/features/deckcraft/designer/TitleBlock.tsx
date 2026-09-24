import {priceBookLabel} from '../priceBook';
import type {DeckData} from '../types';

/**
 * The drawing's title block, ruled cells as on a drafting sheet: the project, the deck, the drawing on screen (the site
 * plan and the 2D framing plan have the 1 ft grid) and the price book. The designer's only captions live here. The date
 * arrives once the page runs (`today` is empty before), so the prerendered page, built on another day, never disagrees
 * with it.
 */
export default function TitleBlock({data,area,drawing,grid,sheet,today}:{data:DeckData;area:number;drawing:'Site plan'|'3D view'|'Framing';grid:boolean;sheet:number;today:string}){
  const cells:[string,string,1?][]=[
    ['Project',data.customerName.trim()||'Your deck',1],
    ['Address',data.projectAddress.trim()||'Not given',1],
    ['Deck',`${data.width} × ${data.length} ft · ${data.height} in high · ${Math.round(area)} sq ft`,1],
    ['Drawing',drawing],
    ['Grid',grid?'1 ft':'Plans only'],
    ['Price book',priceBookLabel(),1],
    ['Date',today],
    ['Sheet',`${sheet} of 3`],
  ];
  return <dl className="dd-title-block" aria-label="Drawing title block">
    {cells.map(([term,value,wide])=><div key={term} data-wide={wide}><dt>{term}</dt><dd>{value}</dd></div>)}
  </dl>;
}
