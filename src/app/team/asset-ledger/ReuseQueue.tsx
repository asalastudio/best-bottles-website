"use client";

import { useState } from 'react';
import { componentLabel, queueActions, queueCsv, type QueueRow, type QueueGroup, type QueueStandard, type QueueTone } from '@/lib/asset-ledger/reuse-queue';
import type { Kind } from '@/lib/asset-ledger/types';
import styles from './queue.module.css';

const tones: Record<QueueTone, string> = { keep: 'Keep / complete', review: 'Ready for review steps', repair: 'Check / correct', hold: 'Missing / on hold' };
const kinds: Kind[] = ['plate','kit','hero'];

export default function ReuseQueue({ rows, groups, standards, family, capacity, onCapacity, generatedAt, onFinalReview }: {
  rows: QueueRow[]; groups: QueueGroup[]; standards: QueueStandard[]; family: string; capacity: string; onCapacity: (value: string) => void; generatedAt: string; onFinalReview: (id: string) => void;
}) {
  const [query,setQuery] = useState('');
  const [color,setColor] = useState('all');
  const [component,setComponent] = useState('all');
  const [lane,setLane] = useState<Kind | 'all'>('all');
  const [status,setStatus] = useState('all');
  const [limit,setLimit] = useState(12);
  const familyRows = rows.filter(r => r.productRecord && (family === 'all' || r.family === family));
  const sizes = [...new Set(familyRows.map(r => r.capacityMl).filter((v): v is number => v !== null))].sort((a,b) => a-b);
  const sizeRows = familyRows.filter(r => capacity === 'all' || r.capacityMl === Number(capacity));
  const colors = [...new Set(sizeRows.map(r => r.color ?? 'Unspecified'))].sort();
  const components = [...new Set(sizeRows.map(r => r.applicator ?? 'Unspecified'))].sort();
  const filtered = sizeRows.filter(r => (color === 'all' || (r.color ?? 'Unspecified') === color) && (component === 'all' || (r.applicator ?? 'Unspecified') === component) && [r.sku,r.graceSku,r.itemName,r.color,componentLabel(r),r.groupSlug].join(' ').toLowerCase().includes(query.toLowerCase().trim())).map(r => ({r, actions:queueActions(r,groups,standards)})).filter(({actions}) => status === 'all' || (lane === 'all' ? kinds : [lane]).some(k => actions[k].tone === status)).sort((a,b) => (a.r.capacityMl ?? 0)-(b.r.capacityMl ?? 0) || (a.r.color ?? '').localeCompare(b.r.color ?? '') || componentLabel(a.r).localeCompare(componentLabel(b.r)) || a.r.sku.localeCompare(b.r.sku));
  const groupIds = new Set(familyRows.map(r => r.productGroupId));
  function download() {
    const url = URL.createObjectURL(new Blob([queueCsv(familyRows,groups,standards,generatedAt)],{type:'text/csv;charset=utf-8'}));
    const a = document.createElement('a'); a.href=url; a.download='asset-reuse-gap-queue.csv'; a.click(); URL.revokeObjectURL(url);
  }
  const resetFilters = () => { setQuery('');setColor('all');setComponent('all');setStatus('all');setLane('all');setLimit(12); };
  return <section id="reuse-queue" className={styles.queue} aria-labelledby="queue-title">
    <div className={styles.heading}><div><span className={styles.eyebrow}>Start here · preserve, then finish</span><h2 id="queue-title">{family === 'all' ? 'Family' : family} reuse &amp; gap queue</h2><p>Every configuration, with its plate, kit and hero together. Open a row for saved evidence.</p></div><button onClick={download}>Download family inventory</button></div>
    {family==='Boston Round'&&<p><a href="/team/asset-ledger?preview=1&view=plates">Open Boston family plate contact sheet →</a></p>}
    <div className={styles.summary} aria-label="Family inventory totals">
      <div><strong>{familyRows.length}</strong><span>catalog configurations</span></div>
      <div><strong>{familyRows.filter(r=>r.plate.sha256).length}</strong><span>existing plates · {familyRows.filter(r=>r.plate.checksPassed).length} pass checks</span></div>
      <div><strong>{familyRows.filter(r=>r.kit.state==='candidate').length}</strong><span>kit candidates · {familyRows.filter(r=>r.kit.state==='live').length} live</span></div>
      <div><strong>{groups.filter(g=>groupIds.has(g.id)&&g.state==='complete').length} / {groups.filter(g=>groupIds.has(g.id)).length}</strong><span>groups with locked Sunburst</span></div>
    </div>
    <p className={styles.notice}>Group hero coverage does not confirm every component image or the new glass sizing. This queue uses the current catalog; legacy scope reconciliation remains open. No approvals or files change here.</p>
    <div className={styles.batches} role="group" aria-label="Queue size batch"><button aria-pressed={capacity==='all'} onClick={()=>{onCapacity('all');resetFilters();}}>All sizes · {familyRows.length}</button>{sizes.map(size=><button key={size} aria-pressed={capacity===String(size)} onClick={()=>{onCapacity(String(size));resetFilters();}}>{size} mL · {familyRows.filter(r=>r.capacityMl===size).length}</button>)}</div>
    <div className={styles.filters}>
      <label>Find a configuration<input type="search" value={query} onChange={e=>{setQuery(e.target.value);setLimit(12);}} placeholder="SKU, cap finish or catalog name"/></label>
      <label>Glass color<select value={color} onChange={e=>{setColor(e.target.value);setLimit(12);}}><option value="all">All colors</option>{colors.map(c=><option key={c}>{c}</option>)}</select></label>
      <label>Component type<select value={component} onChange={e=>{setComponent(e.target.value);setLimit(12);}}><option value="all">All components</option>{components.map(c=><option key={c}>{c}</option>)}</select></label>
      <label>Asset to focus on<select value={lane} onChange={e=>{setLane(e.target.value as Kind|'all');setLimit(12);}}><option value="all">All three assets</option>{kinds.map(k=><option key={k} value={k}>{k==='plate'?'Plates':k==='kit'?'Kits':'Heroes'}</option>)}</select></label>
      <label>Next-action filter<select value={status} onChange={e=>{setStatus(e.target.value);setLimit(12);}}><option value="all">All next actions</option>{Object.entries(tones).map(([key,text])=><option key={key} value={key}>{text}</option>)}</select></label>
    </div>
    <div className={styles.result}><span role="status">{filtered.length} of {sizeRows.length} configurations in this size batch · showing {Math.min(limit,filtered.length)}</span><button onClick={resetFilters}>Clear queue filters</button></div>
    <div className={styles.legend}>{Object.entries(tones).map(([key,text])=><span className={styles[key]} key={key}>{text}</span>)}</div>
    <p className={styles.instructions}>Work left to right: plate → kit → hero. Preserve approved files; review only changed or unapproved assets. A hold stays visible until its evidence is resolved.</p>
    {filtered.slice(0,limit).map(({r,actions})=>{
      const standard = standards.find(s=>!!r.productGroupId&&s.productGroupIds.includes(r.productGroupId));
      return <article className={styles.row} key={r.sku}>
        <div className={styles.identity}><h3>{r.capacityMl ?? '?'} mL · {r.color ?? 'Color unverified'} · {componentLabel(r)}</h3><p>{r.itemName || 'Catalog description not recorded'}<br/><strong>{r.sku}</strong>{r.graceSku ? ` · ${r.graceSku}` : ''}</p><span className={styles.standard}>{standard?.state==='locked'?`Glass standard locked · v${standard.version}`:'Glass standard needs reconciliation'}</span></div>
        <div className={styles.lanes}>{kinds.map((k,i)=><div className={`${styles.lane} ${lane!=='all'&&lane!==k?styles.dim:''}`} key={k}><h4>{i+1}. {k==='plate'?'Plate':k==='kit'?'Kit':'Hero'}</h4><span className={`${styles.badge} ${styles[actions[k].tone]}`}>{actions[k].title}</span><p>{actions[k].next}</p></div>)}</div>
        <details className={styles.evidence}><summary>Saved files, review cards &amp; holds · {r.sku}</summary>
          <p>Catalog group: {r.groupSlug || 'Unmatched — reconcile identity'}. Recorded component values above come from catalog fields; unspecified values are not inferred from the SKU.</p>
          <div className={styles.links}>{r.plate.imageUrl&&<a href={r.plate.imageUrl} target="_blank" rel="noreferrer">Open existing plate</a>}{r.hero.url&&<a href={r.hero.url} target="_blank" rel="noreferrer">Open indexed hero</a>}{standard?.finalCandidate?.sku===r.sku&&<button onClick={()=>onFinalReview(standard.id)}>Open saved final image review</button>}</div>
          {kinds.map(k=><div key={k}><h4>{k==='plate'?'Plate':k==='kit'?'Kit':'Hero'} evidence</h4>{r[k].candidate?.collection&&<p>Review collection: <strong>{r[k].candidate.collection}</strong> · decision: {r[k].candidate.state} · image bytes {r[k].candidate.bytesVerified?'verified':'need checking'}</p>}<pre>{JSON.stringify(r[k],null,2)}</pre></div>)}
        </details>
      </article>;
    })}
    {!filtered.length&&<p className={styles.notice}>No configurations match these filters. Clear the queue filters to see the batch again.</p>}
    {filtered.length>limit&&<button className={styles.more} onClick={()=>setLimit(n=>n+12)}>Show next {Math.min(12,filtered.length-limit)} configurations</button>}
  </section>;
}
