import type {DeckData} from './types';
import type {Box,DeckTakeoff,Member} from './deckTakeoff';
import {getStairBoards} from './stairBoards';
import {catalogueAccessoryLayout} from './catalogueAccessories';
import {buildSkirting} from './skirting';

export type BoardFinishOverride={id:string;color:string};
export type BoardInteraction={selectedBoardId?:string;onSelectBoard?:(id:string)=>void};
export type FinishBoardGroup='deck'|'stairs'|'risers'|'fascia'|'skirting';
export type FinishBoard=Box&{id:string;label:string;group:FinishBoardGroup;role?:string};
export const MAX_BOARD_FINISHES=512;
export const FINISH_GROUP_LABELS:Record<FinishBoardGroup,string>={deck:'Deck boards & borders',stairs:'Stair tread boards',risers:'Stair risers',fascia:'Manufacturer fascia',skirting:'Skirting boards'};

/** Coordinates and cut shape, not array position, identify installed pieces. */
export function finishBoardId(group:FinishBoardGroup,box:Box,role=''){
  const n=(v:number)=>Math.round(v*10000)/10000;
  // Canonical vertex order makes cyclic/reversed descriptions of the same cut stable.
  const points=box.polygon?.map(p=>`${n(p.x)},${n(p.y)}`).sort().join(';')??'';
  const source=[group,role,...[box.x,box.y,box.z,box.w,box.h,box.d,box.angle??0].map(n),points].join('|');
  let a=2166136261,b=2246822507;
  for(let i=0;i<source.length;i++){a=Math.imul(a^source.charCodeAt(i),16777619);b=Math.imul(b^source.charCodeAt(i),3266489909);}
  return `bf_${group}_${(a>>>0).toString(16).padStart(8,'0')}${(b>>>0).toString(16).padStart(8,'0')}`;
}

export function validateBoardFinishes(value:unknown):BoardFinishOverride[]{
  if(!Array.isArray(value))return [];
  const result:BoardFinishOverride[]=[],seen=new Set<string>();
  for(const item of value.slice(0,MAX_BOARD_FINISHES)){
    if(!item||typeof item!=='object'||Array.isArray(item))continue;
    const {id,color}=item as Record<string,unknown>;
    if(typeof id!=='string'||!/^bf_(deck|stairs|risers|fascia|skirting)_[a-f0-9]{16}(?:_\d{1,4})?$/.test(id)||typeof color!=='string'||!/^#[a-fA-F0-9]{6}$/.test(color)||seen.has(id))continue;
    seen.add(id);result.push({id,color:color.toUpperCase()});
  }
  return result;
}

function memberBox(m:Member):Box{return {x:(m.a.x+m.b.x)/2,y:(m.a.y+m.b.y)/2,z:(m.a.z+m.b.z)/2,w:Math.hypot(m.b.x-m.a.x,m.b.z-m.a.z),h:m.depth,d:m.width,angle:-Math.atan2(m.b.z-m.a.z,m.b.x-m.a.x)};}

export function getFinishBoards(data:DeckData,model:DeckTakeoff):FinishBoard[]{
  const result:FinishBoard[]=[],seen=new Map<string,number>(),counts=new Map<string,number>();
  function add(box:Box,group:FinishBoardGroup,role=''){
    const base=finishBoardId(group,box,role),duplicate=seen.get(base)??0;seen.set(base,duplicate+1);
    const ordinal=(counts.get(group)??0)+1;counts.set(group,ordinal);
    result.push({...box,id:duplicate?`${base}_${duplicate}`:base,group,role,label:`${FINISH_GROUP_LABELS[group]} ${ordinal}${role?` · ${role.replaceAll('-',' ')}`:''}`});
  }
  for(const l of model.levels)for(const b of l.boards){
    const cut=b as typeof b&{width?:number;polygon?:{x:number;y:number}[];role?:string};
    add({x:b.cx+l.offset.x,y:l.top-.5,z:b.cy+l.offset.z,w:b.length,h:1,d:cut.width??data.boardWidth,angle:-b.angleDeg*Math.PI/180,polygon:cut.polygon?.map(p=>({x:p.x+l.offset.x,y:p.y+l.offset.z}))},'deck',cut.role??'field');
  }
  for(const b of getStairBoards(data,model))add(b,'stairs');
  for(const b of model.riserBoards)add(b,'risers');
  for(const m of catalogueAccessoryLayout(data,model).fascia)add(memberBox(m),'fascia','catalogue-fascia');
  for(const b of buildSkirting(data,model).boards)add(b,'skirting',b.role);
  return result;
}

export function boardFinishStatus(data:DeckData,model:DeckTakeoff){
  const boards=getFinishBoards(data,model),ids=new Set(boards.map(b=>b.id)),overrides=validateBoardFinishes(data.boardFinishes);
  return {boards,overrides,matched:overrides.filter(o=>ids.has(o.id)),unmatched:overrides.filter(o=>!ids.has(o.id))};
}

/** R3F's click delta distinguishes a board pick from an orbit drag. */
export function isFinishBoardClick(delta:number){return Number.isFinite(delta)&&delta<=4&&delta>=0;}
