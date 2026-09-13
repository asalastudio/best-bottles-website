"use client";

import {useEffect,useRef} from 'react';
import type {BottleStandard,FinalCandidate} from './StandardReview';
import FinalImageReview from './FinalImageReview';
import styles from './ledger.module.css';

export default function SunburstSizing({standard:s,localReview,onCandidateSave,onClose,onReviewStandard}:{standard:BottleStandard;localReview:boolean;onCandidateSave:(c:FinalCandidate)=>void;onClose:()=>void;onReviewStandard:()=>void}) {
 const panel=useRef<HTMLElement>(null);
 useEffect(()=>{panel.current?.focus();},[s.id]);
 const p=s.appearancePreview;
 const ready=p?.ready&&p.source&&p.canvas;
 const change=ready?Math.round((p.scale!-1)*1000)/10:0;
 if(s.finalCandidate)return <FinalImageReview key={s.finalCandidate.after.sha256} standard={s} candidate={s.finalCandidate} localReview={localReview} onSave={onCandidateSave} onClose={onClose} onReviewStandard={onReviewStandard}/>;
 return <section ref={panel} tabIndex={-1} className={styles.reviewPanel} aria-label={`${s.capacityMl} mL Sunburst sizing`}>
  <div className={styles.standardHeading}><div><h3>{s.family} · {s.capacityMl} mL — match the Sunburst image</h3><p>Glass standard v{s.version} locked. Now use that size to check the finished appearance.</p></div><button className={styles.focusSize} onClick={onClose}>Close sizing preview</button></div>
  <ol className={styles.flowSteps} aria-label="Image workflow">
   <li className={styles.done}><strong>1. Lock glass size</strong><span>Complete · v{s.version}</span></li>
   <li className={styles.waiting} aria-current="step"><strong>2. Match Sunburst</strong><span>Current step · sizing preview</span></li>
   <li className={styles.neutral}><strong>3. Review final image</strong><span>After a saved candidate is prepared</span></li>
   <li className={styles.neutral}><strong>4. Approve release</strong><span>After website checks and your “ship”</span></li>
  </ol>
  {!ready?<p className={styles.errorMessage}>{p?.reason??'Refresh the local workbench to verify the saved image and lock.'}</p>:<>
   <p className={styles.previewNotice}><strong>Sizing preview only — not a saved or approved new image.</strong> Both panels display the original Sunburst file. The right panel demonstrates {change===0?'the retained size':`${change>0?'+':''}${change}% uniform scale`} against the locked glass standard.</p>
   <div className={styles.comparison}>{(['before','after'] as const).map(side=><figure key={side}>
    <figcaption>{side==='before'?'Before · original Sunburst':`Preview · ${change===0?'keep current size':`${change>0?'+':''}${change}% locked size`}`}</figcaption>
    <div className={styles.appearanceFrame} style={{aspectRatio:`${p.canvas!.width}/${p.canvas!.height}`}}>
     <img src={p.source!.url} width={p.canvas!.width} height={p.canvas!.height} alt={`${side} ${s.capacityMl} mL Sunburst sizing`} style={side==='after'?{transformOrigin:'0 0',transform:`translate(${100*p.translateX!/p.canvas!.width}%, ${100*p.translateY!/p.canvas!.height}%) scale(${p.scale})`}:undefined}/>
     <span className={styles.baselineGuide} style={{top:`${p.baselinePercent}%`}}/>
     <span className={styles.rimGuide} style={{top:`${100*(side==='before'?p.sourceRimY!:p.targetRimY!)/p.canvas!.height}%`}}/>
    </div>
   </figure>)}</div>
   <p><strong>Glass height: {p.sourceHeight!.toFixed(1)} → {p.targetHeight!.toFixed(1)} px.</strong> Equal canvases and zoom. Solid line: fixed 91% baseline. Dashed line: calibrated bare-glass rim, which the cap covers in this image.</p>
   <p>The browser scales the whole photograph for this demonstration. Original image files and shadows are untouched. This is not yet a production bottle-and-component registration check.</p>
  </>}
  <div className={styles.lockStep}><h4>What happens next</h4><p>Prepare the final image against this locked standard, verify the glass and each component, and put the saved result on a same-zoom review card. Your approval will belong to that exact file. Then check the desktop and mobile product experience before a named release.</p><p>{s.productGroupIds.length} product groups share this glass standard. Each image still needs its own alignment and fidelity check; this reference preview does not complete the family.</p></div>
  <button className={styles.focusSize} onClick={onReviewStandard}>View or revise the locked glass standard</button>
 </section>;
}
