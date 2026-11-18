import {useEffect,useRef} from 'react';
import {createDrawingDirection} from './drawingDirection';
export function useDrawingDirection(segment:unknown){
 const lock=useRef(createDrawingDirection());
 useEffect(()=>{lock.current.reset();},[segment]);
 useEffect(()=>{const up=(e:KeyboardEvent)=>{if(e.key==='Shift')lock.current.release();},blur=()=>lock.current.reset();window.addEventListener('keyup',up);window.addEventListener('blur',blur);return()=>{window.removeEventListener('keyup',up);window.removeEventListener('blur',blur);};},[]);
 return lock.current.point;
}
