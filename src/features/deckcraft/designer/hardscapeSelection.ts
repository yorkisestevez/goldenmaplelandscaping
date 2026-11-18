import type {YardBox} from '../yardModel';
import type {HardscapeSelection} from './selectionState';
export const boxSelection=(b:YardBox):HardscapeSelection=>({kind:'yard',id:b.featureId,part:b.stonePart??b.role,...(b.stepFlightId?{flightId:b.stepFlightId}:{}),...(b.stepRow!==undefined?{row:b.stepRow}:{})});
export const matchesHardscape=(a:HardscapeSelection|undefined,b:HardscapeSelection)=>!!a&&a.id===b.id&&a.kind===b.kind&&(!a.part||a.part===b.part)&&(!a.flightId||a.flightId===b.flightId)&&(a.row===undefined||a.row===b.row);
