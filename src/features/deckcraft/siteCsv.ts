import './siteModelRuntime';
import type {SitePoint} from './siteModel';
import {validateSiteModel,SITE_LIMITS} from './siteModel';
export type SiteCsvUnit='ft'|'m'|'in';
export interface SiteCsvOptions {xColumn:string|number;zColumn:string|number;elevationColumn:string|number;horizontalUnit:SiteCsvUnit;verticalUnit:SiteCsvUnit;originX?:number;originZ?:number;elevationDatum?:number;idColumn?:string|number;header?:boolean;delimiter?:','|';'|'\t'}
const factor=(unit:SiteCsvUnit)=>unit==='ft'?12:unit==='m'?1000/25.4:unit==='in'?1:(()=>{throw Error('Choose ft, m or in for CSV units.');})();
/** CSV quoting supports escaped quotes, delimiters and line breaks inside
 * fields. A quote opens a quoted field only at the start of a field; anywhere
 * else it is a literal inch mark (6' 3"). CR, CRLF and LF all end a row.
 * Origin values use horizontal units; elevation datum uses vertical units.
 * Subtraction happens before conversion to model inches. */
export function csvRows(text:string,requestedDelimiter?:','|';'|'\t'){
 if(typeof text!=='string'||text.length>5_000_000)throw Error('CSV text is missing or too large.');
 const input=text.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n'),counts=new Map<string,number>([[',',0],[';',0],['\t',0]]);let headerQuoted=false,fieldStart=true;for(let i=0;i<input.length;i++){const ch=input[i];if(headerQuoted){if(ch==='"'){if(input[i+1]==='"')i++;else headerQuoted=false;}continue;}if(ch==='\n')break;if(ch==='"'&&fieldStart){headerQuoted=true;fieldStart=false;continue;}if(counts.has(ch)){counts.set(ch,counts.get(ch)!+1);fieldStart=true;}else if(ch.trim())fieldStart=false;}
 const delimiter=requestedDelimiter??[...counts].sort((a,b)=>b[1]-a[1])[0][0],rows:{fields:string[];line:number}[]=[];
 // `blank` tracks an all-space field so each quote test is O(1) (re-trimming the field was quadratic).
 let field='',fields:string[]=[],quoted=false,closed=false,blank=true,line=1,startLine=1;
 for(let i=0;i<=input.length;i++){const ch=input[i];
  if(quoted){if(ch==='"'){if(input[i+1]==='"'){field+='"';i++;}else {quoted=false;closed=true;}}else if(ch===undefined)throw Error(`Row ${startLine}: unclosed quoted field.`);else {field+=ch;if(ch==='\n')line++;}continue;}
  if(ch==='"'&&blank&&!closed){quoted=true;field='';continue;}
  if(ch===delimiter||ch==='\n'||ch===undefined){fields.push(field.trim());field='';closed=false;blank=true;if(ch!==delimiter){if(fields.some(v=>v!==''))rows.push({fields,line:startLine});fields=[];line++;startLine=line;}continue;}
  if(ch==='\r')continue;
  if(closed&&ch.trim())throw Error(`Row ${line}: text follows a closing quote.`);field+=ch;if(ch.trim())blank=false;
 }
 if(!rows.length)throw Error('CSV contains no rows.');
 return rows;
}
/** Header fields use the same quoting/delimiter rules as atomic point import. */
export function siteCsvColumns(text:string){return csvRows(text)[0].fields;}
export function parseSiteCsv(text:string,options:SiteCsvOptions):SitePoint[]{
 const rows=csvRows(text,options.delimiter);
 const hasHeader=options.header!==false,header=hasHeader?rows.shift()!.fields:[],column=(requested:string|number,label:string)=>{if(typeof requested==='number'){if(!Number.isInteger(requested)||requested<0||requested>100)throw Error(`${label} column index is invalid.`);return requested;}if(!hasHeader)throw Error('Column names require a CSV header.');const target=requested.trim().toLowerCase(),hits=header.flatMap((v,i)=>v.trim().toLowerCase()===target?[i]:[]);if(hits.length!==1)throw Error(`${label} column ${requested} is missing or ambiguous.`);return hits[0];};
 const xi=column(options.xColumn,'X'),zi=column(options.zColumn,'Z'),ei=column(options.elevationColumn,'Elevation'),ii=options.idColumn===undefined?undefined:column(options.idColumn,'ID');
 if(new Set([xi,zi,ei]).size!==3)throw Error('X, Z and elevation must use different columns.');
 const horizontal=factor(options.horizontalUnit),vertical=factor(options.verticalUnit),originX=options.originX??0,originZ=options.originZ??0,datum=options.elevationDatum??0;
 if(![originX,originZ,datum].every(Number.isFinite))throw Error('CSV origin and datum must be finite.');
 if(rows.length<3||rows.length>SITE_LIMITS.points)throw Error(`CSV needs 3–${SITE_LIMITS.points} survey rows.`);
 const errors:string[]=[],points=rows.map((row,i)=>{const number=(index:number,label:string)=>{const token=row.fields[index];if(token===undefined||!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?$/i.test(token)||!Number.isFinite(Number(token))){errors.push(`Row ${row.line}: invalid ${label}.`);return NaN;}return Number(token);};return {id:ii===undefined?`site-${i+1}`:row.fields[ii]??'',xIn:(number(xi,'X')-originX)*horizontal,zIn:(number(zi,'Z')-originZ)*horizontal,elevationIn:(number(ei,'elevation')-datum)*vertical};});
 if(errors.length)throw Error(errors.slice(0,12).join(' '));
 return validateSiteModel({version:1,points,grading:[]}).points;
}
