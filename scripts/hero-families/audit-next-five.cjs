/* Read-only intake and contact sheets. Never mutates product media or publishes. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');
const families = ['Elegant', 'Boston Round', 'Slim', 'Sleek', 'Diva'];
const root = process.cwd();
const out = path.join(root, 'output/next-five-salvage-2026-09-23');
const docs = path.join(root, 'docs/reviews/next-five-salvage-2026-09-23');
const read = p => JSON.parse(fs.readFileSync(p));
const escape = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slug = s => s.toLowerCase().replaceAll(' ', '-');
const registry = read('src/lib/products/catalog-heroes.json');
const ledger = read('src/lib/asset-ledger/ledger.json');
const locks = read('docs/reviews/elegant-shoulder-alignment-2026-09-07.json').rows;
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const assessmentPath = path.join(docs, 'elegant-assessment.json');
const assessments = fs.existsSync(assessmentPath) ? read(assessmentPath).rows : [];
async function main() {
  fs.mkdirSync(out, { recursive: true }); fs.mkdirSync(docs, { recursive: true });
  const rows = [];
  for (const family of families) {
    const heroes = registry.filter(r => r.family === family).sort((a,b) => a.capacityMl-b.capacityMl || a.bottleColor.localeCompare(b.bottleColor) || a.websiteSku.localeCompare(b.websiteSku));
    for (const hero of heroes) {
      const file = path.join(root, 'public', hero.url);
      const bytes = fs.readFileSync(file), meta = await sharp(bytes).metadata();
      const old = family === 'Elegant' ? locks.find(r => r.sku === hero.websiteSku) : null;
      const exact = ledger.rows.find(r => r.sku === hero.websiteSku);
      const sha256 = hash(bytes);
      const r = { ...hero, sha256, decodedWidth: meta.width, decodedHeight: meta.height,
        sourcePath: exact?.plate?.sourcePath ?? null, catalogIdentityFound: Boolean(exact),
        catalogGroupMatches: exact?.groupSlug === hero.groupSlug,
        plateState: exact?.plate?.state ?? null, kitState: exact?.kit?.state ?? null,
        previousLockHashMatches: old ? old.assetSha256 === sha256 : null,
        historicalShoulderPercent: old?.shoulderYPercent ?? null,
        historicalBasePercent: old?.baselineYPercent ?? null,
        historicalException: old?.vintageException ?? false,
        assessment: assessments.find(a=>a.sku===hero.websiteSku)?.recommendation ?? 'pending visual salvage review', finalApproval: false,
        thumbnail: `${hero.websiteSku}.jpg` };
      await sharp(bytes).resize(360,396,{fit:'contain',background:'#F5F3EF'}).jpeg({quality:92}).toFile(path.join(out,r.thumbnail));
      rows.push(r);
    }
    for (const capacity of [...new Set(heroes.map(h=>h.capacityMl))]) {
      const batch = rows.filter(r=>r.family===family && r.capacityMl===capacity);
      const cols = 4, cw = 360, ch = 472, header = 80;
      const composites = [];
      for (const [i,r] of batch.entries()) {
        const x = i%cols*cw, y = header+Math.floor(i/cols)*ch;
        composites.push({input:fs.readFileSync(path.join(out,r.thumbnail)),left:x,top:y});
        const label = `<svg width="360" height="76"><rect width="360" height="76" fill="#F5F3EF"/><text x="12" y="23" font-family="Arial" font-size="16">${escape(r.capacityMl+' mL · '+r.bottleColor)}</text><text x="12" y="46" font-family="Arial" font-size="13">${escape(r.websiteSku)}</text><text x="12" y="65" font-family="Arial" font-size="12" fill="#666">Existing artwork · not a new render</text></svg>`;
        composites.push({input:Buffer.from(label),left:x,top:y+396});
      }
      const title = `<svg width="1440" height="80"><rect width="1440" height="80" fill="#F5F3EF"/><text x="20" y="34" font-family="Arial" font-size="27">${escape(family+' · '+capacity+' mL · existing hero audit')}</text><text x="20" y="60" font-family="Arial" font-size="17">Original composition · no new scaling, generation or approval</text></svg>`;
      composites.push({input:Buffer.from(title),left:0,top:0});
      await sharp({create:{width:1440,height:header+Math.ceil(batch.length/cols)*ch,channels:3,background:'#F5F3EF'}}).composite(composites).jpeg({quality:94}).toFile(path.join(out,`${slug(family)}-${capacity}ml.jpg`));
    }
  }
  const references = [...read('src/lib/products/catalog-hero-pilot.json'),...read('src/lib/products/catalog-hero-cre-pilot.json')];
  const selected = ['Cylinder','Circle','Round','Empire'].flatMap(f => ['Clear','Frosted'].map(c => references.find(r=>r.family===f && r.bottleColor===c)).filter(Boolean));
  for(const r of selected) await sharp(path.join(root,'public',r.url)).resize(360,396).jpeg({quality:94}).toFile(path.join(out,`reference-${r.websiteSku}.jpg`));
  const cards = list => list.map(r=>`<article><div class="image"><img src="${escape(r.thumbnail)}" loading="lazy" alt="${escape(r.alt)}"><div class="base"></div>${r.previousLockHashMatches && r.historicalShoulderPercent!==null?`<div class="shoulder" style="top:${r.historicalShoulderPercent}%"></div>`:''}</div><h3>${r.capacityMl} mL · ${escape(r.bottleColor)}</h3><code>${escape(r.websiteSku)}</code><p>${escape(r.presentation)}</p><p>${r.decodedWidth} × ${r.decodedHeight} · ${escape(r.assessment)}</p><p>${r.previousLockHashMatches ? 'Historical lock matches image hash.' : 'Historical lock not verified.'} ${r.historicalException?'Prior vintage exception; needs measured lock.':''}</p></article>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Five-family salvage review</title><style>body{background:#f5f3ef;color:#282722;font:16px system-ui;margin:24px}header{max-width:1000px}nav{display:flex;gap:16px;flex-wrap:wrap}a{color:#776039}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:16px}article{border:1px solid #ddd;padding:12px;min-width:0}img{width:100%;display:block}code{font-size:12px;overflow-wrap:anywhere}h3{margin-bottom:5px}p{font-size:14px;line-height:1.45}.image{position:relative;aspect-ratio:10/11}.base,.shoulder{display:none;position:absolute;left:0;right:0;pointer-events:none}.base{top:91%;border-top:1px solid #248379}.shoulder{border-top:1px dashed #b08b42}.guides .base,.guides .shoulder{display:block}button{padding:10px;margin:12px 0}section{margin:35px 0}</style></head><body><header><h1>Review existing artwork before regeneration</h1><p>Order: Elegant → Boston Round → Slim → Sleek → Diva. These are existing registry images, preserved at their original composition. This is not proof of which image a live Shopify-backed card serves.</p><p>Teal guide = proposed 91% base. Gold = historical shoulder position only where its exact image hash still matches. Historical lines are evidence, not newly approved family targets. Final deliverables must be 2080 × 2288. No image API calls or publication.</p><button onclick="document.body.classList.toggle('guides')">Show / hide historical guides</button><nav>${families.map(f=>`<a href="#${slug(f)}">${f}</a>`).join('')}</nav></header><section><h2>Approved four-family treatment references</h2><p>Exact local files from the September 22 pilot release registries; material and lighting comparison, not equal-capacity scale targets.</p><div class="grid">${selected.map(r=>`<article><img src="reference-${escape(r.websiteSku)}.jpg"><h3>${escape(r.family)} · ${r.capacityMl} mL · ${escape(r.bottleColor)}</h3><code>${escape(r.websiteSku)}</code></article>`).join('')}</div></section>${families.map(f=>`<section id="${slug(f)}"><h2>${f} · ${rows.filter(r=>r.family===f).length} existing heroes</h2><div class="grid">${cards(rows.filter(r=>r.family===f))}</div></section>`).join('')}</body></html>`;
  fs.writeFileSync(path.join(out,'index.html'),html);
  const report = {checkedAt:new Date().toISOString(),ledgerGeneratedAt:ledger.generatedAt,mode:'read-only salvage intake',families:families.map(f=>ledger.families.find(x=>x.family===f)),rows};
  fs.writeFileSync(path.join(docs,'intake.json'),JSON.stringify(report,null,2)+'\n');
  fs.writeFileSync(path.join(out,'intake.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({out,rows:rows.length,elegant:rows.filter(r=>r.family==='Elegant').length,elegantMatchingHistoricalLocks:rows.filter(r=>r.family==='Elegant'&&r.previousLockHashMatches).length},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1});
