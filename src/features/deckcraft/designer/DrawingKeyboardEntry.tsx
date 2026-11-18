import {useRef,useState} from 'react';
import {parseContractorLength} from './boundaryDimensions';
import {useArchitectKeys,revealControl} from './architectKeys';
export default function DrawingKeyboardEntry({onPlace,inDialog=false}:{onPlace:(lengthIn:number,angle:number)=>void;inDialog?:boolean}){
 const input=useRef<HTMLInputElement>(null),[length,setLength]=useState(''),[angle,setAngle]=useState('0'),[error,setError]=useState('');
 useArchitectKeys({enter:()=>revealControl(input.current)},true,inDialog);
 return <details><summary>Exact length & angle · Enter</summary><form className="dd-shape-draw-typed" onSubmit={e=>{e.preventDefault();try{const value=Number(angle);if(!angle.trim()||!Number.isFinite(value))throw Error('Enter a finite direction in degrees.');onPlace(parseContractorLength(length),value);setLength('');setError('');}catch(e){setError((e as Error).message);}}}><label>Length<input ref={input} aria-label="Exact drawing length" placeholder="5' 6&quot;" value={length} onChange={e=>setLength(e.target.value)}/></label><label>Direction °<input aria-label="Exact drawing angle" value={angle} onChange={e=>setAngle(e.target.value)}/></label><button type="submit">Place point</button>{error&&<p role="alert">{error}</p>}</form></details>;
}
