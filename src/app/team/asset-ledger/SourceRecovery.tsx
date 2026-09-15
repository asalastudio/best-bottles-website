"use client";
import {useState} from 'react';
import styles from './source-recovery.module.css';

type Asset={url:string;sha256:string;sourceUrl?:string;sourcePath?:string;width?:number;height?:number;sourceSha256?:string;view?:'on'|'off';bytesVerified?:boolean;status?:string};
type Row={sourceApproval?:{status:string}|null;sku:string;capacityMl:number;color:string;itemName:string;productUrl?:string;error?:string;pageDescription?:string;references:Asset[];candidates:Asset[];reconciledCapOn?:Asset;pairStatus:string};
export type Recovery={sourceApproved:number;rows:Row[]};

function SourceImage({asset,sku,pending=false}:{asset:Asset;sku:string;pending?:boolean}){
 return <figure><b>{asset.view==='off'?'Cap off':'Cap on'}{pending?' · New view to review':''}</b><a href={asset.url} target="_blank" rel="noreferrer"><img src={asset.url} alt={`${sku} ${asset.view==='off'?'cap off':'cap on'}${pending?' recovered candidate':''}`} width={asset.width} height={asset.height}/></a><figcaption>{asset.width} × {asset.height} · original master preview</figcaption><details><summary>Source file and fingerprint</summary><p>{asset.sourcePath}</p><code>{asset.sourceSha256}</code></details></figure>;
}

export default function SourceRecovery({data}:{data:Recovery}){
 const [size,setSize]=useState('all');
 const [pairsOnly,setPairsOnly]=useState(false);
 const rows=data.rows.filter(r=>(size==='all'||r.capacityMl===Number(size))&&(!pairsOnly||r.pairStatus==='cap_on_review_pending'));
 const pending=data.rows.filter(r=>r.pairStatus==='cap_on_review_pending').length;
 const existingPairs=data.rows.filter(r=>r.pairStatus==='paired_source_views').length;
 return <main className={styles.page}><div className={styles.shell}>
  <a href="/team/asset-ledger?preview=1&view=plates">← Back to approved Boston plates</a>
  <h1>Recovered Boston master artwork</h1><p><a href="/team/asset-ledger?preview=1&view=completion">Next: review the prepared Boston plate contact sheet →</a></p>
  <p className={styles.lead}>Existing master artwork for the missing Boston configurations. Your existing plate approvals stay intact.</p>
  <div className={styles.summary}><strong>{data.sourceApproved} / {data.rows.length}</strong> original source sets approved by Jordan<p>{existingPairs} matched cap-on / cap-off pairs · <b>{pending ? `${pending} recovered cap-on views need review` : 'Source review complete'}</b></p></div>
  <p className={styles.notice}>{pending ? 'Every cap-off view needs its matching cap-on view. Duplicate cap-off files count as one view. Newly recovered capped views need separate approval.' : 'All cap-off views in this recovered set now have approved matching cap-on artwork. The dropper source sets are approved too. Next: prepare the finished plates at the locked glass sizes.'}</p>
  <nav aria-label="Recovered source size">{['all','15','30','60'].map(n=><button key={n} aria-pressed={size===n} onClick={()=>setSize(n)}>{n==='all'?'All missing sizes':n+' mL'} · {data.rows.filter(r=>n==='all'||r.capacityMl===Number(n)).length}</button>)}</nav>
  {pending>0&&<button aria-pressed={pairsOnly} onClick={()=>{setPairsOnly(!pairsOnly);setSize('all');}}>{pairsOnly?'Show all source sets':`Review ${pending} recovered cap-on views`}</button>}
  <p role="status">Showing {rows.length} configurations. Original source previews; finished plates await preparation.</p>
  {rows.sort((a,b)=>a.capacityMl-b.capacityMl||a.color.localeCompare(b.color)||a.sku.localeCompare(b.sku)).map(r=>{
   const seen=new Set<string>();const originals=r.candidates.filter(c=>{if(seen.has(c.sha256))return false;seen.add(c.sha256);return true;}).sort((a,b)=>(a.view==='on'?0:1)-(b.view==='on'?0:1));
   return <article className={styles.row} key={r.sku} id={r.sku}>
    <h2>{r.capacityMl} mL · {r.color}</h2><h3>{r.itemName.split(/\s+For use with|\s+Price each/i)[0]}</h3>
    <p className={styles.sku}>{r.sku} · {r.sourceApproval?'Original source artwork approved':'Source review pending'}</p>
    {r.error&&<p className={styles.notice}>{r.error}</p>}
    {r.pairStatus==='cap_on_review_pending'&&<p className={styles.notice}>The original two files both showed the cap off. We found the capped master view shown here. This new view needs approval with its matching cap-off image before the pair is complete.</p>}
    <div className={styles.comparison}>
     <div><h4>Master artwork · cap on / cap off</h4><div className={styles.masters}>
      {r.reconciledCapOn?.bytesVerified&&<SourceImage asset={r.reconciledCapOn} sku={r.sku} pending={r.reconciledCapOn.status!=='approved'}/>}
      {r.reconciledCapOn&&!r.reconciledCapOn.bytesVerified&&<p className={styles.notice}>Recovered capped view is unavailable or changed. Pair remains on hold.</p>}
      {originals.map(c=><SourceImage asset={c} sku={r.sku} key={c.sha256}/>)}
     </div>{r.candidates.length>originals.length&&<p className={styles.sku}>Duplicate cap-off copy retained in the source record; shown once here.</p>}</div>
     <details className={styles.supporting}><summary>Supporting product-page references</summary><div className={styles.references}>{r.references.filter(a=>a.url).map(a=><a href={a.url} key={a.sha256+String(a.sourceUrl)} target="_blank" rel="noreferrer"><img src={a.url} alt={`${r.sku} product-page reference`}/></a>)}</div>{r.productUrl&&<a href={r.productUrl} target="_blank" rel="noreferrer">Open the exact product page</a>}<p>{r.pageDescription?.split(/\s+For use with|\s+Price each/i)[0]}</p></details>
    </div>
    <p className={styles.next}>{r.pairStatus==='assembled_source_only'?'Assembled source available. Separate views and kit parts still need their own checks.':r.pairStatus==='paired_source_views'?'Both source views are present. Next: prepare the paired plates at the locked glass size.':'Next: review the recovered cap-on view beside its matching cap-off image.'} Finished plates return together on the family contact sheet.</p>
   </article>;
  })}
 </div></main>;
}
