import hashlib,html,importlib.util,json,re,urllib.request
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
OUT=Path('/Users/jordanrichter/.codex/visualizations/2026/09/12/01a097d5-52fb-77b2-9230-f5a9a5ee8e40/plate-grouping-review');OUT.mkdir(parents=True,exist_ok=True)
assets=OUT/'assets';assets.mkdir(exist_ok=True)
sp=importlib.util.spec_from_file_location('ruler',ROOT/'scripts/asset-ledger/measure-plates.py');m=importlib.util.module_from_spec(sp);sp.loader.exec_module(m)
served=json.loads((HERE/'served-before-review.json').read_text())['plates']
rows=[]
for batch in json.loads((HERE/'render-report.json').read_text()):
 base=Path(batch['batch'])/'plates'
 for row in json.loads((base/'manifest.json').read_text())['rows']:
  for state,key,live in [('on','plate','image'),('off','plateCapOff','imageCapOff')]:
   if row.get(key):rows.append((row,state,base/row[key]['key'],served.get(row['websiteSku'],{}).get(live)))
def copy(data):
 sha=hashlib.sha256(data).hexdigest();path=assets/(sha+'.webp')
 if not path.exists():path.write_bytes(data)
 return sha,path

def build(args):
 row,state,new_path,url=args;sku=row['websiteSku'];new_sha,new=copy(new_path.read_bytes());old_sha=None;old=None;error=None
 try:
  if url:
   match=re.search(r'/([a-f0-9]{64})\.',url);expected=match.group(1) if match else None
   cache=ROOT/'data/asset-ledger/plates-cache'/(sku+'.webp')
   data=cache.read_bytes() if state=='on' and cache.exists() else b''
   if not data or hashlib.sha256(data).hexdigest()!=expected:
    with urllib.request.urlopen(url,timeout=30) as response:data=response.read()
   old_sha,old=copy(data)
   if expected and old_sha!=expected:raise ValueError('served hash mismatch')
 except Exception as e:error=str(e);old=None
 metrics={}
 for side,path in [('before',old),('after',new)]:
  if path:
   # Reuse the existing ruler exactly. Its input path is selected by cache + SKU.
   result=m.measure({'sku':path.stem,'familyId':row['familyId'],'capOff':state=='off','source':''})
   metrics[side]={k:result[k] for k in ('bodyWidth','height','foot')} if result else None
 return {'sku':sku,'familyId':row['familyId'],'view':state,'beforeSha256':old_sha,'assetSha256':new_sha,'before':str(old.relative_to(OUT)) if old else None,'after':str(new.relative_to(OUT)),'metrics':metrics,'status':'pending','error':error,'rendererPass':row['publishable']}
m.CACHE=str(assets)
with ThreadPoolExecutor(6) as ex:cards=list(ex.map(build,rows))
(OUT/'review-cards.json').write_text(json.dumps(cards,indent=1))
chunks=[]
for c in cards:
 metric=lambda side: 'Unavailable' if not c['metrics'].get(side) else 'Body width {bodyWidth}px · height {height}px · foot y={foot}'.format(**c['metrics'][side])
 def figure(side):
  image=f'<img loading="lazy" src="{c[side]}" alt="{side} {html.escape(c["sku"])}">' if c[side] else '<div class="missing">No served comparison available</div>'
  sha=c['beforeSha256' if side=='before' else 'assetSha256']
  return f'<figure><figcaption>{"Served before" if side=="before" else "Unapproved candidate"}<br>{metric(side)}</figcaption>{image}<small>{sha or "No image"}</small></figure>'
 chunks.append(f'<article data-search="{html.escape(c["sku"]+" "+c["familyId"])}"><h2>{html.escape(c["sku"])} · cap {c["view"]}</h2><p>{html.escape(c["familyId"])} · Review pending · Publication not authorized</p><div class="pair">{figure("before")}{figure("after")}</div></article>')
(OUT/'index.html').write_text('''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Step 1 — unapproved plate comparisons</title><style>body{font:16px/1.5 system-ui;margin:0;background:#f5f3ef;color:#272722}main{max-width:1120px;margin:auto;padding:24px}h1{font:36px Georgia}h2{font-size:20px}article{border-top:1px solid #cabfae;margin:32px 0;padding-top:16px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}figure{margin:0;min-width:0}img,.missing{display:block;width:100%;aspect-ratio:10/11;object-fit:contain;background:white}small{display:block;overflow-wrap:anywhere;font-size:10px}input{padding:12px;font:inherit;width:min(90%,600px)}figcaption{margin:8px 0;font-size:14px}</style><main><h1>Plate grouping — paused for workflow audit</h1><p>89 completed local SKU candidates. Every before/after uses the same full 1000 × 1100 canvas and the same displayed zoom. Files are preserved by SHA-256. No approvals or publication have occurred. The metric is the existing plate ruler; geometry numbers are not a substitute for visual approval.</p><p>Cap-off comparisons are included where a new cap-off was rendered. All candidates remain pending, including outputs that passed renderer checks.</p><input placeholder="Filter by exact SKU or family" aria-label="Filter" oninput="document.querySelectorAll('article').forEach(a=>a.hidden=!a.dataset.search.toLowerCase().includes(this.value.toLowerCase()))">'''+''.join(chunks)+'</main></html>')
print(json.dumps({'cards':len(cards),'errors':sum(bool(c['error']) for c in cards),'path':str(OUT/'index.html')}))
