/**
 * Freestanding fence runs. Absent on every existing design: rails and screens stay on the deck edge,
 * and nothing here is drawn, priced or saved until a run exists.
 * Plan points are inches (x along the house, y out from the wall). Solids are inches, y up.
 * The yaw stored on a solid is Three.js rotation.y: -atan2(dz, dx), so local +X follows the run.
 */

export type FenceStyleId='cedar-horizontal'|'composite-horizontal'|'board-on-board'|'aluminum-picket'|'glass';
export type FenceSurface='cedar'|'composite'|'metal'|'glass'|'concrete';
export type FenceRole='post'|'rail'|'slat'|'board'|'picket'|'glass'|'gate'|'latch'|'hinge'|'collar';
export type FenceGateKind='single'|'double';

export interface FencePoint {x:number;y:number}
export interface FenceGate {id:string;kind:FenceGateKind;/** Inches from the start of the run, at the centre of the clear opening. */stationIn:number;/** Clear opening, inches. */widthIn:number;selfClosing:boolean;latching:boolean}
export interface FenceRun {
  id:string;name:string;enabled:boolean;style:FenceStyleId;heightFt:number;postSpacingFt:number;slatGapIn:number;
  points:FencePoint[];postColor:string;infillColor:string;finish:string;poolEnclosure:boolean;gates:FenceGate[];
}
export interface FenceSolid {role:FenceRole;surface:FenceSurface;x:number;y:number;z:number;w:number;h:number;d:number;angle:number;color:string;shade:number}
export interface FenceStyle {
  id:FenceStyleId;name:string;postSurface:FenceSurface;infillSurface:FenceSurface;infill:FenceRole;
  heightFt:number;postSpacingFt:number;slatGapIn:number;postSizeIn:number;faceIn:number;thickIn:number;
  postColor:string;infillColor:string;finishes:readonly string[];poolCapable:boolean;
}

export const FENCE_STYLES:Record<FenceStyleId,FenceStyle>={
  'cedar-horizontal':{id:'cedar-horizontal',name:'Modern horizontal slat cedar',postSurface:'metal',infillSurface:'cedar',infill:'slat',heightFt:6,postSpacingFt:8,slatGapIn:.5,postSizeIn:4,faceIn:5.5,thickIn:.75,postColor:'#1a1a1a',infillColor:'#a8754c',finishes:['Natural western red cedar','Light cedar stain','Dark cedar stain','Weathered grey'],poolCapable:false},
  'composite-horizontal':{id:'composite-horizontal',name:'Horizontal composite slat',postSurface:'metal',infillSurface:'composite',infill:'slat',heightFt:6,postSpacingFt:6,slatGapIn:.375,postSizeIn:4,faceIn:5.5,thickIn:.75,postColor:'#2a2a2a',infillColor:'#6b6258',finishes:['Teak capped composite','Charcoal capped composite','Slate capped composite'],poolCapable:false},
  'board-on-board':{id:'board-on-board',name:'Board-on-board cedar',postSurface:'cedar',infillSurface:'cedar',infill:'board',heightFt:6,postSpacingFt:8,slatGapIn:0,postSizeIn:4,faceIn:5.5,thickIn:.75,postColor:'#8d5a32',infillColor:'#a8754c',finishes:['Natural western red cedar','Light cedar stain','Dark cedar stain','Weathered grey'],poolCapable:false},
  'aluminum-picket':{id:'aluminum-picket',name:'Black aluminum picket',postSurface:'metal',infillSurface:'metal',infill:'picket',heightFt:5,postSpacingFt:6,slatGapIn:3.75,postSizeIn:2.5,faceIn:.75,thickIn:.75,postColor:'#1a1a1a',infillColor:'#1a1a1a',finishes:['Black powder coat','Bronze powder coat'],poolCapable:true},
  glass:{id:'glass',name:'Glass panel',postSurface:'metal',infillSurface:'glass',infill:'glass',heightFt:5,postSpacingFt:6,slatGapIn:0,postSizeIn:3,faceIn:0,thickIn:.5,postColor:'#1c1c1c',infillColor:'#d7e8ea',finishes:['Clear glass','Low-iron glass','Frosted glass'],poolCapable:true},
};
export const FENCE_STYLE_IDS=Object.keys(FENCE_STYLES) as FenceStyleId[];

/** Planning note only: frost cover for Barrie / Simcoe, not an engineered footing. */
export const FROST_FOOTING_NOTE='Concrete post footings must extend below frost cover, about 1.2 m (4 ft) in Barrie and Simcoe County. Confirm the depth with the building department and the soil on site. This is a planning note, not an engineered footing.';
/** Planning flag only. Not an approval and not a by-law citation. */
export const POOL_ENCLOSURE_NOTE='Planning flag only: confirm the municipal pool-fence by-law (for example Barrie) for height, maximum openings, and self-closing, self-latching gates before treating this fence as a pool enclosure. This is not an approval.';
/** Openings wider than 100 mm (3.937 in) are called out for pool-fence review. */
export const POOL_OPENING_LIMIT_IN=3.937;

const RAIL_IN=2,POST_EMBED_IN=2,COLLAR_D_IN=10,COLLAR_H_IN=3,MAX_RUNS=24,MAX_POINTS=64,COORD_IN=120_000,MIN_SEGMENT_IN=12,MIN_RUN_IN=48;
const GATE_WIDTH:Record<FenceGateKind,[number,number]>={single:[36,60],double:[72,144]};
const ID=/^[A-Za-z0-9_-]{1,64}$/;
const HEX=/^#[0-9a-fA-F]{6}$/;

function fail(s:string):never{throw Error(s);}
const dist=(a:FencePoint,b:FencePoint)=>Math.hypot(b.x-a.x,b.y-a.y);
function asRecord(v:unknown,label:string):Record<string,unknown>{
  if(!v||typeof v!=='object'||Array.isArray(v))fail(label);
  const proto=Object.getPrototypeOf(v);
  if(proto!==Object.prototype&&proto!==null)fail(label);
  if(Object.getOwnPropertySymbols(v).length)fail(label);
  if(!Object.values(Object.getOwnPropertyDescriptors(v)).every(d=>d.enumerable&&'value' in d))fail(label);
  return v as Record<string,unknown>;
}
function asList(v:unknown,max:number):unknown[]{
  if(!Array.isArray(v)||Object.getPrototypeOf(v)!==Array.prototype||Reflect.ownKeys(v).length!==v.length+1)fail('Fence runs must be a list.');
  if(v.length>max)fail('A design supports up to 24 fence runs.');
  return v;
}
function num(v:unknown,min:number,max:number,label:string):number{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)fail(label);return v;}
function text(v:unknown,max:number,label:string):string{if(typeof v!=='string')fail(label);const s=v.trim();if(!s||s.length>max||/[\u0000-\u001f]/.test(s))fail(label);return s;}
export const fenceStyle=(id:FenceStyleId)=>FENCE_STYLES[id];
export const runLengthIn=(points:readonly FencePoint[])=>points.slice(1).reduce((n,p,i)=>n+dist(points[i],p),0);

function locate(points:readonly FencePoint[],station:number){
  let left=Math.max(0,station);
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],len=dist(a,b);
    if(left<=len+1e-6||i===points.length-1){const t=len?Math.min(1,Math.max(0,left/len)):0,dx=b.x-a.x,dy=b.y-a.y;return {x:a.x+dx*t,y:a.y+dy*t,station:station<0?0:station,seg:i-1,angle:-Math.atan2(dy,dx)};}
    left-=len;
  }
  const a=points.at(-2)!,b=points.at(-1)!;return {x:b.x,y:b.y,station,seg:points.length-2,angle:-Math.atan2(b.y-a.y,b.x-a.x)};
}
function mergeStations(marks:number[],length:number){
  const sorted=[...new Set(marks.map(m=>Math.round(m*1e6)/1e6))].sort((a,b)=>a-b),out:number[]=[];
  for(const m of sorted)if(!out.length||m-out.at(-1)!>6)out.push(m);
  if(!out.length)return [0,length];
  if(out[0]>1e-3)out.unshift(0);
  if(Math.abs(out.at(-1)!-length)>1e-3){if(length-out.at(-1)!<=6)out[out.length-1]=length;else out.push(length);}
  return out;
}
/** Post centres along one run, including gate jambs. Spacing posts that fall in a clear opening are left out. */
export function fencePosts(run:FenceRun){
  const style=FENCE_STYLES[run.style],length=runLengthIn(run.points),spacing=run.postSpacingFt*12;
  const openings=run.gates.map(g=>[g.stationIn-g.widthIn/2,g.stationIn+g.widthIn/2] as const);
  const marks=[0,length];let s=0;
  for(let i=1;i<run.points.length-1;i++){s+=dist(run.points[i-1],run.points[i]);marks.push(s);}
  for(let t=spacing;t<length-1e-3;t+=spacing)marks.push(t);
  const stations=mergeStations(marks,length).filter(st=>!openings.some(([a,b])=>st>a+.5&&st<b-.5));
  const jambs=run.gates.flatMap(g=>{const half=g.widthIn/2+style.postSizeIn/2;return [g.stationIn-half,g.stationIn+half];});
  const all=[...stations,...jambs].sort((a,b)=>a-b),kept:number[]=[];
  for(const m of all){
    if(!kept.length||m-kept.at(-1)!>6)kept.push(m);
    else if(jambs.some(j=>Math.abs(j-m)<1e-3))kept[kept.length-1]=m;
  }
  return kept.map(station=>locate(run.points,station));
}
function gateOnSpan(run:FenceRun,a:{station:number},b:{station:number}){
  const post=FENCE_STYLES[run.style].postSizeIn;
  return run.gates.find(g=>Math.abs(g.stationIn-g.widthIn/2-post/2-a.station)<1.5&&Math.abs(g.stationIn+g.widthIn/2+post/2-b.station)<1.5);
}
export function gateFits(run:FenceRun,gate:Pick<FenceGate,'stationIn'|'widthIn'>){
  const post=FENCE_STYLES[run.style].postSizeIn,half=gate.widthIn/2+post/2,a=gate.stationIn-half,b=gate.stationIn+half;let s=0;
  for(let i=1;i<run.points.length;i++){const len=dist(run.points[i-1],run.points[i]);if(a>=s+2-1e-4&&b<=s+len-2+1e-4)return true;s+=len;}
  return false;
}
/** How many horizontal slats fit between 2 in top and bottom rails. */
export function horizontalSlatCount(heightFt:number,gapIn:number,faceIn=5.5){
  const zone=heightFt*12-RAIL_IN*2;return Math.max(1,Math.floor((zone+gapIn)/(faceIn+gapIn)));
}

function pointOf(v:unknown,label:string):FencePoint{
  const p=asRecord(v,label);
  return {x:num(p.x,-COORD_IN,COORD_IN,label),y:num(p.y,-COORD_IN,COORD_IN,label)};
}
function gateOf(v:unknown,run:FenceRun,ids:Set<string>):FenceGate{
  const g=asRecord(v,'A gate must be a single or double leaf.');
  const id=typeof g.id==='string'&&ID.test(g.id)?g.id:fail('Use a gate id of letters, numbers, hyphens or underscores.');
  if(ids.has(id))fail('Gate ids must be unique on a fence run.');ids.add(id);
  const kind=g.kind==='single'||g.kind==='double'?g.kind:fail('A gate is single or double.');
  const [min,max]=GATE_WIDTH[kind];
  const gate:FenceGate={id,kind,stationIn:num(g.stationIn,0,1e9,'Place the gate along the fence.'),widthIn:num(g.widthIn,min,max,kind==='single'?'A single gate opening must be between 36 and 60 inches.':'A double gate opening must be between 72 and 144 inches.'),selfClosing:g.selfClosing===true,latching:g.latching===true};
  if(g.selfClosing!==true&&g.selfClosing!==false||g.latching!==true&&g.latching!==false)fail('Say whether the gate is self-closing and self-latching.');
  if(!gateFits({...run,gates:[]},gate))fail('Place each gate on one straight fence section, with its posts at least 2 inches from a corner or an end.');
  return gate;
}
export function validateFences(input:unknown):FenceRun[]{
  const rows=asList(input,MAX_RUNS),ids=new Set<string>();
  return rows.map(value=>{
    const raw=asRecord(value,'A fence run must be plain saved values.');
    const id=typeof raw.id==='string'&&ID.test(raw.id)?raw.id:fail('Use a fence id of letters, numbers, hyphens or underscores.');
    if(ids.has(id))fail('Fence ids must be unique.');ids.add(id);
    const style=FENCE_STYLE_IDS.includes(raw.style as FenceStyleId)?raw.style as FenceStyleId:fail('Choose a fence style.');
    const known=FENCE_STYLES[style];
    const pointsRaw=Array.isArray(raw.points)?raw.points:fail('Draw the fence as a line of points.');
    if(pointsRaw.length<2||pointsRaw.length>MAX_POINTS)fail(pointsRaw.length>MAX_POINTS?'A fence run supports up to 64 points.':'A fence run needs at least two points.');
    const points=pointsRaw.map(p=>pointOf(p,'Fence points must stay within 10,000 feet of the deck.'));
    for(let i=1;i<points.length;i++)if(dist(points[i-1],points[i])<MIN_SEGMENT_IN-1e-6)fail('Leave at least 12 inches between fence points.');
    if(runLengthIn(points)<MIN_RUN_IN-1e-6)fail('A fence run must be at least 4 feet long.');
    const finish=text(raw.finish,80,'Choose a finish for this fence style.');
    if(!known.finishes.includes(finish))fail('Choose a finish for this fence style.');
    if(raw.poolEnclosure!==true&&raw.poolEnclosure!==false)fail('Pool enclosure must be yes or no.');
    const poolEnclosure=raw.poolEnclosure===true;
    const run:FenceRun={
      id,name:text(raw.name,60,'Use a fence name with 1–60 characters.'),enabled:raw.enabled===true,style,
      heightFt:num(raw.heightFt,4,8,'Fence height must be between 4 and 8 feet.'),
      postSpacingFt:num(raw.postSpacingFt,4,10,'Post spacing must be between 4 and 10 feet.'),
      slatGapIn:num(raw.slatGapIn,0,6,'Slat gap must be between 0 and 6 inches.'),
      points,postColor:typeof raw.postColor==='string'&&HEX.test(raw.postColor)?raw.postColor.toLowerCase():fail('Use a #rrggbb colour.'),
      infillColor:typeof raw.infillColor==='string'&&HEX.test(raw.infillColor)?raw.infillColor.toLowerCase():fail('Use a #rrggbb colour.'),
      finish,poolEnclosure,gates:[],
    };
    if(raw.enabled!==true&&raw.enabled!==false)fail('Say whether the fence run is included.');
    const gates=Array.isArray(raw.gates)?raw.gates:fail('Fence gates must be a list.');
    const gateIds=new Set<string>();
    run.gates=gates.map(g=>gateOf(g,run,gateIds));
    const spans=run.gates.map(g=>[g.stationIn-g.widthIn/2,g.stationIn+g.widthIn/2] as const).sort((a,b)=>a[0]-b[0]);
    for(let i=1;i<spans.length;i++)if(spans[i][0]<spans[i-1][1]-1e-3)fail('Gates on the same run cannot overlap.');
    return run;
  });
}

export function newFenceRun(style:FenceStyleId,points:FencePoint[],id:string,name?:string):FenceRun{
  const s=FENCE_STYLES[style];
  return validateFences([{id,name:name??s.name,enabled:true,style,heightFt:s.heightFt,postSpacingFt:s.postSpacingFt,slatGapIn:s.slatGapIn,points,postColor:s.postColor,infillColor:s.infillColor,finish:s.finishes[0],poolEnclosure:false,gates:[]}])[0];
}
export function addFenceGate(run:FenceRun,kind:FenceGateKind,id:string):FenceRun{
  const style=FENCE_STYLES[run.style],width=kind==='single'?42:96,need=width+style.postSizeIn+4;let s=0,best:{start:number;len:number}|null=null;
  for(let i=1;i<run.points.length;i++){const len=dist(run.points[i-1],run.points[i]);if(len+1e-6>=need&&(!best||len>best.len))best={start:s,len};s+=len;}
  if(!best)fail(kind==='single'?'No straight section is long enough for a single gate.':'No straight section is long enough for a double gate.');
  const station=best.start+best.len/2,pool=run.poolEnclosure;
  const gate:FenceGate={id,kind,stationIn:station,widthIn:width,selfClosing:pool||style.poolCapable&&run.poolEnclosure,latching:pool||style.poolCapable&&run.poolEnclosure};
  if(pool){gate.selfClosing=true;gate.latching=true;}
  return validateFences([{...run,gates:[...run.gates,gate]}])[0];
}
/** Style colours, gap, finish and spacing change. The line, the height and any gate that still fits stay. */
export function restyleFence(run:FenceRun,style:FenceStyleId):FenceRun{
  const s=FENCE_STYLES[style];
  const next:FenceRun={...run,style,postSpacingFt:s.postSpacingFt,slatGapIn:s.slatGapIn,postColor:s.postColor,infillColor:s.infillColor,finish:s.finishes[0],gates:[]};
  next.gates=run.gates.filter(g=>gateFits(next,g)).map(g=>({...g,selfClosing:next.poolEnclosure?true:g.selfClosing,latching:next.poolEnclosure?true:g.latching}));
  return validateFences([next])[0];
}

export interface FenceQuantities {linearFt:number;posts:number;footings:number;gates:FenceGate[]}
/** Shared posts within 3 inches count once. Linear feet include gate openings. Disabled runs count as nothing. */
export function fenceQuantities(runs:readonly FenceRun[]):FenceQuantities{
  const enabled=runs.filter(r=>r.enabled),seen:{x:number;y:number}[]=[];
  let posts=0;
  for(const run of enabled)for(const p of fencePosts(run)){if(seen.some(s=>Math.hypot(s.x-p.x,s.y-p.y)<3))continue;seen.push(p);posts++;}
  const linearFt=Math.round(enabled.reduce((n,r)=>n+runLengthIn(r.points),0)/12*100)/100;
  return {linearFt,posts,footings:posts,gates:enabled.flatMap(r=>r.gates)};
}
/** Posts assigned to the first run that owns each shared centre, so per-run counts still add up once. */
export function fencePostCounts(runs:readonly FenceRun[]){
  const seen:{x:number;y:number}[]=[],counts=new Map<string,number>();
  for(const run of runs){
    if(!run.enabled){counts.set(run.id,0);continue;}
    let n=0;
    for(const p of fencePosts(run)){if(seen.some(s=>Math.hypot(s.x-p.x,s.y-p.y)<3))continue;seen.push(p);n++;}
    counts.set(run.id,n);
  }
  return counts;
}

const shadeOf=(x:number,y:number,z:number)=>.92+(Math.abs(Math.sin(x*12.9898+y*78.233+z*45.164)*43758.5453)%1)*.16;
function push(out:FenceSolid[],s:Omit<FenceSolid,'shade'>&{shade?:number}){out.push({...s,shade:s.shade??shadeOf(s.x,s.y,s.z)});}

function fillBay(out:FenceSolid[],run:FenceRun,a:{x:number;y:number;angle:number},b:{x:number;y:number},grade:number){
  const style=FENCE_STYLES[run.style],dx=b.x-a.x,dz=b.y-a.y,length=Math.hypot(dx,dz),angle=-Math.atan2(dz,dx);
  const clear=Math.max(style.faceIn,length-style.postSizeIn),mx=(a.x+b.x)/2,mz=(a.y+b.y)/2,height=run.heightFt*12;
  const rail=(y:number,h:number,d:number,surface:FenceSurface,color:string,role:FenceRole='rail')=>push(out,{role,surface,x:mx,y,z:mz,w:clear,h,d,angle,color});
  if(style.infill==='glass'){
    rail(grade+RAIL_IN/2,RAIL_IN,style.postSizeIn*.7,style.postSurface,run.postColor);
    rail(grade+height-RAIL_IN/2,RAIL_IN,style.postSizeIn*.7,style.postSurface,run.postColor);
    push(out,{role:'glass',surface:'glass',x:mx,y:grade+height/2,z:mz,w:Math.max(1,clear-1),h:Math.max(1,height-RAIL_IN*2),d:style.thickIn,angle,color:run.infillColor,shade:1});
    return;
  }
  if(style.infill==='picket'){
    rail(grade+RAIL_IN/2+1,RAIL_IN,1.25,style.postSurface,run.postColor);
    rail(grade+height-RAIL_IN/2,RAIL_IN,1.25,style.postSurface,run.postColor);
    const face=style.faceIn,gap=run.slatGapIn,pitch=face+gap,n=Math.max(1,Math.floor((clear+gap)/pitch)),stack=n*face+(n-1)*gap,start=-stack/2+face/2;
    const h=height-RAIL_IN*2-1;
    for(let i=0;i<n;i++){const along=start+i*pitch,x=mx+Math.cos(-angle)*along,z=mz+Math.sin(-angle)*along;push(out,{role:'picket',surface:'metal',x,y:grade+1+h/2,z,w:face,h,d:style.thickIn,angle,color:run.infillColor});}
    return;
  }
  if(style.infill==='board'){
    rail(grade+height-.75,1.5,3.5,'cedar',run.infillColor);
    const face=style.faceIn,n=Math.max(1,Math.ceil(clear/face)),h=height-2;
    for(const layer of [0,1])for(let i=0;i<n;i++){
      const along=-clear/2+face/2+i*face+(layer?face/2:0);
      if(Math.abs(along)>clear/2)continue;
      const x=mx+Math.cos(-angle)*along,z=mz+Math.sin(-angle)*along;
      push(out,{role:'board',surface:'cedar',x,y:grade+h/2,z,w:face-.15,h,d:style.thickIn,angle,color:run.infillColor});
      if(layer){const ux=Math.cos(-angle),uz=Math.sin(-angle);out.at(-1)!.x+=-uz*(style.thickIn+.05);out.at(-1)!.z+=ux*(style.thickIn+.05);}
    }
    return;
  }
  rail(grade+RAIL_IN/2,RAIL_IN,style.postSurface==='metal'?2:1.5,style.postSurface,style.postSurface==='metal'?run.postColor:run.infillColor);
  rail(grade+height-RAIL_IN/2,RAIL_IN,style.postSurface==='metal'?2:1.5,style.postSurface,style.postSurface==='metal'?run.postColor:run.infillColor);
  const face=style.faceIn,gap=run.slatGapIn,n=horizontalSlatCount(run.heightFt,gap,face),pitch=face+gap,zone=height-RAIL_IN*2,stack=n*face+(n-1)*gap;
  let y=grade+RAIL_IN+(zone-stack)/2+face/2;
  for(let i=0;i<n;i++,y+=pitch)push(out,{role:'slat',surface:style.infillSurface,x:mx,y,z:mz,w:clear,h:face,d:style.thickIn,angle,color:run.infillColor});
}

function gateSolids(out:FenceSolid[],run:FenceRun,gate:FenceGate,a:{x:number;y:number},b:{x:number;y:number},grade:number){
  const style=FENCE_STYLES[run.style],dx=b.x-a.x,dz=b.y-a.y,length=Math.hypot(dx,dz)||1,angle=-Math.atan2(dz,dx),ux=dx/length,uz=dz/length;
  const leaves=gate.kind==='double'?2:1,leafW=(gate.widthIn-.75)/leaves,height=run.heightFt*12,h=height-3,y=grade+1.5+h/2;
  const hinge=gate.kind==='double'?[0,1]:[0];
  for(let i=0;i<leaves;i++){
    const origin=style.postSizeIn/2+.35,along=origin+(i+.5)*leafW;
    const x=a.x+ux*along,z=a.y+uz*along;
    push(out,{role:'gate',surface:style.infill==='glass'?'glass':style.infillSurface,x,y,z,w:leafW-.35,h,d:style.infill==='glass'?.5:1.25,angle,color:style.infill==='glass'?run.infillColor:run.infillColor,shade:style.infill==='glass'?1:undefined});
    const hx=a.x+ux*(origin+i*leafW),hz=a.y+uz*(origin+i*leafW);
    if(hinge.includes(i)||gate.kind==='double'){for(const t of [.22,.78])push(out,{role:'hinge',surface:'metal',x:hx,y:grade+h*t+1.5,z:hz,w:.9,h:3.5,d:1.4,angle,color:run.postColor,shade:1});}
  }
  const latchAlong=style.postSizeIn/2+.35+gate.widthIn/2;
  push(out,{role:'latch',surface:'metal',x:a.x+ux*latchAlong,y:grade+height*.62,z:a.y+uz*latchAlong,w:gate.kind==='double'?3.5:2.2,h:1.4,d:1.6,angle,color:run.postColor,shade:1});
  if(gate.selfClosing)push(out,{role:'hinge',surface:'metal',x:a.x+ux*(style.postSizeIn/2+1.2),y:grade+height-3,z:a.y+uz*(style.postSizeIn/2+1.2),w:6,h:.8,d:1.1,angle,color:run.postColor,shade:1});
}

/** Inch solids for enabled runs. Posts and collars within 3 inches are drawn once. `gradeAt` is inches of soil at a plan point. */
export function fenceSolids(runs:readonly FenceRun[],gradeAt:(x:number,z:number)=>number):FenceSolid[]{
  const out:FenceSolid[]=[],drawn:{x:number;y:number}[]=[];
  for(const run of runs){
    if(!run.enabled)continue;
    const style=FENCE_STYLES[run.style],posts=fencePosts(run),height=run.heightFt*12;
    for(const p of posts){
      if(drawn.some(d=>Math.hypot(d.x-p.x,d.y-p.y)<3))continue;
      drawn.push(p);
      const g=gradeAt(p.x,p.y),h=height+POST_EMBED_IN;
      push(out,{role:'post',surface:style.postSurface,x:p.x,y:g+height/2-POST_EMBED_IN/2,z:p.y,w:style.postSizeIn,h,d:style.postSizeIn,angle:p.angle,color:run.postColor});
      push(out,{role:'collar',surface:'concrete',x:p.x,y:g,z:p.y,w:COLLAR_D_IN,h:COLLAR_H_IN,d:COLLAR_D_IN,angle:0,color:'#b7b3ab',shade:.98+((Math.abs(Math.sin(p.x))%1)*.06)});
    }
    for(let i=0;i<posts.length-1;i++){
      const a=posts[i],b=posts[i+1],gate=gateOnSpan(run,a,b),ga=gradeAt(a.x,a.y),gb=gradeAt(b.x,b.y),grade=(ga+gb)/2;
      if(gate)gateSolids(out,run,gate,a,b,grade);
      else fillBay(out,run,a,b,grade);
    }
  }
  return out;
}
