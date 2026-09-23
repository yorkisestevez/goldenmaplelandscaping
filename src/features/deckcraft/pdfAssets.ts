import {createElement} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import ConstructionPlan from './ConstructionPlan';
import type {DeckTakeoff} from './deckTakeoff';
import type {DeckData} from './types';

/**
 * Browser-only pictures for the proposal PDF. The plan is drawn off-screen by the same component the
 * page shows, then rasterised; its styling is all inline SVG attributes, so the picture matches the screen.
 */
export async function planImage(model:DeckTakeoff,data:DeckData,widthPx=2000):Promise<string|null>{
  const host=document.createElement('div');
  host.setAttribute('aria-hidden','true');
  host.style.cssText='position:fixed;left:-10000px;top:0;width:1000px;height:750px;pointer-events:none;';
  document.body.appendChild(host);
  const root=createRoot(host);
  try{
    flushSync(()=>root.render(createElement(ConstructionPlan,{model,data})));
    const svg=host.querySelector('svg');if(!svg)return null;
    const box=svg.viewBox.baseVal,w=widthPx,h=Math.round(widthPx*((box?.height||750)/(box?.width||1000)));
    const copy=svg.cloneNode(true) as SVGSVGElement;
    copy.setAttribute('xmlns','http://www.w3.org/2000/svg');copy.setAttribute('width',String(w));copy.setAttribute('height',String(h));copy.removeAttribute('style');
    const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)],{type:'image/svg+xml'}));
    try{
      const img=new Image();img.src=url;await img.decode();
      const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
      const ctx=canvas.getContext('2d');if(!ctx)return null;
      ctx.fillStyle='#faf8f1';ctx.fillRect(0,0,w,h);ctx.drawImage(img,0,0,w,h);
      return canvas.toDataURL('image/png');
    }finally{URL.revokeObjectURL(url);}
  }catch{return null;}
  finally{root.unmount();host.remove();}
}

/** The logo mark as a data URL, or null when it cannot be loaded. */
export async function logoImage():Promise<string|null>{
  try{
    const res=await fetch('/logo-mark.png');if(!res.ok)return null;
    const blob=await res.blob();
    return await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(typeof reader.result==='string'?reader.result:null);reader.onerror=()=>resolve(null);reader.readAsDataURL(blob);});
  }catch{return null;}
}
