import {useEffect,useRef,useState} from 'react';
import type {DeckAgentController,AgentResponse} from './deckAgentController';
import styles from './AgentControlPanel.module.css';

/** The default customer path stays visual. This explicit tools dialog documents a local browser interface. */
export default function AgentControlPanel({controller,open,onClose}:{controller:DeckAgentController;open?:boolean;onClose?:()=>void}){
  const [internalOpen,setInternalOpen]=useState(false),[request,setRequest]=useState(''),[response,setResponse]=useState<AgentResponse|null>(null),[busy,setBusy]=useState(false),[status,setStatus]=useState(()=>({revision:controller.read().revision,ready:controller.read().ready}));
  const dialog=useRef<HTMLDialogElement>(null),visible=open??internalOpen;
  const close=()=>{setInternalOpen(false);onClose?.();};
  useEffect(()=>controller.subscribe(()=>{const s=controller.read();setStatus(previous=>previous.revision===s.revision&&previous.ready===s.ready?previous:{revision:s.revision,ready:s.ready});}),[controller]);
  useEffect(()=>{const node=dialog.current;if(!node)return;if(visible&&!node.open)node.showModal();else if(!visible&&node.open)node.close();},[visible]);
  const run=async(preview:boolean)=>{setBusy(true);try{const input=JSON.parse(request);setResponse(await(preview?controller.preview(input):controller.execute(input)));}catch(e){setResponse({ok:false,error:{code:'invalid_json',message:e instanceof Error?e.message:'Invalid JSON'},revision:controller.read().revision});}finally{setBusy(false);}};
  const example=()=>{setRequest(JSON.stringify({id:`edit-${Date.now()}`,expectedRevision:controller.read().revision,commands:[{type:'design.patch',patch:{width:18}}]},null,2));setResponse(null);};
  return <>
    {open===undefined&&<button type="button" className={styles.launch} onClick={()=>setInternalOpen(true)}>Agent tools</button>}
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="deckcraft-agent-title" onCancel={e=>{e.preventDefault();close();}} onClose={()=>{if(visible)close();}}>
      <header className={styles.header}><div><p className={styles.eyebrow}>DECKCRAFT / TOOLS</p><h2 id="deckcraft-agent-title">Work with your agent</h2></div><button type="button" className={styles.close} aria-label="Close agent tools" onClick={close}>×</button></header>
      <div className={styles.body}>
        <p className={styles.status}><span aria-hidden="true" className={status.ready?styles.dot:styles.waitDot}/>{status.ready?'Agent interface ready':'Restoring your design'}<span>Revision {status.revision}</span></p>
        <p className={styles.intro}>Let a browser agent work on this open design. It can inspect the estimate, preview changes, edit the deck and prepare files through a structured local interface.</p>
        <ol className={styles.steps}><li><strong>Read the design</strong><code>window.deckcraft.read()</code><span>Current geometry, prices, quote items and drawing views.</span></li><li><strong>Preview a change</strong><code>await window.deckcraft.preview(command)</code><span>Check the result and cost before the design changes.</span></li><li><strong>Apply the command</strong><code>await window.deckcraft.execute(command)</code><span>Validated edits use the same undo history as your editor.</span></li></ol>
        <p className={styles.note}>This is an interface for a browser agent, with no chat service attached. Personal details stay private. Sending a design remains a manual step.</p>
        <details className={styles.advanced}><summary>Advanced · structured commands</summary>
          <p>Use <code>window.deckcraft.describe()</code> for supported fields, products and commands. An agent can also use the controls below when page evaluation is unavailable.</p>
          <button type="button" className={styles.secondary} onClick={example}>Load example command</button>
          <label htmlFor="deckcraft-agent-request">Structured agent command</label>
          <textarea id="deckcraft-agent-request" value={request} onChange={e=>{setRequest(e.target.value);setResponse(null);}} rows={9} spellCheck={false}/>
          <div className={styles.actions}><button type="button" className={styles.secondary} disabled={busy||!request.trim()||!status.ready} onClick={()=>void run(true)}>Preview command</button><button type="button" className={styles.primary} disabled={busy||!request.trim()||!status.ready} onClick={()=>void run(false)}>Apply command</button><button type="button" className={styles.secondary} onClick={()=>{const s=controller.read();setResponse({ok:true,revision:s.revision,snapshot:s,changed:false});}}>Read current design</button></div>
          <pre aria-label="Agent command result" aria-live="polite" className={styles.result}>{response?JSON.stringify(response,null,2):'Preview checks the complete command before any design is changed.'}</pre>
        </details>
      </div>
    </dialog>
  </>;
}
