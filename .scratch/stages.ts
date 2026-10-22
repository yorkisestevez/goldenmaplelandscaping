import {loadAdvancedYardRuntime} from '../src/features/deckcraft/yardModel';
await loadAdvancedYardRuntime();
import {ensureLiveDesignExtensions} from '../src/features/deckcraft/designExtensions';
import {encodeDesignLink} from '../src/features/deckcraft/designLink';
import {writeFileSync} from 'node:fs';
const {ultimateParadiseDesign}=await import('../src/features/deckcraft/paradiseSample');
const full=ultimateParadiseDesign();
const furn=(o:any)=>o.kind==='furniture';
const lightsOff=(d:any)=>({...d,lightingSystem:{wireDistance:80,selectedItems:[]},autoLighting:{posts:false,stairs:false}});
const stages:[string,any][]=[
 ['1-deck-pergola',lightsOff({...full,yardFeatures:[],pools:[],landscapeObjects:[]})],
 ['2-hardscape',lightsOff({...full,pools:[],landscapeObjects:[],yardFeatures:full.yardFeatures!.filter(f=>f.kind!=='water-feature')})],
 ['3-pool-spa-waterfall',lightsOff({...full,landscapeObjects:full.landscapeObjects!.filter(o=>o.kind==='bed')})],
 ['4-planting',lightsOff({...full,landscapeObjects:full.landscapeObjects!.filter(o=>!furn(o))})],
 ['5-furniture',lightsOff(full)],
 ['6-lighting',full],
];
const out:any={};
for(const [k,d] of stages){const c=structuredClone(d);await ensureLiveDesignExtensions(c);const u=await encodeDesignLink(c,'http://127.0.0.1:5201');out[k]=u.slice(u.indexOf('#'));}
writeFileSync('/workspace/sage/paradise/stage-hashes.json',JSON.stringify(out));console.log(Object.keys(out));
