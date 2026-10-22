import {loadAdvancedYardRuntime} from '../src/features/deckcraft/yardModel';
import {ensureLiveDesignExtensions} from '../src/features/deckcraft/designExtensions';
import {ontarioShowcaseDesign} from '../src/features/deckcraft/showcaseSample';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {extrasLayout} from '../src/features/deckcraft/extrasLayout';
await loadAdvancedYardRuntime();
const d=ontarioShowcaseDesign();await ensureLiveDesignExtensions(d);
const i=d.lightingSystem.selectedItems.find(i=>i.productId==='liv')!;i.places!.push({x:180,z:400,angle:0});i.qty++;
const m=buildDeckTakeoff(d);console.log(extrasLayout(d,m).fixtures.filter(f=>f.productId==='liv'));
