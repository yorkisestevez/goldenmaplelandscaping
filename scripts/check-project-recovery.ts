import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {saveStoredProject,readProjectValue,closeProjectStorage} from '../src/features/deckcraft/projectStorage';
import {serializePrivateProject,parsePrivateProject} from '../src/features/deckcraft/designer/jobRevisionLibrary';
async function main(){const a=serializePrivateProject({...structuredClone(DEFAULT_DECK),materialMarkup:47,customerName:'Private customer'}),b=serializePrivateProject({...structuredClone(DEFAULT_DECK),width:24});
await saveStoredProject('current',a,{expectedRevision:0});await saveStoredProject('current',b,{expectedRevision:1});
const same=await saveStoredProject('current',b,{expectedRevision:2});assert.equal(same.revision,2);
const recovery=await readProjectValue<{value:{json:string}}>('recovery','current-previous');assert.equal(recovery?.value.json,a);
assert.equal(parsePrivateProject(recovery!.value.json).materialMarkup,47);assert.equal(parsePrivateProject(recovery!.value.json).customerName,'Private customer');
await assert.rejects(()=>saveStoredProject('current',b,{expectedRevision:1}));
assert.equal((await readProjectValue<{json:string}>('projects','current'))?.json,b);
closeProjectStorage();console.log('Recovery: identical autosaves preserve previous bytes, stale writes rejected, private fields restored.');}
main().catch(e=>{closeProjectStorage();console.error(e);process.exitCode=1;});
