import {boardFinishPlan,deckColourRef,MAX_BOARD_COLOURS} from './boardFinishes';
import type {DeckTakeoff} from './deckTakeoff';
import type {BoardAddress} from './lib/boardAddress';
import type {BoardColour,ColourRef,DeckData} from './types';

/**
 * The accent-board tool's actions and wording (boardFinishes.ts resolves and prices the colours). Loaded with the
 * accent-board panel, not with the page: nothing here is needed until someone paints a board.
 */
const sameRow=(o:BoardColour,a:{lv:number;role:string;course:string})=>o.lv===a.lv&&o.role===a.role&&o.course===a.course;
const spans=(o:BoardColour,a:BoardAddress)=>o.at!==undefined&&o.at>=a.from-.01&&o.at<=a.to+.01;

/**
 * Paint one board (or its row) and return the new list. Painting a row clears the single-board choices in it;
 * painting a board the colour it already has underneath (its row's, or the deck's) just removes its choice.
 * Returns null when the list is full.
 */
export function paintAddress(data:DeckData,address:BoardAddress,colour:ColourRef,scope:'piece'|'course'):BoardColour[]|undefined|null{
  const list=data.boardColours??[],main=deckColourRef(data);
  let next:BoardColour[];
  if(scope==='course'&&address.rowPaint){
    next=list.filter(o=>!sameRow(o,address));
    if(colour!==main)next.push({lv:address.lv,role:address.role,scope:'course',course:address.course,colour});
  }else{
    next=list.filter(o=>!(o.scope==='piece'&&sameRow(o,address)&&spans(o,address)));
    const row=list.filter(o=>o.scope==='course'&&sameRow(o,address)).at(-1)?.colour??main;
    if(colour!==row)next.push({lv:address.lv,role:address.role,scope:'piece',course:address.course,at:Math.round(address.at*2)/2,colour});
  }
  if(next.length>MAX_BOARD_COLOURS)return null;
  return next.length?next:undefined;
}
/** Paint the board at a model level and index; see paintAddress. */
export function paintBoard(data:DeckData,model:DeckTakeoff,target:{level:number;index:number},colour:ColourRef,scope:'piece'|'course'){
  const address=boardFinishPlan(data,model).addresses[target.level]?.[target.index];
  if(!address)return {error:'That board takes no accent colour.'};
  const next=paintAddress(data,address,colour,address.rowPaint?scope:'piece');
  return next===null?{error:`Up to ${MAX_BOARD_COLOURS} accent choices fit in one design. Paint whole rows, or clear some boards first.`}:{boardColours:next};
}

const SIDES:Record<string,string>={f:'front',b:'back',l:'left',r:'right',fl:'front-left',fr:'front-right',bl:'back-left',br:'back-right'};
/** Plain words for where a saved choice is, e.g. "Row 5 from the house" or "One board in breaker 1". */
export function describeBoardPlace(o:Pick<BoardColour,'lv'|'role'|'scope'|'course'>):string{
  const level=o.lv>1?`Level ${o.lv}: `:'';
  let place:string;
  const row=/^r(\d+)$/.exec(o.course),breaker=/^k(\d+)$/.exec(o.course),border=/^e(\d+)\.([a-z]+)(\d+)$/.exec(o.course);
  if(row)place=`row ${Number(row[1])+1} from the house`;
  else if(breaker)place=`breaker ${Number(breaker[1])+1} from the left`;
  else if(border)place=`${border[1]==='0'?'outer':'inner'} border row, ${SIDES[border[2]]??'side'} edge${border[3]!=='0'?` ${Number(border[3])+1}`:''}`;
  else if(o.course.startsWith('h'))place='a herringbone board';
  else if(o.course.startsWith('a45')||o.course.startsWith('a135'))place='a diagonal row';
  else place=o.role==='border'?'a border board':'a row of boards';
  const text=o.scope==='piece'&&!o.course.startsWith('h')?`one board in ${place}`:place;
  return level+text.charAt(0).toUpperCase()+text.slice(1);
}
