// DeckCraft studies of three award-winning Dr. Decks (Tacoma, WA; @drdecks) projects, rebuilt from their published
// award descriptions. The curves are drawn as free outlines: true arcs sampled every few degrees, the house along y=0.
// Run: npx tsx video/designs/drdecks-replicas.ts  →  video/designs/drdecks/<slug>.json + replicas.json
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {validateDesign} from '../../src/features/deckcraft/designPersistence';
import {calculateDeckReleaseEstimate,deckReleaseData,serializeDeckReleaseDesign} from '../../src/features/deckcraft/deckRelease';
import {encodeDesignLink} from '../../src/features/deckcraft/designLink';
import type {DeckData,HouseConfig,HouseOpening,OutlinePoint} from '../../src/features/deckcraft/types';

const out=new URL('./drdecks/',import.meta.url).pathname;mkdirSync(out,{recursive:true});
const kemp=(JSON.parse(readFileSync(new URL('../../scripts/deck-level-junction-designs.json',import.meta.url),'utf8')) as Record<string,DeckData>).Kempenfelt;
const ORIGIN='https://goldenmaplelandscaping.ca';
const r2=(n:number)=>Math.round(n*100)/100;

/** Points along a circular arc (degrees, 0 = +x, 90 = toward the yard), both ends included. */
const arc=(cx:number,cy:number,r:number,from:number,to:number,step=7.5):OutlinePoint[]=>{
  const n=Math.max(2,Math.ceil(Math.abs(to-from)/step)),pts:OutlinePoint[]=[];
  for(let i=0;i<=n;i++){const a=(from+(to-from)*i/n)*Math.PI/180;pts.push({x:r2(cx+r*Math.cos(a)),y:r2(cy+r*Math.sin(a))});}
  return pts;
};
/** The front of a deck as one circular arc through (x1,y) and (x0,y) bulging `sagitta` ft into the yard, right to
 * left, without its end points. A sagitta of half the chord is a semicircle. */
const frontArc=(x0:number,x1:number,y:number,sagitta:number):OutlinePoint[]=>{
  const c=x1-x0,r=(c*c/4+sagitta*sagitta)/(2*sagitta),cx=(x0+x1)/2,cy=y+sagitta-r;
  const a1=Math.atan2(y-cy,x1-cx)*180/Math.PI,a0=Math.atan2(y-cy,x0-cx)*180/Math.PI;
  return arc(cx,cy,r,a1,a0).slice(1,-1);
};
const bounds=(p:OutlinePoint[])=>({w:Math.max(...p.map(q=>q.x))-Math.min(...p.map(q=>q.x)),h:Math.max(...p.map(q=>q.y))-Math.min(...p.map(q=>q.y))});
const win=(id:string,offsetPct:number,bottomIn:number,widthIn:number,heightIn:number,style:HouseOpening['style']='Picture'):HouseOpening=>({id,type:'Window',facade:'Front',offsetPct,bottomIn,widthIn,heightIn,style} as HouseOpening);
const door=(id:string,offsetPct:number,bottomIn:number,widthIn=96,heightIn=96):HouseOpening=>({id,type:'Door',facade:'Front',offsetPct,bottomIn,widthIn,heightIn,style:'Sliding'} as HouseOpening);
function house(over:Partial<HouseConfig>,openings:HouseOpening[]):HouseConfig{const {footprint:_g,...base}=structuredClone(kemp.houseConfig!);return {...base,...over,openings} as HouseConfig;}
/** Pacific Northwest contemporary: dark vertical siding, black windows. */
const pnw=(floorIn:number,widthFt:number,storeys:1|2|3=2)=>house({widthFt,depthFt:34,storeys,storeyHeightIn:Math.max(110,floorIn),floorHeightIn:floorIn,cladding:'Vertical siding',claddingColor:'#3b3f3c',trimColor:'#1f2021',fasciaColor:'#1f2021',windowColor:'#1f2021',doorColor:'#7a5a3a',roofColor:'#2a2c2e'},
  [door('patio-door',50,floorIn,120,96),win('win-l',20,floorIn+24,72,72),win('win-r',80,floorIn+24,72,72),...[20,40,60,80].map((p,i)=>win(`up-${i}`,p,floorIn+Math.max(110,floorIn)+30,48,60,'Casement'))]);

// 1. Kiki: a half-moon on a 12 ft radius off a straight run along the house.
const kiki:OutlinePoint[]=[{x:0,y:0},{x:28,y:0},{x:28,y:7},...frontArc(4,28,7,12),{x:4,y:7},{x:0,y:7}];
// 2. Upper and lower: an upper deck whose front sweeps 4 ft further into the yard at its middle.
const upper:OutlinePoint[]=[{x:0,y:0},{x:24,y:0},{x:24,y:10},...frontArc(0,24,10,4),{x:0,y:10}];
// 3. Milton: a broad bay whose front is one arc bulging 4.8 ft beyond 9 ft straight returns. A deeper bulge leaves
// joist ends past the beams the engine can place, so this is the sweep that frames cleanly.
const milton:OutlinePoint[]=[{x:0,y:0},{x:26,y:0},{x:26,y:9},...frontArc(0,26,9,4.8),{x:0,y:9}];

interface Study {slug:string;name:string;after:string;award:string;source:string;published:string[];modelled:string[];notModelled:string[];design:DeckData}
const studies:Study[]=[
  {slug:'kiki-half-moon',name:'Kiki Half-Moon',after:'Dr. Decks, "Kiki" (Washington)',award:'NADRA 2025 Overall Deck of the Year; also 1st in Railing on a Deck, Unique Feature and Alternative Deck $251k–$500k',
    source:'https://agsstainless.com/ags-nadra-award-2026-kiki-deck-drdecks-project/',
    published:['Built on 14 in round wood piles with aluminum framing in multiple curves','A compound-curved, tilt-back built-in bench','Marine-grade stainless cable railing with a sweeping 12 ft radius curved top rail','Heat-bent deck boards (Dr. Decks\' signature)'],
    modelled:['A half-moon deck: a 28 ft run along the house opening into a true 12 ft radius curve, 4 ft off grade','Stainless cable railing following the curve','Picture-frame border bent around the arc in a darker tone','Built-in bench along the house-side run','TimberTech AZEK Vintage Mahogany with Dark Hickory border (our pick; colours not published)'],
    notModelled:['The compound curve and tilt-back of the bench (DeckCraft benches are straight)','Round piles (drawn as square posts)'],
    design:{...structuredClone(kemp),levels:1,shape:'Rectangle',width:bounds(kiki).w,length:bounds(kiki).h,height:48,cornerChamfers:{frontLeftFt:0,frontRightFt:0},deckOutlines:{main:kiki},
      deckingMaterial:'tt_vintage',deckingColor:'Mahogany',pattern:'Picture Frame',pictureFrameRows:1,
      deckFinishes:{border:'tt_vintage:Dark Hickory',fascia:'tt_vintage:Dark Hickory',risers:'tt_vintage:Dark Hickory'},
      railingType:'Cable',catalogueRailingId:undefined,benchLf:14,stairFlights:1,stairPosition:'Left',stairOffset:50,stairWidth:48,skirting:undefined,
      houseConfig:pnw(48,40),autoLighting:{posts:true,stairs:true,stairStyle:'evo_hyde'},sceneLighting:'Daylight'}},
  {slug:'upper-lower-curves',name:'Upper & Lower Curves',after:'Dr. Decks LLC (Washington)',award:'NADRA 2021 National Deck Awards, First Place Overall',
    source:'https://www.nadra.org/blog/nadra-presents-2021-national-awards-in-clearwater-beach-fl',
    published:['TimberTech AZEK decking with over 40 hours of heat bending for custom parts; two men, four months','Both decks waterproofed with EPDM pond liner','Lower deck fully skirted in matching material as secure storage, with a custom barn-door access','Hideaway privacy screens toward the neighbours and a custom AZEK PVC privacy wall at the far end','In-lite lighting, Regal aluminum railing'],
    modelled:['Upper deck at 8 ft with a front sweeping in an arc, beside a lower deck at 30 in','Under-deck drainage (TimberTech DrySpace) standing in for the EPDM membrane, so both stay dry','Lower deck skirted all round with two access panels','HIDEAWAY Horizon privacy screens in black, plus a slatted privacy wall at the far end','Aluminum railing in Textured Black, post and stair lights','TimberTech AZEK Vintage Cypress with Dark Hickory border (our pick)'],
    notModelled:['The axe-throwing station','Barn-door styling of the access (drawn as skirting panels)'],
    design:{...structuredClone(kemp),levels:2,shape:'Rectangle',width:bounds(upper).w,length:bounds(upper).h,height:96,cornerChamfers:{frontLeftFt:0,frontRightFt:0},deckOutlines:{main:upper},
      width2:18,length2:16,height2:30,level2Position:'Right',level2Offset:60,level2FullStep:false,
      deckingMaterial:'tt_vintage',deckingColor:'Cypress',pattern:'Picture Frame',pictureFrameRows:1,
      deckFinishes:{border:'tt_vintage:Dark Hickory',fascia:'tt_vintage:Dark Hickory',risers:'tt_vintage:Dark Hickory',railingColor:'Textured Black'},
      catalogueRailingId:'dk_contemporary',railingType:'Aluminum',stairFlights:1,stairPosition:'Front',stairOffset:50,stairWidth:48,
      skirting:{style:'Horizontal boards',colour:'tt_vintage:Dark Hickory',clearanceIn:2,accessPanels:2},
      underDeck:{drainage:'dryspace',ceiling:'none',scope:'all',gravel:false,gravelDepthIn:3,floorMesh:false},hasDrainage:true,
      privacyScreens:[{id:'hideaway-right',side:'Right',lengthFt:12,heightFt:6,offsetPct:50,lights:true,level:2,product:'hideaway',design:'Horizon',finish:'Black',panels:3} as never,{id:'far-wall',side:'Front',lengthFt:8,heightFt:6,offsetPct:80,lights:false,level:2} as never],
      houseConfig:pnw(96,46),lightingSystem:{wireDistance:90,selectedItems:[{productId:'smart_hub150',qty:1},{productId:'fusion',qty:8,zone:'deck'}]},
      autoLighting:{posts:true,stairs:true,stairStyle:'evo_hyde'},sceneLighting:'Evening'}},
  {slug:'milton-circles',name:'Milton Circles',after:'Jason "Dr. Decks" Russell, Milton, WA',award:'NADRA National Deck Competition: 1st Best Alternative Deck ($25k–$50k), 3rd Best Overall, Unique Feature recognition',
    source:'https://www.prnewswire.com/news-releases/azek-deck-wins-national-recognition-from-the-north-american-deck-and-railing-association-300359206.html',
    published:['Custom-curved deck in AZEK Harvest Collection Brownstone','Unique inlays showcasing several circular designs, bent from AZEK capped polymer'],
    modelled:['A broad bay deck whose front is one sweeping arc (about 20 ft radius), 28 in off grade with a guard as Ontario code requires above 24 in','AZEK Harvest Brownstone field with a Kona border bent along the curve','Three circular inlays: a 7 ft round medallion centred, flanked by two 4 ft compass medallions','A wide front stair'],
    notModelled:['The exact inlay layout and sizes (not published)'],
    design:{...structuredClone(kemp),levels:1,shape:'Rectangle',width:bounds(milton).w,length:bounds(milton).h,height:28,cornerChamfers:{frontLeftFt:0,frontRightFt:0},deckOutlines:{main:milton},
      deckingMaterial:'tt_harvest',deckingColor:'Brownstone',pattern:'Picture Frame',pictureFrameRows:1,
      inlays:[{id:'centre-circle',kind:'medallion',diameterFt:7,style:'round',dxFt:0,dyFt:0.8,frame:'tt_harvest:Kona'},{id:'left-circle',kind:'medallion',diameterFt:4,style:'compass',dxFt:-7.5,dyFt:-0.5,frame:'tt_harvest:Kona',fill:'tt_harvest:Slate Gray'},{id:'right-circle',kind:'medallion',diameterFt:4,style:'compass',dxFt:7.5,dyFt:-0.5,frame:'tt_harvest:Kona',fill:'tt_harvest:Slate Gray'}],
      catalogueRailingId:'tt_impression_express',railingType:'Aluminum',deckFinishes:{border:'tt_harvest:Kona',fascia:'tt_harvest:Kona',risers:'tt_harvest:Kona',railingColor:'Black'},stairFlights:1,stairPosition:'Right',stairOffset:50,stairWidth:60,skirting:undefined,
      houseConfig:pnw(28,40),autoLighting:{posts:false,stairs:true,stairStyle:'evo_hyde'},sceneLighting:'Daylight'}},
];

const summary=[];
for(const s of studies){
  const design=deckReleaseData(validateDesign({...s.design,customerName:'',projectAddress:''}));
  const estimate=calculateDeckReleaseEstimate(design);
  const notes=(estimate.model as unknown as {issues?:string[]}).issues??[];
  writeFileSync(out+s.slug+'.json',serializeDeckReleaseDesign(design)+'\n');
  const link=await encodeDesignLink(design,ORIGIN);
  const {design:_d,...meta}=s;
  summary.push({...meta,constructionNotes:notes,sqft:Math.round(estimate.model.quantities.area),levels:estimate.model.levels.filter(l=>l.kind==='deck').length,link});
  console.log(`${s.name}: ${Math.round(estimate.model.quantities.area)} sq ft, ${design.levels} level(s), ${notes.length} note(s)${notes.length?':\n   - '+notes.join('\n   - '):''}`);
}
writeFileSync(out+'replicas.json',JSON.stringify(summary,null,2)+'\n');
