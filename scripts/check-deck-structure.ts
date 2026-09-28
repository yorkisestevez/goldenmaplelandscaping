import assert from 'node:assert/strict';
import {SOURCES} from '../src/features/deckcraft/structure/sources';
import {BEAM_CANTILEVER,BEAM_TABLE_2PLY,BEAM_TABLE_3PLY,BLOCKING,JOIST_CANTILEVER,JOIST_TABLE} from '../src/features/deckcraft/structure/tableData';
import {ACTUAL_DEPTH_IN,DESIGN,beamSpanLimitIn,framingSources,joistCantileverLimitIn,joistCantileverRule,joistSpanLimitIn,maxBlockingGapIn,type JoistSize} from '../src/features/deckcraft/structure/spanTables';
import {frameRectangle} from '../src/features/deckcraft/structure/framing';

// The framing engine (structure/): its transcribed numbers, and the rules every framing it produces must meet.
// The pinned values below were read off the source pages listed in structure/sources.ts. Change one only with
// the page open and the owner told.
const SIZES:JoistSize[]=['2x8','2x10','2x12'];
let checks=0;const ok=(cond:unknown,msg:string)=>{assert(cond,msg);checks++;};

// 1. Transcribed values, in whole inches rounded down from the published metres.
const joists:Record<JoistSize,[number,number]>={'2x8':[150,140],'2x10':[174,164],'2x12':[197,185]};
for(const size of SIZES){ok(joistSpanLimitIn(size,12)===joists[size][0]&&joistSpanLimitIn(size,16)===joists[size][1],`OBC 9.23.4.2.-A spans for ${size}`);}
ok(JSON.stringify(JOIST_TABLE.metres)===JSON.stringify({'2x8':{12:3.81,16:3.58},'2x10':{12:4.44,16:4.17},'2x12':{12:5.01,16:4.71}}),'Joist table metres as published');
ok(JSON.stringify(BEAM_TABLE_3PLY.supportedLengthM)===JSON.stringify([2.4,3.0,3.6,4.2,4.8,5.4,6.0]),'Beam table rows as published');
ok(JSON.stringify(BEAM_TABLE_3PLY.metres)===JSON.stringify({'2x8':[3.07,2.85,2.63,2.44,2.28,2.15,2.04],'2x10':[3.92,3.52,3.22,2.98,2.79,2.63,2.49],'2x12':[4.57,4.09,3.73,3.46,3.23,3.05,2.89]}),'3-ply beam metres as published');
ok(JSON.stringify(BEAM_TABLE_2PLY.feetInches)===JSON.stringify({'2x8':[5,10],'2x10':[7,2],'2x12':[8,4]})&&BEAM_TABLE_2PLY.maxSupportedLengthM===3.6,'Springwater 2-ply spans as published');
ok(JSON.stringify(JOIST_CANTILEVER.maxIn)===JSON.stringify({'2x8':16,'2x10':24,'2x12':24})&&JOIST_CANTILEVER.maxFractionOfSpan===1/6,'Joist cantilever limits as published');
ok(BEAM_CANTILEVER.maxIn===12&&BLOCKING.maxGapMm===2100&&maxBlockingGapIn===82,'Beam cantilever and blocking gap as published');
ok(beamSpanLimitIn({size:'2x10',plies:3},24)===154&&beamSpanLimitIn({size:'2x8',plies:3},141)===103&&beamSpanLimitIn({size:'2x12',plies:3},236)===113,'3-ply lookups (2.4, 3.6 and 6.0 m rows)');
ok(beamSpanLimitIn({size:'2x12',plies:2},100)===100&&beamSpanLimitIn({size:'2x8',plies:2},141)===70&&beamSpanLimitIn({size:'2x10',plies:2},142)===0,'2-ply lookups stop past 3.6 m');
ok(beamSpanLimitIn({size:'2x10',plies:3},237)===0,'No span past the 6.0 m row');

// 2. Table sanity: bigger lumber spans further, closer spacing spans further, a longer supported length spans less.
for(const size of SIZES)ok(joistSpanLimitIn(size,12)>joistSpanLimitIn(size,16),`${size}: 12 in spacing spans further than 16 in`);
ok(joistSpanLimitIn('2x8',16)<joistSpanLimitIn('2x10',16)&&joistSpanLimitIn('2x10',16)<joistSpanLimitIn('2x12',16),'Deeper joists span further');
for(const size of SIZES){
  const col=BEAM_TABLE_3PLY.metres[size];ok(col.every((v,i)=>i===0||v<col[i-1]),`${size} 3-ply spans fall as the supported length grows`);
  ok(beamSpanLimitIn({size,plies:3},141)>beamSpanLimitIn({size,plies:2},141),`${size}: 3-ply spans further than 2-ply`);
}

// 3. Every table names a source with a public https address.
for(const id of [JOIST_TABLE.source,BLOCKING.source,BEAM_TABLE_3PLY.source,BEAM_TABLE_2PLY.source,JOIST_CANTILEVER.source,JOIST_CANTILEVER.ratioSource,BEAM_CANTILEVER.source])ok(SOURCES[id]&&/^https:\/\//.test(SOURCES[id].url),`Source ${id} is listed with an https address`);
ok(framingSources().length===Object.keys(SOURCES).length,'Every listed source backs a table');

// 4. Framing rules over a grid of zones.
let zones=0;
for(const w of [12,24,30,48,96,144,192,240,360,480])for(const d of [36,60,96,120,144,192,240,288,360])for(const ledger of [true,false])for(const joistSize of SIZES)for(const joistSpacingIn of [12,16] as const)for(const topIn of [8,14,20,30,48,96])for(const landing of [false,true]){
  const f=frameRectangle({widthIn:w,depthIn:d,topIn,ledger,joistSpacingIn,joistSize,edgeBeams:landing}),tag=`${w}x${d} ${ledger?'attached':'freestanding'} ${joistSize}@${joistSpacingIn} top ${topIn}${landing?' landing':''}`;
  const zs=f.beamRows.map(r=>r.z),bearings=ledger?[0,...zs]:zs,c=f.cantileverIn,s=f.joistSpanIn;
  ok(zs.every((z,i)=>i===0||z>zs[i-1])&&zs.every(z=>f.edgeBeams?z>=0&&z<=d:z>0&&z<d),`${tag}: beam rows are ordered inside the zone (edge beams may sit on its edges)`);
  ok(f.edgeBeams===(f.beamMount==='flush'||landing),`${tag}: beams sit on the edges exactly for a flush beam or a landing`);
  const edge=f.edgeBeams?f.beam.plies*1.5/2:0;
  ok(bearings.every((z,i)=>i===0||(z-bearings[i-1]<=s+1e-6&&z-bearings[i-1]>=s-2*edge-1e-6)),`${tag}: equal joist spans between bearings (a flush edge beam shortens its bay by half its width)`);
  ok(s<=f.joistSpanLimitIn+1e-9&&f.joistSpanLimitIn===joistSpanLimitIn(joistSize,joistSpacingIn),`${tag}: joist span ${s} within the table`);
  ok(Math.abs(d-zs.at(-1)!-c-edge)<1e-6&&(ledger||Math.abs(zs[0]-c-edge)<1e-6),`${tag}: cantilever ${c} at each free end`);
  ok(c<=joistCantileverLimitIn(joistSize,s)+1e-9,`${tag}: cantilever ${c} within ${joistCantileverLimitIn(joistSize,s)}`);
  ok(!f.edgeBeams||c===0,`${tag}: joists do not cantilever past an edge beam`);
  ok(Math.abs(f.edgeReachIn-(c+edge))<1e-9,`${tag}: edge reach is the cantilever plus a flush beam's half-width`);
  // The fewest rows: one span fewer would break the joist table.
  const n=ledger?zs.length:zs.length-1;
  if(n>1){const k=ledger?1:2,{maxIn,fractionOfSpan:fr}=joistCantileverRule(joistSize),c1=f.edgeBeams?0:Math.floor(Math.min(maxIn,fr*d/(n-1+k*fr)));ok((d-k*c1)/(n-1)>f.joistSpanLimitIn,`${tag}: ${n} spans are the fewest that fit`);}
  for(const r of f.beamRows)ok(Math.abs(r.supportedLengthIn-(r.kind==='intermediate'?s:s/2+c))<1e-6,`${tag}: supported length of the ${r.kind} beam`);
  const governing=Math.max(...f.beamRows.map(r=>r.supportedLengthIn));
  ok(f.beam.size===joistSize&&f.beamSpanLimitIn===beamSpanLimitIn(f.beam,governing)&&f.beamSpanLimitIn>0,`${tag}: joist-size beam read from the table`);
  ok(f.beam.plies===3||f.beamSpanLimitIn>=DESIGN.targetPostSpacingIn,`${tag}: 2-ply only where it spans ${DESIGN.targetPostSpacingIn} in`);
  for(const r of f.beamRows){
    const xs=f.posts.filter(p=>p.z===r.z&&p.row===r.kind).map(p=>p.x).sort((a,b)=>a-b);
    ok(xs[0]<=BEAM_CANTILEVER.maxIn+1e-9&&w-xs.at(-1)!<=BEAM_CANTILEVER.maxIn+1e-9,`${tag}: the ${r.kind} beam overhangs its end posts by no more than ${BEAM_CANTILEVER.maxIn} in`);
    ok(w<DESIGN.minPostSpacingIn?xs.length===1&&Math.abs(xs[0]-w/2)<1e-9:xs.length>=2&&xs.every((x,i)=>i===0||x-xs[i-1]>=DESIGN.minPostSpacingIn-1e-9),`${tag}: posts under the ${r.kind} beam at least ${DESIGN.minPostSpacingIn} in apart, or one centre post`);
    ok(xs.every((x,i)=>i===0||x-xs[i-1]<=f.beamSpanLimitIn+1e-6),`${tag}: posts under the ${r.kind} beam within its span`);
  }
  ok(f.joistXsIn[0]===.75&&f.joistXsIn.at(-1)===w-.75&&f.joistXsIn.every((x,i)=>i===0||(x>f.joistXsIn[i-1]&&x-f.joistXsIn[i-1]<=joistSpacingIn+1e-9)),`${tag}: joists within ${joistSpacingIn} in, rims at both ends`);
  const rows=[...bearings,...f.blockingZsIn].sort((a,b)=>a-b);
  ok(rows.every((z,i)=>i===0||z-rows[i-1]<=maxBlockingGapIn+1e-6),`${tag}: no blocking gap over ${maxBlockingGapIn} in`);
  const jd=ACTUAL_DEPTH_IN[joistSize],bd=f.beamDepthIn,top=topIn-DESIGN.deckingThicknessIn;
  ok(f.beamMount==='drop'?Math.abs(f.beamBottomIn-(top-jd-bd))<1e-9&&f.beamBottomIn>=DESIGN.minDropBeamUndersideIn:Math.abs(f.beamBottomIn-(top-bd))<1e-9&&top-jd-bd<DESIGN.minDropBeamUndersideIn,`${tag}: ${f.beamMount} beam height`);
  zones++;
}
console.log(`DECK STRUCTURE OK: ${checks} checks. Transcribed OBC 2024, Barrie, Springwater and Orillia values are pinned; ${zones} zones framed within the joist, beam, cantilever, post-spacing and blocking rules, landings included.`);
