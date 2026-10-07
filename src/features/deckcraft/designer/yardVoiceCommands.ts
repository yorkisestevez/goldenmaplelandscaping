import type {AgentCommand,AgentSnapshot} from './deckAgentController';
import type {AssistedSelection} from './naturalLanguageCommands';
import {yardShapeWorldPoints} from '../yardShapeGeometry';

type Result={command:AgentCommand;summary:string[]}|{clarification:string};
const measure=(value:string,unit:string)=>Number(value)*(/^(feet|foot|ft)$/.test(unit)?12:1);
const selected=(snapshot:AgentSnapshot,selection:AssistedSelection,spoken?:string)=>{
 const feature=snapshot.design.yardFeatures?.find(f=>f.id===selection.yard?.id);
 if(!feature||!['patio','retaining-wall'].includes(feature.kind))return {clarification:'Select a patio or retaining wall on the plan or in Backyard, then repeat the instruction.'} as const;
 if(spoken&&feature.kind!==(spoken==='wall'?'retaining-wall':'patio'))return {clarification:`The selected feature is a ${feature.kind==='retaining-wall'?'wall':'patio'}. Select a ${spoken} or use the matching name.`} as const;
 if(!feature.enabled)return {clarification:`${feature.name} is excluded from the design and estimate. Include it before editing by voice.`} as const;
 return {feature} as const;
};

/** Entire measured clauses only. The selected ID comes from the current UI, never from a guessed name. */
export function parseYardInstruction(raw:string,snapshot:AgentSnapshot,selection:AssistedSelection):Result|undefined {
 const length='(-?\\d+(?:\\.\\d+)?) (feet|foot|ft|inches|inch|in)';
 if(/^(?:refit|fit) (?:these |the |selected )?stairs to (?:proposed )?ground$/.test(raw))return {command:{type:'stair.refit',surface:'terrain'},summary:['Preview equal-riser stairs on the full measured bottom landing. Upper deck stays fixed; ground is unchanged.']};
 let m=raw.match(new RegExp(`^(?:add a top step to|step) (?:this|selected|the selected) wall at ${length} to ${length}$`));
 if(m){const target=selected(snapshot,selection,'wall');if('clarification'in target)return {clarification:String(target.clarification)};const stationIn=measure(m[1],m[2]),elevationIn=measure(m[3],m[4]),steps=[...(target.feature.wallTopSteps??[]).filter(s=>Math.abs(s.stationIn-stationIn)>1e-7),{stationIn,elevationIn}].sort((a,b)=>a.stationIn-b.stationIn);return {command:{type:'yard.finished',id:target.feature.id,edit:{action:'steps',steps}},summary:[`${target.feature.name}: top ${elevationIn} in at station ${stationIn} in on its true path. Preview validates whole stock courses and path limits.`]};}
 m=raw.match(new RegExp(`^set (?:this|selected|the selected) (wall|patio) (?:finished )?(?:top |elevation )to ${length}$`));
 if(m){const target=selected(snapshot,selection,m[1]);if('clarification'in target)return {clarification:String(target.clarification)};const elevationIn=measure(m[2],m[3]);return {command:{type:'yard.finished',id:target.feature.id,edit:{action:'level',elevationIn}},summary:[`${target.feature.name}: finished top ${elevationIn} in on project datum.`]};}
 m=raw.match(/^pin (?:this|selected|the selected) (wall|patio) (?:elevation|level)$/);if(m){const target=selected(snapshot,selection,m[1]);if('clarification'in target)return {clarification:String(target.clarification)};return {command:{type:'yard.finished',id:target.feature.id,edit:{action:'pin'}},summary:[`Pin ${target.feature.name} at its current finished top. Ground changes will not move it.`]};}
 m=raw.match(/^slope (?:this|selected|the selected) patio (\d+(?:\.\d+)?) percent (left|right|toward the house|out into the yard)$/);if(m){const target=selected(snapshot,selection,'patio');if('clarification'in target)return {clarification:String(target.clarification)};const pct=Number(m[1]);if(pct>30)return {clarification:'Use a slope between zero and 30 percent.'};const worldX=m[2]==='left'?pct:m[2]==='right'?-pct:0,worldZ=m[2]==='toward the house'?pct:m[2]==='out into the yard'?-pct:0,a=target.feature.rotationDeg*Math.PI/180;return {command:{type:'yard.finished',id:target.feature.id,edit:{action:'slope',xPct:Math.cos(a)*worldX+Math.sin(a)*worldZ,zPct:-Math.sin(a)*worldX+Math.cos(a)*worldZ}},summary:[`${target.feature.name}: ${pct}% fall ${m[2]}, preserving the centre finished level.`]};}
 m=raw.match(new RegExp(`^(raise|lower) (?:this|selected|the selected) (wall|patio)(?: by)? ${length}$`));
 if(m){const target=selected(snapshot,selection,m[2]);if('clarification'in target)return {clarification:String(target.clarification)};const delta=measure(m[3],m[4])*(m[1]==='lower'?-1:1);
  if(measure(m[3],m[4])<=0)return {clarification:'Use a positive distance with raise or lower.'};
  if(target.feature.finishedElevationIn!==undefined)return {command:{type:'yard.finished',id:target.feature.id,edit:{action:'level',elevationIn:target.feature.finishedElevationIn+delta}},summary:[`${target.feature.name}: fixed finished top ${target.feature.finishedElevationIn} → ${target.feature.finishedElevationIn+delta} in on project datum. Review geometry and quantities before applying.`]};
  const wall=target.feature.kind==='retaining-wall',field=wall?'baseElevationIn':'heightIn',current=wall?target.feature.baseElevationIn??0:target.feature.heightIn,valueIn=current+delta,min=wall?-120:-24,max=wall?120:48;
  if(valueIn<min||valueIn>max)return {clarification:`That elevation would be outside the ${min} to ${max} inch planning range.`};
  return {command:{type:'yard.elevation',id:target.feature.id,field,valueIn},summary:[`${target.feature.name}: ${wall?'base datum':'patio surface'} ${m[1]==='raise'?'raised':'lowered'} ${delta} in. ${wall?'Exposed height stays the same.':'Paving and base move together.'}`]};
 }
 m=raw.match(new RegExp(`^move (?:this|selected|the selected) (wall|patio) (left|right|toward the house|out into the yard)(?: by)? ${length}$`));
 const trailing=m?null:raw.match(new RegExp(`^move (?:this|selected|the selected) (wall|patio) ${length} (left|right|toward the house|out into the yard)$`));
 if(m||trailing){const groups=m??trailing!,target=selected(snapshot,selection,groups[1]);if('clarification'in target)return {clarification:String(target.clarification)};const inches=measure(m?m[3]:trailing![2],m?m[4]:trailing![3]);if(inches<=0||inches>1200)return {clarification:'Move the feature a positive distance of at most 100 feet.'};
  const direction=m?m[2]:trailing![4],dxIn=direction==='left'?-inches:direction==='right'?inches:0,dyIn=direction==='toward the house'?-inches:direction==='out into the yard'?inches:0;
  return {command:{type:'yard.move',id:target.feature.id,target:'area',dxIn,dyIn},summary:[`${target.feature.name}: move ${inches} in ${direction}. Shape, material and elevation stay with it.`]};
 }
 m=raw.match(new RegExp(`^curve (?:this|selected|the selected) (?:(wall|patio) )?edge(?: by| to)? ${length}$`))??raw.match(new RegExp(`^curve (?:this|selected|the selected) (wall|patio)(?: by| to)? ${length}$`));
 if(m){const target=selected(snapshot,selection,m[1]);if('clarification'in target)return {clarification:String(target.clarification)};const bulgeIn=measure(m[2],m[3]);if(!bulgeIn||Math.abs(bulgeIn)>960)return {clarification:'Use a signed curve depth between −960 and 960 inches, excluding zero.'};
  const points=yardShapeWorldPoints(target.feature),edges=points.length-(target.feature.kind==='patio'?0:1),chosen=selection.yard;
  if(!chosen||chosen.target==='point'||chosen.target==='area'&&edges!==1)return {clarification:`Select the exact edge of ${target.feature.name} on the plan, then repeat the curve depth.`};
  const index=chosen.target==='edge'?chosen.index:0;if(index<0||index>=edges)return {clarification:'The selected edge has changed. Select it again before curving.'};
  return {command:{type:'yard.curve',id:target.feature.id,index,bulgeIn},summary:[`${target.feature.name}: curve edge ${index+1} by ${bulgeIn} in, with its endpoints fixed. Review block and cap radius limits.`]};
 }
 m=raw.match(/^make (?:this|selected|the selected) (wall|patio) (straight|l-shaped|l shaped|curved|rectangle|rounded|cut corners)$/);
 if(m){const target=selected(snapshot,selection,m[1]);if('clarification'in target)return {clarification:String(target.clarification)};
  const wall=target.feature.kind==='retaining-wall',presetId=(wall?{'straight':'straight','l-shaped':'wall-l','l shaped':'wall-l','curved':'arc'}:{'rectangle':'rectangle','l-shaped':'l-shape','l shaped':'l-shape','rounded':'rounded','cut corners':'chamfered'})[m[2] as 'straight'] as 'straight'|'wall-l'|'arc'|'rectangle'|'l-shape'|'rounded'|'chamfered'|undefined;
  if(!presetId)return {clarification:`Choose a ${wall?'straight, L-shaped or curved wall':'rectangle, L-shaped, rounded or cut-corner patio'} starter.`};
  return {command:{type:'yard.preset',id:target.feature.id,presetId},summary:[`${target.feature.name}: replace its outline with a ${m[2]} starter. Position, supplier, cap, elevation and construction inputs remain selected.`]};
 }
 return undefined;
}
