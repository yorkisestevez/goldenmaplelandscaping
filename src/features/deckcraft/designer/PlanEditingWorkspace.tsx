import type {ReactNode} from 'react';
import type {DeckData} from '../types';
import {useHardscapePreview} from './useHardscapePreview';
import EditReview from './EditReview';
export default function PlanEditingWorkspace({data,onApply,onGeometry,children}:{data:DeckData;onApply:(p:Partial<DeckData>)=>void;onGeometry:(d:DeckData|null)=>void;children:(preview:(p:Partial<DeckData>)=>void)=>ReactNode}){
 const flow=useHardscapePreview(data,onApply,onGeometry,next=>{const patch:Partial<DeckData>={};for(const key of Object.keys(next) as (keyof DeckData)[])if(JSON.stringify(next[key])!==JSON.stringify(data[key]))(patch as Record<string,unknown>)[key]=next[key];return patch;});
 const preview=(p:Partial<DeckData>)=>{const patch=JSON.parse(JSON.stringify(p)),unset=Object.keys(p).filter(k=>p[k as keyof DeckData]===undefined);void flow.preview([{type:'design.patch',patch,...(unset.length?{unset:unset as (keyof DeckData)[]}: {})}]);};
 return <>{children(preview)}<EditReview flow={flow} data={data} label="plan edit"/></>;
}
