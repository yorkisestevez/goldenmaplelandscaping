import {useSyncExternalStore} from 'react';

/** The new look (docs/deckcraft/ui-redesign-2026-10/PLAN.md): a full-bleed scene with a top bar, a five-group rail and a
 * price pill. On by default; while the old screens are being removed (slice S5), `?ui=classic` turns it off and
 * `?ui=next` back on, remembered on this device. The page reads only this flag; the new screens load lazily, so the
 * public route does not grow. Like Designer Mode it is a convenience switch, not access control. */
const KEY='deckcraft.ui';
let on:boolean|undefined;
function read(){
 if(on!==undefined)return on;let value=true;
 try{
  const asked=new URLSearchParams(location.search).get('ui');
  if(asked==='classic')localStorage.setItem(KEY,'classic');else if(asked==='next')localStorage.removeItem(KEY);
  value=asked==='next'||asked!=='classic'&&localStorage.getItem(KEY)!=='classic';
 }catch{/* storage or location unavailable: the new look */}
 return on=value;
}
export const nextUiOn=()=>typeof window!=='undefined'&&read();
// The switch is read once per visit, so there is nothing to subscribe to.
export const useNextUi=()=>useSyncExternalStore(()=>()=>{},nextUiOn,()=>false);
