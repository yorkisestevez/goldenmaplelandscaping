import {usesPhysicalElevations} from '../elevationDatum';
import type {DeckData} from '../types';
import type {DeckTakeoff} from '../deckTakeoff';
import {deckExportMeshes,extrudePolygon} from '../designExports';
import {type DrawItem,type LayerId,type Pt,feetInches,fitScale,itemPoints} from './drawingTypes';
import {buildElevationProfile,elevationLabel} from '../elevationProfiles';
import {sampleSiteHeight} from '../siteSurface';
import {type ElevationView,type Solid,mergeLines,project,viewLines} from './hiddenLines';

/**
 * Sheet A-1: the front, left and right elevations, projected from the same solids as the 3D model and the OBJ/DXF
 * export (designExports.ts), with hidden lines removed. Each level's decking is drawn as one slab (the boards'
 * outline); hardware too small to read at scale is left out. The house is drawn for context, cut where it runs past
 * the deck. Ground follows each marked datum section; legacy drawings retain the zero-grade assumption.
 */
const PARTS:[RegExp,LayerId,LayerId?][]=[
  [/^house_/,'A-HOUS'],
  [/^level_\d+_(joist|rim|blocking)_\d+$/,'S-FRMG'],
  [/^level_\d+_beam_\d+$/,'S-BEAM'],
  [/^level_\d+_(post|post_base)_\d+$/,'S-POST'],
  [/^level_\d+_(concrete_pier|pile_shaft|pile_helix|deck_block)_\d+$/,'S-FTNG','S-FTNG-HIDN'],
  [/^(stair_tread_board|closed_stair_riser|stair_stringer|stair_veneer_2x6|stair_veneer_angle)_\d+$/,'A-STRS'],
  [/^(railing_post|rail|baluster|glass_panel|glass_base_shoe|glass_spigot|glass_handrail|glass_handrail_bracket)_\d+$/,'A-RAIL'],
  [/^(manufacturer_fascia_|skirting_|cladding_|rim_corner_filler_)/,'A-DECK-FNSH'],
  [/^(bench_privacy_pergola_wood|extra_metal|privacy_panel|aluminum_pergola_[a-z_]+)_\d+$/,'A-DECK-EXTR'],
];
/** How far past the deck the house is drawn, and how high above the highest deck surface (the front shows its door;
 * a side view only the wall's end, so it stops just above the guard). */
const HOUSE_SIDE=48,HOUSE_ABOVE=84,GAP=60;
const TITLES:Record<ElevationView,string>={front:'FRONT ELEVATION',left:'LEFT SIDE ELEVATION',right:'RIGHT SIDE ELEVATION'};

/** The design's solids for the elevations, each on its layer. */
export function elevationSolids(data:DeckData,model:DeckTakeoff):Solid[]{
  const physical=usesPhysicalElevations(data),solids:Solid[]=[],boards=new Set<number>();
  model.levels.forEach((l,i)=>{
    const slab=(outline:{x:number;y:number}[])=>extrudePolygon(`level_${i+1}_decking`,outline,(p,t)=>({x:p.x+l.offset.x,y:l.top-1+t,z:p.y+l.offset.z}));
    // An outline the slab cannot be made from falls back to the level's own boards.
    try{solids.push({...slab((l.deckingFootprint??l.footprint).outline),layer:'A-DECK-FNSH'});}
    catch{try{solids.push({...slab(l.footprint.outline),layer:'A-DECK-FNSH'});}catch{boards.add(i+1);}}
  });
  for(const m of deckExportMeshes(data,model)){
    const board=/^level_(\d+)_board_\d+$/.exec(m.name);
    if(board){if(boards.has(Number(board[1])))solids.push({vertices:m.vertices,faces:m.faces,layer:'A-DECK-FNSH'});continue;}
    const part=PARTS.find(([re])=>re.test(m.name));
    if(part){const foundation=/^level_(\d+)_(concrete_pier|pile_shaft|pile_helix|deck_block)_(\d+)$/.exec(m.name),datum=foundation?model.foundationSupports?.find(s=>s.levelIndex===Number(foundation[1])-1&&s.supportIndex===Number(foundation[3])):undefined;solids.push({vertices:m.vertices,faces:m.faces,layer:part[1],...(part[2]?{belowGrade:part[2]}:{}),...(physical?{gradeElevationIn:datum?.gradeElevationIn??-Infinity}:{})});}
  }
  return solids;
}

/** Keep the part of a → b inside the box (Liang–Barsky), or null. */
function clip(a:Pt,b:Pt,box:{x0:number;x1:number;y0:number;y1:number}):[Pt,Pt]|null{
  let t0=0,t1=1;const dx=b.x-a.x,dy=b.y-a.y;
  for(const [p,q] of [[-dx,a.x-box.x0],[dx,box.x1-a.x],[-dy,a.y-box.y0],[dy,box.y1-a.y]]){
    if(Math.abs(p)<1e-12){if(q<0)return null;continue;}
    const r=q/p;if(p<0)t0=Math.max(t0,r);else t1=Math.min(t1,r);if(t0>t1)return null;
  }
  return [{x:a.x+dx*t0,y:a.y+dy*t0},{x:a.x+dx*t1,y:a.y+dy*t1}];
}
/** A break line from a to b: straight, with the zigzag at its middle. */
function breakLine(a:Pt,b:Pt):DrawItem{
  const len=Math.hypot(b.x-a.x,b.y-a.y),t={x:(b.x-a.x)/len,y:(b.y-a.y)/len},n={x:-t.y,y:t.x},m={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
  const at=(s:number,h:number):Pt=>({x:m.x+t.x*s+n.x*h,y:m.y+t.y*s+n.y*h});
  return {kind:'poly',closed:false,layer:'A-HOUS',points:[a,at(-5,0),at(-2,6),at(2,-6),at(5,0),b]};
}
export function translate(items:DrawItem[],dx:number,dy:number):DrawItem[]{
  const m=(p:Pt):Pt=>({x:p.x+dx,y:p.y+dy});
  return items.map(i=>i.kind==='line'||i.kind==='dim'?{...i,a:m(i.a),b:m(i.b)}:i.kind==='poly'?{...i,points:i.points.map(m)}:i.kind==='circle'?{...i,c:m(i.c)}:{...i,at:m(i.at)});
}
function bounds(items:DrawItem[]){
  const pts=items.flatMap(itemPoints);
  return {minX:Math.min(...pts.map(p=>p.x)),maxX:Math.max(...pts.map(p=>p.x)),minY:Math.min(...pts.map(p=>p.y)),maxY:Math.max(...pts.map(p=>p.y))};
}

/** One elevation, in sheet orientation: x = u across the view, y = −v (down the page), grade at y = 0. */
function elevation(data:DeckData,model:DeckTakeoff,solids:Solid[],view:ElevationView,withGuard:boolean,withFooting:boolean):DrawItem[]{
  const physical=usesPhysicalElevations(data),lines=viewLines(solids,view),deck=lines.filter(l=>l.layer!=='A-HOUS'),house=lines.filter(l=>l.layer==='A-HOUS');
  const us=deck.flatMap(l=>[l.a.x,l.b.x]),uMin=Math.min(...us),uMax=Math.max(...us);
  const tops=model.levels.map(l=>l.top),highest=Math.max(...tops),cap=highest+(view==='front'?HOUSE_ABOVE:Math.max(model.railing.height,36)+12);
  const box={x0:uMin-HOUSE_SIDE,x1:uMax+HOUSE_SIDE,y0:-1e6,y1:cap};
  const items:DrawItem[]=[];
  for(const l of deck)items.push({kind:'line',layer:l.layer,a:{x:l.a.x,y:-l.a.y},b:{x:l.b.x,y:-l.b.y}});
  const kept=house.map(l=>clip(l.a,l.b,box)).filter((c):c is [Pt,Pt]=>!!c);
  for(const l of mergeLines(kept.map(([a,b])=>({a,b,layer:'A-HOUS' as LayerId}))))items.push({kind:'line',layer:'A-HOUS',a:{x:l.a.x,y:-l.a.y},b:{x:l.b.x,y:-l.b.y}});
  let left=uMin,right=uMax;
  if(house.length){
    const hu=house.flatMap(l=>[l.a.x,l.b.x]),hv=Math.max(...house.flatMap(l=>[l.a.y,l.b.y])),top=Math.min(hv,cap),h0=Math.min(...hu),h1=Math.max(...hu);
    if(h0<box.x0-1)items.push(breakLine({x:box.x0,y:0},{x:box.x0,y:-top}));
    if(h1>box.x1+1)items.push(breakLine({x:box.x1,y:0},{x:box.x1,y:-top}));
    if(hv>cap+1)items.push(breakLine({x:Math.max(h0,box.x0),y:-cap},{x:Math.min(h1,box.x1),y:-cap}));
    left=Math.min(left,Math.max(h0,box.x0));right=Math.max(right,Math.min(h1,box.x1));
  }
  const supports=model.levels.flatMap(l=>l.supports),reference=view==='front'?Math.max(0,...supports.map(p=>p.z)):view==='left'?Math.min(0,...supports.map(p=>p.x)):Math.max(...supports.map(p=>p.x),data.width*12);
  const atU=(u:number)=>view==='front'?{x:u,y:reference}:{x:reference,y:view==='left'?u:-u};
  if(physical){const profile=buildElevationProfile(data,{id:`elevation-${view}`,name:view,segments:[{a:atU(left-24),b:atU(right+24)}]});for(const [key,layer] of [['existingIn','C-EXST'],['proposedIn','C-PGRD']] as const){let previous:typeof profile.points[number]|undefined;for(const p of profile.points){if(p[key]===null){previous=undefined;continue;}if(previous&&previous[key]!==null)items.push({kind:'line',layer,a:{x:left-24+previous.stationIn,y:-previous[key]!},b:{x:left-24+p.stationIn,y:-p[key]!}});previous=p;}}items.push({kind:'text',layer:'A-ANNO-TEXT',at:{x:left,y:20},text:`GROUND REFERENCE SECTION at ${view==='front'?'Z':'X'}=${reference.toFixed(2)} in; datum 0.00; coverage gaps pending`,height:.06,anchor:'start'});}
  else {items.push({kind:'line',layer:'C-TOPO',a:{x:left-24,y:0},b:{x:right+24,y:0}});items.push({kind:'text',layer:'A-ANNO-TEXT',at:{x:left-28,y:1},text:'GRADE',height:.08,anchor:'end'});}

  // Datums on the front view: the walking surface of each level. Every view dimensions the main deck's height.
  const main=model.levels[0],distinct=[...new Set(tops.map(t=>Math.round(t*2)/2))].sort((p,q)=>p-q);
  const mainU=main.footprint.outline.map(p=>project(view,{x:p.x+main.offset.x,y:0,z:p.y+main.offset.z}).u),u0=Math.min(...mainU),u1=Math.max(...mainU);
  // Datum labels sit clear of the house, past its cut.
  const datum=right+30;
  if(view==='front')for(const t of distinct){
    const at=model.levels.filter(l=>Math.abs(l.top-t)<.26),surface=at.find(l=>l.kind!=='landing'&&l.kind!=='winder');
    const label=surface?surface===main?'DECK':`LEVEL ${(surface.index??1)+1} DECK`:at[0]?.kind==='winder'?'WINDER':'LANDING';
    items.push({kind:'line',layer:'A-ANNO-DIMS',a:{x:uMax+8,y:-t},b:{x:datum+60,y:-t}});
    items.push({kind:'text',layer:'A-ANNO-TEXT',at:{x:datum,y:-t-2},text:physical?`${label} ${elevationLabel(t)} datum`:`${label} +${feetInches(t)}`,height:.07,anchor:'start'});
  }
  const clearanceAt=atU(uMax),localGrade=physical?sampleSiteHeight(data,clearanceAt.x,clearanceAt.y):0;
  if(localGrade!==undefined)items.push({kind:'dim',layer:'A-ANNO-DIMS',a:{x:uMax,y:-localGrade},b:{x:uMax,y:-main.top},offset:30,text:`${feetInches(main.top-localGrade)}${physical?' local clearance':''}`});
  else items.push({kind:'text',layer:'A-ANNO-TEXT',at:{x:uMax+30,y:-main.top},text:'GROUND CLEARANCE PENDING',height:.07,anchor:'start'});
  if(withGuard&&data.railingType!=='None'&&model.railing.rails.length+model.railing.glass.length>0){
    items.push({kind:'dim',layer:'A-ANNO-DIMS',a:{x:u0,y:-main.top},b:{x:u0,y:-(main.top+model.railing.height)},offset:-24,text:`${feetInches(model.railing.height)} guard`});
  }
  const foundationDepth=data.foundation==='Deck Blocks'?0:data.foundationDepthIn??48;
  if(withFooting&&foundationDepth){
    if(physical){
      // The footing is projected from its own location, not the ground section's X/Z.
      const foundation=model.foundationSupports.filter(f=>f.gradeElevationIn!==null&&f.bottomElevationIn!==null).sort((a,b)=>project(view,{x:a.x,y:0,z:a.z}).u-project(view,{x:b.x,y:0,z:b.z}).u)[0];
      if(foundation){const s=project(view,{x:foundation.x,y:0,z:foundation.z}).u;items.push({kind:'dim',layer:'A-ANNO-DIMS',a:{x:s-6,y:-foundation.gradeElevationIn!},b:{x:s-6,y:-foundation.bottomElevationIn!},offset:14,text:`${feetInches(foundation.gradeElevationIn!-foundation.bottomElevationIn!)} below projected support local grade`});}
      else items.push({kind:'text',layer:'A-ANNO-TEXT',at:{x:uMin,y:foundationDepth+8},text:'FOUNDATION DEPTH DATUM PENDING',height:.07,anchor:'start'});
    }else{
      const [s]=model.levels.flatMap(l=>l.supports).map(p=>project(view,p).u).sort((p,q)=>p-q);
      if(s!==undefined)items.push({kind:'dim',layer:'A-ANNO-DIMS',a:{x:s-6,y:0},b:{x:s-6,y:foundationDepth},offset:14,text:`${feetInches(foundationDepth)} below grade`});
    }
  }
  const below=foundationDepth+12;
  items.push({kind:'dim',layer:'A-ANNO-DIMS',a:{x:u0,y:below},b:{x:u1,y:below},offset:14,text:`${feetInches(u1-u0)} ${view==='front'?'overall width':'overall depth'}`});
  const b=bounds(items);
  // The title clears the overall dimension's text at the smallest scale.
  items.push({kind:'text',layer:'A-ANNO-TEXT',at:{x:(b.minX+b.maxX)/2,y:b.maxY+58},text:TITLES[view],height:.14,anchor:'middle'});
  return items;
}

/**
 * The three elevations laid out on one sheet at one scale: the front above the two sides, all in a row, or all in a
 * column, whichever allows the largest standard scale. Items come back with their extent's top-left at `origin`, so
 * the DXF can place them in model space clear of the plans.
 */
export function elevationItems(data:DeckData,model:DeckTakeoff,origin:Pt):DrawItem[]{
  const solids=elevationSolids(data,model);
  const views=(['front','left','right'] as const).map(v=>{const items=elevation(data,model,solids,v,v!=='right',v==='front'),b=bounds(items);return {items,b,w:b.maxX-b.minX,h:b.maxY-b.minY};});
  const [f,l,r]=views,place=(v:typeof f,x:number,y:number)=>translate(v.items,x-v.b.minX,y-v.b.minY);
  const layouts=[
    [...place(f,Math.max(0,(l.w+GAP+r.w-f.w)/2),0),...place(l,Math.max(0,(f.w-l.w-GAP-r.w)/2),f.h+GAP),...place(r,Math.max(0,(f.w-l.w-GAP-r.w)/2)+l.w+GAP,f.h+GAP)],
    [...place(f,0,0),...place(l,f.w+GAP,0),...place(r,f.w+l.w+2*GAP,0)],
    [...place(f,0,0),...place(l,0,f.h+GAP),...place(r,0,f.h+l.h+2*GAP)],
  ];
  const best=layouts.map(items=>({items,fit:fitScale(items)})).reduce((p,q)=>q.fit.ratio<p.fit.ratio?q:p);
  return translate(best.items,origin.x-best.fit.extents.minX,origin.y-best.fit.extents.minY);
}
