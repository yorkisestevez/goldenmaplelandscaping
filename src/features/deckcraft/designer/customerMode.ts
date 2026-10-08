import {useSyncExternalStore} from 'react';

/** Customer mode: a simplified homeowner close path (`?view=customer`). Not remembered; Pro/designer mode stays a separate switch. */
const listeners=new Set<()=>void>();
function read(){
  try{return new URLSearchParams(location.search).get('view')==='customer';}catch{return false;}
}
function notify(){for(const listen of listeners)listen();}
if(typeof window!=='undefined'){
  window.addEventListener('popstate',notify);
  // Same-tab query changes from history.replaceState/pushState do not fire popstate.
  const wrap=(method:'pushState'|'replaceState')=>{
    const original=history[method].bind(history);
    history[method]=((...args:Parameters<History['pushState']>)=>{const result=original(...args);notify();return result;}) as History['pushState'];
  };
  wrap('pushState');wrap('replaceState');
}
export const customerModeOn=()=>typeof window!=='undefined'&&read();
export const useCustomerMode=()=>useSyncExternalStore(listen=>{listeners.add(listen);return ()=>{listeners.delete(listen);};},read,()=>false);
