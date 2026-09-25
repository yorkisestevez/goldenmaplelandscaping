import {createElement} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import ConstructionPlan from './ConstructionPlan';
import {swatchUrl} from './lib/swatches';
import {proposalFinishes} from './proposalModel';
import type {DeckTakeoff} from './deckTakeoff';
import type {DeckData} from './types';

/**
 * Browser-only pictures for the proposal PDF, loaded with the PDF builder. The plans are drawn off-screen by the same
 * component the page shows, then rasterised; their styling is all inline SVG attributes, so each picture matches the
 * screen: the builder's construction plan (the contractor plan, unchanged) and the site plan (R4's drawing-set plan).
 */
export async function planImage(model:DeckTakeoff,data:DeckData,widthPx=2000,variant:'contractor'|'site'='contractor'):Promise<string|null>{
  const host=document.createElement('div');
  host.setAttribute('aria-hidden','true');
  host.style.cssText='position:fixed;left:-10000px;top:0;width:1000px;height:750px;pointer-events:none;';
  document.body.appendChild(host);
  const root=createRoot(host);
  try{
    flushSync(()=>root.render(variant==='site'?createElement(ConstructionPlan,{model,data,variant:'site'}):createElement(ConstructionPlan,{model,data})));
    const svg=host.querySelector('svg');if(!svg)return null;
    const box=svg.viewBox.baseVal,w=widthPx,h=Math.round(widthPx*((box?.height||750)/(box?.width||1000)));
    const copy=svg.cloneNode(true) as SVGSVGElement;
    // The proposal's site plan is drawn without the designer's 1 ft grid, as the printed proposal shows it.
    if(variant==='site')for(const grid of copy.querySelectorAll('.dd-plan-grid'))grid.remove();
    copy.setAttribute('xmlns','http://www.w3.org/2000/svg');copy.setAttribute('width',String(w));copy.setAttribute('height',String(h));copy.removeAttribute('style');
    const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)],{type:'image/svg+xml'}));
    try{
      const img=new Image();img.src=url;await img.decode();
      const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
      const ctx=canvas.getContext('2d');if(!ctx)return null;
      ctx.fillStyle=variant==='site'?'#fbfbf8':'#faf8f1';ctx.fillRect(0,0,w,h);ctx.drawImage(img,0,0,w,h);
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

/**
 * The materials board's swatch photos (the same bundled manufacturer files the 3D view uses), each redrawn at 320 px
 * as a plain JPEG so the PDF stays light. A photo that cannot load is left out; its tile keeps its name.
 */
export async function swatchImages(data:DeckData,model:DeckTakeoff,sizePx=320):Promise<Record<string,string>>{
  const files=[...new Set(proposalFinishes(data,model).flatMap(t=>t.swatch?[t.swatch]:[]))];
  const pairs=await Promise.all(files.map(async file=>{
    const url=swatchUrl(file);if(!url)return null;
    try{
      const img=new Image();img.src=url;await img.decode();
      const canvas=document.createElement('canvas');canvas.width=canvas.height=sizePx;
      const ctx=canvas.getContext('2d');if(!ctx)return null;
      const side=Math.min(img.naturalWidth,img.naturalHeight);
      ctx.drawImage(img,(img.naturalWidth-side)/2,(img.naturalHeight-side)/2,side,side,0,0,sizePx,sizePx);
      return [file,canvas.toDataURL('image/jpeg',.86)] as const;
    }catch{return null;}
  }));
  return Object.fromEntries(pairs.filter((p):p is readonly [string,string]=>!!p));
}
