import {SHEET,type DrawingSet,type Sheet} from './drawingTypes';
import {paperLayout} from './paperLayout';

/** One permit sheet as an SVG, in paper inches on an 11 × 17 page: the preview of what the PDF prints. */
export default function PermitSheetSvg({set,sheet,index}:{set:DrawingSet;sheet:Sheet;index:number}){
  const prims=paperLayout(set,sheet,index);
  return <svg viewBox={`0 0 ${SHEET.w} ${SHEET.h}`} role="img" aria-label={`${sheet.id} ${sheet.title}, scale ${sheet.scaleLabel}`} style={{width:'100%',height:'auto',background:'#fff'}}>
    <title>{`${sheet.id} ${sheet.title}`}</title>
    {prims.map((p,i)=>{switch(p.kind){
      case 'line':return <line key={i} x1={p.a.x} y1={p.a.y} x2={p.b.x} y2={p.b.y} stroke={p.grey?'#777':'#111'} strokeWidth={p.weight} strokeDasharray={p.dash?.join(' ')}/>;
      case 'circle':return <circle key={i} cx={p.c.x} cy={p.c.y} r={p.r} fill={p.fill?'#111':'none'} stroke="#111" strokeWidth={p.weight}/>;
      case 'rect':return <rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} fill={p.fill?'#111':'none'} stroke="#111" strokeWidth={p.weight}/>;
      case 'text':return <text key={i} x={p.at.x} y={p.at.y} fontSize={p.size} fontFamily="Helvetica, Arial, sans-serif" fontWeight={p.bold?700:400} textAnchor={p.anchor} fill="#111" transform={p.rotate?`rotate(${p.rotate} ${p.at.x} ${p.at.y})`:undefined}>{p.text}</text>;
    }})}
  </svg>;
}
