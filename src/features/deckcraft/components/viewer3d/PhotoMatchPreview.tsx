import {useEffect,useLayoutEffect,useMemo,useRef,useState,type PointerEvent} from 'react';
import {Canvas,useThree} from '@react-three/fiber';
import {Environment,Lightformer} from '@react-three/drei';
import {PerspectiveCamera,Plane,Vector3,NeutralToneMapping} from 'three';
import {Scene} from './Deck3DViewer';
import {makePhotoCamera} from '../../photoMatchCamera';
import {clampPhotoPoint,photoCalibrationError,type HomePhoto,type PhotoCalibration,type PhotoMarker,type PhotoPoint} from '../../photoMatch';
import {buildYardModel} from '../../yardModel';
import type {ViewLayers} from '../../viewLayers';
import type {DeckData} from '../../types';
import type {DeckTakeoff} from '../../deckTakeoff';

function LockedPhotoCamera({matched}:{matched:PerspectiveCamera}){
  const {camera,size,invalidate}=useThree();
  useLayoutEffect(()=>{(camera as PerspectiveCamera).copy(matched);camera.updateMatrixWorld(true);invalidate();},[camera,matched,size.width,size.height,invalidate]);
  return null;
}
export default function PhotoMatchPreview({data,model,layers,photo,calibration:c,onChange,tool,onTool,guides,showDeck,onEdit}:{data:DeckData;model:DeckTakeoff;layers:ViewLayers;photo:HomePhoto|null;calibration:PhotoCalibration;onChange:(c:PhotoCalibration)=>void;tool:PhotoMarker|null;onTool:(t:PhotoMarker|null)=>void;guides:boolean;showDeck:boolean;onEdit:()=>void}){
  const frame=useRef<HTMLDivElement>(null),photoImage=useRef<HTMLImageElement>(null),canvas=useRef<HTMLCanvasElement|null>(null),drag=useRef<PhotoMarker|null>(null);
  const [exportError,setExportError]=useState(''),[exportUrl,setExportUrl]=useState('');
  useEffect(()=>()=>{if(exportUrl)URL.revokeObjectURL(exportUrl);},[exportUrl]);
  useEffect(()=>{setExportUrl('');setExportError('');},[photo,c,model,layers,showDeck]);
  const deck=useMemo(()=>{const {yardFeatures:_yard,terrainConfig:_terrain,...rest}=data;return {...rest,houseVisible:false};},[data]);
  const yard=useMemo(()=>buildYardModel(deck,model),[deck,model]);
  const visibleLayers={...layers,house:false,ground:false,footings:false};
  const matched=useMemo(()=>{
    if(!photo)return {error:'Choose a photo to begin.',result:null};
    const error=photoCalibrationError(c,photo.width,photo.height);if(error)return {error,result:null};
    try{return {error:null,result:makePhotoCamera(c,photo.width,photo.height,new Vector3(model.levels[0].footprint.bounds.w/24,model.levels[0].top/12,0))};}
    catch(error){return {error:error instanceof Error?error.message:'Could not calibrate this view.',result:null};}
  },[photo,c,model]);
  const locate=(e:PointerEvent):PhotoPoint=>{const r=frame.current!.getBoundingClientRect();return clampPhotoPoint({x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height});};
  const place=(key:PhotoMarker,p:PhotoPoint)=>onChange({...c,[key]:p});
  async function download(){
    setExportError('');
    try{
      if(!photo||!photoImage.current?.complete||!photoImage.current.naturalWidth||!matched.result)throw new Error('Wait for the photo and calibrated model to finish loading.');
      const output=document.createElement('canvas');output.width=photo.width;const footer=100;output.height=photo.height+footer;
      const ctx=output.getContext('2d');if(!ctx)throw new Error('Image download is unavailable.');
      ctx.drawImage(photoImage.current,0,0,photo.width,photo.height);
      if(showDeck){if(!canvas.current)throw new Error('The deck preview is still loading.');ctx.drawImage(canvas.current,0,0,photo.width,photo.height);}
      ctx.fillStyle='#183c33';ctx.fillRect(0,photo.height,output.width,footer);ctx.fillStyle='white';
      ctx.font=`bold ${Math.max(10,Math.min(26,photo.width/35))}px Arial`;ctx.fillText('GOLDEN MAPLE · CONCEPT PHOTO OVERLAY',18,photo.height+35,photo.width-36);
      ctx.font=`${Math.max(9,Math.min(20,photo.width/48))}px Arial`;ctx.fillText('Photo-matched illustration only — not a measured survey or permit drawing.',18,photo.height+70,photo.width-36);
      const blob=await new Promise<Blob>((resolve,reject)=>output.toBlob(b=>b?resolve(b):reject(new Error('Could not prepare the image.')),'image/png'));
      setExportUrl(URL.createObjectURL(blob));
    }catch(error){setExportError(error instanceof Error?error.message:'Could not download the overlay.');}
  }
  if(!photo)return <section className="dd-photo-empty" aria-label="Home photo preview"><span className="dd-eyebrow">DESIGN ON MY HOME</span><h3>Your home. Your deck.</h3><p>Choose a clear photo of the wall where the deck will attach. Include the wall, ground and room for the new deck.</p><button className="dd-primary" onClick={onEdit}>Set up home photo</button><p className="dd-note">Have one real measurement ready. A longer reference on the same wall gives a better starting point.</p></section>;
  return <section className="dd-photo-preview" aria-label="Calibrated home photo preview">
    <div className="dd-photo-status"><span>{tool?`Click the photo to place ${tool==='anchor'?'deck attachment':`reference ${tool.toUpperCase()}`}.`:'Photo camera locked · use perspective controls to align.'}</span><button className="dd-secondary" onClick={onEdit}>Photo controls</button></div>
    <div ref={frame} className="dd-photo-frame" style={{aspectRatio:`${photo.width}/${photo.height}`}} onPointerDown={e=>{if(tool&&e.button===0){place(tool,locate(e));onTool(tool==='a'?'b':tool==='b'?'anchor':null);}}}>
      <img ref={photoImage} className="dd-home-photo" src={photo.url} alt="Your uploaded home — original photograph" draggable={false}/>
      {matched.result&&showDeck&&<div className="dd-photo-model" aria-label="Current deck model over home photo"><Canvas shadows frameloop="demand" dpr={[1,1.5]} gl={{alpha:true,antialias:true,preserveDrawingBuffer:true,toneMapping:NeutralToneMapping,clippingPlanes:[new Plane(new Vector3(0,1,0),0),new Plane(new Vector3(0,0,1),0)]}} onCreated={({gl})=>{canvas.current=gl.domElement;gl.setClearColor(0x000000,0);}}>
        <LockedPhotoCamera matched={matched.result.camera}/>
        <Environment resolution={128} frames={1} environmentIntensity={.4}><Lightformer intensity={3} position={[0,12,0]} rotation={[Math.PI/2,0,0]} scale={[20,20,1]}/><Lightformer intensity={2} position={[-15,6,8]} rotation={[0,Math.PI/2,0]} scale={[12,15,1]}/></Environment>
        <Scene data={deck} model={model} layers={visibleLayers} structure={!layers.deckBoards} cutaway={false} inspection={layers.hardware} yard={yard}/>
      </Canvas></div>}
      {guides&&<>
        <svg className="dd-photo-guides" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{c.a&&c.b&&<line x1={c.a.x*100} y1={c.a.y*100} x2={c.b.x*100} y2={c.b.y*100} stroke="#ffe08a" strokeWidth=".5"/>}</svg>
        {(['a','b','anchor'] as const).map(key=>c[key]&&<button key={key} type="button" className={`dd-photo-marker ${key==='anchor'?'dd-photo-anchor':''}`} aria-label={key==='anchor'?'Deck attachment marker':`Reference ${key.toUpperCase()} marker`} style={{left:`${c[key]!.x*100}%`,top:`${c[key]!.y*100}%`}} onPointerDown={e=>{e.stopPropagation();e.preventDefault();e.currentTarget.focus();drag.current=key;e.currentTarget.setPointerCapture(e.pointerId);onTool(null);}} onPointerMove={e=>{if(drag.current===key){e.stopPropagation();place(key,locate(e));}}} onPointerUp={e=>{drag.current=null;e.currentTarget.releasePointerCapture(e.pointerId);}} onPointerCancel={()=>{drag.current=null;}} onKeyDown={e=>{const amount=e.shiftKey ? .01 : .001,delta:Record<string,PhotoPoint>={ArrowLeft:{x:-amount,y:0},ArrowRight:{x:amount,y:0},ArrowUp:{x:0,y:-amount},ArrowDown:{x:0,y:amount}};if(delta[e.key]){e.preventDefault();place(key,clampPhotoPoint({x:c[key]!.x+delta[e.key].x,y:c[key]!.y+delta[e.key].y}));}}}>{key==='anchor'?'+':key.toUpperCase()}</button>)}
      </>}
    </div>
    {matched.error&&<p className="dd-note" role="status">{matched.error}</p>}
    {matched.result&&matched.result.camera.position.z<model.levels[0].footprint.bounds.h/12+3&&<p className="dd-quote-notice">This calibration puts the camera near or inside the proposed deck footprint. Use a photo taken farther back, and recheck the measurement and perspective.</p>}
    <div className="dd-photo-download"><button className="dd-secondary" disabled={!matched.result} onClick={()=>void download()}>Create concept PNG</button>{exportUrl&&<div className="dd-photo-export"><img src={exportUrl} alt="Prepared concept image with illustration-only label"/><a className="dd-primary" href={exportUrl} download="golden-maple-home-deck-concept.png">Save concept PNG</a><p className="dd-note" role="status">Your concept image is ready to save. It includes the photo, visible deck layers and a concept-only label.</p></div>}<p className="dd-note">Actual deck geometry · assumed photo perspective. House, ground and buried footings use the photograph, not the 3D scene. No automatic foreground masking.</p></div>
    {exportError&&<p className="dd-error" role="alert">{exportError}</p>}
  </section>;
}
