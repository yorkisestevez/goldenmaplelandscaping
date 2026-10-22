import {loadAdvancedYardRuntime} from '../src/features/deckcraft/yardModel';
await loadAdvancedYardRuntime();
import {ensureLiveDesignExtensions} from '../src/features/deckcraft/designExtensions';
import {linkDesignJson} from '../src/features/deckcraft/designLinkSpecies';
const {ultimateParadiseDesign}=await import('../src/features/deckcraft/paradiseSample');
const {ontarioShowcaseDesign}=await import('../src/features/deckcraft/showcaseSample');
for(const f of [ontarioShowcaseDesign,ultimateParadiseDesign]){const d=f();await ensureLiveDesignExtensions(d);console.log(f.name,linkDesignJson(d).length);}
const d=ultimateParadiseDesign();const c:any={};for(const o of d.landscapeObjects!)if(o.kind==='plant'){const k=(o as any).speciesId??(o as any).speciesRecord?.id;c[k]=(c[k]??0)+1;}console.log(JSON.stringify(c));console.log(Object.keys(d.landscapeObjects!.find(o=>o.kind==='plant')!));
