import './siteModelRuntime';
import {useMemo,useRef,useState} from 'react';
import type {DeckData} from './types';
import type {PlanPoint} from './lib/deckGeometry';
import type {AgentCommand} from './designer/deckAgentController';
import {readReadingFiles,importReadings,isULevel,readingColumns,guessMapping,loadReadingPresets,saveReadingPreset,presetFromMapping,mappingFromPreset,type ColumnMapping,type TextFile,type ShotRole} from './siteReadingFiles';
import {fitPlacement,applyTransform,proposeWallFit,tieDatum,checkReadings,mergeSitePoints,uniqueIds,type PlanTransform,type PlanXY,type ZeroReference,type MergeMode,type LengthUnit} from './siteReadings';
import {validateSiteModel,type SiteModel,type SitePoint} from './siteModel';
import {createSiteSurface} from './siteSurfaceEngine';
import {getTerrainConfig} from './yardSettings';
import {getHousePlacement} from './housePlacement';
import {getHouseConfig} from './houseSettings';
import {openingWallId} from './houseFootprint';
import {useSitePreview} from './designer/useSitePreview';
import SiteOperationPreview from './SiteOperationPreview';
import './siteReadingImport.css';

/** Survey readings (U-Level / Smart Level zip, or any CSV with columns) placed on
 * the plan, tied to the project datum and applied as one reviewed site.replace
 * (plus the measured door sill), so the whole import is one undo step. */
const round=(n:number,places=2)=>Math.round(n*10**places)/10**places;
const signed=(n:number)=>`${n>0?'+':n<0?'−':''}${Math.abs(n).toFixed(1)}`;
const ANCHORS={'house-left':"House's left corner",'house-right':"House's right corner",deck:"Deck's back-left corner"} as const;
type Anchor=keyof typeof ANCHORS;
const UNITS:LengthUnit[]=['in','ft','cm','mm','m'];

export default function SiteReadingImport({data,footprint}:{data:DeckData;footprint:PlanPoint[]}){
 const review=useSitePreview(data),svg=useRef<SVGSVGElement>(null);
 const [open,setOpen]=useState(false),[source,setSource]=useState<{name:string;files:TextFile[]}>(),[fileError,setFileError]=useState(''),[chosenFile,setChosenFile]=useState(0);
 const [mapping,setMapping]=useState<ColumnMapping>(),[presetName,setPresetName]=useState(''),[presetNote,setPresetNote]=useState('');
 const [flip,setFlip]=useState(false),[roles,setRoles]=useState<Record<string,ShotRole>>({});
 const [place,setPlace]=useState<'house'|'match'>('house'),[anchor,setAnchor]=useState<Anchor>('house-left'),[mirror,setMirror]=useState(false);
 const [pairs,setPairs]=useState<{id:string;target?:PlanXY}[]>([{id:''},{id:''}]),[activePair,setActivePair]=useState(0);
 const [taps,setTaps]=useState<Record<string,PlanXY>>({}),[tapShot,setTapShot]=useState('');
 const [zeroKind,setZeroKind]=useState<ZeroReference['kind']>('door-sill'),[typedZero,setTypedZero]=useState('0');
 const [mergeChoice,setMergeChoice]=useState<MergeMode>();
 const existing=data.siteModel,house=getHousePlacement(data);

 const choose=async(file:File)=>{
  setFileError('');setSource(undefined);setMapping(undefined);setRoles({});setTaps({});setPairs([{id:''},{id:''}]);setFlip(false);setChosenFile(0);review.clear();
  try{
   const files=readReadingFiles(file.name,new Uint8Array(await file.arrayBuffer()));
   setSource({name:file.name,files});
   if(!isULevel(files)){setPlace('match');const header=readingColumns(files[0]).header;setMapping({...guessMapping(header),height:guessMapping(header).height??0,unit:'in',decimal:'.',kind:'height-up',yAxis:'down'});}
   else setPlace('house');
  }catch(error){setFileError((error as Error).message);}
 };
 const columnFiles=source&&!isULevel(source.files)?source.files:undefined,columnFile=columnFiles?.[Math.min(chosenFile,columnFiles.length-1)];
 const columns=useMemo(()=>{try{return columnFile?readingColumns(columnFile):undefined;}catch{return undefined;}},[columnFile]);
 const reading=useMemo(()=>{
  if(!source)return {};
  try{return {value:importReadings(columnFile?[columnFile]:source.files,mapping)};}catch(error){return {error:(error as Error).message};}
 },[source,columnFile,mapping]);
 const imported=reading.value,uLevel=imported?.format==='u-level';
 const shots=useMemo(()=>(imported?.shots??[]).map(s=>({...s,heightIn:flip?-s.heightIn:s.heightIn,role:roles[s.id]??s.role})),[imported,flip,roles]);
 const line=imported?.lines.find(l=>l.closed)??imported?.lines[0];
 const {inLine,positioned}=useMemo(()=>({inLine:new Set(line?.shotIds??[]),positioned:shots.filter(s=>s.x!==undefined&&s.z!==undefined)}),[line,shots]);

 // Placement: the traced house line snaps to a house or deck corner; otherwise two shots are matched by tapping.
 const placement=useMemo(():{transform?:PlanTransform;note:string;error?:string}=>{
  if(!positioned.length)return {note:'These readings have no positions. Pick each shot, then tap where it was taken.'};
  if(place==='house'){
   if(!line)return {note:'',error:'This file has no traced house line. Match two shots to the plan instead.'};
   const proposal=proposeWallFit(positioned.filter(s=>inLine.has(s.id)).map(s=>({id:s.id,x:s.x!,z:s.z!})),positioned.filter(s=>!inLine.has(s.id)).map(s=>({x:s.x!,z:s.z!})),{x:0,z:0});
   if(!proposal)return {note:'',error:'The house line is too short to place the shots. Match two shots to the plan instead.'};
   const run=proposal.pairs[1].target.x,shift=anchor==='house-left'?house.x0:anchor==='house-right'?house.x1-run:0;
   const fit=fitPlacement(proposal.pairs.map(p=>({...p,target:{x:p.target.x+shift,z:0}})));
   return {transform:fit.transform,note:`${proposal.pairs[0].id} sits on the ${ANCHORS[anchor].toLowerCase()} and the house line runs ${(run/12).toFixed(1)} ft along the wall.${proposal.wrongSide?` ${proposal.wrongSide} yard shot(s) fall on the house side; check the corner.`:''}`};
  }
  const ready=pairs.every(p=>p.id&&p.target)&&pairs[0].id!==pairs[1].id;
  if(!ready)return {note:'Pick two shots you can find on the plan (a house or deck corner), then tap each one\'s spot.'};
  try{
   const fit=fitPlacement(pairs.map(p=>{const s=shots.find(x=>x.id===p.id)!;return {id:p.id,source:{x:s.x!,z:s.z!},target:p.target!};}),{mirror});
   return {transform:fit.transform,note:`Turned ${fit.rotationDeg.toFixed(1)}°. The plan distance is ${(fit.measuredScale*100).toFixed(1)}% of the recorded one${Math.abs(fit.measuredScale-1)>.03?': check the two spots':''}.`};
  }catch(error){return {note:'',error:(error as Error).message};}
 },[positioned,inLine,place,line,anchor,house.x0,house.x1,pairs,mirror,shots]);
 const placed=useMemo(()=>shots.map(s=>({...s,at:s.x!==undefined&&s.z!==undefined&&placement.transform?applyTransform(placement.transform,{x:s.x,z:s.z}):taps[s.id]})),[shots,placement.transform,taps]);
 const {ground,unplaced}=useMemo(()=>{const g=placed.filter(s=>s.role==='ground');return {ground:g,unplaced:g.filter(s=>!s.at)};},[placed]);

 // Datum: 0.00 stays the existing ground at the deck's back-left corner; the zero's reading moves every shot onto it.
 const cornerHeight=useMemo(()=>{if(unplaced.length||ground.length<3)return undefined;try{return createSiteSurface(validateSiteModel({version:1,points:ground.map((s,i)=>({id:`r${i}`,xIn:s.at!.x,zIn:s.at!.z,elevationIn:s.heightIn})),grading:[]}),getTerrainConfig(data)).sample(0,0,'existing');}catch{return undefined;}},[ground,unplaced.length,data]);
 const tie=useMemo(()=>{try{return {value:tieDatum(zeroKind==='typed'?{kind:'typed',zeroElevationIn:Number(typedZero)}:{kind:zeroKind},cornerHeight)};}catch(error){return {error:(error as Error).message};}},[zeroKind,typedZero,cornerHeight]);

 // A U-Level export always names its shots P1..Pn, so a second export is added under its date instead of merged by name.
 const mode:MergeMode=!existing?'replace':mergeChoice??(uLevel?'append':'merge');
 const prefix=existing&&mode==='append'&&uLevel?imported?.fileName.match(/_(\d{2})-(\d{2})-\d{2}_/)?.slice(1,3).join('-'):undefined;
 const result=useMemo(()=>{
  if(!imported||!tie.value||unplaced.length||!ground.length)return undefined;
  const ids=uniqueIds(ground.map(s=>prefix?`${prefix} ${s.id}`:s.id)),incoming:SitePoint[]=ground.map((s,i)=>({id:ids[i],xIn:round(s.at!.x,3),zIn:round(s.at!.z,3),elevationIn:round(s.heightIn+tie.value!.offsetIn,3)}));
  try{
   const merged=mergeSitePoints(existing?.points??[],incoming,mode),site:SiteModel=existing?{...existing,points:merged.points}:{version:1,points:merged.points,grading:[]};
   return {site:validateSiteModel(site),incoming,merged,check:checkReadings({ground:incoming,heights:ground.map(s=>s.heightIn),zero:zeroKind,footprint:footprint.map(p=>({x:p.x,z:p.y}))})};
  }catch(error){return {error:(error as Error).message,incoming};}
 },[imported,tie,unplaced.length,ground,prefix,existing,mode,zeroKind,footprint]);
 const problems=[reading.error&&!(columnFile&&/Choose which columns/.test(reading.error))?reading.error:'',placement.error??'',unplaced.length?`${unplaced.length} ground shot(s) still need a spot on the plan.`:'',tie.error??'',result?.error??'',...(result?.check?.errors??[])].filter(Boolean);
 const sill=tie.value?.sillIn,deckTop=data.height;

 const propose=()=>{
  if(!result?.site)return;
  const commands:AgentCommand[]=[{type:'site.replace',site:result.site}];
  if(sill!==undefined){
   // The door stands on the floor: move doors that sat at the old sill with it, as the house editor does.
   const config=getHouseConfig(data),old=config.floorHeightIn??data.height,floorHeightIn=round(sill);
   commands.push({type:'design.patch',patch:{houseConfig:{...config,floorHeightIn,openings:config.openings.map(o=>o.type==='Door'&&openingWallId(o,config)==='main-front'&&Math.abs(o.bottomIn-old)<.5?{...o,bottomIn:floorHeightIn}:o)}}});
  }
  void review.propose(commands);
 };

 // The small plan: house, deck, shots; taps set match targets or place shots without positions.
 const box=useMemo(()=>{
  const pts=[...footprint,{x:house.x0,y:-Math.min(house.depthIn,96)},{x:house.x1,y:0},...placed.flatMap(s=>s.at?[{x:s.at.x,y:s.at.z}]:[])];
  const x0=Math.min(...pts.map(p=>p.x))-36,x1=Math.max(...pts.map(p=>p.x))+36,y0=Math.min(...pts.map(p=>p.y))-36,y1=Math.max(...pts.map(p=>p.y))+36;
  return {x:x0,y:y0,w:x1-x0,h:y1-y0};
 },[footprint,house.x0,house.x1,house.depthIn,placed]);
 const unit=box.w/600;
 const snapTargets:PlanXY[]=[{x:house.x0,z:0},{x:house.x1,z:0},...footprint.map(p=>({x:p.x,z:p.y}))];
 const tap=(e:React.PointerEvent<SVGSVGElement>)=>{
  const s=svg.current;if(!s)return;const m=s.getScreenCTM();if(!m)return;const p=s.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const w=p.matrixTransform(m.inverse());
  let at:PlanXY={x:round(w.x,1),z:round(w.y,1)};const near=snapTargets.find(t=>Math.hypot(t.x-at.x,t.z-at.z)<=12*unit);if(near)at=near;
  if(place==='match'&&positioned.length)setPairs(old=>old.map((q,i)=>i===activePair?{...q,target:at}:q));
  else if(tapShot){setTaps(old=>({...old,[tapShot]:at}));const next=ground.find(s=>!s.at&&s.id!==tapShot);setTapShot(next?.id??'');}
 };
 const linePath=line?line.shotIds.map(id=>placed.find(s=>s.id===id)?.at).filter((p):p is PlanXY=>!!p):[];

 if(!open)return <div className="dd-reading-import"><button type="button" className="dd-secondary" onClick={()=>setOpen(true)}>Import from U-Level or survey file</button></div>;
 return <section className="dd-reading-import" aria-label="Survey readings import">
  <div className="dd-reading-head"><h4>Import ground readings</h4><button type="button" className="dd-secondary" onClick={()=>{setOpen(false);review.clear();}}>Close import</button></div>
  <p>Drop the .zip your U-Level or Smart Level app emails, or a CSV with a name, position and height for each shot. Nothing changes until you review and apply.</p>
  <label className="dd-field">Survey readings file<input aria-label="Survey readings file" type="file" accept=".zip,.csv,.tsv,.txt,application/zip,text/csv,text/plain" onChange={e=>{const f=e.target.files?.[0];if(f)void choose(f);e.target.value='';}}/></label>
  {fileError&&<p role="alert">{fileError}</p>}
  {columnFiles&&columns&&mapping&&<fieldset className="dd-reading-columns"><legend>Columns</legend>
   {columnFiles.length>1&&<label className="dd-field">CSV in the zip<select aria-label="CSV in the zip" value={chosenFile} onChange={e=>setChosenFile(Number(e.target.value))}>{columnFiles.map((f,i)=><option key={f.name} value={i}>{f.name}</option>)}</select></label>}
   {(['name','x','y','height','comment'] as const).map(key=><label key={key} className="dd-field">{{name:'Shot name',x:'X (across)',y:'Y (out)',height:'Height or reading',comment:'Comment'}[key]}<select aria-label={`Column for ${key}`} value={mapping[key]??''} onChange={e=>setMapping({...mapping,[key]:e.target.value===''?undefined:Number(e.target.value),...(key==='height'?{height:Number(e.target.value)}:{})})}>{key!=='height'&&<option value="">None</option>}{columns.header.map((h,i)=><option key={i} value={i}>{h||`Column ${i+1}`}</option>)}</select></label>)}
   <label className="dd-field">Unit of plain numbers<select aria-label="Unit of plain numbers" value={mapping.unit} onChange={e=>setMapping({...mapping,unit:e.target.value as LengthUnit})}>{UNITS.map(u=><option key={u}>{u}</option>)}</select></label>
   <label className="dd-field">Decimal mark<select aria-label="Decimal mark" value={mapping.decimal} onChange={e=>setMapping({...mapping,decimal:e.target.value as '.'|','})}><option value=".">Point (1.5)</option><option value=",">Comma (1,5)</option></select></label>
   <label className="dd-field">Readings are<select aria-label="Readings are" value={mapping.kind} onChange={e=>setMapping({...mapping,kind:e.target.value as ColumnMapping['kind']})}><option value="height-up">Heights, up is positive</option><option value="height-down">Heights, down is positive</option><option value="elevation">Elevations</option><option value="rod">Rod readings (BS/FS)</option></select></label>
   {mapping.kind==='rod'&&<label className="dd-field">Column saying BS or FS<select aria-label="Column for sight" value={mapping.sight??''} onChange={e=>setMapping({...mapping,sight:e.target.value===''?undefined:Number(e.target.value)})}><option value="">None</option>{columns.header.map((h,i)=><option key={i} value={i}>{h||`Column ${i+1}`}</option>)}</select></label>}
   {mapping.x!==undefined&&<label className="dd-field">Y grows<select aria-label="Y axis direction" value={mapping.yAxis} onChange={e=>setMapping({...mapping,yAxis:e.target.value as 'up'|'down'})}><option value="down">Toward the yard (down the page)</option><option value="up">Away from the yard (up the page)</option></select></label>}
   <div className="dd-reading-presets">
    {loadReadingPresets().length>0&&<label className="dd-field">Saved columns<select aria-label="Saved columns" value="" onChange={e=>{const p=loadReadingPresets().find(x=>x.name===e.target.value);const m=p&&mappingFromPreset(columns.header,p);if(m)setMapping(m);else setPresetNote('That preset\'s height column is not in this file.');}}><option value="">Choose…</option>{loadReadingPresets().map(p=><option key={p.name}>{p.name}</option>)}</select></label>}
    <label className="dd-field">Preset name<input aria-label="Preset name" value={presetName} maxLength={60} onChange={e=>setPresetName(e.target.value)}/></label>
    <button type="button" className="dd-secondary" onClick={()=>{try{setPresetNote(saveReadingPreset(presetFromMapping(presetName,columns.header,mapping))?'Columns saved on this device.':'This browser cannot save presets.');}catch(error){setPresetNote((error as Error).message);}}}>Save columns</button>
    {presetNote&&<p role="status">{presetNote}</p>}
   </div>
  </fieldset>}
  {imported&&<>
   <p role="status">{imported.fileName}: {shots.length} shots{line?`, ${line.closed?'a closed house line':'a measured line'} (${line.shotIds.join(', ')})`:''}. Unit: {imported.unit}{imported.unitSource==='lengths'?', confirmed by the recorded lengths':imported.unitSource==='assumed'?', assumed':''}.</p>
   {imported.warnings.map(w=><p role="alert" key={w}>{w}</p>)}
   <label className="dd-check"><input type="checkbox" checked={flip} onChange={e=>setFlip(e.target.checked)}/>Readings grow downward (flip the sign)</label>
   <fieldset><legend>Place the shots</legend>
    {positioned.length>0&&<label className="dd-field">Place shots by<select aria-label="Place shots by" value={place} onChange={e=>setPlace(e.target.value as 'house'|'match')}>{line&&<option value="house">The traced house line</option>}<option value="match">Matching two shots to the plan</option></select></label>}
    {place==='house'&&line&&<label className="dd-field">House line starts at<select aria-label="House line anchor" value={anchor} onChange={e=>setAnchor(e.target.value as Anchor)}>{Object.entries(ANCHORS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>}
    {place==='match'&&positioned.length>0&&<div className="dd-reading-pairs">{pairs.map((p,i)=><div key={i} className="dd-reading-pair"><label className="dd-field">Shot {i+1}<select aria-label={`Match shot ${i+1}`} value={p.id} onChange={e=>{setPairs(old=>old.map((q,j)=>j===i?{id:e.target.value}:q));setActivePair(i);}}><option value="">Choose…</option>{positioned.map(s=><option key={s.id} value={s.id}>{s.id}</option>)}</select></label><button type="button" className="dd-secondary" aria-pressed={activePair===i} onClick={()=>setActivePair(i)}>{p.target?`Spot ${i+1}: ${(p.target.x/12).toFixed(1)}, ${(p.target.z/12).toFixed(1)} ft`:`Tap spot ${i+1} on the plan`}</button></div>)}<label className="dd-check"><input type="checkbox" checked={mirror} onChange={e=>setMirror(e.target.checked)}/>Mirror the shots</label></div>}
    {ground.some(s=>s.x===undefined)&&<label className="dd-field">Shot to place<select aria-label="Shot to place" value={tapShot} onChange={e=>setTapShot(e.target.value)}><option value="">Choose…</option>{ground.filter(s=>s.x===undefined).map(s=><option key={s.id} value={s.id}>{s.id}{s.at?' (placed)':''}</option>)}</select></label>}
    <svg ref={svg} className="dd-reading-plan" role="img" aria-label="Survey readings placement plan" viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`} onPointerUp={tap}>
     <rect x={house.x0} y={-Math.min(house.depthIn,96)} width={house.x1-house.x0} height={Math.min(house.depthIn,96)} className="dd-reading-house"/>
     <polygon points={footprint.map(p=>`${p.x},${p.y}`).join(' ')} className="dd-reading-deck" strokeWidth={unit*1.5}/>
     {linePath.length>1&&<polyline points={linePath.map(p=>`${p.x},${p.z}`).join(' ')} className="dd-reading-line" strokeWidth={unit*3}/>}
     {placed.map(s=>s.at&&<g key={s.id}><circle cx={s.at.x} cy={s.at.z} r={unit*6} className={s.role==='ground'?'dd-reading-shot':'dd-reading-ref'}/><text x={s.at.x+unit*9} y={s.at.z-unit*7} fontSize={unit*13}>{s.label}{tie.value?` ${signed(s.heightIn+tie.value.offsetIn)}`:''}</text></g>)}
     {place==='match'&&pairs.map((p,i)=>p.target&&<text key={i} x={p.target.x} y={p.target.z} fontSize={unit*16} textAnchor="middle" className="dd-reading-target">{`✕${i+1}`}</text>)}
    </svg>
    {placement.note&&<p>{placement.note}</p>}
   </fieldset>
   <fieldset><legend>Tie the heights to the design</legend>
    <label className="dd-field">Zero was set on<select aria-label="Zero was set on" value={zeroKind} onChange={e=>setZeroKind(e.target.value as ZeroReference['kind'])}><option value="door-sill">The back door sill</option><option value="deck-corner">The ground at the deck's back-left corner</option><option value="typed">Something else (type its height)</option></select></label>
    {zeroKind==='typed'&&<label className="dd-field">Zero height above the deck corner ground (in)<input aria-label="Zero height above the deck corner ground" inputMode="decimal" value={typedZero} onChange={e=>setTypedZero(e.target.value)}/></label>}
    {sill!==undefined&&<p role="status">The door sill measures {sill.toFixed(1)} in above the ground at the deck's back-left corner. The deck top is set at {deckTop} in, {deckTop>sill+.01?`${(deckTop-sill).toFixed(1)} in above the sill: lower the deck or plan a sill detail`:sill-deckTop>7.75?`${(sill-deckTop).toFixed(1)} in below the sill: more than one step down from the door`:`${(sill-deckTop).toFixed(1)} in below the sill`}.</p>}
    {tie.value?.warnings.map(w=><p role="alert" key={w}>{w}</p>)}
   </fieldset>
   {existing&&<label className="dd-field">With the points already measured<select aria-label="Combine with measured points" value={mode} onChange={e=>setMergeChoice(e.target.value as MergeMode)}><option value="append">Add these shots{uLevel?' under their export date':''}</option><option value="merge">Update shots with the same names</option><option value="replace">Replace the measured points</option></select></label>}
   <table className="dd-reading-table" aria-label="Survey readings preview"><thead><tr><th>Shot</th><th>Reading</th><th>Height vs zero</th><th>Design elevation</th><th>Use as</th></tr></thead><tbody>{placed.map(s=><tr key={s.id}><td>{s.id}</td><td>{s.raw.height}</td><td>{signed(s.heightIn)} in</td><td>{tie.value&&s.role==='ground'?`${signed(s.heightIn+tie.value.offsetIn)} in`:'—'}</td><td><select aria-label={`Use ${s.id} as`} value={s.role} onChange={e=>setRoles(old=>({...old,[s.id]:e.target.value as ShotRole}))}><option value="ground">Ground</option><option value="reference">Reference only</option></select></td></tr>)}</tbody></table>
   {imported.lengthChecks.length>0&&<p>Recorded lengths: {imported.lengthChecks.map(c=>`${c.from}-${c.to} ${c.ok?'matches':'differs'}`).join(', ')}.</p>}
   {result?.check?.warnings.map(w=><p role="alert" key={w}>{w}</p>)}
   {problems.map(p=><p role="alert" key={p}>{p}</p>)}
   {result?.merged&&<p>{result.merged.added.length} shots added{result.merged.updated.length?`, ${result.merged.updated.length} updated`:''}{result.merged.superseded.length?`, ${result.merged.superseded.length} re-shot points replaced`:''}{result.merged.removed.length?`, ${result.merged.removed.length} old points removed`:''}{sill!==undefined?'; the house door sill is set from the survey':''}.</p>}
   <button type="button" disabled={!!problems.length||!result?.site||review.busy} onClick={propose}>Preview survey import</button>
  </>}
  {(review.preview||review.busy||review.error)&&<SiteOperationPreview review={review}/>}
 </section>;
}
