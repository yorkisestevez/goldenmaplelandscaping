import type {DeckData} from './types';
import type {DeckTakeoff} from './deckTakeoff';
import {getFramelessSystem} from './framelessSystems';

export const RAILING_REVIEW_STAGES = [
 {id:'site',title:'Site and survey',owner:'Designer / surveyor',task:'Record the site survey, lot-line setbacks, grades and guard elevations; confirm the local submission checklist.'},
 {id:'panels',title:'Panel shop layout',owner:'Railing supplier',task:'Obtain dimensioned, revision-controlled glass and hardware shop drawings. Confirm corner gaps, edge distances and glass specification before ordering.'},
 {id:'engineering',title:'Engineering and substrate',owner:'Qualified designer / engineer',task:'Match the exact guard assembly, height, loads, substrate and anchor schedule to applicable engineering. Resolve deck blocking and load transfer; do not anchor only to decking.'},
 {id:'installation',title:'Installation manual',owner:'Site supervisor',task:'Keep the current manual for the ordered model, fasteners and glass. Record the revision and review sequencing, torque, tolerances, corrosion protection and drainage.'},
 {id:'stairs',title:'Stairs and handrails',owner:'Designer / supplier',task:'Resolve every slope, landing transition, termination and required graspable handrail. A level-glass preview is not an approved stair guard.'},
 {id:'quote',title:'Supplier quote and order',owner:'Estimator / purchaser',task:'Confirm availability, finished dimensions, glass treatment, hardware finish, freight, lead time and written quote. Do not order from schematic quantities.'},
 {id:'permit',title:'Municipal permit record',owner:'Permit coordinator',task:'Record the application or issued-permit reference and its exact status. Obtain the authority’s required drawing set, engineering and inspection requirements; a reference does not establish approval.'},
 {id:'handover',title:'Field QA and handover',owner:'Site supervisor',task:'Record substrate and pre-cover photos, fastener checks, installed dimensions, deficiencies, inspections, warranty and care handover. Resolve deficiencies before release.'},
] as const;
export type RailingReviewId=typeof RAILING_REVIEW_STAGES[number]['id'];
export interface RailingEvidence {id:RailingReviewId;reference:string;reviewer:string;date:string;designKey:string}
export interface RailingReview {records:RailingEvidence[]}
const ids=new Set<string>(RAILING_REVIEW_STAGES.map(s=>s.id));
const validText=(v:unknown,max:number):v is string=>typeof v==='string'&&v.trim().length>0&&v.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v);
export function validReviewDate(value:unknown):value is string{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const [y,m,d]=value.split('-').map(Number);if(y<1900||y>9999)return false;
 const date=new Date(Date.UTC(y,m-1,d));return date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d;
}
/** Self-recorded references only: never accepts approval, price, upload or stamp fields. */
export function validateRailingReview(value:unknown):RailingReview{
 const records:RailingEvidence[]=[],seen=new Set<string>();
 if(!value||typeof value!=='object'||!Array.isArray((value as {records?:unknown}).records))return {records};
 for(const raw of (value as {records:unknown[]}).records.slice(0,8)){
  if(!raw||typeof raw!=='object')continue;
  const r=raw as Record<string,unknown>;
  if(typeof r.id!=='string'||!ids.has(r.id)||seen.has(r.id)||!validText(r.reference,240)||!validText(r.reviewer,240)||!validReviewDate(r.date)||!validText(r.designKey,12000))continue;
  seen.add(r.id);records.push({id:r.id as RailingReviewId,reference:r.reference.trim(),reviewer:r.reviewer.trim(),date:r.date,designKey:r.designKey});
 }
 return {records};
}
const KEY_FIELDS:ReadonlyArray<keyof DeckData>=[
 'projectAddress','municipality','siteType','soilCondition','intendedLoad','deckType','foundation','foundationDepthIn',
 'width','length','height','cutoutWidth','cutoutLength','width2','length2','height2','cutoutWidth2','cutoutLength2','shape','levels',
 'level2Position','level2Offset','cutoutCorner','deckingMaterial','framingSize','joistSpacing','boardWidth','pattern','pictureFrameRows','pictureFrameOverhangIn','installation',
 'railingType','catalogueRailingId','railingHardwareFinish','stairFlights','stairWidth','stairType','stairPosition','stairOffset','stairTurn','landingDepthIn','landingStraight','landingAfterRisers','terrainConfig',
];
function canonical(value:unknown):unknown{
 if(Array.isArray(value))return value.map(canonical);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)]));
 return value??null;
}
/** Exact bounded signature, not a security hash or a professional sign-off. */
export function railingDesignKey(data:DeckData):string{
 const system=getFramelessSystem(data);
 return JSON.stringify({version:1,fields:KEY_FIELDS.map(k=>[k,canonical(data[k])]),removed:[...(data.removedRailingSections??[])].sort(),system:system?canonical(system):null});
}
export function railingReviewStatus(data:DeckData){
 const key=railingDesignKey(data),records=validateRailingReview(data.railingReview).records;
 const stages=RAILING_REVIEW_STAGES.map(stage=>{const record=records.find(r=>r.id===stage.id);return {...stage,record,status:!record?'missing':record.designKey===key?'recorded':'stale'} as const;});
 return {key,stages,recorded:stages.filter(s=>s.status==='recorded').length,missing:stages.filter(s=>s.status==='missing').length,stale:stages.filter(s=>s.status==='stale').length,approval:'Not assessed — references are not approvals' as const};
}
export const RAILING_MUNICIPAL_REFERENCES=[
 {title:'City of Barrie — deck permit application checklist',url:'https://www.barrie.ca/planning-building-infrastructure/building-renovating/project-resources/deck-permit-application-checklist'},
 {title:'Guelph Eramosa — Building a Deck, 2024 package (local example)',url:'https://www.get.on.ca/uploads/userfiles/files/Building%20a%20Deck%20-%20Full%20Package%202024.pdf'},
];
export function escapeJobPackHtml(value:unknown):string{return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));}
const h=escapeJobPackHtml;
/** Standalone printable reference register. No scripts, remote assets or purported seal. */
export function buildRailingJobPack(data:DeckData,model:DeckTakeoff):string{
 const system=getFramelessSystem(data),review=railingReviewStatus(data),sections=model.railing.sections,active=sections.filter(s=>s.enabled),level=active.filter(s=>Math.abs(s.a.y-s.b.y)<.01),slopes=active.length-level.length,unmodeled=new Set(model.railing.unmodeledSectionIds);
 const docs=[...(system?.documents??[]),...RAILING_MUNICIPAL_REFERENCES];
 const previewSchedule=system?`${model.railing.glass.length} schematic level glass panel(s) drawn; ${system.mount==='spigot'?`${model.railing.spigotCount} illustrative spigot assembly locations`:`${(model.railing.shoeLengthIn/12).toFixed(2)} ft of schematic base shoe`}. These preview quantities exclude unresolved sloped assemblies and all other unmodeled sections (${unmodeled.size} section(s) total); they do not specify purchased glass, stock lengths, anchor counts or required waste.`:'';
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DeckCraft railing job pack</title><style>body{font:14px/1.5 system-ui,sans-serif;color:#18252d;max-width:1040px;margin:32px auto;padding:0 24px}h1{font-size:28px}h2{margin-top:28px}h3{margin-bottom:4px;font-size:16px}.notice{border:2px solid #986522;background:#fff8e9;padding:16px}.muted{color:#485b66}table{width:100%;border-collapse:collapse;margin:16px 0;font-size:12px}th,td{padding:8px;border:1px solid #bdc9cd;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{background:#eef3f4}li{margin:7px 0}a{color:#154b64;overflow-wrap:anywhere}section{break-inside:avoid}footer{border-top:1px solid #bcc8cc;margin-top:24px;padding-top:12px}@media print{body{margin:0;padding:0;font-size:10pt}h1{font-size:22pt}a{color:inherit}thead{display:table-header-group}tr{break-inside:avoid}.notice{background:none} @page{margin:16mm}}</style></head><body>
 <h1>Railing coordination &amp; installation job pack</h1><p class="muted">DeckCraft Pro · Working reference register · ${h(new Date().toISOString().slice(0,10))}</p>
 <div class="notice"><strong>NOT FOR CONSTRUCTION — NOT A PERMIT APPROVAL</strong><br>This pack lists project inputs, schematic layout and self-recorded document references. It does not attach or verify the referenced files, certify engineering, supply a glass fabrication schedule, replace manufacturer instructions or authorize work. Even eight recorded stages do not establish permit readiness.</div>
 <h2>Project snapshot</h2><p><strong>${h(data.customerName||'Customer not entered')}</strong><br>${h(data.projectAddress||'Site address not entered')}<br>Municipality: ${h(data.municipality)} · Site: ${h(data.siteType)} · Soil: ${h(data.soilCondition)}</p>
 <table><tbody><tr><th>Main deck</th><td>${h(data.width)} × ${h(data.length)} ft · ${h(data.height)} in above model grade · ${h(data.shape)} · ${h(data.levels)} level(s)</td></tr><tr><th>Structure inputs</th><td>${h(data.deckType)} · ${h(data.foundation)} · ${h(data.framingSize)} joists @ ${h(data.joistSpacing)} in · ${h(data.deckingMaterial)}</td></tr><tr><th>Selected guard</th><td>${h(system?.name??data.railingType)} · Hardware finish: ${h(data.railingHardwareFinish??'Default preview finish — confirm supplier')}<br>${h(system?.availability??'Obtain current supplier documentation for the selected guard.')}</td></tr><tr><th>Preview only</th><td>${system?`${h(system.mount)} mounting · ${h(system.glassThicknessIn)} in glass · ${h(system.previewHeightIn)} in preview height. ${h(system.dimensionNote)}`:'No verified manufacturer-specific guard assembly is represented in this pack.'}</td></tr></tbody></table>
 <h2>Schematic layout — not an order list</h2><p>${level.length} enabled level/landing guard section(s); ${slopes} sloped section(s) requiring separate stair/handrail resolution; ${sections.length-active.length} intentionally removed section(s). Section counts are layout segments, not a verified glass panel, anchor or hardware takeoff. Review unguarded edges and any removed sections.</p><p>${h(previewSchedule)}</p>
 <table><thead><tr><th>Section</th><th>Model length</th><th>State</th></tr></thead><tbody>${sections.map(s=>`<tr><td>${h(s.label)}</td><td>${h((s.lengthIn/12).toFixed(2))} ft</td><td>${!s.enabled?'Removed — safety review':unmodeled.has(s.id)?'Unmodeled — slope, winder or unsupported short-section detail required':Math.abs(s.a.y-s.b.y)>.01?'Sloped — unresolved supplier detail':'Level schematic — shop drawing required'}</td></tr>`).join('')}</tbody></table>
 <h2>Current model warnings</h2><ul>${model.issues.length?model.issues.map(issue=>`<li>${h(issue)}</li>`).join(''):'<li>No model warning was generated. This does not establish structural or permit compliance.</li>'}</ul>
 <h2>Document reference register</h2><p>${review.recorded} recorded · ${review.missing} missing · ${review.stale} stale after design changes. Approval: ${h(review.approval)}. A stale record remains visible for traceability and needs review against the changed design.</p>
 ${review.stages.map(s=>`<section><h3>${h(s.title)} — ${h(s.status)}</h3><p>${h(s.owner)}: ${h(s.task)}</p>${s.record?`<p><strong>Self-recorded reference:</strong> ${h(s.record.reference)}<br>Recorded by: ${h(s.record.reviewer)} · Date: ${h(s.record.date)}</p>`:'<p><strong>Missing:</strong> obtain and review the applicable evidence before the associated work is released.</p>'}</section>`).join('')}
 <h2>Installation hold points</h2><ol>${(system?.installationNotes??['Obtain the exact selected system’s current installation instructions and a project-specific anchorage detail.']).map(n=>`<li>${h(n)}</li>`).join('')}</ol>
 <h2>System limitations and unresolved work</h2><ul>${(system?.limitations??['No system-specific engineering has been verified.']).map(n=>`<li>${h(n)}</li>`).join('')}<li>Confirm local requirements with the authority having jurisdiction. The Guelph Eramosa 2024 package is a local example that requests pre-engineered details for non-wood guards, not an Ontario-wide approval of this design.</li><li>All guard pricing, fabrication dimensions, anchors and substrate details require a written supplier/designer review. Do not use preview dimensions to fabricate glass.</li></ul>
 <h2>Source and manual register</h2><p>Links are references only; obtain the current revision and verify that it applies to this exact project. Documents are not embedded in this pack.</p><ul>${docs.map(d=>`<li>${h(d.title)}<br><a href="${h(d.url)}">${h(d.url)}</a></li>`).join('')}</ul>
 <footer>Print this HTML from your browser to save a PDF. Keep the actual approved drawings, supplier shop drawings, manuals and inspection records with the project. This pack is an administrative aid, not a substitute for builder training or professional design.</footer></body></html>`;
}
