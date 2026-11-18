import type {DeckData} from '../types';
import {landscapeBedAreas} from '../landscapeModel';
import {activePuttingCups} from '../landscapeModelRuntime';
import {landscapeSurface,puttingCupWorld} from '../landscapeSurfaces';
import {isObjectVisible} from '../editorOrganization';
export default function LandscapePlanLayer({data}:{data:DeckData}){const objects=data.landscapeObjects??[],areas=landscapeBedAreas(objects,data);return <g aria-label="Landscape surface outlines">{objects.filter(o=>o.kind==='bed'&&o.enabled&&isObjectVisible(data.editorOrganization,o.id)).map(o=><g key={o.id}><path d={(areas.get(o.id)??[]).map(p=>p.map((v,i)=>`${i?'L':'M'}${v.x} ${v.z}`).join(' ')+'Z').join(' ')} fill={landscapeSurface(o.assetId)?.color??'#8b654c'} fillOpacity={.35} stroke="#52654c" strokeWidth="1" fillRule="nonzero"/><text x={o.xIn} y={o.zIn} textAnchor="middle" fontSize="8" fill="#253a2a">{o.name}</text>{activePuttingCups(o,areas.get(o.id)??[]).map((p,i)=>{const v=puttingCupWorld(o,p);return <circle key={i} cx={v.x} cy={v.z} r="2.125" fill="#fff" stroke="#233f2d"/>;})}</g>)}</g>;}
