import {loadAdvancedYardRuntime} from '../src/features/deckcraft/yardModel';
await loadAdvancedYardRuntime();
import {ontarioShowcaseDesign,showcaseSampleIssues} from '../src/features/deckcraft/showcaseSample';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {extrasLayout,treadNose} from '../src/features/deckcraft/extrasLayout';
import {yardFeatureOutline} from '../src/features/deckcraft/yardPathGeometry';
import {poolOutline} from '../src/features/deckcraft/poolGeometry';
import {landscapeFootprint} from '../src/features/deckcraft/landscapeModelRuntime';
import {houseOutline} from '../src/features/deckcraft/houseFootprint';
import {writeFileSync} from 'node:fs';
import {ensureLiveDesignExtensions} from '../src/features/deckcraft/designExtensions';
const d=ontarioShowcaseDesign();await ensureLiveDesignExtensions(d);
const m=buildDeckTakeoff(d),ex=extrasLayout(d,m);
const out={features:(d.yardFeatures??[]).map(f=>({id:f.id,kind:f.kind,rings:yardFeatureOutline(f)})),pools:(d.pools??[]).map(p=>poolOutline(p)),
 objects:(d.landscapeObjects??[]).filter(o=>o.kind!=='plant').map(o=>({id:o.id,kind:o.kind,asset:o.assetId,ring:landscapeFootprint(o)})),
 house:houseOutline(d),deck:m.levels[0].footprint.outline.map(p=>({x:p.x+m.levels[0].offset.x,y:p.y+m.levels[0].offset.z})),
 posts:m.railing.posts,treads:m.treads.map(t=>({...treadNose(t),y:t.y,h:t.h})),fixtures:ex.fixtures,warnings:ex.warnings,issues:showcaseSampleIssues(d),pergola:d.pergola,items:d.lightingSystem.selectedItems.map(i=>({p:i.productId,q:i.qty,z:i.zone,a:i.auto}))};
writeFileSync('.scratch/dump.json',JSON.stringify(out));
console.log(JSON.stringify({items:out.items,warnings:out.warnings,issues:out.issues,treads:out.treads,posts:out.posts.length},null,0));
