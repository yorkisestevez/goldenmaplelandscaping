import assert from 'node:assert/strict';
import {createHandsFreeVoice,voiceControl} from '../src/features/deckcraft/designer/handsFreeVoice';
import {resolveWorkspaceSelection,workspaceViewCommand} from '../src/features/deckcraft/designer/workspaceVoiceCommands';
import type {DictationClock,RecognitionLike,DictationEvent} from '../src/features/deckcraft/designer/voiceDictation';
import type {AgentSnapshot} from '../src/features/deckcraft/designer/deckAgentController';
let checks=0;const check=(ok:unknown,label:string)=>{assert.ok(ok,label);checks++;};
class Clock implements DictationClock {now=0;id=0;tasks=new Map<number,{at:number;fn:()=>void}>();schedule(fn:()=>void,ms:number){const id=++this.id;this.tasks.set(id,{fn,at:this.now+ms});return id;}cancel(id:unknown){this.tasks.delete(id as number);}advance(ms:number){this.now+=ms;for(const [id,t] of [...this.tasks])if(t.at<=this.now){this.tasks.delete(id);t.fn();}}}
class Recognition implements RecognitionLike {
 lang='';continuous=false;interimResults=false;onstart:RecognitionLike['onstart']=null;onend:RecognitionLike['onend']=null;onerror:RecognitionLike['onerror']=null;onresult:RecognitionLike['onresult']=null;
 start(){this.onstart?.();}stop(){this.onend?.();}abort(){}
 say(final:string,interim=''){const results=[Object.assign([{transcript:final}],{isFinal:true}),...(interim?[Object.assign([{transcript:interim}],{isFinal:false})]:[])];this.onresult?.({resultIndex:0,results} as DictationEvent);}
}
const clock=new Clock(),sessions:Recognition[]=[],commands:string[]=[],states:any[]=[];
const voice=createHandsFreeVoice(()=>{const mic=new Recognition();sessions.push(mic);return mic;},text=>{commands.push(text);if(voiceControl(text)==='stop')voice.stop();},state=>states.push(state),{clock});
voice.start();check(sessions.length===1&&voice.isEnabled(),'Explicit start opens one session');voice.start();check(sessions.length===1,'Repeated start is idempotent');
sessions[0].say('','make the deck');clock.advance(2000);check(commands.length===0,'Interim transcript never executes');
sessions[0].say('make the deck 20 by 14 feet');clock.advance(999);check(commands.length===0,'Wait for end of utterance');clock.advance(1);check(commands[0]==='make the deck 20 by 14 feet','Final utterance executes after quiet interval');
sessions[0].say('make the deck 20 by 14 feet');clock.advance(1000);check(commands.length===1,'Repeated recognition result executes once');
sessions[0].say('make the deck 20 by 14 feet undo');clock.advance(1000);check(commands[1]==='undo','Next utterance excludes consumed transcript');
sessions[0].say('make the deck 20 by 14 feet undo make it','wider');clock.advance(2000);check(commands.length===2,'Incomplete continuing sentence does not execute');
voice.pause();const count=commands.length;clock.advance(5000);check(commands.length===count,'Pause cancels pending utterance');voice.resume();check(sessions.length===2,'Resume opens a clean recognition session');
sessions[1].say('redo');sessions[1].onend?.();check(commands.at(-1)==='redo','Browser ending flushes final utterance');clock.advance(250);check(sessions.length===3,'Browser ending resumes listening');
const late=sessions[2].onresult;sessions[2].say('stop');check(!voice.isEnabled()&&commands.at(-1)==='stop','Stop dispatches immediately and closes session');late?.({resultIndex:0,results:[Object.assign([{transcript:'change width 50 feet'}],{isFinal:true})]} as DictationEvent);clock.advance(5000);check(commands.at(-1)==='stop','Late callbacks cannot execute after stop');
voice.start();const silent=sessions.length;sessions.at(-1)!.onerror?.({error:'no-speech'});check(voice.isEnabled(),'Silence keeps hands-free mode enabled');clock.advance(1000);check(sessions.length===silent+1,'Silence resumes listening without a click');sessions.at(-1)!.onerror?.({error:'not-allowed'});check(!voice.isEnabled()&&states.at(-1).error.includes('permission'),'Denied microphone ends session without retry loop');
for(const [text,result] of [['Please undo that.','undo'],['cancel that','cancel'],['apply that','apply'],['redo','redo'],['stop listening','stop'],['do not undo',''],['apply blue boards','']] as const)check((voiceControl(text)??'')===result,`Whole-command match: ${text}`);
check(workspaceViewCommand('show me from above')?.type==='view.set','Natural overhead camera command');check(workspaceViewCommand('publish the design')===null,'No external action from workspace command parser');
const snapshot={parts:[{id:'deck:1',label:'Main deck'},{id:'stairs:1',label:'Front stairs'},{id:'stairs:2',label:'Side stairs'}],design:{yardFeatures:[],pools:[],landscapeObjects:[]}} as unknown as AgentSnapshot;
check(resolveWorkspaceSelection('main deck',snapshot).ok,'Select exact object label');check(resolveWorkspaceSelection('deck:1',snapshot).ok,'Select stable object ID');check(!resolveWorkspaceSelection('stairs',snapshot).ok,'Ambiguous selection asks instead of guessing');check(!resolveWorkspaceSelection('missing',snapshot).ok,'Missing object does not change selection');check(resolveWorkspaceSelection('nothing',snapshot).ok,'Clear selection hands-free');
console.log(`Hands-free controls: ${checks} checks passed.`);

// Manual outline edits and AI edits must pass the same strict house-configuration validation.
const {DEFAULT_DECK}=await import('../src/features/deckcraft/defaults');
const {calculateDeckReleaseEstimate}=await import('../src/features/deckcraft/deckRelease');
const {boundaryPatch,editableBoundaries}=await import('../src/features/deckcraft/designer/boundaryEditMath');
const {createDeckAgentController}=await import('../src/features/deckcraft/designer/deckAgentController');
const data=structuredClone(DEFAULT_DECK),model=calculateDeckReleaseEstimate(data).model,boundary=editableBoundaries(data,model)[0];
const patch=boundaryPatch(data,1,boundary.points.map((p,i)=>i===2?{x:p.x+5,y:p.y-5}:p),boundary.offset,model)!;
const controller=createDeckAgentController({getState:()=>({data,ready:true,view:'plan',openSections:[],canUndo:false,canRedo:false}),commitDesign:()=>{},undo:()=>{},redo:()=>{},setView:()=>{},openSection:()=>{},waitForRender:async()=>{}});
const result=await controller.preview({id:'manual-outline-regression',expectedRevision:controller.read().revision,commands:[{type:'design.patch',patch:JSON.parse(JSON.stringify(patch)),unset:Object.keys(patch).filter(key=>patch[key as keyof typeof patch]===undefined)}]});
assert.equal(result.ok,true,JSON.stringify(result));assert.deepEqual(data,DEFAULT_DECK);controller.dispose();console.log('Manual boundary preview passes strict validation without changing the original design.');

const {parseNaturalLanguageCommands}=await import('../src/features/deckcraft/designer/naturalLanguageCommands');
const relativeSnapshot={...snapshot,ready:true,revision:0,design:{...DEFAULT_DECK,width:16,length:12}} as AgentSnapshot;
for(const [request,width] of [['Give the deck two more feet of width and keep its depth unchanged.',18],['Make the deck 24 inches wider',18],['Make the deck two feet narrower',14]] as const){const result=parseNaturalLanguageCommands(request,relativeSnapshot);assert.equal(result.ok,true);if(result.ok===true)assert.deepEqual(result.request.commands,[{type:'design.patch',patch:{width}}]);}
assert.equal(parseNaturalLanguageCommands('Make the deck sixty feet wider',relativeSnapshot).ok,false);console.log('Explicit relative voice measurements preserve the requested delta and bounds.');

assert.equal(parseNaturalLanguageCommands('Give the deck two more feet of width and keep its width unchanged',relativeSnapshot).ok,false);
