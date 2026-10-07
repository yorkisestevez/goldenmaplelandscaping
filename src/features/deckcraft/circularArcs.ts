import type {PlanPoint} from './lib/deckGeometry';
export interface CircularArc {edge:number;bulgeIn:number}
export function arcGeometry(a:PlanPoint,b:PlanPoint,bulgeIn:number){
 const chord=Math.hypot(b.x-a.x,b.y-a.y);if(chord<1||!Number.isFinite(bulgeIn)||Math.abs(bulgeIn)<1e-8)throw Error('An arc needs distinct endpoints and a nonzero finite bend.');
 const radius=(chord*chord/4+bulgeIn*bulgeIn)/(2*Math.abs(bulgeIn)),sweep=4*Math.atan(2*Math.abs(bulgeIn)/chord),nx=-(b.y-a.y)/chord,ny=(b.x-a.x)/chord,offset=bulgeIn-Math.sign(bulgeIn)*radius;
 return {radius,sweep,lengthIn:radius*sweep,center:{x:(a.x+b.x)/2+nx*offset,y:(a.y+b.y)/2+ny*offset}};
}
export function sampleArc(a:PlanPoint,b:PlanPoint,bulgeIn:number,toleranceIn=.125):PlanPoint[]{
 const {radius,sweep}=arcGeometry(a,b,bulgeIn),n=Math.min(256,Math.max(2,Math.ceil(sweep/Math.min(Math.PI/36,2*Math.acos(Math.max(-1,1-toleranceIn/radius)))))),signedRadius=Math.sign(bulgeIn)*radius,alpha=2*Math.atan2(2*bulgeIn,Math.hypot(b.x-a.x,b.y-a.y)),ux=(b.x-a.x)/Math.hypot(b.x-a.x,b.y-a.y),uy=(b.y-a.y)/Math.hypot(b.x-a.x,b.y-a.y);
 return Array.from({length:n+1},(_,i)=>{if(!i)return {...a};if(i===n)return {...b};const v=alpha*(2*i/n-1),along=Math.hypot(b.x-a.x,b.y-a.y)/2+signedRadius*Math.sin(v),across=bulgeIn-2*signedRadius*Math.sin(v/2)**2;return {x:a.x+ux*along-uy*across,y:a.y+uy*along+ux*across};});
}
export function tessellateArcs(points:PlanPoint[],arcs:CircularArc[]|undefined,closed:boolean){if(!arcs?.length)return points;const out:PlanPoint[]=[];for(let i=0;i<points.length-(closed?0:1);i++){const a=points[i],b=points[(i+1)%points.length],arc=arcs.find(c=>c.edge===i);out.push(...(arc?sampleArc(a,b,arc.bulgeIn).slice(0,-1):[a]));}if(!closed)out.push(points.at(-1)!);return out;}
export function bulgeForRadius(a:PlanPoint,b:PlanPoint,radiusIn:number,side=1){const half=Math.hypot(b.x-a.x,b.y-a.y)/2;if(!Number.isFinite(radiusIn)||radiusIn<half)throw Error(`Radius must be at least ${half.toFixed(2)} inches.`);return Math.sign(side||1)*(radiusIn-Math.sqrt(radiusIn*radiusIn-half*half));}
