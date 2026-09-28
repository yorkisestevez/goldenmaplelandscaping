/** Minimal browser Web Speech contract. No transcription backend or microphone is started at construction. */
export interface DictationAlternative {transcript:string}
export interface DictationResult {isFinal:boolean;length:number;[index:number]:DictationAlternative}
export interface DictationEvent {resultIndex:number;results:{length:number;[index:number]:DictationResult}}
export interface RecognitionLike {
 lang:string;continuous:boolean;interimResults:boolean;
 onstart:((event?:unknown)=>void)|null;onend:((event?:unknown)=>void)|null;
 onerror:((event:{error?:string;message?:string})=>void)|null;onresult:((event:DictationEvent)=>void)|null;
 start:()=>void;stop:()=>void;abort:()=>void;
}
export type RecognitionFactory=()=>RecognitionLike;
export type DictationState='idle'|'starting'|'listening'|'stopping'|'error';
export interface DictationUpdate {state:DictationState;finalText:string;interimText:string;error:string}
export interface VoiceDictation {start:()=>boolean;stop:()=>void;abort:()=>void;read:()=>DictationUpdate}
/** Detect browser support without constructing recognition, requesting permission or recording. */
export function browserSpeechFactory(surface:unknown=globalThis):RecognitionFactory|null {
 if(!surface||typeof surface!=='object')return null;const host=surface as {SpeechRecognition?:new()=>RecognitionLike;webkitSpeechRecognition?:new()=>RecognitionLike},Ctor=host.SpeechRecognition??host.webkitSpeechRecognition;return typeof Ctor==='function'?()=>new Ctor():null;
}
function errorText(code:string){return ({'not-allowed':'Microphone permission was denied. Allow microphone access in your browser, or type your request.','service-not-allowed':'Your browser speech service is unavailable. Type your request instead.','audio-capture':'No microphone is available. Connect one or type your request.','network':'The browser speech service could not connect. You can retry or type your request.','no-speech':'No speech was detected. Try Talk again or type your request.','aborted':'Dictation stopped.'} as Record<string,string>)[code]??'Speech transcription stopped. Try again or type your request.';}
/** Session-scoped results prevent duplicate final text and ignore callbacks after stop/end/abort/close. */
export function createVoiceDictation(factory:RecognitionFactory,onUpdate:(update:DictationUpdate)=>void,lang='en-CA'):VoiceDictation {
 let recognition:RecognitionLike|null=null,generation=0,values:DictationUpdate={state:'idle',finalText:'',interimText:'',error:''};
 const publish=(patch:Partial<DictationUpdate>)=>{values={...values,...patch};onUpdate({...values});};
 const detach=(r:RecognitionLike)=>{r.onstart=null;r.onend=null;r.onerror=null;r.onresult=null;};
 const abort=()=>{generation++;const r=recognition;recognition=null;if(r){detach(r);try{r.abort();}catch{}}publish({state:'idle',interimText:'',error:''});};
 const start=()=>{
  if(recognition)return false;const token=++generation;let r:RecognitionLike;const segments=new Map<number,{final:boolean;text:string}>();
  try{r=factory();recognition=r;r.lang=lang;r.continuous=true;r.interimResults=true;publish({state:'starting',finalText:'',interimText:'',error:''});
   const current=()=>token===generation&&recognition===r;
   r.onstart=()=>{if(current()&&values.state==='starting')publish({state:'listening'});};
   r.onresult=event=>{if(!current())return;for(let i=event.resultIndex;i<event.results.length;i++){const result=event.results[i];if(result?.[0])segments.set(i,{final:!!result.isFinal,text:result[0].transcript.trim()});}for(const index of segments.keys())if(index>=event.results.length)segments.delete(index);const ordered=[...segments].sort((a,b)=>a[0]-b[0]).map(([,s])=>s);publish({finalText:ordered.filter(s=>s.final).map(s=>s.text).filter(Boolean).join(' '),interimText:ordered.filter(s=>!s.final).map(s=>s.text).filter(Boolean).join(' ')});};
   r.onend=()=>{if(!current())return;recognition=null;detach(r);generation++;publish({state:'idle',interimText:''});};
   r.onerror=event=>{if(!current())return;recognition=null;detach(r);generation++;try{r.abort();}catch{}publish({state:'error',interimText:'',error:errorText(event.error??'')});};
   if(!current()){detach(r);return false;}r.start();return true;
  }catch(error){if(recognition){detach(recognition);try{recognition.abort();}catch{}}recognition=null;generation++;publish({state:'error',interimText:'',error:error instanceof Error?error.message:'Speech transcription could not start. Type your request instead.'});return false;}
 };
 const stop=()=>{const r=recognition;if(!r||values.state==='stopping')return;publish({state:'stopping'});if(recognition!==r)return;try{r.stop();}catch{abort();}};
 return {start,stop,abort,read:()=>({...values})};
}
