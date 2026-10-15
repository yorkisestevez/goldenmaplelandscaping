/** Day → golden hour → night, as a function of path time. The live editor's day/night
 * switch is unchanged; a fly-through applies this only while it is rendering. */
export interface DayLook{
 phase:'day'|'golden'|'night';
 /** Night uses the evening sky, fixtures and window glow. Golden hour stays on the day sky. */
 evening:boolean;
 /** 0 leaves the photographed sky unchanged. 1 is the full amber grade. */
 warmth:number;
 sunElevationDeg:number;
 sunColor:[number,number,number];
 /** Multiplier on the daylight sun. Zero at the end of the night. */
 sunGain:number;
 exposure:number;
}
const DAY:[number,number,number]=[1,.9497,.8998];
const clamp=(n:number,a:number,b:number)=>Math.min(b,Math.max(a,n));
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
const ease=(t:number)=>t*t*(3-2*t);
function mix(a:[number,number,number],b:[number,number,number],t:number):[number,number,number]{
 return [lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)];
}
/** u is 0 at the first frame of the path and 1 at the last instant. */
export function timeOfDayAt(u:number):DayLook{
 const t=clamp(u,0,1);
 if(t<=.42){
  const k=t/.42;
  return {phase:'day',evening:false,warmth:k*.12,sunElevationDeg:lerp(58,26,k),sunColor:mix(DAY,[1,.86,.62],k*.35),sunGain:1,exposure:1};
 }
 if(t<=.7){
  const k=(t-.42)/.28,e=ease(k);
  return {phase:'golden',evening:false,warmth:lerp(.12,1,e),sunElevationDeg:lerp(26,6.5,k),sunColor:mix([1,.86,.62],[1,.55,.22],e),sunGain:lerp(1,.62,e),exposure:lerp(1,1.06,e)};
 }
 const k=(t-.7)/.3,e=ease(k);
 return {phase:'night',evening:true,warmth:lerp(.28,0,e),sunElevationDeg:lerp(6.5,-6,k),sunColor:[1,.5,.22],sunGain:lerp(.4,0,e),exposure:lerp(.9,.74,e)};
}
/** Unit direction of the key light. Azimuth matches the studio sun, in degrees. */
export function sunDirectionAt(elevationDeg:number,azimuthDeg:number):[number,number,number]{
 const el=elevationDeg*Math.PI/180,az=azimuthDeg*Math.PI/180;
 return [Math.cos(el)*Math.cos(az),Math.sin(el),Math.cos(el)*Math.sin(az)];
}
