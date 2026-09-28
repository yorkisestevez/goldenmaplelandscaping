import type {HouseOpening} from '../../types';
export interface HouseInteraction {
 selectedHouseOpeningId?:string;
 onSelectHouseOpening?:(id:string)=>void;
 onMoveHouseOpening?:(id:string,patch:Partial<HouseOpening>)=>void;
 /** Exterior studio only: the walls being finished, outlined in the view: a wall id ('garage1-back'), or a block id
  * for all of that block's walls. */
 selectedHouseWallId?:string;
 /** Exterior studio only (attached while it is open): a click on a wall, not an orbit drag, picks it. */
 onSelectHouseWall?:(wallId:string)=>void;
}
