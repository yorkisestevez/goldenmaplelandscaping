import type {DeckData,PrivacyProductId,PrivacyScreen} from './types';
import {getFootprint} from './lib/deckGeometry';
import {availableStairSides,exposedEdges,getHouseContact} from './houseContact';

export const MAX_PRIVACY_SCREENS=8;
export const MAX_PRIVACY_SQFT=500;
export const MAX_SCREEN_PANELS=12;
export const PRIVACY_SIDES=['Left','Right','Front','Back'] as const;
export const PRIVACY_HEIGHTS=[4,5,6] as const;

export interface PrivacyProduct{
  id:PrivacyProductId;name:string;maker:string;
  /** true = existing Golden Maple privacy-screen rate by face area; false = supplier quote required. */
  pricedBySqft:boolean;
  panel?:{widthIn:number;heightIn:number;thicknessIn:number};
  /** heightVerified=false means the drawn post height is illustrative only. */
  post?:{widthIn:number;heightIn:number;heightVerified:boolean};
  designs:readonly string[];
  finishes:readonly ('Black'|'White')[];finishLabels?:Record<'Black'|'White',string>;
  sourceUrl?:string;checkedOn?:string;notes:string;
}
/** Manufacturer facts only, checked at the source; never a price book. */
export const PRIVACY_PRODUCTS:readonly PrivacyProduct[]=[
  {id:'slatted',name:'Golden Maple slatted screen',maker:'Golden Maple',pricedBySqft:true,designs:[],finishes:[],
    notes:'Horizontal slats in the selected decking, 4, 5 or 6 ft high. Priced at our existing privacy-screen rate.'},
  {id:'hideaway',name:'HIDEAWAY standard privacy screen',maker:'HIDEAWAY (made in Edmonton, AB)',pricedBySqft:false,
    panel:{widthIn:36,heightIn:68,thicknessIn:0.1},post:{widthIn:3,heightIn:73,heightVerified:true},
    designs:['Hexx','Moderna','Breeze','Horizon','Maui','River Rock','Branch','Dash','Solid','Rain'],
    finishes:['Black','White'],finishLabels:{Black:'Textured Black',White:'Textured White'},
    sourceUrl:'https://hideawayscreens.ca/collections/standard-privacy-screens',checkedOn:'2026-09-21',
    notes:'Laser-cut powder-coated aluminum. Standard panels 36 × 68 in, 0.100 in thick, on 3 × 3 × 73 in mounting posts with brackets (sold separately).'},
  {id:'oasis',name:'Oasis aluminum privacy screen',maker:'Oasis · Composite Deck Direct (Ontario North/East listing)',pricedBySqft:false,
    panel:{widthIn:36,heightIn:68,thicknessIn:0.08},post:{widthIn:2.25,heightIn:72,heightVerified:false},
    designs:['Bamboo','Matrix','Woodland','Driftwood'],finishes:[],
    sourceUrl:'https://compositedeckdirect.com/products/oasis%E2%84%A2-privacy-screens-on-north-east',checkedOn:'2026-09-21',
    notes:'Laser-cut powder-coated aluminum. Panels 36 × 68 in, 0.08 in thick, on 2.25 × 2.25 in posts. Finish colour and post height to confirm with the supplier.'},
];

export const screenOn=(s:PrivacyScreen)=>s.enabled!==false;
export const screenProduct=(s:PrivacyScreen)=>PRIVACY_PRODUCTS.find(p=>p.id===(s.product??'slatted'))??PRIVACY_PRODUCTS[0];
/** Drawn run in inches. Manufacturer runs follow their stock panels and posts. */
export function screenLengthIn(s:PrivacyScreen){
  const p=screenProduct(s);if(!p.panel||!p.post)return s.lengthFt*12;
  const n=s.panels??1;return n*p.panel.widthIn+(n+1)*p.post.widthIn;
}
/** Face area shown to the customer, in square feet. */
export function screenFaceSqft(s:PrivacyScreen){
  const p=screenProduct(s);return p.panel?(s.panels??1)*p.panel.widthIn*p.panel.heightIn/144:s.lengthFt*s.heightFt;
}
/** Priced face area: enabled Golden Maple slatted screens only. Rounded so derivation never drifts. */
export function pricedPrivacyArea(screens:readonly PrivacyScreen[]){
  return Math.round(screens.filter(s=>screenOn(s)&&screenProduct(s).pricedBySqft).reduce((sum,s)=>sum+s.lengthFt*s.heightFt,0)*100)/100;
}
/** Enabled manufacturer screens, described for the supplier-quote list. */
export function quotedPrivacyScreens(screens:readonly PrivacyScreen[]){
  return screens.filter(s=>screenOn(s)&&!screenProduct(s).pricedBySqft).map(s=>{
    const p=screenProduct(s),n=s.panels??1,finish=s.finish&&p.finishLabels?`, ${p.finishLabels[s.finish]}`:'';
    return `${p.name}: ${s.design??p.designs[0]}, ${n} panel${n===1?'':'s'}${finish}`;
  });
}
/** Switch a screen's product, carrying its run length across as closely as the stock sizes allow. */
export function withPrivacyProduct(s:PrivacyScreen,id:PrivacyProductId):PrivacyScreen{
  const {design:_d,finish:_f,panels:_n,product:_p,...base}=s,lengthIn=screenLengthIn(s);
  const p=PRIVACY_PRODUCTS.find(x=>x.id===id)!;
  if(!p.panel||!p.post)return {...base,product:'slatted',lengthFt:Math.max(2,Math.min(60,Math.round(lengthIn/12*2)/2))};
  const panels=Math.max(1,Math.min(MAX_SCREEN_PANELS,Math.round((lengthIn-p.post.widthIn)/(p.panel.widthIn+p.post.widthIn))));
  return {...base,product:id,design:p.designs[0],panels,...(p.finishes.length?{finish:p.finishes[0]}:{})};
}

/** Screen sides with an exposed deck edge; edges against the house never take a screen. */
export function privacySides(data:DeckData){
  const exposed=availableStairSides(data);
  return PRIVACY_SIDES.filter(side=>exposed.includes(side));
}

export function newPrivacyScreen(data:DeckData,existing:readonly PrivacyScreen[]):PrivacyScreen{
  const used=new Set(existing.map(s=>s.side)),side=privacySides(data).find(s=>!used.has(s))??'Left';
  const fp=getFootprint(data,1),edgeFt=(exposedEdges(fp,getHouseContact(data,fp),side)[0]?.lengthIn??data.length*12)/12;
  const room=Math.max(0,MAX_PRIVACY_SQFT-pricedPrivacyArea(existing));
  const lengthFt=Math.max(2,Math.min(8,edgeFt-2,Math.floor(room/6*2)/2));
  let n=existing.length+1;while(existing.some(s=>s.id===`screen-${n}`))n++;
  return {id:`screen-${n}`,side,lengthFt,heightFt:6,offsetPct:50,lights:false};
}

/** Older designs stored one area spread along the side edges. Rebuild it as 6 ft slatted screens
 * with exactly the same total area, so an imported design keeps its price. */
export function migrateLegacyPrivacy(data:DeckData):PrivacyScreen[]{
  const screens:PrivacyScreen[]=[];let remaining=Math.max(0,data.privacySqft);
  const caps:[PrivacyScreen['side'],number][]=[['Left',data.length-2],['Right',data.length-2],['Front',data.width-2]];
  while(remaining>1e-9&&screens.length<MAX_PRIVACY_SCREENS){
    const [side,capFt]=caps[screens.length]??['Left',60];
    const last=screens.length===MAX_PRIVACY_SCREENS-1;
    const area=last?remaining:Math.min(remaining,Math.max(2,Math.min(60,capFt))*6);
    screens.push({id:`screen-${screens.length+1}`,side,lengthFt:area/6,heightFt:6,offsetPct:0,lights:false});
    remaining-=area;
  }
  return screens;
}
