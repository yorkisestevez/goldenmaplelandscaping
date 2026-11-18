import {usesPhysicalElevations} from '../elevationDatum';
import type {DeckTakeoff} from '../deckTakeoff';
import type {CompassPoint,DeckData} from '../types';
import {getHouseBlocks,houseOutline} from '../houseFootprint';
import {COMPASS_WORDS} from '../permitSite';
import {SHEET,SITE_SCALES,type DrawItem,type Pt,feetInches} from './drawingTypes';

/**
 * A-0 site plan: the lot as entered from the plan of survey (`data.permitSite`), the existing house from the house
 * model, and the proposed deck and its stairs, in the same plan as the other sheets (the wall the deck is on at y = 0,
 * the yard toward +y, left and right as seen from the yard). The deck's clear distance to the rear and side lot lines
 * is dimensioned in feet and metres; the notes give the areas and leave the required setbacks and lot coverage to the
 * municipality's zoning by-law.
 *
 * The scale is chosen from the lot first, so the labels, dimensions and north arrow can be placed in paper inches
 * around it. Figures too long for their dimension, and the deck's label when it does not fit inside the deck, go to the
 * nearest clear spot on a leader.
 */
export interface SitePlan{
  items:DrawItem[];notes:string[];scale:{ratio:number;label:string};
  /** What keeps the site plan from being complete. Each is a review item, so the set is stamped DRAFT. */
  issues:string[];
  /** Plan inches: the lot lines (null without a lot), and the deck's clear distance to the rear and side lot lines. */
  lot:{left:number;right:number;front:number;rear:number}|null;
  setbacks:{left:number;right:number;rear:number}|null;
}

type Box={minX:number;maxX:number;minY:number;maxY:number};
const TEXT=.1,SMALL=.08,FIGURE=.075,METRIC=.065;
const BEARING:Record<CompassPoint,number>={N:0,NE:45,E:90,SE:135,S:180,SW:225,W:270,NW:315};
/** Paper inches kept around the lot for its dimensions, labels and north arrow, across and down the sheet. */
const MARGIN={x:2.2,y:1.6};

const box=(pts:Pt[]):Box=>({minX:Math.min(...pts.map(p=>p.x)),maxX:Math.max(...pts.map(p=>p.x)),minY:Math.min(...pts.map(p=>p.y)),maxY:Math.max(...pts.map(p=>p.y))});
const grow=(b:Box,by:number):Box=>({minX:b.minX-by,maxX:b.maxX+by,minY:b.minY-by,maxY:b.maxY+by});
const apart=(a:Box,b:Box)=>a.maxX<=b.minX||a.minX>=b.maxX||a.maxY<=b.minY||a.minY>=b.maxY;
const gapBetween=(a:Box,b:Box)=>Math.hypot(Math.max(0,b.minX-a.maxX,a.minX-b.maxX),Math.max(0,b.minY-a.maxY,a.minY-b.maxY));
const metres=(inches:number)=>`${(inches*.0254).toFixed(2)} m`;
/** 12'-6" (3.81 m): zoning by-laws are in metres, the drawings in feet and inches. */
export const feetAndMetres=(inches:number)=>`${feetInches(inches)} (${metres(inches)})`;
const grouped=(n:number)=>String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,',');
const area=(poly:Pt[])=>Math.abs(poly.reduce((n,p,i)=>{const q=poly[(i+1)%poly.length];return n+p.x*q.y-q.x*p.y;},0))/2;
const percent=(part:number,whole:number)=>`${(part/whole*100).toFixed(1)}%`;
/** Paper width of a line of text: Helvetica's average advance is about half its height. */
const width=(t:string,height:number)=>t.length*height*.52;

/** Whether q is inside the polygon (even-odd). */
function inside(poly:Pt[],q:Pt):boolean{
  let hit=false;
  poly.forEach((a,i)=>{const b=poly[(i+1)%poly.length];if((a.y>q.y)!==(b.y>q.y)&&q.x<a.x+(q.y-a.y)*(b.x-a.x)/(b.y-a.y))hit=!hit;});
  return hit;
}
/** The point of the polygons' outlines nearest q. */
function nearest(polys:Pt[][],q:Pt):Pt{
  let best=polys[0][0],d=Infinity;
  for(const poly of polys)poly.forEach((a,i)=>{
    const b=poly[(i+1)%poly.length],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((q.x-a.x)*dx+(q.y-a.y)*dy)/(dx*dx+dy*dy||1))),p={x:a.x+dx*t,y:a.y+dy*t},e=Math.hypot(q.x-p.x,q.y-p.y);
    if(e<d){d=e;best=p;}
  });
  return best;
}
const clamp=(q:Pt,b:Box):Pt=>({x:Math.min(Math.max(q.x,b.minX),b.maxX),y:Math.min(Math.max(q.y,b.minY),b.maxY)});
function treadCorners(t:DeckTakeoff['treads'][number]):Pt[]{
  const poly=(t as typeof t&{polygon?:Pt[]}).polygon,angle=-(t.angle||0);
  return poly??[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>({x:t.x+(u*t.w/2)*Math.cos(angle)-(v*t.d/2)*Math.sin(angle),y:t.z+(u*t.w/2)*Math.sin(angle)+(v*t.d/2)*Math.cos(angle)}));
}
/** The middle of where points reach an extreme: along x at the given y extreme, or along y at the given x extreme. */
function midAt(pts:Pt[],axis:'x'|'y',value:number):number{
  const at=pts.filter(p=>Math.abs(p[axis]-value)<.5).map(p=>axis==='x'?p.y:p.x);
  return (Math.min(...at)+Math.max(...at))/2;
}

export function sitePlan(data:DeckData,model:DeckTakeoff):SitePlan{
  const site=data.permitSite,blocks=getHouseBlocks(data),house=houseOutline(data,blocks),H=box(house.flat());
  const levels=model.levels.map(l=>l.footprint.outline.map(p=>({x:p.x+l.offset.x,y:p.y+l.offset.z}))),treads=model.treads.map(treadCorners);
  const deckPts=[...levels.flat(),...treads.flat()],D=box(deckPts);
  const lot=site?{left:H.minX-site.leftYardFt*12,right:H.minX-site.leftYardFt*12+site.lotWidthFt*12,rear:site.rearYardFt*12,front:site.rearYardFt*12-site.lotDepthFt*12}:null;
  const lotBox=lot&&{minX:lot.left,maxX:lot.right,minY:lot.front,maxY:lot.rear};
  const G=box([...house.flat(),...deckPts,...(lot?[{x:lot.left,y:lot.front},{x:lot.right,y:lot.rear}]:[])]);
  const scale=SITE_SCALES.find(s=>(G.maxX-G.minX)/s.ratio+MARGIN.x<=SHEET.area.w&&(G.maxY-G.minY)/s.ratio+MARGIN.y<=SHEET.area.h)??SITE_SCALES.at(-1)!;
  // p: plan inches per paper inch, so paper sizes times p are plan sizes.
  const p=scale.ratio,items:DrawItem[]=[],issues:string[]=[],notes:string[]=[];
  // What placed labels keep clear of: the house, the deck, every dimension and label, the lot lines.
  const taken:Box[]=[grow(H,.03*p),grow(D,.03*p)];
  const reach=grow(G,.8*p);
  const text=(at:Pt,t:string,height:number,anchor:'start'|'middle'|'end'='middle',rotate?:number)=>{
    items.push({kind:'text',layer:'A-ANNO-TEXT',at,text:t,height,anchor,...(rotate?{rotate}:{})});
    const w=width(t,height)*p,h=height*p,x0=anchor==='start'?0:anchor==='middle'?-w/2:-w;
    taken.push(grow(rotate?{minX:at.x-h,maxX:at.x+.3*h,minY:at.y-x0-w,maxY:at.y-x0}:{minX:at.x+x0,maxX:at.x+x0+w,minY:at.y-h,maxY:at.y+.3*h},.03*p));
  };
  /** The clear w × h box nearest `near` (paper tenths apart), inside `within`: null when there is none. */
  const place=(w:number,h:number,near:Box,within:Box):Box|null=>{
    let best:Box|null=null,bestGap=Infinity;
    for(let y=within.minY;y+h<=within.maxY;y+=.1*p)for(let x=within.minX;x+w<=within.maxX;x+=.1*p){
      const b={minX:x,maxX:x+w,minY:y,maxY:y+h},g=gapBetween(b,near);
      if(g>=.04*p&&g<bestGap&&taken.every(o=>apart(b,o))){best=b;bestGap=g;}
    }
    return best;
  };
  const leader=(from:Pt,to:Box)=>{const end=clamp(from,to);if(Math.hypot(end.x-from.x,end.y-from.y)>.05*p)items.push({kind:'line',layer:'A-ANNO-TEXT',a:from,b:end});};

  /**
   * A dimension in feet and inches with its metres on the next line as the text reads (across the dimension line when
   * the text sits above it). When the figures are longer than the dimension, the dimension keeps its ticks and the
   * figures go to the nearest clear spot on a leader.
   */
  const dim=(a:Pt,b:Pt,offset=0)=>{
    const len=Math.hypot(b.x-a.x,b.y-a.y);if(len<1)return;
    const u={x:(b.x-a.x)/len,y:(b.y-a.y)/len},n={x:-u.y,y:u.x},side=Math.sign(offset||1),ft=feetInches(len),m=`(${metres(len)})`;
    const mid={x:(a.x+b.x)/2+n.x*offset,y:(a.y+b.y)/2+n.y*offset};
    if(len>=Math.max(width(ft,FIGURE),width(m,METRIC))*p+.1*p){
      let angle=Math.atan2(u.y,u.x)*180/Math.PI;if(angle>=90)angle-=180;if(angle<-90)angle+=180;
      const t=angle*Math.PI/180,down={x:-Math.sin(t),y:Math.cos(t)},k=side*.05*p;
      items.push({kind:'dim',layer:'A-ANNO-DIMS',a,b,offset,text:ft});
      items.push({kind:'text',layer:'A-ANNO-TEXT',at:{x:mid.x+n.x*k+down.x*.13*p,y:mid.y+n.y*k+down.y*.13*p},text:m,height:METRIC,anchor:'middle',...(angle?{rotate:angle}:{})});
      taken.push(grow(box([-.15,.28].flatMap(s=>[a,b].map(q=>({x:q.x+n.x*(offset+side*s*p),y:q.y+n.y*(offset+side*s*p)})))),.05*p));
      return;
    }
    const pa={x:a.x+n.x*offset,y:a.y+n.y*offset},pb={x:b.x+n.x*offset,y:b.y+n.y*offset},s={x:(u.x+n.x)*.04*p,y:(u.y+n.y)*.04*p};
    items.push({kind:'line',layer:'A-ANNO-DIMS',a:pa,b:pb});
    for(const q of [pa,pb])items.push({kind:'line',layer:'A-ANNO-DIMS',a:{x:q.x-s.x,y:q.y-s.y},b:{x:q.x+s.x,y:q.y+s.y}});
    taken.push(grow(box([pa,pb]),.05*p));
    const w=(Math.max(width(ft,FIGURE),width(m,METRIC))+.06)*p,h=.3*p,spot=place(w,h,grow(box([pa,pb]),0),reach)??{minX:mid.x+.1*p,maxX:mid.x+.1*p+w,minY:mid.y+.1*p,maxY:mid.y+.1*p+h};
    const cx=(spot.minX+spot.maxX)/2;
    items.push({kind:'text',layer:'A-ANNO-DIMS',at:{x:cx,y:spot.minY+.12*p},text:ft,height:FIGURE,anchor:'middle'});
    items.push({kind:'text',layer:'A-ANNO-TEXT',at:{x:cx,y:spot.minY+.24*p},text:m,height:METRIC,anchor:'middle'});
    taken.push(spot);
    leader(mid,spot);
  };

  // The existing house, labelled on its main block (and a garage on its own block).
  for(const poly of house)items.push({kind:'poly',closed:true,layer:'A-HOUS',points:poly});
  for(const b of blocks.filter(b=>b.kind==='garage'))if(b.rect.x1-b.rect.x0>=width('GARAGE',SMALL)*p+.1*p&&b.rect.y1-b.rect.y0>=.2*p)text({x:(b.rect.x0+b.rect.x1)/2,y:(b.rect.y0+b.rect.y1)/2+.03*p},'GARAGE',SMALL);
  // The proposed deck and its stairs. The house and the deck are labelled once everything else is placed.
  levels.forEach(points=>items.push({kind:'poly',closed:true,layer:'A-DECK-OTLN',points}));
  treads.forEach(points=>items.push({kind:'poly',closed:true,layer:'A-STRS',points}));
  const deckSqft=model.quantities.area,houseSqft=house.reduce((n,poly)=>n+area(poly),0)/144;

  let setbacks:SitePlan['setbacks']=null;
  if(!site||!lot){
    issues.push('Site plan: enter the lot from the plan of survey (its width and depth, and the house\'s left side yard and rear yard) to draw the property lines and setbacks.');
    text({x:(G.minX+G.maxX)/2,y:G.maxY+.45*p},'PROPERTY LINES NOT ENTERED',TEXT);
    notes.push(
      'The lot is not entered yet, so this sheet shows the house and the proposed deck only. Enter the lot from the plan of survey in the permit drawings to add the property lines and the deck\'s setbacks.',
      `Proposed deck ${grouped(deckSqft)} sq ft (levels and landings); existing house footprint about ${grouped(houseSqft)} sq ft, from the design's house model.`,
    );
  }else{
    const {left:L,right:R,front:F,rear:B}=lot,W=R-L,Dp=B-F,cx=(L+R)/2,cy=(F+B)/2;
    items.push({kind:'poly',closed:true,layer:'C-PROP',points:[{x:L,y:F},{x:R,y:F},{x:R,y:B},{x:L,y:B}]});
    taken.push(...[[L,F,R,F],[R,F,R,B],[L,B,R,B],[L,F,L,B]].map(([x0,y0,x1,y1])=>grow({minX:x0,maxX:x1,minY:y0,maxY:y1},.03*p)));
    // The lot's width above the street line and its depth outside the right-hand line, then each line named.
    dim({x:R,y:F},{x:L,y:F},.3*p);
    dim({x:R,y:B},{x:R,y:F},.3*p);
    text({x:cx,y:F-.62*p},'FRONT LOT LINE · STREET',TEXT);
    text({x:cx,y:B+.24*p},'REAR LOT LINE',SMALL);
    text({x:L-.12*p,y:cy},site.corner==='left'?'LEFT SIDE LOT LINE · STREET':'LEFT SIDE LOT LINE',SMALL,'middle',-90);
    text({x:R+.62*p,y:cy},site.corner==='right'?'RIGHT SIDE LOT LINE · STREET':'RIGHT SIDE LOT LINE',SMALL,'middle',-90);

    // North, from the way the back yard faces (+y on the plan): bearing b points (b − yard + 90)° from +x, y down.
    if(site.yardFaces){
      const a=(90-BEARING[site.yardFaces])*Math.PI/180,d={x:Math.cos(a),y:Math.sin(a)},n={x:-d.y,y:d.x},c={x:L-.55*p,y:F+.3*p},at=(k:number,s=0)=>({x:c.x+d.x*k*p+n.x*s*p,y:c.y+d.y*k*p+n.y*s*p});
      items.push({kind:'circle',layer:'A-ANNO-TEXT',c,r:.22*p},{kind:'poly',closed:true,layer:'A-ANNO-TEXT',points:[at(.19),at(-.13,.07),at(-.05),at(-.13,-.07)]});
      text({x:c.x+d.x*.34*p,y:c.y+d.y*.34*p+.035*p},'N',TEXT);
      taken.push(grow({minX:c.x-.22*p,maxX:c.x+.22*p,minY:c.y-.22*p,maxY:c.y+.22*p},.03*p));
    }else issues.push('Site plan: choose which way the back yard faces, so the sheet can show north.');

    // The house's yards as entered (its rear yard runs under the deck, so it is in the notes), then the deck's setbacks.
    // A side yard is dimensioned toward the street end of its block, clear of a deck wing along the house, and left to
    // the notes when it would lie on the deck's own side dimension.
    setbacks={left:D.minX-L,right:R-D.maxX,rear:B-D.maxY};
    const leftBlock=blocks.find(b=>Math.abs(b.rect.x0-H.minX)<.5)!.rect,rightBlock=blocks.find(b=>Math.abs(b.rect.x1-H.maxX)<.5)!.rect,frontBlock=blocks.find(b=>Math.abs(b.rect.y0-H.minY)<.5)!.rect;
    const yl=leftBlock.y0+(leftBlock.y1-leftBlock.y0)/4,yr=rightBlock.y0+(rightBlock.y1-rightBlock.y0)/4,deckYl=midAt(deckPts,'x',D.minX),deckYr=midAt(deckPts,'x',D.maxX);
    if(!(setbacks.left>0&&Math.abs(yl-deckYl)<.35*p))dim({x:L,y:yl},{x:H.minX,y:yl});
    if(R>H.maxX&&!(setbacks.right>0&&Math.abs(yr-deckYr)<.35*p))dim({x:H.maxX,y:yr},{x:R,y:yr});
    if(F<H.minY)dim({x:(frontBlock.x0+frontBlock.x1)/2,y:F},{x:(frontBlock.x0+frontBlock.x1)/2,y:H.minY});
    if(setbacks.rear>0)dim({x:midAt(deckPts,'y',D.maxY),y:D.maxY},{x:midAt(deckPts,'y',D.maxY),y:B});
    if(setbacks.left>0)dim({x:L,y:deckYl},{x:D.minX,y:deckYl});
    if(setbacks.right>0)dim({x:D.maxX,y:deckYr},{x:R,y:deckYr});

    // The lot has to hold the house as modelled, and the deck has to stay inside it.
    if(R<H.maxX-.5)issues.push('Site plan: the lot as entered is narrower than the house and its left side yard. Check the lot width, the side yard and the house width against the survey.');
    if(F>H.minY+.5)issues.push('Site plan: the lot as entered is shallower than the house and its rear yard. Check the lot depth, the rear yard and the house depth against the survey.');
    const crossed=[setbacks.rear<=0&&'rear',setbacks.left<=0&&'left side',setbacks.right<=0&&'right side',D.minY<=F&&'front'].filter(Boolean);
    if(crossed.length)issues.push(`Site plan: the deck reaches the ${crossed.join(' and ')} lot line as entered. Check the lot against the survey, or move the deck.`);

    const lotSqft=W*Dp/144;
    notes.push(
      `Lot ${feetAndMetres(W)} × ${feetAndMetres(Dp)}, ${grouped(lotSqft)} sq ft (${grouped(lotSqft*.09290304)} m²), with the house ${feetAndMetres(site.leftYardFt*12)} from the left side lot line and ${feetAndMetres(site.rearYardFt*12)} from the rear lot line, as entered from the plan of survey. Confirm the lot lines on site.`,
      `Deck setbacks, measured to the deck's outer edge and its stairs: ${([[setbacks.rear,'the rear lot line'],[setbacks.left,'the left side lot line'],[setbacks.right,'the right side lot line']] as [number,string][]).map(([d,line])=>d>0?`${feetAndMetres(d)} to ${line}`:`over ${line} by ${feetAndMetres(-d)}`).join(', ')}.`,
      `Proposed deck ${grouped(deckSqft)} sq ft (levels and landings), ${percent(deckSqft,lotSqft)} of the lot. Existing house footprint about ${grouped(houseSqft)} sq ft, ${percent(houseSqft,lotSqft)} of the lot, from the design's house model: it is approximate.`,
      'Confirm the required setbacks, and whether the deck counts toward lot coverage, with the municipality\'s zoning by-law.',
      ...(site.corner?[`Corner lot: a street runs along the ${site.corner} side lot line.`]:[]),
      ...(site.yardFaces?[`North is drawn from the back yard facing ${COMPASS_WORDS[site.yardFaces]}, as entered.`]:[]),
    );
  }

  // The house and the deck are labelled inside their main block or level when the label fits there, otherwise at the
  // clear spot nearest them (inside the lot when there is one) on a leader from their outline.
  const tag=(lines:[string,number][],polys:Pt[][],within:Pt[],near:Box)=>{
    const w=Math.max(...lines.map(([t,h])=>width(t,h)))*p+.1*p,h=(lines.length*.14+.02)*p,M=box(within);
    const centred={minX:(M.minX+M.maxX)/2-w/2,maxX:(M.minX+M.maxX)/2+w/2,minY:(M.minY+M.maxY)/2-h/2,maxY:(M.minY+M.maxY)/2+h/2};
    const room=[{x:centred.minX,y:centred.minY},{x:centred.maxX,y:centred.minY},{x:centred.maxX,y:centred.maxY},{x:centred.minX,y:centred.maxY}].every(q=>inside(within,q));
    const spot=room?centred:place(w,h,near,lotBox??reach)??{minX:near.maxX+.12*p,maxX:near.maxX+.12*p+w,minY:(near.minY+near.maxY)/2-h/2,maxY:(near.minY+near.maxY)/2+h/2};
    lines.forEach(([t,size],i)=>items.push({kind:'text',layer:'A-ANNO-TEXT',at:{x:(spot.minX+spot.maxX)/2,y:spot.minY+(.1+i*.14)*p},text:t,height:size,anchor:'middle'}));
    taken.push(spot);
    if(!room)leader(nearest(polys,{x:(spot.minX+spot.maxX)/2,y:(spot.minY+spot.maxY)/2}),spot);
  };
  const main=blocks[0].rect;
  tag([['EXISTING HOUSE',TEXT],[`${blocks[0].storeys}-storey, as modelled`,SMALL]],house,[{x:main.x0,y:main.y0},{x:main.x1,y:main.y0},{x:main.x1,y:main.y1},{x:main.x0,y:main.y1}],H);
  tag([['PROPOSED DECK',TEXT],[`${grouped(deckSqft)} sq ft`,SMALL],[`${feetInches(model.levels[0].top)} ${usesPhysicalElevations(data)?'relative to project datum':'above grade'}`,SMALL]],levels,levels[0],D);

  notes.push(
    'Add anything this sheet does not show, with its distance to the deck: a shed, pool, detached garage, fence, easement, or a well or septic system.',
    data.projectAddress.trim()?`Municipal address: ${data.projectAddress.trim()}.`:'Write the municipal address, and the lot and plan numbers from the survey, on this sheet.',
  );
  return {items,notes,scale,issues,lot,setbacks};
}
