import {loadAdvancedYardRuntime} from '../src/features/deckcraft/yardModel';
await loadAdvancedYardRuntime();
import {readFileSync} from 'node:fs';
const m=await import('../src/features/deckcraft/designLink');
const h=readFileSync('.scratch/hash.txt','utf8').trim();
const d:any=await (m as any).decodeDesignLink('http://127.0.0.1:5201/deck-designer/'+h);
const objs=(d.data??d).landscapeObjects??[];console.log(Object.keys(d),objs.length,objs.filter((o:any)=>o.kind==='plant').length);
