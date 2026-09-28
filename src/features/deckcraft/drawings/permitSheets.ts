import {BUSINESS,publicContact} from '../../../data/business';
import type {DeckTakeoff,Member} from '../deckTakeoff';
import type {DeckData} from '../types';
import {getHousePlacement} from '../housePlacement';
import {getHouseContact} from '../houseContact';
import {getHardwareLayout} from '../hardwareLayout';
import {type DrawItem,type DrawingSet,type LayerId,type Pt,type Sheet,feetInches,pickScale} from './drawingTypes';

/**
 * The permit drawing set built from the takeoff model: S-1 foundation plan, S-2 framing plan, S-3 decking and guard
 * plan. Every member, post and footing drawn is one the takeoff prices; the sheets add dimensions, callouts and notes.
 * The notes cite the public references the framing engine uses (docs/deckcraft/structure-sources.md) and never claim
 * a review outcome: the municipality's review decides.
 */
export interface PermitSetInput{
  data:DeckData;model:DeckTakeoff;
  /** Open review items (the designer's review flags): every sheet is stamped DRAFT while any remain. */
  reviewItems:string[];
  /** e.g. "September 28, 2026". */
  date:string;priceBook:string;
  /** Names for the notes, from the designer's own labels. */
  materialName:string;railingName:string;
}

export const PERMIT_FOOTER='Planning drawing prepared from the DeckCraft design for a permit application. It is not a professional engineer\'s design. The municipality\'s review decides what may be built; confirm soil, footing depth and connections on site before building.';

const plan=(p:{x:number;z:number}):Pt=>({x:p.x,y:p.z});
const TEXT=.1,SMALL=.08;
const rowKey=(z:number)=>Math.round(z/3);

/** Plan-space outline of every level (the house is y < 0). */
function outlines(model:DeckTakeoff):DrawItem[]{
  return model.levels.map(l=>({kind:'poly',closed:true,layer:'A-DECK-OTLN',points:l.footprint.outline.map(p=>({x:p.x+l.offset.x,y:p.y+l.offset.z}))}));
}
function houseWall(data:DeckData,model:DeckTakeoff):DrawItem[]{
  if(data.houseVisible===false)return [];
  const h=getHousePlacement(data),b=bounds(model),x0=Math.max(h.x0,b.minX-48),x1=Math.min(h.x1,b.maxX+48),band=Math.min(24,h.depthIn);
  return [{kind:'line',layer:'A-HOUS',a:{x:x0,y:0},b:{x:x1,y:0}},{kind:'poly',closed:false,layer:'A-HOUS',points:[{x:x0,y:0},{x:x0,y:-band},{x:x1,y:-band},{x:x1,y:0}]},
    {kind:'text',layer:'A-ANNO-TEXT',at:{x:(x0+x1)/2,y:-band/2},text:'HOUSE (deck-facing wall)',height:TEXT,anchor:'middle'}];
}
function bounds(model:DeckTakeoff){
  const pts=[...model.levels.flatMap(l=>l.footprint.outline.map(p=>({x:p.x+l.offset.x,y:p.y+l.offset.z}))),...model.treads.flatMap(t=>(t as typeof t&{polygon?:Pt[]}).polygon??[{x:t.x-t.w/2,y:t.z-t.d/2},{x:t.x+t.w/2,y:t.z+t.d/2}])];
  return {minX:Math.min(...pts.map(p=>p.x)),maxX:Math.max(...pts.map(p=>p.x)),minY:Math.min(0,...pts.map(p=>p.y)),maxY:Math.max(...pts.map(p=>p.y))};
}
const memberLine=(m:Member,layer:LayerId):DrawItem=>({kind:'line',layer,a:plan(m.a),b:plan(m.b)});

/** A chain of dimensions along points sorted on one axis, drawn `offset` inches to one side. */
function chain(points:Pt[],offset:number):DrawItem[]{
  const out:DrawItem[]=[];
  for(let i=0;i+1<points.length;i++){const a=points[i],b=points[i+1],len=Math.hypot(b.x-a.x,b.y-a.y);if(len>=6)out.push({kind:'dim',layer:'A-ANNO-DIMS',a,b,offset,text:feetInches(len)});}
  return out;
}

/** Posts grouped by beam row (same level, same plan y), sorted along the row. */
function postRows(model:DeckTakeoff){
  return model.levels.flatMap(l=>{
    const rows=new Map<number,Pt[]>();
    for(const s of l.supports){const k=rowKey(s.z);rows.set(k,[...(rows.get(k)??[]),plan(s)]);}
    return [...rows.values()].map(r=>r.sort((a,b)=>a.x-b.x));
  });
}

function finish(id:Sheet['id'],title:string,items:DrawItem[],notes:string[],legend:LayerId[]):Sheet{
  const pts=items.flatMap(i=>i.kind==='line'||i.kind==='dim'?[i.a,i.b]:i.kind==='poly'?i.points:i.kind==='circle'?[i.c]:[i.at]);
  const pad=30,extents={minX:Math.min(...pts.map(p=>p.x))-pad,maxX:Math.max(...pts.map(p=>p.x))+pad,minY:Math.min(...pts.map(p=>p.y))-pad,maxY:Math.max(...pts.map(p=>p.y))+pad};
  const {ratio,label}=pickScale(extents);
  return {id,title,ratio,scaleLabel:label,items,extents,notes,legend};
}

export function buildPermitSet(input:PermitSetInput):DrawingSet{
  const {data,model}=input,main=model.levels[0],b=bounds(model),hardware=getHardwareLayout(data,model);
  const contact=data.houseVisible===false?null:getHouseContact(data,main.footprint);
  const base=[...outlines(model),...houseWall(data,model)];
  const footings=model.quantities.footings,blocks=data.foundation==='Deck Blocks',helical=data.foundation==='Helical Piles';
  const reference=main.reference,joistSize=data.framingSize,spacing=data.joistSpacing,mainFront=main.offset.z+main.footprint.bounds.h;

  // S-1: footings and posts, dimensioned along each beam row and out from the house.
  const s1:DrawItem[]=[...base];
  for(const s of model.levels.flatMap(l=>l.supports)){
    s1.push({kind:'symbol',name:blocks?'BLOCK':'FOOTING',layer:'S-FTNG',at:plan(s),size:blocks?11:helical?3.5:10});
    s1.push({kind:'symbol',name:'POST',layer:'S-POST',at:plan(s),size:5.5});
  }
  for(const row of postRows(model))s1.push(...chain(row,-14));
  const rowZs=[...new Set(main.supports.map(s=>Math.round(s.z*2)/2))].sort((p,q)=>p-q);
  s1.push(...chain([{x:b.minX,y:0},...rowZs.map(z=>({x:b.minX,y:z})),{x:b.minX,y:mainFront}],24),...overall(main,false));
  const s1Notes=[
    `${footings} ${data.foundation.toLowerCase()}${blocks?'':' footings'}, each under a post, as priced.`,
    blocks?'Deck blocks rest on compacted, undisturbed soil. Confirm with the municipality that a floating deck is permitted for this height and attachment.'
      :`Footings bear on undisturbed soil below frost. Barrie's Deck Specs call for 4'-0" minimum depth and a base sized by pier spacing; confirm depth and base size with the municipality.`,
    '6x6 posts shown: OBC 9.17.4.1 sets 140 × 140 mm as the minimum unless calculations show otherwise.',
    'Posts stand at least 24 in apart, and within 12 in of each beam end (Barrie, Springwater).',
  ];

  // S-2: the framing, with its size callouts and the beam rows dimensioned from the house.
  const s2:DrawItem[]=[...base];
  for(const l of model.levels){
    s2.push(...l.joists.map(m=>memberLine(m,'S-JOIS')),...(l.rim??[]).map(m=>memberLine(m,'S-JOIS')),...l.blocking.map(m=>memberLine(m,'S-BLKG')),...l.beams.map(m=>memberLine(m,'S-BEAM')));
    s2.push(...(l.hips??[]).map(h=>({kind:'line',layer:'S-BEAM',a:{x:h.a.x+l.offset.x,y:h.a.y+l.offset.z},b:{x:h.b.x+l.offset.x,y:h.b.y+l.offset.z}}) as DrawItem));
    s2.push(...l.supports.map(s=>({kind:'symbol',name:'POST',layer:'S-POST',at:plan(s),size:5.5}) as DrawItem));
    const o=l.footprint.outline,cx=o.reduce((n,p)=>n+p.x,0)/o.length+l.offset.x,cy=o.reduce((n,p)=>n+p.y,0)/o.length+l.offset.z;
    s2.push({kind:'text',layer:'A-ANNO-TEXT',at:{x:cx,y:cy},text:`${joistSize} joists @ ${spacing}" o.c.`,height:TEXT,anchor:'middle'});
    for(const row of beamRows(l.beams.filter(m=>m.role!=='hip'&&Math.abs(m.a.z-m.b.z)<1e-6))){const m=row[0],left=m.a.x<m.b.x?m.a:m.b;
      s2.push({kind:'text',layer:'A-ANNO-TEXT',at:{x:left.x+4,y:Math.min(...row.map(r=>r.a.z))-5},text:`${row.length}-${sizeOf(m.depth)} beam`,height:SMALL,anchor:'start'});}
  }
  for(const c of contact?.contacts??[]){
    s2.push({kind:'line',layer:'S-LEDG',a:{x:c.a.x+c.inward.x*.75,y:c.a.y+c.inward.y*.75},b:{x:c.b.x+c.inward.x*.75,y:c.b.y+c.inward.y*.75}});
    s2.push({kind:'text',layer:'A-ANNO-TEXT',at:{x:(c.a.x+c.b.x)/2,y:(c.a.y+c.b.y)/2+10},text:c.kind==='flush'?'Outside joist bolted to wall':`${joistSize} ledger`,height:SMALL,anchor:'middle'});
  }
  // Beam rows along the house (a wrap-around's wing beams run the other way and are dimensioned by their own rows).
  const mainRows=[...new Set(main.beams.filter(m=>m.role!=='hip'&&Math.abs(m.a.z-m.b.z)<1e-6&&m.a.z>0).map(m=>Math.round(m.a.z*2)/2))].sort((p,q)=>p-q);
  s2.push(...chain([{x:b.maxX,y:0},...collapse(mainRows).map(z=>({x:b.maxX,y:z})),{x:b.maxX,y:main.footprint.bounds.h+main.offset.z}],-24));
  s2.push(...overall(main,false));
  const bolts=hardware.ledgerBolts.length,hangers=hardware.hangers.length+(hardware.skewedHangers?.length??0);
  const s2Notes=[
    `Joists: ${joistSize} S-P-F No. 1/No. 2 @ ${spacing}" o.c.; spans within OBC 2024 Table 9.23.4.2.-A (with bridging), ${feetInches(reference.joistSpanLimitIn)} at this size and spacing.`,
    `Beams: built-up ${joistSize}, plies as labelled; OBC 2024 Table 9.23.4.2.-H (3-ply) or Springwater's deck guide (2-ply, supported length up to 3.6 m).`,
    `Joist cantilever ${feetInches(reference.cantileverIn)} past the outer beam: within 16 in (2x8) or 24 in (2x10, 2x12) and 1/6 of the span.`,
    'Blocking rows at most 2100 mm apart and from each bearing (OBC 9.23.9.4).',
    ...(contact?.contacts.some(c=>c.kind==='ledger')?[`Ledger fastened to the house rim with ${bolts} bolts, as priced; no ledger on brick veneer or an I-joist rim (Barrie).`]:[]),
    `${hangers} joist hangers and ${hardware.postCaps.length} post caps, as priced.`,
  ];

  // S-3: the walking surface, the guard and the stairs.
  const s3:DrawItem[]=[...base,...overall(main,true)];
  for(const l of model.levels.filter(l=>l.boards.length)){
    const board=l.boards.find(bd=>!(bd as typeof bd&{role?:string}).role)??l.boards[0],a=board.angleDeg*Math.PI/180,o=l.footprint.outline;
    const cx=o.reduce((n,p)=>n+p.x,0)/o.length+l.offset.x,cy=o.reduce((n,p)=>n+p.y,0)/o.length+l.offset.z,dx=Math.cos(a)*24,dy=Math.sin(a)*24;
    s3.push({kind:'line',layer:'A-DECK-BRDS',a:{x:cx-dx,y:cy-dy},b:{x:cx+dx,y:cy+dy}});
    s3.push({kind:'text',layer:'A-ANNO-TEXT',at:{x:cx,y:cy+14},text:'Decking direction',height:SMALL,anchor:'middle'});
  }
  for(const r of model.railing.rails.filter((r,i)=>i%2===1&&r.a.y===r.b.y))s3.push(memberLine(r,'A-RAIL'));
  for(const r of model.railing.frameless?.shoes??[])s3.push({kind:'line',layer:'A-RAIL',a:plan(r.a),b:plan(r.b)});
  for(const p of model.railing.posts)s3.push({kind:'symbol',name:'POST',layer:'A-RAIL',at:plan(p),size:3});
  for(const t of model.treads){
    const poly=(t as typeof t&{polygon?:Pt[]}).polygon,angle=-(t.angle||0);
    const corners=poly??[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>({x:t.x+(u*t.w/2)*Math.cos(angle)-(v*t.d/2)*Math.sin(angle),y:t.z+(u*t.w/2)*Math.sin(angle)+(v*t.d/2)*Math.cos(angle)}));
    s3.push({kind:'poly',closed:true,layer:'A-STRS',points:corners});
  }
  const flights=model.stringers.filter(m=>m.stair).reduce((list,m)=>list.some(f=>f.risers===m.stair!.risers&&Math.abs(f.rise-m.stair!.rise)<.01)?list:[...list,m.stair!],[] as NonNullable<Member['stair']>[]);
  const height=model.railing.height;
  const s3Notes=[
    `Decking: ${input.materialName}${data.deckingColor?`, ${data.deckingColor}`:''}; ${data.pattern.toLowerCase()} pattern.`,
    ...(data.railingType==='None'?['No guard is drawn. OBC 9.8.8.1 requires one where the deck is more than 600 mm above the ground within 1.2 m of it.']
      :[`Guard: ${input.railingName}, ${height} in high. OBC 9.8.8.3 and Barrie's Deck Specs: 36 in (900 mm) where the deck is 5'-11" (1.8 m) or less above grade, 42 in (1070 mm) above.`]),
    ...flights.map(f=>`Stair: ${f.risers} risers of ${f.rise.toFixed(2)} in and a ${f.run.toFixed(2)} in run. OBC Table 9.8.4.1 (private stairs): rise 125–200 mm (4.9–7.9 in), run 255–355 mm (10.0–14.0 in).`),
    ...(flights.some(f=>f.risers>3)?['Barrie requires a handrail where a stair has more than 3 risers.']:[]),
  ];

  const deckWords=`${data.width} × ${data.length} ft ${data.deckType==='Attached'?'attached':'freestanding'} deck, ${data.height} in above grade`;
  return {
    sheets:[
      finish('S-1','Foundation plan',s1,s1Notes,['S-FTNG','S-POST','A-DECK-OTLN','A-HOUS','A-ANNO-DIMS']),
      finish('S-2','Framing plan',s2,s2Notes,['S-JOIS','S-BEAM','S-BLKG','S-LEDG','S-POST','A-ANNO-DIMS']),
      finish('S-3','Decking and guard plan',s3,s3Notes,['A-DECK-OTLN','A-DECK-BRDS','A-RAIL','A-STRS','A-HOUS']),
    ],
    project:{title:deckWords,date:input.date,priceBook:input.priceBook},
    firm:{name:BUSINESS.publicName.value,phone:publicContact.phoneDisplay,email:publicContact.email,url:BUSINESS.canonicalUrl.replace(/^https:\/\//,'')},
    reviewItems:[...new Set([...input.reviewItems,...model.issues])],
    footer:PERMIT_FOOTER,
  };
}

/** Beam members grouped into rows: the plies of one beam lie side by side, 1.5 in apart, over the same span. */
function beamRows(beams:Member[]):Member[][]{
  const rows:Member[][]=[];
  for(const m of [...beams].sort((p,q)=>p.a.z-q.a.z||Math.min(p.a.x,p.b.x)-Math.min(q.a.x,q.b.x))){
    const x0=Math.min(m.a.x,m.b.x),row=rows.find(r=>{const last=r.at(-1)!;return m.a.z-last.a.z<2&&Math.abs(Math.min(last.a.x,last.b.x)-x0)<1;});
    if(row)row.push(m);else rows.push([m]);
  }
  return rows;
}

/** The main deck's overall width along its front, and (with `depth`) its depth beside it. */
function overall(main:DeckTakeoff['levels'][number],depth:boolean):DrawItem[]{
  const o=main.offset,{w,h}=main.footprint.bounds,x0=o.x+Math.min(...main.footprint.outline.map(p=>p.x)),front=o.z+h;
  const out:DrawItem[]=[{kind:'dim',layer:'A-ANNO-DIMS',a:{x:x0,y:front},b:{x:x0+w,y:front},offset:18,text:`${feetInches(w)} overall`}];
  if(depth)out.push({kind:'dim',layer:'A-ANNO-DIMS',a:{x:x0,y:o.z},b:{x:x0,y:front},offset:18,text:feetInches(h)});
  return out;
}

/** Nominal lumber size for a member depth. */
function sizeOf(depthIn:number){return depthIn<6.5?'2x6':depthIn<8.5?'2x8':depthIn<10.5?'2x10':'2x12';}
/** Beam-row centre lines of one row's plies collapse to one dimension point. */
function collapse(zs:number[]){const out:number[]=[];for(const z of zs){const last=out.at(-1);if(last!==undefined&&z-last<4)out[out.length-1]=(last+z)/2;else out.push(z);}return out;}
