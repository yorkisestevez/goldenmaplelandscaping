import type {DeckData} from '../../types';
import {getHouseConfig} from '../../houseSettings';
import {getHousePlacement} from '../../housePlacement';

export function houseLayout(data:DeckData,width:number){
  const visible=data.houseVisible??true;
  const {x0:minX,x1:maxX}=getHousePlacement(data);
  const config=getHouseConfig(data),depth=config.depthFt*12,wallHeight=config.storeys*config.storeyHeightIn,roofRise=config.roofShape==='Flat'?6:Math.min(maxX-minX,config.roofShape==='Hip'?depth:Infinity)*.24;
  const doorWidth=Math.min(maxX-minX-48,Math.max(30,data.houseDoorWidthIn??76)),doorX=doorWidth/2+(width-doorWidth)*(data.houseDoorOffset??50)/100;
  const windows:{x:number;y:number;w:number;h:number}[]=[];
  for(const [a,b] of [[minX+20,doorX-doorWidth/2-20],[doorX+doorWidth/2+20,maxX-20]]){const available=b-a;if(available<40)continue;const count=available>132?2:1;for(let i=0;i<count;i++)windows.push({x:a+available*(i+.5)/count,y:Math.max(data.height+44,58),w:Math.min(48,available/count-16),h:48});}
  return {visible,minX,maxX,depth,wallHeight,roofRise,doorWidth,doorX,windows,config};
}
