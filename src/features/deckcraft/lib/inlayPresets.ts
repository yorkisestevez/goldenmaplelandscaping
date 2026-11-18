import type {ColourRef,DeckInlay,OutlinePoint} from '../types';

export const INLAY_PRESETS=[
  {id:'rectangle',label:'Rectangle',description:'A framed 6 × 4 ft rectangle.'},
  {id:'diamond',label:'Diamond',description:'A framed 5 ft square turned diagonally.'},
  {id:'band',label:'Band',description:'Two contrast boards running front to back.'},
  {id:'round',label:'Round',description:'A framed 6 ft, 16-sided medallion.'},
  {id:'compass',label:'Compass',description:'Eight alternating wedges with tangential boards.'},
  {id:'compass-rose',label:'Compass rose',description:'Eight pointed rays with split contrast halves and a separate background.'},
  {id:'sunburst',label:'Sunburst',description:'Sixteen alternating rays with boards running radially.'},
  {id:'hexagon',label:'Hexagon',description:'A framed six-sided polygon.'},
  {id:'octagon',label:'Octagon',description:'A framed eight-sided polygon.'},
  {id:'triangle',label:'Triangle',description:'A framed triangular polygon.'},
  {id:'star',label:'Star',description:'A framed five-point star polygon.'},
  {id:'chevron',label:'Chevron',description:'A framed concave chevron polygon.'},
] as const;
export type InlayPresetId=typeof INLAY_PRESETS[number]['id'];
const radial=(count:number,radius:number,start=-Math.PI/2):OutlinePoint[]=>Array.from({length:count},(_,i)=>({x:radius*Math.cos(start+i*Math.PI*2/count),y:radius*Math.sin(start+i*Math.PI*2/count)}));
/** Returns new data each time. Colour is a real product reference; geometry is never a visual-only motif. */
export function createInlayPreset(presetId:string,id:string,contrast?:ColourRef):DeckInlay{
  if(!/^[a-z0-9-]{1,24}$/.test(id))throw new Error('Invalid inlay id.');
  if(!INLAY_PRESETS.some(p=>p.id===presetId))throw new Error('Unknown inlay preset.');
  const frame=contrast?{frame:contrast}:{};
  if(presetId==='rectangle')return {id,kind:'rug',widthFt:6,depthFt:4,...frame};
  if(presetId==='diamond')return {id,kind:'diamond',widthFt:5,depthFt:5,...frame};
  if(presetId==='band')return {id,kind:'band',direction:'along',boards:2,...(contrast?{fill:contrast}:{})};
  if(['round','compass','compass-rose','sunburst'].includes(presetId))return {id,kind:'medallion',diameterFt:presetId==='compass-rose'||presetId==='sunburst'?8:6,style:presetId as 'round'|'compass'|'compass-rose'|'sunburst',...frame};
  const points=presetId==='hexagon'?radial(6,36):presetId==='octagon'?radial(8,36,-Math.PI/8):presetId==='triangle'?[{x:-36,y:-18*Math.sqrt(3)},{x:36,y:-18*Math.sqrt(3)},{x:0,y:18*Math.sqrt(3)}]:presetId==='star'?radial(10,48).map((p,i)=>i%2?{x:p.x*.52,y:p.y*.52}:p):[{x:-36,y:-30},{x:0,y:-6},{x:36,y:-30},{x:36,y:0},{x:0,y:30},{x:-36,y:0}];
  return {id,kind:'custom',name:INLAY_PRESETS.find(p=>p.id===presetId)!.label,points,...frame};
}
