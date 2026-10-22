const {ultimateParadiseDesign}=await import('../src/features/deckcraft/paradiseSample');
import {loadAdvancedYardRuntime} from '../src/features/deckcraft/yardModel';await loadAdvancedYardRuntime();
const d=ultimateParadiseDesign();for(const c of d.scenePresentation!.cameras!)console.log(c.id,JSON.stringify(c.positionIn),JSON.stringify(c.targetIn),c.fov);
const p=d.pools!;console.log('pools',p.map(x=>[x.id,x.xIn,x.zIn]));const f=d.yardFeatures!.find(x=>x.id==='fire-bowl')!;console.log('fire',f.xFt*12,f.zFt*12,'fall',JSON.stringify(d.yardFeatures!.find(x=>x.id==='waterfall')));
