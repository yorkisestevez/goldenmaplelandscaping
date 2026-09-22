import type {DeckData} from '../../types';
import {getHouseConfig} from '../../houseSettings';
import {getHousePlacement} from '../../housePlacement';

/** Roof rise (inches) over the span a roof crosses. With a pitch (rise per 12 of run), rise = span/2 × pitch/12;
 * without one, the studio's original 0.24 × span, so older designs keep their roof. */
export const roofRiseOver=(span:number,pitch?:number)=>pitch===undefined?span*.24:span/2*pitch/12;

export function houseLayout(data:DeckData,width:number){
  const visible=data.houseVisible??true;
  const {x0:minX,x1:maxX}=getHousePlacement(data);
  const config=getHouseConfig(data),depth=config.depthFt*12,wallHeight=config.storeys*config.storeyHeightIn;
  // Rise over the span the roof crosses: the studio's original height (0.24 × span) unless a pitch is set.
  const across=config.roofShape==='Hip'?Math.min(maxX-minX,depth):config.ridge==='x'?depth:maxX-minX,roofRise=config.roofShape==='Flat'?6:roofRiseOver(across,config.roofPitch);
  const doorWidth=Math.min(maxX-minX-48,Math.max(30,data.houseDoorWidthIn??76)),doorX=doorWidth/2+(width-doorWidth)*(data.houseDoorOffset??50)/100;
  const windows:{x:number;y:number;w:number;h:number}[]=[];
  for(const [a,b] of [[minX+20,doorX-doorWidth/2-20],[doorX+doorWidth/2+20,maxX-20]]){const available=b-a;if(available<40)continue;const count=available>132?2:1;for(let i=0;i<count;i++)windows.push({x:a+available*(i+.5)/count,y:Math.max(data.height+44,58),w:Math.min(48,available/count-16),h:48});}
  return {visible,minX,maxX,depth,wallHeight,roofRise,doorWidth,doorX,windows,config};
}
