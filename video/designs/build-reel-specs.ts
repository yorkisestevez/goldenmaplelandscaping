// On-screen facts for the replica reels (video/README.md): four award-winning decks re-drawn in DeckCraft. The sq ft,
// level count, decking and railing come from the engine's takeoff of each replica file; the words are ours. These are
// other builders' designs, so every reel says "Drawn in DeckCraft" and credits the original on screen.
// Run: npx tsx video/designs/build-reel-specs.ts  →  video/designs/replica-reels.json
import {readFileSync,writeFileSync} from 'node:fs';
import {calculateDeckReleaseEstimate,parseDeckReleaseDesign} from '../../src/features/deckcraft/deckRelease';
import {DECKING_CATALOGUE} from '../../src/features/deckcraft/manufacturerRuntimeCatalogue';

const here=new URL('.',import.meta.url).pathname;
interface Reel {slug:string;dir:string;name:string;tagline:string;features:string[];credit:string}
const REELS:Reel[]=[
  {slug:'kiki-half-moon',dir:'drdecks',name:'Kiki Half-Moon',tagline:'A twelve-foot radius. Not a straight board in sight.',
    features:['12 ft radius curve','Cable rail on the arc','Bent border'],credit:'Inspired by Dr. Decks’ Kiki · NADRA 2025 Deck of the Year'},
  {slug:'milton-circles',dir:'drdecks',name:'Milton Circles',tagline:'Three circles in one sweeping bay.',
    features:['7 ft round medallion','Twin compass inlays','Curved bay'],credit:'Inspired by Dr. Decks, Milton WA · NADRA award winner'},
  {slug:'lakefront-heights',dir:'award',name:'Lakefront Heights',tagline:'Ten feet up. Dry underneath.',
    features:['DrySpace under both tiers','Patio below','Dark Bronze rail'],credit:'Inspired by Casey Fence & Deck · NADRA 2022'},
  {slug:'virginia-cascade',dir:'award',name:'Virginia Cascade',tagline:'Three tiers down from a louvered roof.',
    features:['Three-tier cascade','Louvered roof','Dry walkout below'],credit:'Inspired by Deckscapes of Virginia · NADRA 2024'},
];

const specs=[];
for(const r of REELS){
  const design=parseDeckReleaseDesign(readFileSync(`${here}${r.dir}/${r.slug}.json`,'utf8'));
  const estimate=calculateDeckReleaseEstimate(design);
  const material=DECKING_CATALOGUE.find(m=>m.id===design.deckingMaterial)!;
  const levels=estimate.model.levels.filter(l=>l.kind==='deck');
  const sqft=Math.round(estimate.model.quantities.area);
  specs.push({slug:r.slug,name:r.name,tagline:r.tagline,features:r.features,sqft,levels:levels.length,
    decking:`${material.name} · ${design.deckingColor}`,railing:design.railingType,scene:design.sceneLighting??'Daylight',
    kicker:'Drawn in DeckCraft',credit:r.credit});
  console.log(`${r.name}: ${sqft} sq ft, ${levels.length} level(s), ${material.name} ${design.deckingColor}, ${design.railingType}`);
}
writeFileSync(here+'replica-reels.json',JSON.stringify(specs,null,2)+'\n');
