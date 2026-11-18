import {useEffect,useRef,useState,type PointerEvent} from 'react';

// The drawer's half height (nextShell.css) and how far a press moves before it counts as a drag, not a tap.
const HALF=.45,DRAG_PX=4;
// Below this share of the screen a released drag puts the drawer away.
const CLOSE_BELOW=.3;

/**
 * The phone drawer's grip (the new look's HomePanel, nextShell.css): a tap switches between about half and about full
 * height; a drag sizes the drawer, and letting go snaps it to the nearer height, or puts it away when it is dragged
 * low. The drawer opens at half height again (HomePanel keys the grip to its tab and its open state).
 */
export default function DrawerHandle({onClose}:{onClose:()=>void}){
  const [tall,setTall]=useState(false),self=useRef<HTMLButtonElement>(null);
  const drag=useRef<{y:number;height:number;moved:boolean}|null>(null),dragged=useRef(false);
  const drawer=()=>self.current?.closest<HTMLElement>('.dd-home-panel')??null;
  const size=(panel:HTMLElement,height?:number)=>{if(height===undefined){panel.style.removeProperty('--nx-drawer-height');delete panel.dataset.dragging;}else{panel.style.setProperty('--nx-drawer-height',`${height}px`);panel.dataset.dragging='';}};
  useEffect(()=>{
    const panel=drawer();if(!panel)return;
    panel.dataset.drawer=tall?'tall':'half';
    // A grip that goes mid-drag leaves no size behind.
    return()=>{delete panel.dataset.drawer;size(panel);};
  },[tall]);
  // A touch drag ends with no click, so each press starts afresh.
  const down=(e:PointerEvent<HTMLButtonElement>)=>{const panel=drawer();if(!panel)return;dragged.current=false;drag.current={y:e.clientY,height:panel.getBoundingClientRect().height,moved:false};e.currentTarget.setPointerCapture(e.pointerId);};
  const move=(e:PointerEvent<HTMLButtonElement>)=>{
    const d=drag.current,panel=drawer();if(!d||!panel)return;
    const dy=e.clientY-d.y;if(Math.abs(dy)>DRAG_PX)d.moved=true;
    if(d.moved)size(panel,Math.max(0,d.height-dy));
  };
  const up=()=>{
    const d=drag.current,panel=drawer();drag.current=null;if(!d?.moved||!panel)return;
    dragged.current=true;
    const box=panel.getBoundingClientRect(),screen=window.innerHeight;size(panel);
    if(box.height<screen*CLOSE_BELOW){setTall(false);onClose();return;}
    // Tall fills the space between the top bar and the drawer's foot; it snaps to whichever height is nearer.
    const top=document.querySelector('.dd-next-top')?.getBoundingClientRect().bottom??0,tallHeight=box.bottom-top;
    setTall(box.height>(screen*HALF+tallHeight)/2);
  };
  return <button ref={self} type="button" className="dd-next-grip" aria-label={tall?'Shorter panel':'Taller panel'} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onClick={()=>{if(dragged.current){dragged.current=false;return;}setTall(!tall);}}><span aria-hidden="true"/></button>;
}
