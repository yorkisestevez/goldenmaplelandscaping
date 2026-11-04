import {useSyncExternalStore} from 'react';

/** The new look (docs/deckcraft/ui-redesign-2026-10/PLAN.md): a full-bleed scene with a top bar, a five-group rail and a
 * price pill. Off by default while it is built; `?ui=next` turns it on and `?ui=classic` off, remembered on this device.
 * The page reads only this flag; the new screens load lazily, so the public route does not grow. Like Designer Mode it is
 * a convenience switch, not access control. */
const KEY='deckcraft.ui';
let on:boolean|undefined;
function read(){
 if(on!==undefined)return on;let value=false;
 try{
  const asked=new URLSearchParams(location.search).get('ui');
  if(asked==='next')localStorage.setItem(KEY,'next');else if(asked==='classic')localStorage.removeItem(KEY);
  value=asked==='next'||asked!=='classic'&&localStorage.getItem(KEY)==='next';
 }catch{/* storage or location unavailable: the classic page */}
 return on=value;
}
export const nextUiOn=()=>typeof window!=='undefined'&&read();
// The switch is read once per visit, so there is nothing to subscribe to.
export const useNextUi=()=>useSyncExternalStore(()=>()=>{},nextUiOn,()=>false);
