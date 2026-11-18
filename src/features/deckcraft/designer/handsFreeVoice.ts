import {createVoiceDictation,type RecognitionFactory,type DictationClock,type DictationUpdate} from './voiceDictation';

export type VoiceControl='stop'|'cancel'|'apply'|'undo'|'redo';
export function voiceControl(text:string):VoiceControl|null {
 const value=text.trim().toLowerCase().replace(/[.!?]+$/,'').replace(/^please /,'');
 if(/^(stop|stop listening|stop voice|stop voice control)$/.test(value))return 'stop';
 if(/^(cancel|cancel that|cancel edit|discard|discard that)$/.test(value))return 'cancel';
 if(/^(apply|apply that|apply changes|confirm)$/.test(value))return 'apply';
 if(/^(undo|undo that|undo last change)$/.test(value))return 'undo';
 if(/^(redo|redo that)$/.test(value))return 'redo';
 return null;
}
export interface HandsFreeUpdate {enabled:boolean;state:DictationUpdate['state'];transcript:string;error:string}
/** One utterance per quiet interval. Final results are consumed once; interim text is never executed. */
export function createHandsFreeVoice(factory:RecognitionFactory,onCommand:(text:string)=>void,onUpdate:(state:HandsFreeUpdate)=>void,options:{clock?:DictationClock;quietMs?:number}={}) {
 const clock=options.clock??{schedule:(fn:()=>void,ms:number)=>setTimeout(fn,ms),cancel:(id:unknown)=>clearTimeout(id as ReturnType<typeof setTimeout>)};
 let enabled=false,generation=0,consumed='',latest:DictationUpdate|null=null,timer:unknown=null,restart:unknown=null;
 let mic:ReturnType<typeof createVoiceDictation>|null=null;
 const clear=()=>{if(timer!==null)clock.cancel(timer);if(restart!==null)clock.cancel(restart);timer=null;restart=null;};
 const publish=(state:DictationUpdate['state'],error='')=>onUpdate({enabled,state,transcript:latest?.interimText||latest?.finalText.slice(consumed.length).trim()||'',error});
 const stop=()=>{enabled=false;generation++;clear();mic?.abort();mic=null;latest=null;publish('idle');};
 const flush=()=>{timer=null;if(!enabled||!latest||latest.interimText)return;const text=latest.finalText.slice(consumed.length).trim();if(!text)return;consumed=latest.finalText;onCommand(text);};
 const listen=()=>{
  if(!enabled)return;clear();const token=++generation;consumed='';latest=null;
  mic=createVoiceDictation(factory,update=>{
   if(!enabled||token!==generation)return;
   latest=update;publish(update.state,update.error);
   if(timer!==null){clock.cancel(timer);timer=null;}
   if(update.state==='error'&&update.error.startsWith('No speech was detected.')){generation++;mic=null;clear();publish('starting');restart=clock.schedule(listen,1000);return;}
   if(update.state==='error'){enabled=false;generation++;clear();publish('error',update.error);return;}
   const text=update.finalText.slice(consumed.length).trim();
   if(text&&!update.interimText){
    if(voiceControl(text)==='stop'){flush();return;}
    timer=clock.schedule(flush,options.quietMs??1000);
   }
   if(update.state==='idle'){
    flush();
    if(enabled&&token===generation)restart=clock.schedule(listen,250);
   }
  },'en-CA',{clock});
  mic.start();
 };
 return {start:()=>{if(enabled)return;enabled=true;listen();},stop,
  pause:()=>{generation++;clear();mic?.abort();mic=null;latest=null;publish('idle');},
  resume:()=>{if(enabled&&!mic)listen();},isEnabled:()=>enabled};
}
