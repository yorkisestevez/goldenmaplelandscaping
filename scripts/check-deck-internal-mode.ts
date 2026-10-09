import assert from 'node:assert/strict';
import {assertLeadsAllowed,INTERNAL_MODE_TOKEN,internalModeOn,setInternalMode} from '../src/features/deckcraft/internalMode';
import {noteWarmLead} from '../src/features/deckcraft/warmLead';
import {resetDeckAnalyticsVisit,setDeckAnalyticsSink,trackDeck} from '../src/features/deckcraft/deckAnalytics';
import {checkAssistantAvailability} from '../src/features/deckcraft/designer/deckAssistantClient';
import {askDesignerAi,designerAiStatus} from '../src/features/deckcraft/designer/siteDesignerAiClient';
import {deckReleaseData,calculateDeckReleaseEstimate} from '../src/features/deckcraft/deckRelease';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';

let checks=0;
const ok=(value:unknown,message:string)=>{assert.ok(value,message);checks++;};
const events:string[]=[];
setDeckAnalyticsSink((event,label)=>events.push(`${event}:${label}`));
const calls:string[]=[];
const original=globalThis.fetch;
globalThis.fetch=async (input)=>{calls.push(String(input));return new Response('{}',{status:200});};

try{
  setInternalMode(false);
  ok(!internalModeOn()&&setInternalMode(true,'not-the-token')===false&&!internalModeOn(),'A wrong token does not turn internal mode on');
  ok(setInternalMode(true,INTERNAL_MODE_TOKEN)===true&&internalModeOn(),'The staff token turns internal mode on');

  events.length=0;calls.length=0;resetDeckAnalyticsVisit();
  noteWarmLead('proposal',{pricedSubtotal:100});
  noteWarmLead('pdf');
  noteWarmLead('share');
  trackDeck('deckcraft_send','deck_send_submitted');
  trackDeck('deckcraft_output','deck_warm_proposal');
  trackDeck('deckcraft_output','deck_json_save');
  ok(events.length===1&&events[0]==='deckcraft_output:deck_json_save','Internal mode skips warm-lead and send analytics and keeps export analytics');
  ok(calls.length===0,'Internal mode does not post a warm-lead form');
  assert.throws(()=>assertLeadsAllowed(),/no lead or CRM record/,'Send my design refuses before a CRM post');

  const availability=await checkAssistantAvailability();
  ok(availability.ready===false&&availability.source==='exact-only','The design assistant is not asked while internal mode is on');
  const status=await designerAiStatus(undefined,{fetch:async()=>{calls.push('designer-ai');throw new Error('should not fetch');}});
  ok(status.available===false&&!calls.includes('designer-ai'),'The site designer AI is not asked while internal mode is on');
  await assert.rejects(askDesignerAi({prompt:'hello'} as never,undefined,{fetch:async()=>{calls.push('assistant');throw new Error('should not fetch');}}),/not sent to the AI/);
  ok(!calls.includes('assistant'),'A paid assistant turn makes no request');

  const snapshot={version:1 as const,revision:1,ready:true,design:deckReleaseData(structuredClone(DEFAULT_DECK)),pricing:{currency:'CAD' as const,priceBook:'',subtotal:0,hst:0,total:0,areaSqft:0,sections:[],complete:true},quotes:[],issues:[],quantities:calculateDeckReleaseEstimate(DEFAULT_DECK).model.quantities,yardQuantities:calculateDeckReleaseEstimate(DEFAULT_DECK).yardModel.quantities,yardEarthwork:calculateDeckReleaseEstimate(DEFAULT_DECK).yardTakeoff.earthwork,stepConstruction:[],wallConstruction:[],yardBoundaries:[],patioInlays:[],inlayShapes:[],boundaries:[],boards:[],parts:[],edgeSections:[],view:'plan' as const,openSections:[],history:{canUndo:false,canRedo:false}};
  const {interpretAssistantRequest}=await import('../src/features/deckcraft/designer/deckAssistantClient');
  calls.length=0;
  const interpreted=await interpretAssistantRequest('please redesign the whole yard with something unexpected',snapshot as never,{partIds:[],boards:[]});
  ok(interpreted.kind==='advice'&&interpreted.message.includes('Internal mode')&&calls.length===0,'An unmatched instruction is not sent to the model');

  setInternalMode(false);
  ok(!internalModeOn(),'Internal mode turns off without the token');
  events.length=0;resetDeckAnalyticsVisit();
  noteWarmLead('proposal');
  trackDeck('deckcraft_send','deck_send_opened');
  ok(events.some(event=>event==='deckcraft_output:deck_warm_proposal')&&events.some(event=>event==='deckcraft_send:deck_send_opened'),'With the mode off, warm leads and send analytics fire again');
  assert.doesNotThrow(()=>assertLeadsAllowed(),'With the mode off, sending is allowed');
}finally{
  setInternalMode(false);
  globalThis.fetch=original;
}
console.log(`INTERNAL MODE OK — ${checks} checks`);
