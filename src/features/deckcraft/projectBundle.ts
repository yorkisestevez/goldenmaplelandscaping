import {zipSync,unzipSync,strToU8,strFromU8,Inflate} from 'fflate';
import {parseDeckReleaseDesign,serializeDeckReleaseDesign} from './deckRelease';
import {getSurveyAttachmentRecord,prepareSurveyAttachment,attachmentHash,SURVEY_ATTACHMENT_LIMIT} from './surveyAttachments';
import {writeProjectValues} from './projectStorage';
import type {DeckData} from './types';
import {ensureDesignExtensions} from './designExtensions';

export const PROJECT_BUNDLE_LIMITS={archive:20_000_000,decoded:18_000_000,design:1_000_000,manifest:32_000,entries:3} as const;
const FORMAT='deckcraft-project-bundle',PRIVATE=['poolQuoteInputs','quoteResolutions','pergolaQuoteCosts','materialMarkup','customLaborCost','customOverrides','addOnTransitionLabor','addOnHardwareCost','addOnFlashingLf','customerName','projectAddress','scopeOfWork','generatedImageUrl','isGeneratingImage'];
interface BundleEntry {path:string;sha256:string;size:number}
interface BundleAttachment extends BundleEntry {id:string;name:string;type:string}
interface BundleManifest {format:typeof FORMAT;version:1;design:BundleEntry;attachments:BundleAttachment[]}
const extensions:Record<string,string>={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','application/pdf':'pdf'};
const reject=(message:string):never=>{throw Error(message);};
const plain=(value:unknown):Record<string,unknown>=>{if(!value||typeof value!=='object'||Array.isArray(value))reject('Invalid project bundle metadata.');return value as Record<string,unknown>;};
function exact(value:Record<string,unknown>,keys:string[]){if(Object.keys(value).sort().join(',')!==keys.sort().join(','))reject('Unsupported project bundle fields.');}
function entry(value:unknown):BundleEntry {const v=plain(value);if(typeof v.path!=='string'||typeof v.sha256!=='string'||! /^[a-f0-9]{64}$/.test(v.sha256)||!Number.isSafeInteger(v.size)||Number(v.size)<1)reject('Invalid project bundle file metadata.');return v as unknown as BundleEntry;}
function manifest(value:unknown):BundleManifest {
 const v=plain(value);exact(v,['format','version','design','attachments']);if(v.format!==FORMAT||v.version!==1||!Array.isArray(v.attachments)||v.attachments.length>1)reject('Unsupported project bundle version or attachments.');
 const design=entry(v.design);exact(plain(v.design),['path','sha256','size']);if(design.path!=='design.json'||design.size>PROJECT_BUNDLE_LIMITS.design)reject('Invalid project design entry.');
 const attachments=(v.attachments as unknown[]).map((a:unknown)=>{const r=plain(a),e=entry(a);exact(r,['id','name','type','path','sha256','size']);if(typeof r.id!=='string'||!/^survey-[a-f0-9]{32}$/.test(r.id)||r.id!==`survey-${e.sha256.slice(0,32)}`||typeof r.name!=='string'||!r.name.trim()||r.name.length>120||/[\u0000-\u001f]/.test(r.name)||typeof r.type!=='string'||!extensions[r.type]||e.path!==`attachments/${r.id}.${extensions[r.type]}`||e.size>SURVEY_ATTACHMENT_LIMIT)reject('Invalid survey attachment metadata.');return r as unknown as BundleAttachment;});
 return {format:FORMAT,version:1,design,attachments};
}
/** Read the directory before inflation. No filesystem paths are ever extracted.
 * ZIP64, encrypted entries, duplicate names and undeclared files are rejected. */
interface ZipEntry {size:number;start:number;compressed:number;method:number}
function inspectArchive(bytes:Uint8Array):Map<string,ZipEntry>{
 if(bytes.length<22||bytes.length>PROJECT_BUNDLE_LIMITS.archive)reject('Choose a project ZIP smaller than 20 MB.');const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let end=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(view.getUint32(i,true)===0x06054b50&&i+22+view.getUint16(i+20,true)===bytes.length){end=i;break;}
 if(end<0||view.getUint16(end+20,true)!==0)reject('Invalid project ZIP directory or unsupported archive comment.');const count=view.getUint16(end+10,true),directorySize=view.getUint32(end+12,true),directory=view.getUint32(end+16,true);
 if(view.getUint16(end+4,true)||view.getUint16(end+6,true)||view.getUint16(end+8,true)!==count||count<2||count>PROJECT_BUNDLE_LIMITS.entries||directory+directorySize!==end)reject('Unsupported project ZIP structure.');
 const files=new Map<string,ZipEntry>();let offset=directory,total=0;
 for(let i=0;i<count;i++){
  if(offset+46>end||view.getUint32(offset,true)!==0x02014b50)reject('Invalid project ZIP entry.');const flags=view.getUint16(offset+8,true),method=view.getUint16(offset+10,true),compressed=view.getUint32(offset+20,true),size=view.getUint32(offset+24,true),nameLength=view.getUint16(offset+28,true),extra=view.getUint16(offset+30,true),comment=view.getUint16(offset+32,true),local=view.getUint32(offset+42,true);
  if(offset+46+nameLength+extra+comment>end||view.getUint16(offset+34,true)||flags&1||![0,8].includes(method)||compressed===0xffffffff||size===0xffffffff||local===0xffffffff)reject('Unsupported compressed project entry.');
  const name=new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(offset+46,offset+46+nameLength));const attachment=/^attachments\/survey-[a-f0-9]{32}\.(png|jpg|webp|pdf)$/.test(name);
  if(!['manifest.json','design.json'].includes(name)&&!attachment||files.has(name))reject('The ZIP contains an unexpected or duplicate file.');
  const limit=name==='manifest.json'?PROJECT_BUNDLE_LIMITS.manifest:name==='design.json'?PROJECT_BUNDLE_LIMITS.design:SURVEY_ATTACHMENT_LIMIT;
  if(size<1||size>limit||(total+=size)>PROJECT_BUNDLE_LIMITS.decoded)reject('The decoded project ZIP is too large.');
  if(local+30>directory||view.getUint32(local,true)!==0x04034b50||view.getUint16(local+6,true)!==flags||view.getUint16(local+8,true)!==method)reject('Invalid local project ZIP header.');
  const localName=view.getUint16(local+26,true),localExtra=view.getUint16(local+28,true),start=local+30+localName+localExtra;
  if(start+compressed>directory||new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(local+30,local+30+localName))!==name)reject('Project ZIP headers disagree.');
  if(method===0&&compressed!==size)reject('Stored ZIP entry sizes disagree.');files.set(name,{size,start,compressed,method});offset+=46+nameLength+extra+comment;
 }
 if(offset!==end||!files.has('manifest.json')||!files.has('design.json'))reject('The ZIP has no project design or manifest.');return files;
}
/** A forged directory can claim a short decoded length for a large DEFLATE
 * stream. Count output in small bounded chunks before allocating ZIP files. */
function verifyDecodedSizes(bytes:Uint8Array,directory:Map<string,ZipEntry>){
 for(const e of directory.values())if(e.method===8){let decoded=0;const stream=new Inflate(chunk=>{decoded+=chunk.length;if(decoded>e.size)reject('A compressed entry exceeds its declared size.');});for(let offset=0;offset<e.compressed;offset+=1024)stream.push(bytes.subarray(e.start+offset,e.start+Math.min(e.compressed,offset+1024)),offset+1024>=e.compressed);if(decoded!==e.size)reject('A compressed entry has an incorrect decoded size.');}
}
/** Portable project files omit customer details, contractor prices and supplier
 * rates. A survey image/PDF is included only with the explicit option. */
export async function exportProjectBundle(data:DeckData,{includeSurvey=false}:{includeSurvey?:boolean}={}):Promise<Blob>{
 await ensureDesignExtensions(data);
 const portable=structuredClone(data) as DeckData&Record<string,unknown>;for(const key of PRIVATE)delete portable[key];
 if(!includeSurvey&&portable.siteModel?.overlay)delete portable.siteModel.overlay;
 const publicFile=JSON.parse(serializeDeckReleaseDesign(portable));for(const key of PRIVATE)delete publicFile.configuration[key];
 const design=strToU8(JSON.stringify(publicFile)),files:Record<string,Uint8Array>={'design.json':design};if(design.length>PROJECT_BUNDLE_LIMITS.design)reject('The portable project exceeds 1 MB.');
 const attachments:BundleAttachment[]=[];
 if(includeSurvey&&portable.siteModel?.overlay){const overlay=portable.siteModel.overlay,r=await getSurveyAttachmentRecord(overlay.attachmentId);if(!r)reject('The survey attachment is missing on this device. Import the original survey before exporting it.');const path=`attachments/${overlay.attachmentId}.${extensions[r.type]}`;if(!extensions[r.type])reject('Unsupported stored survey type.');files[path]=new Uint8Array(await r.blob.arrayBuffer());attachments.push({id:overlay.attachmentId,path,name:r.name,type:r.type,sha256:r.sha256,size:r.blob.size});}
 const info:BundleManifest={format:FORMAT,version:1,design:{path:'design.json',sha256:await attachmentHash(design),size:design.length},attachments};files['manifest.json']=strToU8(JSON.stringify(info));const archive=zipSync(files,{level:6});if(archive.length>PROJECT_BUNDLE_LIMITS.archive)reject('The project ZIP exceeds 20 MB.');return new Blob([archive.slice().buffer],{type:'application/zip'});
}
export async function importProjectBundle(blob:Blob):Promise<DeckData>{
 if(!(blob instanceof Blob)||blob.size>PROJECT_BUNDLE_LIMITS.archive)reject('Choose a project ZIP smaller than 20 MB.');const compressed=new Uint8Array(await blob.arrayBuffer()),directory=inspectArchive(compressed);verifyDecodedSizes(compressed,directory);const files=unzipSync(compressed);
 for(const [path,e] of directory)if(!files[path]||files[path].length!==e.size)reject('The decoded ZIP differs from its directory.');if(Object.keys(files).length!==directory.size)reject('Unexpected ZIP entries.');
 const info=manifest(JSON.parse(strFromU8(files['manifest.json']))),expected=['manifest.json',info.design.path,...info.attachments.map(a=>a.path)];if(expected.length!==directory.size||expected.some(path=>!directory.has(path)))reject('The ZIP contains undeclared files.');
 for(const e of [info.design,...info.attachments])if(files[e.path].length!==e.size||await attachmentHash(files[e.path])!==e.sha256)reject('A project file failed its integrity check.');
 const designText=new TextDecoder('utf-8',{fatal:true}).decode(files[info.design.path]),raw=plain(JSON.parse(designText));exact(raw,['format','version','units','configuration']);if(raw.format!=='golden-maple-deck-design'||raw.version!==1||raw.units!=='inches-and-feet')reject('Unsupported project design format or units.');const configuration=plain(raw.configuration);if(PRIVATE.some(key=>Object.hasOwn(configuration,key)))reject('Portable projects cannot contain customer details or private prices.');await ensureDesignExtensions(raw);const design=parseDeckReleaseDesign(designText),overlay=design.siteModel?.overlay;
 if(info.attachments.length!==Number(!!overlay)||overlay&&info.attachments[0].id!==overlay.attachmentId)reject('The survey reference does not match its attachment.');
 const records=[];
 for(const a of info.attachments){const prepared=await prepareSurveyAttachment(new Blob([files[a.path].slice().buffer],{type:a.type}),a.name);if(prepared.id!==a.id||prepared.record.type!==a.type||prepared.record.sha256!==a.sha256)reject('The survey content differs from its metadata.');records.push({store:'attachments' as const,key:a.id,value:prepared.record});}
 await writeProjectValues(records);return design;
}
