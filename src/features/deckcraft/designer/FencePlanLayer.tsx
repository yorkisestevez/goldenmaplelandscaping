import {FENCE_STYLES,fencePosts,runLengthIn,type FenceRun} from '../fenceTypes';

/** Plan graphics for saved fence runs. Nothing is drawn when every run is off. */
export default function FencePlanLayer({runs}:{runs:readonly FenceRun[]}){
  const drawn=runs.filter(r=>r.enabled);
  if(!drawn.length)return null;
  return <g aria-label="Fences">
    {drawn.map(run=>{
      const style=FENCE_STYLES[run.style],posts=fencePosts(run),d=run.points.map((p,i)=>`${i?'L':'M'}${p.x} ${p.y}`).join(' ');
      const mid=run.points[Math.floor((run.points.length-1)/2)];
      return <g key={run.id} aria-label={run.name}>
        <path d={d} fill="none" stroke={run.infillColor} strokeWidth={3} strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
        {posts.map((p,i)=><rect key={i} x={p.x-style.postSizeIn/2} y={p.y-style.postSizeIn/2} width={style.postSizeIn} height={style.postSizeIn} fill={run.postColor} stroke="#fff" strokeWidth={.4} transform={`rotate(${p.angle*180/Math.PI} ${p.x} ${p.y})`}/>)}
        {run.gates.map(g=>{
          const a=posts.reduce((best,p)=>Math.abs(p.station-(g.stationIn-g.widthIn/2))<Math.abs(best.station-(g.stationIn-g.widthIn/2))?p:best,posts[0]);
          const b=posts.reduce((best,p)=>Math.abs(p.station-(g.stationIn+g.widthIn/2))<Math.abs(best.station-(g.stationIn+g.widthIn/2))?p:best,posts[0]);
          const mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
          return <g key={g.id}><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#c4552a" strokeWidth={2.4} strokeDasharray="5 3" vectorEffect="non-scaling-stroke"/><text x={mx} y={my-6} textAnchor="middle" fontSize="7" fontWeight="700" fill="#8a3418">{g.kind==='double'?'DOUBLE GATE':'GATE'}</text></g>;
        })}
        <text x={mid.x} y={mid.y-8} textAnchor="middle" fontSize="8" fontWeight="700" fill="#243126" paintOrder="stroke" stroke="#fbfbf8" strokeWidth="2.5">{`${run.name} · ${run.heightFt} ft · ${(runLengthIn(run.points)/12).toFixed(1)} ft`}</text>
      </g>;
    })}
  </g>;
}
