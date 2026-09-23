import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GROUP_MS,HISTORY_LIMIT,editKey,emptyHistory,recordChange,redoChange,undoChange,type DesignHistory} from '../src/features/deckcraft/designer/designHistory';

/**
 * Undo and redo: each edit is one step (quick edits to the same fields join one), a whole-design
 * replacement is its own step, the history is capped, and only real edits and replacements are recorded;
 * restoring on load, undo/redo themselves and the automatic lighting sync never are.
 */
let checks=0;const ok=(value:unknown,message:string)=>{assert(value,message);checks++;};
type D={w:number};
const step=(h:DesignHistory<D>,before:D,key:string,at:number)=>recordChange(h,before,key,at);

// 1. Round trips.
{
  let h=emptyHistory<D>();
  ok(undoChange(h,{w:1})===null&&redoChange(h,{w:1})===null,'Nothing to undo or redo at first');
  h=step(h,{w:16},editKey({width:20}),0);// 16 -> 20
  h=step(h,{w:20},editKey({length:12}),10_000);// 20 -> 24 (another field, much later)
  const u1=undoChange(h,{w:24})!;ok(u1.design.w===20&&u1.history.future[0].w===24,'Undo returns the design before the last edit and keeps the current one for redo');
  const u2=undoChange(u1.history,u1.design)!;ok(u2.design.w===16&&undoChange(u2.history,u2.design)===null,'Undo walks back to the first design and stops');
  const r1=redoChange(u2.history,u2.design)!;ok(r1.design.w===20,'Redo goes forward again');
  const r2=redoChange(r1.history,r1.design)!;ok(r2.design.w===24&&redoChange(r2.history,r2.design)===null,'Redo reaches the latest design and stops');
  const branched=step(u1.history,u1.design,editKey({height:36}),20_000);
  ok(branched.future.length===0,'A new edit after an undo drops the redo steps');
}
// 2. Grouping: typing in one box is one step; another field, a pause or a replacement starts a new one.
{
  let h=emptyHistory<D>();
  h=step(h,{w:1},editKey({width:1}),0);
  h=step(h,{w:2},editKey({width:2}),GROUP_MS-100);
  h=step(h,{w:3},editKey({width:3}),2*GROUP_MS-200);
  ok(h.past.length===1&&h.past[0].w===1,'Quick edits to the same field are one step, starting from the design before the first');
  h=step(h,{w:4},editKey({length:1}),2*GROUP_MS-100);
  ok(h.past.length===2,'An edit to another field is its own step');
  h=step(h,{w:5},editKey({length:1}),10*GROUP_MS);
  ok(h.past.length===3,'The same field after a pause is its own step');
  h=step(h,{w:6},'replace:1',10*GROUP_MS+1);h=step(h,{w:7},'replace:1',10*GROUP_MS+2);
  ok(h.past.length===5,'Replacing the whole design never joins another step');
  const u=undoChange(h,{w:8})!;const again=step(u.history,u.design,editKey({length:1}),10*GROUP_MS+3);
  ok(again.past.length===u.history.past.length+1,'An edit right after an undo is a new step');
  ok(editKey({b:1,a:2})===editKey({a:3,b:4})&&editKey({a:1})!==editKey({b:1}),'The key names the fields, in any order');
}
// 3. The history is capped, keeping the most recent steps.
{
  let h=emptyHistory<D>();
  for(let i=0;i<HISTORY_LIMIT+25;i++)h=step(h,{w:i},`replace:${i}`,i);
  ok(h.past.length===HISTORY_LIMIT&&h.past[0].w===25&&h.past.at(-1)!.w===HISTORY_LIMIT+24,`At most ${HISTORY_LIMIT} steps, oldest dropped first`);
}
// 4. Wiring: only edits and replacements are recorded; the page and tools offer undo and redo.
{
  const read=(p:string)=>readFileSync(new URL(`../src/${p}`,import.meta.url),'utf8');
  const hook=read('features/deckcraft/designer/useDeckDesign.ts'),estimateHook=read('features/deckcraft/designer/useDeckEstimate.ts'),page=read('pages/DeckDesigner.tsx'),tools=read('features/deckcraft/designer/DesignTools.tsx');
  ok(/const update=\(patch:Partial<DeckData>\)=>\{[^}]*source\.current\?\?=editKey\(patch\)/.test(hook),'Every edit names itself for the history');
  ok(/const replace=\(next:DeckData\)=>\{source\.current=`replace:/.test(hook)&&hook.includes('replace(shared)')&&hook.includes('replace(parseDesign(own))'),'Opened links and going back to your own design are replaceable steps');
  ok(/if\(kind&&lastData\.current!==data/.test(hook)&&/source\.current=null;setData\(result\.design\)/.test(hook),'Only a named change is recorded; undo and redo record nothing');
  ok(/setData\(restored\)/.test(hook)&&/setData\(deck\);setEarlierYard/.test(hook),'Restoring the saved design on load is not a step');
  ok(/JSON\.stringify\(lastData\.current\)!==JSON\.stringify\(data\)/.test(hook),'A change that leaves the design as it was is not a step');
  ok(/setData\(prev=>deckReleaseData\(\{\.\.\.prev,lightingSystem:/.test(estimateHook)&&!/\b(update|replace)\(/.test(estimateHook),'The automatic lighting sync never becomes a step');
  ok(page.includes('replace(restored)')&&page.includes('replace(deckReleaseData(structuredClone(DEFAULT_DECK)))')&&!/\bsetData\(/.test(page.replace(/useDeckEstimate\(data,setData\)/,'')),'Import and Start over are undoable; the page never sets the design around the history');
  ok(/isContentEditable\|\|\/\^\(input\|textarea\|select\)\$\/i/.test(page)&&/key==='z'&&!e\.shiftKey\)\{e\.preventDefault\(\);undo\(\);\}/.test(page),'Ctrl/Cmd+Z undoes, except while typing in a field');
  ok(/onClick=\{onUndo\} disabled=\{!canUndo\}/.test(tools)&&/onClick=\{onRedo\} disabled=\{!canRedo\}/.test(tools),'The design tools offer Undo and Redo, disabled when there is nothing to do');
}

console.log(`DECK HISTORY OK — round trips, grouping, cap and wiring; ${checks} checks.`);
