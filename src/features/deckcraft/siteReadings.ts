import {SITE_LIMITS,type SitePoint} from './siteModel';
/** Field readings (U-Level / Smart Level, generic CSV, rod and level) turned
 * into DeckCraft world inches. Pure math: no DOM, React or surface engine, so
 * only the lazy importer and the checks load it.
 *
 * Plan frame: x across (left negative), z out into the yard (house negative),
 * origin at the deck's back-left corner. Heights are relative to the zero the
 * crew set, +up, until tieDatum moves them onto the project datum. */

export type LengthUnit='in'|'ft'|'mm'|'cm'|'m';
export type DetectedUnit=LengthUnit|'ft-in';
export const INCHES_PER:Record<LengthUnit,number>={in:1,ft:12,mm:1/25.4,cm:10/25.4,m:1000/25.4};
export interface ParsedLength {raw:string;inches:number;unit:DetectedUnit;
 /** The sign came from an above/below word, so it is already absolute. */
 worded?:boolean}

const NUM='((?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:e[-+]?\\d+)?)',VULGAR:Record<string,string>={'½':'1/2','⅓':'1/3','⅔':'2/3','¼':'1/4','¾':'3/4','⅕':'1/5','⅖':'2/5','⅗':'3/5','⅘':'4/5','⅙':'1/6','⅚':'5/6','⅛':'1/8','⅜':'3/8','⅝':'5/8','⅞':'7/8'},FRAC='(\\d+)\\/(\\d+)',FEET="(?:'|ft|feet|foot)",INCH='(?:"|in|inch|inches)';
const FEET_INCHES=new RegExp(`^${NUM}\\s*${FEET}\\s*(?:-\\s*)?(?:(?:${NUM}(?:[\\s-]+${FRAC})?|${FRAC})\\s*${INCH}?)?$`);
const INCHES=new RegExp(`^(?:${NUM}(?:[\\s-]+${FRAC})?|${FRAC})\\s*${INCH}$`);
const METRIC=new RegExp(`^${NUM}\\s*(mm|cm|m)$`);
const PLAIN=new RegExp(`^(?:${NUM}(?:[\\s-]+${FRAC})?|${FRAC})$`);
const fraction=(num?:string,den?:string)=>num===undefined?0:Number(den)>0?Number(num)/Number(den):NaN;
const whole=(n?:string,num?:string,den?:string,num2?:string,den2?:string)=>(n===undefined?0:Number(n))+fraction(num,den)+fraction(num2,den2);

/** Parse one reading or distance. Handles ft-in-fractions (6' 3 5/8",
 * 6'-3 5/8", 5 ft 3 in), inches (-18.5", 3/4"), mm/cm/m, signs, unicode
 * minus/primes, phone-keyboard fractions (3½"), exponents (Excel's
 * -3.5E-15), decimal commas when chosen, and above/below words. A bare
 * number uses `fallback`. The original text is kept as `raw`. */
export function parseLength(raw:string,fallback:LengthUnit,decimal:'.'|','='.'):ParsedLength{
 const fail=(why:string):never=>{throw Error(`"${raw}": ${why}.`);};
 if(typeof raw!=='string')fail('not text');
 // Vulgar fractions first: NFKC would turn 3½ into 31⁄2 and fuse the digits.
 let s=raw.replace(/[¼-¾⅓-⅞]/g,c=>VULGAR[c]?` ${VULGAR[c]}`:c).normalize('NFKC').replace(/⁄/g,'/').trim().toLowerCase().replace(/[−–—]/g,'-').replace(/[′‘’`]/g,"'").replace(/[″“”]/g,'"').replace(/''/g,'"').replace(/\s+/g,' ');
 if(!s)fail('empty reading');
 let sign=1;const word=s.match(/^(above|up|below|down)\s+|\s+(above|up|below|down)$/);
 if(word){s=s.replace(word[0],'').trim();sign=/below|down/.test(word[0])?-1:1;}
 const explicit=s.match(/^([+-])\s*/);if(explicit){if(word)fail('has both a sign and above/below');s=s.slice(explicit[0].length);if(explicit[1]==='-')sign=-1;}
 if(decimal===','){if(/\d\.\d/.test(s))fail('uses a decimal point but decimal comma is chosen');s=s.replace(/(\d),(\d)/g,'$1.$2');}
 else if(s.includes(','))fail('has a comma; choose decimal comma if that is the decimal mark');
 let m:RegExpMatchArray|null,inches:number,unit:DetectedUnit;
 if((m=s.match(FEET_INCHES))){const extra=whole(m[2],m[3],m[4],m[5],m[6]);if(extra>=12)fail('inches must be under 12 after feet');inches=Number(m[1])*12+extra;unit=m[2]!==undefined||m[5]!==undefined?'ft-in':'ft';}
 else if((m=s.match(INCHES))){inches=whole(m[1],m[2],m[3],m[4],m[5]);unit='in';}
 else if((m=s.match(METRIC))){unit=m[2] as LengthUnit;inches=Number(m[1])*INCHES_PER[unit];}
 else if((m=s.match(PLAIN))){unit=fallback;inches=whole(m[1],m[2],m[3],m[4],m[5])*INCHES_PER[fallback];}
 else fail('not a length DeckCraft can read');
 if(Number.isNaN(inches))fail('has a fraction with a zero denominator');
 if(!Number.isFinite(inches))fail('not a finite number');
 return {raw,inches:inches===0?0:sign*inches,unit,...(word?{worded:true}:{})};
}
/** Decimal comma only when a value shows it and none shows a decimal point
 * (a comma-delimited file can never carry decimal commas unquoted). */
export function guessDecimal(values:string[]):'.'|','{return values.some(v=>/\d,\d/.test(v))&&!values.some(v=>/\d\.\d/.test(v))?',':'.';}
/** A value with no unit mark (it takes whatever unit it is read in). Decided
 * by the parser itself, so phone fractions, dashes and exponents all count. */
export function isBare(value:string,decimal:'.'|','='.'){try{return parseLength(value,'in',decimal).unit==='in'&&parseLength(value,'mm',decimal).unit==='mm';}catch{return false;}}
/** Unit marks found in values (", ', mm, cm, m); undefined for bare numbers. */
export function markedUnit(values:string[]):DetectedUnit|undefined{
 const units=new Set<DetectedUnit>();for(const v of values){try{const p=parseLength(v,'in');if(!isBare(v))units.add(p.unit);}catch{/* not a length */}}
 return units.size===1?[...units][0]:units.has('ft-in')?'ft-in':undefined;
}

/** How a column of values relates to height. Rod readings go through levelRun. */
export type ReadingKind='height-up'|'height-down'|'elevation';
/** Height relative to the zero, +up. `elevation` is passed through; tieDatum
 * gives it the offset that places it on the project datum. */
export const signedHeight=(valueIn:number,kind:ReadingKind)=>kind==='height-down'?-valueIn:valueIn;

/** Rod and level: HI = elevation + backsight; elevation = HI - foresight.
 * A turning point is a foresight then a backsight on the same id. A foresight
 * onto an already known point (closing on the benchmark) reports misclosure
 * instead of overwriting it. */
export interface LevelRow {id:string;sight:'bs'|'fs';rodIn:number}
export interface LevelRun {points:{id:string;elevationIn:number}[];rows:(LevelRow&{hiIn:number;elevationIn:number})[];misclosures:{id:string;errorIn:number}[]}
export const heightOfInstrument=(elevationIn:number,backsightIn:number)=>elevationIn+backsightIn;
export const rodForTarget=(hiIn:number,targetIn:number)=>hiIn-targetIn;
/** Grade rod minus ground rod: positive is cut (ground above grade), negative is fill. */
export const cutFill=(gradeRodIn:number,groundRodIn:number)=>gradeRodIn-groundRodIn;
export function levelRun(benchmark:{id:string;elevationIn:number},rows:LevelRow[]):LevelRun{
 const known=new Map([[benchmark.id,benchmark.elevationIn]]),out:LevelRun={points:[{id:benchmark.id,elevationIn:benchmark.elevationIn}],rows:[],misclosures:[]};let hi:number|undefined;
 rows.forEach((r,i)=>{
  if(!Number.isFinite(r.rodIn)||r.rodIn<0)throw Error(`Row ${i+1} (${r.id}): rod readings must be zero or more.`);
  if(r.sight==='bs'){const e=known.get(r.id);if(e===undefined)throw Error(`Row ${i+1}: backsight on ${r.id}, whose elevation is not known yet.`);hi=heightOfInstrument(e,r.rodIn);out.rows.push({...r,hiIn:hi,elevationIn:e});return;}
  if(hi===undefined)throw Error(`Row ${i+1}: take a backsight before the first foresight.`);
  const e=hi-r.rodIn,prior=known.get(r.id);out.rows.push({...r,hiIn:hi,elevationIn:e});
  if(prior!==undefined){out.misclosures.push({id:r.id,errorIn:e-prior});return;}
  known.set(r.id,e);out.points.push({id:r.id,elevationIn:e});
 });
 return out;
}

/** Placing recorded X/Y onto the plan: mirror (z -> -z) first, then rotate and
 * scale about the origin, then translate. */
export interface PlanXY {x:number;z:number}
export interface PlanTransform {cos:number;sin:number;scale:number;mirror:boolean;tx:number;tz:number}
export interface FitPair {id?:string;source:PlanXY;target:PlanXY}
export interface PlanFit {transform:PlanTransform;rotationDeg:number;
 /** Target size / recorded size. Reported even when the scale is fixed at 1
  * (real inches), as an accuracy check on the recorded distances. */
 measuredScale:number;residuals:{id?:string;errorIn:number}[];rmsIn:number;maxIn:number}
export const IDENTITY:PlanTransform={cos:1,sin:0,scale:1,mirror:false,tx:0,tz:0};
export function applyTransform(t:PlanTransform,p:PlanXY):PlanXY{const z=t.mirror?-p.z:p.z;return {x:t.tx+t.scale*(t.cos*p.x-t.sin*z),z:t.tz+t.scale*(t.sin*p.x+t.cos*z)};}
/** Least-squares similarity fit (2D Procrustes); two pairs solve it exactly.
 * `scale:'fixed'` keeps 1:1 for devices that record real distances. */
export function fitPlacement(pairs:FitPair[],options:{scale?:'fixed'|'solve';mirror?:boolean}={}):PlanFit{
 if(pairs.length<2)throw Error('Match at least two shots to points on the plan.');
 if(!pairs.every(p=>[p.source.x,p.source.z,p.target.x,p.target.z].every(Number.isFinite)))throw Error('Placement points must be finite.');
 const mirror=!!options.mirror,src=pairs.map(p=>({x:p.source.x,z:mirror?-p.source.z:p.source.z})),n=pairs.length;
 const cs={x:src.reduce((a,p)=>a+p.x,0)/n,z:src.reduce((a,p)=>a+p.z,0)/n},ct={x:pairs.reduce((a,p)=>a+p.target.x,0)/n,z:pairs.reduce((a,p)=>a+p.target.z,0)/n};
 let dot=0,cross=0,ss=0,tt=0;
 pairs.forEach((p,i)=>{const a={x:src[i].x-cs.x,z:src[i].z-cs.z},b={x:p.target.x-ct.x,z:p.target.z-ct.z};dot+=a.x*b.x+a.z*b.z;cross+=a.x*b.z-a.z*b.x;ss+=a.x*a.x+a.z*a.z;tt+=b.x*b.x+b.z*b.z;});
 if(ss<1e-6)throw Error('The matched shots are on top of each other. Pick two shots that are apart.');
 if(tt<1e-6)throw Error('The plan points are on top of each other. Pick two spots that are apart.');
 const angle=Math.atan2(cross,dot),cos=Math.cos(angle),sin=Math.sin(angle),measuredScale=Math.sqrt(tt/ss),scale=options.scale==='solve'?Math.hypot(dot,cross)/ss:1;
 const transform:PlanTransform={cos,sin,scale,mirror,tx:ct.x-scale*(cos*cs.x-sin*cs.z),tz:ct.z-scale*(sin*cs.x+cos*cs.z)};
 const residuals=pairs.map(p=>{const q=applyTransform(transform,p.source);return {...(p.id===undefined?{}:{id:p.id}),errorIn:Math.hypot(q.x-p.target.x,q.z-p.target.z)};});
 return {transform,rotationDeg:angle*180/Math.PI,measuredScale,residuals,rmsIn:Math.sqrt(residuals.reduce((a,r)=>a+r.errorIn**2,0)/n),maxIn:Math.max(...residuals.map(r=>r.errorIn))};
}

export interface Shot extends PlanXY {id:string}
const side=(a:PlanXY,b:PlanXY,p:PlanXY)=>(b.x-a.x)*(p.z-a.z)-(b.z-a.z)*(p.x-a.x);
/** A traced house outline proposes its own placement: the longest recorded
 * segment (never the closing line the app adds) is a house wall, the yard
 * shots say which side is outside, and the wall's left end (seen from the
 * yard) goes on `corner` with the wall running along `along`. With no yard
 * shots, the outline's other vertices mark the inside. */
export function proposeWallFit(path:Shot[],yard:PlanXY[],corner:PlanXY,along:PlanXY={x:1,z:0}):{pairs:FitPair[];wall:[Shot,Shot];wrongSide:number}|undefined{
 if(path.length<2)return undefined;
 const length=Math.hypot(along.x,along.z);if(!(length>0))throw Error('Choose a wall direction.');
 const u={x:along.x/length,z:along.z/length};
 let best=0;for(let i=1;i+1<path.length;i++)if(Math.hypot(path[i+1].x-path[i].x,path[i+1].z-path[i].z)>Math.hypot(path[best+1].x-path[best].x,path[best+1].z-path[best].z))best=i;
 const a=path[best],b=path[best+1],run=Math.hypot(b.x-a.x,b.z-a.z);if(run<1e-6)return undefined;
 const outside=yard.length?yard:path.filter((_,i)=>i!==best&&i!==best+1),signs=outside.map(p=>Math.sign(side(a,b,p))).filter(Boolean);
 if(!signs.length)return undefined;
 // Rotation keeps handedness: `along` with the yard on its +z side has a positive cross product.
 const votes=signs.reduce((n,s)=>n+s,0),yardSign=(yard.length?1:-1)*Math.sign(votes||signs[0]),[left,right]=yardSign>0?[a,b]:[b,a];
 const wrongSide=yard.length?signs.filter(s=>s!==Math.sign(votes||signs[0])).length:0;
 return {wall:[a,b],wrongSide,pairs:[{id:left.id,source:left,target:corner},{id:right.id,source:right,target:{x:corner.x+u.x*run,z:corner.z+u.z*run}}]};
}

/** Clean, unique point IDs (validateSiteModel wants 1–100 printable chars). */
export function uniqueIds(names:string[]):string[]{
 const used=new Set<string>();
 return names.map((name,i)=>{const base=(String(name??'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim()||`Shot ${i+1}`).slice(0,92);let id=base;for(let n=2;used.has(id);n++)id=`${base} (${n})`;used.add(id);return id;});
}
export type MergeMode='merge'|'replace'|'append';
export interface MergeResult {points:SitePoint[];added:string[];updated:string[];superseded:string[];removed:string[];renamed:{from:string;to:string}[]}
/** merge: same ID is updated, new IDs are added, the rest is kept.
 * append: clashing IDs are renamed instead of updated.
 * replace: only the incoming points remain.
 * In merge and append, an existing point within `nearIn` of an incoming one is
 * superseded (a re-shot), which also avoids duplicate positions. */
export function mergeSitePoints(existing:SitePoint[],incoming:SitePoint[],mode:MergeMode,nearIn=1):MergeResult{
 const out:MergeResult={points:[],added:[],updated:[],superseded:[],removed:[],renamed:[]};
 if(mode==='replace'){out.points=incoming.map(p=>({...p}));out.added=incoming.map(p=>p.id);out.removed=existing.map(p=>p.id);return out;}
 const taken=new Set(existing.map(p=>p.id)),byId=new Map<string,SitePoint>(),fresh:SitePoint[]=[];
 for(const p of incoming){
  if(mode==='merge'&&taken.has(p.id)){byId.set(p.id,{...p});continue;}
  let id=p.id;if(taken.has(id)){for(let n=2;taken.has(id);n++)id=`${p.id.slice(0,92)} (${n})`;out.renamed.push({from:p.id,to:id});}
  taken.add(id);fresh.push({...p,id});
 }
 const near=(p:SitePoint)=>[...byId.values(),...fresh].some(q=>q.id!==p.id&&Math.hypot(q.xIn-p.xIn,q.zIn-p.zIn)<nearIn);
 for(const p of existing){const update=byId.get(p.id);if(update){out.points.push(update);out.updated.push(p.id);}else if(near(p))out.superseded.push(p.id);else out.points.push({...p});}
 out.points.push(...fresh);out.added=fresh.map(p=>p.id);
 if(out.points.length>SITE_LIMITS.points)throw Error(`Adding these shots gives ${out.points.length} points; a site holds up to ${SITE_LIMITS.points}. Replace the old points instead.`);
 return out;
}
/** Offset that ties a second zero setup to the first through shots that share
 * a name: mean of (existing - incoming), with each tie's leftover error. */
export function tieOffset(existing:{id:string;elevationIn:number}[],incoming:{id:string;elevationIn:number}[]){
 const prior=new Map(existing.map(p=>[p.id,p.elevationIn])),ties=incoming.filter(p=>prior.has(p.id));if(!ties.length)return undefined;
 const offsetIn=ties.reduce((n,p)=>n+prior.get(p.id)!-p.elevationIn,0)/ties.length,residuals=ties.map(p=>({id:p.id,residualIn:p.elevationIn+offsetIn-prior.get(p.id)!}));
 return {offsetIn,ties:residuals,maxResidualIn:Math.max(...residuals.map(r=>Math.abs(r.residualIn)))};
}

/** What the crew's zero was set on. The project datum stays 0.00 = existing
 * ground at the deck's back-left corner (elevationDatum.ts), so every reading
 * is shifted by the ground measured there. */
export type ZeroReference={kind:'door-sill'}|{kind:'deck-corner'}|{kind:'typed';zeroElevationIn:number};
export interface DatumTie {offsetIn:number;
 /** Door sill above that ground: becomes HouseConfig.floorHeightIn. */
 sillIn?:number;warnings:string[]}
/** `cornerHeightIn` is the imported ground at the deck's back-left corner
 * (0,0), relative to the zero; undefined when no shots cover it. */
export function tieDatum(zero:ZeroReference,cornerHeightIn?:number):DatumTie{
 if(cornerHeightIn!==undefined&&!Number.isFinite(cornerHeightIn))throw Error('The ground at the deck corner is not a number.');
 if(zero.kind==='typed'){
  const z=zero.zeroElevationIn;if(!Number.isFinite(z))throw Error('Type the zero height as a number.');
  if(Math.abs(z)>SITE_LIMITS.elevationIn)throw Error(`A zero ${(z/12).toFixed(0)} ft from the deck corner's ground is beyond what a site can hold. Check the units.`);
  // The typed zero should put the measured corner ground on 0.00 (within an inch).
  return {offsetIn:z,warnings:cornerHeightIn!==undefined&&Math.abs(cornerHeightIn+z)>1?[`You typed the zero ${z.toFixed(1)} in above the ground at the deck's back-left corner, but the shots put it ${(-cornerHeightIn).toFixed(1)} in above. Check the zero height and its sign.`]:[]};
 }
 if(zero.kind==='deck-corner')return {offsetIn:0,warnings:cornerHeightIn!==undefined&&Math.abs(cornerHeightIn)>1?[`Your zero is the ground at the deck's back-left corner, but the shots put that ground at ${cornerHeightIn.toFixed(1)} in. Check the zero.`]:[]};
 if(cornerHeightIn===undefined)throw Error("No shots surround the deck's back-left corner, so the door sill can't be tied to the deck. Add a shot at that corner, or type the zero height.");
 const sillIn=-cornerHeightIn;
 if(sillIn<0)throw Error(`The ground at the deck corner reads ${cornerHeightIn.toFixed(1)} in above the door sill. Check the sign or where the zero was set.`);
 if(sillIn>240)throw Error(`The door sill would be ${(sillIn/12).toFixed(1)} ft above the ground at the deck corner. Check the units.`);
 return {offsetIn:-cornerHeightIn,sillIn,warnings:[]};
}

/** Convex hull (monotone chain, counter-clockwise in x/z). */
export function hull(points:PlanXY[]):PlanXY[]{
 const p=[...points].sort((a,b)=>a.x-b.x||a.z-b.z),lower:PlanXY[]=[],upper:PlanXY[]=[],turn=(o:PlanXY,a:PlanXY,b:PlanXY)=>(a.x-o.x)*(b.z-o.z)-(a.z-o.z)*(b.x-o.x);
 for(const q of p){while(lower.length>1&&turn(lower[lower.length-2],lower[lower.length-1],q)<=1e-9)lower.pop();lower.push(q);}
 for(const q of p.reverse()){while(upper.length>1&&turn(upper[upper.length-2],upper[upper.length-1],q)<=1e-9)upper.pop();upper.push(q);}
 return lower.slice(0,-1).concat(upper.slice(0,-1));
}
/** Narrowest width of the shots' footprint (0 for a straight line). */
export function hullWidth(points:PlanXY[]):number{
 const h=hull(points);if(h.length<3)return 0;
 return Math.min(...h.map((a,i)=>{const b=h[(i+1)%h.length],l=Math.hypot(b.x-a.x,b.z-a.z);return Math.max(...h.map(p=>Math.abs(side(a,b,p))/l));}));
}
// Same coverage as the surface engine: a corner on the shots' outer edge counts, a hair outside does not.
const inside=(h:PlanXY[],p:PlanXY,tolerance=1e-6)=>h.length>2&&h.every((a,i)=>{const b=h[(i+1)%h.length];return side(a,b,p)/Math.hypot(b.x-a.x,b.z-a.z)>=-tolerance;});
export interface ReadingCheck {errors:string[];warnings:string[]}
/** Problems that block Apply (errors) or need a look (warnings). `heights`
 * are the raw relative readings (+up) used for the sign check. */
export function checkReadings(input:{ground:{xIn:number;zIn:number;elevationIn:number}[];heights?:number[];zero?:ZeroReference['kind'];footprint?:PlanXY[]}):ReadingCheck{
 const errors:string[]=[],warnings:string[]=[],xy=input.ground.map(p=>({x:p.xIn,z:p.zIn}));
 if(input.ground.length<3)errors.push(`Ground needs at least 3 shots; this import has ${input.ground.length}.`);
 else{const width=hullWidth(xy);if(width<.01)errors.push('The ground shots are in one straight line, so the cross slope is unknown. Add one shot off the line.');else if(width<36)warnings.push(`The ground shots cover a strip only ${(width/12).toFixed(1)} ft wide. Slopes across it are guesses; add a shot or two off the line.`);}
 if(input.ground.length){
  const zs=input.ground.map(p=>p.elevationIn),range=Math.max(...zs)-Math.min(...zs),span=Math.max(Math.max(...xy.map(p=>p.x))-Math.min(...xy.map(p=>p.x)),Math.max(...xy.map(p=>p.z))-Math.min(...xy.map(p=>p.z)));
  if(range>360)warnings.push(`Heights span ${(range/12).toFixed(1)} ft, more than 30 ft. Check the units.`);
  if(input.ground.length>=3&&span<24)warnings.push(`All shots fit inside ${span.toFixed(1)} in. Were they recorded in feet or metres?`);
  if(span>2400)warnings.push(`Shots spread over ${(span/12).toFixed(0)} ft, beyond what a 100 ft tube can reach from one zero. Check the units.`);
 }
 const h=input.heights??[];if(input.zero==='door-sill'&&h.length&&h.filter(v=>v>0).length>h.length/2)warnings.push('Most ground shots read above your door sill. Check the sign (ground is normally below the sill).');
 if(input.footprint?.length&&input.ground.length>=3){const shape=hull(xy),out=input.footprint.filter(p=>!inside(shape,p)).length;if(out)warnings.push(`${out} of ${input.footprint.length} deck corners are outside the measured ground. Footings there stay "coverage pending" until a shot covers them.`);}
 return {errors,warnings};
}
