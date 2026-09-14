"use client";
import {useEffect,useRef,useState} from 'react';
import type {BottleStandard,FinalCandidate} from './StandardReview';
import styles from './ledger.module.css';

export default function FinalImageReview({standard:s,candidate:c,localReview,onSave,onClose,onReviewStandard}:{standard:BottleStandard;candidate:FinalCandidate;localReview:boolean;onSave:(c:FinalCandidate)=>void;onClose:()=>void;onReviewStandard:()=>void}){
 const panel=useRef<HTMLElement>(null);useEffect(()=>{panel.current?.focus();},[]);
 const [notes,setNotes]=useState(c.notes??''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState('');
 const approved=c.ready&&c.status==='approved';
 async function save(status:string){setBusy(true);setError('');setSaved('');try{
  const res=await fetch('/api/asset-ledger/final-images',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({standardId:s.id,sha256:c.after.sha256,reviewToken:c.reviewToken,revision:c.revision,status,notes})});
  const result=await res.json();if(!res.ok)throw Error(result.error);onSave(result.candidate);
  setSaved(status==='approved'?'Approval saved for this exact image. Website verification and release are still pending.':'Feedback saved. A corrected image will get a fresh review; the glass standard stays locked.');
 }catch(e){setError(e instanceof Error?e.message:'Unable to save.');}finally{setBusy(false);}}
 return <section ref={panel} tabIndex={-1} className={styles.reviewPanel} aria-label={`${s.capacityMl} mL final image review`}>
  <div className={styles.standardHeading}><div><h3>{s.family} · {s.capacityMl} mL — review the saved image</h3><p>{c.sku} · glass standard v{s.version} · one image in this review</p></div><button className={styles.focusSize} onClick={onClose}>Close image review</button></div>
  <ol className={styles.flowSteps} aria-label="Image workflow"><li className={styles.done}><strong>1. Lock glass size</strong><span>Complete · v{s.version}</span></li><li className={c.ready?styles.done:styles.blocked}><strong>2. Prepare image</strong><span>{c.ready?'Saved and checked':'Verification on hold'}</span></li><li className={approved?styles.done:styles.waiting} aria-current="step"><strong>3. Review final image</strong><span>{approved?'Approved · exact file':c.status==='changes_requested'?'Changes requested':'Your review'}</span></li><li className={styles.neutral}><strong>4. Check &amp; release</strong><span>Website checks, then your “ship”</span></li></ol>
  {!c.ready&&<p role="alert" className={styles.errorMessage}>{c.reason}</p>}
  <p className={approved?styles.savedRequest:styles.previewNotice}><strong>{approved?'Image approved · awaiting website checks and release.':c.status==='changes_requested'?'Changes requested · correction needed.':'Saved candidate · awaiting your approval.'}</strong> These are two saved image files at the same zoom. The original remains preserved.</p>
  <div className={styles.comparison}>{(['before','after'] as const).map(side=><figure key={side}><figcaption>{side==='before'?'Before · original Sunburst':'After · saved image at the locked size'}</figcaption><div className={styles.appearanceFrame}><img src={c[side].url} width={c.canvas?.width??1560} height={c.canvas?.height??1716} alt={`${side} ${s.capacityMl} mL saved hero comparison`}/><span className={styles.baselineGuide} style={{top:'91%'}}/></div></figure>)}</div>
  <p>{c.verification?.summary} The solid line marks the 91% baseline. Review the bottle, cap, reflections and contact with the background.</p>
  <label className={styles.field}>Review note<textarea rows={3} maxLength={4000} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Describe any correction needed."/></label>
  <div className={styles.reviewActions}><button className={styles.primaryAction} disabled={!localReview||busy||!c.ready||approved} onClick={()=>save('approved')}>{approved?'Approved — saved':'Approve this image'}</button><button className={styles.focusSize} disabled={!localReview||busy||!c.ready||!notes.trim()} onClick={()=>save('changes_requested')}>Needs changes — save note</button></div>
  <p className={styles.standardNote}>Approval applies only to this file. New image bytes require a new review. This decision does not approve siblings, change the glass standard, update the catalog or publish a release.</p>
  {saved&&<p role="status" className={styles.savedRequest}>{saved}</p>}{error&&<p role="alert" className={styles.errorMessage}>{error}</p>}
  <details><summary>Saved file and verification details</summary><p>Glass height: {c.glassHeightPercent?.toFixed(2)}% of the frame. Candidate SHA-256: <code>{c.after.sha256}</code></p><p>Review collection: {c.collection}</p></details>
  <button className={styles.focusSize} onClick={onReviewStandard}>View the locked glass standard</button>
 </section>;
}
