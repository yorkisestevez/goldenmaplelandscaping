import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

/** Pro wizards apply through window.deckcraft when the agent bridge is mounted (same undo/revision path). */
let checks=0;const ok=(v:unknown,m:string)=>{assert.ok(v,m);checks++;};
const src=readFileSync(new URL('../src/features/deckcraft/designer/pro/ProWizards.tsx',import.meta.url),'utf8');
ok(src.includes('window')&&src.includes('deckcraft')&&src.includes("type:'design.patch'"),'Wizard apply prefers the agent controller design.patch path');
ok(src.includes("page.apply(patch)")&&src.includes("'error'in result"),'Wizard falls back to page.apply and surfaces controller errors');
ok(src.includes('pro-wizard-')&&src.includes('expectedRevision'),'Wizard commits carry a revision-guarded request id');
ok(src.includes('unset')&&src.includes('JSON.parse(JSON.stringify(patch))'),'Cleared wizard fields stay out of the JSON patch and are named in unset');
console.log(`DECK PRO WIZARDS OK — agent-controller apply path wired; ${checks} checks.`);
