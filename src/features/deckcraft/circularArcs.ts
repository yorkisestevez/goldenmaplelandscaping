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
export function validateCircularArcs(value:unknown,points:PlanPoint[],closed:boolean):CircularArc[]{
 if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||value.length>64)throw Error('Use at most 64 circular arcs.');const seen=new Set<number>(),descriptors=Object.getOwnPropertyDescriptors(value);
 if(Reflect.ownKeys(value).some(k=>typeof k!=='string'||k!=='length'&&(!/^(0|[1-9]\d*)$/.test(k)||Number(k)>=value.length)))throw Error('Invalid circular arc fields.');
 return Array.from({length:value.length},(_,i)=>{const entry=descriptors[i];if(!entry||!('value'in entry))throw Error('Invalid circular arc.');const v=entry.value;if(!v||typeof v!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(v)))throw Error('Invalid circular arc.');const fields=Object.getOwnPropertyDescriptors(v);if(Reflect.ownKeys(v).length!==2||!fields.edge||!fields.bulgeIn||!('value'in fields.edge)||!('value'in fields.bulgeIn))throw Error('Invalid circular arc.');const edge=fields.edge.value,bulgeIn=fields.bulgeIn.value;if(!Number.isInteger(edge)||edge<0||edge>=points.length-(closed?0:1)||seen.has(edge)||!Number.isFinite(bulgeIn)||Math.abs(bulgeIn)>960)throw Error('Invalid circular arc.');seen.add(edge);arcGeometry(points[edge],points[(edge+1)%points.length],bulgeIn);return {edge,bulgeIn};});
}
/** Canonical controls stay compact. Validate their whole curved envelope before
 * an edit/import can feed construction, while measuring stock runs analytically. */
export function inspectArcShape(points:PlanPoint[],arcs:CircularArc[]|undefined,closed:boolean,minimumRadiusIn?:number){
 const count=points.length-(closed?0:1);let lengthIn=0;
 for(let i=0;i<count;i++){const a=points[i],b=points[(i+1)%points.length],arc=arcs?.find(c=>c.edge===i);if(arc){const g=arcGeometry(a,b,arc.bulgeIn);if(minimumRadiusIn&&g.radius<minimumRadiusIn-1e-7)throw Error('This wall curve is below the selected system’s minimum radius.');lengthIn+=g.lengthIn;}else lengthIn+=Math.hypot(b.x-a.x,b.y-a.y);}
 const sampled=tessellateArcs(points,arcs,closed);if(sampled.length>1024)throw Error('The curved shape exceeds its geometry budget.');
 if(arcs?.length){
  // Validate exact curve contacts rather than only their drawn facets.
  const tau=Math.PI*2,eps=1e-7;
  const primitives=Array.from({length:count},(_,i)=>{const a=points[i],b=points[(i+1)%points.length],arc=arcs.find(c=>c.edge===i);return {a,b,arc,g:arc?arcGeometry(a,b,arc.bulgeIn):undefined};});
  type Segment=typeof primitives[number];
  const on=(p:PlanPoint,s:Segment)=>{if(s.g){if(Math.abs(Math.hypot(p.x-s.g.center.x,p.y-s.g.center.y)-s.g.radius)>eps)return false;const start=Math.atan2(s.a.y-s.g.center.y,s.a.x-s.g.center.x),angle=Math.atan2(p.y-s.g.center.y,p.x-s.g.center.x),delta=((Math.sign(s.arc!.bulgeIn)*(start-angle))%tau+tau)%tau;return delta<=s.g.sweep+eps||tau-delta<eps;}const dx=s.b.x-s.a.x,dy=s.b.y-s.a.y,cross=(p.x-s.a.x)*dy-(p.y-s.a.y)*dx;return Math.abs(cross)<eps*Math.max(1,Math.hypot(dx,dy))&&p.x>=Math.min(s.a.x,s.b.x)-eps&&p.x<=Math.max(s.a.x,s.b.x)+eps&&p.y>=Math.min(s.a.y,s.b.y)-eps&&p.y<=Math.max(s.a.y,s.b.y)+eps;};
  const contacts=(s:Segment,t:Segment):PlanPoint[]=>{
   if(!s.g&&!t.g){const dx=s.b.x-s.a.x,dy=s.b.y-s.a.y,ex=t.b.x-t.a.x,ey=t.b.y-t.a.y,den=dx*ey-dy*ex;if(Math.abs(den)<eps)return [s.a,s.b,t.a,t.b].filter(p=>on(p,s)&&on(p,t));const u=((t.a.x-s.a.x)*ey-(t.a.y-s.a.y)*ex)/den,p={x:s.a.x+u*dx,y:s.a.y+u*dy};return on(p,s)&&on(p,t)?[p]:[];}
   if(s.g&&t.g){const a=s.g,b=t.g,d=Math.hypot(b.center.x-a.center.x,b.center.y-a.center.y);if(d<eps)return Math.abs(a.radius-b.radius)<eps?[s.a,s.b,t.a,t.b].filter(p=>on(p,s)&&on(p,t)):[];if(d>a.radius+b.radius+eps||d<Math.abs(a.radius-b.radius)-eps)return [];const u=(a.radius*a.radius-b.radius*b.radius+d*d)/(2*d),h=Math.sqrt(Math.max(0,a.radius*a.radius-u*u)),dx=(b.center.x-a.center.x)/d,dy=(b.center.y-a.center.y)/d;return [-1,1].map(sign=>({x:a.center.x+u*dx-sign*h*dy,y:a.center.y+u*dy+sign*h*dx})).filter(p=>on(p,s)&&on(p,t));}
   const circle=s.g?s:t,line=s.g?t:s,g=circle.g!,dx=line.b.x-line.a.x,dy=line.b.y-line.a.y,px=line.a.x-g.center.x,py=line.a.y-g.center.y,A=dx*dx+dy*dy,B=2*(px*dx+py*dy),C=px*px+py*py-g.radius*g.radius,rawDisc=B*B-4*A*C,roundoff=Number.EPSILON*128*Math.max(1,B*B,4*A*(px*px+py*py+g.radius*g.radius)),disc=Math.abs(rawDisc)<=roundoff?0:rawDisc;if(disc<-eps)return [];return [-1,1].map(sign=>{const u=(-B+sign*Math.sqrt(Math.max(0,disc)))/(2*A);return {x:line.a.x+u*dx,y:line.a.y+u*dy};}).filter(p=>on(p,circle)&&on(p,line));
  };
  for(let i=0;i<count;i++)for(let j=i+1;j<count;j++){
   const adjacent=j===i+1||closed&&i===0&&j===count-1,shared=j===i+1?primitives[i].b:primitives[i].a;
   // Tangent neighbours (a fillet or round join beside an arc) meet at their shared point; floating point spreads
   // that single contact by up to ~1e-4 in, so contacts within a thousandth of an inch of it are that same point.
   if(contacts(primitives[i],primitives[j]).some(p=>!adjacent||Math.hypot(p.x-shared.x,p.y-shared.y)>1e-3))throw Error('Circular segments cannot cross or touch another boundary.');
  }
 }

 if(closed){const xs=sampled.map(p=>p.x),ys=sampled.map(p=>p.y);if(Math.max(...xs)-Math.min(...xs)>720+1e-7||Math.max(...ys)-Math.min(...ys)>720+1e-7)throw Error('Keep the complete curved patio within 60 ft across and out.');}
 else if(lengthIn<24-1e-7||lengthIn>2880+1e-7)throw Error('Keep the complete curved wall between 2 and 240 ft.');
 return {lengthIn,sampled};
}
export function bulgeForRadius(a:PlanPoint,b:PlanPoint,radiusIn:number,side=1){const half=Math.hypot(b.x-a.x,b.y-a.y)/2;if(!Number.isFinite(radiusIn)||radiusIn<half)throw Error(`Radius must be at least ${half.toFixed(2)} inches.`);return Math.sign(side||1)*(radiusIn-Math.sqrt(radiusIn*radiusIn-half*half));}
