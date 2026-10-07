import type {DeckTakeoff} from './deckTakeoff';
import {STOCK_TRIM_IN} from './deckingStock';
export type StockBin={lengthIn:number;cutsIn:number[];usedIn:number;offcutIn:number};
/** Board lengths a product is bought in (ascending) and the end-trim margin each board keeps (deckingStock.productStock). */
export type ProductStock={lengthsIn:number[];trimIn:number};
/** First-fit decreasing cut schedule with a real saw kerf. Never treats an oversize cut as free. */
export function planStock(cuts:number[],stockIn:number,kerfIn=.125){
  if(!Number.isFinite(stockIn)||stockIn<=0||kerfIn<0)throw new Error('Invalid stock dimensions');
  const bins:StockBin[]=[],unresolved:number[]=[];
  for(const cut of [...cuts].sort((a,b)=>b-a)){
    if(!Number.isFinite(cut)||cut<=0)throw new Error('Invalid cut length');
    if(cut>stockIn+1e-6){unresolved.push(cut);continue;}
    let bin=bins.find(b=>b.usedIn+cut+kerfIn<=stockIn+1e-6);
    if(!bin){bin={lengthIn:stockIn,cutsIn:[],usedIn:0,offcutIn:stockIn};bins.push(bin);}
    bin.usedIn+=(bin.cutsIn.length?kerfIn:0)+cut;bin.cutsIn.push(cut);bin.offcutIn=Math.max(0,stockIn-bin.usedIn);
  }
  return {bins,unresolved,purchasedLf:bins.length*stockIn/12,installedLf:cuts.reduce((n,c)=>n+c,0)/12,offcutLf:bins.reduce((n,b)=>n+b.offcutIn,0)/12};
}
/** The takeoff's main product stock: its listed lengths with the trim margin when it lists more than one (2026-10 rules). */
export const takeoffStock=(model:DeckTakeoff):ProductStock|undefined=>{const lengths=(model as DeckTakeoff&{stockLengths?:number[]}).stockLengths;return lengths&&lengths.length>1?{lengthsIn:lengths,trimIn:STOCK_TRIM_IN}:undefined;};
/** One legacy length with no trim margin: the exact single-length path every saved (legacy) design was quoted with. */
const singleLength=(stock:ProductStock|undefined,fallbackIn:number)=>!stock||(stock.trimIn===0&&new Set(stock.lengthsIn).size===1)?stock?.lengthsIn[0]??fallbackIn:null;
/**
 * Buy cuts from a product's listed board lengths: pack them at each listed size, buy each packed board at the
 * SHORTEST listed length that holds its cuts with the trim margin, and keep the plan that orders the fewest final
 * linear feet once the waste-allowance spares (shortest length) are added. A cut no listed length holds stays
 * unresolved, never free.
 */
export function orderListedStock(cuts:number[],allowanceLf:number,stock:ProductStock,kerfIn=.125){
  const sizes=[...new Set(stock.lengthsIn)].sort((a,b)=>a-b),trim=stock.trimIn,unit=sizes[0];
  if(!sizes.length||sizes.some(n=>!(n-trim>0)))throw new Error('Invalid stock dimensions');
  let best:(ReturnType<typeof planStock>&{orderedBoards:number;spareBoards:number;orderedLf:number;spareLengthIn:number})|undefined;
  // Longest size first: on a tie the plan with fewer, longer boards (fewer pieces to handle) is kept.
  for(const size of [...sizes].reverse()){
    const p=planStock(cuts,size-trim,kerfIn);
    const bins=p.bins.map(b=>{const lengthIn=sizes.find(n=>n-trim+1e-6>=b.usedIn)??size;return {...b,lengthIn,offcutIn:Math.max(0,lengthIn-b.usedIn)};});
    const purchasedLf=bins.reduce((n,b)=>n+b.lengthIn,0)/12,spareBoards=Math.max(0,Math.ceil((allowanceLf-purchasedLf)/(unit/12)-1e-9));
    const plan={...p,bins,purchasedLf,offcutLf:bins.reduce((n,b)=>n+b.offcutIn,0)/12,orderedBoards:bins.length+spareBoards,spareBoards,orderedLf:purchasedLf+spareBoards*unit/12,spareLengthIn:unit};
    if(!best||plan.unresolved.length<best.unresolved.length||plan.unresolved.length===best.unresolved.length&&plan.orderedLf<best.orderedLf-1e-9)best=plan;
  }
  return best!;
}
/** `stock` defaults to the takeoff's main product: its listed lengths (model.stockLengths, present only when the product
 * lists more than one, always with the trim margin) or the one legacy stock length. */
export function deckBoardStock(model:DeckTakeoff,wasteFactor:number,stock:ProductStock|undefined=takeoffStock(model)){
  const cuts=model.levels.flatMap(l=>l.boards.map(b=>b.length)),length=singleLength(stock,model.stockLength);
  if(length===null){const installedLf=cuts.reduce((n,c)=>n+c,0)/12;return orderListedStock(cuts,installedLf*Math.max(1,wasteFactor),stock!);}
  const plan=planStock(cuts,length);
  // Existing Deck Craft Pro waste factors remain the allowance source. Cut waste
  // already in the packing plan is not charged a second time.
  const minimumWithAllowance=Math.ceil(plan.installedLf*Math.max(1,wasteFactor)/(length/12));
  const orderedBoards=Math.max(plan.bins.length,minimumWithAllowance);
  return {...plan,orderedBoards,spareBoards:orderedBoards-plan.bins.length,orderedLf:orderedBoards*length/12,spareLengthIn:length};
}
