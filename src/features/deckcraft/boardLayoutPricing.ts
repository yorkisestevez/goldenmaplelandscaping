import type {DeckData} from './types';
import type {DeckTakeoff} from './deckTakeoff';
import type {BoardRun} from './lib/deckGeometry';
import {deckBoardStock,orderListedStock,planStock,takeoffStock,type ProductStock} from './stockPlan';
import {PATTERN_LABOUR} from './lib/inlayGeometry';

/** Planning bases already used by DeckCraft: full 5.5 in stock, the diagonal laying factor,
 * and breaker fitting at 1.5 crew-hours per 10 LF / 8 planning hours per crew-day. */
export const BOARD_LAYOUT_POLICY={stockWidthIn:5.5,fitHoursPer10Lf:1.5,planningHoursPerDay:8} as const;
export const BOARD_LAYOUT_SUPPORT_QUOTE='Custom board-layout supports, fastening and construction review';
type StockSource={cx:number;cy:number;lengthIn:number;widthIn:number;angleDeg:number};
type LayoutRun=BoardRun&{layoutId?:string;layoutKind?:'region'|'breaker'|'piece';layoutSource?:StockSource;layoutStockId?:string;layoutStockSource?:StockSource};
type LayoutLevel=DeckTakeoff['levels'][number]&{layoutBreakers?:{id:string;lengthIn?:number;segments?:{lengthIn:number}[]}[]};
export function hasBoardLayout(data:DeckData):boolean{
  const layout=(data as DeckData&{boardLayout?:{regions?:unknown[];breakers?:unknown[];pieces?:unknown[]}}).boardLayout;
  return !!layout&&(!!layout.regions?.length||!!layout.breakers?.length||!!layout.pieces?.length);
}
/** `stock` is the product's listed lengths (deckingStock.productStock); it defaults to the takeoff's main product. */
export function layoutBoardStock(data:DeckData,model:DeckTakeoff,wasteFactor:number,layoutWaste?:{straight:number;diagonal:number},completeModel:DeckTakeoff=model,stock:ProductStock|undefined=takeoffStock(model)){
  if(!hasBoardLayout(data))return deckBoardStock(model,wasteFactor,stock);
  const cuts:number[]=[],seen=new Set<string>();let allowanceIn=0;
  const pieceCounts=(m:DeckTakeoff)=>{const count=new Map<string,number>();m.levels.forEach((l,li)=>l.boards.forEach(raw=>{const b=raw as LayoutRun;if(b.layoutKind==='piece'&&b.layoutId){const key=`${li}:${b.layoutId}`;count.set(key,(count.get(key)??0)+1);}}));return count;};
  const complete=pieceCounts(completeModel),included=pieceCounts(model);
  const intervals=new Map<string,{cuts:[number,number][];factor:number}>();
  model.levels.forEach((level,li)=>level.boards.forEach(raw=>{
    const b=raw as LayoutRun;
    const angle=((b.angleDeg%180)+180)%180,axis=Math.abs(angle)<1e-7||Math.abs(angle-90)<1e-7;
    const factor=b.layoutId&&layoutWaste?(axis?layoutWaste.straight:layoutWaste.diagonal):wasteFactor;
    if(b.layoutKind==='piece'&&b.layoutId&&b.layoutSource&&included.get(`${li}:${b.layoutId}`)===complete.get(`${li}:${b.layoutId}`)){
      const key=`${li}:${b.layoutId}`;if(seen.has(key))return;seen.add(key);
      // Buy the requested rectangle once, even when clipping leaves several polygons or a stock-length joint.
      let remaining=b.layoutSource.lengthIn;while(remaining>1e-7){const length=Math.min(remaining,model.stockLength);cuts.push(length);allowanceIn+=length*Math.max(1,factor);remaining-=length;}
    }else {
      const source=b.layoutStockSource??(b.layoutKind==='piece'?b.layoutSource:undefined),stockId=b.layoutStockId??(b.layoutKind==='piece'?b.layoutId:undefined);
      if(source&&stockId){
        const a=source.angleDeg*Math.PI/180,c=Math.cos(a),s=Math.sin(a),center=source.cx*c+source.cy*s;
        const projected=b.polygon?.map(p=>p.x*c+p.y*s)??[b.cx*c+b.cy*s-b.length/2,b.cx*c+b.cy*s+b.length/2];
        const lo=Math.max(center-source.lengthIn/2,Math.min(...projected)),hi=Math.min(center+source.lengthIn/2,Math.max(...projected));
        if(hi-lo>1e-7){const key=`${li}:${stockId}`,group=intervals.get(key)??{cuts:[],factor};group.cuts.push([lo,hi]);group.factor=Math.max(group.factor,factor);intervals.set(key,group);}
      }else {cuts.push(b.length);allowanceIn+=b.length*Math.max(1,factor);}
    }
  }));
  for(const group of intervals.values()){
    const merged:[number,number][]=[];
    for(const cut of group.cuts.sort((a,b)=>a[0]-b[0])){const last=merged.at(-1);if(last&&cut[0]<=last[1]+1e-5)last[1]=Math.max(last[1],cut[1]);else merged.push([...cut]);}
    for(const [lo,hi] of merged){let remaining=hi-lo;while(remaining>1e-7){const length=Math.min(remaining,model.stockLength);cuts.push(length);allowanceIn+=length*Math.max(1,group.factor);remaining-=length;}}
  }
  // Listed lengths: each packed board is bought at the shortest length that holds it (the legacy single length is unchanged).
  if(stock&&(stock.trimIn>0||new Set(stock.lengthsIn).size>1))return orderListedStock(cuts,allowanceIn/12,stock);
  const plan=planStock(cuts,model.stockLength),minimum=Math.ceil(allowanceIn/model.stockLength);
  const orderedBoards=Math.max(plan.bins.length,minimum);
  return {...plan,orderedBoards,spareBoards:orderedBoards-plan.bins.length,orderedLf:orderedBoards*model.stockLength/12,spareLengthIn:model.stockLength};
}
const runArea=(b:LayoutRun,width:number)=>b.polygon?.length?Math.abs(b.polygon.reduce((n,p,i,a)=>{const q=a[(i+1)%a.length];return n+p.x*q.y-q.x*p.y;},0))/288:b.length*(b.width??width)/144;
/** Surviving automatic breaker stock, after a custom layout carves its original boards. */
export function layoutAutomaticBreakerLf(model:DeckTakeoff):number{
  const groups=new Map<string,[number,number][]>();
  model.levels.forEach((l,li)=>l.boards.forEach((b,bi)=>{
    if(b.role!=='breaker'||b.layoutKind)return;
    const source=b.layoutStockSource,a=(source?.angleDeg??b.angleDeg)*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
    const coordinates=b.polygon?.map(p=>p.x*c+p.y*s)??[b.cx*c+b.cy*s-b.length/2,b.cx*c+b.cy*s+b.length/2];
    const key=`${li}:${b.layoutStockId??bi}`,spans=groups.get(key)??[];
    spans.push([Math.min(...coordinates),Math.max(...coordinates)]);groups.set(key,spans);
  }));
  let inches=0;
  for(const spans of groups.values()){
    let lo=0,hi=0,first=true;
    for(const [a,b] of spans.sort((x,y)=>x[0]-y[0])){if(first){lo=a;hi=b;first=false;}else if(a<=hi+1e-5)hi=Math.max(hi,b);else{inches+=hi-lo;lo=a;hi=b;}}
    if(!first)inches+=hi-lo;
  }
  return inches/12;
}
export function boardLayoutAllowance(data:DeckData,model:DeckTakeoff,deckingSqftPerDay:number){
  const baseFactor=PATTERN_LABOUR[data.pattern]??1;
  let areaSqft=0,directionDays=0,breakerLf=0,pieceEndLf=0,pieces=0;
  const seenPieces=new Set<string>(),directions=new Set<number>();
  model.levels.forEach((rawLevel,li)=>{
    const level=rawLevel as LayoutLevel;
    breakerLf+=(level.layoutBreakers??[]).reduce((n,b)=>n+(b.lengthIn??b.segments?.reduce((s,p)=>s+p.lengthIn,0)??0)/12,0);
    level.boards.forEach(raw=>{
      const b=raw as LayoutRun;if(!b.layoutId)return;
      const a=((b.angleDeg%180)+180)%180;
      if(b.layoutKind!=='breaker'){
        const area=runArea(b,data.boardWidth),factor=Math.abs(a)<1e-7||Math.abs(a-90)<1e-7?1:PATTERN_LABOUR.Diagonal;
        areaSqft+=area;directionDays+=area/deckingSqftPerDay*(factor/baseFactor-1);directions.add(Math.round(a*1e4)/1e4);
      }
      if(b.layoutKind==='piece'&&b.layoutSource){
        const key=`${li}:${b.layoutId}`;if(seenPieces.has(key))return;seenPieces.add(key);pieces++;
        pieceEndLf+=Math.ceil(b.layoutSource.lengthIn/model.stockLength)*2*b.layoutSource.widthIn/12;
      }
    });
  });
  const fittingDays=(breakerLf+pieceEndLf)/10*BOARD_LAYOUT_POLICY.fitHoursPer10Lf/BOARD_LAYOUT_POLICY.planningHoursPerDay;
  return {areaSqft,directionDays,fittingDays,crewDays:directionDays+fittingDays,breakerLf,pieceEndLf,pieces,directions:[...directions].sort((a,b)=>a-b)};
}
export function boardLayoutWords(data:DeckData,model:DeckTakeoff):string[]{
  if(!hasBoardLayout(data))return [];
  const allowance=boardLayoutAllowance(data,model,320),regions=new Set(model.levels.flatMap(l=>l.boards.filter(b=>b.layoutKind==='region').map(b=>`${l.index}:${b.layoutId}`)));
  return [`Custom board layout: ${regions.size} placed directional area(s), ${allowance.breakerLf.toFixed(1)} LF of placed breaker boards and ${allowance.pieces} inserted board rectangle(s)${allowance.directions.length?`; directions ${allowance.directions.map(a=>`${a}°`).join(', ')}`:''}.`,
    'Layout purchasing includes full-width stock, requested inserted rectangles, actual stock-length joints and the cut/waste allowance. Direction and fitting labour are planning allowances on the existing crew-day basis; supports, fasteners and installation details require builder review.'];
}
