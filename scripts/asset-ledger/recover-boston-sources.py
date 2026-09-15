"""Recover master-source previews using exact product-page image associations.
Does not modify PSDs, create production plates, infer identity from SKU spelling,
clear holds, publish, or grant approvals. Filenames locate candidates only.
"""
import json, re, hashlib, pathlib, urllib.request, urllib.parse, concurrent.futures, io, threading
from PIL import Image
from datetime import datetime, timezone
from psd_tools import PSDImage
ROOT=pathlib.Path(__file__).resolve().parents[2]
MASTER=pathlib.Path('/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master').resolve()
OUT=ROOT/'docs/reviews/boston-source-recovery-2026-09-12'
if (ROOT/'data/asset-ledger/boston-source-approvals.json').exists():
 raise RuntimeError('This recovery set has recorded approval. Prepare a separate revision; do not replace reviewed evidence.')
PUBLIC=ROOT/'public/images/boston-source-recovery'
PUBLIC.mkdir(parents=True,exist_ok=True)
ledger=json.loads((ROOT/'src/lib/asset-ledger/ledger.json').read_text())
missing=[r for r in ledger['rows'] if r['productRecord'] and r['family']=='Boston Round' and r['plate']['state']=='none']
files=[p for p in MASTER.rglob('*') if p.suffix.lower()=='.psd']
def clean(p): return re.sub(r'^\d+\.\s*','',p.stem).strip().lower()
index={}
for f in files:index.setdefault(clean(f),[]).append(f)
def sha(b):return hashlib.sha256(b).hexdigest()
preview_lock=threading.Lock()
def recover(r):
 result={'sku':r['sku'],'graceSku':r['graceSku'],'productGroupId':r['productGroupId'],'capacityMl':r['capacityMl'],'color':r['color'],'applicator':r['applicator'],'capColor':r['capColor'],'itemName':r['itemName'],'status':'source_matching_pending','references':[],'candidates':[],'holds':['Not a finished plate: source identity, physical sizing and technical review are still required.']}
 evidence=OUT/'legacy'/f"{r['sku']}.json"
 if not evidence.exists():result['error']='Current product page retrieval is pending.';return result
 raw=evidence.read_bytes();payload=json.loads(raw);body=json.loads(payload['result']['content'][0]['text']);md=body.get('markdown','')
 result.update(productUrl=payload['requested']['url'],evidenceSha256=sha(raw),retrievedAt=payload['retrievedAt'])
 ids=re.findall(r'^#\s+(\S+)\s*$',md,re.M)
 exact=r['sku'] in ids and f"**Item Name:** {r['sku']}" in md
 result['exactPageSkuVerified']=exact
 if not exact:result['error']='The returned product identity does not match this exact SKU.';return result
 result['pageDescription']=(re.findall(r'\*\*Item Description:\*\*\s*([^\n]+)',md)or[''])[0]
 urls=list(dict.fromkeys(u for u in re.findall(r'!\[[^\]]*\]\(([^)]+)\)',md) if '/images/store/enlarged_pics/' in u or '/images/store/capped/' in u))
 candidates={}
 for url in urls:
  parsed=urllib.parse.urlparse(url)
  if parsed.scheme!='https' or parsed.hostname not in ['www.bestbottles.com','bestbottles.com']:continue
  stem=pathlib.Path(urllib.parse.unquote(parsed.path)).stem.lower()
  ref={'sourceUrl':url,'linkedFromExactSku':r['sku']}
  try:
   with urllib.request.urlopen(url,timeout=30)as response:b=response.read()
   suffix=pathlib.Path(parsed.path).suffix.lower();digest=sha(b);dest=PUBLIC/(digest+suffix);dest.write_bytes(b);ref.update(sha256=digest,url='/images/boston-source-recovery/'+dest.name)
  except Exception as e:ref['error']=str(e)
  result['references'].append(ref)
  for source in index.get(stem,[]):candidates[str(source)]=source
 for source in candidates.values():
  try:
   if not source.resolve().is_relative_to(MASTER):raise ValueError('Outside master root')
   raw=source.read_bytes();psd=PSDImage.open(source);preview=psd.topil()
   if preview is None:raise ValueError('No merged preview; inspect original layers')
   dest=PUBLIC/(sha(raw)+'.png')
   # A PSD may be referenced more than once. Preserve the first complete export;
   # generated ICC profile timestamps must not overwrite reviewed PNG bytes.
   with preview_lock:
    if dest.exists():
     existing=Image.open(dest)
     if existing.mode!=preview.mode or existing.size!=preview.size or existing.tobytes()!=preview.tobytes():raise ValueError('Existing preview differs; prepare a new review candidate')
    else:
     buffer=io.BytesIO();preview.save(buffer,format='PNG')
     with dest.open('xb') as fp:fp.write(buffer.getvalue())
    png=dest.read_bytes()
   result['candidates'].append({'sourcePath':str(source.relative_to(MASTER)),'sourceSha256':sha(raw),'url':'/images/boston-source-recovery/'+dest.name,'sha256':sha(png),'width':preview.width,'height':preview.height,'layers':[{'name':layer.name,'visible':layer.visible,'kind':layer.kind} for layer in psd],'method':'Original PSD merged preview; no resizing, layer changes or shadow edits.'})
  except Exception as e:result['holds'].append(str(e))
 result['status']='master_candidates_recovered' if result['candidates'] else 'source_matching_pending'
 return result
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:results=list(pool.map(recover,missing))
out={'schemaVersion':1,'family':'Boston Round','generatedAt':datetime.now(timezone.utc).isoformat(),'masterRoot':str(MASTER),'masterFilesSearched':len(files),'scope':'33 currently unplated catalog SKUs; candidate recovery only.','rows':results}
(OUT/'recovery.json').write_text(json.dumps(out,indent=2))
(ROOT/'data/asset-ledger/boston-source-recovery.json').write_text(json.dumps(out,indent=2))
print(json.dumps({'rows':len(results),'exactPages':sum(bool(r.get('exactPageSkuVerified')) for r in results),'withCandidates':sum(bool(r['candidates']) for r in results),'candidateViews':sum(len(r['candidates']) for r in results),'unresolved':[{'sku':r['sku'],'error':r.get('error')} for r in results if not r['candidates']]},indent=2))
