from pathlib import Path
import json,shutil
out=Path(__file__).resolve().parent;root=Path.cwd();dest=root/'public/reviews/elegant60-cap-seating-2026-10-31';dest.mkdir(parents=True,exist_ok=True)
for p in out.glob('*.png'):shutil.copy2(p,dest/p.name)
for g in ['clear','frosted']:shutil.copy2(out.parent/f'after-{g}-capon.png',dest/f'before-{g}-capon.png')
checks=json.loads((out/'browser-checks.json').read_text());assert checks['passed'];old=json.loads((out.parent/'browser-verification.json').read_text());comparison=[]
for row in checks['rows']:
 prev=next(x for x in old['rows'] if x['glass']==row['glass'] and x['capId']==row['capId'] and x['view']==row['view'])
 if row['view'] in ['capon','sidecar']:
  delta=max(abs(row['body'][k]-prev['body'][k]) for k in ['x','y','width','height'])
  assert delta<.5,(row['glass'],row['capId'],delta)
  comparison.append({'glass':row['glass'],'cap':row['capId'],'view':row['view'],'bodyDisplayDeltaPx':delta})
report={'passed':True,'states':len(checks['rows']),'bodyDisplayStable':comparison,'builder':json.loads((out.parent/'builder-verification.json').read_text()),'handoff':json.loads((out.parent/'handoff-verification.json').read_text()),'seating':json.loads((out.parent/'body-recovery-report.json').read_text()),'assumption':'Cap skirt meets the shoulder, zero exposed neck gap, matching IMG_6871.HEIC and user clarification.','status':'local only, pending visual approval'}
(out/'report.json').write_text(json.dumps(report,indent=2));shutil.copy2(out/'report.json',dest/'report.json')
sections=[]
for g in ['clear','frosted']:
 sections.append(f'<h2>{g.title()}</h2><div class="pair"><figure><img src="before-{g}-capon.png"><figcaption>Before: cap intersects shoulder</figcaption></figure><figure><img src="after-{g}-shiny-gold-capon.png"><figcaption>Corrected: cap meets shoulder</figcaption></figure></div><div class="pair"><figure><img src="after-{g}-white-capon.png"><figcaption>White cap</figcaption></figure><figure><img src="after-{g}-shiny-gold-sidecar.png"><figcaption>Cap off</figcaption></figure></div><p><a href="/products/elegant-60ml-{g}-18-415-reducer?cap=white">Open {g} bottle</a></p>')
contact=''.join(f'<figure><img src="after-{r["glass"]}-{r["capId"]}-capon.png"><figcaption>{r["glass"]} · {r["capId"]}</figcaption></figure>' for r in checks['rows'] if r['view']=='capon')
(dest/'index.html').write_text('''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Elegant 60 ml cap seating</title><style>body{font:16px/1.5 system-ui;color:#222;background:#f5f3ef;margin:0}main{max-width:1260px;margin:auto;padding:30px}h1,h2{font-weight:500}.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}figure{margin:0;border:1px solid #ded9d0}img{width:100%;display:block}figcaption{padding:12px}.contact{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}a{color:#705c39}@media(max-width:650px){.pair{grid-template-columns:1fr}.contact{grid-template-columns:1fr 1fr}main{padding:16px}}</style><main><h1>Elegant 60 ml: corrected cap seating</h1><p>Caps sit flush at the shoulder, without an exposed neck gap or overlap into the glass. Glass artwork, bottle scale, base position and reducer insert are unchanged. Applied to 24 local reducer kits shared by the product page and builder.</p><p>Checked 60 product-page states across 20 visible finishes, all 24 builder kits and both product-to-builder handoffs. Local review only. <a href="report.json">Check report</a></p>'''+''.join(sections)+'<h2>All visible cap finishes</h2><div class="contact">'+contact+'</div></main></html>')
# Keep the previous recovery review honest, linking the new correction rather than hiding its history.
p=root/'public/reviews/elegant60-glass-recovery-2026-10-31/index.html';s=p.read_text();note='<p><strong>Cap seating updated:</strong> these earlier screenshots show the prior position. <a href="/reviews/elegant60-cap-seating-2026-10-31/index.html">View the corrected cap seating and checks.</a></p>'
if note not in s:s=s.replace('<h1>Elegant 60 ml: recovered glass masters</h1>','<h1>Elegant 60 ml: recovered glass masters</h1>'+note);p.write_text(s)
(out/'README.md').write_text('Local-only cap seating correction. All 24 reducer kits receive one skirt-to-neck registration per glass. Zero shoulder clearance as clarified by user and IMG_6871.HEIC. Body images, anchors, insert and cap sizes unchanged. Original kits: ../before-cap-seating-kits.json. Product and builder share corrected boxes. Report: report.json. No production writes.\n')
print(dest/'index.html')
