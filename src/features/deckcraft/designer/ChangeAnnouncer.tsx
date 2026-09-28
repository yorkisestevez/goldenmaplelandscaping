import {useEffect,useState} from 'react';
import {announceChange,type ChangeRecord} from './useChangeLedger';
/** One polite announcement per gesture, after the edit and price have settled. */
export default function ChangeAnnouncer({record}:{record?:ChangeRecord}){
 const [text,setText]=useState('');
 const next=record&&record.kind!=='loaded'?announceChange(record):'';
 useEffect(()=>{if(!next)return;const timer=setTimeout(()=>setText(next),700);return()=>clearTimeout(timer);},[next]);
 return <p className="dd-sr" role="status">{text}</p>;
}
