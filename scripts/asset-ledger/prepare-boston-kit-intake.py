import json,hashlib,shutil
from pathlib import Path
root=Path.cwd(); master=Path('/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master');review=Path('/Users/jordanrichter/.codex/visualizations/2026/09/09/01a083e8-52fb-7dc3-bb73-4af44d38cf7f/plates-kits-heroes-handoff/hero-reviews/catalog-kit-candidates-2026-09-08-r7')
ledger=json.loads((root/'src/lib/asset-ledger/ledger.json').read_text()); prep={r['sku']:r for r in json.loads((root/'data/asset-ledger/boston-plate-completion.json').read_text())['rows']};cards={r['sku']:r for r in json.loads((review/'data.json').read_text())}; sources={r['websiteSku']:r for r in json.loads((root/'data/paper-doll/catalog-master-kit-candidates-addendum-2026-09-08.json').read_text())['rows']}
assets=root/'public/images/boston-kit-review';assets.mkdir(parents=True,exist_ok=True)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def copy(url,expected=None):
 p=review/'assets'/Path(url).name; h=sha(p); assert not expected or h==expected
 dest=assets/(h+p.suffix);shutil.copyfile(p,dest);return {'url':'/images/boston-kit-review/'+dest.name,'sha256':h}
rows=[]
for r in ledger['rows']:
 if r['family']!='Boston Round':continue
 row={k:r.get(k) for k in ['sku','graceSku','capacityMl','color','applicator','capColor','itemName','groupSlug']};row.update({'kitState':r['kit']['state'],'reason':r['kit'].get('reason'),'lane':'prepare','images':[]})
 if r['kit']['state']=='candidate':
  c=cards[r['sku']];source=sources[r['sku']];assert sha(master/source['sourcePath'])==source['sourceSha256'];assert c['plateSha256']==r['plate']['sha256'];assert c['assetSha256']==r['kit']['candidate']['sha256']
  row.update({'lane':'realign' if r['sku'] in prep else 'reuse','images':[{'label':'Current indexed plate',**copy(c['priorUrl'],c['plateSha256'])},{'label':'Existing kit reconstruction',**copy(c['url'],c['assetSha256'])},{'label':'Existing separated-parts preview',**copy(c['sourcePreview'])}],'sourcePath':source['sourcePath'],'sourceSha256':source['sourceSha256'],'plateSha256':c['plateSha256'],'priorGates':source['gates'],'reviewNotes':c['reviewNotes'],'componentFilesValidated':False})
 if r['applicator']=='Dropper' or (r['applicator']=='N/A' and r['sku']=='GBBstn15BlkDrp'):
  row['presentation']='assembled-only'
  row['presentationReason']='Jordan approved assembled-only dropper presentation. Swap the complete photographed configuration; no exploded or cap-off view, and no fabricated pipette. The historical separated preview is retained as evidence only.'
 if r['applicator'] in ['Metal Roller Ball','Plastic Roller Ball']:
  row['presentation']='roller-seated'
  row['presentationReason']='Jordan confirmed the source insert is cropped at its seat. Keep the roller installed in the glass; use the matching cap-off photograph for cap removal. No floating roller or fabricated lower plug.'
 if r['sku'] in ['GBBstnAmb1ozMtlRollonMattBlk','GBBstnAmb1ozMtlRollonMattSl','GBBstnAmb1ozRollonMattBlk','GBBstnAmb1ozRollonMattSl']:
  row['componentConcern']='The saved metal and plastic configurations share identical separated-parts preview bytes. Verify the exposed roller against each approved source pair before reusing this kit.'
 rows.append(row)
assert len(rows)==123;assert sum(r['lane']=='reuse' for r in rows)==21;assert sum(r['lane']=='realign' for r in rows)==4
out={'schemaVersion':1,'family':'Boston Round','ledgerAt':ledger['generatedAt'],'policy':'Existing review images and master hashes verified. Historical extraction gates are not fresh component-file validation. No kit approvals or publication. Reuse the 21 candidates on preserved plates first; realign four against corrected plates; resolve the remaining 98 by exact master parts.','rows':rows}
(root/'data/asset-ledger/boston-kit-intake.json').write_text(json.dumps(out,indent=2)+'\n');print({'scope':123,'reuseFirst':21,'realign':4,'prepare':98,'newKits':0,'approvals':0})
