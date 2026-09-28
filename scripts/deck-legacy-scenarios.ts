import {MANUFACTURER_ACCESSORIES} from '../src/features/deckcraft/manufacturerCatalog';
import type {DeckData} from '../src/features/deckcraft/types';

/**
 * The existing-design scenarios the legacy parity golden (check-deck-legacy-parity.ts) fingerprints, by name: each a
 * patch on the default deck. The price schedule check (check-deck-ledger.ts) renders the same designs.
 */
export function legacyScenarios():Record<string,Partial<DeckData>>{
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
  return scenarios;
}
