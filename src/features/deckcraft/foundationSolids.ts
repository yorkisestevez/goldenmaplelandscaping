import type {Box} from './deckTakeoff';
import type {FoundationDatum,FoundationCylinder} from './foundationDatums';
/** Shared schematic stock solids: viewer and all mesh exports use these datums. */
export function foundationSolids(d:FoundationDatum):{boxes:(Box&{part:'deck-block'|'post-base'|'post'})[];cylinders:FoundationCylinder[]}{
 const boxes:(Box&{part:'deck-block'|'post-base'|'post'})[]=[],cylinders:FoundationCylinder[]=[];
 if(d.gradeElevationIn===null||d.bottomElevationIn===null||d.headTopElevationIn===null||d.postBaseElevationIn===null)return {boxes,cylinders};
 const grade=d.gradeElevationIn;
 if(d.foundation==='Deck Blocks')boxes.push({part:'deck-block',x:d.x,y:grade+3,z:d.z,w:12,h:6,d:12});
 else if(d.foundation==='Helical Piles'){cylinders.push({part:'pile-shaft',x:d.x,z:d.z,bottom:d.bottomElevationIn,top:d.headTopElevationIn,radius:1.4},{part:'pile-helix',x:d.x,z:d.z,bottom:d.bottomElevationIn+4,top:d.bottomElevationIn+4.3,radius:6});}
 else cylinders.push({part:'concrete-pier',x:d.x,z:d.z,bottom:d.bottomElevationIn,top:d.headTopElevationIn,radius:6});
 // Schematic steel shoe: seat touches the timber; pedestal bridges the intentional standoff.
 const seat=d.postBaseElevationIn,head=d.headTopElevationIn,gap=Math.max(0,seat-.4-head);
 boxes.push({part:'post-base',x:d.x,y:seat-.2,z:d.z,w:7,h:.4,d:7});
 if(gap>0)boxes.push({part:'post-base',x:d.x,y:head+gap/2,z:d.z,w:3,h:gap,d:3});
 const cheek=Math.min(4,d.postHeightIn??0);
 if(cheek>0)for(const side of [-1,1])boxes.push({part:'post-base',x:d.x+side*2.875,y:seat+cheek/2,z:d.z,w:.25,h:cheek,d:5.5});
 if(d.postHeightIn!>0)boxes.push({part:'post',x:d.x,y:(d.bearingElevationIn+d.postBaseElevationIn)/2,z:d.z,w:5.5,h:d.postHeightIn!,d:5.5});
 return {boxes,cylinders};
}
