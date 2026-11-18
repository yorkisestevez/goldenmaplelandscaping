import {useSyncExternalStore} from 'react';

/** Designer mode: the Pro workspace and shape toolkit for the design team. Off by default and remembered on this
 * device; `?designer=1` turns it on. The page reads only this small flag; the Pro menus, ribbon and editors load
 * lazily, so the public route never pays for them. It is a convenience switch, not access control. */
const KEY='deckcraft.designer-mode';
let on:boolean|undefined;
const listeners=new Set<()=>void>();
function read(){
 if(on!==undefined)return on;let value=false;
 try{value=new URLSearchParams(location.search).get('designer')==='1'||localStorage.getItem(KEY)==='1';}catch{/* storage or location unavailable */}
 return on=value;
}
export const designerModeOn=()=>typeof window!=='undefined'&&read();
export function setDesignerMode(value:boolean){
 on=value;try{if(value)localStorage.setItem(KEY,'1');else localStorage.removeItem(KEY);}catch{/* private window: keep it for this visit */}
 for(const listen of listeners)listen();
}
export const useDesignerMode=()=>useSyncExternalStore(listen=>{listeners.add(listen);return ()=>{listeners.delete(listen);};},designerModeOn,()=>false);
