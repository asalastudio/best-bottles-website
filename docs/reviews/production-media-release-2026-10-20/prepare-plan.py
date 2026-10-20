"""Prepare a non-executable media release inventory. Performs local reads/writes only."""
from pathlib import Path
import json,hashlib,csv,sys,collections
repo=Path(__file__).resolve().parents[3];out=Path(__file__).resolve().parent
sha=lambda b:hashlib.sha256(b).hexdigest()
canonical=lambda x:json.dumps(x,sort_keys=True,separators=(',',':')).encode()
groups={
 'empire':('empire-completion-pilot',['local-empire-catalog-hero.json','local-empire-additional-catalog-heroes.json'],14),
 'round78-spray':('round78-spray-completion',['local-round78-pilot-catalog-heroes.json','local-round78-additional-catalog-heroes.json'],12),
 'round78-lotion':('round78-lotion-completion',['local-round78-lotion-pilot-catalog-heroes.json','local-round78-lotion-additional-catalog-heroes.json'],14),
 'diva46-spray':('diva46-spray-completion',['local-diva46-pilot-catalog-heroes.json','local-diva46-additional-catalog-heroes.json'],12),
}
if len(sys.argv)>1:
 source=Path(sys.argv[1]);assemblies={};evidence=[]
 preservation=json.loads((repo.parent/'preservation-manifest.json').read_text())
 expected={r['path']:r['sha256'] for r in preservation['files']}
 for group,(folder,_,count) in groups.items():
  p=source/folder/'kits.json';b=p.read_bytes();key='working/output/'+folder+'/kits.json'
  assert sha(b)==expected[key],key
  rows=json.loads(b);assert len(rows)==count
  for r in rows:
   sku=r['row']['websiteSku'];assert r['kit']['sku']==sku
   assemblies[sku]=r['kit']
  evidence.append({'group':group,'archivedPath':key,'sourceSha256':sha(b)})
 (out/'captured-assemblies.json').write_text(json.dumps(assemblies,indent=2)+'\n')
 (out/'capture-sources.json').write_text(json.dumps(evidence,indent=2)+'\n')
else:assemblies=json.loads((out/'captured-assemblies.json').read_text())
rows=[];assets={};localUses=collections.defaultdict(set)
def asset(url,sku,expected=None):
 if not url.startswith('/local-media/'):return
 p=repo/'public'/url.lstrip('/');b=p.read_bytes();h=sha(b)
 if expected:assert expected==h,(sku,url)
 assets[url]={'path':str(p.relative_to(repo)),'url':url,'sha256':h,'bytes':len(b),'hostedUrl':None,'uploaded':False}
 localUses[url].add(sku)
for group,(folder,files,count) in groups.items():
 heroes=[]
 for f in files:
  d=json.loads((repo/'src/lib/products'/f).read_text());heroes += d if isinstance(d,list) else [d]
 assert len(heroes)==count
 for h in heroes:
  sku=h['websiteSku'];kit=assemblies[sku]
  assert not any(p['slot']=='ring' for p in kit['parts']),sku
  asset(h['url'],sku)
  for part in kit['parts']:
   for field in ['image','image2x','mask']:
    image=part.get(field)
    if image:asset(image['url'],sku,image.get('sha256'))
  is_lotion_pair=group=='round78-lotion' and sku in ['LBRnd78LtnShnSl','LBRndFrst78LtnShnSl']
  visual='accepted-in-conversation' if group!='round78-lotion' or is_lotion_pair else 'pending-final-visual-approval'
  gate='source-fit-verification' if group=='diva46-spray' else ('final-visual-approval' if visual.startswith('pending') else 'technical-release-preparation')
  batch='1-empire-canary' if sku in ['GBEmp50SpryMtGl','GBEmp100SpryMtGl'] else {'empire':'2-empire-remaining','round78-spray':'3-round78-sprays','round78-lotion':'4-round78-lotion-after-approval','diva46-spray':'5-diva46-after-source-fit'}[group]
  rows.append({'websiteSku':sku,'graceSku':h['graceSku'],'groupSlug':h['groupSlug'],'group':group,'batch':batch,'bottleColor':h['bottleColor'],'capacityMl':h['capacityMl'],'description':h['alt'],'catalog':{'localUrl':h['url'],'sha256':assets[h['url']]['sha256'],'width':h['width'],'height':h['height'],'hostedUrl':None},'assemblySha256':sha(canonical(kit)),'plateKey':kit['register']['plateKey'],'componentIds':kit['register']['componentIds'],'visualApproval':visual,'remainingGate':gate,'approvedForProduction':False,'requiresRing':False})
assert len(rows)==52 and len({r['websiteSku'] for r in rows})==52 and set(assemblies)=={r['websiteSku'] for r in rows}
for url,a in assets.items():a['usedBySkus']=sorted(localUses[url])
plan={'kind':'planning-inventory-not-publisher-input','executable':False,'productionWritesAuthorized':False,'scopeCount':52,'proposedFirstCanary':['GBEmp50SpryMtGl','GBEmp100SpryMtGl'],'sourceIntegrationCommit':'8312ccfc','releaseRevision':None,'productionTarget':None,'rollbackSnapshot':None,'rows':sorted(rows,key=lambda r:(r['batch'],r['websiteSku'])),'localAssets':sorted(assets.values(),key=lambda a:a['path'])}
(out/'release-plan.json').write_text(json.dumps(plan,indent=2)+'\n')
with (out/'sku-approval-ledger.csv').open('w',newline='') as f:
 fields=['websiteSku','group','batch','description','visualApproval','remainingGate','approvedForProduction','requiresRing'];w=csv.DictWriter(f,fields,lineterminator="\n");w.writeheader();w.writerows({k:r[k] for k in fields} for r in plan['rows'])
summary={'scopeSkus':len(rows),'localAssetsVerified':len(assets),'catalogImagesVerified':52,'capturedAssembliesPinned':len(assemblies),'ringAssemblies':0,'visualAccepted':sum(r['visualApproval']=='accepted-in-conversation' for r in rows),'visualPending':sum(r['visualApproval']!='accepted-in-conversation' for r in rows),'divaSourceFitHeld':12,'uploaded':0,'productionActivated':0}
(out/'plan-verification.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary))
