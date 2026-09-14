"use client";

import {useState} from 'react';
import type {PlatePlan, PlateStage} from '@/lib/asset-ledger/plate-plan';
import s from './plate-catalog.module.css';

const stages:PlateStage[]=['complete','release','review','reconcile','missing'];
const n=(value:number)=>value.toLocaleString('en-US');

export default function PlateCatalog({plan,generatedAt,deployment,initialFamily='',preview=false,contactSheetFamilies=[]}:{
    plan:PlatePlan;generatedAt:string;deployment:string|null;initialFamily?:string;preview?:boolean;contactSheetFamilies?:string[];
}) {
    const [family,setFamily]=useState(plan.families.some(f=>f.family===initialFamily)?initialFamily:'');
    const [stage,setStage]=useState<PlateStage|'all'>('all');
    const [size,setSize]=useState('all');
    const [query,setQuery]=useState('');
    const [limit,setLimit]=useState(48);
    const selected=plan.families.find(f=>f.family===family);
    const visible=plan.rows.filter(r=>(!family||r.family===family)&&(stage==='all'||r.stage===stage)&&
        (size==='all'||String(r.capacityMl)===size)&&
        (!query||[r.sku,r.graceSku,r.itemName,r.color,r.applicator,r.capColor].join(' ').toLowerCase().includes(query.toLowerCase())));
    const view=(name:string)=>'?'+new URLSearchParams({...preview?{preview:'1'}:{},view:name}).toString();
    function chooseFamily(value:string) {
        setFamily(value);setSize('all');setQuery('');setStage('all');setLimit(48);
        const url=new URL(window.location.href);if(value)url.searchParams.set('family',value);else url.searchParams.delete('family');
        window.history.replaceState(null,'',url);
    }
    function exportQueue() {
        const columns=['family','sku','graceSku','capacityMl','color','applicator','capColor','stage','reasons','sourcePath','sha256'];
        const cell=(v:unknown)=>'"'+String(Array.isArray(v)?v.join(' | '):v??'').replace(/"/g,'""')+'"';
        const csv=[columns.join(','),...visible.map(row=>columns.map(c=>cell(row[c as keyof typeof row])).join(','))].join('\r\n');
        const url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));
        const link=document.createElement('a');link.href=url;link.download='plate-queue.csv';link.click();URL.revokeObjectURL(url);
    }
    const current=selected??plan.counts;
    const familyImages=plan.rows.filter(r=>(!family||r.family===family)&&r.imageUrl);
    const visualCount=familyImages.filter(r=>r.visualApprovalRecorded).length;
    const excludedDuplicates=(plan.scope.excludedDuplicates??[]).filter(r=>!family||r.family===family);
    const finalPrepared=family?plan.rows.filter(r=>r.family===family&&r.finalPreparation?.paired&&r.stage!=='complete'):[];
    const approvedFinal=finalPrepared.filter(r=>r.stage==='release');
    const allImagesApproved=!!selected&&selected.complete+selected.release===selected.total;
    return <main className={s.page}>
        <div className={s.topline}><a href="/team">← Team hub</a><a href={view('all-assets')}>All asset history ↗</a></div>
        <header className={s.header}>
            <div><p className={s.eyebrow}>Asset ledger · plates first</p><h1>One family at a time.</h1><p className={s.intro}>Keep the good plates. Prepare the gaps. Approve one family sheet.</p></div>
            <div className={s.snapshot}><strong>Local workbench</strong><span>Updated {new Date(generatedAt).toLocaleString('en-US',{timeZone:'America/Los_Angeles',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})} Pacific</span><span>Catalog: {deployment??'unavailable'}</span></div>
        </header>
        <div className={s.focus}><strong>Plates · active</strong><span>Kits · paused</span><span>Heroes · paused</span><span className={s.scopeCount}>{n(plan.counts.total)} products tracked · {plan.families.length} families</span></div>
        <div className={s.controls}>
            <label>Choose a family<select value={family} onChange={e=>chooseFamily(e.target.value)}><option value="">All {plan.families.length} families</option>{plan.families.map(f=><option key={f.family} value={f.family}>{f.family} · {f.total} products</option>)}</select></label>
            {selected&&<button onClick={()=>chooseFamily('')}>← All families</button>}
            <button onClick={exportQueue}>Download this queue</button>
        </div>
        <div className={s.sectionHeading}><h2>{selected?selected.family:'Whole catalog'}</h2><span>{n(current.complete)} / {n(current.total)} plates complete</span></div>
        {finalPrepared.length>0&&<div className={s.success}>
            <strong>{allImagesApproved?`All ${current.total} ${family} plate configurations have image approval.`:`${finalPrepared.length} remaining pairs are prepared.`}</strong>
            <span>{approvedFinal.length===finalPrepared.length?`${approvedFinal.length} final pairs are approved. Image review and source acceptance are complete. ${current.complete} are indexed; the final ${approvedFinal.length} still need their named release and indexing.`:`${approvedFinal.length} final pairs are approved. ${finalPrepared.filter(r=>!r.finalPreparation?.alignmentPassed).length} alignment failures and ${finalPrepared.filter(r=>r.finalPreparation?.sourceDecisionRequired).length} source decisions remain.`}</span>
            <a className={s.primaryLink} href={finalPrepared[0].finalPreparation!.reviewUrl}>{approvedFinal.length===finalPrepared.length?'View the approved':'Review the final'} {family} batch →</a>
        </div>}
        {selected&&visualCount>0&&<div className={s.success}><strong>Cap-on images visually approved: {n(visualCount)} of {n(familyImages.length)}.</strong><span>{visualCount===familyImages.length?'Your visual review of all existing cap-on images is recorded. These unchanged images do not need another appearance review.':'Saved approvals stay with the exact images you reviewed.'} Source records, required cap-off pairs and sizing checks are tracked below.</span></div>}
        <div className={s.metrics}>{stages.map(key=><button key={key} className={s.metric+' '+s[key]} aria-pressed={stage===key} onClick={()=>{setStage(stage===key?'all':key);setLimit(48);}}><span className={s.label}>{plan.stages[key].label}</span><strong>{n(current[key])}</strong><span>{plan.stages[key].detail}</span></button>)}</div>
        <p className={s.countNote}>Every active product appears in one column. Approved images awaiting release are separate from unresolved work. Completion requires the approved files to be indexed and verified.</p>
        {excludedDuplicates.length>0&&<details className={s.duplicateRegister}>
            <summary>{n(excludedDuplicates.length)} retired duplicates removed from this queue</summary>
            <p>The canonical products are already counted above. These duplicate records stay in history and do not need new plates.</p>
            <ul>{excludedDuplicates.map(row=><li key={row.sku}><strong>{row.itemName}</strong><p>{row.canonicalGroupSlug?<a href={'/products/'+encodeURIComponent(row.canonicalGroupSlug)+'?sku='+encodeURIComponent(row.canonicalSku)} target="_blank" rel="noreferrer">Open counted product: {row.canonicalSku} →</a>:row.canonicalSku}</p><small>Retired record: {row.recordId}. Scope confirmed by {row.reviewedBy}.</small></li>)}</ul>
        </details>}
        {selected?.family==='Boston Round'&&selected.complete===selected.total&&<div className={s.success}><strong>Boston plates are complete for this catalog snapshot.</strong><span>{selected.complete} existing approvals verified. Your next plate family is Cylinder.</span><a href={view('completion')}>View the Boston review record →</a></div>}
        {!selected?<section className={s.panel} aria-label="Family plate inventory">
            <div className={s.sectionHeading}><h2>Family queue</h2><span>Largest families first · {plan.families.filter(f=>f.complete===f.total).length} of {plan.families.length} complete</span></div>
            <div className={s.tableScroll}><table className={s.familyTable}><thead><tr><th>Family</th><th>Products</th><th className={s.complete}>Indexed</th><th className={s.release}>Awaiting release</th><th className={s.review}>Review</th><th className={s.reconcile}>Reconcile</th><th className={s.missing}>Need plate</th><th>Progress</th></tr></thead>
            <tbody>{plan.families.filter(f=>stage==='all'||f[stage]>0).map(f=><tr key={f.family}><th><button onClick={()=>chooseFamily(f.family)}>{f.family} <span>→</span></button><small>{f.sizes.length} recorded {f.sizes.length===1?'size':'sizes'}</small></th><td>{n(f.total)}</td>{stages.map(key=><td key={key} className={s[key]}>{n(f[key])}</td>)}<td><div className={s.progress} role="img" aria-label={f.complete+' of '+f.total+' plates complete'}>{stages.map(key=><span key={key} className={s[key]} style={{width:(100*f[key]/f.total)+'%'}}/>)}</div><small>{f.complete===f.total?'Complete':f.complete+f.release===f.total?n(f.release)+' awaiting release':n(f.total-f.complete)+' remaining'}</small></td></tr>)}</tbody></table></div>
            {stage!=='all'&&<button className={s.clear} onClick={()=>setStage('all')}>Clear status filter</button>}
        </section>:<section className={s.panel} aria-label="Selected family plate queue">
            <div className={s.sectionHeading}><div><h2>{selected.complete===selected.total?'Preserved plates':allImagesApproved?'Approved images · release pending':familyImages.length>0&&visualCount===familyImages.length?'Finish source and view checks':'Prepare the family review'}</h2><p>{selected.complete===selected.total?'These exact plates are already approved and indexed.':allImagesApproved?'Image review is complete. Publish the approved release and verify the indexed views to finish this family.':familyImages.length>0&&visualCount===familyImages.length?'Your existing cap-on images are approved. The remaining rows track source records, paired views, sizing checks and missing plates.':'The blue group can reuse current plates. Reconcile the amber and red groups before adding them to the approval batch.'}</p></div>{contactSheetFamilies.includes(family)&&<a className={s.primaryLink} href={view('plates')+'&family='+encodeURIComponent(family)}>Open {family} contact sheet →</a>}</div>
            {selected.unlinked>0&&<p className={s.notice}>{selected.unlinked} records have no catalog group link. They remain in this queue as identity holds.</p>}
            <div className={s.filters}><label>Plate status<select value={stage} onChange={e=>{setStage(e.target.value as PlateStage|'all');setLimit(48);}}><option value="all">All statuses</option>{stages.map(key=><option key={key} value={key}>{plan.stages[key].label}</option>)}</select></label><label>Bottle size<select value={size} onChange={e=>{setSize(e.target.value);setLimit(48);}}><option value="all">All sizes</option>{selected.sizes.map(v=><option key={v} value={v}>{v} mL</option>)}{plan.rows.some(r=>r.family===family&&r.capacityMl==null)&&<option value="null">Size unresolved</option>}</select></label><label className={s.search}>Find a product<input value={query} onChange={e=>{setQuery(e.target.value);setLimit(48);}} placeholder="Color, component, finish, or SKU"/></label></div>
            <p className={s.countNote} role="status">{visible.length} products in this view{stage!=='all'?' · '+plan.stages[stage].label:''}</p>
            <div className={s.products}>{visible.slice(0,limit).map(row=><article className={s.product} key={row.sku}>
                {row.imageUrl?<a className={s.thumb} href={row.imageUrl} target="_blank" rel="noreferrer"><img src={row.imageUrl} alt={row.itemName} loading="lazy"/></a>:<div className={s.noImage}>Plate pending</div>}
                <div className={s.productInfo}><span className={s.badge+' '+s[row.stage]}>{row.visualApprovalRecorded&&!['complete','release'].includes(row.stage)?'Cap-on approved · technical checks remain':plan.stages[row.stage].label}</span><h3>{row.capacityMl!=null?row.capacityMl+' mL':'Size unresolved'} · {row.color||'Color unresolved'}</h3><p>{row.itemName}</p><small>{row.sku}</small><p className={s.reason}>{row.reasons.join(' ')}</p>{row.visualApprovalRecorded&&!['complete','release'].includes(row.stage)&&<small>Cap-on appearance approved. No repeat appearance review needed unless this image changes.</small>}
                <details><summary>Source and approval evidence</summary><p>{row.sourcePath||'Master source mapping pending.'}</p><p>Image fingerprint: {row.sha256||'Not indexed'}</p><p>{row.capOff?'Cap-on and cap-off views indexed.':row.plateState==='plated-no-capoff-by-design'?'Assembled-only presentation recorded.':'View pairing needs reconciliation.'}</p></details>
                {row.stage==='release'&&row.finalPreparation&&<a href={row.finalPreparation.reviewUrl}>View approved release images →</a>}{row.groupSlug&&<a href={'/products/'+encodeURIComponent(row.groupSlug)+'?sku='+encodeURIComponent(row.sku)} target="_blank" rel="noreferrer">Open exact product →</a>}</div>
            </article>)}</div>{visible.length===0&&<p className={s.empty}>No products match these filters.</p>}{visible.length>limit&&<button className={s.clear} onClick={()=>setLimit(limit+48)}>Show next {Math.min(48,visible.length-limit)} products</button>}
        </section>}
        <section className={s.workflow}><h2>Same process for every family</h2><ol><li>Match the master sources</li><li>Normalize glass and prepare plates</li><li>Review one family contact sheet</li><li>Ship the approved batch</li></ol></section>
        <details className={s.scope}><summary>Scope and unresolved catalog records</summary><p>This is the current development catalog. {plan.scope.reconciled?'Catalog scope has been reconciled.':'Legacy storefront variants still need reconciliation before we call the entire catalog accounted for.'}</p><p>{plan.scope.unlinked} included bottle records need a catalog group link. {plan.scope.notApplicable} non-bottle records do not require plates. {plan.scope.reviewOnly} review-only entries and {plan.scope.missingSku.length} records without SKUs are preserved outside the plate totals.</p>{plan.scope.missingSku.map(row=><p key={row.id}>{row.family??'Unknown'} · {row.itemName||row.id}</p>)}</details>
    </main>;
}
