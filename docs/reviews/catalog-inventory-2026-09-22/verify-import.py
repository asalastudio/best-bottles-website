import json,sys,copy,gzip
from pathlib import Path
p=Path(__file__).parent
before={r['id']:r for r in json.load(gzip.open(p/'import-before.json.gz','rt'))['rows']}
filename=sys.argv[1] if len(sys.argv)>1 else 'import-after.json.gz';after_doc=json.load(gzip.open(p/filename,'rt'));after={r['id']:r for r in after_doc['rows']}
ids={r['shopifyVariantId'] for r in json.load(open(p.parent/'catalog-orderability-2026-09-22/verified-current-catalog.json'))['variants']}; ids={i if str(i).startswith('gid://') else 'gid://shopify/ProductVariant/'+str(i) for i in ids}
errors=[];complete=[];unchanged=0
for id,b in before.items():
 a=after.get(id)
 if a is None:errors.append({'id':id,'error':'missing variant'});continue
 if id not in ids:
  if a!=b:errors.append({'id':id,'error':'excluded variant changed'})
  else:unchanged+=1
  continue
 q={v['name']:v['quantity'] for v in a['inventoryItem']['inventoryLevel']['quantities']}
 if not(a['product']['status']=='ACTIVE' and a['inventoryItem']['tracked'] and q['available']==1000 and q['on_hand']==1000):errors.append({'id':id,'sku':a['sku'],'error':'inventory not ready','tracked':a['inventoryItem']['tracked'],'quantities':q})
 else:complete.append(id)
 def stable(r):
  r=copy.deepcopy(r);r.pop('inventoryQuantity');r['inventoryItem'].pop('tracked');r['inventoryItem']['inventoryLevel'].pop('quantities');return r
 if stable(a)!=stable(b):errors.append({'id':id,'error':'noninventory field changed'})
extra=set(after)-set(before)
if extra:errors.append({'error':'unexpected new variants','ids':sorted(extra)})
report={'checkedAt':after_doc['checkedAt'],'approvedVariants':len(ids),'verifiedActiveTracked1000':len(complete),'excludedUnchanged':unchanged,'beforeVariants':len(before),'afterVariants':len(after),'errors':errors,'pass':len(errors)==0}
json.dump(report,open(p/'recheck-verification.json','w'),indent=2)
print(json.dumps({k:v if k!='errors' else v[:8] for k,v in report.items()},indent=2));print('errorCount',len(errors))
