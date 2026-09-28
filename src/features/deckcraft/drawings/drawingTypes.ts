/**
 * The permit drawing model: renderer-neutral sheets that renderSvg, renderPdf and renderDxf all draw the same way.
 *
 * Geometry is in plan inches, in the deck's own plan: x along the deck-facing wall, y out from it, and the house at
 * y < 0. Text heights and line weights are in paper inches, so they read the same at any scale.
 */
export type Pt={x:number;y:number};

/** CAD layers, as a contractor's CAD standard names them (AIA/NCS style). */
export const LAYERS={
  'A-HOUS':{label:'House wall',aci:8,weight:.02,dash:null},
  'A-DECK-OTLN':{label:'Deck outline',aci:7,weight:.016,dash:null},
  'A-DECK-BRDS':{label:'Decking direction',aci:9,weight:.006,dash:null},
  'S-FTNG':{label:'Footings',aci:1,weight:.012,dash:null},
  'S-POST':{label:'Posts',aci:5,weight:.014,dash:null},
  'S-BEAM':{label:'Beams',aci:3,weight:.016,dash:null},
  'S-JOIS':{label:'Joists',aci:2,weight:.008,dash:[.08,.05]},
  'S-BLKG':{label:'Blocking',aci:40,weight:.008,dash:null},
  'S-LEDG':{label:'Ledger',aci:30,weight:.024,dash:null},
  'A-RAIL':{label:'Guard (railing)',aci:6,weight:.014,dash:null},
  'A-STRS':{label:'Stairs',aci:4,weight:.01,dash:null},
  'S-FRMG':{label:'Joists, rims and blocking',aci:2,weight:.01,dash:null},
  'S-FTNG-HIDN':{label:'Footings below grade',aci:1,weight:.008,dash:[.06,.04]},
  'A-DECK-FNSH':{label:'Decking, fascia and skirting',aci:7,weight:.012,dash:null},
  'A-DECK-EXTR':{label:'Benches, screens and pergola',aci:9,weight:.008,dash:null},
  'C-TOPO':{label:'Grade',aci:8,weight:.024,dash:null},
  'A-ANNO-DIMS':{label:'Dimensions',aci:7,weight:.006,dash:null},
  'A-ANNO-TEXT':{label:'Notes and labels',aci:7,weight:.006,dash:null},
} as const;
export type LayerId=keyof typeof LAYERS;

export type DrawItem=
  |{kind:'line';a:Pt;b:Pt;layer:LayerId}
  |{kind:'poly';points:Pt[];closed:boolean;layer:LayerId}
  |{kind:'circle';c:Pt;r:number;layer:LayerId}
  /** A named symbol: a footing (FOOTING round, BLOCK square) or a post, centred on `at`, `size` inches across. */
  |{kind:'symbol';name:'FOOTING'|'BLOCK'|'POST';at:Pt;size:number;layer:LayerId}
  /** `height` in paper inches; `rotate` in degrees, clockwise as read on the sheet (plan y points down the page). */
  |{kind:'text';at:Pt;text:string;height:number;layer:LayerId;anchor:'start'|'middle'|'end';rotate?:number}
  /** A linear dimension from a to b, drawn `offset` plan inches to the left of a→b, labelled `text`. */
  |{kind:'dim';a:Pt;b:Pt;offset:number;text:string;layer:'A-ANNO-DIMS'};

export interface Sheet{
  id:'A-1'|'S-1'|'S-2'|'S-3'|'S-4';title:string;
  /** Plan inches per paper inch (48 = 1/4" = 1'-0"), and how the title block names it. */
  ratio:number;scaleLabel:string;
  items:DrawItem[];
  /** The plan extent the sheet fits (plan inches), annotations included. */
  extents:{minX:number;minY:number;maxX:number;maxY:number};
  notes:string[];
  legend:LayerId[];
}

export interface DrawingSet{
  sheets:Sheet[];
  project:{title:string;date:string;priceBook:string};
  firm:{name:string;phone:string;email:string;url:string};
  /** Review items still open: every sheet is stamped DRAFT while any remain. */
  reviewItems:string[];
  /** Printed on every sheet. */
  footer:string;
}

/** ANSI B (11 × 17 in) landscape, with the title block down the right-hand side. */
export const SHEET={w:17,h:11,margin:.5,titleW:3.25,
  /** The drawing area, paper inches. */
  area:{x:.75,y:.75,w:12.25,h:9.1}} as const;

/** Architectural scales, largest first: paper inches per foot → plan inches per paper inch. */
export const SCALES:{ratio:number;label:string}[]=[
  {ratio:24,label:'1/2" = 1\'-0"'},{ratio:32,label:'3/8" = 1\'-0"'},{ratio:48,label:'1/4" = 1\'-0"'},
  {ratio:64,label:'3/16" = 1\'-0"'},{ratio:96,label:'1/8" = 1\'-0"'},{ratio:128,label:'3/32" = 1\'-0"'},{ratio:192,label:'1/16" = 1\'-0"'},
];

/** The largest standard scale that fits a plan extent in the drawing area. */
export function pickScale(extents:Sheet['extents']):{ratio:number;label:string}{
  const w=extents.maxX-extents.minX,h=extents.maxY-extents.minY;
  return SCALES.find(s=>w/s.ratio<=SHEET.area.w&&h/s.ratio<=SHEET.area.h)??SCALES.at(-1)!;
}

/** Plan points an item is drawn through (text by its anchor). */
export function itemPoints(i:DrawItem):Pt[]{return i.kind==='line'||i.kind==='dim'?[i.a,i.b]:i.kind==='poly'?i.points:i.kind==='circle'?[i.c]:[i.at];}

/**
 * The extent of items drawn at `ratio`, text included: a line of text is about half its height wide per character on
 * paper, so its plan size depends on the scale. `pad` is paper inches around the whole.
 */
export function drawnExtents(items:DrawItem[],ratio:number,pad=.3):Sheet['extents']{
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  const add=(x:number,y:number)=>{minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);};
  for(const i of items){
    if(i.kind==='text'){
      const w=i.text.length*i.height*.52*ratio,h=i.height*ratio,x0=i.anchor==='start'?0:i.anchor==='middle'?-w/2:-w,turned=Math.abs(Math.abs(i.rotate??0)-90)<1;
      if(turned)add(i.at.x-h,i.at.y+(i.rotate!>0?x0:-x0-w)),add(i.at.x+h*.3,i.at.y+(i.rotate!>0?x0+w:-x0));
      else add(i.at.x+x0,i.at.y-h),add(i.at.x+x0+w,i.at.y+h*.3);
    }else if(i.kind==='dim'){
      const len=Math.hypot(i.b.x-i.a.x,i.b.y-i.a.y)||1,n={x:-(i.b.y-i.a.y)/len,y:(i.b.x-i.a.x)/len},reach=i.offset+Math.sign(i.offset||1)*.2*ratio;
      for(const p of [i.a,i.b])add(p.x,p.y),add(p.x+n.x*reach,p.y+n.y*reach);
    }else if(i.kind==='circle')add(i.c.x-i.r,i.c.y-i.r),add(i.c.x+i.r,i.c.y+i.r);
    else if(i.kind==='symbol')add(i.at.x-i.size/2,i.at.y-i.size/2),add(i.at.x+i.size/2,i.at.y+i.size/2);
    else for(const p of itemPoints(i))add(p.x,p.y);
  }
  return {minX:minX-pad*ratio,minY:minY-pad*ratio,maxX:maxX+pad*ratio,maxY:maxY+pad*ratio};
}

/** The largest standard scale at which items, text included, fit the drawing area (the smallest scale otherwise). */
export function fitScale(items:DrawItem[]):{ratio:number;label:string;extents:Sheet['extents']}{
  for(const s of SCALES){const e=drawnExtents(items,s.ratio);if((e.maxX-e.minX)/s.ratio<=SHEET.area.w&&(e.maxY-e.minY)/s.ratio<=SHEET.area.h)return {...s,extents:e};}
  const last=SCALES.at(-1)!;return {...last,extents:drawnExtents(items,last.ratio)};
}

/** Feet and inches to the nearest half inch: 16'-0", 11'-8 1/2". */
export function feetInches(inches:number):string{
  const halves=Math.round(Math.abs(inches)*2),ft=Math.floor(halves/24),rest=(halves-ft*24)/2,whole=Math.floor(rest),half=rest-whole>0?' 1/2':'';
  return `${inches<0?'-':''}${ft}'-${whole}${half}"`;
}

/** Where plan point p lands on the sheet (paper inches), for a sheet centred in the drawing area. */
export function sheetTransform(sheet:Pick<Sheet,'extents'|'ratio'>){
  const {minX,minY,maxX,maxY}=sheet.extents,cx=(minX+maxX)/2,cy=(minY+maxY)/2;
  const ox=SHEET.area.x+SHEET.area.w/2,oy=SHEET.area.y+SHEET.area.h/2;
  return (p:Pt):Pt=>({x:ox+(p.x-cx)/sheet.ratio,y:oy+(p.y-cy)/sheet.ratio});
}
