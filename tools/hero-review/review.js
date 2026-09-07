const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $ = id => document.getElementById(id);
const labels = {pending:'Not reviewed',approved:'Approved visually',changes_requested:'Needs changes',rejected:'Rejected'};
const stages = {locked:'Approved · sizing locked',corrected:'Revised from your feedback · family review pending',detailed:'Earlier detailed pass · final QA pending',rework:'Preliminary draft · internal rework queue',recovered:'Recovered first pass · visual QA pending'};
const params = new URLSearchParams(location.search);
const collection = params.get('collection') || '';
const query = new URLSearchParams({collection, ...(params.get('sandbox')==='1'?{sandbox:'1'}:{})});
const api = '/api/hero-review?' + query;
let rows = [], decisions = {}, connected = false;
const sizingDrafts = new Map();
const drafts = new Map(), saving = new Set();
const key = r => r.sku + ':' + r.assetSha256;
const decision = r => r.sizingLocked ? {status:'approved',notes:'Family approval recorded in this collection.',revision:0} : decisions[key(r)] || {status:'pending',notes:'',revision:0};
const sizing = r => sizingDrafts.has(key(r)) ? sizingDrafts.get(key(r)) : (Object.hasOwn(decision(r),'targetHeight') ? decision(r).targetHeight : r.targetHeightRequest || null);
function targetMarkup(t) {
  return t ? `<div class="target-line" style="top:${91-t.heightPercent}%"><span>${Number(t.heightPercent.toFixed(2))}% target${t.measurement==='glass_shoulder'?' · shoulder':t.measurement==='glass_body'?' · body':''}</span></div><div class="height-bracket" style="top:${91-t.heightPercent}%;height:${t.heightPercent}%"></div>` : '';
}
function gridMarkup() {
  return `<div class="height-lines">${[10,20,30,40,50,60,70,75,80,85,90].map(n=>`<div class="height-line" style="top:${91-n}%"><span>${n}%</span></div>`).join('')}<div class="height-line zero" style="top:91%"><span>0 · baseline</span></div></div>`;
}
function updateSizing(card,r,t) {
  sizingDrafts.set(key(r),t);
  card.querySelector('.target-overlay').innerHTML=targetMarkup(t);
  card.querySelector('.height-value').value=t?.heightPercent??'';
  card.querySelector('.height-slider').value=t?.heightPercent??75;
  card.querySelector('.height-warning').textContent=t?.heightPercent>88?'Less than 3% top clearance. Check all fitments and accessories.':'';
  card.querySelector('.saved').textContent='Unsaved sizing target — click Save sizing request.';
}
function counts() {
  const counts = Object.fromEntries(Object.keys(labels).map(s => [s, rows.filter(r => decision(r).status === s).length]));
  $('count').textContent = `${document.querySelectorAll('.card').length} shown · ${counts.pending} not reviewed · ${counts.approved} approved visually · ${counts.changes_requested} need changes · ${counts.rejected} rejected. ${rows.filter(r=>r.sizingLocked).length} locked locally; ${rows.filter(r=>!r.sizingLocked).length} remain in review.`;
}
function render() {
  const selected = rows.filter(r => (!$('family').value || r.family === $('family').value) && (!$('stage').value || r.stage === $('stage').value) && (!$('status').value || decision(r).status === $('status').value));
  document.body.classList.toggle('baseline', $('baseline').checked);
  document.body.classList.toggle('height-grid', $('height-grid').checked);
  $('content').innerHTML = [...new Set(selected.map(r=>r.family))].map(f => `<section><h2>${esc(f)} <small>${selected.filter(r=>r.family===f).length} drafts</small></h2><div class="grid">${selected.filter(r=>r.family===f).map(r => {
    if(r.sizingLocked) return `<article class="card" data-sku="${esc(r.sku)}"><div class="locked-photo" style="position:relative;aspect-ratio:10/11;background:#f5f3ef"><img style="width:100%;height:100%;object-fit:contain" src="${esc(r.url)}" alt="${esc(r.title)}">${gridMarkup()}<div class="target-overlay">${targetMarkup(r.targetHeightRequest)}</div></div><div class="meta"><div class="badge">Approved · sizing locked</div><h3>${esc(r.title)}</h3><div class="sku">${esc(r.sku)}</div><p>${r.shoulderSizing?`Shoulder ${r.shoulderSizing.measuredPercent.toFixed(2)}% · `:''}${r.measurement?`total ${r.measurement?.totalHeightPercent?.toFixed(2)??'unmeasured'}%`:'Original framing locked'} · baseline 91%</p><p>Reviewed geometry and framing preserved. Physical-dimension exceptions remain documented.</p><a href="?collection=${encodeURIComponent(collection)}&amp;view=all&amp;family=${encodeURIComponent(r.family)}">View this locked family</a></div></article>`;
    const d = decision(r), t = sizing(r), scope=t?.measurement||r.defaultMeasurement||'bottle_with_fitment', dirty = drafts.has(key(r)) || sizingDrafts.has(key(r)), disabled = !connected || saving.has(key(r));
    return `<article class="card" data-sku="${esc(r.sku)}"><div class="photo" title="Click to place a height target"><img src="${esc(r.url)}" alt="${esc(r.title)}" loading="eager" style="transform-origin:0 0;transform:translate(${r.framing?.translateXPercent||0}%,${r.framing?.translateYPercent||0}%) scale(${r.framing?.scale??1})">${gridMarkup()}<div class="target-overlay">${targetMarkup(t)}</div></div><div class="meta"><div class="badge">${r.shoulderSizing?'Shoulder sizing · review requested':stages[r.stage]}</div><h3>${esc(r.title)}</h3><div class="sku">${esc(r.sku)} · version ${r.assetSha256.slice(0,10)}</div>${r.priorUrl?`<details class="revision-history"><summary>Compare previous draft and feedback</summary><p>Earlier overall preference: ${Number((r.priorOverallTargetHeight?.heightPercent??r.targetHeightRequest?.heightPercent??0).toFixed(2))}%. Revised total height: ${r.measurement?.totalHeightPercent?.toFixed(2)??'unmeasured'}%. Previous decisions apply to the earlier image only.</p><p>${esc(decisions[r.sku+':'+r.priorAssetSha256]?.notes||decisions[r.sku+':'+r.originalFeedbackAssetSha256]?.notes||'No written note on the previous version.')}</p><a href="${esc(r.priorUrl)}" target="_blank" rel="noopener"><img src="${esc(r.priorUrl)}" alt="Previous draft for ${esc(r.sku)}"></a></details>`:''}<details><summary>Compare original source</summary><p>${esc(r.sourceKind)}. Compare the body, top, cap and assembly proportions.</p>${r.sourcePreview?`<a href="${esc(r.sourcePreview)}" target="_blank" rel="noopener"><img src="${esc(r.sourcePreview)}" alt="Original source for ${esc(r.sku)}"></a>`:'Source preview unavailable; source verification is required.'}<a href="${esc(r.url)}" target="_blank" rel="noopener">Open full-size draft</a></details>${r.reviewNotes.length?`<details class="notes"><summary>Source review notes (${r.reviewNotes.length})</summary>${r.reviewNotes.map(n=>`<p>${esc(n)}</p>`).join('')}</details>`:''}${r.measurementException?`<p class="measurement-exception">Assembly measurement: ${esc(r.measurementException.replaceAll('-',' '))}. ${r.retainedWithoutChange?'Current size retained; no saved height target.':'No shared glass-shoulder guide applies.'}</p>`:''}<fieldset class="sizing"><legend>Target height</legend><label>Measure <select class="height-scope"><option value="bottle_with_fitment" ${(scope==='bottle_with_fitment')?'selected':''}>Bottle including top</option><option value="glass_body" ${scope==='glass_body'?'selected':''}>Glass body only</option><option value="glass_shoulder" ${scope==='glass_shoulder'?'selected':''}>Glass base to shoulder</option></select></label><div class="height-controls"><label>Frame height % <input class="height-value" type="number" min="10" max="90" step="0.5" value="${t?.heightPercent??''}" placeholder="e.g. 80"></label><input class="height-slider" type="range" min="10" max="90" step="0.5" value="${t?.heightPercent??75}" aria-label="Target height slider"></div><p class="height-warning">${t?.heightPercent>88?'Less than 3% top clearance. Check all fitments and accessories.':''}</p><button class="save-sizing" ${disabled?'disabled':''}>Save sizing request</button> <button class="clear-sizing">Clear target</button><small>${r.shoulderSizing?`Shoulder: ${r.shoulderSizing.measuredPercent.toFixed(2)}% · total: ${r.measurement?.totalHeightPercent?.toFixed(2)??'unmeasured'}%. Measured current size; choose a shared target for matching bottles.`:r.measurement?`Revised image: ${r.measurement?.totalHeightPercent?.toFixed(2)??'unmeasured'}% · edits below are new requests`:'Requested guide only · full assembly stays proportional'}</small></fieldset><div class="decision">${labels[d.status]}</div><label class="note-label">Your note<textarea maxlength="4000" placeholder="e.g. Bottle too small; wrong cap; white patch behind neck">${esc(drafts.has(key(r))?drafts.get(key(r)):d.notes)}</textarea></label><div class="actions">${[['approved','Approve'],['changes_requested','Needs changes'],['rejected','Reject']].map(([s,l])=>`<button data-status="${s}" aria-pressed="${d.status===s}" ${disabled?'disabled':''}>${l}</button>`).join('')}</div><button class="save-note" ${disabled?'disabled':''}>Save note</button><button class="reset" data-status="pending" ${disabled?'disabled':''}>Undo decision</button><p class="saved" role="status">${saving.has(key(r))?'Saving…':dirty?'Unsaved feedback — save before leaving.':d.updatedAt?'Saved · '+esc(new Date(d.updatedAt).toLocaleString()):'No decision saved.'}</p><div class="qa">Visual feedback only. Technical QA not cleared.</div></div></article>`;
  }).join('')}</div></section>`).join('') || '<p class="empty">No drafts match these filters.</p>';
  counts();
}
$('content').addEventListener('input', e => {
  if(e.target.matches('.height-value,.height-slider')) {
    const card=e.target.closest('.card'), r=rows.find(r=>r.sku===card.dataset.sku);
    if(e.target.value==='') {updateSizing(card,r,null);return;}
    const heightPercent=Number(e.target.value);
    if(!Number.isFinite(heightPercent)||heightPercent<10||heightPercent>90) {card.querySelector('.saved').textContent='Enter 10–90% before saving.';return;}
    updateSizing(card,r,{heightPercent,measurement:card.querySelector('.height-scope').value,baselinePercent:91});return;
  }
  if (e.target.tagName !== 'TEXTAREA') return;
  const card = e.target.closest('.card'), r = rows.find(r=>r.sku===card.dataset.sku);
  drafts.set(key(r), e.target.value);
  card.querySelector('.saved').textContent = 'Unsaved note — click a decision or Save note.';
});
$('content').addEventListener('click', async e => {
  const photo=e.target.closest('.photo');
  if(photo && $('height-grid').checked) {
    const card=photo.closest('.card'),r=rows.find(r=>r.sku===card.dataset.sku),box=photo.getBoundingClientRect();
    const heightPercent=Math.max(10,Math.min(90,Math.round((91-(e.clientY-box.top)/box.height*100)*2)/2));
    updateSizing(card,r,{heightPercent,measurement:card.querySelector('.height-scope').value,baselinePercent:91});return;
  }
  const button = e.target.closest('button'); if (!button) return;
  const card = button.closest('.card'), r = rows.find(r=>r.sku===card.dataset.sku), k = key(r);
  if(button.classList.contains('clear-sizing')) {updateSizing(card,r,null);return;}
  if (!connected || saving.has(k)) return;
  if(!card.querySelector('.height-value').checkValidity()){card.querySelector('.height-value').reportValidity();return;}
  const targetHeight=sizing(r);
  const sentSizing=JSON.stringify(targetHeight);
  const d = decision(r), note = card.querySelector('textarea').value;
  saving.add(k); card.querySelectorAll('button').forEach(b=>b.disabled=true);
  const message = card.querySelector('.saved'); message.classList.remove('error'); message.textContent='Saving…';
  try {
    const response = await fetch(api,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sku:r.sku,assetSha256:r.assetSha256,status:button.classList.contains('save-sizing')&&targetHeight?'changes_requested':button.dataset.status||d.status,notes:note,revision:d.revision,targetHeight})});
    const result = await response.json(); if(!response.ok) throw Error(result.error||'Could not save.');
    decisions[k]=result.decision;
    if(drafts.get(k)===note) drafts.delete(k);
    if(JSON.stringify(sizing(r))===sentSizing) sizingDrafts.delete(k);
    card.querySelector('.decision').textContent=labels[result.decision.status];
    card.querySelectorAll('.actions button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.status===result.decision.status));
    message.textContent=drafts.has(k)||sizingDrafts.has(k)?'Decision saved; newer feedback is unsaved.':'Saved · '+new Date(result.decision.updatedAt).toLocaleString();
    counts();
  } catch(error) { message.textContent='NOT SAVED: '+error.message; message.classList.add('error'); }
  finally {saving.delete(k);card.querySelectorAll('button').forEach(b=>b.disabled=false);}
});
$('content').addEventListener('change',e=>{
 if(!e.target.matches('.height-scope'))return;
 const card=e.target.closest('.card'),r=rows.find(r=>r.sku===card.dataset.sku),t=sizing(r);
 if(t)updateSizing(card,r,{...t,measurement:e.target.value});
});
for (const id of ['family','stage','status','baseline','height-grid']) $(id).addEventListener('change',()=>{const url=new URL(location.href);for(const name of ['family','stage','status'])url.searchParams.set(name,$(name).value);url.searchParams.set('baseline',$('baseline').checked?'1':'0');url.searchParams.set('grid',$('height-grid').checked?'1':'0');history.replaceState(null,'',url);render();});
window.addEventListener('beforeunload', e=>{if(drafts.size||sizingDrafts.size||saving.size){e.preventDefault();e.returnValue='';}});
$('export').addEventListener('click',async()=>{
  try {const response=await fetch(api,{cache:'no-store'});if(!response.ok)throw Error('Export failed.');const blob=new Blob([JSON.stringify(await response.json(),null,2)],{type:'application/json'}), url=URL.createObjectURL(blob), a=document.createElement('a');a.href=url;a.download=collection+'-review-decisions.json';a.click();URL.revokeObjectURL(url);}
  catch(e){$('connection').textContent=e.message;}
});
(async()=>{
  try {
    const response=await fetch('data.json?'+query,{cache:'no-store'});if(!response.ok)throw Error('Draft inventory unavailable.');rows=await response.json();const info=await (await fetch('/api/review-collection?'+query,{cache:'no-store'})).json();$('review-title').textContent=info.title||'Hero image review';document.title=$('review-title').textContent;const locked=rows.filter(r=>r.sizingLocked).length;$('review-description').textContent=`${rows.length} images · ${locked} locked · ${rows.length-locked} available for review. Decisions belong to this collection and exact image version.`;$('stage-counts').innerHTML=Object.entries(stages).map(([k,label])=>`<div><strong>${rows.filter(r=>r.stage===k).length}</strong> ${esc(label)}</div>`).join('');for(const option of $('stage').options)option.textContent=option.value?`${stages[option.value]} (${rows.filter(r=>r.stage===option.value).length})`:`All images (${rows.length})`;
    [...new Set(rows.map(r=>r.family))].forEach(f=>$('family').add(new Option(f,f)));
    $('family').value=params.get('family')||'';
    $('stage').value=params.get('stage')||'';$('status').value=params.get('status')||'';$('baseline').checked=params.get('baseline')!=='0';$('height-grid').checked=params.get('grid')!=='0';
    try {const response=await fetch(api,{cache:'no-store'});const data=await response.json();if(!response.ok)throw Error(data.error||'Connection failed.');decisions=data.decisions;connected=true;$('export').disabled=false;
      $('connection').textContent=params.get('sandbox')==='1'?'TEST SANDBOX — feedback here is separate from your real decisions.':'Connected · Decisions save to the local review file and survive refresh.';
    } catch(e){$('connection').textContent='Review is read-only: '+e.message+' Reload after the local server is available.';$('connection').classList.add('error');}
    render();
  }catch(e){$('connection').textContent=e.message;$('connection').classList.add('error');}
})();
