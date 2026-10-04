import type {DeckInlay,InlayFill} from '../types';
import {getBoardRows,getHerringboneRows,getPictureFrameRuns,type BoardRun,type FootprintPlan,type PlanPoint} from './deckGeometry';
import {offsetPolygons,polygonBoard,polygonCut,signedArea} from './polygonCuts';
import {bandWidthIn,inlayOutline,registerInlayGeometry,type InlayContext,type InlayPlan,type InlayStatus} from './inlayGeometry';
type Band=Extract<DeckInlay,{kind:'band'}>;
const MESSAGES:Record<Exclude<InlayStatus,'ok'|'blocked'>,string>={
  outside:'It reaches past the deck’s field. Keep one full board between it and the deck’s edge or border: make it smaller or move it.',
  overlap:'It overlaps another inlay. Move it or make it smaller.',
  small:'It is too small for its frame: the inside needs room for at least two boards.',
};
const BAND_OUTSIDE='It runs alongside the deck’s edge, border or a corner of the deck. Keep one full board beside it: move it.';
const area=(polys:PlanPoint[][])=>polys.reduce((n,p)=>n+Math.abs(signedArea(p)),0);
const perimeter=(p:PlanPoint[])=>p.reduce((n,a,i)=>{const b=p[(i+1)%p.length];return n+Math.hypot(b.x-a.x,b.y-a.y);},0);
const bounds=(polys:PlanPoint[][])=>{const v=polys.flat();return {x0:Math.min(...v.map(p=>p.x)),x1:Math.max(...v.map(p=>p.x)),y0:Math.min(...v.map(p=>p.y)),y1:Math.max(...v.map(p=>p.y))};};
const rect=(x0:number,y0:number,x1:number,y1:number):PlanPoint[]=>[{x:x0,y:y0},{x:x1,y:y0},{x:x1,y:y1},{x:x0,y:y1}];
/** A medallion's 16 sides: vertices every 22.5°, the first on the +x axis (so a compass's wedges point along the axes). */
const MEDALLION_SIDES=16;
const polygonAround=(c:PlanPoint,r:number)=>Array.from({length:MEDALLION_SIDES},(_,j)=>{const a=j*2*Math.PI/MEDALLION_SIDES;return {x:c.x+r*Math.cos(a),y:c.y+r*Math.sin(a)};});
const rotatePoints=(points:PlanPoint[],c:PlanPoint,angle:number)=>{
  if(!angle)return points;
  const a=angle*Math.PI/180,co=Math.cos(a),si=Math.sin(a);
  return points.map(p=>({x:c.x+(p.x-c.x)*co-(p.y-c.y)*si,y:c.y+(p.x-c.x)*si+(p.y-c.y)*co}));
};

function bandSpan(band:Band,ctx:InlayContext){
  const {fieldPolygons,boardWidth:bw,gap}=ctx,pitch=bw+gap,w=bandWidthIn(band.boards,bw,gap),b=bounds(fieldPolygons);
  const across=band.direction==='across',target=(across?ctx.centre.y:ctx.centre.x)+(band.atFt??0)*12-w/2,lo=across?b.y0:b.x0,hi=across?b.y1:b.x1;
  if(across&&ctx.straight){
    // A straight field's rows start at its near side, a pitch apart (getBoardRows); count its full-width rows.
    let full=0;while(lo+full*pitch+bw<=hi+.001)full++;
    const k=Math.round((target-lo)/pitch);
    return {from:lo+k*pitch,to:lo+k*pitch+w,rows:true,fits:k>=1&&k+band.boards<=full-1};
  }
  return {from:target,to:target+w,rows:false,fits:target-pitch>=lo-.001&&target+w+pitch<=hi+.001};
}

export function planInlays(inlays:DeckInlay[],ctx:InlayContext,opts:{boards?:boolean;taken?:PlanPoint[][];allowed?:PlanPoint[][]}={}):InlayPlan[]{
  const {fieldPolygons,boardWidth,gap,stockLength,centre}=ctx,pitch=boardWidth+gap,withBoards=opts.boards!==false;
  // At least one full field board (plus its gap) between an inlay and the field's edge.
  const allowed=opts.allowed??offsetPolygons(fieldPolygons,pitch),built:PlanPoint[][]=[...(opts.taken??[])];
  const overlaps=(pieces:PlanPoint[][])=>built.some(o=>area(polygonCut(pieces,[o]))>1);
  const fp=(poly:PlanPoint[],c:PlanPoint):FootprintPlan=>({outline:poly,bounds:{w:2*c.x,h:2*c.y},isCurved:false});
  // Slivers under a square inch, where a pattern meets a frame, are a gap, not a board anyone would cut.
  const real=(runs:BoardRun[])=>runs.filter(b=>!b.polygon||Math.abs(signedArea(b.polygon))>=1);
  return inlays.map(inlay=>{
    if(inlay.kind==='band'){
      const span=bandSpan(inlay,ctx),across=inlay.direction==='across',b=bounds(fieldPolygons);
      const strip=across?rect(b.x0-12,span.from,b.x1+12,span.to):rect(span.from,b.y0-12,span.to,b.y1+12);
      const pieces=polygonCut(fieldPolygons,[strip]).filter(p=>Math.abs(signedArea(p))>1).sort((p,q)=>Math.abs(signedArea(q))-Math.abs(signedArea(p)));
      // The fitted edge runs the band's length: across it, a piece's width; front to back, its depth.
      const length=pieces.reduce((n,p)=>{const pb=bounds([p]);return n+(across?pb.x1-pb.x0:pb.y1-pb.y0);},0)/12;
      const base={id:inlay.id,kind:inlay.kind,frameRows:1 as const,pattern:'Straight' as const,outline:pieces[0]??[],inner:[] as PlanPoint[],pieces,boards:[] as BoardRun[],
        edgeFt:span.rows?0:length,fillSqft:area(pieces)/144,band:{direction:inlay.direction,from:span.from,to:span.to,boards:inlay.boards,rows:span.rows}};
      if(ctx.blocked)return {...base,status:'blocked' as const,message:ctx.blocked};
      // A field edge running beside the band (an inside corner of an L or a custom outline) needs a full board too.
      const beside=fieldPolygons.some(poly=>poly.some((p,i)=>{const q=poly[(i+1)%poly.length],at=across?p.y:p.x;
        if(Math.abs(across?q.y-p.y:q.x-p.x)>.01||Math.hypot(q.x-p.x,q.y-p.y)<1||at<=span.from-pitch+.01||at>=span.to+pitch-.01)return false;
        const e0=Math.min(across?p.x:p.y,across?q.x:q.y),e1=Math.max(across?p.x:p.y,across?q.x:q.y);
        return pieces.some(piece=>{const pb=bounds([piece]);return across?e0<pb.x1-.5&&e1>pb.x0+.5:e0<pb.y1-.5&&e1>pb.y0+.5;});}));
      if(!span.fits||!pieces.length||beside)return {...base,status:'outside' as const,message:BAND_OUTSIDE};
      if(overlaps(pieces))return {...base,status:'overlap' as const,message:MESSAGES.overlap};
      built.push(...pieces);
      // Cut in: the band's boards run its length, in rows that exactly fill its width.
      const boards=!withBoards||span.rows?[]:pieces.flatMap(piece=>real(getBoardRows(fp(piece,centre),{boardWidth,gap,angleDeg:across?0:90,inset:0,maxBoardLen:stockLength}))).map(r=>({...r,role:'inlay-fill' as const,inlay:inlay.id}));
      return {...base,status:'ok' as const,boards};
    }
    const medallion=inlay.kind==='medallion',custom=inlay.kind==='custom',rotation=inlay.rotationDeg??0,complex=custom||Math.abs(rotation%360)>1e-8,frameRows=medallion?1:inlay.frameRows??1,pattern:InlayFill=medallion?'Straight':inlay.pattern??'Straight',outline=inlayOutline(inlay,centre);
    const c={x:centre.x+(inlay.dxFt??0)*12,y:centre.y+(inlay.dyFt??0)*12};
    // A medallion's inside keeps its 16 sides, one frame row in (so its wedges line up with the vertices).
    const interiors=inlay.kind==='medallion'?[rotatePoints(polygonAround(c,inlay.diameterFt*6-pitch/Math.cos(Math.PI/MEDALLION_SIDES)),c,rotation)]:offsetPolygons([outline],frameRows*pitch);
    const inner=interiors[0]??[];
    const base={id:inlay.id,kind:inlay.kind,frameRows,pattern,outline,inner,pieces:[outline],boards:[] as BoardRun[],edgeFt:perimeter(outline)/12,fillSqft:inner.length?Math.abs(signedArea(inner))/144:0,
      ...(custom?{inners:interiors,fillSqft:area(interiors)/144}:{}),
      ...(medallion||complex?{solid:offsetPolygons([outline],-boardWidth)[0]??outline,quote:true}:{})};
    if(ctx.blocked)return {...base,status:'blocked' as const,message:ctx.blocked};
    let status:InlayStatus='ok';
    if(!inner.length||!offsetPolygons(interiors,pitch*.99).length)status='small';
    else if(area(polygonCut([outline],allowed,true))>1)status='outside';
    else if(overlaps([outline]))status='overlap';
    if(status!=='ok')return {...base,status,message:MESSAGES[status]};
    built.push(outline);
    if(!withBoards)return {...base,status};
    const frame=getPictureFrameRuns(fp(outline,c),frameRows,boardWidth,gap).map(b=>({...b,role:'inlay-frame' as const,inlay:inlay.id}));
    const unrotate=(p:PlanPoint[])=>rotatePoints(p,c,-rotation),rotateRun=(b:BoardRun):BoardRun=>{
      if(!rotation)return b;
      const middle=rotatePoints([{x:b.cx,y:b.cy}],c,rotation)[0];
      return {...b,cx:middle.x,cy:middle.y,angleDeg:b.angleDeg+rotation,...(b.polygon?{polygon:rotatePoints(b.polygon,c,rotation)}:{})};
    };
    const medallionFill=inlay.kind==='medallion'&&inlay.style!=='round'
      ?(inlay.style==='compass'?compassWedges(c,unrotate(inner),inlay.diameterFt*6,ctx):radialMedallion(c,unrotate(inner),inlay.style,ctx)).map(rotateRun):null;
    const fill=medallionFill?medallionFill.map(b=>({...b,inlay:inlay.id}))
      :interiors.flatMap(poly=>real(pattern==='Herringbone'?getHerringboneRows(fp(unrotate(poly),c),boardWidth,gap,0).map(rotateRun):getBoardRows(fp(poly,c),{boardWidth,gap,angleDeg:(pattern==='Diagonal'?45:90)+rotation,inset:0,maxBoardLen:stockLength}))).map(b=>({...b,role:'inlay-fill' as const,inlay:inlay.id}));
    return {...base,status,boards:[...frame,...fill]};
  });
}

/** A compass medallion's inside: eight wedges pointing along the axes and the diagonals, a board gap between them. Each
 * wedge's boards run along its outer edge, starting there (so the ripped piece falls at the middle), and the wedges
 * alternate between the inside colour ('inlay-fill') and the frame colour ('inlay-frame'). */
function compassWedges(c:PlanPoint,inner:PlanPoint[],radius:number,ctx:InlayContext):BoardRun[]{
  const {boardWidth,gap,stockLength}=ctx,v=(j:number)=>inner[((j%MEDALLION_SIDES)+MEDALLION_SIDES)%MEDALLION_SIDES],far=radius+12;
  const joint=(a:number)=>{const d={x:Math.cos(a),y:Math.sin(a)},n={x:-d.y*gap/2,y:d.x*gap/2};return [{x:c.x+n.x,y:c.y+n.y},{x:c.x+d.x*far+n.x,y:c.y+d.y*far+n.y},{x:c.x+d.x*far-n.x,y:c.y+d.y*far-n.y},{x:c.x-n.x,y:c.y-n.y}];};
  const joints=Array.from({length:8},(_,i)=>joint((2*i+1)*Math.PI/8));
  return Array.from({length:8},(_,i)=>{
    // Boards square to the wedge's direction (45i°): rows start at its outer tip (getBoardRows starts at the low side).
    const angleDeg=(45*i+90)%360,wedge=[c,v(2*i-1),v(2*i),v(2*i+1)];
    return polygonCut([wedge],joints,true).flatMap(piece=>getBoardRows({outline:piece,bounds:{w:2*c.x,h:2*c.y},isCurved:false},{boardWidth,gap,angleDeg,inset:0,maxBoardLen:stockLength}))
      .filter(b=>!b.polygon||Math.abs(signedArea(b.polygon))>=1).map(b=>({...b,role:i%2?'inlay-frame' as const:'inlay-fill' as const}));
  }).flat();
}

/** Sixteen radial rays, or an eight-point rose with split colour halves and a real surrounding field.
 * Sector domains meet at the centre, so subtracting the rose never creates a discarded polygon hole. */
function radialMedallion(c:PlanPoint,inner:PlanPoint[],style:'compass-rose'|'sunburst',ctx:InlayContext):BoardRun[]{
  const {boardWidth,gap,stockLength}=ctx,radius=Math.hypot(inner[0].x-c.x,inner[0].y-c.y);
  const ray=(a:number,r:number)=>({x:c.x+Math.cos(a)*r,y:c.y+Math.sin(a)*r});
  const spokeJoints=Array.from({length:16},(_,i)=>{
    const a=i*Math.PI/8,tip=ray(a,radius+12),nx=-Math.sin(a)*gap/2,ny=Math.cos(a)*gap/2;
    return [{x:c.x+nx,y:c.y+ny},{x:tip.x+nx,y:tip.y+ny},{x:tip.x-nx,y:tip.y-ny},{x:c.x-nx,y:c.y-ny}];
  });
  const rose=Array.from({length:16},(_,i)=>ray(i*Math.PI/8,i%2?radius*.30:radius*(i%4===0?.97:.72))),grownRose=offsetPolygons([rose],-gap/2);
  const rows=(polys:PlanPoint[][],angle:number,role:'inlay-fill'|'inlay-frame')=>polys.flatMap(outline=>getBoardRows({outline,bounds:{w:2*c.x,h:2*c.y},isCurved:false},{boardWidth,gap,angleDeg:angle,inset:0,maxBoardLen:stockLength})).filter(b=>!b.polygon||Math.abs(signedArea(b.polygon))>=1).map(b=>({...b,role}));
  return inner.flatMap((a,i)=>{
    const b=inner[(i+1)%inner.length],sector=[c,a,b];
    if(style==='sunburst')return rows(polygonCut([sector],spokeJoints,true),(i+.5)*22.5,i%2?'inlay-frame':'inlay-fill');
    const star=polygonCut([[c,rose[i],rose[(i+1)%16]]],spokeJoints,true),background=polygonCut(polygonCut([sector],grownRose,true),spokeJoints,true);
    return [...rows(star,Math.floor((i+1)/2)*45,i%2?'inlay-frame':'inlay-fill'),...rows(background,90,'inlay-fill')];
  });
}


registerInlayGeometry({planInlays});
