// Builds the showcase deck designs used by the motion-graphics reels (video/README.md). Each one starts from a
// reviewed design in scripts/deck-level-junction-designs.json, takes a design patch, and must survive the same
// validation a customer upload does. Writes <slug>.json (a release design file the designer can open) and
// specs.json (on-screen facts, taken from the engine's own takeoff, never typed in by hand).
// Run: npx tsx video/designs/build-designs.ts
import {readFileSync,writeFileSync} from 'node:fs';
import {validateDesign} from '../../src/features/deckcraft/designPersistence';
import {calculateDeckReleaseEstimate,deckReleaseData,serializeDeckReleaseDesign} from '../../src/features/deckcraft/deckRelease';
import {DECKING_CATALOGUE} from '../../src/features/deckcraft/manufacturerRuntimeCatalogue';
import {newPergola} from '../../src/features/deckcraft/pergolaCatalog';
import type {DeckData} from '../../src/features/deckcraft/types';

const here=new URL('.',import.meta.url).pathname;
const bases=JSON.parse(readFileSync(new URL('../../scripts/deck-level-junction-designs.json',import.meta.url),'utf8')) as Record<string,DeckData>;

interface Showcase {slug:string;name:string;tagline:string;base:keyof typeof bases;patch:Partial<DeckData>;features:string[]}
const SHOWCASES:Showcase[]=[
  {slug:'shanty-bay',name:'Shanty Bay',tagline:'Two levels. Zero sightline lost.',base:'Kempenfelt',features:['Frameless glass','Picture-frame border','Integrated lighting'],
    patch:{deckingMaterial:'tt_vintage',deckingColor:'English Walnut',railingType:'Frameless Glass',glassMount:'Fascia-mount base shoe',glassFinish:'Black',
      deckFinishes:{border:'tt_vintage:Dark Hickory',fascia:'tt_vintage:Dark Hickory',risers:'tt_vintage:Dark Hickory',railingColor:'Black'},
      skirting:{style:'Horizontal boards',colour:'tt_vintage:Dark Hickory',clearanceIn:2,accessPanels:0},sceneLighting:'Evening'}},
  {slug:'oro-station',name:'Oro Station',tagline:'Three levels down to the waterfall.',base:'Cascade',features:['Three-level cascade','Paver terrace + seat wall','Pondless waterfall'],
    patch:{deckingMaterial:'tt_landmark',deckingColor:'American Walnut',sceneLighting:'Evening'}},
  {slug:'minets-point',name:'Minets Point',tagline:'Clipped corners. Private by design.',base:'Painswick',features:['45° corner cuts','Lit privacy screen','Hidden fasteners'],
    patch:{levels:1,cornerChamfers:{frontLeftFt:4,frontRightFt:4},deckingMaterial:'tt_legacy',deckingColor:'Ashwood',railingType:'Aluminum',
      deckFinishes:{border:'tt_legacy:Espresso',fascia:'tt_legacy:Espresso',risers:'tt_legacy:Espresso',railingColor:'Black'},
      skirting:{style:'Horizontal boards',colour:'tt_legacy:Espresso',clearanceIn:2,accessPanels:0},
      privacyScreens:[{id:'screen-right',side:'Right',lengthFt:10,heightFt:6,offsetPct:50,lights:true}],sceneLighting:'Daylight'}},
  {slug:'snow-valley',name:'Snow Valley',tagline:'Shade, glass, and room for everyone.',base:'Painswick',features:['Aluminum pergola','Glass panel railing','Wide feature stair'],
    patch:{levels:1,width:28,length:16,deckingMaterial:'deck_voyage',deckingColor:'Sedona',
      deckFinishes:{border:'deck_voyage:Mesa',fascia:'deck_voyage:Mesa',risers:'deck_voyage:Mesa',railingColor:'Black'},
      skirting:{style:'Horizontal boards',colour:'deck_voyage:Mesa',clearanceIn:2,accessPanels:0},
      pergola:{...newPergola('costco-mirador'),xFt:7,zFt:8},sceneLighting:'Daylight'}},
];

const specs=[];
for(const s of SHOWCASES){
  const design=deckReleaseData(validateDesign({...structuredClone(bases[s.base]),...s.patch,customerName:'',projectAddress:''}));
  const estimate=calculateDeckReleaseEstimate(design);
  const material=DECKING_CATALOGUE.find(m=>m.id===design.deckingMaterial)!;
  const levels=estimate.model.levels.filter(l=>l.kind==='deck');
  const sqft=Math.round(estimate.model.quantities.area);
  writeFileSync(here+s.slug+'.json',serializeDeckReleaseDesign(design)+'\n');
  specs.push({slug:s.slug,name:s.name,tagline:s.tagline,features:s.features,sqft,levels:levels.length,
    decking:`${material.name} · ${design.deckingColor}`,railing:design.railingType,scene:design.sceneLighting??'Daylight'});
  console.log(`${s.name}: ${sqft} sq ft, ${levels.length} level(s), ${material.name} ${design.deckingColor}, ${design.railingType}`);
}
writeFileSync(here+'specs.json',JSON.stringify(specs,null,2)+'\n');
