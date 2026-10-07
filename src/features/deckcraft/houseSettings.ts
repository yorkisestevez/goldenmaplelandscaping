import type {DeckData,DoorStyle,HouseCladding,HouseConfig,HouseOpening,RoofFinish} from './types';
import {getFootprint} from './lib/deckGeometry';
import {getHouseContact} from './houseContact';
import {getHousePlacement} from './housePlacement';

/** A house colour: six-digit hex. */
export const HEX_COLOUR=/^#[0-9a-fA-F]{6}$/;
/** The house exterior colour fields, in the order the studio lists them (their looks are in houseFinishes.ts). */
export const HOUSE_COLOUR_FIELDS=['fasciaColor','soffitColor','gutterColor','doorColor','windowColor','garageDoorColor'] as const;
export type HouseColourField=typeof HOUSE_COLOUR_FIELDS[number];
/** House looks (never priced). The first six are the studio's original claddings; the rest are generic types. */
export const HOUSE_CLADDINGS:readonly HouseCladding[]=['Siding','Brick','Stone','Stucco','Board & batten','Vertical siding','Fibre-cement lap','Cedar shakes','Ledgestone','Fieldstone','Norman brick','Roman brick','Horizontal metal'];
/** The studio's first six claddings. */
export const ORIGINAL_HOUSE_CLADDINGS:readonly HouseCladding[]=HOUSE_CLADDINGS.slice(0,6);
/** Roof finishes as the studio lists them. The originals keep their stored values ('Shingles', 'Metal'). */
export const ROOF_FINISHES:readonly RoofFinish[]=['Shingles','Architectural shingles','Metal','Cedar shakes','Slate','Clay tile','Concrete tile'];
export const ROOF_FINISH_LABELS:Record<RoofFinish,string>={Shingles:'Asphalt shingles (3-tab)','Architectural shingles':'Architectural shingles',Metal:'Standing-seam metal','Cedar shakes':'Cedar shakes',Slate:'Slate','Clay tile':'Clay tile','Concrete tile':'Concrete tile'};
export const DOOR_STYLES:readonly DoorStyle[]=['Single','French','Sliding'];
/** Roof pitch, rise per 12 of run. */
export const ROOF_PITCH_RANGE=[3,12] as const;

/** House dimensions and opening elevations are measured from grade. Front faces the deck. */
export function getHouseConfig(data:DeckData):HouseConfig{
  if(data.houseConfig)return data.houseConfig;
  const widthFt=data.width+11,doorWidth=Math.min(data.houseDoorWidthIn??72,data.width*12-12),doorCenter=doorWidth/2+(data.width*12-doorWidth)*(data.houseDoorOffset??50)/100+66;
  const openings:HouseOpening[]=[{id:'deck-door',type:'Door',facade:'Front',offsetPct:doorCenter/(widthFt*12)*100,bottomIn:data.height,widthIn:doorWidth,heightIn:84}];
  const house:HouseConfig={widthFt,depthFt:Math.min(25,Math.max(16,data.width*.95)),storeys:1,storeyHeightIn:Math.max(data.houseWallHeightIn??132,data.height+96),roofShape:'Gable',roofFinish:'Shingles',roofColor:'#424748',cladding:'Siding',claddingColor:'#c5c7be',trimColor:'#f0eee6',openings};
  // Resolve geometry with this explicit provisional house, preventing recursive
  // default-house generation. Only synthetic openings move; measured ones return above.
  const configured={...data,houseConfig:house},fp=getFootprint(configured,1),contact=getHouseContact(configured,fp),placement=getHousePlacement(configured);
  const terminals=data.railingType==='None'?[]:fp.outline.flatMap((a,i)=>contact.isContactEdge(i)?[]:[a,fp.outline[(i+1)%fp.outline.length]]).filter(p=>Math.abs(p.y)<.5&&p.x>=placement.x0&&p.x<=placement.x1).map(p=>p.x-placement.x0);
  const gaps=(from:number,to:number)=>{let free:[number,number][]=[[from,to]];for(const x of terminals)free=free.flatMap(([a,b])=>x+12<=a||x-12>=b?[[a,b]]:[...(x-12>a?[[a,x-12] as [number,number]]:[]),...(x+12<b?[[x+12,b] as [number,number]]:[])]);return free.filter(([a,b])=>b-a>=24).sort((a,b)=>(b[1]-b[0])-(a[1]-a[0]))[0];};
  for(const [id,a,b] of [['front-window-left',6,doorCenter-doorWidth/2-18],['front-window-right',doorCenter+doorWidth/2+18,widthFt*12-6]] as const){
    const span=gaps(a,b);if(!span)continue;const widthIn=Math.min(48,span[1]-span[0]);
    // Illustrative high-sill windows also stay above the foreground guard in
    // the Front view. Fit their height within the unchanged wall/roof envelope.
    const bottomIn=data.height+60,heightIn=Math.min(54,house.storeyHeightIn-bottomIn-6);
    openings.push({id,type:'Window',facade:'Front',offsetPct:(span[0]+span[1])/2/(widthFt*12)*100,bottomIn,widthIn,heightIn});
  }
  // Generated openings use the importer's exact wall limits before entering editor commands.
  // This avoids one-bit percentage differences being rejected as an unintended geometry change.
  house.openings=house.openings.map(opening=>clampHouseOpening(opening,house));
  return house;
}
/** Length and height (inches) of a house wall by id ('main-front', 'garage1-back', …). An unknown id
 * falls back to the main block's `facade` wall, as older designs have it. */
export function houseWallSize(house:HouseConfig,wallId:string|undefined,facade:HouseOpening['facade']):{length:number;height:number}{
  const [id,side]=(wallId??'').split('-'),block=id&&id!=='main'?house.footprint?.rects.find(b=>b.id===id):undefined;
  if(block&&['front','back','left','right'].includes(side)){
    // A block's sides parallel to the wall it is attached to are as long as its width.
    const parallel=(side==='front'||side==='back')===(block.wall==='Front'||block.wall==='Back');
    return {length:(parallel?block.widthFt:block.depthFt)*12,height:(block.storeys??1)*house.storeyHeightIn};
  }
  const mainSide=id==='main'&&['front','back','left','right'].includes(side)?side:facade.toLowerCase();
  return {length:(mainSide==='front'||mainSide==='back'?house.widthFt:house.depthFt)*12,height:house.storeys*house.storeyHeightIn};
}
export function clampHouseOpening(opening:HouseOpening,house:HouseConfig):HouseOpening{
  const {length:wallWidth,height:wallHeight}=houseWallSize(house,opening.wallId,opening.facade);
  const widthIn=Math.min(opening.widthIn,wallWidth-12),heightIn=Math.min(opening.heightIn,wallHeight-12);
  const halfPct=(widthIn/2+6)/wallWidth*100;
  return {...opening,widthIn,heightIn,offsetPct:Math.max(halfPct,Math.min(100-halfPct,opening.offsetPct)),bottomIn:Math.max(0,Math.min(wallHeight-heightIn-6,opening.bottomIn))};
}
