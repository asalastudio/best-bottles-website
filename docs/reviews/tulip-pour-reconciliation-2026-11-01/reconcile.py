import json,pathlib,hashlib,csv
root=pathlib.Path('docs/reviews/tulip-pour-reconciliation-2026-11-01');read=lambda p:json.load(open(p))
current=[r for color in ['amber','clear'] for r in read(root/(color+'-bodies.json'))['configurations'] if r['fitment']=='Screw Cap']
legacy=read(root/'legacy-products.json');lm={r['sku']:r for r in legacy};kits=read('public/local-kits/remaining-13-415-2026-11-01/kits.json')['rows'];ref=read('public/local-kits/tulip-shoulder-2026-11-01/kits.json')['rows'];five=read('public/local-kits/cylinder5-masters-2026-11-01/kits.json')['rows']
masters={(p['slot'],p.get('componentId')):p for k in five.values() for p in k['parts'] if p['slot']=='cap'}
rows={};records=[]
for c in current:
 sku=c['id'];assert sku in lm;kit=kits[sku];reference=ref['GBTulipAmb5SpryBlkSh' if c['color']=='Amber' else 'GBTulip6SpryBlkSh'];body=next(p for p in kit['parts'] if p['slot']=='body');assert body==next(p for p in reference['parts'] if p['slot']=='body');assert kit['glassSizing']==reference['glassSizing'];cap=next(p for p in kit['parts'] if p['slot']=='cap');ribbed=cap['componentId'] in ['CMP-CAP-BLK-S-13-415','CMP-CAP-WHT-S-13-415'];native=next(k for k in read(root/('amber-kits.json' if c['color']=='Amber' else 'clear-kits.json'))['kits'].values() if k['sku']==sku);originalCap=next(p for p in native['parts'] if p['slot']=='cap')
 if ribbed:
  assert cap['image']['url']==originalCap['image']['url'];assert cap['bounds']['bottom']==originalCap['bounds']['bottom'];status='native-ribbed-artwork-and-vertical-seating-preserved'
 else:
  assert cap['image']['sha256']==masters[('cap',cap['componentId'])]['image']['sha256'];assert abs(cap['bounds']['bottom']-kit['glassSizing']['landmarkY']-16.3)<1e-7;status='shared-approved-13-415-cap-source-and-Tulip-shoulder-registration'
 rows[sku]=kit;records.append({'sku':sku,'glass':c['color'],'finish':c['closure'],'legacyUrl':lm[sku]['url'],'componentId':cap['componentId'],'bodySha256':body['image'].get('sha256'),'bodyUrl':body['image']['url'],'capSha256':cap['image'].get('sha256'),'status':status,'capBottom':cap['bounds']['bottom'],'bodyAndSizingMatchApprovedSprayer':True})
assert len(rows)==19;missing=sorted(set(lm)-set(rows));assert missing==['GBTulip6BlkShSht']
report={'status':'reconciled-with-explicit-identity-exception','legacyVariants':20,'currentBuilderVariants':19,'registeredReviewVariants':19,'records':records,'exceptions':[{'sku':missing[0],'legacyUrl':lm[missing[0]]['url'],'reason':'The exact catalog product exists, but its included short shiny-black cap has no verified current component association. No current exact PSD match was recovered in the canonical master tree. Retain the exact legacy source and existing product route; do not substitute a different cap or remove the SKU.','action':'Resolve the short shiny-black component identity before listing or publishing this assembly.'}]}
(root/'reconciliation.json').write_text(json.dumps(report,indent=2)+'\n');(root/'kits.json').write_text(json.dumps({'rows':rows},indent=2)+'\n');(root/'catalog.json').write_text(json.dumps(current,indent=2)+'\n')
with open(root/'reconciliation.csv','w') as f:
 w=csv.DictWriter(f,fieldnames=['sku','glass','finish','componentId','legacyUrl','status'],lineterminator='\n');w.writeheader()
 for r in records:w.writerow({k:r[k] for k in w.fieldnames})
 w.writerow({'sku':missing[0],'glass':'Clear','finish':'Short Shiny Black','legacyUrl':lm[missing[0]]['url'],'status':'component-identity-hold'})
print('Tulip reconciled: 20 legacy variants; 19 registered; one exact source-identity exception')
