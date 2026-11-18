import type {YardFeature} from './types';
export type StoneStepSupport={kind:'full-step';courses:number[]}|{kind:'filler';courses:number[];stockWidthIn:number;stockDepthIn:number;stockThicknessIn:number;jointIn:number;productName:string;sourceURL?:string};
export interface StoneSteps {
 lowerElevationIn:number;riserCount:number;treadRunIn:number;
 stockWidthIn:number;stockDepthIn:number;stockThicknessIn:number;
 baseDepthIn:number;settingBedIn:number;jointIn:number;
 productName:string;sourceURL?:string;supportNote?:string;support?:StoneStepSupport;
}
const keys=['lowerElevationIn','riserCount','treadRunIn','stockWidthIn','stockDepthIn','stockThicknessIn','baseDepthIn','settingBedIn','jointIn','productName'];
const optional=['sourceURL','supportNote','support'];
export function plainAssembly(v:unknown,required:string[],allowed=required):Record<string,unknown>{
 if(!v||typeof v!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(v)))throw Error('Assembly inputs must be plain values.');
 const descriptors=Object.getOwnPropertyDescriptors(v);
 if(Reflect.ownKeys(v).some(k=>typeof k!=='string'||!allowed.includes(k))||required.some(k=>!Object.hasOwn(descriptors,k))||Object.values(descriptors).some(d=>!d.enumerable||!('value'in d)))throw Error('Invalid assembly fields.');
 return Object.fromEntries(Object.entries(descriptors).map(([k,d])=>[k,d.value]));
}
function stockText(name:unknown,url:unknown){
 if(typeof name!=='string'||!name.trim()||name.length>160||/[\u0000-\u001f]/.test(name))throw Error('Record the support stock or planning product name.');
 if(url!==undefined){try{if(typeof url!=='string')throw Error();const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password)throw Error();}catch{throw Error('Use an HTTPS support stock specification source.');}}
}
export function validateStoneStepSupport(value:unknown,rows:number):StoneStepSupport{
 const d=value&&typeof value==='object'?Object.getOwnPropertyDescriptor(value,'kind'):undefined,kind=d&&'value'in d?d.value:undefined;
 if(kind!=='full-step'&&kind!=='filler')throw Error('Choose full-size steps or recorded filler blocks.');
 const keys=kind==='full-step'?['kind','courses']:['kind','courses','stockWidthIn','stockDepthIn','stockThicknessIn','jointIn','productName'];
 const p=plainAssembly(value,keys,kind==='full-step'?keys:[...keys,'sourceURL']),courses=p.courses;
 if(!Array.isArray(courses)||Object.getPrototypeOf(courses)!==Array.prototype||courses.length!==rows)throw Error('Record one support course count for every tread row.');
 const descriptors=Object.getOwnPropertyDescriptors(courses);
 if(Reflect.ownKeys(courses).some(k=>typeof k!=='string'||k!=='length'&&!/^(0|[1-9][0-9]*)$/.test(k))||Object.keys(descriptors).length!==rows+1)throw Error('Support courses must be plain integer values.');
 const clean:number[]=[];for(let row=0;row<rows;row++){const d=descriptors[row];if(!d||!('value'in d)||!d.enumerable||!Number.isInteger(d.value)||d.value<0||d.value>20)throw Error('Support courses must be whole numbers from 0 to 20.');clean.push(d.value);}
 if(kind==='filler'){
  for(const [key,min,max] of [['stockWidthIn',2,120],['stockDepthIn',2,60],['stockThicknessIn',1,12],['jointIn',0,1]] as const)if(typeof p[key]!=='number'||!Number.isFinite(p[key])||(p[key] as number)<min||(p[key] as number)>max)throw Error(`Invalid filler ${key}.`);
  stockText(p.productName,p.sourceURL);
 }
 return {...p,courses:clean} as StoneStepSupport;
}
export function validateStoneSteps(f:YardFeature,value:unknown):StoneSteps{
 const v=plainAssembly(value,keys,[...keys,...optional]);
 if(f.kind!=='patio'||f.finishedElevationIn===undefined||f.outline||f.curves?.length||f.inlays?.length||f.patioSlope&&(f.patioSlope.xPct!==0||f.patioSlope.zPct!==0))throw Error('Stone stairs require a rectangular flight with a fixed upper level and horizontal treads.');
 const s=v as unknown as StoneSteps;
 const bounds:Record<string,[number,number]>={lowerElevationIn:[-120000,120000],riserCount:[1,20],treadRunIn:[8,60],stockWidthIn:[12,120],stockDepthIn:[8,60],stockThicknessIn:[2,12],baseDepthIn:[1,48],settingBedIn:[0,6],jointIn:[0,1]};
 for(const [k,[min,max]] of Object.entries(bounds))if(typeof v[k]!=='number'||!Number.isFinite(v[k])||(v[k] as number)<min||(v[k] as number)>max)throw Error(`Invalid stone-stair ${k}.`);
 if(!Number.isInteger(s.riserCount))throw Error('Stone stairs need a whole number of risers.');
 const rise=(f.finishedElevationIn-s.lowerElevationIn)/s.riserCount;
 if(rise<=0||rise>s.stockThicknessIn+1e-6||s.treadRunIn>s.stockDepthIn+1e-6)throw Error('The recorded stock cannot fit these fixed levels and tread run. Adjust the stock or levels explicitly.');
 if(s.stockDepthIn>s.treadRunIn+1e-6&&rise<s.stockThicknessIn-1e-6)throw Error('These overlapping solid step units would intersect. Change the run or select matching stock.');
 if(Math.abs(f.depthFt*12-((s.riserCount-1)*s.treadRunIn+s.stockDepthIn))>1e-5)throw Error('Flight depth must equal its recorded tread runs and last stock depth.');
 if(typeof s.productName!=='string'||!s.productName.trim()||s.productName.length>160||/[\u0000-\u001f]/.test(s.productName))throw Error('Record the stone-step product or planning stock name.');
 if(s.supportNote!==undefined&&(typeof s.supportNote!=='string'||!s.supportNote.trim()||s.supportNote.length>800||/[\u0000-\u001f]/.test(s.supportNote)))throw Error('Use a plain support specification note.');
 if(s.sourceURL!==undefined){try{const u=new URL(s.sourceURL);if(u.protocol!=='https:'||u.username||u.password)throw Error();}catch{throw Error('Use an HTTPS stock specification source.');}}
 const support=s.support===undefined?undefined:validateStoneStepSupport(s.support,s.riserCount);
 if(support){
  // Supports occupy rigid stock volumes; overlapping tread noses need a recorded cut detail.
  if(s.stockDepthIn>s.treadRunIn+1e-6&&support.courses.some(n=>n>0))throw Error('The support stock intersects overlapping treads. Use a non-overlapping run or record a different support assembly.');
  const width=f.widthFt*12,stock=support.kind==='filler'?support:s;
  const pieces=Math.ceil((width+stock.jointIn)/(stock.stockWidthIn+stock.jointIn))*Math.ceil((s.stockDepthIn+stock.jointIn)/(stock.stockDepthIn+stock.jointIn))*support.courses.reduce((a,n)=>a+n,0);
  if(pieces+Math.ceil((width+s.jointIn)/(s.stockWidthIn+s.jointIn))*s.riserCount>20000)throw Error('The complete stone-stair assembly exceeds the 20,000-unit geometry budget.');
 }
 return {...s,...(support?{support}:{})};
}
export function stoneStepBlanks(f:YardFeature){
 const s=validateStoneSteps(f,f.stoneSteps),width=f.widthFt*12,depth=f.depthFt*12,rise=(f.finishedElevationIn!-s.lowerElevationIn)/s.riserCount;
 const a=f.rotationDeg*Math.PI/180,c=Math.cos(a),sin=Math.sin(a),world=(x:number,z:number)=>({x:f.xFt*12+c*x-sin*z,y:f.zFt*12+sin*x+c*z});
 const out:{polygon:{x:number;y:number}[];topIn:number;cut:boolean;row:number;slot:number}[]=[];
 for(let row=0;row<s.riserCount;row++)for(let left=-width/2,slot=0;left<width/2-1e-6;left+=s.stockWidthIn+s.jointIn,slot++){
  const right=Math.min(width/2,left+s.stockWidthIn),front=-depth/2+row*s.treadRunIn;
  out.push({polygon:[world(left,front),world(right,front),world(right,front+s.stockDepthIn),world(left,front+s.stockDepthIn)],topIn:s.lowerElevationIn+(row+1)*rise,cut:right-left<s.stockWidthIn-1e-6,row,slot});
 }
 return {stock:s,rise,blanks:out};
}
