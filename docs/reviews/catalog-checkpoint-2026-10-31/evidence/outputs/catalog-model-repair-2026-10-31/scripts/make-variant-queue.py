from pathlib import Path
import json,re
r=Path('/Users/jordanrichter/Projects/Asala/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/.claude/worktrees/branch-setup-localhost-c1fea9/outputs/catalog-model-repair-2026-10-31')
rows=json.loads((r/'sources/catalog-production.json').read_text())['rows'];prior={a['sku']:a for a in json.loads((r/'reports/per-sku-defects.json').read_text())};q=json.loads((r/'sources/audit-queue.json').read_text());jobs={};mapping=[]
def slug(s):return re.sub('[^a-z0-9-]+','-',s.lower()).strip('-')
spray={'Matte Black':'matte-black','Shiny Black':'shiny-black','Shiny Gold':'gold','Gold':'gold','Shiny Silver':'shiny-silver','Matte Silver':'matte-silver','Matte Copper':'matte-copper','Matte Gold':'matte-gold','Matte Blue':'blue-matte','Turquoise':'blue-matte','Black':'matte-black'}
for a in rows:
 sku=a.get('websiteSku') or a.get('graceSku');
 if sku not in prior:continue
 old=prior[sku];bid=old['bodyId'];glass=a.get('color');fam=None;shoulder=None;pct=None
 if bid=='flair-15ml-13-415':fam='flair';shoulder=52.2;pct=40.57057887394332
 elif bid=='sleek-5ml-13-415':fam='sleek5';shoulder=34;pct=30
 elif bid=='tulip-5ml-13-415':fam='tulip5';shoulder=34;pct=32.97
 if fam:
  path=r/'working/priority-assemblies'/fam/'model-fit-v8.blend';groupSource=next(x for x in q if 'clear_STUDIO-v1.5' in x['id']);label='priority-'+fam
 elif bid in ['cylinder-5ml-13-415','cylinder-9ml-13-415']:
  matches=[x for x in q if ('cyl5-' in x['id'] if '5ml' in bid else 'tall-9ml-' in x['id']) and (('cobalt' if glass=='Cobalt Blue' else 'frosted' if glass=='Frosted' else 'clear')+'_STUDIO') in x['id']]
  if not matches:continue
  groupSource=matches[0];d=r/'working/native'/groupSource['id'];path=d/'model-fit-v8.blend';label=('cyl5' if '5ml' in bid else 'tall9')+'-'+slug(glass);shoulder=42.12 if '5ml' in bid else 94.49
 else:continue
 available={c for o in json.loads((r/'audit/models-v2'/(groupSource['id']+'.json')).read_text())['objects'] for c in o['collections'] if c.startswith('Sheet | ')}
 app=a.get('applicator') or '';color=a.get('capColor') or '';style=a.get('capStyle') or '';groups=[];extra=[];notes=[]
 if app=='Fine Mist Sprayer':
  fin=spray.get(color)
  if not fin:
   item=(a.get('itemName') or '').lower();resolved=next((k for k in spray if k.lower()+' spray' in item),None)
   if resolved:fin=spray[resolved];notes.append('Catalog capColor is '+color+'; exact SKU description specifies '+resolved)
  if fin:groups=['Sheet | internals','Sheet | spray-'+fin];extra=[('covered-'+fin,['Sheet | internals','Sheet | spray-'+fin,'Sheet | covered-'+fin])]
 elif 'Roller Ball' in app:
  roller='roller-metal' if app.startswith('Metal') else 'roller-plastic';groups=['Sheet | '+roller]
  c=slug(color.replace(' with Dots',' Dotted'));c='copper' if c=='matte-copper' else c
  extra=[('cap-'+c,['Sheet | cap-'+c])]
 elif style=='Minaret':notes.append('No source-qualified Minaret closure in the native 13-415 fitment sheet')
 else:
  c=slug(color.replace('Short ','').replace('Regular ',''))
  if 'Sht' in sku and c in ['clear','amber']:c='black';notes.append('Catalog capColor incorrectly contains glass color; exact SKU name and legacy URL specify short black cap')
  if 'ribbed-' in c:c=c.replace('ribbed-','')
  if c in ['black','white']:groups=['Sheet | short-'+c]
  elif style=='Tall' or color.startswith('Regular '):groups=['Sheet | cap-'+('shiny-'+c if c in ['gold','silver'] else c)]
  elif c in ['matte-copper','matte-gold','matte-silver','shiny-black','shiny-gold','shiny-silver']:groups=['Sheet | liner-'+c]
  else:notes.append('Closure finish needs source reconciliation: '+color+'/'+style)
 refs=[]
 variants=[(slug(groups[-1].replace('Sheet | ','')),groups)] if groups else []
 variants+=extra
 for view,gs in variants:
  if not set(gs)<=available:notes.append('Missing native collection: '+', '.join(set(gs)-available));continue
  ident=label+'--'+view
  job={'id':ident,'workingCopy':str(path),'groups':gs,'view':'spray' if any('spray-' in g for g in gs) else view,'shoulderMm':shoulder,'skus':[],'bodyId':bid,'glass':glass,'acceptance':'visual-production reconstruction' if fam else 'source-native geometry'}
  if pct:job['targetPct']=pct
  jobs.setdefault(ident,job)['skus'].append(sku);refs.append(ident)
 mapping.append({'sku':sku,'bodyId':bid,'renderIds':refs,'notes':notes,'source':str(path)})
(r/'sources/variant-render-queue.json').write_text(json.dumps(list(jobs.values()),indent=2));(r/'sources/sku-variant-map.json').write_text(json.dumps(mapping,indent=2));print('JOBS',len(jobs),'SKUS',len(mapping),'no render',sum(not x['renderIds'] for x in mapping))
