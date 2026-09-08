import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const root = process.cwd();
const auditDir = resolve(root, "data/audits/non-bottle-media-inventory-2026-09-08");
const output = resolve(root, "public/preview/non-bottle-media-inventory/index.html");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i += 1; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell); cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell); cell = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [headers, ...body] = rows;
  return body.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

const inventory = parseCsv(await readFile(resolve(auditDir, "current_non_bottle_inventory.csv"), "utf8"));
const legacy = parseCsv(await readFile(resolve(auditDir, "legacy_listing_deltas.csv"), "utf8"));
const grouping = JSON.parse(await readFile(resolve(auditDir, "product-grouping-plan.json"), "utf8"));
const payload = JSON.stringify({ inventory, legacy, grouping }).replaceAll("<", "\\u003c");

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Non-bottle media inventory</title><style>
:root{--bone:#f5f3ef;--paper:#fff;--ink:#1d1d1f;--muted:#6e6b66;--line:#d9d2c6;--gold:#a47c39;--red:#a8382d;--green:#306b4f}
*{box-sizing:border-box}body{margin:0;background:var(--bone);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif}main{max-width:1400px;margin:auto;padding:28px 20px 80px}h1{font-family:Georgia,serif;font-size:clamp(32px,5vw,56px);font-weight:500;margin:0 0 8px}.lede{color:var(--muted);max-width:780px;line-height:1.55}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:10px;margin:24px 0}.card,.group{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:16px}.metric{font-size:30px;font-weight:650}.label{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}h2{font-family:Georgia,serif;font-size:28px;font-weight:500;margin:34px 0 12px}.groups{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}.group h3{margin:0 0 12px}.group dl{display:grid;grid-template-columns:auto 1fr;gap:7px 12px;font-size:14px}.group dt{color:var(--muted)}.toolbar{position:sticky;top:0;z-index:5;background:color-mix(in srgb,var(--bone) 94%,transparent);backdrop-filter:blur(14px);padding:12px 0;display:flex;gap:8px;flex-wrap:wrap}.toolbar input,.toolbar select{min-height:44px;border:1px solid var(--line);border-radius:8px;background:white;padding:0 12px;font:inherit}.toolbar input{flex:1;min-width:220px}.table{display:grid;gap:10px}.row{display:grid;grid-template-columns:80px minmax(180px,1.6fr) minmax(130px,1fr) minmax(210px,1.4fr);gap:14px;align-items:center;background:white;border:1px solid var(--line);border-radius:10px;padding:10px}.row img{width:72px;height:72px;object-fit:contain;background:var(--bone);border-radius:7px}.sku{font-size:13px;color:var(--muted);margin-top:4px}.pill{display:inline-flex;border:1px solid var(--line);border-radius:99px;padding:4px 8px;font-size:12px}.pill.good{color:var(--green)}.pill.warn{color:var(--gold)}.pill.bad{color:var(--red)}.action{font-size:13px;line-height:1.4}.empty{padding:28px;text-align:center;color:var(--muted)}@media(max-width:720px){main{padding:18px 12px 60px}.row{grid-template-columns:72px 1fr}.row .status,.row .action{grid-column:2}.cards{grid-template-columns:repeat(2,1fr)}}
</style></head><body><main>
<p class="label">Best Bottles · exact-SKU audit · 8 September 2026</p><h1>Non-bottle media inventory</h1>
<p class="lede">Bags, boxes, packaging supplies, funnels, and individual components compared with the current catalog, permanent plates, the master Photoshop library, and verified legacy listings.</p>
<section class="cards" id="summary"></section>
<h2>Planned product groups</h2><section class="groups" id="groups"></section>
<h2>Exact product inventory</h2><div class="toolbar"><input id="search" type="search" placeholder="Search product, SKU, family…"><select id="status"><option value="all">All media states</option><option value="exact">Exact plate or fallback</option><option value="remote">Healthy remote only</option><option value="missing">Needs recovery</option><option value="generation">Generation reference ready</option></select></div>
<section class="table" id="rows"></section>
<h2>Legacy-only and identity differences</h2><section class="table" id="legacy"></section>
</main><script>const DATA=${payload};
const esc=(v)=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const state=(r)=>r.live_media_status==="covered_exact_plate"?"exact":r.live_media_status==="remote_only_healthy"?"remote":"missing";
const hasPsd=(r)=>/^(exact_|verified_legacy_image_filename_alias)/.test(r.psd_state||'');
const metrics=[['Current products',DATA.inventory.length],['Exact plate / fallback',DATA.inventory.filter(r=>state(r)==='exact').length],['Healthy remote only',DATA.inventory.filter(r=>state(r)==='remote').length],['Need recovery',DATA.inventory.filter(r=>state(r)==='missing').length],['Exact PSD match',DATA.inventory.filter(hasPsd).length],['Legacy reference ready',DATA.inventory.filter(r=>r.generation_reference_ready==='yes').length]];
document.querySelector('#summary').innerHTML=metrics.map(([l,n])=>'<article class="card"><div class="metric">'+n+'</div><div class="label">'+esc(l)+'</div></article>').join('');
document.querySelector('#groups').innerHTML=DATA.grouping.groups.map(g=>'<article class="group"><h3>'+esc(g.displayName)+'</h3><dl><dt>Default</dt><dd>'+esc(g.defaultLabel)+'</dd><dt>Options</dt><dd>'+esc(g.optionDimensions.join(' · '))+'</dd><dt>Exact SKUs</dt><dd>'+g.members.length+'</dd><dt>Status</dt><dd>Prepared for targeted migration</dd></dl></article>').join('');
const rowHtml=(r)=>{const s=state(r),img=r.legacy_image_url;return '<article class="row">'+(img?'<img loading="lazy" src="'+esc(img)+'" alt="">':'<div></div>')+'<div><strong>'+esc(r.item_name||r.website_sku)+'</strong><div class="sku">'+esc(r.website_sku)+' · '+esc(r.grace_sku)+'</div><div class="sku">'+esc(r.category)+' · '+esc(r.family)+'</div></div><div class="status"><span class="pill '+(s==='exact'?'good':s==='remote'?'warn':'bad')+'">'+esc(r.live_media_status.replaceAll('_',' '))+'</span></div><div class="action">'+esc(r.recovery_action||'No action')+(hasPsd(r)?'<div class="sku">Master PSD verified</div>':'<div class="sku">No exact PSD</div>')+'</div></article>'};
function render(){const q=document.querySelector('#search').value.toLowerCase(),f=document.querySelector('#status').value;const rows=DATA.inventory.filter(r=>Object.values(r).join(' ').toLowerCase().includes(q)).filter(r=>f==='all'||state(r)===f||(f==='generation'&&r.generation_reference_ready==='yes'));document.querySelector('#rows').innerHTML=rows.length?rows.map(rowHtml).join(''):'<div class="empty">No products match these filters.</div>'}
document.querySelector('#search').addEventListener('input',render);document.querySelector('#status').addEventListener('change',render);render();
document.querySelector('#legacy').innerHTML=DATA.legacy.map(r=>'<article class="row"><div></div><div><strong>'+esc(r.item_name||r.website_sku)+'</strong><div class="sku">'+esc(r.website_sku)+' · '+esc(r.grace_sku)+'</div></div><div class="status"><span class="pill warn">'+esc(r.status||r.match_status||'review')+'</span></div><div class="action">'+esc(r.recovery_action||r.notes||'Review exact identity')+'</div></article>').join('');
</script></body></html>`;

await mkdir(dirname(output), { recursive: true });
await writeFile(output, html);
console.log(`Wrote ${output}`);
