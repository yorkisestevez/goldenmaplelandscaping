import {useRef} from 'react';
import {photoCalibrationError,type HomePhoto,type PhotoCalibration,type PhotoMarker} from './photoMatch';

export type PhotoEditorProps={photo:HomePhoto|null;calibration:PhotoCalibration;onChange:(c:PhotoCalibration)=>void;onFile:(file:File)=>void;busy:boolean;error:string;tool:PhotoMarker|null;onTool:(t:PhotoMarker|null)=>void;guides:boolean;onGuides:(v:boolean)=>void;showDeck:boolean;onShowDeck:(v:boolean)=>void};
export default function PhotoMatchEditor({photo,calibration:c,onChange,onFile,busy,error,tool,onTool,guides,onGuides,showDeck,onShowDeck}:PhotoEditorProps){
  const upload=useRef<HTMLInputElement>(null),camera=useRef<HTMLInputElement>(null);
  const input=(capture=false)=><input ref={capture?camera:upload} hidden type="file" accept="image/jpeg,image/png,image/webp" capture={capture?'environment':undefined} aria-label={capture?'Take home photo':'Choose home photo'} onChange={e=>{const f=e.currentTarget.files?.[0];if(f)onFile(f);e.currentTarget.value='';}}/>;
  const number=(key:'distanceIn'|'yaw'|'pitch'|'roll'|'fov',label:string,min:number,max:number,step=1)=><label className="dd-field"><span>{label}</span><input aria-label={label} type="number" min={min} max={max} step={step} value={key==='distanceIn'&&!c[key]?'':c[key]} onChange={e=>onChange({...c,[key]:e.target.value===''?0:Number(e.target.value)})}/></label>;
  const incomplete=photo?photoCalibrationError(c,photo.width,photo.height):null;
  return <div className="dd-photo-editor">
    <p>Use your real home as the backdrop. The deck stays connected to your current design, materials and dimensions.</p>
    <div className="dd-summary-actions"><button className="dd-primary" disabled={busy} onClick={()=>upload.current?.click()}>{busy?'Preparing photo…':photo?'Replace photo':'Choose home photo'}</button><button className="dd-secondary" disabled={busy} onClick={()=>camera.current?.click()}>Take a photo</button></div>{input()}{input(true)}
    <p className="dd-note">JPEG, PNG or WebP · up to 20 MB. Processed on this device, with no AI upload. Photo and calibration are session-only and are not included in Save JSON. Download your finished overlay before closing or reloading.</p>
    {error&&<p className="dd-error" role="alert">{error}</p>}
    {photo&&<>
      <h3>1. Set a known distance</h3><p className="dd-note">Measure a long, visible feature on the attachment wall, such as a door height or wall width. Mark its two endpoints—not points on different walls or at different depths.</p>
      <div className="dd-photo-marker-tools">{([['a','Reference start A'],['b','Reference end B'],['anchor','Deck attachment']] as const).map(([key,label])=><button type="button" className="dd-secondary" aria-pressed={tool===key} key={key} onClick={()=>{onGuides(true);onTool(key);}}>{c[key]?'Move':'Mark'} {label}</button>)}</div>
      {number('distanceIn','Known distance (inches)',1,2400,.25)}
      <details className="dd-advanced"><summary>Position markers by keyboard / percentage</summary><label className="dd-field"><span>Marker to position</span><select aria-label="Marker to position" value={tool??'anchor'} onChange={e=>{onGuides(true);onTool(e.target.value as PhotoMarker);}}><option value="a">Reference start A</option><option value="b">Reference end B</option><option value="anchor">Deck attachment</option></select></label><div className="dd-fields two">{(['x','y'] as const).map(axis=><label className="dd-field" key={axis}><span>{axis==='x'?'Horizontal':'Vertical'} position (%)</span><input type="number" min={0} max={100} step={.1} aria-label={`${axis==='x'?'Horizontal':'Vertical'} marker position (%)`} value={c[tool??'anchor']?Number((c[tool??'anchor']![axis]*100).toFixed(2)):''} onChange={e=>{const v=Number(e.target.value);if(e.target.value!==''&&Number.isFinite(v))onChange({...c,[tool??'anchor']:{...(c[tool??'anchor']??{x:.5,y:.5}),[axis]:Math.max(0,Math.min(100,v))/100}});}}/></label>)}</div></details>
      <h3>2. Attach the deck</h3><p className="dd-note">Mark the centre of the deck’s house-side edge at finished deck height—not at ground level. In the photo, click to place a marker or drag it to refine. Arrow keys move a focused marker; Shift moves faster.</p>
      <p className="dd-note" role="status">{incomplete??'Reference scale is applied for the assumed camera angle. Check perspective below; this is not an accuracy certification.'}</p>
      <h3>3. Match the perspective</h3><p className="dd-note">Match the side angle, downward tilt and roll to the photograph. Lens angle changes depth perspective. Use a straight, uncropped photo without panorama distortion and check against a second measured feature.</p>
      <div className="dd-fields two">{number('yaw','Side angle (degrees)',-65,65)}{number('pitch','Downward tilt (degrees)',-15,55)}{number('roll','Photo roll (degrees)',-20,20)}{number('fov','Vertical lens angle (degrees)',25,85)}</div>
      <label className="dd-check"><input type="checkbox" role="switch" checked={guides} onChange={e=>{onGuides(e.target.checked);if(!e.target.checked)onTool(null);}}/><span>Show calibration guides</span></label>
      <label className="dd-check"><input type="checkbox" role="switch" checked={showDeck} onChange={e=>onShowDeck(e.target.checked)}/><span>Show deck over photo</span></label>
      <p className="dd-quote-notice">Concept visualization only. One photo does not reconstruct the whole house or certify measurements. Existing plants, furniture and structures will not automatically cover the deck overlay. Flat-grade clipping is illustrative; use verified site dimensions for plans and permits.</p>
    </>}
  </div>;
}
