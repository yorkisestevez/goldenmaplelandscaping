import {useEffect,useMemo,useRef,useState,type PointerEvent,type RefObject} from 'react';
import {createPortal} from 'react-dom';
import type {PlanFrame} from '../ConstructionPlan';
import {colourRef,deckColourRef,partCollections} from '../boardFinishes';
import type {DeckTakeoff} from '../deckTakeoff';
import type {PlanPoint} from '../lib/deckGeometry';
import type {BoardLayoutRegion,BoardLayoutBreaker,BoardLayoutPiece,DeckData} from '../types';
import type {Update} from './fields';
import {editSelectedBoard,emptyBoardLayout,layoutId,selectableBoards,type SelectableBoard} from './boardLayoutActions';
import {editBoardBatch} from './boardBatchActions';
import {deleteSelectedBoards} from './boardRemovalActions';
import {parseDeckReleaseDesign} from '../deckRelease';
import {signedArea} from '../lib/polygonCuts';
import './boardLayoutEditor.css';

type Mode='board'|'area'|'breaker';
type Saved={kind:'regions'|'breakers'|'pieces';id:string};
type Draft={polygon?:PlanPoint[];start?:PlanPoint;end?:PlanPoint};
type Gesture={pointer:number;start:PlanPoint;points:PlanPoint[];moved:boolean};
const round=(v:number)=>Math.round(v*1000)/1000;
const pointsText=(points:PlanPoint[])=>points.map(p=>`${p.x},${p.y}`).join(' ');
/** Retain corners while limiting a freehand selection to the persisted polygon budget. */
function simplify(points:PlanPoint[]):PlanPoint[]{
  let out=points.filter((p,i)=>!i||Math.hypot(p.x-points[i-1].x,p.y-points[i-1].y)>.25);
  if(out.length>1&&Math.hypot(out[0].x-out.at(-1)!.x,out[0].y-out.at(-1)!.y)<.5)out.pop();
  while(out.length>64){let at=1,best=Infinity;for(let i=0;i<out.length;i++){const a=out[(i+out.length-1)%out.length],b=out[i],c=out[(i+1)%out.length],error=Math.abs((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x));if(error<best){best=error;at=i;}}out=out.filter((_,i)=>i!==at);}
  return out;
}
export default function BoardLayoutEditor({data,model,update,viewportFrame,toolbar,onStatus,requestedLevel=1,selection,onSelectionChange,controlsOnly=false}:{data:DeckData;model:DeckTakeoff;update:Update;viewportFrame:PlanFrame;toolbar?:RefObject<HTMLElement|null>;onStatus?:(message:string)=>void;requestedLevel?:1|2|3;selection?:{level:number;index:number}[];onSelectionChange?:(boards:{level:number;index:number}[])=>void;controlsOnly?:boolean}){
  const all=useMemo(()=>selectableBoards(data,model),[data,model]);
  const levels=[...new Set(all.map(b=>b.level))];
  const [level,setLevel]=useState<1|2|3>(1),[mode,setMode]=useState<Mode>('board'),[free,setFree]=useState(false);
  const [selected,setSelected]=useState<{modelLevel:number;index:number}|null>(null),[saved,setSaved]=useState<Saved|null>(null);
  const [many,setMany]=useState<{level:number;index:number}[]>([]),[multi,setMulti]=useState(false),[boardFilter,setBoardFilter]=useState(''),[batchField,setBatchField]=useState('both'),[review,setReview]=useState('');
  const [draft,setDraft]=useState<Draft|null>(null),[angle,setAngle]=useState('90'),[colour,setColour]=useState(''),[notice,setNotice]=useState('');
  const reviewKey=JSON.stringify([many,angle,colour,batchField]),liveReview=useRef({data,key:reviewKey}),reviewed=useRef<{data:DeckData;key:string;patch:Partial<DeckData>}|null>(null),previousData=useRef(data);liveReview.current={data,key:reviewKey};
  const svg=useRef<SVGSVGElement>(null),controlsElement=useRef<HTMLDivElement>(null),gesture=useRef<Gesture|null>(null),previousRequestedLevel=useRef(requestedLevel);
  const boardTap=useRef<{pointer:number;x:number;y:number;index:number;modelLevel:number}|null>(null);
  const controlTap=useRef<{pointer:number;x:number;y:number;button:HTMLButtonElement}|null>(null);
  const activePointers=useRef(new Set<number>()),consumedTargets=useRef(new WeakSet<EventTarget>());
  const activeLevel=levels.includes(level)?level:levels[0]??1,boards=all.filter(b=>b.level===activeLevel);
  const chosen=all.find(b=>b.modelLevel===selected?.modelLevel&&b.index===selected.index);
  const layout=data.boardLayout??emptyBoardLayout(),collections=partCollections(data);
  const savedItem=saved?layout[saved.kind].find(p=>p.id===saved.id):undefined;
  const inactiveSaved=!!savedItem&&!levels.includes(savedItem.level);
  const deletion=useMemo(()=>{if(!many.length)return null;try{return {...deleteSelectedBoards(data,model,many,layoutId),error:''};}catch(e){return {patch:null,message:'',frameBoards:0,error:e instanceof Error?e.message:'Select the added board again.'};}},[data,model,many]);
  const announce=(message:string)=>{setNotice(message);onStatus?.(message);};
  const cancel=()=>{gesture.current=null;boardTap.current=null;controlTap.current=null;setDraft(null);};
  useEffect(()=>{
    const start=(event:globalThis.PointerEvent)=>{if(!activePointers.current.size||event.pointerType==='mouse')consumedTargets.current=new WeakSet();activePointers.current.add(event.pointerId);if(activePointers.current.size>1){boardTap.current=null;controlTap.current=null;}};
    const end=(event:globalThis.PointerEvent)=>{activePointers.current.delete(event.pointerId);};
    const reset=()=>{activePointers.current.clear();boardTap.current=null;controlTap.current=null;};
    document.addEventListener('pointerdown',start,true);document.addEventListener('pointerup',end,true);document.addEventListener('pointercancel',end,true);window.addEventListener('blur',reset);
    return()=>{document.removeEventListener('pointerdown',start,true);document.removeEventListener('pointerup',end,true);document.removeEventListener('pointercancel',end,true);window.removeEventListener('blur',reset);};
  },[]);
  useEffect(()=>{if(previousData.current===data)return;previousData.current=data;cancel();setSelected(null);setMany([]);onSelectionChange?.([]);setReview('');setSaved(null);},[data]);
  useEffect(()=>{if(previousRequestedLevel.current!==requestedLevel){previousRequestedLevel.current=requestedLevel;cancel();setBoards([]);setSaved(null);}setLevel(requestedLevel);},[requestedLevel]);
  const world=(p:PlanPoint)=>{const offset=boards[0]?.offset??{x:0,y:0};return {x:p.x+offset.x,y:p.y+offset.y};};
  const local=(e:PointerEvent<SVGSVGElement>)=>{const matrix=svg.current?.getScreenCTM();if(!matrix)return null;const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse()),o=boards[0]?.offset??{x:0,y:0};return {x:round(p.x-o.x),y:round(p.y-o.y)};};
  const setBoards=(next:{level:number;index:number}[])=>{setMany(next);onSelectionChange?.(next);const last=next.at(-1);setSelected(last?{modelLevel:last.level,index:last.index}:null);setReview('');};
  const reviewBoards=()=>{try{if(!angle.trim())throw new Error('Enter a board direction.');const patch=editBoardBatch(data,model,many,{...(batchField!=='colour'?{angleDeg:Number(angle)}:{}),...(batchField!=='direction'?{colour:colour||deckColourRef(data)}:{})},layoutId),key=reviewKey;void import('./editPricePreview').then(m=>m.editPricePreview(data,patch)).then(message=>{if(liveReview.current.data===data&&liveReview.current.key===key){reviewed.current={data,key,patch};setReview(message);}}).catch(e=>announce(e.message));}catch(e){announce(e instanceof Error?e.message:'The batch is invalid.');}};
  useEffect(()=>{if(!selection||JSON.stringify(selection)===JSON.stringify(many))return;const next=selection.filter(t=>all.some(b=>b.modelLevel===t.level&&b.index===t.index));setMany(next);const last=next.at(-1);setSelected(last?{modelLevel:last.level,index:last.index}:null);const b=last&&all.find(b=>b.modelLevel===last.level&&b.index===last.index);if(b){setLevel(b.level);setAngle(String(b.run.layoutSource?.angleDeg??b.run.angleDeg));setColour(b.colour);}setReview('');},[selection]);
  const selectBoard=(board:SelectableBoard,toggle=false,range=false)=>{cancel();setSaved(null);const t={level:board.modelLevel,index:board.index};let next=[t];if(range&&chosen?.modelLevel===board.modelLevel)next=[...many,...boards.filter(b=>b.index>=Math.min(chosen.index,board.index)&&b.index<=Math.max(chosen.index,board.index)).map(b=>({level:b.modelLevel,index:b.index}))];else if(toggle||multi)next=many.some(b=>b.level===t.level&&b.index===t.index)?many.filter(b=>b.level!==t.level||b.index!==t.index):[...many,t];setBoards(next.filter((b,i,a)=>a.findIndex(v=>v.level===b.level&&v.index===b.index)===i));setAngle(String(board.run.layoutSource?.angleDeg??board.run.angleDeg));setColour(board.colour);announce(`Board ${board.index+1} selected. Set its direction or colour, then apply.`);};
  const boardAtPointer=(e:PointerEvent<SVGPolygonElement>)=>{const hit=document.elementFromPoint(e.clientX,e.clientY)?.closest('.dd-board-hit');if(!hit||!svg.current?.contains(hit))return null;return {element:hit,board:boards.find(b=>b.index===Number(hit.getAttribute('data-board-index'))&&b.level===Number(hit.getAttribute('data-level')))};};
  // Touch browsers may retarget narrow stock to its neighbour; use the physical hit instead.
  const tapStart=(e:PointerEvent<SVGPolygonElement>)=>{if(e.pointerType==='mouse')return;consumedTargets.current.add(e.currentTarget);const hit=boardAtPointer(e);if(hit)consumedTargets.current.add(hit.element);const board=hit?.board;if(!board||!e.isPrimary||e.button!==0||activePointers.current.size!==1){boardTap.current=null;return;}boardTap.current={pointer:e.pointerId,x:e.clientX,y:e.clientY,index:board.index,modelLevel:board.modelLevel};};
  const tapEnd=(e:PointerEvent<SVGPolygonElement>)=>{const tap=boardTap.current;boardTap.current=null;const board=boardAtPointer(e)?.board;if(!board||!tap||tap.pointer!==e.pointerId||tap.index!==board.index||tap.modelLevel!==board.modelLevel||Math.hypot(e.clientX-tap.x,e.clientY-tap.y)>8)return;e.preventDefault();selectBoard(board,e.ctrlKey||e.metaKey,e.shiftKey);svg.current?.focus({preventScroll:true});};
  const selectSaved=(kind:Saved['kind'],item:BoardLayoutRegion|BoardLayoutBreaker|BoardLayoutPiece)=>{
    cancel();setBoards([]);setLevel(item.level);setSaved({kind,id:item.id});setColour(item.colour??'');
    if(kind==='regions'){const r=item as BoardLayoutRegion;setMode('area');setDraft({polygon:r.polygon});setAngle(String(r.angleDeg));}
    else if(kind==='breakers'){const b=item as BoardLayoutBreaker;setMode('breaker');setDraft({start:b.start,end:b.end});}
    else{const p=item as BoardLayoutPiece;setMode('board');setAngle(String(p.angleDeg));}
    announce('Saved layout selected. Change its settings or remove it.');
  };
  const down=(e:PointerEvent<SVGSVGElement>)=>{
    if(mode==='board'||e.button!==0)return;const p=local(e);if(!p)return;
    e.preventDefault();e.currentTarget.focus({preventScroll:true});e.currentTarget.setPointerCapture(e.pointerId);setSelected(null);setSaved(null);
    gesture.current={pointer:e.pointerId,start:p,points:[p],moved:false};setDraft(mode==='breaker'?{start:p,end:p}:{polygon:[p,p,p,p]});
  };
  const move=(e:PointerEvent<SVGSVGElement>)=>{
    const tap=boardTap.current;if(tap?.pointer===e.pointerId&&Math.hypot(e.clientX-tap.x,e.clientY-tap.y)>8)boardTap.current=null;
    const g=gesture.current;if(!g||g.pointer!==e.pointerId)return;const p=local(e);if(!p)return;e.preventDefault();g.moved||=Math.hypot(p.x-g.start.x,p.y-g.start.y)>.25;
    if(mode==='breaker')setDraft({start:g.start,end:p});
    else if(free){const last=g.points.at(-1)!;if(Math.hypot(p.x-last.x,p.y-last.y)>.5)g.points.push(p);setDraft({polygon:simplify([...g.points,p])});}
    else setDraft({polygon:[g.start,{x:p.x,y:g.start.y},p,{x:g.start.x,y:p.y}]});
  };
  const up=(e:PointerEvent<SVGSVGElement>)=>{const g=gesture.current;if(!g||g.pointer!==e.pointerId)return;move(e);gesture.current=null;if(!g.moved){setDraft(null);announce('Drag to draw your selection.');}else announce(mode==='breaker'?'Breaker preview ready. Apply to cut it into the board layout.':'Area selected. Choose its board direction, then apply.');};
  const apply=()=>{
    try{
      let patch:Partial<DeckData>;
      if(mode==='board'){
        const degrees=Number(angle);if(!angle.trim()||!Number.isFinite(degrees))throw new Error('Enter a board direction in degrees.');
        if(saved?.kind==='pieces'&&savedItem){const p=savedItem as BoardLayoutPiece;patch={boardLayout:{...layout,pieces:layout.pieces.map(v=>v.id===p.id?{...p,angleDeg:degrees,...(colour?{colour}:{colour:undefined})}:v)}};}
        else {if(!chosen)throw new Error('Click a board on the plan first.');if(many.length>1){if(!review||reviewed.current?.data!==data||reviewed.current.key!==reviewKey)throw new Error('Review the priced portion and outstanding quotes before applying this batch.');patch=reviewed.current.patch;}else patch=editSelectedBoard(data,model,chosen,degrees,colour||deckColourRef(data),layoutId());}
      }else if(mode==='area'){
        const degrees=Number(angle);if(!angle.trim()||!Number.isFinite(degrees))throw new Error('Enter a board direction in degrees.');
        if(!draft?.polygon||draft.polygon.length<3)throw new Error('Select an area on the deck first.');
        const polygon=simplify(draft.polygon);if(signedArea(polygon)<0)polygon.reverse();
        const region:BoardLayoutRegion={id:saved?.kind==='regions'?saved.id:layoutId(),level:savedItem?.level??activeLevel,polygon,angleDeg:degrees,...(colour?{colour}:{}),...(saved?.kind==='regions'&&(savedItem as BoardLayoutRegion)?.replaceBorder?{replaceBorder:true}:{})};
        patch={boardLayout:{...layout,regions:saved?.kind==='regions'?layout.regions.map(r=>r.id===saved.id?region:r):[...layout.regions,region]}};
      }else{
        if(!draft?.start||!draft.end)throw new Error('Draw the breaker board on the deck first.');
        const breaker:BoardLayoutBreaker={id:saved?.kind==='breakers'?saved.id:layoutId(),level:savedItem?.level??activeLevel,start:draft.start,end:draft.end,...(colour?{colour}:{})};
        patch={boardLayout:{...layout,breakers:saved?.kind==='breakers'?layout.breakers.map(b=>b.id===saved.id?{...b,...breaker}:b):[...layout.breakers,breaker]}};
      }
      // Use the saved-design validator too; bad or crossing selections never reach price/history/autosave.
      const parsed=parseDeckReleaseDesign(JSON.stringify({format:'golden-maple-deck-design',version:1,units:'inches-and-feet',configuration:{...data,...patch}}));
      if(patch.boardLayout)patch.boardLayout=parsed.boardLayout;
      update(patch);cancel();setBoards([]);setSaved(null);setMode('board');announce('Board layout applied. Click the added board to edit it, or press Delete to remove it.');
    }catch(error){announce(error instanceof Error?error.message:'The layout could not be applied.');}
  };
  const remove=()=>{if(!saved)return;try{update({boardLayout:{...layout,[saved.kind]:layout[saved.kind].filter(p=>p.id!==saved.id)}});cancel();setSaved(null);announce('Layout removed. The underlying boards are restored.');}catch(e){announce(e instanceof Error?e.message:'The layout could not be removed.');}};
  const deleteSelection=()=>{if(saved){remove();return;}if(!deletion?.patch){if(deletion?.error)announce(deletion.error);return;}try{update(deletion.patch);cancel();setBoards([]);setSaved(null);setReview('');announce(deletion.message);}catch(e){announce(e instanceof Error?e.message:'The board could not be deleted. Select it again.');}};
  useEffect(()=>{
    const key=(event:globalThis.KeyboardEvent)=>{
      if(!['Delete','Backspace'].includes(event.key)||event.defaultPrevented||event.isComposing||event.ctrlKey||event.metaKey||event.altKey||gesture.current||(!saved&&!many.length))return;
      const target=event.target instanceof Element?event.target:null;
      if(target?.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="dialog"]')||[...document.querySelectorAll('dialog[open],[role="dialog"]')].some(el=>el.getClientRects().length>0))return;
      if(!target||!(svg.current?.contains(target)||controlsElement.current?.contains(target)||controlsOnly&&(target===document.body||!!target.closest('#deck-live-preview'))))return;
      event.preventDefault();deleteSelection();
    };
    document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);
  },[data,model,saved,many,deletion,controlsOnly]);
  const picked=(mode==='board'&&(!!chosen||saved?.kind==='pieces'))||mode==='area'&&!!draft?.polygon||mode==='breaker'&&!!draft?.start;
  const controls=<div ref={controlsElement} className="dd-board-layout-controls" onPointerDown={e=>{
    if(e.pointerType==='mouse')return;const button=(e.target as Element).closest('button');if(button)consumedTargets.current.add(button);controlTap.current=e.isPrimary&&e.button===0&&activePointers.current.size===1&&button instanceof HTMLButtonElement&&!button.disabled&&e.currentTarget.contains(button)?{pointer:e.pointerId,x:e.clientX,y:e.clientY,button}:null;
  }} onPointerMove={e=>{const tap=controlTap.current;if(tap?.pointer===e.pointerId&&Math.hypot(e.clientX-tap.x,e.clientY-tap.y)>8)controlTap.current=null;}} onPointerCancel={()=>{controlTap.current=null;}} onPointerUp={e=>{
    const tap=controlTap.current;controlTap.current=null;if(!tap||tap.pointer!==e.pointerId||tap.button.disabled||(e.target as Element).closest('button')!==tap.button||Math.hypot(e.clientX-tap.x,e.clientY-tap.y)>8)return;e.preventDefault();tap.button.click();
  }} onClickCapture={e=>{const type=(e.nativeEvent as globalThis.PointerEvent).pointerType,button=(e.target as Element).closest('button');if(button&&(type==='touch'||type==='pen'||e.nativeEvent.isTrusted&&e.detail>0&&consumedTargets.current.has(button))){e.preventDefault();e.stopPropagation();}}}>
    {!controlsOnly&&<div className="dd-board-layout-modes" role="group" aria-label="Board layout tools">{([['board','Select board'],['area','Select area'],['breaker','Add breaker']] as const).map(([id,label])=><button type="button" key={id} aria-pressed={mode===id} onClick={()=>{cancel();setBoards([]);setSaved(null);setMode(id);setColour('');announce('');}}>{label}</button>)}</div>}
    <p className="dd-note">{mode==='board'?'Click any deck board to rotate or recolour it. Zoom in for narrow boards.':mode==='area'?'Drag a selection on the deck. Its boards can run at any angle.':'Drag from one end of your breaker board to the other. It cuts through the field boards.'} Right-click a finished area or breaker preview to apply it, or use Apply layout.</p>
    {inactiveSaved&&<p className="dd-quote-notice">This layout belongs to level {savedItem!.level}, which is no longer in the design. Restore that level to edit it, or remove the saved layout.</p>}
    <div className="dd-board-layout-settings">
      {levels.length>1&&<label>Deck level<select aria-label="Board layout level" value={activeLevel} onChange={e=>{cancel();setBoards([]);setSaved(null);setLevel(Number(e.target.value) as 1|2|3);}}>{levels.map(l=><option key={l} value={l}>{l===1?'Main deck':`Level ${l}`}</option>)}</select></label>}
      {mode==='area'&&<label className="dd-board-layout-free"><input type="checkbox" checked={free} onChange={e=>{cancel();setSaved(null);setFree(e.target.checked);}}/> Free select</label>}
      {mode!=='breaker'&&<label>Direction · degrees<input type="number" step="any" min="-360" max="360" aria-label="Board direction" value={angle} onChange={e=>{setAngle(e.target.value);setReview('');}}/></label>}
      <label>Colour<select aria-label="Layout board colour" value={colour} onChange={e=>{setColour(e.target.value);setReview('');}}><option value="">Match decking</option>{collections.map(m=><optgroup key={m.id} label={`${m.name}${m.costPerSqft===null?' · supplier quote':''}`}>{m.colors.map(c=><option key={c.name} value={colourRef(m.id,c.name)}>{c.name}</option>)}</optgroup>)}</select></label>
    </div>
    {mode!=='breaker'&&<div className="dd-board-layout-presets" role="group" aria-label="Direction presets">{[0,45,90,135].map(n=><button key={n} type="button" aria-pressed={Number(angle)===n} onClick={()=>{setAngle(String(n));setReview('');}}>{n}°</button>)}</div>}
    {mode==='board'&&<><label className="dd-board-layout-free"><input type="checkbox" aria-label="Select multiple boards" checked={multi} onChange={e=>setMulti(e.target.checked)}/>Select multiple boards · {many.length} selected</label><label>Find boards<input type="search" aria-label="Find deck boards" value={boardFilter} onChange={e=>setBoardFilter(e.target.value)} placeholder="Board number, field, border…"/></label><button type="button" onClick={()=>setBoards(boards.filter(b=>`${b.index+1} ${b.run.role??'field'} ${b.run.angleDeg}`.includes(boardFilter)).map(b=>({level:b.modelLevel,index:b.index})))}>Select all matching boards</button>{multi&&<div className="dd-board-batch-list" role="group" aria-label="Toggle boards in selection">{boards.filter(b=>`${b.index+1} ${b.run.role??'field'} ${b.run.angleDeg}`.includes(boardFilter)).map(b=><label key={b.index}><input type="checkbox" checked={many.some(t=>t.level===b.modelLevel&&t.index===b.index)} onChange={()=>selectBoard(b,true)}/>Board {b.index+1} · {b.run.role??'field'}</label>)}</div>}{many.length>1&&<div className="dd-board-batch" aria-label="Batch board edits"><label>Change<select aria-label="Batch board operation" value={batchField} onChange={e=>{setBatchField(e.target.value);setReview('');}}><option value="both">Direction and colour</option><option value="direction">Direction only</option><option value="colour">Colour only</option></select></label><button type="button" onClick={reviewBoards}>Review selected board changes</button>{review&&<p role="status">{review}</p>}</div>}</>}
    {mode==='board'&&<label className="dd-board-layout-picker">Select a board by number<select aria-label="Select deck board" value={chosen?.index??''} onChange={e=>{if(!e.target.value){setBoards([]);setSaved(null);cancel();return;}const b=boards.find(v=>v.index===Number(e.target.value));if(b)selectBoard(b);}}><option value="">Choose a board…</option>{boards.map(b=><option key={b.index} value={b.index}>Board {b.index+1} · {b.run.role??'field'} · {round(b.run.angleDeg)}°</option>)}</select></label>}
    <div className="dd-board-layout-actions"><button type="button" className="dd-primary" disabled={!picked||!!gesture.current||inactiveSaved} onClick={apply}>Apply layout</button><button type="button" className="dd-secondary" disabled={!picked} onClick={()=>{cancel();setBoards([]);setSaved(null);announce('Selection cleared.');}}>Clear selection</button>{saved&&<button type="button" className="dd-secondary" onClick={remove}>Remove layout</button>}</div>
    {many.length>0&&<div className="dd-board-delete"><button type="button" className="dd-secondary" disabled={!deletion?.patch} onClick={deleteSelection}>Delete selected board{many.length>1?'s':''}</button><p className="dd-note">{deletion?.error||`${deletion?.frameBoards?'The selected picture-frame stock is replaced with field decking; other frame boards stay.':'Delete removes the saved addition, including its cut fragments, and restores the underlying decking.'} Press Delete or Backspace while the drawing is selected. Undo restores the change.`}</p></div>}
    <p role="status" className="dd-board-layout-notice">{notice}</p>
    {!!(layout.regions.length+layout.breakers.length+layout.pieces.length)&&<details className="dd-board-layout-saved"><summary>Saved layouts · {layout.regions.length+layout.breakers.length+layout.pieces.length}</summary>{(['regions','breakers','pieces'] as const).flatMap(kind=>layout[kind].map((item,i)=><button key={item.id} type="button" aria-pressed={saved?.id===item.id} onClick={()=>selectSaved(kind,item)}>{kind==='regions'?(item as BoardLayoutRegion).replaceBorder?'Frame replacement':'Area':kind==='breakers'?'Breaker':'Board'} {i+1} · {item.level===1?'main deck':`level ${item.level}`}</button>))}</details>}
    <p className="dd-note">The drawing trims boards to the deck and keeps border and inlay areas. Custom joints, board support and fastening need builder confirmation; any outstanding costs remain visible in the estimate.</p>
  </div>;
  const highlights=many.length?all.filter(b=>many.some(t=>t.level===b.modelLevel&&t.index===b.index)).map(b=>b.polygon):chosen?[chosen.polygon]:saved?.kind==='pieces'?all.filter(b=>b.run.layoutId===saved.id).map(b=>b.polygon):[];
  if(controlsOnly)return controls;
  return <div className="dd-board-layout-overlay"><svg ref={svg} className="dd-board-layout-svg" viewBox={viewportFrame.viewBox} preserveAspectRatio="xMidYMid meet" role="group" aria-label="Board layout selection canvas" tabIndex={0} onContextMenu={e=>{if(mode!=='board'&&draft&&!gesture.current&&!saved){e.preventDefault();e.stopPropagation();apply();}}} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} onLostPointerCapture={()=>{if(gesture.current)cancel();}} onKeyDown={e=>{if(e.key==='Escape'){cancel();setBoards([]);setSaved(null);announce('Selection cancelled.');}}}>
    {mode==='board'&&boards.map(b=><polygon key={b.index} className="dd-board-hit" data-board-index={b.index} data-level={activeLevel} data-selected={many.some(t=>t.level===b.modelLevel&&t.index===b.index)||undefined} points={pointsText(b.polygon.map(world))} onPointerDown={tapStart} onPointerUp={tapEnd} onClick={e=>{const type=(e.nativeEvent as globalThis.PointerEvent).pointerType;if(type==='touch'||type==='pen'||e.nativeEvent.isTrusted&&e.detail>0&&consumedTargets.current.has(e.currentTarget))return;selectBoard(b,e.ctrlKey||e.metaKey,e.shiftKey);svg.current?.focus({preventScroll:true});}}><title>Board {b.index+1}: {round(b.run.angleDeg)} degrees</title></polygon>)}
    {highlights.map((polygon,i)=><polygon key={i} className="dd-board-layout-highlight" points={pointsText(polygon.map(world))}/>)}
    {!inactiveSaved&&draft?.polygon&&<polygon className="dd-board-layout-selection" points={pointsText(draft.polygon.map(world))}/>}
    {!inactiveSaved&&draft?.start&&draft.end&&<line className="dd-board-layout-breaker" x1={world(draft.start).x} y1={world(draft.start).y} x2={world(draft.end).x} y2={world(draft.end).y} style={{strokeWidth:data.boardWidth}}/>}
  </svg>{toolbar?.current?createPortal(controls,toolbar.current):controls}</div>;
}
