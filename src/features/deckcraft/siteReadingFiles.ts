import {Inflate} from 'fflate';
import {csvRows} from './siteCsv';
import {parseLength,guessDecimal,signedHeight,levelRun,uniqueIds,isBare,INCHES_PER,type LengthUnit,type DetectedUnit,type ReadingKind} from './siteReadings';
/** Files from levelling apps turned into shots the importer can place, tie and
 * apply. Only the lazy importer and the checks load this (it pulls in fflate).
 *
 * U-Level / Smart Level (Unilock, BayaTronics) emails a .zip holding
 * `Points_*.csv` (P, X, Y, Z, Comment), `Lengths_*.csv`, `CAD_*.dxf` and a plot
 * image. Its layout is not published; the rules below come from a real export
 * (e2e/fixtures/ulevel-sample.zip):
 * - P is `P{line}_{n}`; the phone and plot number shots P1..Pn in file order.
 * - A closed line repeats its first shot as its last row.
 * - X right / Y down, in the display unit, without unit marks. Z is the height
 *   against the reel's zero, +up.
 * - Lengths_*.csv gives `P1-P2,156.4",-6.8%`: the recorded length with its
 *   unit mark and slope. It is used to confirm the unit of the bare numbers. */

export const READING_FILE_LIMITS={archive:20_000_000,text:5_000_000,entries:64,shots:2000};
export interface TextFile {name:string;text:string}
export type ShotRole='ground'|'reference';
export interface ImportedShot {
 /** Unique site point ID: the phone's name plus any comment. */
 id:string;label:string;rawId:string;comment:string;
 /** Recorded plan position in inches in DeckCraft handedness (x right, z
  * toward the viewer / down the plot); absent when the file has none. */
 x?:number;z?:number;
 /** Height against the zero in inches, +up. */
 heightIn:number;raw:{x?:string;y?:string;height:string};row:number;role:ShotRole;line?:number}
export interface ImportedLine {id:number;label:string;shotIds:string[];closed:boolean}
export interface LengthCheck {from:string;to:string;recordedIn:number;computedIn:number;slopePct?:number;computedSlopePct:number;ok:boolean}
export interface ReadingImport {format:'u-level'|'columns';fileName:string;shots:ImportedShot[];
 /** Recorded lines (the U-Level red line). A closed line is a house outline. */
 lines:ImportedLine[];unit:DetectedUnit;unitSource:'lengths'|'marks'|'chosen'|'assumed';lengthChecks:LengthCheck[];warnings:string[]}

/** UTF-16 by BOM, then strict UTF-8, then Windows-1252 (what Excel's default
 * "CSV (Comma delimited)" writes on Windows). */
function decode(bytes:Uint8Array){
 if(bytes[0]===0xff&&bytes[1]===0xfe)return new TextDecoder('utf-16le').decode(bytes.subarray(2));
 if(bytes[0]===0xfe&&bytes[1]===0xff)return new TextDecoder('utf-16be').decode(bytes.subarray(2));
 try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{return new TextDecoder('windows-1252').decode(bytes);}
}
const baseName=(path:string)=>path.split(/[\\/]/).pop()??path;
const DAMAGED='The zip file is damaged or uses a format DeckCraft cannot open.';
const text=(name:string,bytes:Uint8Array,where='')=>{const t=decode(bytes);if(t.includes('\u0000'))throw Error(`${baseName(name)}${where} is not a text${where?'':' or .zip'} file.`);return {name:baseName(name),text:t};};
const u16=(b:Uint8Array,i:number)=>b[i]|b[i+1]<<8,u32=(b:Uint8Array,i:number)=>(b[i]|b[i+1]<<8|b[i+2]<<16|b[i+3]<<24)>>>0;
let crcTable:Int32Array|undefined;
function crc32(data:Uint8Array){const t=crcTable??=new Int32Array(256).map((_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c;});let c=-1;for(let i=0;i<data.length;i++)c=t[(c^data[i])&255]^(c>>>8);return ~c>>>0;}
/** Inflate one entry into exactly its recorded size: more output (a zip bomb)
 * stops at the first chunk past it, less output is damage. */
function inflateEntry(src:Uint8Array,method:number,size:number){
 if(method===0){if(src.length!==size)throw Error(DAMAGED);return src;}
 if(method!==8)throw Error('A file in the zip uses a compression DeckCraft cannot open. Re-zip it with standard settings.');
 if(!src.length){if(size)throw Error(DAMAGED);return new Uint8Array(0);}
 const out=new Uint8Array(size);let n=0;
 const inflater=new Inflate(chunk=>{if(n+chunk.length>size)throw Error(DAMAGED);out.set(chunk,n);n+=chunk.length;});
 try{for(let i=0;i<src.length;i+=16384)inflater.push(src.subarray(i,i+16384),i+16384>=src.length);}catch{throw Error(DAMAGED);}
 if(n!==size)throw Error(DAMAGED);
 return out;
}
/** A dropped file as text files: a .zip yields its CSV/TSV/TXT entries; anything
 * else is decoded as one text file. Zip entries are found through the central
 * directory (never by scanning for signatures, which photo bytes can contain),
 * inflated to exactly their recorded size and CRC-checked. */
export function readReadingFiles(name:string,bytes:Uint8Array):TextFile[]{
 if(!(bytes instanceof Uint8Array)||!bytes.length)throw Error('The file is empty.');
 if(bytes.length>READING_FILE_LIMITS.archive)throw Error('Choose a file smaller than 20 MB.');
 if(/\.(xlsx|xlsm|xls|numbers)$/i.test(name))throw Error('Excel and Numbers workbooks are not read yet. Use the .zip or the CSV the app emails.');
 const zip=bytes[0]===0x50&&bytes[1]===0x4b&&bytes[2]===3&&bytes[3]===4;
 if(!zip){if(bytes.length>READING_FILE_LIMITS.text)throw Error('Choose a text file smaller than 5 MB.');return [text(name,bytes)];}
 // End-of-central-directory: the record whose comment runs exactly to the end (a truncated download has none).
 let end=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(u32(bytes,i)===0x06054b50&&i+22+u16(bytes,i+20)===bytes.length){end=i;break;}
 if(end<0)throw Error(DAMAGED);
 const ZIP64='The zip uses ZIP64, which DeckCraft cannot open yet. Re-zip the export with standard settings.',limit=READING_FILE_LIMITS.text;
 const count=u16(bytes,end+10),directory=u32(bytes,end+16);
 if(count===0xffff||directory===0xffffffff)throw Error(ZIP64);
 if(count>READING_FILE_LIMITS.entries)throw Error(`The zip holds more than ${READING_FILE_LIMITS.entries} files.`);
 if(directory+u32(bytes,end+12)>end)throw Error(DAMAGED);
 const kept=new Map<string,Uint8Array>();let at=directory,total=0;
 for(let k=0;k<count;k++){
  if(at+46>end||u32(bytes,at)!==0x02014b50)throw Error(DAMAGED);
  const flags=u16(bytes,at+8),method=u16(bytes,at+10),crc=u32(bytes,at+16),packed=u32(bytes,at+20),size=u32(bytes,at+24),nameLength=u16(bytes,at+28),local=u32(bytes,at+42);
  const path=new TextDecoder(flags&0x800?'utf-8':'windows-1252').decode(bytes.subarray(at+46,at+46+nameLength)),segments=path.split(/[\\/]/).filter(s=>s&&s!=='.');
  at+=46+nameLength+u16(bytes,at+30)+u16(bytes,at+32);
  if(!/\.(csv|tsv|txt)$/i.test(path)||segments.some(s=>s==='__MACOSX'||s.startsWith('.')))continue;
  if(packed===0xffffffff||size===0xffffffff||local===0xffffffff)throw Error(ZIP64);
  if(flags&1)throw Error(`${baseName(path)} is encrypted. Export the zip without a password.`);
  if(size>limit)throw Error(`${baseName(path)} is larger than 5 MB.`);
  if((total+=size)>2*limit)throw Error('The zip holds more than 10 MB of text.');
  if(local+30>bytes.length||u32(bytes,local)!==0x04034b50)throw Error(DAMAGED);
  const start=local+30+u16(bytes,local+26)+u16(bytes,local+28);if(start+packed>bytes.length)throw Error(DAMAGED);
  const data=inflateEntry(bytes.subarray(start,start+packed),method,size);if(crc32(data)!==crc)throw Error(DAMAGED);
  kept.set(path,data); // a repeated name keeps the later copy, as unzip tools do
 }
 const out=[...kept].map(([path,data])=>text(path,data,' in the zip')).sort((a,b)=>a.name.localeCompare(b.name));
 if(!out.length)throw Error('The zip has no CSV files. Export the points as CSV from the app.');
 return out;
}

const lines=(text:string)=>text.replace(/^﻿/,'').split(/\r\n|\n|\r/).map((l,i)=>({text:l,row:i+1})).filter(l=>l.text.trim());
const ULEVEL_HEADER=/^\s*p\s*([,;\t])\s*x\s*\1\s*y\s*\1\s*z\s*(\1\s*comments?\s*)?$/i;
// A real header is about 20 characters; the length bound keeps the regex linear.
const uLevelHead=(f:TextFile)=>{const head=lines(f.text)[0]?.text??'';return head.length<=256&&ULEVEL_HEADER.test(head);};
/** True when one of the files is a U-Level / Smart Level Points export. */
export const isULevel=(files:TextFile[])=>files.some(uLevelHead);
/** Comments that name a fixed object rather than ground; the preview lets the
 * user flip any shot either way. */
const REFERENCE=/\b(sill|threshold|ffe|fin(?:ished)?\.? floor|tow|top of (?:wall|foundation|footing|concrete|slab)|wall top|tof|bm|bench ?mark|tp ?\d*|turning point)\b|^(?:back |front |patio |side )?door$/i;
export const suggestRole=(comment:string):ShotRole=>REFERENCE.test(comment.trim())?'reference':'ground';
/** Two shots at one spot would be refused as duplicate site points. */
const sameSpots=(shots:ImportedShot[])=>{const seen=new Map<string,string>(),out:string[]=[];for(const s of shots){if(s.x===undefined||s.z===undefined)continue;const key=`${s.x.toFixed(3)}:${s.z.toFixed(3)}`,prior=seen.get(key);if(prior)out.push(`${prior} and ${s.label} were recorded at the same spot. Keep one of them.`);else seen.set(key,s.label);}return out;};
const LENGTH_ROW=/^\s*(P\d+)\s*-\s*(P\d+)\s*[,;\t]\s*(.+?)\s*[,;\t]\s*([-+−]?[\d.,]+)\s*%\s*$/i;
const NUMERIC=/^[-+−]?\d+$/;
interface RecordedLength {from:string;to:string;inches?:number;marked:boolean;unit?:DetectedUnit;slopePct?:number;dp:number;den?:number}
/** Half the printed step of a recorded length in inches: 156.4" is good to
 * 0.05 in, 14.1' to 0.6 in, 13' 0 3/8" to 1/16 in. */
const halfStep=(r:RecordedLength,unit:LengthUnit)=>r.den?.5/r.den:.5*10**-r.dp*(r.marked?r.unit==='ft-in'?1:INCHES_PER[r.unit as LengthUnit]:INCHES_PER[unit]);
const tolerance=(r:RecordedLength,recordedIn:number,unit:LengthUnit)=>Math.max(.5,recordedIn*.02,halfStep(r,unit)+.25);

/** Read a U-Level / Smart Level export. `unit` overrides the unit of the bare
 * numbers; otherwise the Lengths file decides it (recorded length vs the
 * length computed from the points), then its unit mark, then inches. */
export function parseULevel(files:TextFile[],options:{unit?:LengthUnit;decimal?:'.'|','}={}):ReadingImport{
 // Newest export first: the stamp is MM-DD-YY_HH-MM, so compare it as YYMMDDHHMM, not as text.
 const when=(n:string)=>{const m=n.match(/^points_(\d{2})-(\d{2})-(\d{2})_(\d{2})-(\d{2})/i);return m?`${m[3]}${m[1]}${m[2]}${m[4]}${m[5]}`:'';};
 const candidates=files.filter(uLevelHead).sort((a,b)=>Number(!/^points_/i.test(a.name))-Number(!/^points_/i.test(b.name))||when(b.name).localeCompare(when(a.name))||b.name.localeCompare(a.name));
 if(!candidates.length)throw Error('No U-Level Points file (columns P, X, Y, Z, Comment) was found.');
 const points=candidates[0],[head,...body]=lines(points.text),delimiter=head.text.match(ULEVEL_HEADER)![1],warnings:string[]=[];
 if(candidates.length>1)warnings.push(`${candidates.length} Points files found; reading ${points.name} only.`);
 if(!body.length)throw Error(`${points.name} has no shots.`);
 // A closed line drops at most one row in four, so more than twice the cap can never fit.
 if(body.length>2*READING_FILE_LIMITS.shots)throw Error(`${points.name} has ${body.length} rows; DeckCraft takes up to ${READING_FILE_LIMITS.shots} shots.`);
 // The app writes ", " between columns; splitting on comma-plus-space keeps decimal commas (-4,29) whole.
 // A row re-saved by a spreadsheet loses the spaces and is split tight, then checked for decimal commas.
 const spaced=delimiter===','&&/,\s/.test(head.text),columns=head.text.split(delimiter).length;
 const unquote=(v:string)=>{const t=v.trim();return /^".*"$/s.test(t)?t.slice(1,-1).replace(/""/g,'"').trim():t;};
 const rows=body.map(l=>{
  let f=spaced?l.text.split(/,\s+|,\s*$/):l.text.split(delimiter),tight=!spaced;
  if(spaced&&(f.length<4||f[0].includes(','))){f=l.text.split(',');tight=true;}
  if(f.length<4)throw Error(`${points.name} row ${l.row}: expected P, X, Y and Z.`);
  // Decimal commas split each value in two: the row runs wider than the header with whole numbers where
  // the comment should be, and X/Y/Z never show a decimal point.
  if(tight&&delimiter===','&&f.length>columns&&f.slice(4,columns===4?5:6).every(v=>NUMERIC.test(v.trim()))&&!f.slice(1,4).some(v=>/\d\.\d/.test(v)))throw Error(`${points.name} row ${l.row}: this file uses commas both between columns and as the decimal mark. Export it with ";" between columns or with decimal points.`);
  const comment=unquote(f.slice(4).join(tight?delimiter:', '));
  return {rawId:unquote(f[0]),x:unquote(f[1]),y:unquote(f[2]),z:unquote(f[3]),comment,row:l.row};
 });
 const decimal=options.decimal??guessDecimal(rows.flatMap(r=>[r.x,r.y,r.z])),bare=(v:string)=>isBare(v,decimal);
 const read=(v:string,what:string,row:number)=>{try{return parseLength(v,'in',decimal);}catch(error){throw Error(`${points.name} row ${row}: ${what} ${(error as Error).message}`);}};
 // Parse with inches as the stand-in unit; bare numbers are rescaled once the unit is known.
 const parsed=rows.map(r=>({...r,px:read(r.x,'X',r.row),py:read(r.y,'Y',r.row),pz:read(r.z,'Z',r.row),line:Number(r.rawId.match(/^P(\d+)_\d+$/i)?.[1])||undefined}));
 type Row=typeof parsed[number];
 const same=(a:Row,b:Row)=>Math.abs(a.px.inches-b.px.inches)<1e-6&&Math.abs(a.py.inches-b.py.inches)<1e-6&&Math.abs(a.pz.inches-b.pz.inches)<1e-6;
 const groups=new Map<number,Row[]>();for(const r of parsed)if(r.line!==undefined){let g=groups.get(r.line);if(!g)groups.set(r.line,g=[]);g.push(r);}
 const closing=new Set<Row>(),closed=new Set<number>();
 for(const [n,g] of groups)if(g.length>=4&&same(g[0],g[g.length-1])){closing.add(g[g.length-1]);closed.add(n);}
 const shots=parsed.filter(r=>!closing.has(r));
 if(shots.length>READING_FILE_LIMITS.shots)throw Error(`${points.name} has ${shots.length} shots; DeckCraft takes up to ${READING_FILE_LIMITS.shots}.`);
 const labels=shots.map((_,i)=>`P${i+1}`),byLabel=new Map(shots.map((s,i)=>[labels[i],s]));
 // Lengths from the same export only: Points_<stamp>.csv pairs with Lengths_<stamp>.csv. A renamed
 // Points file (no stamp) may use the zip's only Lengths file.
 const stamp=points.name.replace(/^points_/i,'').toLowerCase(),allLengths=files.filter(f=>/^lengths_/i.test(f.name));
 const lengthsFile=allLengths.find(f=>f.name.toLowerCase()===`lengths_${stamp}`)??(!/^points_/i.test(points.name)&&allLengths.length===1?allLengths[0]:undefined);
 const recorded:RecordedLength[]=[];
 for(const l of lengthsFile?lines(lengthsFile.text):[]){
  const m=l.text.length>200?null:l.text.match(LENGTH_ROW);if(!m)continue;
  let length:ReturnType<typeof parseLength>|undefined;try{length=parseLength(m[3],'in',decimal);}catch{/* unreadable length */}
  const slope=Number(m[4].replace('−','-').replace(',','.')),last=m[3].match(/\d+(?:[.,](\d+))?(?!.*\d)/),den=m[3].match(/\d\s*\/\s*(\d+)/)?.[1];
  recorded.push({from:m[1].toUpperCase(),to:m[2].toUpperCase(),inches:length?.inches,marked:!!length&&!bare(m[3]),unit:length?.unit,dp:last?.[1]?.length??0,...(den?{den:Number(den)}:{}),...(Number.isFinite(slope)?{slopePct:slope}:{})});
 }
 // A bare 0 says nothing about the unit (the zero shot is often printed without marks).
 const unitless=(v:string,p:{inches:number})=>bare(v)&&p.inches!==0;
 const someBare=shots.some(s=>unitless(s.x,s.px)||unitless(s.y,s.py)||unitless(s.z,s.pz)),allBare=shots.every(s=>bare(s.x)&&bare(s.y)&&bare(s.z));
 if(someBare&&!allBare)warnings.push('Some values carry unit marks and some do not; bare numbers use the chosen unit.');
 const flat=(s:Row,u:LengthUnit)=>({x:bare(s.x)?s.px.inches*INCHES_PER[u]:s.px.inches,y:bare(s.y)?s.py.inches*INCHES_PER[u]:s.py.inches,z:bare(s.z)?s.pz.inches*INCHES_PER[u]:s.pz.inches});
 const measurable=recorded.filter(r=>r.marked&&r.inches!==undefined&&r.inches>1&&byLabel.has(r.from)&&byLabel.has(r.to));
 const misfit=(r:RecordedLength,u:LengthUnit)=>{const a=flat(byLabel.get(r.from)!,u),b=flat(byLabel.get(r.to)!,u),d=Math.hypot(b.x-a.x,b.y-a.y);return Math.abs(d-r.inches!)/tolerance(r,r.inches!,u);};
 let unit:LengthUnit='in',unitSource:ReadingImport['unitSource']='assumed';
 if(options.unit){unit=options.unit;unitSource='chosen';}
 else if(!someBare)unitSource='marks';
 else if(measurable.length){
  // Each unit scores the recorded lengths it reproduces; units differ by 2.54x or more, so one wins clearly.
  const scored=(['in','ft','cm','mm','m'] as LengthUnit[]).map(u=>({u,hits:measurable.filter(r=>misfit(r,u)<=1).length,error:measurable.reduce((n,r)=>n+Math.min(misfit(r,u),100),0)})).sort((a,b)=>b.hits-a.hits||a.error-b.error),best=scored[0];
  if(best.hits===measurable.length){unit=best.u;unitSource='lengths';}
  else if(best.hits>measurable.length/2){unit=best.u;unitSource='lengths';warnings.push(`Most recorded lengths match ${best.u}; ${measurable.length-best.hits} do not. Check those lines.`);}
  else warnings.push('The recorded lengths do not match the points in any unit. Check the unit before applying.');
 }
 if(unitSource==='assumed')warnings.push('The export does not state its unit; inches are assumed. Check the preview against a known distance.');
 const groupsInLengths=new Set(recorded.filter(r=>byLabel.has(r.from)&&byLabel.has(r.to)).flatMap(r=>{const a=byLabel.get(r.from)!.line,b=byLabel.get(r.to)!.line;return a!==undefined&&a===b?[a]:[];}));
 const ids=uniqueIds(shots.map((s,i)=>s.comment?`${labels[i]} (${s.comment})`:labels[i]));
 const out:ImportedShot[]=shots.map((s,i)=>{const v=flat(s,unit);return {id:ids[i],label:labels[i],rawId:s.rawId,comment:s.comment,x:v.x,z:v.y,heightIn:signedHeight(v.z,'height-up'),raw:{x:s.x,y:s.y,height:s.z},row:s.row,role:suggestRole(s.comment),...(s.line!==undefined&&(closed.has(s.line)||groupsInLengths.has(s.line))?{line:s.line}:{})};});
 const lineIds=[...new Set(out.flatMap(s=>s.line===undefined?[]:[s.line]))];
 const linesOut:ImportedLine[]=lineIds.map((n,i)=>({id:n,label:closed.has(n)?`House line ${i+1}`:`Line ${i+1}`,shotIds:out.filter(s=>s.line===n).map(s=>s.id),closed:closed.has(n)}));
 // Half the printed step of a height in inches (-3.08 in decimal feet is good to 0.06 in), so slopes over
 // short runs are judged against what the export can actually say.
 const zHalf=(raw:string)=>{const den=raw.match(/\d\s*\/\s*(\d+)/)?.[1];if(den)return .5/Number(den);const dp=raw.match(/\d+(?:[.,](\d+))?(?!.*\d)/)?.[1]?.length??0;let u:DetectedUnit=unit;if(!bare(raw)){try{u=parseLength(raw,unit,decimal).unit;}catch{/* unreadable: already refused */}}return .5*10**-dp*(u==='ft-in'?1:INCHES_PER[u]);};
 const lengthChecks:LengthCheck[]=recorded.filter(r=>r.inches!==undefined&&byLabel.has(r.from)&&byLabel.has(r.to)).map(r=>{const a=out[labels.indexOf(r.from)],b=out[labels.indexOf(r.to)],computedIn=Math.hypot(b.x!-a.x!,b.z!-a.z!),computedSlopePct=computedIn>0?(b.heightIn-a.heightIn)/computedIn*100:0,recordedIn=r.marked?r.inches!:r.inches!*INCHES_PER[unit];return {from:r.from,to:r.to,recordedIn,computedIn,...(r.slopePct!==undefined?{slopePct:r.slopePct}:{}),computedSlopePct,ok:Math.abs(computedIn-recordedIn)<=tolerance(r,recordedIn,unit)&&(r.slopePct===undefined||computedIn<1e-6||Math.abs(computedSlopePct-r.slopePct)<=.15+100*(zHalf(a.raw.height)+zHalf(b.raw.height)+.02)/computedIn)};});
 const bad=lengthChecks.filter(c=>!c.ok);if(bad.length)warnings.push(`${bad.length} recorded length${bad.length>1?'s':''} (${bad.map(c=>`${c.from}-${c.to}`).join(', ')}) disagree with the points. Check the unit or the export.`);
 warnings.push(...sameSpots(out));
 return {format:'u-level',fileName:points.name,shots:out,lines:linesOut,unit:unitSource==='marks'?(shots.map(s=>s.pz.unit).find(u=>u!=='in')??'in'):unit,unitSource,lengthChecks,warnings};
}

/** Generic column import: any CSV/TSV/TXT with a header row. Positions are
 * optional (both X and Y, or neither). `yAxis:'up'` is for map-style files
 * whose Y grows away from the viewer; it is turned into DeckCraft's z. */
export interface ColumnMapping {name?:number;x?:number;y?:number;height:number;comment?:number;
 /** Rod-and-level only: BS/FS per row (IS and SS count as foresights). */
 sight?:number;unit:LengthUnit;decimal:'.'|',';kind:ReadingKind|'rod';yAxis:'down'|'up';
 /** Rod-and-level: the benchmark's elevation (default 0); the first backsight's point is the benchmark. */
 benchmarkIn?:number}
export function readingColumns(file:TextFile){const rows=csvRows(file.text);return {header:rows[0].fields,sample:rows.slice(1,6).map(r=>r.fields),rows:rows.length-1};}
const COLUMN_NAMES:[keyof Pick<ColumnMapping,'name'|'x'|'y'|'height'|'comment'|'sight'>,RegExp][]=[['name',/^(p|pt|pnt|point|point ?(id|no|name|label)|id|name|label|station|sta)$/i],['x',/^(x|easting|east|e)$/i],['y',/^(y|northing|north|n)$/i],['height',/^(z|h|height|elev|elevation|level|reading|rod|rod reading|value|grade)$/i],['comment',/^(comments?|desc|description|note|notes|code|remark|remarks)$/i],['sight',/^(sight|bs ?\/ ?fs)$/i]];
/** Columns named like name/X/Y/Z/comment/sight, by header text. */
export function guessMapping(header:string[]):Partial<Pick<ColumnMapping,'name'|'x'|'y'|'height'|'comment'|'sight'>>{
 const out:Partial<Record<string,number>>={};for(const [key,re] of COLUMN_NAMES){const i=header.findIndex((h,j)=>re.test(h.trim())&&!Object.values(out).includes(j));if(i>=0)out[key]=i;}return out;
}
export function parseColumnReadings(file:TextFile,mapping:ColumnMapping):ReadingImport{
 const rows=csvRows(file.text),header=rows.shift()!.fields,warnings:string[]=[],cell=(r:{fields:string[]},i?:number)=>i===undefined?'':(r.fields[i]??'').trim();
 const columns=[mapping.name,mapping.x,mapping.y,mapping.height,mapping.comment,mapping.sight].filter((v):v is number=>v!==undefined);
 if(columns.some(i=>!Number.isInteger(i)||i<0||i>=header.length))throw Error('A chosen column is not in the file.');
 if(new Set(columns).size!==columns.length)throw Error('Choose a different column for each field.');
 if((mapping.x===undefined)!==(mapping.y===undefined))throw Error('Choose both X and Y, or neither.');
 if(mapping.kind==='rod'&&(mapping.sight===undefined||mapping.name===undefined))throw Error('Rod readings need a point name column and a column saying BS or FS.');
 if(!rows.length)throw Error(`${file.name} has no rows under its header.`);
 if(rows.length>READING_FILE_LIMITS.shots)throw Error(`${file.name} has ${rows.length} rows; DeckCraft takes up to ${READING_FILE_LIMITS.shots}.`);
 // Extra non-empty values mean an unquoted separator (often a decimal comma) shifted the columns.
 const wide=rows.find(r=>r.fields.slice(header.length).some(v=>v!==''));
 if(wide)throw Error(`Row ${wide.line} has ${wide.fields.length} values but the header has ${header.length} columns. Quote values that contain the separator; a file with decimal commas needs ";" or tabs between columns.`);
 const read=(v:string,what:string,row:number)=>{try{return parseLength(v,mapping.unit,mapping.decimal);}catch(error){throw Error(`Row ${row}: ${what} ${(error as Error).message}`);}};
 const names=uniqueIds(rows.map((r,i)=>cell(r,mapping.name)||`Shot ${i+1}`));
 const parsed=rows.map((r,i)=>({id:names[i],comment:cell(r,mapping.comment),row:r.line,rawX:cell(r,mapping.x),rawY:cell(r,mapping.y),rawH:cell(r,mapping.height),height:read(cell(r,mapping.height),'height',r.line),x:mapping.x===undefined?undefined:read(cell(r,mapping.x),'X',r.line).inches,y:mapping.y===undefined?undefined:read(cell(r,mapping.y),'Y',r.line).inches,sight:cell(r,mapping.sight).toLowerCase()}));
 // Above/below words already give an absolute direction; only the sign of plain values follows the kind.
 const heights=parsed.map(p=>mapping.kind==='rod'?0:p.height.worded?p.height.inches:signedHeight(p.height.inches,mapping.kind)),roles=parsed.map(p=>suggestRole(p.comment)),keep=parsed.map(()=>true);
 if(mapping.kind==='rod'){
  const sights=parsed.map(p=>{if(/^(bs|b|backsight|\+)$/.test(p.sight))return 'bs' as const;if(/^(fs|f|foresight|is|ss|sideshot|-)$/.test(p.sight))return 'fs' as const;throw Error(`Row ${p.row}: sight "${p.sight}" is not BS or FS.`);});
  if(sights[0]!=='bs')throw Error('Rod readings start with a backsight on the benchmark.');
  // Rows naming the same point are one point (a turning point is read as FS then BS).
  const name=(i:number)=>cell(rows[i],mapping.name)||names[i],benchmark={id:name(0),elevationIn:mapping.benchmarkIn??0};
  const run=levelRun(benchmark,parsed.map((p,i)=>({id:name(i),sight:sights[i],rodIn:p.height.inches})));
  if(run.misclosures.length)warnings.push(...run.misclosures.map(m=>`The run closes on ${m.id} ${m.errorIn>=0?'+':''}${m.errorIn.toFixed(2)} in off.`));
  const seen=new Set<string>(),turning=new Set(run.rows.filter((r,i)=>r.sight==='bs'&&i>0).map(r=>r.id));
  parsed.forEach((_,i)=>{const id=name(i),e=run.points.find(q=>q.id===id)!.elevationIn;heights[i]=e;if(seen.has(id))keep[i]=false;seen.add(id);if(id===benchmark.id||turning.has(id))roles[i]='reference';});
 }
 const out:ImportedShot[]=parsed.flatMap((p,i)=>keep[i]?[{id:p.id,label:p.id,rawId:p.id,comment:p.comment,...(p.x!==undefined&&p.y!==undefined?{x:p.x,z:mapping.yAxis==='up'?-p.y:p.y}:{}),heightIn:heights[i],raw:{...(p.x!==undefined?{x:p.rawX,y:p.rawY}:{}),height:p.rawH},row:p.row,role:roles[i]}]:[]);
 warnings.push(...sameSpots(out));
 return {format:'columns',fileName:file.name,shots:out,lines:[],unit:mapping.unit,unitSource:'chosen',lengthChecks:[],warnings};
}

/** Saved column choices, kept by header text so a preset survives column
 * reordering. Browser storage is a per-device convenience only. */
export interface ReadingPreset {name:string;columns:Partial<Record<'name'|'x'|'y'|'height'|'comment'|'sight',string>>;unit:LengthUnit;decimal:'.'|',';kind:ColumnMapping['kind'];yAxis:'down'|'up'}
const PRESET_KEY='deckcraft-reading-presets-v1';
const validPreset=(p:unknown):p is ReadingPreset=>{const r=p as ReadingPreset;return !!r&&typeof r==='object'&&typeof r.name==='string'&&!!r.name.trim()&&r.name.length<=60&&!!r.columns&&typeof r.columns==='object'&&typeof r.columns.height==='string'&&Object.values(r.columns).every(v=>typeof v==='string'&&v.length<=100)&&typeof r.unit==='string'&&Object.hasOwn(INCHES_PER,r.unit)&&(r.decimal==='.'||r.decimal===',')&&['height-up','height-down','elevation','rod'].includes(r.kind)&&(r.yAxis==='down'||r.yAxis==='up');};
export function loadReadingPresets(storage?:Pick<Storage,'getItem'>):ReadingPreset[]{try{const raw=(storage??globalThis.localStorage)?.getItem(PRESET_KEY);const list=raw?JSON.parse(raw):[];return Array.isArray(list)?list.filter(validPreset).slice(0,20):[];}catch{return [];}}
export function saveReadingPreset(preset:ReadingPreset,storage?:Pick<Storage,'getItem'|'setItem'>):boolean{
 if(typeof preset?.name!=='string'||!preset.name.trim())throw Error('Name the preset.');
 if(preset.name.length>60)throw Error('Keep the preset name to 60 characters or fewer.');
 if(Object.values(preset.columns??{}).some(v=>typeof v!=='string'||v.length>100))throw Error("Column names longer than 100 characters can't be saved in a preset.");
 if(!validPreset(preset))throw Error('Choose a height column, unit and reading kind for the preset.');
 try{const s=storage??globalThis.localStorage,list=loadReadingPresets(s).filter(p=>p.name!==preset.name);s.setItem(PRESET_KEY,JSON.stringify([preset,...list].slice(0,20)));return true;}catch{return false;}
}
export function presetFromMapping(name:string,header:string[],m:ColumnMapping):ReadingPreset{
 const columns:ReadingPreset['columns']={};for(const key of ['name','x','y','height','comment','sight'] as const){const i=m[key];if(i!==undefined)columns[key]=header[i];}
 return {name:name.trim(),columns,unit:m.unit,decimal:m.decimal,kind:m.kind,yAxis:m.yAxis};
}
/** A preset applied to a file's header; undefined when its height column is missing. */
export function mappingFromPreset(header:string[],preset:ReadingPreset):ColumnMapping|undefined{
 const find=(name?:string)=>name===undefined?undefined:header.findIndex(h=>h.trim().toLowerCase()===name.trim().toLowerCase());
 const height=find(preset.columns.height);if(height===undefined||height<0)return undefined;
 const out:ColumnMapping={height,unit:preset.unit,decimal:preset.decimal,kind:preset.kind,yAxis:preset.yAxis};
 for(const key of ['name','x','y','comment','sight'] as const){const i=find(preset.columns[key]);if(i!==undefined&&i>=0)out[key]=i;}
 return out;
}
/** One entry point for the importer: U-Level files are recognised by their
 * header; anything else needs a column mapping. */
export function importReadings(files:TextFile[],mapping?:ColumnMapping,options:{unit?:LengthUnit;decimal?:'.'|','}={}):ReadingImport{
 if(isULevel(files))return parseULevel(files,options);
 if(!mapping)throw Error('Choose which columns hold the name, position and height.');
 if(files.length!==1)throw Error('Choose one CSV file from the zip to map.');
 return parseColumnReadings(files[0],mapping);
}
