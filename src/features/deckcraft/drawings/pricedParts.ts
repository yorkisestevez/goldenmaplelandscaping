import type {DeckData} from '../types';
import type {DeckTakeoff} from '../deckTakeoff';
import {getHardwareLayout} from '../hardwareLayout';
import {connectorSchedule} from '../schedule';

/**
 * How the estimate carries each connection part the drawings name, so a callout never shows a part as included when
 * it is not. Counts and statuses come from the connector schedule (schedule.ts), the same rows the estimate prices.
 */
export type PartStatus='priced'|'supplier quote'|'confirm in the railing kit';
export interface Part{name:string;qty:number;status:PartStatus}

export function connectionParts(data:DeckData,model:DeckTakeoff,hardware=getHardwareLayout(data,model)):Map<string,Part>{
  // Hidden clips from a manufacturer system (Concealoc, StealthLock) become a quote in the estimate.
  const quotedClips=data.catalogueAccessories?.some(id=>id==='tt_concealoc'||id==='dk_stealthlock');
  return new Map(connectorSchedule(data,model,hardware).map(r=>{
    const status:PartStatus=r.name==='Hidden clips'&&quotedClips?'supplier quote':r.rate!==null||r.basis.startsWith('Priced by')?'priced':r.basis.startsWith('Confirm inclusion')?'confirm in the railing kit':'supplier quote';
    return [r.name,{name:r.name,qty:r.qty,status}];
  }));
}

/**
 * Ledger flashing: the estimate prices it only on an add-on deck; the TimberTech flashing accessory makes it a supplier
 * quote; otherwise it is not in the estimate, and the drawings say so rather than show it as included.
 */
export function ledgerFlashing(data:DeckData):{label:string;note:string}{
  if(data.catalogueAccessories?.includes('tt_protac_flashing'))return {label:'Flashing (supplier quote)',note:'Ledger flashing: the selected flashing is a supplier quote in this estimate.'};
  if(data.deckType==='Add-on')return {label:'Flashing (priced)',note:'Ledger flashing is priced along every wall the deck meets.'};
  return {label:'Flashing (not in this estimate)',note:'Ledger flashing is drawn but is not in this estimate; confirm it with the builder before building.'};
}
