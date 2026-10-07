import type {DeckData} from './types';
import type {DeckTakeoff} from './deckTakeoff';
import type {YardModel} from './yardModel';
import type {EstimateResult} from './calculations';
import type {ConnectorScheduleRow} from './schedule';
import type {PublicYardSection} from './yardTakeoff';
import {usesPhysicalElevations} from './elevationDatum';
import {DesignExtensionLoadError} from './designExtensionState';
interface Runtime {foundation(model:DeckTakeoff):EstimateResult['sections'];timber(model:DeckTakeoff):ConnectorScheduleRow;earthwork(model:YardModel):PublicYardSection}
let runtime:Runtime|undefined;
export const registerPhysicalQuoteRuntime=(value:Runtime)=>{runtime=value;};
const requireRuntime=()=>{if(!runtime)throw new DesignExtensionLoadError('Physical construction quotes');return runtime;};
export const physicalFoundationSections=(data:DeckData,model:DeckTakeoff)=>usesPhysicalElevations(data)?requireRuntime().foundation(model):[];
export const physicalSupportTimber=(data:DeckData,model:DeckTakeoff)=>usesPhysicalElevations(data)?requireRuntime().timber(model):undefined;
export const physicalEarthworkReconciliation=(model:YardModel)=>(model.quantities.deckFoundationExcavationYd3??0)>.001||model.foundationExcavationPending?requireRuntime().earthwork(model):undefined;
