import {useSyncExternalStore} from 'react';

/** Customer mode: a simplified homeowner close path (`?view=customer`). Not remembered; Pro/designer mode stays a separate switch. */
let on:boolean|undefined;
const listeners=new Set<()=>void>();
function read(){
  if(on!==undefined)return on;let value=false;
  try{value=new URLSearchParams(location.search).get('view')==='customer';}catch{/* location unavailable */}
  return on=value;
}
export const customerModeOn=()=>typeof window!=='undefined'&&read();
export const useCustomerMode=()=>useSyncExternalStore(listen=>{listeners.add(listen);return ()=>{listeners.delete(listen);};},customerModeOn,()=>false);
