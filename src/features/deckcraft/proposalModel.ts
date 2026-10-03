import {BUSINESS,canPublish,publicContact} from '../../data/business';
import {boardFinishPlan,borderFinishRef,darkSlateBorder,deckColourRef,parseColourRef} from './boardFinishes';
import {DECK_PARTS,partRef,railingFinish} from './deckPartFinishes';
import {LIGHTING_ZONES} from './designer/constants';
import {quoteLabel,type Ledger,type LedgerLine,type LedgerQuote} from './designer/priceLedgerModel';
import {activeWrap} from './lib/wrapGeometry';
import {activeLightingItems,isSystemProduct} from './lightingSystem';
import {DECKING_CATALOGUE,MANUFACTURER_ACCESSORIES} from './manufacturerCatalog';
import {railingScreenHex} from './railingScreenColours';
import {GLASS_FINISH_HEX,GLASS_FINISH_NAMES} from './framelessGlass';
import {skirtingPlan} from './skirting';
import type {DeckTakeoff} from './deckTakeoff';
import type {ColourRef,DeckData} from './types';

/**
 * What the luxury proposal (R8, in the Golden Maple estimate branding since R9) shows, worked out once for the printable
 * sheet (ProposalSheet.tsx) and the PDF (proposalPdf.ts) alike. Pure: the design, its estimate's facts and its price schedule in; words and lists out. Every
 * line comes from the design itself, describeDesign's facts or the price engine (through priceLedgerModel.ts); nothing
 * is added that the design does not have, and nothing here prices anything.
 */

/** A picture of the design from one camera of the 3D view (the page's captureViews). The first is the cover. */
export interface ProposalShot{label:string;src:string}

/** The project's name in the PDF's document title: the customer's own, else "Your deck" (never "Not provided"). */
export const proposalTitle=(data:Pick<DeckData,'customerName'>)=>data.customerName.trim()||'Your deck';
/** The project address, only when the customer gave one ('' otherwise: the line is left out). */
export const proposalAddress=(data:Pick<DeckData,'projectAddress'>)=>data.projectAddress.trim();

/** The published contact facts (src/data/business.ts), as the proposal words them. */
export function proposalContact(){
  const site=BUSINESS.canonicalUrl.replace(/^https?:\/\//,''),name=BUSINESS.publicName.value,words=name.split(' ');
  return {
    name,phone:publicContact.phoneDisplay,tel:publicContact.phoneTel,email:publicContact.email,site,
    area:`${BUSINESS.addressPolicy.value.publicLocality}, ${BUSINESS.addressPolicy.value.region}`,
    book:`${site}/book`,
    // The cover's wordmark, as the estimate PDF sets it: the published name, its last word set under the rest.
    wordmark:{top:words.length>1?words.slice(0,-1).join(' '):name,sub:words.length>1?words[words.length-1]:''},
    // The public number is Sophie's, the AI receptionist (business.ts): named only while that fact is confirmed.
    call:canPublish(BUSINESS.contact.primaryPhone)?`Call or text Sophie, our AI receptionist, at ${publicContact.phoneDisplay}`:`Call us at ${publicContact.phoneDisplay}`,
  };
}

/** The proposal's wording on price, the same on the sheet and in the PDF. */
export const PROPOSAL_WORDS={
  estimate:'Planning estimate before HST',
  notFinal:'Not a final quote: measurements, connections and engineering are confirmed on site.',
  quotesNote:'Not in the totals above. Each is priced by the supplier, or by our builders, once the details are confirmed.',
  illustration:'Design illustration',
  colours:'Colours vary by screen; confirm with samples.',
  /** The cover's eyebrow and document type (R9): what the document honestly is. */
  eyebrow:'Deck design · Planning estimate',
  doctype:'Design proposal',
} as const;

/**
 * The gold eyebrow over each sheet's heading ("01 · In your design"), numbered in the order the sheets come; a sheet
 * that continues keeps its number.
 */
export const SHEET_EYEBROWS={views:'Your design in 3D',features:'In your design',finishes:'Manufacturer colours',site:'Layout',investment:'Your investment',next:'Next steps',appendix:'For your builder'} as const;
export const eyebrowNumber=(n:number)=>String(n).padStart(2,'0');

const LEVEL_WORDS=['','','Two','Three','Four'];
/**
 * The project's title on the cover, from the design itself: its levels, else a wrap-around, else its size, and the
 * backyard when the design has one. Never the customer's name (that is "Prepared for", only when they gave one).
 */
export function proposalCoverTitle(data:DeckData,backyard:boolean):string{
  const deck=data.levels>1?`${LEVEL_WORDS[data.levels]??data.levels}-Level Deck`:activeWrap(data)?'Wrap-Around Deck':`${data.width} × ${data.length} ft Deck`;
  return backyard?`${deck} & Backyard`:deck;
}
/** The line under the cover title: the deck's area, its levels, its decking, and the backyard. */
export function proposalSummary(data:DeckData,areaSqft:number,backyard:boolean):string{
  const material=DECKING_CATALOGUE.find(m=>m.id===data.deckingMaterial)??DECKING_CATALOGUE[0];
  return [`${Math.round(areaSqft)} sq ft of deck`,data.levels>1?`${data.levels} levels`:'one level',`${material.name}, ${data.deckingColor}`,...(backyard?['with a backyard']:[])].join(' · ');
}
/** The running head's title (right of the brand): the cover title, and the customer's name when they gave one. */
export const proposalRunningTitle=(data:DeckData,backyard:boolean)=>[proposalCoverTitle(data,backyard),data.customerName.trim()].filter(Boolean).join(' · ');

export type FeatureGroupId='deck'|'boards'|'railing'|'lighting'|'living'|'house'|'more';
export interface FeatureGroup{id:FeatureGroupId;title:string;items:string[]}
const GROUPS:readonly (readonly [FeatureGroupId,string])[]=[['deck','The deck'],['lighting','Lighting'],['railing','Railing, stairs & privacy'],['boards','Boards, borders & inlays'],['living','Outdoor living'],['house','Your house'],['more','Also in this design']];
/**
 * Which group a fact belongs to, by the words describeDesign (designFacts.ts) writes it in. A fact no rule knows goes
 * under "Also in this design", so nothing is ever dropped.
 */
const FACT_GROUPS:readonly (readonly [FeatureGroupId,RegExp])[]=[
  ['deck',/^[\d.]+ × [\d.]+ ft .*\bdeck\b|^Deck area:|^(Rectangle|L-shape|Two corner cut-outs|Curved front edge|Main deck|Custom outline)\b|^(Second|Third) level |^Wraps |^Attached to the house|^Freestanding/],
  ['boards',/ boards( with \d+ border rows?)?$|^Accent boards:|^Inlays?:|^Deck parts:/],
  ['railing',/ railing · \d+ stair flights?\b|^Railing colour:|^Frameless glass:|^Privacy screens:|^Skirting:/],
  ['lighting',/^Lighting:/],
  ['living',/^Backyard:|^Aluminum pergola:/],
  ['house',/^House |^Exterior \(appearance only/],
];
export const factGroup=(fact:string):FeatureGroupId=>FACT_GROUPS.find(([,rule])=>rule.test(fact))?.[0]??'more';

/**
 * The design's light fixtures by zone, as the estimate counts them (activeLightingItems: the same selection the
 * lighting section prices), with the transformer that runs them.
 */
export function lightingLines(data:DeckData):string[]{
  const items=activeLightingItems(data),fixtures=items.filter(i=>!isSystemProduct(i)),power=items.filter(i=>i.geometry==='transformer');
  const count=(list:typeof items)=>list.map(i=>`${i.qty} × ${i.name}`).join('; ');
  const lines=LIGHTING_ZONES.flatMap(([zone,label])=>{const here=fixtures.filter(i=>i.zone===zone);return here.length?[`${label}: ${count(here)}`]:[];});
  return lines.length&&power.length?[...lines,`Transformer: ${count(power)}`]:lines;
}

/**
 * The lighting and features sheet: describeDesign's facts sorted into groups, the fixtures by zone, the built-ins the
 * design has (pergola, bench, drainage), and the house's exterior line (appearance only) when there is one. Empty
 * groups are left out.
 */
export function proposalFeatures(data:DeckData,facts:readonly string[],exterior?:string|null):FeatureGroup[]{
  const lights=lightingLines(data),byGroup=new Map<FeatureGroupId,string[]>(GROUPS.map(([id])=>[id,[]]));
  for(const fact of [...facts,...(exterior&&!facts.includes(exterior)?[exterior]:[])]){
    const group=factGroup(fact);
    // The fixtures by zone say what the short "Lighting:" fact says, and more.
    if(group==='lighting'&&lights.length)continue;
    byGroup.get(group)!.push(fact);
  }
  byGroup.get('lighting')!.push(...lights);
  const built=[...(data.pergolaSqft>0&&!data.pergola?[`Pergola, ${data.pergolaSqft} sq ft`]:[]),...(data.benchLf>0?[`Built-in bench, ${data.benchLf} ft`]:[]),...(data.hasDrainage?['Under-deck drainage system']:[])];
  byGroup.get('living')!.unshift(...built);
  return GROUPS.flatMap(([id,title])=>{const items=byGroup.get(id)!;return items.length?[{id,title,items}]:[];});
}

/**
 * One finish on the materials board: a real manufacturer colour (its swatch photo, the same file the 3D view and the
 * colour pickers use) and what it is used for. The railing colour has no photo: its chip is the screen colour the 3D
 * view draws, marked as illustrative.
 */
export interface FinishTile{key:string;colour:string;collection:string;uses:string[];swatch?:string;hex?:string;note?:string}
const INLAY_USE={frame:'Inlay frame',inside:'Inlay',band:'Inlay band',medallion:'Medallion'} as const;
const PART_USE={border:'Border',fascia:'Fascia',treads:'Stair treads',risers:'Stair risers'} as const;
export function proposalFinishes(data:DeckData,model:DeckTakeoff):FinishTile[]{
  const tiles=new Map<string,FinishTile>();
  const add=(ref:ColourRef|undefined,use:string)=>{
    const p=ref?parseColourRef(ref):null;if(!p)return;
    const key=`${p.material.id}:${p.color.name}`,tile=tiles.get(key);
    if(tile){if(!tile.uses.includes(use))tile.uses.push(use);}
    else tiles.set(key,{key,colour:p.color.name,collection:p.material.name,uses:[use],swatch:p.color.swatch});
  };
  add(deckColourRef(data),'Decking');
  // Border boards: in their own colour, as Deckorators Dark Slate (its own product), or in the deck's colour.
  const framed=data.pattern==='Picture Frame'&&data.pictureFrameRows>0,dark=darkSlateBorder(data);
  if(framed&&!dark&&!borderFinishRef(data))add(deckColourRef(data),PART_USE.border);
  const plan=data.boardColours?.length||data.inlays?.length||data.deckFinishes?.border?boardFinishPlan(data,model):null;
  for(const group of plan?.stock??[])add(group.ref,group.kind==='accent'?'Accent boards':group.kind==='border'?PART_USE.border:INLAY_USE[group.part??'inside']);
  if(framed&&dark){
    const slate=MANUFACTURER_ACCESSORIES.find(a=>a.id==='dk_dark_slate_border');
    tiles.set('dark-slate',{key:'dark-slate',colour:'Dark Slate',collection:slate?.name??'Deckorators Dark Slate picture-frame board',uses:[PART_USE.border],swatch:slate?.swatch});
  }
  for(const part of DECK_PARTS)if(part!=='border')add(partRef(data,part),PART_USE[part]);
  const skirting=data.skirting?skirtingPlan(data,model):null;
  if(skirting?.runs.length)add(skirting.colour,'Skirting');
  const rail=railingFinish(data);
  if(rail)tiles.set('railing',{key:'railing',colour:rail.colour,collection:rail.system.name,uses:['Railing'],hex:railingScreenHex(rail.system.id,rail.colour),note:'Colour chip illustrative'});
  const glass=model.railing.frameless;
  if(glass)tiles.set('glass-hardware',{key:'glass-hardware',colour:GLASS_FINISH_NAMES[glass.finish],collection:'Frameless glass railing',uses:[glass.mount==='Spigots'?'Glass spigots':'Glass base shoe',...(glass.handrails.length?['Stair handrail']:[])],hex:GLASS_FINISH_HEX[glass.finish],note:'Colour chip illustrative'});
  return [...tiles.values()];
}

/**
 * The investment, laid out over as many Letter sheets as it needs: the priced lines in the engine's order (a line can
 * continue on the next sheet), then the subtotals, HST and total together, then the selections still to be quoted.
 * Heights are generous estimates in inches, measured against the printed sheet (a line is about 0.28 in, and a sheet
 * has about 7.9 in for the schedule), so a sheet never overflows.
 */
export type InvestmentPart={kind:'lines';lines:LedgerLine[]}|{kind:'totals'}|{kind:'quotes';quotes:LedgerQuote[];continued:boolean};
export const INVESTMENT_ROOM=7.5;
export function investmentSheets(ledger:Ledger,room=INVESTMENT_ROOM):InvestmentPart[][]{
  const rows=(text:string,chars:number)=>Math.max(1,Math.ceil(text.length/chars));
  const sheets:InvestmentPart[][]=[[]];let used=0;
  const sheet=()=>sheets[sheets.length-1];
  const fit=(h:number)=>{if(used+h>room&&sheet().length){sheets.push([]);used=0;}used+=h;};
  for(const line of ledger.lines){
    const head=sheet().at(-1)?.kind==='lines'?0:.32;
    fit(head+.29*rows(line.title,88));
    const last=sheet().at(-1);
    if(last?.kind==='lines')last.lines.push(line);else sheet().push({kind:'lines',lines:[line]});
  }
  fit(.36*(3+(ledger.split?2:0))+.55);sheet().push({kind:'totals'});
  let open:Extract<InvestmentPart,{kind:'quotes'}>|null=null;
  for(const quote of ledger.quotes){
    const before=sheets.length;
    // Two columns: an item takes half its own height; the heading comes with the first item on each sheet.
    fit((open?0:.75)+(.21*rows(quoteLabel(quote.label),38)+.04)/2);
    if(!open||sheets.length!==before){if(open)used+=.5;open={kind:'quotes',quotes:[],continued:!!open};sheet().push(open);}
    open.quotes.push(quote);
  }
  return sheets;
}
