import type {DeckData} from '../types';
import {isObjectVisible} from '../editorOrganization';
import {fenceLayout} from '../fenceRuntime';

const STROKE:Record<NonNullable<DeckData['fences']>[number]['style'],string>={'wood-privacy':'#7a5a3a','horizontal-cedar':'#9a6438','vinyl-privacy':'#8a8f86','aluminum-picket':'#23262a','chain-link':'#6f7a80'};

/** The site plan's fences (world inches, like the landscape layer): each fence line, its posts, and each gate as an
 * opening with its swing, labelled with the fence's name. */
export default function FencePlanLayer({data}:{data:DeckData}){
  return <g aria-label="Fences and gates">{(data.fences??[]).filter(f=>isObjectVisible(data.editorOrganization,f.id)).map(f=>{
    const {spans,gates,posts}=fenceLayout(f),mid=f.points[Math.floor((f.points.length-1)/2)],next=f.points[Math.floor((f.points.length-1)/2)+1];
    return <g key={f.id} data-fence={f.id}>
      {spans.map((s,i)=><line key={i} x1={s.start.xIn} y1={s.start.zIn} x2={s.end.xIn} y2={s.end.zIn} stroke={STROKE[f.style]} strokeWidth={f.style==='chain-link'?1.5:3} strokeDasharray={f.style==='chain-link'?'4 2':undefined}/>)}
      {gates.map(g=>{const dx=g.end.xIn-g.start.xIn,dz=g.end.zIn-g.start.zIn,len=Math.hypot(dx,dz),leaf=g.gate.kind==='double'?len/2:len,nx=-dz/len*leaf,nz=dx/len*leaf;
        // Each leaf swings into the yard side of the run: a quarter arc from its closed position.
        const arc=(hx:number,hz:number,tx:number,tz:number,sweep:0|1)=>`M${hx+nx} ${hz+nz}A${leaf} ${leaf} 0 0 ${sweep} ${tx} ${tz}`;
        return <g key={g.gate.id} data-gate={g.gate.id} fill="none" stroke={STROKE[f.style]} strokeWidth=".8">
          {g.gate.kind==='double'?<><path d={arc(g.start.xIn,g.start.zIn,g.start.xIn+dx/2,g.start.zIn+dz/2,0)}/><path d={arc(g.end.xIn,g.end.zIn,g.end.xIn-dx/2,g.end.zIn-dz/2,1)}/><line x1={g.start.xIn} y1={g.start.zIn} x2={g.start.xIn+nx} y2={g.start.zIn+nz}/><line x1={g.end.xIn} y1={g.end.zIn} x2={g.end.xIn+nx} y2={g.end.zIn+nz}/></>
            :<><path d={arc(g.start.xIn,g.start.zIn,g.end.xIn,g.end.zIn,0)}/><line x1={g.start.xIn} y1={g.start.zIn} x2={g.start.xIn+nx} y2={g.start.zIn+nz}/></>}
        </g>;})}
      {posts.map((p,i)=><rect key={i} x={p.xIn-2.5} y={p.zIn-2.5} width="5" height="5" fill={STROKE[f.style]}/>)}
      <text x={(mid.xIn+next.xIn)/2} y={(mid.zIn+next.zIn)/2-8} textAnchor="middle" fontSize="8" fill="#253a2a" paintOrder="stroke" stroke="#fbfbf8" strokeWidth="2.5">{f.name} · {f.heightFt} ft</text>
    </g>;
  })}</g>;
}
