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
export interface DictationClock {schedule:(callback:()=>void,delayMs:number)=>unknown;cancel:(timer:unknown)=>void}
export interface DictationOptions {clock?:DictationClock;startTimeoutMs?:number;stopTimeoutMs?:number}
export type DictationState='idle'|'starting'|'listening'|'stopping'|'error';
export interface DictationUpdate {state:DictationState;finalText:string;interimText:string;error:string}
export interface VoiceDictation {start:()=>boolean;stop:()=>void;abort:()=>void;read:()=>DictationUpdate}
/** Detect browser support without constructing recognition, requesting permission or recording. */
export function browserSpeechFactory(surface:unknown=globalThis):RecognitionFactory|null {
 if(!surface||typeof surface!=='object')return null;const host=surface as {SpeechRecognition?:new()=>RecognitionLike;webkitSpeechRecognition?:new()=>RecognitionLike},Ctor=host.SpeechRecognition??host.webkitSpeechRecognition;return typeof Ctor==='function'?()=>new Ctor():null;
}
/** A capability check only: it never opens a microphone or permission prompt. */
export function browserVoiceAvailability(surface:unknown=globalThis):{ready:boolean;message:string} {
 const host=surface as {isSecureContext?:boolean}|null;
 if(host?.isSecureContext===false)return {ready:false,message:'Open this app over HTTPS or localhost to use the microphone. You can type your request here.'};
 if(!browserSpeechFactory(surface))return {ready:false,message:'Voice dictation is unavailable in this browser. Type your request, or open the app in a browser with speech recognition.'};
 return {ready:true,message:'Talk starts your microphone. Your browser handles transcription and may use its speech service. Typing stops dictation so your corrections stay intact.'};
}
function errorText(code:string){return ({'not-allowed':'Microphone permission was denied. Allow microphone access in your browser, or type your request.','service-not-allowed':'Your browser speech service is unavailable. Type your request instead.','audio-capture':'No microphone is available. Connect one or type your request.','network':'The browser speech service could not connect. You can retry or type your request.','no-speech':'No speech was detected. Try Talk again or type your request.','aborted':'Dictation stopped.'} as Record<string,string>)[code]??'Speech transcription stopped. Try again or type your request.';}
/** Session-scoped results prevent duplicate final text and ignore callbacks after stop/end/abort/close. */
export function createVoiceDictation(factory:RecognitionFactory,onUpdate:(update:DictationUpdate)=>void,lang='en-CA',options:DictationOptions={}):VoiceDictation {
 let recognition:RecognitionLike|null=null,generation=0,values:DictationUpdate={state:'idle',finalText:'',interimText:'',error:''};
 const clock=options.clock??{schedule:(callback:()=>void,delayMs:number)=>setTimeout(callback,delayMs),cancel:(timer:unknown)=>clearTimeout(timer as ReturnType<typeof setTimeout>)};
 let timer:unknown=null;
 const clearTimer=()=>{if(timer!==null){clock.cancel(timer);timer=null;}};
 const publish=(patch:Partial<DictationUpdate>)=>{values={...values,...patch};onUpdate({...values});};
 const detach=(r:RecognitionLike)=>{r.onstart=null;r.onend=null;r.onerror=null;r.onresult=null;};
 const abort=()=>{clearTimer();generation++;const r=recognition;recognition=null;if(r){detach(r);try{r.abort();}catch{}}publish({state:'idle',interimText:'',error:''});};
 const expire=(r:RecognitionLike,token:number,message:string)=>{if(token!==generation||recognition!==r)return;clearTimer();recognition=null;generation++;detach(r);try{r.abort();}catch{}publish({state:'error',interimText:'',error:message});};
 const start=()=>{
  if(recognition)return false;const token=++generation;let r:RecognitionLike;const segments=new Map<number,{final:boolean;text:string}>();
  try{r=factory();recognition=r;r.lang=lang;r.continuous=true;r.interimResults=true;publish({state:'starting',finalText:'',interimText:'',error:''});
   const current=()=>token===generation&&recognition===r;
   r.onstart=()=>{if(current()&&values.state==='starting'){clearTimer();publish({state:'listening'});}};
   r.onresult=event=>{if(!current())return;for(let i=event.resultIndex;i<event.results.length;i++){const result=event.results[i];if(result?.[0])segments.set(i,{final:!!result.isFinal,text:result[0].transcript.trim()});}for(const index of segments.keys())if(index>=event.results.length)segments.delete(index);const ordered=[...segments].sort((a,b)=>a[0]-b[0]).map(([,s])=>s);publish({finalText:ordered.filter(s=>s.final).map(s=>s.text).filter(Boolean).join(' '),interimText:ordered.filter(s=>!s.final).map(s=>s.text).filter(Boolean).join(' ')});};
   r.onend=()=>{if(!current())return;clearTimer();recognition=null;detach(r);generation++;publish({state:'idle',interimText:''});};
   r.onerror=event=>{if(!current())return;expire(r,token,errorText(event.error??''));};
   if(!current()){detach(r);return false;}timer=clock.schedule(()=>expire(r,token,'The microphone or speech service did not start. Check browser microphone access, then try Talk again or type your request.'),options.startTimeoutMs??30000);r.start();return true;
  }catch(error){clearTimer();if(recognition){detach(recognition);try{recognition.abort();}catch{}}recognition=null;generation++;publish({state:'error',interimText:'',error:error instanceof Error?error.message:'Speech transcription could not start. Type your request instead.'});return false;}
 };
 const stop=()=>{const r=recognition;if(!r||values.state==='stopping')return;clearTimer();publish({state:'stopping'});if(recognition!==r)return;const token=generation;timer=clock.schedule(()=>expire(r,token,'The speech service did not finish. Your completed transcript is kept; you can edit it or try Talk again.'),options.stopTimeoutMs??5000);try{r.stop();}catch{abort();}};
 return {start,stop,abort,read:()=>({...values})};
}
