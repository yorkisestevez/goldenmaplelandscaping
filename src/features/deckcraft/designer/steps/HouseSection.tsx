import HouseEditor from '../../HouseEditor';
import type {DeckData} from '../../types';
import type {Update} from '../fields';

/**
 * The House section: the house's size, position, shape, roof, doors and windows (HouseEditor), and the way into the
 * exterior finishes (F4, F5), which open under the doors and windows bar beside the drawing. Looks are never priced;
 * the house's size and position can move the ledger.
 */
export default function HouseSection({data,update,selectedOpeningId,onSelectOpening,openExterior}:{data:DeckData;update:Update;selectedOpeningId:string;onSelectOpening:(id:string)=>void;openExterior:()=>void}){
  return <>
    <p>Where the house sits and how big it is decide where the ledger stops. Doors, windows and finishes are looks only and never priced.</p>
    <p className="dd-note">Click a door or window in 3D to select it, then drag it along its wall. Use the controls below for exact dimensions and movement.</p>
    <HouseEditor data={data} onChange={update} selectedId={selectedOpeningId} onSelect={onSelectOpening} onOpenExterior={openExterior}/>
  </>;
}
