import type {DeckData} from '../types';
import type {DeckTakeoff} from '../deckTakeoff';
import {getHardwareLayout} from '../hardwareLayout';
import {connectorSchedule,type ConnectorScheduleRow} from '../schedule';

/**
 * How the estimate carries each connection part the drawings name, so a callout never shows a part as included when
 * it is not. Counts and statuses come from the connector schedule (schedule.ts), the same rows the estimate prices.
 */
export type PartStatus='priced'|'supplier quote'|'confirm in the railing kit'|'confirm in the footing allowance';
export interface Part{name:string;qty:number;status:PartStatus}

/** How the estimate carries one connector-schedule row. */
export function partStatus(data:DeckData,row:ConnectorScheduleRow):PartStatus{
  // Hidden clips from a manufacturer system (Concealoc, StealthLock) become a quote in the estimate.
  if(row.name==='Hidden clips'&&data.catalogueAccessories?.some(id=>id==='tt_concealoc'||id==='dk_stealthlock'))return 'supplier quote';
  return row.rate!==null||row.basis.startsWith('Priced by')?'priced':row.basis.startsWith('Confirm inclusion')?'confirm in the railing kit':row.basis.startsWith('Confirm timber inclusion')?'confirm in the footing allowance':'supplier quote';
}

export function connectionParts(data:DeckData,model:DeckTakeoff,hardware=getHardwareLayout(data,model)):Map<string,Part>{
  return new Map(connectorSchedule(data,model,hardware).map(r=>[r.name,{name:r.name,qty:r.qty,status:partStatus(data,r)}]));
}

/** The pier drawn and scheduled: the price book fixes a 16 in pier on clay or fill soil; otherwise 12 in is drawn and the
 * diameter is left to the base size. */
export function pierOf(data:DeckData):{diameter:number;priced:boolean}{
  const priced=data.foundation==='Concrete Piers'&&(data.soilCondition==='Clay'||data.soilCondition==='Fill');
  return {diameter:priced?16:12,priced};
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
