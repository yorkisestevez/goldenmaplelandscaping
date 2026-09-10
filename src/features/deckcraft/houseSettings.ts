import type {DeckData,HouseConfig,HouseOpening} from './types';

/** House dimensions and opening elevations are measured from grade. Front faces the deck. */
export function getHouseConfig(data:DeckData):HouseConfig{
  if(data.houseConfig)return data.houseConfig;
  const widthFt=data.width+11,doorWidth=Math.min(data.houseDoorWidthIn??72,data.width*12-12),doorCenter=doorWidth/2+(data.width*12-doorWidth)*(data.houseDoorOffset??50)/100+66;
  const openings:HouseOpening[]=[{id:'deck-door',type:'Door',facade:'Front',offsetPct:doorCenter/(widthFt*12)*100,bottomIn:data.height,widthIn:doorWidth,heightIn:84}];
  const leftSpace=doorCenter-doorWidth/2-18,rightSpace=widthFt*12-doorCenter-doorWidth/2-18;
  if(leftSpace>=40)openings.push({id:'front-window-left',type:'Window',facade:'Front',offsetPct:(leftSpace/2)/(widthFt*12)*100,bottomIn:48,widthIn:Math.min(48,leftSpace-12),heightIn:54});
  if(rightSpace>=40)openings.push({id:'front-window-right',type:'Window',facade:'Front',offsetPct:(widthFt*12-rightSpace/2)/(widthFt*12)*100,bottomIn:48,widthIn:Math.min(48,rightSpace-12),heightIn:54});
  return {widthFt,depthFt:Math.min(25,Math.max(16,data.width*.95)),storeys:1,storeyHeightIn:Math.max(data.houseWallHeightIn??132,data.height+96),roofShape:'Gable',roofFinish:'Shingles',roofColor:'#424748',cladding:'Siding',claddingColor:'#c5c7be',trimColor:'#f0eee6',openings};
}
export function clampHouseOpening(opening:HouseOpening,house:HouseConfig):HouseOpening{
  const wallWidth=(opening.facade==='Front'||opening.facade==='Back'?house.widthFt:house.depthFt)*12;
  const wallHeight=house.storeys*house.storeyHeightIn;
  const widthIn=Math.min(opening.widthIn,wallWidth-12),heightIn=Math.min(opening.heightIn,wallHeight-12);
  const halfPct=(widthIn/2+6)/wallWidth*100;
  return {...opening,widthIn,heightIn,offsetPct:Math.max(halfPct,Math.min(100-halfPct,opening.offsetPct)),bottomIn:Math.max(0,Math.min(wallHeight-heightIn-6,opening.bottomIn))};
}
