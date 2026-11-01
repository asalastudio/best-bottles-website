from pathlib import Path
import json,shutil,hashlib
base=Path(__file__).resolve().parents[1]
rows=json.loads(Path('public/local-kits/small-sprayers-2026-10-31/kits.json').read_text())['rows']
report={'scope':'Local 3.3 ml and 4 ml black/white sprayers, compared with user-supplied original-site screenshots.','pairs':[]}
for size,black,white in [('3.3','GBSpry3mlClBlk','GBSpry3mlClWht'),('4','GBSpry4mlClBlk','GBSpry4mlClWh')]:
 a,b=rows[black],rows[white];checks={}
 for slot in ['body','diptube','overcap']:
  pa=[{k:v for k,v in x.items() if k!='componentId'} for x in a['parts'] if x['slot']==slot]
  pb=[{k:v for k,v in x.items() if k!='componentId'} for x in b['parts'] if x['slot']==slot]
  checks[slot+'VisualDataIdentical']=pa==pb;assert checks[slot+'VisualDataIdentical']
  for part in pa:
   path=Path('public'+part['image']['url']);assert path.exists()
   if part['image'].get('sha256'):assert hashlib.sha256(path.read_bytes()).hexdigest()==part['image']['sha256']
 checks['anchorsIdentical']=a.get('anchors')==b.get('anchors');checks['sizingIdentical']=a.get('glassSizing')==b.get('glassSizing');assert all(checks.values())
 report['pairs'].append({'sizeMl':size,'skus':[black,white],'checks':checks})
report['browser']=json.loads((base/'browser-checks.json').read_text());assert all(report['browser']['checks'].values()) and not report['browser']['errors']
report['native']=json.loads((base/'small-consistency-native.json').read_text())
report['notes']=['Mechanism v2 corrects the translucent pump housing, taper and visible spring against source photos. Bottle geometry is unchanged. Tube component IDs retain their associated head finish; image, position, opacity and animation data match.','Both sizes use a modeled 1.1 mm tube and 1.9 mm tip-to-floor gap, not independently measured supplier specifications.','Mechanism v2 metadata uses the current profile-v4 floor of 1.6 mm.','The 3.3 ml name retains legacy 3ml SKU identifiers.','Both sizes remain product-page only. Production is unchanged.']
(base/'small-sprayer-consistency-report.json').write_text(json.dumps(report,indent=2)+'\n')
dest=Path('public/reviews/small-sprayer-consistency-2026-10-31');dest.mkdir(exist_ok=True);shutil.copy2(base/'small-sprayer-consistency-report.json',dest/'report.json')
html='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Small sprayer consistency check</title><style>body{margin:28px;background:#f5f3ef;color:#222;font:16px/1.5 system-ui}main{max-width:1500px;margin:auto}h1,h2{font-weight:500}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}figure{margin:0}figcaption{padding:12px}img{width:100%;display:block}section{margin:30px 0}a{color:#76572d}@media(max-width:900px){.grid{grid-template-columns:repeat(2,1fr)}}</style><main><h1>3.3 ml and 4 ml: black and white sprayers</h1><p>Checked October 31, 2026. The pump mechanism was revised against the original product photos after the first consistency check. Each black/white pair uses the same glass, base, revised dip tube and clear overcap, with identical placement and opacity. Only the sprayer head changes. All 12 page states passed image loading, naming, one-overcap and stable-position checks.</p><p>The modeled tube is 1.1 mm outside diameter and ends 1.9 mm above the interior floor in both sizes. The 4 ml tube is longer to suit its taller body. These are model dimensions; tube specifications and the concealed neck profile are not independently supplier-verified.</p><p>Local review only. Both sizes remain product-page only. Click a bottle to open its product page. <a href="report.json">Verification report</a></p>'''
for view,title in [('sidecar','Sidecar'),('capon','Cap on'),('exploded','Exploded')]:
 html+=f'<section><h2>{title}</h2><div class="grid">'
 for size in ['3.3','4']:
  for finish in ['black','white']:
   f=f'after-{size}-{finish}-{view}.png';shutil.copy2(base/f,dest/f)
   html+=f'<figure><figcaption>{size} ml · {finish.title()} sprayer</figcaption><a href="/products/cylinder-{size}ml-clear-12mm-finemist?cap={finish}"><img src="{f}" alt="{size} ml {finish} sprayer {title}"></a></figure>'
 html+='</div></section>'
(dest/'index.html').write_text(html+'</main></html>')
print('Verified two black/white pairs and 12 browser states; review ready')
