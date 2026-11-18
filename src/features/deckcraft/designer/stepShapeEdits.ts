import type {YardFeature} from '../types';
import {convertStoneSteps,type StepFlight} from '../stepAssembly';

export function stepShapeContext(feature:YardFeature,flightId?:string){
 const converted=feature.stoneSteps?convertStoneSteps(feature):feature;
 const assembly=converted.stepAssembly;
 const flight=assembly?.flights.find(f=>f.id===flightId)??(!flightId?assembly?.flights[0]:undefined);
 if(!assembly||!flight)return null;
 const angle=(feature.rotationDeg+flight.rotationDeg)*Math.PI/180,base=feature.rotationDeg*Math.PI/180;
 const origin={x:feature.xFt*12+Math.cos(base)*flight.xIn-Math.sin(base)*flight.zIn,y:feature.zFt*12+Math.sin(base)*flight.xIn+Math.cos(base)*flight.zIn};
 const world=(x:number,y:number)=>({x:origin.x+Math.cos(angle)*x-Math.sin(angle)*y,y:origin.y+Math.sin(angle)*x+Math.cos(angle)*y});
 const local=(p:{x:number;y:number})=>({x:(p.x-origin.x)*Math.cos(angle)+(p.y-origin.y)*Math.sin(angle),y:-(p.x-origin.x)*Math.sin(angle)+(p.y-origin.y)*Math.cos(angle)});
 const depth=(flight.rows-1)*flight.runIn+(flight.tread??assembly.tread).depthIn;
 return {feature:converted,assembly,flight,world,local,depth};
}
export type StepShapeContext=NonNullable<ReturnType<typeof stepShapeContext>>;
export function resizeStepSide(c:StepShapeContext,side:-1|1,x:number):YardFeature{
 const p=c.flight,delta=Math.round((side*x-p.widthIn/2)*4)/4;
 const widths=[p.widthIn,...p.rowOverrides.flatMap(o=>o.widthIn===undefined?[]:[o.widthIn]),...(p.layout==='flared'?[p.widthIn+(p.rows-1)*p.wideningIn]:[])];
 const change=Math.max(12-Math.min(...widths),Math.min(720-Math.max(...widths),delta));
 const angle=p.rotationDeg*Math.PI/180;
 return withFlight(c,{widthIn:p.widthIn+change,xIn:p.xIn+Math.cos(angle)*side*change/2,zIn:p.zIn+Math.sin(angle)*side*change/2,rowOverrides:p.rowOverrides.map(o=>o.widthIn===undefined?o:{...o,widthIn:o.widthIn+change})});
}
export function wrapStepCorner(c:StepShapeContext,side:'left'|'right'):YardFeature{
 const p=c.flight;
 if(p.layout==='curved')throw Error('Choose a straight layout before wrapping a rectangular corner.');
 if(p.layout==='wraparound')return withFlight(c,{wrapSides:[...new Set([...p.wrapSides,side])]});
 // Keep the upper edge fixed when the descending rows turn around the platform.
 const offset=(c.depth+p.wrapDepthIn)/2,angle=p.rotationDeg*Math.PI/180;
 return withFlight(c,{layout:'wraparound',wrapSides:['back',side],xIn:p.xIn-Math.sin(angle)*offset,zIn:p.zIn+Math.cos(angle)*offset});
}
function withFlight(c:StepShapeContext,patch:Partial<StepFlight>):YardFeature{return {...c.feature,stepAssembly:{...c.assembly,flights:c.assembly.flights.map(p=>p.id===c.flight.id?{...p,...patch}:p)}};}
