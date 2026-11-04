import type {KeyboardEvent,PointerEvent} from 'react';
import {pressWalkPad,type WalkKey} from '../components/viewer3d/walk';
import './walkPad.css';

const HOLD_KEYS=new Set(['Enter',' ']);
/** Held buttons: a button walks or turns while it is pressed (pointer, Enter or Space), and lets go with it. */
function hold(key:WalkKey){
  const release=()=>pressWalkPad(key,false);
  return {
    onPointerDown:(e:PointerEvent<HTMLButtonElement>)=>{e.currentTarget.setPointerCapture(e.pointerId);pressWalkPad(key,true);},
    onPointerUp:release,onPointerCancel:release,onLostPointerCapture:release,onBlur:release,
    onKeyDown:(e:KeyboardEvent<HTMLButtonElement>)=>{if(HOLD_KEYS.has(e.key)){e.preventDefault();pressWalkPad(key,true);}},
    onKeyUp:(e:KeyboardEvent<HTMLButtonElement>)=>{if(HOLD_KEYS.has(e.key))release();},
  };
}

/** The walk mode's controls over the 3D view (S7): a pad for touch and the way back to the orbit view. */
export default function WalkPad({onStop}:{onStop:()=>void}){
  // A section, not a div: the canvas sizes its div children (the 3D view) with !important rules.
  return <section className="dd-walk" role="group" aria-label="Walk">
    <p className="dd-walk-hint">W A S D or arrow keys to walk · drag to look · Esc to stop</p>
    <div className="dd-walk-pad">
      <button type="button" aria-label="Turn left" {...hold('turnLeft')}><span aria-hidden="true">◀</span></button>
      <button type="button" aria-label="Walk forward" {...hold('forward')}><span aria-hidden="true">▲</span></button>
      <button type="button" aria-label="Walk back" {...hold('back')}><span aria-hidden="true">▼</span></button>
      <button type="button" aria-label="Turn right" {...hold('turnRight')}><span aria-hidden="true">▶</span></button>
    </div>
    <button type="button" className="dd-walk-stop" onClick={onStop}>Stop walking</button>
  </section>;
}
