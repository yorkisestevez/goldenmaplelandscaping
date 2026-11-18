import {FASCIA_RETAIL_RATES} from './supplierRates';
import {planStock} from './stockPlan';
/** Stock-priced supply only. Tall/triangular faces are allowed rectangular blanks;
 * splitting long runs into stock pieces requires the builder to detail the joints.
 * No installation, fastener-pack or delivery price is invented. */
export function fasciaSupply(colour:string,faces:{lengthIn:number;heightIn:number}[],markup:number){
  const rate=FASCIA_RETAIL_RATES[colour];if(!rate)return null;
  const cuts:number[]=[];
  for(const face of faces){
    const rows=Math.ceil(Math.max(0,face.heightIn)/rate.heightIn);
    for(let row=0;row<rows;row++){let length=face.lengthIn;while(length>rate.stockIn){cuts.push(rate.stockIn);length-=rate.stockIn;}if(length>0)cuts.push(length);}
  }
  const stock=planStock(cuts,rate.stockIn),boards=Math.max(stock.bins.length,Math.ceil(stock.installedLf*1.10/(rate.stockIn/12)));
  return {boards,cost:boards*rate.boardPrice*markup,rate,installedLf:stock.installedLf};
}
