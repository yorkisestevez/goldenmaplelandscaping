import type {DeckData} from './types';
import type {Box,DeckTakeoff} from './deckTakeoff';

export interface StairVeneerRow {id:string;name:string;qty:number;unit:string;rate:null;basis:string;cutLengthsIn?:number[]}
export interface StairVeneerLayout {applicable:boolean;woodBoxes:Box[];bracketBoxes:Box[];rows:StairVeneerRow[];issues:string[];sourceUrl:string;sourcePage:number;supportedTreads:number;status:'not-required'|'modeled-straight'|'partial'|'unsupported'}
const sourceUrl='https://assets.timbertech.com/content/dam/wp-content/TimberTech-Composite-Installation-Guide-ENG.pdf';

/** Printed page 8: flat 2x6 blocks span BETWEEN stringers under the veneer.
 * The existing stringer notch elevations must not be lowered. Angle envelopes
 * illustrate connector placement; holes and nail count need the fastening schedule.
 */
export function stairVeneerLayout(data:DeckData,model:DeckTakeoff):StairVeneerLayout{
  const result:StairVeneerLayout={applicable:['tt_terrain','tt_terrain_plus'].includes(data.deckingMaterial),woodBoxes:[],bracketBoxes:[],rows:[],issues:[],sourceUrl,sourcePage:8,supportedTreads:0,status:'not-required'};
  if(!result.applicable||!model.treads.length)return result;
  if(Math.abs(data.boardWidth-5.5)>.001){result.status='unsupported';result.issues.push('Terrain veneer support is modeled only for the two-board 5½-inch planning profile. The selected board width needs a separate supported-tread assembly.');return result;}
  result.status='modeled-straight';const cuts:number[]=[];let angles=0;
  for(const flight of model.flights){
    if(flight.type!=='Straight'||flight.risers<2)continue;
    const dx=flight.end.x-flight.start.x,dz=flight.end.z-flight.start.z,length=Math.hypot(dx,dz);
    if(length<.001)continue;
    const out={x:dx/length,z:dz/length},along={x:out.z,z:-out.x},angle=Math.atan2(out.x,out.z);
    const stations=model.stringers.filter(m=>{
      if(!m.stair||m.stair.risers!==flight.risers||Math.abs(m.stair.top-flight.start.y)>.001||Math.abs(m.stair.run-flight.run)>.001)return false;
      const mx=m.b.x-m.a.x,mz=m.b.z-m.a.z,ml=Math.hypot(mx,mz);
      return ml>.001&&(mx*out.x+mz*out.z)/ml>.9999&&Math.abs((m.a.x-flight.start.x)*out.x+(m.a.z-flight.start.z)*out.z)<.001&&Math.abs((m.a.x-flight.start.x)*along.x+(m.a.z-flight.start.z)*along.z)<=flight.width/2+.001;
    }).map(m=>({at:(m.a.x-flight.start.x)*along.x+(m.a.z-flight.start.z)*along.z,width:m.width})).sort((a,b)=>a.at-b.at).filter((s,i,a)=>i===0||s.at-a[i-1].at>.001);
    if(stations.length<2){result.status='partial';result.issues.push(`Terrain support for ${flight.id} cannot be resolved to adjacent modeled stringers.`);continue;}
    const fullDepth=2*5.5+model.stairSupport.boardGapIn+model.stairSupport.rearGapIn;
    if(Math.abs(flight.run+model.stairSupport.treadNosingIn-fullDepth)>.01){result.status='partial';result.issues.push(`Terrain tread depth for ${flight.id} differs from the two-full-board veneer detail; its supports need a separate layout.`);continue;}
    const at=(across:number,forward:number,y:number)=>({x:flight.start.x+along.x*across+out.x*forward,y,z:flight.start.z+along.z*across+out.z*forward});
    for(let tread=1;tread<flight.risers;tread++){
      const woodTop=flight.start.y-tread*flight.rise-1,woodBottom=woodTop-1.5;
      for(let board=0;board<2;board++){
        const forward=(tread-1)*flight.run+model.stairSupport.rearGapIn+board*(5.5+model.stairSupport.boardGapIn)+2.75;
        for(let bay=0;bay<stations.length-1;bay++){
          const left=stations[bay].at+stations[bay].width/2,right=stations[bay+1].at-stations[bay+1].width/2,span=right-left;
          if(span<.01)continue;
          result.woodBoxes.push({...at((left+right)/2,forward,woodTop-.75),w:span,h:1.5,d:5.5,angle});cuts.push(span);
          // Two schematic L angles: seat below the block, vertical leg on the
          // stringer inside face. Geometry does not specify a nail-hole pattern.
          for(const [edge,inward] of [[left,1],[right,-1]]){
            result.bracketBoxes.push({...at(edge+inward*.04,forward,woodBottom-1),w:.08,h:2,d:1.5,angle});
            result.bracketBoxes.push({...at(edge+inward*.75,forward,woodBottom-.04),w:1.5,h:.08,d:1.5,angle});angles++;
          }
        }
      }
      result.supportedTreads++;
    }
  }
  if(model.levels.some(l=>l.kind==='landing'||l.kind==='winder')||model.treads.some(t=>t.kind==='winder')){
    result.status='partial';result.issues.push('Terrain straight-flight veneer supports are modeled, including flights to/from landings. Landing platforms and winder treads still require their own continuous supported-veneer and connector layout.');
  }
  result.issues.push('Terrain support blocks follow the manufacturer 2×6 veneer detail. Confirm supplied board dimensions, timber grade, stringer throat, top-down screws and the A23Z fastening schedule; schematic angle shapes do not specify nail-hole geometry.');
  if(cuts.length)result.rows.push({id:'terrain-veneer-wood',name:'Terrain stair veneer · flat 2×6 support blocks',qty:cuts.length,unit:'pieces',rate:null,cutLengthsIn:cuts,basis:'Between actual stringer inside faces, two supports per tread per bay. Wood is subject to confirmation within the existing stair assembly allowance; do not duplicate-charge.'});
  if(angles){
    result.rows.push({id:'terrain-veneer-angles',name:'Simpson Strong-Tie A23Z veneer support angles',qty:angles,unit:'angles',rate:null,basis:'Two connectors per flat support block. Manufacturer p8 specifies A23Z; supplier and installation quote required.'});
    result.rows.push({id:'terrain-veneer-nails',name:'N10D5HDG 1½-inch connector nails',qty:angles,unit:'connector sets',rate:null,basis:'One required nail set per A23Z angle; nail count per connector must come from the applicable fastening schedule. Supplier quote required.'});
  }
  return result;
}
