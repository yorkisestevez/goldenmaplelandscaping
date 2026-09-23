import {useEffect,useRef,useState,type FormEvent,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {Link} from 'react-router-dom';
import {publicContact} from '../../data/business';
import {trackDeck} from './deckAnalytics';
import {encodeDesignLink} from './designLink';
import type {DeckEstimate} from './designFacts';
import {CONTACT_REQUEST_TEXT,bookingNotesFor,buildDeckDesignSubmission,offersConsent,sendFieldsProblem,type OffersConsent,type SendDesignFields} from './sendDesign';
import type {DeckData} from './types';

export interface SendDesignProps{
  data:DeckData;estimate:DeckEstimate;summary:string;reviewItems:string[];
  /** Posts the submission; the page adds the event id, attribution and the lead conversion. */
  send:(fields:Record<string,string>)=>Promise<void>;
  /** Opens the printable proposal (the dialog closes first). */
  onPrint:()=>void;
  /** Downloads the proposal PDF. */
  onDownloadPdf?:()=>void|Promise<void>;
  onClose:()=>void;
  /** The offers wording; defaults to the business mailing address (none set means no offers box). */
  consent?:OffersConsent|null;
}

/** The send form and its confirmation, without the overlay (the checks render this directly). */
export function SendDesignForm({data,estimate,summary,reviewItems,send,onPrint,onDownloadPdf,onClose,consent=offersConsent()}:SendDesignProps){
  const [fields,setFields]=useState<SendDesignFields>({name:data.customerName,email:'',phone:'',address:data.projectAddress,notes:'',offers:false,botField:''});
  const [status,setStatus]=useState<'idle'|'sending'|'sent'>('idle');
  const [error,setError]=useState('');
  const [link,setLink]=useState('');
  const set=(patch:Partial<SendDesignFields>)=>setFields(f=>({...f,...patch}));
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    const problem=sendFieldsProblem(fields);if(problem){setError(problem);return;}
    setStatus('sending');setError('');trackDeck('deckcraft_send','deck_send_submitted');
    try{
      const url=await encodeDesignLink(data);
      await send(buildDeckDesignSubmission(fields,{data,estimate,summary,reviewItems,link:url,sentAt:new Date(),consent}));
      setLink(url);setStatus('sent');trackDeck('deckcraft_send','deck_send_sent');
    }catch{
      setStatus('idle');setError(`Your design could not be sent just now. Please try again, or call ${publicContact.phoneDisplay}.`);
      trackDeck('deckcraft_send','deck_send_failed');
    }
  }
  if(status==='sent')return <div className="dd-send-done" role="status">
    <h2 id="dd-send-title" tabIndex={-1} ref={el=>el?.focus()}>Design sent</h2>
    <p>Thank you, {fields.name.trim().split(/\s+/)[0]}. Golden Maple has your design and estimate and will contact you about it.</p>
    <label className="dd-field"><span>Your link to this design</span><input readOnly value={link} onFocus={e=>e.currentTarget.select()}/></label>
    <p className="dd-note">Keep the link to reopen this exact design on any device. Your name and address are not in it.</p>
    <div className="dd-summary-actions">
      <Link className="dd-primary dd-send-book" to="/book" state={{bookingNotes:bookingNotesFor(link),serviceInterest:'Composite Decking'}}>Book a call</Link>
      {onDownloadPdf&&<button type="button" className="dd-secondary" onClick={()=>void onDownloadPdf()}>Download PDF</button>}
      <button type="button" className="dd-secondary" onClick={onPrint}>Print your proposal</button>
      <button type="button" className="dd-secondary" onClick={onClose}>Back to my design</button>
    </div>
  </div>;
  const field=(label:string,input:ReactNode,hint?:string)=><label className="dd-field"><span>{label}</span>{input}{hint&&<small>{hint}</small>}</label>;
  return <form className="dd-send-form" onSubmit={e=>void submit(e)} noValidate>
    <h2 id="dd-send-title">Send your design to Golden Maple</h2>
    <p>Your design, its estimate and a link to reopen it go to our team. We’ll get back to you about next steps.</p>
    {/* Honeypot: people never see or fill it; Netlify drops submissions that do. */}
    <p className="dd-send-trap" aria-hidden="true"><label>Leave this empty <input name="bot-field" tabIndex={-1} autoComplete="off" value={fields.botField} onChange={e=>set({botField:e.target.value})}/></label></p>
    <div className="dd-fields">
      {field('Your name',<input required autoComplete="name" maxLength={120} value={fields.name} onChange={e=>set({name:e.target.value})} autoFocus/>)}
      {field('Email',<input required type="email" autoComplete="email" inputMode="email" maxLength={180} value={fields.email} onChange={e=>set({email:e.target.value})}/>)}
      {field('Phone (optional)',<input type="tel" autoComplete="tel" inputMode="tel" maxLength={40} value={fields.phone} onChange={e=>set({phone:e.target.value})}/>,'For a quicker reply')}
      {field('Project address (optional)',<input autoComplete="street-address" maxLength={200} value={fields.address} onChange={e=>set({address:e.target.value})}/>)}
    </div>
    {field('Anything we should know? (optional)',<textarea rows={3} maxLength={2000} value={fields.notes} onChange={e=>set({notes:e.target.value})}/>,'Timing, budget, access, questions…')}
    <p className="dd-note">{CONTACT_REQUEST_TEXT}</p>
    {consent&&<label className="dd-check"><input type="checkbox" checked={fields.offers} onChange={e=>set({offers:e.target.checked})}/><span>{consent.text}</span></label>}
    {error&&<p className="dd-error" role="alert">{error}</p>}
    <div className="dd-summary-actions">
      <button type="submit" className="dd-primary" disabled={status==='sending'}>{status==='sending'?'Sending…':'Send my design'}</button>
      <button type="button" className="dd-secondary" onClick={onClose}>Cancel</button>
    </div>
  </form>;
}

/** The send form in a modal overlay (Escape or Cancel closes it). */
export default function SendDesignDialog(props:SendDesignProps){
  const {onClose}=props,opened=useRef(false);
  useEffect(()=>{
    if(!opened.current){opened.current=true;trackDeck('deckcraft_send','deck_send_opened');}
    document.body.classList.add('dd-send-open');
    const key=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};
    window.addEventListener('keydown',key);
    return ()=>{document.body.classList.remove('dd-send-open');window.removeEventListener('keydown',key);};
  },[onClose]);
  // A stray click outside must not throw away what the customer typed, so only Escape and the buttons close it.
  return createPortal(<div className="dd-send-root">
    <div className="dd-send-panel" role="dialog" aria-modal="true" aria-labelledby="dd-send-title"><SendDesignForm {...props}/></div>
  </div>,document.body);
}
