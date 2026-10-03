import type {DeckTakeoff} from '../deckTakeoff';

type Flight=DeckTakeoff['flights'][number];
/** Unrolled walking-surface section. Winder stock has three treads and two
 * drops along its actual quarter-circle centre walkline. */
export function refitFlightGeometry(f:Flight,referenceTop=f.start.y){
 const winder=!!f.winderCenter&&Number.isFinite(f.winderRadiusIn)&&f.winderRadiusIn!>0;
 const length=winder?f.winderRadiusIn!*Math.PI/2:(f.risers-1)*f.run,offset=referenceTop-f.start.y+6;
 const points:[number,number][]=[];
 if(winder){points.push([0,offset],[length/3,offset],[length/3,offset+f.rise],[2*length/3,offset+f.rise],[2*length/3,offset+2*f.rise],[length,offset+2*f.rise]);}
 else {points.push([0,offset]);for(let i=1;i<=f.risers;i++){points.push([(i-1)*f.run,offset+i*f.rise]);if(i<f.risers)points.push([i*f.run,offset+i*f.rise]);}}
 return {winder,length,points};
}
export default function RefitGeometry({before,after}:{before:DeckTakeoff;after:DeckTakeoff}){
 const flights=after.flights.filter(f=>f.kind==='grade');
 return <div>{flights.map(f=>{
  const old=before.flights.find(p=>p.id===f.id),current=old?refitFlightGeometry(old,f.start.y):undefined,next=refitFlightGeometry(f),height=Math.max(f.start.y-f.end.y,old?f.start.y-old.end.y:0)+12,width=Math.max(next.length,current?.length??0)+36,path=(geometry:ReturnType<typeof refitFlightGeometry>)=>geometry.points.map(p=>p.join(',')).join(' ');
  return <figure key={f.id}><figcaption>{f.id}: dashed current; red proposed · {next.winder?`winder walkline ${next.length.toFixed(2)} in · 3 treads`:`run ${next.length.toFixed(2)} in · going ${f.run.toFixed(2)} in`}; {f.risers} × {f.rise.toFixed(3)} in risers</figcaption><svg aria-label={`Stair geometry preview ${f.id}${next.winder?' along curved walkline':''}`} role="img" viewBox={`-6 0 ${width+12} ${Math.max(height,width/3)}`} style={{width:'100%',maxHeight:160}}>{current&&<polyline points={path(current)} fill="none" stroke="#64748b" strokeDasharray="5 3" strokeWidth="2" vectorEffect="non-scaling-stroke"/>}<polyline points={path(next)} fill="none" stroke="#b43c2f" strokeWidth="2" vectorEffect="non-scaling-stroke"/></svg></figure>;
 })}</div>;
}
