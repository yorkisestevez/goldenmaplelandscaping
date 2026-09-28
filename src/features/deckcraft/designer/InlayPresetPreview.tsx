import {memo} from 'react';
import {createInlayPreset} from '../lib/inlayPresets';
import {planInlays} from '../lib/inlayGeometry';
import {boardOutline} from '../lib/polygonCuts';
const previews=new Map<string,{box:string;pieces:{points:string;frame:boolean}[]}>();
/** Small views of the actual generated boards, shared by the plan and material preset choosers. */
export default memo(function InlayPresetPreview({presetId}:{presetId:string}){
 let preview=previews.get(presetId);
 if(!preview){const plan=planInlays([createInlayPreset(presetId,'preview')],{fieldPolygons:[[{x:0,y:0},{x:240,y:0},{x:240,y:240},{x:0,y:240}]],centre:{x:120,y:120},boardWidth:5.5,gap:.1875,stockLength:192,straight:true})[0];
  const outline=plan.pieces.flat(),xs=outline.map(p=>p.x),ys=outline.map(p=>p.y),x=Math.min(...xs)-3,y=Math.min(...ys)-3,w=Math.max(...xs)-x+3,h=Math.max(...ys)-y+3;
  preview={box:`${x} ${y} ${w} ${h}`,pieces:(plan.boards.length?plan.boards.map(b=>({points:boardOutline(b,5.5),frame:b.role==='inlay-frame'})):plan.pieces.map(points=>({points,frame:true}))).map(p=>({points:p.points.map(q=>`${q.x.toFixed(2)},${q.y.toFixed(2)}`).join(' '),frame:p.frame}))};previews.set(presetId,preview);
 }
 return <svg className="dd-inlay-preset-icon" aria-hidden="true" viewBox={preview.box}>{preview.pieces.map((p,i)=><polygon key={i} points={p.points} fill={p.frame?'#9b6346':'#ddd1bf'} stroke="#70675b" strokeWidth=".35"/>)}</svg>;
});
