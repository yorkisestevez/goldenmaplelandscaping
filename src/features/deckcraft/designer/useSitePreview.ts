import {useEffect,useRef,useState} from 'react';
import type {DeckData} from '../types';
import type {AgentCommand,AgentRequest,AgentResponse,AgentSnapshot} from './deckAgentController';
import {poolDraftKey} from './poolDraftState';
export function useSitePreview(data:DeckData){
 const key=poolDraftKey(data),current=useRef(key),prior=useRef(key),intent=useRef(0),applying=useRef(false);current.current=key;
 const [preview,setPreview]=useState<Extract<AgentResponse,{ok:true}>>(),[request,setRequest]=useState<AgentRequest>(),[before,setBefore]=useState<AgentSnapshot>(),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const clear=()=>{intent.current++;setPreview(undefined);setRequest(undefined);setError('');setBusy(false);};
 useEffect(()=>{if(prior.current===key)return;prior.current=key;intent.current++;setPreview(undefined);setRequest(undefined);setBusy(false);if(!applying.current&&(preview||request||busy))setError('Design changed. Preview this site operation again.');},[key]);
 const propose=async(commands:AgentCommand[])=>{const api=window.deckcraft;if(!api){setError('Wait for the shared editor controller.');return;}const source=key,token=++intent.current,s=api.read();if(poolDraftKey(s.design.siteModel)!==poolDraftKey(data.siteModel)){setError('The measured site is refreshing. Wait for the current revision, then preview again.');return;}const r={id:`site-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`,expectedRevision:s.revision,commands};setBusy(true);setError('');setPreview(undefined);setRequest(undefined);try{const answer=await api.preview(r);if(current.current!==source||intent.current!==token)return;if(answer.ok===false)throw Error(answer.error.message);setBefore(s);setPreview(answer);setRequest(r);}catch(e){if(intent.current===token)setError((e as Error).message);}finally{if(intent.current===token)setBusy(false);}};
 const apply=async()=>{if(!request)return;const api=window.deckcraft;if(!api)return;setBusy(true);applying.current=true;try{if(api.read().revision!==request.expectedRevision)throw Error('Design changed. Preview the site operation again.');const answer=await api.execute(request);if(answer.ok===false)throw Error(answer.error.message);clear();}catch(e){setError((e as Error).message);}finally{applying.current=false;setBusy(false);}};
 const undo=async()=>{const api=window.deckcraft;if(!api)return;clear();const answer=await api.execute({id:`site-undo-${Date.now()}`,expectedRevision:api.read().revision,commands:[{type:'history.undo'}]});if(answer.ok===false)setError(answer.error.message);};
 return {preview,before,error,busy,clear,propose,apply,undo};
}
export type SitePreview=ReturnType<typeof useSitePreview>;
