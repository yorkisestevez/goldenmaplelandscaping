import {loadAdvancedYardRuntime} from '../src/features/deckcraft/yardModel';
await loadAdvancedYardRuntime();
import {ensureLiveDesignExtensions} from '../src/features/deckcraft/designExtensions';
import {encodeDesignLink} from '../src/features/deckcraft/designLink';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {outdoorRoomIssues} from '../src/features/deckcraft/outdoorRoomRules';
import {lightingPlacementIssues} from '../src/features/deckcraft/lightingPlacementRules';
import {writeFileSync} from 'node:fs';
const {ultimateParadiseDesign}=await import('../src/features/deckcraft/paradiseSample');
const d=ultimateParadiseDesign();await ensureLiveDesignExtensions(d);
const tk=buildDeckTakeoff(d);
console.log('objects',d.landscapeObjects!.length,'plants',d.landscapeObjects!.filter(o=>o.kind==='plant').length);
console.log('room',JSON.stringify(outdoorRoomIssues(d,tk)));
try{console.log('light',JSON.stringify((lightingPlacementIssues as any)(d,tk)));}catch(e){console.log('lighterr',String(e))}
const url=await encodeDesignLink(d,'http://127.0.0.1:5201');writeFileSync('.scratch/paradise-hash.txt',url.slice(url.indexOf('#')));console.log('url',url.length);
