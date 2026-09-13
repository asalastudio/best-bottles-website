"use client";

import {useState,useRef,useEffect} from 'react';
import styles from './ledger.module.css';

type Asset = {url:string;sha256:string};
export type FinalCandidate={ready:boolean;reason?:string;sku:string;collection:string;before:Asset;after:Asset;canvas?:{width:number;height:number};glassHeightPercent?:number;status:string;notes?:string;revision?:number;reviewToken?:string;verification?:{summary:string}};
export type BottleStandard = {
 id:string;family:string;profile?:string;capacityMl:number;version:number;state:string;colors:string[];productGroupIds:string[];
 reference:Asset & {sku:string};history:unknown[];hold:string;revisionToken?:string;
 referenceDecision?:{at:string;sha256:string};approval?:{at:string};
 finalCandidate?:FinalCandidate|null;
 sizingRequest?:{percent:number|null;note:string;status:string;at:string};
 preparedReview?:{kind?:string;before:Asset;after:Asset;canvas:{width:number;height:number};beforeGlass?:{rimY:number;baseY:number};glass?:{rimY:number;baseY:number};transform?:{relativePercent:number};registration?:{registrationMedianPx:number;registrationP95Px:number};affectedSkus?:string[]};
 lockReadiness?:{ready:boolean;reason:string;packetHash?:string;glassHeightPercent?:number};
 targets?:{hero?:{glassHeightPercent:number;baselinePercent:number}};
 appearancePreview?:{ready:boolean;reason?:string;source?:Asset;canvas?:{width:number;height:number};scale?:number;translateX?:number;translateY?:number;sourceRimY?:number;targetRimY?:number;baselinePercent?:number;sourceHeight?:number;targetHeight?:number;standardVersion?:number};
};

export default function StandardReview({standard:s,localReview,onSave,onClose}:{standard:BottleStandard;localReview:boolean;onSave:(s:BottleStandard)=>void;onClose:()=>void}) {
 const panel=useRef<HTMLElement>(null);
 const scaleInput=useRef<HTMLInputElement>(null);
 useEffect(()=>{panel.current?.focus();},[]);
 const [percent,setPercent]=useState(s.sizingRequest?.percent===null?'':String(s.sizingRequest?.percent??0));
 const [note,setNote]=useState(s.sizingRequest?.note??'');
 const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [error,setError]=useState('');
 const locked=s.state==='locked';
 async function save(action:string){
  const enteredPercent=scaleInput.current?.value??percent;
  setPercent(enteredPercent);
  setBusy(true);setError('');setMessage('');
  try{
   const response=await fetch('/api/asset-ledger/standards',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:s.id,revisionToken:s.revisionToken,action,percent:enteredPercent===''?null:Number(enteredPercent),note,packetHash:s.lockReadiness?.packetHash})});
   const result=await response.json();if(!response.ok)throw new Error(result.error);
   onSave(result.standard);
   setMessage(action==='lock'?'Glass height locked. Individual images still need review before release.':action==='approve-reference'?'Reference choice approved and saved. Glass-height approval remains separate.':'Sizing request saved. Prepare its measured comparison next; the current standard stays unchanged.');
  }catch(e){setError(e instanceof Error?e.message:'Unable to save.');}finally{setBusy(false);}
 }
 return <section ref={panel} tabIndex={-1} className={styles.reviewPanel} aria-label={`Review ${s.family} ${s.capacityMl} mL standard`}>
  <div className={styles.standardHeading}><div><h3>{s.family} · {s.capacityMl} mL — scale &amp; approval</h3><p>{s.profile} · {s.productGroupIds.length} product groups · {s.colors.join(', ')}</p></div><button className={styles.focusSize} onClick={onClose}>Close review</button></div>
  <p>One glass size for this physical profile. Measure the bare glass from its bottom to its top rim, including the neck. Keep the baseline at 91% of the frame.</p>
  <div className={styles.reviewColumns}><div><a href={s.reference.url} target="_blank" rel="noreferrer"><img className={styles.reviewImage} src={s.reference.url} alt={`Current ${s.capacityMl} mL ${s.family} reference`} width={300} height={330}/></a><p className={styles.standardNote}>Current reference · {s.reference.sku}</p><p className={styles.standardNote}>{locked?`Locked version ${s.version}. A sizing request proposes a new version.`:'Reference image approved previously. Shared glass height is not locked yet.'}</p></div><div>
   <h4>1. Choose the reference</h4><p>Use this image as the starting point for the size comparison.</p>
   <button className={styles.primaryAction} disabled={!localReview||busy||locked||s.referenceDecision?.sha256===s.reference.sha256} onClick={()=>save('approve-reference')}>{locked?'Reference locked':s.referenceDecision?.sha256===s.reference.sha256?'Reference choice approved':'Approve reference choice'}</button>
   {locked&&<p className={styles.savedRequest}>Version {s.version} locked · glass height {s.targets?.hero?.glassHeightPercent.toFixed(2)}% · baseline {s.targets?.hero?.baselinePercent}%. A new sizing request preserves this lock until its replacement is approved.</p>}
   <h4>2. Choose the size change</h4><p>Uniform scale preserves the bottle’s proportions. These options request a comparison; they do not resize or approve images immediately.</p>
   <div className={styles.scaleOptions} role="group" aria-label="Sizing options">{[-3,0,2,3,5].map(n=><button key={n} aria-pressed={percent===String(n)} onClick={()=>setPercent(String(n))}>{n===0?'Keep current size':`${n>0?'+':''}${n}%`}</button>)}<button aria-pressed={percent===''} onClick={()=>setPercent('')}>Choose amount later</button></div>
   <label className={styles.field}>Custom scale change (%)<input ref={scaleInput} type="number" min={-20} max={20} step="0.5" value={percent} onInput={e=>setPercent(e.currentTarget.value)} placeholder="Amount to compare"/></label>
   <label className={styles.field}>Sizing note<textarea rows={3} maxLength={1000} value={note} onChange={e=>setNote(e.target.value)} placeholder="For example: make the 30 mL a little taller; compare before choosing."/></label>
   <button className={styles.primaryAction} disabled={!localReview||busy||(percent===''&&!note.trim())||(percent!==''&&(!Number.isFinite(Number(percent))||Number(percent)<-20||Number(percent)>20))} onClick={()=>save('request-sizing')}>{busy?'Saving…':'Save sizing request'}</button>
   {s.sizingRequest&&<p className={styles.savedRequest}><strong>Saved request:</strong> {s.sizingRequest.percent===null?'Amount to compare is not chosen yet.':`${s.sizingRequest.percent>0?'+':''}${s.sizingRequest.percent}% relative to this reference.`} {s.sizingRequest.note}<br/>Status: {s.sizingRequest.status}</p>}
  </div></div>
  <div className={styles.lockStep}><h4>3. Review the comparison &amp; lock</h4>
   {s.lockReadiness?.ready&&s.preparedReview?<><p className={styles.savedRequest}><strong>Ready for your approval.</strong> {s.preparedReview.transform?.relativePercent===0?'Current glass size retained.':`Proposed glass size: +${s.preparedReview.transform?.relativePercent}% uniform scale.`} This standard covers {s.preparedReview.affectedSkus?.length??'the listed'} catalog SKUs with matching physical geometry.</p><p>These comparisons use the actual bare-glass layer from the master PSD, calibrated to your approved reference above. The cap is excluded so the glass itself sets the size. Existing hero images and shadows are unchanged.</p><div className={styles.comparison}>{(['before','after'] as const).map(side=><figure key={side}><figcaption>{side==='before'?'Glass at current framing':s.preparedReview?.transform?.relativePercent===0?'Same glass size to lock':`Glass at +${s.preparedReview?.transform?.relativePercent}%`}</figcaption><div className={styles.rulerFrame}><img src={s.preparedReview![side].url} alt={`${side} bare-glass size comparison`} width={s.preparedReview!.canvas.width} height={s.preparedReview!.canvas.height}/><span className={styles.baselineGuide} style={{top:'91%'}}/><span className={styles.rimGuide} style={{top:`${100*(side==='before'?s.preparedReview!.beforeGlass!.rimY:s.preparedReview!.glass!.rimY)/s.preparedReview!.canvas.height}%`}}/></div></figure>)}</div><p>Glass height: {s.lockReadiness.glassHeightPercent?.toFixed(2)}% of the frame. Solid line: fixed 91% baseline. Dashed line: glass rim. Both images use the same zoom.</p><details><summary>Source alignment and affected products</summary><p>The master glass was aligned to the approved image’s visible body. Typical side-edge difference: {s.preparedReview.registration?.registrationMedianPx.toFixed(2)} pixels; 95th percentile: {s.preparedReview.registration?.registrationP95Px.toFixed(2)} pixels on the 1560 × 1716 frame. Generated appearance and master pixels are not identical.</p><p>{s.preparedReview.affectedSkus?.join(', ')}</p></details></>:<p>{locked?'The current glass height remains locked. Prepare a fresh measured comparison to approve a revision.':s.lockReadiness?.reason??'Bare-glass measurement and a same-zoom comparison still need preparation.'}</p>}
   <button className={styles.primaryAction} disabled={!localReview||busy||!s.lockReadiness?.ready} onClick={()=>save('lock')}>{locked?'Approve & lock new version':'Approve & lock glass height'}</button>
   <p className={styles.standardNote}>This locks the catalog hero’s glass scale for the listed groups. Plates and kits need their own verified registration. Every changed image gets a new review; publishing requires a release-specific “ship.”</p>
  </div>
  {!localReview&&<p>Open the local workbench to save review decisions. This environment is read-only.</p>}
  {message&&<p role="status" className={styles.savedRequest}>{message}</p>}{error&&<p role="alert" className={styles.errorMessage}>{error}</p>}
 </section>;
}
