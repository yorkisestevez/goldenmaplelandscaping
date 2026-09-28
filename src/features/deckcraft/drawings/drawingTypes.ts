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
  id:'S-1'|'S-2'|'S-3';title:string;
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
