"""Read-only master source inventory for the 63 held Cylinder plates.
Exports original merged PSD previews; changes no source layer or indexed plate.
"""
import json,hashlib,html,collections
from pathlib import Path
from datetime import datetime,timezone
from psd_tools import PSDImage
ROOT=Path.cwd()
MASTER=Path('/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master').resolve()
OUT=ROOT/'docs/reviews/cylinder-capoff-recovery-2026-09-12'
(OUT/'sources').mkdir(parents=True,exist_ok=True)
read=lambda p:json.loads((ROOT/p).read_text())
ledger=read('src/lib/asset-ledger/ledger.json')
held={p['sku'] for p in ledger['platePlan']['rows'] if p['family']=='Cylinder' and p['stage']=='reconcile'}
rows=[r for r in ledger['rows'] if r['sku'] in held]
xref={r['websiteSku']:r for r in read('dist/paper-doll/catalog-plates-2026-09-12/cylinder/input/xref.json')['products']}
selection=read('data/paper-doll/selection.json')['stems']
files=read('data/paper-doll/inventory.json')['files']
by_path={f['relPath']:f for f in files if f['library']=='master'}
cache={}
def preview(rel):
 if rel in cache:return cache[rel]
 path=(MASTER/rel).resolve();path.relative_to(MASTER)
 digest=hashlib.sha256(path.read_bytes()).hexdigest()
 if digest!=by_path[rel]['sha256']:raise ValueError('Master inventory bytes changed: '+rel)
 psd=PSDImage.open(path)
 image=psd.topil()  # The existing merged preview, no layer changes or retouch.
 if image is None:raise ValueError('No original merged preview: '+rel)
 name='sources/'+digest+'.png';image.save(OUT/name)
 result={'path':rel,'sourceSha256':digest,'preview':name,'width':image.width,'height':image.height,'layers':len(list(psd.descendants()))}
 cache[rel]=result;return result
output=[]
for row in rows:
 sku=row['sku'];x=xref[sku];key=x.get('stemKey');lineage='recorded catalog crosswalk'
 entry=selection.get(key,{}) if key else {}
 on=entry.get('states',{}).get('on',{}).get('chosenPath')
 off=entry.get('states',{}).get('off',{}).get('chosenPath')
 # An existing indexed source mapping is a separate identity anchor for aliases.
 indexed=row['plate'].get('sourcePath')
 if indexed in by_path:
  on=indexed;source=by_path[indexed]
  paired=[f for f in files if f['library']=='master' and f['stemKey']==source['stemKey'] and f['capState']=='off' and not f.get('junkReason')]
  if len({f['sha256'] for f in paired})==1:
   off=sorted(paired,key=lambda f:f['relPath'])[0]['relPath'];lineage='indexed master source mapping; matching source-set record'
 rec={'sku':sku,'graceSku':row['graceSku'],'productGroupId':row['productGroupId'],'groupSlug':row['groupSlug'],'itemName':row['itemName'],'applicator':row['applicator'],'capacityMl':row['capacityMl'],'color':row['color'],'capColor':row['capColor'],'plateState':row['plate']['state'],'existingCapOff':bool(row['plate'].get('capOff')),'sizeHold':bool(row['plate'].get('sizeHold')),'approvedCapOnSha256':row['plate'].get('sha256'),'lineage':lineage,'sourceStatus':'source-matching-open','on':None,'off':None}
 try:
  if on:rec['on']=preview(on)
  if off:rec['off']=preview(off)
  rec['sourceStatus']='paired-master-previews' if rec['on'] and rec['off'] else 'capped-layer-inspection' if rec['on'] else 'uncapped-source-only' if rec['off'] else 'source-matching-open'
 except Exception as e:rec['sourceStatus']='source-verification-hold';rec['error']=str(e)
 output.append(rec)
summary=dict(collections.Counter(r['sourceStatus'] for r in output))
result={'generatedAt':datetime.now(timezone.utc).isoformat(),'ledgerAt':ledger['generatedAt'],'scope':'63 existing Cylinder plate reconciliation rows; original source preview retrieval only','masterRoot':str(MASTER),'summary':summary,'rows':output}
(OUT/'source-audit.json').write_text(json.dumps(result,indent=2)+'\n')
esc=html.escape
cards=[]
for r in output:
 if not r['off']:continue
 figures=[]
 for label,key in [('Master cap-on','on'),('Master cap-off','off')]:
  v=r[key]
  figures.append(f'<figure><figcaption>{label}</figcaption><img loading="lazy" src="{esc(v["preview"])}" alt="{esc(r["sku"]+" "+label)}"><small>{v["width"]} × {v["height"]} · original merged PSD</small></figure>' if v else f'<figure>{label}: mapping pending</figure>')
 cards.append(f'<article><h2>{r["capacityMl"]} mL · {esc(r["color"] or "Unknown")} · {esc(r["applicator"] or "Unresolved component")}</h2><p>{esc(r["itemName"] or r["sku"])}</p><small>{esc(r["sku"])}</small><div class="pair">{"".join(figures)}</div><details><summary>Source records</summary><p>{esc(str(r["on"]))}</p><p>{esc(str(r["off"]))}</p></details></article>')
page='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cylinder — recovered master cap-off sources</title><style>body{background:#f5f3ef;color:#27382f;font:15px/1.5 system-ui;max-width:1400px;margin:auto;padding:28px}h1{font:34px Georgia}h2{font-size:18px}article{background:white;border:1px solid #d0dbce;border-radius:8px;padding:20px;margin:22px 0;break-inside:avoid}.pair{display:grid;grid-template-columns:1fr 1fr;gap:24px}figure{margin:10px 0}img{display:block;width:100%;height:500px;object-fit:contain}small,details{font-size:12px;overflow-wrap:anywhere}details p{overflow-wrap:anywhere}.notice{padding:16px;background:#e7eee5;border:1px solid #c0d4c0}a{color:#31573f}</style><h1>Cylinder · recovered master cap-off sources</h1><p class="notice">Original Photoshop source previews. This is a retrieval sheet, not final resized plates or a release. Existing approved cap-on images are unchanged. Cap-off candidates still need registration to the approved glass position and exact-view review. No component has been generated or fabricated.</p>'''
page+=f'<p>{summary.get("paired-master-previews",0)} paired master sets, {summary.get("uncapped-source-only",0)} uncapped source only, {summary.get("capped-layer-inspection",0)} capped files needing layer inspection, and {summary.get("source-matching-open",0)} source mappings still open.</p>'+''.join(cards)
(OUT/'index.html').write_text(page)
print(json.dumps({'summary':summary,'rollerRows':sum(r['applicator'] in ['Metal Roller Ball','Plastic Roller Ball'] for r in output),'rollersWithOffSource':sum(r['applicator'] in ['Metal Roller Ball','Plastic Roller Ball'] and bool(r['off']) for r in output),'files':len(cache)},indent=2))
