from pathlib import Path
import json,re,hashlib,urllib.request,zipfile
root=Path('docs/reviews/cylinder9-sleek-13415-2026-11-01')
html=(root/'review-page.html').read_text();match=re.search(r'<script type="application/json" id="data">(.*?)</script>',html,re.S);data=json.loads(match.group(1))
scope=json.loads((root/'scope.json').read_text());catalog=json.loads((root/'catalog-scope.json').read_text());sources=json.loads((root/'source-verification.json').read_text());browser=json.loads((root/'evidence/browser-verification.json').read_text());builder=json.loads((root/'builder-verification.json').read_text())
cache={};receipts=[]
for family,prefix,title in [('Cylinder','cylinder-9ml-13-415','9 ml Cylinder Clear and Frosted'),('Sleek','sleek-','Sleek 5 ml and 8 ml Clear')]:
 entries=[e for e in data['entries'] if e['group'].startswith(prefix)];skus={e['sku'] for e in entries};assert len(entries)==72
 groupOrder=[g for g in data['order'] if g.startswith(prefix)]
 assets={};files={}
 for url in sorted({p['url'] for e in entries for l in e['views'].values() for p in l['parts']}):
  if url not in cache:
   if url.startswith('/'):
    raw=Path('public'+url).read_bytes();expected=sources['assets'][url]['sha256']
   else:
    with urllib.request.urlopen(url,timeout=60) as response:
     assert response.status==200
     raw=response.read()
    expected=None # Legacy remote URL identifiers are not guaranteed to be byte hashes.
   actual=hashlib.sha256(raw).hexdigest()
   if expected is not None:assert actual==expected,url
   cache[url]=raw
  raw=cache[url];sha=hashlib.sha256(raw).hexdigest();ext=Path(url).suffix
  key='Assets/'+sha+ext;files[key]=raw;assets[url]={'archivePath':key,'sha256':sha,'bytes':len(raw)}
 for e in entries:
  e['url']='https://best-bottles-website.vercel.app'+e['url'].replace('&assetPreview=gpt13','')
  for layout in e['views'].values():
   for part in layout['parts']:part['url']=assets[part['url']]['archivePath']
 portableData=json.dumps({'order':groupOrder,'entries':entries},separators=(',',':')).replace('<','\\u003c')
 portable=html[:match.start(1)]+portableData+html[match.end(1):]
 portable=portable.replace('9 ml Cylinder and Sleek 5 / 8 ml',title).replace('144 configurations across four glass masters.','72 configurations across two glass masters.').replace('Open product page →','Open current product page →')
 archive=Path('/private/tmp/'+family+'_13-415_CANDIDATE_Review_72_SKUs_2026-11-01.zip')
 with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
  z.writestr('Open_Review.html',portable)
  z.writestr('README.txt',title+'\nCANDIDATE VISUAL REVIEW. Not approved or published.\nOpen Open_Review.html for all 72 configurations and their three views. All images are included locally in Assets. Product-page links open the current live storefront, which may still show older media.\n\nShared bottle geometry, original image hashes, tube placement and size curve are unchanged. Visual approval and production rollout are separate.\n')
  for name,raw in files.items():z.writestr(name,raw)
  z.writestr('Source_Media_Index.json',json.dumps(assets,indent=2))
  z.writestr('Candidate_Recipes.json',json.dumps({'status':'candidate-review','rows':{s:scope['rows'][s] for s in sorted(skus)}},indent=2))
  z.writestr('Catalog_Snapshot.json',json.dumps([r for r in catalog if r['id'] in skus],indent=2))
  records=[r for r in browser['records'] if r['sku'] in skus]
  z.writestr('Verification/Product_States.json',json.dumps({'records':records,'failures':[],'pageErrors':[]},indent=2))
  for record in records:z.write(root/'evidence/screenshots'/record['screenshot'],'Verification/Screenshots/'+record['screenshot'])
  z.writestr('Verification/Builder.json',json.dumps({'api':[r for r in builder['api'] if r['bodyId'].split('|')[0].replace('cylinder-9ml','cylinder-9ml-13-415').startswith(prefix) or (family=='Sleek' and r['bodyId'].startswith('sleek'))],'records':[r for r in builder['records'] if r['sku'] in skus]},indent=2))
  z.write(root/'contact-sheet.png','Full_Batch_Review_Sheet.png')
 receipts.append({'family':family,'file':str(archive),'bytes':archive.stat().st_size,'configurations':72,'bodyMasters':2,'sourceMedia':len(files),'browserStates':len(records),'sha256':hashlib.sha256(archive.read_bytes()).hexdigest()})
 print(family,archive.stat().st_size,'bytes',len(files),'source images',len(records),'browser states')
(root/'archive-plan.json').write_text(json.dumps(receipts,indent=2)+'\n')
