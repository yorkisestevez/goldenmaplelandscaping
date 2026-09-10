import type {HouseOpening} from '../../types';
export interface HouseInteraction {
 selectedHouseOpeningId?:string;
 onSelectHouseOpening?:(id:string)=>void;
 onMoveHouseOpening?:(id:string,patch:Partial<HouseOpening>)=>void;
}
