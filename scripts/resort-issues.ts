// Replicates the app's "Review N issues" list (useDeckEstimate + DeckDesigner currentIssues + designIssues) for the resort estate.
import {loadAdvancedYardRuntime} from '../src/features/deckcraft/yardModel';
await loadAdvancedYardRuntime();
const {ensureLiveDesignExtensions}=await import('../src/features/deckcraft/designExtensions');
const {calculateDeckReleaseEstimate}=await import('../src/features/deckcraft/deckRelease');
const {DECK_SETTINGS}=await import('../src/features/deckcraft/defaults');
const {extrasLayout,treadNose}=await import('../src/features/deckcraft/extrasLayout');
const {houseRailingReviewFlags}=await import('../src/features/deckcraft/houseRailingClearance');
const {lightingSystemCheck}=await import('../src/features/deckcraft/lightingSystem');
const {lightingPlacementIssues}=await import('../src/features/deckcraft/lightingPlacementRules');
const {outdoorRoomIssues}=await import('../src/features/deckcraft/outdoorRoomRules');
const {houseOutline}=await import('../src/features/deckcraft/houseFootprint');
const {designIssues}=await import('../src/features/deckcraft/designer/reviewNotes');
const {resortEstateDesign}=await import('../src/features/deckcraft/resortEstate');
const d=resortEstateDesign();await ensureLiveDesignExtensions(d);
const e=calculateDeckReleaseEstimate(d,{...DECK_SETTINGS} as any) as any,m=e.model;
const lc=lightingSystemCheck(d,m),ex=extrasLayout(d,m);
const pf=lightingPlacementIssues(d,m,ex.fixtures,{treadWidths:m.treads.map((t:any)=>treadNose(t).width),houseRings:d.houseVisible!==false?houseOutline(d):[]});
const flags=[...new Set([...houseRailingReviewFlags(d,m,e.flags),...ex.warnings,...pf,...outdoorRoomIssues(d,m)])];
const all=[...new Set([...flags,...lc.warnings,...e.quoteRequired])];
const iss=designIssues(all);
const block=designIssues([...flags,...lc.warnings]);console.log('BLOCKING',block.length);for(const b of block)console.log('-',b);
console.log('ISSUES',iss.length);
// Standing rule H-WALL-CAP (deckcraft-knowledge): every non-natural-stone wall carries a cap.
const NATURAL=new Set(['armour-stone','natural-stone','boulder-wall']);
const uncapped=(d.yardFeatures??[]).filter((f:any)=>f.enabled!==false&&f.kind==='retaining-wall'&&!NATURAL.has(f.productId)&&f.productId!=='segmental-concrete'&&!f.hardscape?.capUnitId);
console.log('WALL-CAP',uncapped.length?'FAIL '+uncapped.map((f:any)=>f.id).join(', '):'ok');
