const {resortEstateDesign}=await import('../src/features/deckcraft/resortEstate');
import {loadAdvancedYardRuntime} from '../src/features/deckcraft/yardModel';await loadAdvancedYardRuntime();
const {driftPlants,validDrift}=await import('../src/features/deckcraft/landscapeDrift');
const d=resortEstateDesign();const b=d.landscapeObjects!.find(o=>o.id==='meadow-west') as any;console.log(JSON.stringify(b.drift),validDrift(b.drift),driftPlants(b).length);
import {newLandscapePlant} from '../src/features/deckcraft/landscapeCatalogue';try{newLandscapePlant('echinacea-purpurea','x',0,0);console.log('ok')}catch(e){console.log(String(e))}
