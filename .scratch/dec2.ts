import {loadAdvancedYardRuntime} from '../src/features/deckcraft/yardModel';
await loadAdvancedYardRuntime();
import {decodeDesignLink,designLinkFromHash} from '../src/features/deckcraft/designLink';
import {readFileSync} from 'node:fs';
const h=readFileSync(process.argv[2],'utf8').trim();
try{const d=await decodeDesignLink(designLinkFromHash(h)!);console.log('ok',d.pools?.length);}catch(e){console.log('ERR',e)}
