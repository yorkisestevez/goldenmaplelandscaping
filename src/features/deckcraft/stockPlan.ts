import type {DeckTakeoff} from './deckTakeoff';
export type StockBin={lengthIn:number;cutsIn:number[];usedIn:number;offcutIn:number};
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
export function deckBoardStock(model:DeckTakeoff,wasteFactor:number){
  const cuts=model.levels.flatMap(l=>l.boards.map(b=>b.length));
  const plan=planStock(cuts,model.stockLength);
  // Existing Deck Craft Pro waste factors remain the allowance source. Cut waste
  // already in the packing plan is not charged a second time.
  const minimumWithAllowance=Math.ceil(plan.installedLf*Math.max(1,wasteFactor)/(model.stockLength/12));
  const orderedBoards=Math.max(plan.bins.length,minimumWithAllowance);
  return {...plan,orderedBoards,spareBoards:orderedBoards-plan.bins.length,orderedLf:orderedBoards*model.stockLength/12};
}
