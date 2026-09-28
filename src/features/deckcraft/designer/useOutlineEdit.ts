import {useState} from 'react';
import {activeCustomFront,type OutlinePoint} from '../lib/customOutline';
import {frontEdges,type OutlinePresetId} from '../lib/outlineEdits';
import type {DeckData} from '../types';
import type {Update} from './fields';
import {edgeMove,presetPatch,REFUSED,type OutlineEdit} from './outlineEditMath';

export type OutlineSelection={kind:'edge';index:number}|{kind:'point';index:number}|null;

/**
 * A custom outline's edits, shared by the Deck section's outline editor (its buttons, list of edges and status) and the
 * Draw outline tool on the site plan (dragging and arrow-keying an edge, the starting shapes). Each edit goes through
 * outlineEditMath.ts (lib/outlineEdits.ts underneath) and changes the design once; one the rules refuse leaves the
 * outline as it was and says why (REFUSED).
 */
export function useOutlineEdit(data:DeckData,update:Update,onChange?:()=>void){
  const front=activeCustomFront(data);
  const [selected,setSelected]=useState<OutlineSelection>(null),[message,setMessage]=useState('');
  /** Applies a new front (one design change), or says why there is none. True when it was applied. */
  const apply=(next:OutlinePoint[]|null)=>{if(next){update({customFront:next});setMessage('');onChange?.();return true;}setMessage(REFUSED);return false;};
  /** An edit's outcome from outlineEditMath: applied, refused, or nothing to do. */
  const applyEdit=(edit:OutlineEdit)=>edit===null?false:'front' in edit?apply(edit.front):apply(null);
  const move=(i:number,delta:number)=>front?apply(edgeMove(front,i,delta)):false;
  /** A starting shape; on a deck that is not an outline yet it makes it one. */
  const preset=(id:OutlinePresetId)=>{const patch=presetPatch(data,id);if(!patch){setMessage(REFUSED);return false;}setSelected(null);update(patch);setMessage('');onChange?.();return true;};
  return {front,edges:front?frontEdges(front):[],selected,setSelected,message,setMessage,apply,applyEdit,move,preset};
}
