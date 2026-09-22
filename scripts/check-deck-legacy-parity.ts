import {createHash} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {calculateEstimate} from '../src/features/deckcraft/calculations';
import {getHardwareLayout} from '../src/features/deckcraft/hardwareLayout';
import {extrasLayout} from '../src/features/deckcraft/extrasLayout';
import {catalogueAccessoryLayout} from '../src/features/deckcraft/catalogueAccessories';
import {deckExportMeshes} from '../src/features/deckcraft/designExports';
import {MANUFACTURER_ACCESSORIES} from '../src/features/deckcraft/manufacturerCatalog';
import type {DeckData} from '../src/features/deckcraft/types';

// Existing designs must build, draw and price exactly as before while the house/wrap
// work refactors the geometry core. Run with --update only when a change is owner-approved.
const GOLDEN=new URL('./deck-legacy-golden.json',import.meta.url);
const update=process.argv.includes('--update');

const base=():DeckData=>structuredClone(DEFAULT_DECK);
const scenarios:Record<string,Partial<DeckData>>={};
const sizes={std:{width:16,length:12,height:36},big:{width:24,length:20,height:72,cutoutWidth:8,cutoutLength:8,cutoutWidth2:4,cutoutLength2:4}};
for(const [size,dims] of Object.entries(sizes))
  for(const shape of ['Rectangle','L-Shape','Multi-corner','Curved'] as const)
    for(const pattern of ['Straight','Diagonal','Picture Frame','Herringbone'] as const)
      for(const stairType of ['Straight','Landing','Winder'] as const){
        scenarios[`${size}/${shape}/${pattern}/${stairType}/attached`]={...dims,shape,pattern,stairType};
        scenarios[`${size}/${shape}/${pattern}/${stairType}/freestanding-2lvl`]={...dims,shape,pattern,stairType,deckType:'Freestanding',levels:2,height2:Math.max(12,dims.height-24),level2Position:'Left'};
      }
Object.assign(scenarios,{
  'stairs/left-20':{stairPosition:'Left',stairOffset:20},
  'stairs/right-80-2flights':{stairPosition:'Right',stairOffset:80,stairFlights:2},
  'stairs/3flights-freestanding-back':{deckType:'Freestanding',stairPosition:'Back',stairFlights:3},
  'stairs/none':{stairFlights:0},
  'type/add-on':{deckType:'Add-on'},
  'type/floating':{deckType:'Floating',height:12},
  'border/1-dark-slate':{pictureFrameRows:1,borderFinish:'Dark Slate',pictureFrameOverhangIn:0.5},
  'border/2-matching-lshape':{shape:'L-Shape',pictureFrameRows:2},
  'foundation/helical':{foundation:'Helical Piles',foundationDepthIn:84},
  'foundation/blocks':{foundation:'Deck Blocks',height:18},
  'fasteners/hidden':{fasteningSystem:'Hidden'},
  'railing/glass':{railingType:'Glass Panels'},
  'railing/cable-tall':{railingType:'Cable',height:84},
  'railing/none':{railingType:'None'},
  'extras/all':{benchLf:8,privacySqft:48,pergolaSqft:64,hasDrainage:true,hasDemo:true,hasInlay:true,inlayLf:12},
  'accessories/all':{catalogueAccessories:MANUFACTURER_ACCESSORIES.filter(a=>a.previewSupported&&a.kind!=='fastener').map(a=>a.id)},
  'lighting/manual-zones':{lightingSystem:{wireDistance:60,selectedItems:[{productId:'wedge',qty:4,zone:'stairs'},{productId:'hyve',qty:4,zone:'deck'},{productId:'blink',qty:2,zone:'house'},{productId:'ace',qty:2,zone:'landscape'},{productId:'hub100',qty:1}]}},
  'lighting/auto-posts-steps':{autoLighting:{posts:true,stairs:true},lightingSystem:{wireDistance:20,selectedItems:[{productId:'puck',qty:10,zone:'posts',auto:true},{productId:'evo_hyde',qty:4,zone:'stairs',auto:true},{productId:'hub100',qty:1,auto:true}]}},
  'screens/slatted-lit+hideaway':{privacySqft:48,privacyScreens:[{id:'s1',side:'Left',lengthFt:8,heightFt:6,offsetPct:30,lights:true},{id:'s2',side:'Right',lengthFt:8,heightFt:6,offsetPct:50,lights:false,product:'hideaway',design:'Hexx',finish:'Black',panels:2}],lightingSystem:{wireDistance:20,selectedItems:[{productId:'blink',qty:3,zone:'privacy',auto:true},{productId:'hub100',qty:1,auto:true}]}},
  'house/custom-openings':{houseConfig:{widthFt:30,depthFt:24,storeys:2,storeyHeightIn:108,roofShape:'Hip',roofFinish:'Metal',roofColor:'#333333',cladding:'Brick',claddingColor:'#aa5533',trimColor:'#ffffff',openings:[{id:'d1',type:'Door',facade:'Front',offsetPct:40,bottomIn:36,widthIn:72,heightIn:84},{id:'w1',type:'Window',facade:'Left',offsetPct:50,bottomIn:48,widthIn:36,heightIn:48}]}},
  'house/hidden':{houseVisible:false},
});

// Rounded, -0-free JSON so identity-transform refactors do not trip on float noise.
const stable=(value:unknown)=>JSON.stringify(value,(_k,v)=>typeof v==='number'?(Object.is(v,-0)||Math.abs(v)<5e-7?0:Math.round(v*1e6)/1e6):v);
const digest=(value:unknown)=>createHash('sha256').update(stable(value)).digest('hex').slice(0,20);

function fingerprint(patch:Partial<DeckData>){
  const d:DeckData={...base(),...patch};
  try{
    const estimate=calculateEstimate(d),model=estimate.model;
    // Issues/flags are fingerprinted apart from geometry and price, so a new
    // "confirm before construction" warning can never mask a build or price change.
    const {model:_model,flags,...priced}=estimate,{issues,...geometry}=model;
    return {
      model:digest(geometry),
      issues:digest(issues),
      flags:digest(flags),
      hardware:digest(getHardwareLayout(d,model)),
      extras:digest(extrasLayout(d,model)),
      catalogue:digest(catalogueAccessoryLayout(d,model)),
      exports:digest(deckExportMeshes(d,model).map(m=>[m.name,m.vertices,m.faces])),
      estimate:digest(priced),
      total:Math.round(estimate.total*100)/100,
    };
  }catch(error){return {throws:error instanceof Error?error.message:String(error)};}
}

const current=Object.fromEntries(Object.entries(scenarios).map(([name,patch])=>[name,fingerprint(patch)]));
if(update||!existsSync(GOLDEN)){
  writeFileSync(GOLDEN,JSON.stringify(current,null,1)+'\n');
  console.log(`Legacy parity golden written: ${Object.keys(current).length} scenarios.`);
}else{
  const golden=JSON.parse(readFileSync(GOLDEN,'utf8')) as Record<string,unknown>;
  const drift=Object.keys({...golden,...current}).filter(name=>stable(golden[name])!==stable(current[name]));
  if(drift.length){
    const parts=(name:string)=>{const g=(golden[name]??{}) as Record<string,unknown>,c=(current[name]??{}) as Record<string,unknown>;return Object.keys({...g,...c}).filter(k=>stable(g[k])!==stable(c[k]));};
    const byParts=new Map<string,string[]>();for(const name of drift){const key=parts(name).join('+')||'(missing)';byParts.set(key,[...(byParts.get(key)??[]),name]);}
    for(const [key,names] of byParts)console.error(`DRIFT in ${key}: ${names.length} scenario(s), e.g. ${names.slice(0,4).join(', ')}`);
    console.error(`${drift.length} of ${Object.keys(current).length} legacy scenarios changed. Existing designs must build and price exactly as before.`);
    process.exit(1);
  }
  console.log(`LEGACY PARITY OK — ${Object.keys(current).length} existing-design scenarios build, draw, export and price exactly as before.`);
}
