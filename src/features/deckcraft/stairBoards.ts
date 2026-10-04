import type {DeckData} from './types';
import type {Box,DeckTakeoff} from './deckTakeoff';
import {clipToConvex,type PlanPoint} from './lib/deckGeometry';

import {polygonCut,polygonBoard,splitBoard} from './lib/polygonCuts';
export type StairBoard=Box&{role?:'border'|'field'};

/** Actual board cuts covering tread assemblies. Winder strips run world Z,
 * perpendicular to the shared model's transverse tread supports. */
export function getStairBoards(data:DeckData,model:DeckTakeoff):StairBoard[]{
  const pieces:StairBoard[]=[];
  for(const tread of model.treads){
    const yaw=tread.kind==='winder'?-Math.PI/2:tread.angle||0,c=Math.cos(yaw),s=Math.sin(yaw);
    const poly:PlanPoint[]=tread.polygon||[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>({x:tread.x+c*u*tread.w/2+s*v*tread.d/2,y:tread.z-s*u*tread.w/2+c*v*tread.d/2}));
    const local=poly.map(p=>({x:c*p.x-s*p.y,y:s*p.x+c*p.y}));
    const minU=Math.min(...local.map(p=>p.x)),maxU=Math.max(...local.map(p=>p.x)),minV=Math.min(...local.map(p=>p.y)),maxV=Math.max(...local.map(p=>p.y));
    if(data.pictureFrameRows||data.pattern==='Picture Frame'){
      // A stair gets one front nosing and two mitred end boards; the riser closes its rear.
      const w=Math.min(data.boardWidth,(maxU-minU)/3,(maxV-minV)/2),g=model.stairSupport.boardGapIn;
      const left=[{x:minU,y:minV},{x:minU+w,y:minV},{x:minU+w,y:maxV-w-g/2},{x:minU,y:maxV-g/2}];
      const right=left.map(p=>({x:minU+maxU-p.x,y:p.y})).reverse();
      const front=[{x:minU+g/2,y:maxV},{x:minU+w+g/2,y:maxV-w},{x:maxU-w-g/2,y:maxV-w},{x:maxU-g/2,y:maxV}];
      const emit=(polys:PlanPoint[][],angle:number,role:'border'|'field')=>{for(const poly of polys){const world=poly.map(p=>({x:c*p.x+s*p.y,y:-s*p.x+c*p.y}));for(const b of splitBoard(polygonBoard(world,angle-yaw*180/Math.PI,role),data.boardWidth,model.stockLength,model.gap))pieces.push({x:b.cx,y:tread.y,z:b.cy,w:b.length,h:tread.h,d:b.width!,angle:-b.angleDeg*Math.PI/180,polygon:b.polygon,role});}};
      for(const [poly,angle] of [[left,90],[right,90],[front,0]] as [PlanPoint[],number][])emit(polygonCut([local],[poly]),angle,'border');
      for(let v=minV+model.stairSupport.rearGapIn;v<maxV-w-g;v+=data.boardWidth+g){const hi=Math.min(v+data.boardWidth,maxV-w-g);emit(polygonCut([local],[[{x:minU+w+g,y:v},{x:maxU-w-g,y:v},{x:maxU-w-g,y:hi},{x:minU+w+g,y:hi}]]),0,'field');}
      continue;
    }
    for(let v=minV+(tread.kind==='winder'?0:model.stairSupport.rearGapIn);v<maxV-.001;v+=data.boardWidth+model.stairSupport.boardGapIn){
      const endV=Math.min(maxV,v+data.boardWidth);
      for(let u=minU;u<maxU-.001;u+=model.stockLength+model.gap){
        const endU=Math.min(maxU,u+model.stockLength),cut=clipToConvex(local,[{x:u,y:v},{x:endU,y:v},{x:endU,y:endV},{x:u,y:endV}]);
        if(cut.length<3)continue;
        const area=Math.abs(cut.reduce((sum,p,i)=>{const q=cut[(i+1)%cut.length];return sum+p.x*q.y-q.x*p.y;},0))/2;if(area<.05)continue;
        const lo=Math.min(...cut.map(p=>p.x)),hi=Math.max(...cut.map(p=>p.x)),vl=Math.min(...cut.map(p=>p.y)),vh=Math.max(...cut.map(p=>p.y)),uc=(lo+hi)/2,vc=(vl+vh)/2;
        pieces.push({x:c*uc+s*vc,y:tread.y,z:-s*uc+c*vc,w:hi-lo,h:tread.h,d:vh-vl,angle:yaw,polygon:cut.map(p=>({x:c*p.x+s*p.y,y:-s*p.x+c*p.y}))});
      }
    }
  }
  return pieces;
}
