import type {DeckData} from './types';
import type {Box,V3} from './deckTakeoff';

const pvc='https://assets.timbertech.com/content/dam/wp-content/TimberTech-Advanced-PVC-Decking-Installation-Guide_ENG.pdf';
const composite='https://assets.timbertech.com/content/dam/wp-content/TimberTech-Composite-Installation-Guide-ENG.pdf';
const surestone='https://www.deckorators.com/cdn/shop/files/8529-deckorators-surestone-technology-decking-installation-en.pdf';
const vista='https://www.deckorators.com/cdn/shop/files/15557_VistaDeckingInstallationInstructions_EN_03.24.26_b4dfb171-467e-4472-959d-62cef5e436d4.pdf';
const altitude='https://www.deckorators.com/cdn/shop/files/15829-deckorators-altitude-decking-installation-instructions-en.pdf';
const venture='https://www.deckorators.com/cdn/shop/files/14764-deckorators-venture-decking-installation-en.pdf';

export interface StairSupport {
  requestedSpacingIn:number;spacingIn:number;minimumStringers:number;runIn:number;treadNosingIn:number;boardGapIn:number;rearGapIn:number;
  status:'spacing-verified'|'assembly-review'|'wood-design-review';sourceUrl:string;sourcePages:string;
  notes:string[];issues:string[];riserThicknessIn:number;riserStockWidthIn:number;riserStockLengthIn:number;
}
/** Product span checks are not a code approval. The selected 12-inch layout is
 * tightened only by a verified applicable tread rule, never by deck-joist spans. */
export function getStairSupport(data:DeckData,gap:number):StairSupport {
  const id=data.deckingMaterial;
  const result:StairSupport={requestedSpacingIn:12,spacingIn:12,minimumStringers:3,runIn:Math.max(10.5,2*data.boardWidth+gap-.5),treadNosingIn:.5,boardGapIn:gap,rearGapIn:0,status:'wood-design-review',sourceUrl:'',sourcePages:'',notes:['Stringer centers start one inch from the tread end. Nominal bays remain fixed; the final bay is shorter.','Wood species, grade, stringer throat, connection design and local stair requirements need project review.'],issues:[],riserThicknessIn:.75,riserStockWidthIn:7.25,riserStockLengthIn:144};
  if(id.startsWith('tt_')){
    result.status='spacing-verified';result.notes=['Square-shoulder stair boards require top-down fastening. Use the manufacturer instructions for fastening, gapping and riser installation.'];
    if(['tt_harvest','tt_harvest_plus','tt_vintage','tt_landmark'].includes(id)){
      Object.assign(result,{spacingIn:10,sourceUrl:pvc,sourcePages:'17–18 (printed)',riserThicknessIn:.75});
      result.notes.push('Standard Advanced PVC treads use the 10-inch stringer option. MAX boards and the alternative reinforced assemblies are not selected.');
    }else{
      Object.assign(result,{spacingIn:10,sourceUrl:composite,sourcePages:'8 (printed)',riserThicknessIn:9/16});
      if(id==='tt_premier')result.spacingIn=9;
      if(['tt_terrain','tt_terrain_plus'].includes(id)){
        result.spacingIn=12;result.status='assembly-review';
        result.issues.push('Terrain / Terrain+ stair treads require the manufacturer 2×6 supported veneer assembly. See the modeled veneer supports and connection schedule; unsupported platforms or unusual board profiles remain identified separately.');
      }else if(['tt_prime','tt_prime_plus','tt_premier_plus'].includes(id)){
        result.spacingIn=id==='tt_premier_plus'?9:10;result.status='assembly-review';
        result.issues.push('Confirm the selected Prime / Prime+ / Premier+ tread profile: the manual distinguishes 3-sided Prime (10 inches) from 4-sided Prime (supported veneer only); Premier+ is not identified in this spacing chart.');
      }
      result.notes.push('Landings and multi-level step-down platforms require the same stair support rules; their complete support layout needs review.');
    }
  }else if(['deck_voyage','deck_summit'].includes(id)){
    Object.assign(result,{spacingIn:9,minimumStringers:5,status:'spacing-verified',sourceUrl:surestone,sourcePages:'2–3',riserThicknessIn:7/16,riserStockWidthIn:11.25,runIn:Math.max(10.5,2*data.boardWidth+gap-.5)});
    result.notes=['Surestone requires no more than 9 inches between stringer centers and at least five stringers. Use face screws, manufacturer gapping and no more than ½ inch tread overhang over stringers.'];
  }else if(['deck_vista','deck_venture','deck_altitude'].includes(id)){
    Object.assign(result,{spacingIn:8,status:'spacing-verified',sourceUrl:id==='deck_vista'?vista:id==='deck_altitude'?altitude:venture,sourcePages:'Stair installation',riserThicknessIn:.5,riserStockWidthIn:11.25,boardGapIn:.25,rearGapIn:.25,runIn:Math.max(11,2*data.boardWidth)});
    result.notes=['The 8-inch unsupported-tread rule is used. Decorative closed riser boards do not establish the alternative supported-tread assembly. Provide the specified board/riser gaps and face fasteners.'];
  }
  result.notes.push('Riser cuts use 12-foot stock; confirm the selected colour/profile and fastening system with the supplier. Stair board thickness is represented as one inch; final rise deductions must use supplied board thickness.','Straight treads have a ½-inch nose. The requested 1½-inch deck border at the top step and flush winder edges need a project-specific nosing/uniformity review.');
  return result;
}

/** Fixed nominal stations, plus an end station. Only an almost coincident final
 * station is moved back to keep 1.5-inch stringers from occupying the same space. */
export function getStringerOffsets(width:number,spacing:number,minimum=3):number[]{
  const lo=-width/2+1,hi=width/2-1;
  if(hi<=lo)return [0];
  const points=[lo];
  for(let x=lo+spacing;x<hi-1e-6;x+=spacing)points.push(x);
  if(hi-points[points.length-1]<1.5-1e-6&&points.length>1)points[points.length-1]=hi-1.5;
  points.push(hi);
  while(points.length<minimum){let index=0;for(let i=1;i<points.length-1;i++)if(points[i+1]-points[i]>points[index+1]-points[index])index=i;points.splice(index+1,0,(points[index]+points[index+1])/2);}
  return points;
}

export type RiserBoard=Box&{kind:'riser';flightId:string;riserIndex:number;stockLength:number;stockWidth:number;materialId:string};
/** A closed riser spans lower walking surface to the underside of the upper
 * one-inch tread. Its front face is at the step boundary; thickness goes uphill. */
export function makeRiserBoards(center:V3,along:{x:number;y:number},outward:{x:number;y:number},width:number,rise:number,support:StairSupport,materialId:string,flightId:string,riserIndex:number):RiserBoard[]{
  const h=rise-1;if(h<=0)return [];
  const pieces:RiserBoard[]=[],angle=Math.atan2(-along.y,along.x),stations=getStringerOffsets(width,support.spacingIn,support.minimumStringers).map(x=>x+width/2);
  let from=0;
  while(from<width-.001){
    const limit=Math.min(width,from+support.riserStockLengthIn);
    const to=limit===width?width:Math.max(...stations.filter(x=>x>from+1.5&&x<=limit));
    if(!Number.isFinite(to))throw new Error('Riser stock cannot span to a supported cut location');
    const shift=(from+to-width)/2;
    pieces.push({kind:'riser',x:center.x+along.x*shift-outward.x*support.riserThicknessIn/2,y:center.y-rise+h/2,z:center.z+along.y*shift-outward.y*support.riserThicknessIn/2,w:to-from,h,d:support.riserThicknessIn,angle,flightId,riserIndex,stockLength:support.riserStockLengthIn,stockWidth:support.riserStockWidthIn,materialId});
    from=to;
  }
  return pieces;
}
