import {readProjectValue,writeProjectValues} from './projectStorage';
export const SURVEY_ATTACHMENT_LIMIT=16_000_000;
export interface SurveyAttachmentRecord {blob:Blob;name:string;sha256:string;type:string;savedAt:string}
export async function attachmentHash(bytes:Uint8Array){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as Uint8Array<ArrayBuffer>))].map(n=>n.toString(16).padStart(2,'0')).join('');}
export function surveyAttachmentType(bytes:Uint8Array){
 if(bytes.length>=8&&[137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n))return 'image/png';
 if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 const text=new TextDecoder().decode(bytes.subarray(0,12));if(text.startsWith('RIFF')&&text.slice(8)==='WEBP')return 'image/webp';
 if(text.startsWith('%PDF-'))return 'application/pdf';
 throw Error('Use a PNG, JPEG, WebP or PDF survey attachment.');
}
export async function prepareSurveyAttachment(file:Blob,name:string){
 if(!(file instanceof Blob)||file.size<1||file.size>SURVEY_ATTACHMENT_LIMIT)throw Error('Survey attachment must be between 1 byte and 16 MB.');
 if(typeof name!=='string'||!name.trim()||name.length>120||/[\u0000-\u001f]/.test(name))throw Error('Use a survey attachment name up to 120 characters.');
 const bytes=new Uint8Array(await file.arrayBuffer()),type=surveyAttachmentType(bytes),sha256=await attachmentHash(bytes),id=`survey-${sha256.slice(0,32)}`;
 return {id,record:{blob:new Blob([bytes],{type}),name:name.trim(),sha256,type,savedAt:new Date().toISOString()} satisfies SurveyAttachmentRecord};
}
export async function putSurveyAttachment(file:Blob,name:string):Promise<string>{const {id,record}=await prepareSurveyAttachment(file,name);await writeProjectValues([{store:'attachments',key:id,value:record}]);return id;}
export async function getSurveyAttachment(id:string):Promise<{blob:Blob;name:string}|undefined>{const r=await getSurveyAttachmentRecord(id);return r?{blob:r.blob,name:r.name}:undefined;}
export async function getSurveyAttachmentRecord(id:string):Promise<SurveyAttachmentRecord|undefined>{
 if(typeof id!=='string'||!/^survey-[a-f0-9]{32}$/.test(id))throw Error('Invalid survey attachment reference.');const record=await readProjectValue<SurveyAttachmentRecord>('attachments',id);if(!record)return undefined;
 const checked=await prepareSurveyAttachment(record.blob,record.name);if(checked.id!==id||checked.record.type!==record.type||checked.record.sha256!==record.sha256)throw Error('The stored survey attachment is damaged.');return record;
}
