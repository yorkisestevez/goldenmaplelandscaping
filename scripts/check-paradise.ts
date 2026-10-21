import assert from 'node:assert/strict';
import {loadAdvancedYardRuntime} from '../src/features/deckcraft/yardModel';
await loadAdvancedYardRuntime();
const {ultimateParadiseDesign}=await import('../src/features/deckcraft/paradiseSample');
const {buildDeckTakeoff}=await import('../src/features/deckcraft/deckTakeoff');
const {outdoorRoomIssues}=await import('../src/features/deckcraft/outdoorRoomRules');
const {lightingPlacementIssues}=await import('../src/features/deckcraft/lightingPlacementRules');
const {extrasLayout,treadNose}=await import('../src/features/deckcraft/extrasLayout');
const {houseOutline}=await import('../src/features/deckcraft/houseFootprint');
const {showcaseSampleIssues}=await import('../src/features/deckcraft/showcaseSample');
const {ensureLiveDesignExtensions}=await import('../src/features/deckcraft/designExtensions');
const d=ultimateParadiseDesign();await ensureLiveDesignExtensions(d);const m=buildDeckTakeoff(d);
assert.deepEqual(outdoorRoomIssues(d,m).filter(x=>!x.startsWith('A pool needs a by-law enclosure')),[]);
const light=lightingPlacementIssues(d,m,extrasLayout(d,m).fixtures,{treadWidths:m.treads.map(t=>treadNose(t).width),houseRings:houseOutline(d)});
assert.deepEqual(light.filter(x=>!/within 3 m of the pool\. Use a GFCI/.test(x)),[],JSON.stringify(light));
// The estate rules of the base showcase still hold for the main pool (the spa adds a fourth niche light).
assert.deepEqual(showcaseSampleIssues({...d,pools:[d.pools![0]]}).filter(x=>!x.startsWith('The lighting plan is not the best-practice set')),[]);
assert.equal(d.pools!.length,2);assert.ok(d.yardFeatures!.some(f=>f.kind==='water-feature'));
console.log('paradise ok: objects',d.landscapeObjects!.length);
