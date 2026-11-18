import {validateYardFinishedSettings} from './yardFinishedSettings';
import type {YardFeature} from './types';
import type {PlanPoint} from './lib/deckGeometry';
import {arcGeometry,tessellateArcs} from './circularArcs';
import {inspectArcShape} from './circularArcShape';
import {hardscapeProblem} from './hardscapeCatalogue';
import {yardShapeEdit,yardShapeLocalPoints,yardShapeProblem,yardShapeRunIn,yardShapeWorldPoint,yardShapeWorldPoints,YARD_SHAPE_LIMITS} from './yardShapeEditing';

export type YardStarterPreset='rectangle'|'chamfered'|'l-shape'|'rounded'|'straight'|'wall-l'|'arc';
export const YARD_PATIO_STARTERS=[{id:'rectangle',name:'Rectangle'},{id:'chamfered',name:'Chamfered corners'},{id:'l-shape',name:'L shape'},{id:'rounded',name:'Rounded corners'}] as const;
export const YARD_WALL_STARTERS=[{id:'straight',name:'Straight wall'},{id:'wall-l',name:'L wall'},{id:'arc',name:'Curved wall'}] as const;
/** Drawing approximation only: stock dimensions and construction requirements stay with the selected product. */
export const YARD_CURVE_TOLERANCE={maxAngleDeg:5,maxChordErrorIn:.5} as const;
/** Techo-Bloc publishes an 8 ft 6 in minimum radius for Raffinato Smooth wall units.
 * Cap cuts and joint details still require the supplier's layout review. */
export const wallMinimumRadiusIn=(f:YardFeature)=>f.kind==='retaining-wall'&&f.productId==='techo-raffinato-wall'?102:null;
const EPS=1e-7;
const bounds=(p:PlanPoint[])=>{const xs=p.map(q=>q.x),ys=p.map(q=>q.y);return {x0:Math.min(...xs),x1:Math.max(...xs),y0:Math.min(...ys),y1:Math.max(...ys)};};
function editable(f:YardFeature){
 if(f.kind!=='patio'&&f.kind!=='retaining-wall')throw Error('Choose a patio or retaining wall to draw.');
 if(![f.xFt,f.zFt,f.widthFt,f.depthFt,f.heightIn,f.rotationDeg,f.baseElevationIn??0].every(Number.isFinite))throw Error('Use finite feature dimensions and placement before drawing.');
 const saved=f.kind==='patio'?f.outline:f.wallPath,problem=yardShapeProblem(f.kind,saved??yardShapeLocalPoints(f),f.curves)||hardscapeProblem(f);if(problem)throw Error(problem);
 return f.kind;
}

/** Stable circular sagitta construction. The exact endpoints and midpoint are retained explicitly. */
function arcPoints(a:PlanPoint,b:PlanPoint,bulgeIn:number):PlanPoint[]{
 const dx=b.x-a.x,dy=b.y-a.y,chord=Math.hypot(dx,dy);
 if(chord<1-EPS)throw Error('Curve endpoints must be at least 1 inch apart.');
 if(!Number.isFinite(bulgeIn))throw Error('Enter a finite curve bulge in inches.');
 if(bulgeIn===0)return [{...a},{...b}];
 if(Math.abs(bulgeIn)<EPS)throw Error('That curve bulge is too small to measure. Use zero for a straight edge.');
 const radius=(chord*chord/4+bulgeIn*bulgeIn)/(2*bulgeIn),alpha=2*Math.atan2(2*bulgeIn,chord);
 const maxAngle=Math.min(YARD_CURVE_TOLERANCE.maxAngleDeg*Math.PI/180,2*Math.acos(Math.max(-1,1-YARD_CURVE_TOLERANCE.maxChordErrorIn/Math.abs(radius))));
 let segments=Math.ceil(Math.abs(2*alpha)/maxAngle);segments=Math.max(2,segments+(segments%2));
 if(!Number.isFinite(radius)||!Number.isFinite(segments)||segments+1>YARD_SHAPE_LIMITS.points)throw Error('That curve needs more than 64 pull points. Reduce its bulge.');
 const ux=dx/chord,uy=dy/chord,nx=-uy,ny=ux;
 return Array.from({length:segments+1},(_,i)=>{
  if(i===0)return {...a};if(i===segments)return {...b};
  const v=alpha*(2*i/segments-1),along=i===segments/2?chord/2:chord/2+radius*Math.sin(v),across=i===segments/2?bulgeIn:bulgeIn-2*radius*Math.sin(v/2)**2;
  return {x:a.x+ux*along+nx*across,y:a.y+uy*along+ny*across};
 });
}

function patioPoints(preset:YardStarterPreset,w:number,d:number):PlanPoint[]{
 const x=w/2,y=d/2;
 if(preset==='rectangle')return [{x:-x,y:-y},{x,y:-y},{x,y},{x:-x,y}];
 if(preset==='l-shape')return [{x:-x,y:-y},{x,y:-y},{x,y:0},{x:0,y:0},{x:0,y},{x:-x,y}];
 const r=Math.min(w,d)*(preset==='chamfered'?.2:.15);
 if(preset==='chamfered')return [{x:-x+r,y:-y},{x:x-r,y:-y},{x,y:-y+r},{x,y:y-r},{x:x-r,y},{x:-x+r,y},{x:-x,y:y-r},{x:-x,y:-y+r}];
 if(preset!=='rounded')throw Error('Choose a patio starter shape.');
 const segments=Math.max(2,Math.ceil(Math.PI/2/(2*Math.acos(1-.5/r))));
 return [{x:x-r,y:-y+r,start:-Math.PI/2},{x:x-r,y:y-r,start:0},{x:-x+r,y:y-r,start:Math.PI/2},{x:-x+r,y:-y+r,start:Math.PI}].flatMap(c=>Array.from({length:segments+1},(_,i)=>{const a=c.start+i*Math.PI/2/segments;return {x:c.x+r*Math.cos(a),y:c.y+r*Math.sin(a)};}));
}

/** Replace the outline/path at the current centre and rotation. Inlays keep their existing coordinates.
 * Patio starters fit the current across/out dimensions; wall starters retain the measured total run.
 * This changes drawing geometry only and never changes stock, elevation, thickness or reinforcement inputs. */
export function applyYardStarter(f:YardFeature,preset:YardStarterPreset):YardFeature{
 const kind=editable(f);let points:PlanPoint[];
 if(kind==='patio'&&preset==='rounded'){const x=f.widthFt*6,y=f.depthFt*6,r=Math.min(x,y)*.3,bulge=-r*(1-Math.SQRT1_2);points=[{x:-x+r,y:-y},{x:x-r,y:-y},{x,y:-y+r},{x,y:y-r},{x:x-r,y},{x:-x+r,y},{x:-x,y:y-r},{x:-x,y:-y+r}];const next={...f,outline:points,curves:[1,3,5,7].map(edge=>({edge,bulgeIn:bulge}))};inspectArcShape(points,next.curves,true);return validateYardFinishedSettings(next);}
 if(kind==='patio')points=patioPoints(preset,f.widthFt*12,f.depthFt*12);
 else{
  const run=f.widthFt*12;
  if(preset==='straight')points=[{x:-run/2,y:0},{x:run/2,y:0}];
  else if(preset==='wall-l')points=[{x:-run*.3,y:-run*.2},{x:run*.3,y:-run*.2},{x:run*.3,y:run*.2}];
  else if(preset==='arc'){
   const minRadius=wallMinimumRadiusIn(f),sweep=Math.min(2*Math.PI/3,minRadius?run/(minRadius*1.01):2*Math.PI/3);
   const radius=run/sweep,chord=2*radius*Math.sin(sweep/2),bulge=radius*(1-Math.cos(sweep/2));points=[{x:-chord/2,y:-bulge/2},{x:chord/2,y:-bulge/2}];return validateYardFinishedSettings({...f,outline:undefined,wallPath:points,curves:[{edge:0,bulgeIn:bulge}]});
  }else throw Error('Choose a wall starter path.');
 }
 const problem=yardShapeProblem(kind,points);if(problem)throw Error(problem);
 const edited=yardShapeEdit({...f,curves:undefined},points.map(p=>yardShapeWorldPoint(f,p)));if(edited===f)return f;
 // Generated points are centred deliberately. Keep the original datum exactly, avoiding numerical drift.
 return kind==='patio'?{...edited,xFt:f.xFt,zFt:f.zFt,widthFt:f.widthFt,depthFt:f.depthFt,outline:points,...(f.inlays?{inlays:f.inlays}:{})}:{...edited,xFt:f.xFt,zFt:f.zFt,widthFt:f.widthFt,depthFt:f.depthFt,wallPath:points};
}

/** Bend one existing plan edge into a circular arc. Positive bulge moves its midpoint to the chord's
 * left normal in plan x/y. Remaining endpoints and patio inlays keep their world locations.
 * Saved geometry retains exact circular definitions. Geometry consumers tessellate them.
 * Invalid intersections, short segments, point counts or feature dimensions reject the whole edit. */
export function curveYardEdge(f:YardFeature,index:number,bulgeIn:number):YardFeature{
 const kind=editable(f),points=yardShapeLocalPoints(f),edgeCount=kind==='patio'?points.length:points.length-1;
 if(!Number.isInteger(index)||index<0||index>=edgeCount)throw Error('Choose an existing edge to curve.');
 if(!Number.isFinite(bulgeIn)||Math.abs(bulgeIn)>960)throw Error('Enter a finite bend within 80 feet.');
 if(!bulgeIn&&!f.curves?.length)return f;
 const curves=(f.curves??[]).filter(c=>c.edge!==index);
 if(bulgeIn){const g=arcGeometry(points[index],points[(index+1)%points.length],bulgeIn),min=wallMinimumRadiusIn(f);if(min&&g.radius<min-1e-7)throw Error('Raffinato Smooth wall needs at least an 8 ft 6 in curve radius.');curves.push({edge:index,bulgeIn});}
 inspectArcShape(points,curves,kind==='patio',wallMinimumRadiusIn(f)??undefined);
 const sampled=tessellateArcs(points,curves,kind==='patio');
 // Validate all sampled intersections; the canonical shape retains its control points and exact bends.
 const total=sampled.length;if(total>1024)throw Error('This curve exceeds the geometry budget.');
 const crosses=(a:PlanPoint,b:PlanPoint,c:PlanPoint,d:PlanPoint)=>{const cross=(p:PlanPoint,q:PlanPoint,r:PlanPoint)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);return cross(a,b,c)*cross(a,b,d)<-1e-8&&cross(c,d,a)*cross(c,d,b)<-1e-8;};
 const n=sampled.length-(kind==='patio'?0:1);for(let i=0;i<n;i++)for(let j=i+2;j<n;j++){if(kind==='patio'&&i===0&&j===n-1)continue;if(crosses(sampled[i],sampled[(i+1)%total],sampled[j],sampled[(j+1)%total]))throw Error('Those curves cross. Reduce the bend.');}
 let length=0;for(let i=0;i<edgeCount;i++){const a=points[i],b=points[(i+1)%points.length],c=curves.find(c=>c.edge===i);length+=c?arcGeometry(a,b,c.bulgeIn).lengthIn:Math.hypot(b.x-a.x,b.y-a.y);}
 if(kind==='retaining-wall'&&(length<YARD_SHAPE_LIMITS.wallMinRunIn||length>YARD_SHAPE_LIMITS.wallMaxRunIn))throw Error('Keep the complete wall path between 2 and 240 ft.');
 if(kind==='patio'){const b=bounds(sampled);if(b.x1-b.x0>720||b.y1-b.y0>720)throw Error('Keep the complete patio within 60 ft across and out.');}
 return validateYardFinishedSettings({...f,curves:curves.length?curves:undefined,...(curves.length?(kind==='patio'?{outline:points}:{wallPath:points}):{}),...(kind==='retaining-wall'?{widthFt:length/12}:{})});
}
