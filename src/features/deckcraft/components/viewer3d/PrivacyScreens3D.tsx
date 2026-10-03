import {useMemo} from 'react';
import type {DeckData} from '../../types';
import type {DeckTakeoff,Box} from '../../deckTakeoff';
import {privacyScreenLayout,type PrivacyScreenPanel,type ScreenBox} from '../../privacyScreens';

function Part({box}:{box:ScreenBox}){return <mesh position={[box.x,box.y,box.z]} rotation={[0,box.angle??0,0]} castShadow receiveShadow><boxGeometry args={[box.w,box.h,box.d]}/><meshStandardMaterial color={box.finish==='White'?'#e6e2d6':'#242729'} roughness={.65} metalness={.45}/></mesh>;}
function Pattern({panel:p}:{panel:PrivacyScreenPanel}){
 // Deliberately schematic geometry; never label these bars as the product's exact laser-cut pattern.
 const pieces:Box[]=p.pattern==='solid'?[{x:0,y:0,z:0,w:p.w,h:p.h,d:p.d}]:[
  {x:0,y:p.h/2-1,z:0,w:p.w,h:2,d:p.d},{x:0,y:-p.h/2+1,z:0,w:p.w,h:2,d:p.d},
  {x:-p.w/2+1,y:0,z:0,w:2,h:p.h,d:p.d},{x:p.w/2-1,y:0,z:0,w:2,h:p.h,d:p.d},
  ...Array.from({length:12},(_,i)=>({x:0,y:-p.h/2+3+i*5.3,z:0,w:p.w-4,h:p.pattern==='horizontal'?4.9:3.1,d:p.d})),
  ...(p.pattern==='perforated'?Array.from({length:5},(_,i)=>({x:-p.w/2+5+i*6.5,y:0,z:0,w:2,h:p.h-4,d:p.d})):[]),
 ];
 return <group position={[p.x,p.y,p.z]} rotation={[0,p.angle??0,0]} name={`${p.productId} schematic panel`}>{pieces.map((box,i)=><Part key={i} box={{...box,rowId:p.rowId,productId:p.productId,finish:p.finish,role:'panel'}}/>)}</group>;
}
export default function PrivacyScreens3D({data,model}:{data:DeckData;model:DeckTakeoff}){
 const layout=useMemo(()=>privacyScreenLayout(data,model),[data,model]);
 return <group name="Independent privacy screens—schematic">{layout.panels.map((p,i)=><Pattern key={`panel-${p.rowId}-${i}`} panel={p}/>)}{[...layout.posts,...layout.brackets].map((b,i)=><Part key={`hardware-${b.rowId}-${i}`} box={b}/>)}</group>;
}
