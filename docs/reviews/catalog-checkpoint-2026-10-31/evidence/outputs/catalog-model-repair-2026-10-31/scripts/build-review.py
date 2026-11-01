from pathlib import Path
import json,csv,collections,re,html
r=Path('/Users/jordanrichter/Projects/Asala/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/.claude/worktrees/branch-setup-localhost-c1fea9/outputs/catalog-model-repair-2026-10-31')
def read(p,default=None):
 try:return json.loads(p.read_text())
 except (FileNotFoundError,json.JSONDecodeError):return default
def latest(d):
 f=d/'repair-report.json'
 for n in range(2,16):
  c=d/f'repair-report-v{n}.json'
  if c.exists() and read(c).get('disposition')!='rejected refinement' and not(n==2 and 'ANSP_BULB' in str(c)):f=c
 return read(f,{}),f

def description(value):
 if isinstance(value,str):return value
 if isinstance(value,dict) and 'maxInteriorReliefMm' in value:return value['object']+': matched the internal cavity to the actual neck; maximum relief '+str(round(value['maxInteriorReliefMm'],3))+' mm, minimum wall '+str(round(value['minWallMm'],3))+' mm. Exterior dimensions retained.'
 return json.dumps(value,ensure_ascii=False)

q=read(r/'sources/audit-queue.json');old=read(r/'reports/per-sku-defects.json');cat=read(r/'sources/catalog-production.json')['rows'];bySku={a.get('websiteSku') or a.get('graceSku'):a for a in cat};photos={a['sku']:a for a in read(r/'audit/catalog-before-images-v2.json',read(r/'audit/catalog-before-images.json'))};vmap={a['sku']:a for a in read(r/'sources/sku-variant-map.json',[])};vqueue={a['id']:a for a in read(r/'sources/variant-render-queue.json',[])}
for vm in vmap.values():
 current,_=latest(Path(vm['source']).parent)
 if current.get('workingCopy'):vm['source']=current['workingCopy']
models={};bodySources=collections.defaultdict(set)
for a in old:
 if a.get('bodyId'):bodySources[a['bodyId']].update(a['modelIds'])
for a in q:
 ident=a['id'];d=r/'working'/('native' if a['kind']=='blend' else 'legacy')/ident;rp=d/'repair-report.json'
 for n in [2,3,4,5,6,7,8,9,10,11,12,13,14,15]:
  f=d/f'repair-report-v{n}.json'
  if f.exists() and not(n==2 and 'ANSP_BULB' in ident) and read(f).get('disposition')!='rejected refinement':rp=f
 rep=read(rp,{});audit=read(r/'audit/models-v2'/(ident+'.json'),{});notes=[]
 if a['kind']=='glb':
  notes.append('Legacy geometry; no exact-SKU assembled scene or thread-contact qualification established.')
  if ident.startswith('glb-bodies__') and not any(ch.get('code')=='BODY-PROFILE-SOURCE' for ch in rep.get('changes',[])) and not any(t in ident for t in ['53x17','70x20','TallCyl','Flair']):notes.append('Body follows a traced silhouette. Dimensions, shoulder detail and inferred interior need comparison with a physical sample or drawing.')
  if any(t in ident for t in ['Atom-round','Clr-round-na','Heart-boxy','LotionPumpBl','Rect-boxy-13-415-50','Slm-boxy-18-415-121','V-round-13-425-22','dPlsBlkPls']):notes.append('Source silhouette combines or obscures the neck/closure; a cavity operation does not establish a correct open bottle or fitted assembly. Keep on hold.')
  if 'ANSP_BULB' in ident:notes.append('Collar reconstructed within the source envelope; inner wall and aperture are inferred. Full antique assembly and internal tube fit remain unqualified.' if 'v6' in rp.name else 'Torn sculpted collar remains; the full voxel remesh was rejected.')
  if ('PMP_SPOUT' in ident or 'SPR_NOZZLE' in ident) and 'v8' not in rp.name:notes.append('Circular component remains faceted.')
  if 'SPR_ACTUATOR' in ident:notes.append('Legacy actuator external recipe retained; a matching complete native assembly remains the preferred SKU source.')
 before=r/'renders/before'/('geometry-native-v2' if a['kind']=='blend' else 'geometry')/(ident+'.png')
 if a['kind']=='blend':after=r/'renders/after/geometry-native'/(ident+'.png')
 else:
  after=d/'geometry-after.png'
  for n in [2,3,4,5,6,7,8,9,10,11,12,13,14,15]:
   cand=d/f'geometry-after-v{n}.png';repf=d/f'repair-report-v{n}.json'
   if cand.exists() and not(n==2 and 'ANSP_BULB' in ident) and read(repf,{}).get('disposition')!='rejected refinement':after=cand
 selectedImage=r/'renders/after/geometry-selected'/(ident+'.png')
 if selectedImage.exists():after=selectedImage
 models[ident]={'id':ident,'kind':a['kind'],'source':a['path'],'sourceSha256':a['sha256'],'repairReport':str(rp.relative_to(r)),'workingCopy':rep.get('workingCopy'),'changes':[{**c,'detail':description(c.get('detail',''))} for c in rep.get('changes',[])],'checks':rep.get('checks',[]),'inferred':rep.get('inferred',[]),'unresolved':rep.get('unresolved',[])+notes,'beforeGeometry':str(before.relative_to(r)),'afterGeometry':str(after.relative_to(r)),'sourceAudit':str((r/'audit/models-v2'/(ident+'.json')).relative_to(r)),'sourceFindings':[{'object':o['name'],'findings':o.get('findings',[])} for o in audit.get('objects',[]) if o.get('findings')]}
# Select source scenes by glass and applicator where there is a meaningful match; family membership alone is never exact-SKU proof.
def match_native(a,ids):
 glass={'Clear':'clear','Amber':'amber','Cobalt Blue':'cobalt','Frosted':'frosted'}.get(a.get('glass'),'');app=a.get('applicator') or '';cc=(bySku.get(a['sku'],{}).get('capColor') or '').lower();hits=[]
 for ident in ids:
  if 'dispenser-finishes-' in ident:
   if ('lotion-' in ident)!=('Lotion' in app):continue
   if 'lotion-' not in ident and 'Spray' not in app:continue
   if glass and not ident.endswith('-'+glass):continue
   fin='matte-silver' if 'matte silver' in cc else 'shiny-silver' if 'shiny silver' in cc else 'turquoise' if 'turquoise' in cc else 'red' if 'red' in cc else 'gold' if 'gold' in cc else 'black' if 'black' in cc else None
   if fin and ('-'+fin+'-') not in ident:continue
  elif 'cyl5-' in ident or 'tall-9ml-' in ident:
   if glass and glass+'_STUDIO' not in ident:continue
  elif 'rollon-caps' in ident:
   if 'Roller' not in app:continue
   if glass=='clear' and any(ident.endswith('-'+c) for c in ['amber','cobalt','frosted']):continue
   if glass!='clear' and not ident.endswith('-'+glass):continue
   if ident.endswith('-detail'):continue
   finish=cc.replace(' with dots',' dotted').replace(' ','-');finish={'matte-copper':'copper','gold':'shiny-gold','silver':'shiny-silver'}.get(finish,finish)
   if finish and '__'+finish+'-capped' not in ident:continue
  elif 'lotion-internals' in ident:
   continue # dimensional pump studies remain in the model review, not exact-SKU assignments
  elif 'cyl9-17' in ident:
   if 'Roller' not in app and ('roller' in ident or 'capped' in ident or 'exploded' in ident):continue
  hits.append(ident)
 return hits
droppers={}
for f in (r/'working/dropper-assemblies').glob('*/repair-report.json'):
 a,_=latest(f.parent);droppers[a['sku']]=a
rows=[]
for a in old:
 a=dict(a);sku=a['sku'];c=bySku.get(sku,{});bid=a.get('bodyId');photo=photos.get(sku,{});ids=sorted(bodySources.get(bid,set())) if bid else a['modelIds'];native=match_native(a,[x for x in ids if x.startswith('native-')]);legacy=[x for x in ids if x.startswith('glb-')];vm=vmap.get(sku);defects=[];fixed=[];holds=[];renders=[];work=[]
 assembledNative=[x for x in native if 'native-empire-' not in x and not x.endswith('__bare')]
 if photo.get('path'):beforeImage=photo['path']
 else:beforeImage=None;holds.append('Current catalog screenshot unavailable: '+photo.get('status','no image assignment'))
 for ident in legacy:
  m=models[ident]
  for ch in m['changes']:
   fixed.append({'code':ch['code'],'detail':description(ch.get('detail','')),'model':ident,'qualification':'legacy geometry candidate'})
  holds+=m['unresolved'];work.append(m['workingCopy'])
 for ident in native:
  m=models[ident];rep=read(r/m['repairReport'],{});work.append(m['workingCopy']);nd=r/'renders/final/native-approved-studio'/ident
  for ch in rep.get('changes',[]):
   if ch.get('code')=='TUBE-AXIS' and not any(t in (a.get('applicator') or '') for t in ['Spray','Pump','Dropper']):continue
   fixed.append({'code':ch.get('code','SCENE'),'detail':description(ch.get('detail')) if ch.get('detail') else ('Straight centered hollow tube; '+str(round(rep.get('tubeVisualQualification',{}).get('outsideDiameterMm',ch['after']['outsideDiameterMm']),4))+' mm OD; '+str(ch['after']['floorClearanceMm'])+' mm floor gap; upper connection retained.' if ch.get('code')=='TUBE-AXIS' else ch.get('code','Scene correction')),'model':ident,'qualification':'native scene repair'})
  if (any(t in (a.get('applicator') or '') for t in ['Spray','Pump']) or ('Roller' in (a.get('applicator') or '') and 'rollon-caps' in ident)) and (nd/'after.png').exists():renders.append({'path':str((nd/'after.png').relative_to(r)),'label':'Bare body render only; closure assembly unresolved' if 'native-empire-' in ident or ident.endswith('__bare') else 'Matched native family / finish review; exact SKU association requires review','before':str((nd/'before.png').relative_to(r)) if (nd/'before.png').exists() else None})
 if vm:
  work=[vm['source']]+work
  for vi in vm['renderIds']:
   im=r/'renders/final/sku-variants'/vi/'after.png'
   if im.exists():renders.append({'path':str(im.relative_to(r)),'label':'Mapped '+vi.split('--')[-1]+' view','id':vi,'before':None})
   else:holds.append('Render pending: '+vi)
  holds+=vm['notes']
  if bid in ['flair-15ml-13-415','sleek-5ml-13-415','tulip-5ml-13-415']:
   fam='flair' if 'flair' in bid else 'sleek5' if 'sleek' in bid else 'tulip5';rep,_=latest(r/'working/priority-assemblies'/fam)
   fixed += [{'code':'BODY-RECONSTRUCTION','detail':'Reconstructed exterior from exact-SKU photos and published dimensions; reused native 13-415 finish and closure geometry at unchanged scale.','qualification':'inferred visual-production candidate'}, {'code':'MATERIAL','detail':'Restored approved glass assignment and light-link receivers.','qualification':'local render'}]
   if 'Spray' in (a.get('applicator') or ''):fixed.append({'code':'TUBE-AXIS','detail':'Straight centered hollow tube, '+str(rep.get('tubeVisualQualification',{}).get('outsideDiameterMm',1.4365))+' mm OD / 0.6365 mm bore, ending 0.5 mm above cavity floor.','qualification':'photo-matched tube diameter; source bore retained; inferred body interior' if rep.get('tubeVisualQualification') else 'template diameter; inferred body interior'})
   fixed += [{'code':ch['code'],'detail':description(ch.get('detail','')),'qualification':'review assembly refinement'} for ch in rep.get('changes',[]) if ch.get('code') in ['DRAWING-DIMENSIONS','CAPACITY','CLOSURE-CLEARANCE','TUBE-CONNECTION','TUBE-VISUAL-THICKNESS','TUBE-MATERIAL']]
   holds += [x for x in rep.get('remaining',[]) if x not in ['Exact closure contact and visual review','Exact per-SKU closure finish and assembly review','Final visual approval']]
   holds+=['Interior thickness and final body profile include inferred details; manufacturer accuracy is not established.']
  if not vm['renderIds']:holds.append('The specified Minaret closure has no qualified 3D source.')
 if a['family']=='Empire' and a.get('applicator') in ['Perfume Spray Pump','Lotion Pump']:
  mech='mist' if a['applicator']=='Perfume Spray Pump' else 'lotion';ident='empire-'+str(a['capacityMl'])+'-'+mech;d=r/'working/empire-assemblies'/ident;rep,_=latest(d)
  if rep:
   fixed.append({'code':'TUBE-AXIS','detail':'Straight hollow tube rebuilt to the drawing-based cavity floor with 0.5 mm clearance.','qualification':'18-415 assembly recipe candidate'});work.append(rep['workingCopy']);holds.append(rep['qualification']);im=r/'renders/final/empire'/ident/'after.png'
   if im.exists():renders.append({'path':str(im.relative_to(r)),'label':'Representative black hardware; this SKU finish has not been reproduced','before':str((im.parent/'before.png').relative_to(r))})
 drop=droppers.get(sku)
 if drop:
  work.append(drop['workingCopy']);fixed += [{'code':ch['code'],'detail':description(ch.get('detail','')),'qualification':'PSD-derived dropper fitted to repaired body; inferred internal details'} for ch in drop.get('changes',[])]
  im=r/'renders/final/droppers'/drop['id']/'after.png';before=r/'renders/final/droppers'/(drop['id'].rsplit('-dropper-',1)[0]+'-dropper-gold')/'before.png'
  if im.exists():renders.append({'path':str(im.relative_to(r)),'label':'SKU-mapped dropper assembly candidate','before':str(before.relative_to(r)) if before.exists() else None})
  holds.append(drop['qualification'])
 if a.get('isBottle') and not(vm or assembledNative or drop):holds.append('No source-qualified complete assembly: tube length, cap threading, reducer/roller seating and internal intersections cannot be verified per SKU from the available body/photo alone.')
 if not a.get('isBottle'):holds.append('Catalog accessory/component/packaging record; no complete bottle assembly assigned.')
 if a.get('isBottle') and not(native or legacy or vm or drop):holds.append('No matched editable bottle source found in the audited active asset inventory.')
 if 'Dropper' in (a.get('applicator') or '') and not(vm or drop):holds.append('No SKU-fitted dropper assembly. Generic pipette geometry cannot establish the correct length or glass clearance.')
 if 'Vintage' in (a.get('applicator') or ''):holds.append('An antique bulb collar reconstruction is available as a generic component; this exact assembled SKU and its tube remain unqualified.')
 # Preserve the detected source defects without implying all family variants share every internal part.
 for df in a.get('defects',[]):
  df=dict(df)
  if df.get('model') and df['model'] not in native+legacy:continue
  df['status']='repaired in review copy' if df.get('code') in {x['code'] for x in fixed} else 'unresolved'
  if df.get('code')=='SOURCE-3D' and (native or legacy or vm):continue
  if df.get('code','').startswith('TUBE') and not any(x in (a.get('applicator') or '') for x in ['Spray','Pump','Dropper']):continue
  defects.append(df)
 if drop:status='Fitted dropper assembly for review'
 elif vm and bid.startswith(('flair-','sleek-5','tulip-5')):status='Inferred assembly for review'
 elif a['family']=='Empire' and a.get('applicator') in ['Perfume Spray Pump','Lotion Pump'] and any(x['code']=='TUBE-AXIS' for x in fixed):status='Recipe assembly for review'
 elif renders and assembledNative:status='Native repair rendered for review'
 elif renders and native:status='Body render; assembly unresolved'
 elif legacy:status='Geometry repair; assembly unresolved'
 elif native:status='Native source audited'
 elif not a.get('isBottle'):status='Component or non-bottle record'
 else:status='Editable assembly unavailable'
 for x in fixed:
  if x['code']=='CLOSURE-CLEARANCE':defects.append({'code':'CLOSURE-CLEARANCE','detail':x['detail'],'status':'repaired in review copy'})
 unique=lambda xs:list(dict.fromkeys(x for x in xs if x))
 a.update({'sourceModelIds':unique(native+legacy),'modelIds':unique(native+legacy),'beforeImage':beforeImage,'beforeImageSource':photo.get('source'),'renders':renders,'workingFiles':unique(work),'defects':defects,'fixes':fixed,'remaining':unique(holds),'status':status,'skuRenderMap':vm,'verification':'See model-level topology, fit and render checks. No production change; no manufacturer certification.'});rows.append(a)
rows.sort(key=lambda a:(0 if a['family']=='Flair' else 1 if a.get('capacityMl')==5 else 2,a['family'],a.get('capacityMl') or 0,a['sku']))
(r/'reports/model-manifest.json').write_text(json.dumps(list(models.values()),indent=2));(r/'reports/per-sku-review.json').write_text(json.dumps(rows,indent=2))
with (r/'reports/per-sku-review.csv').open('w',newline='') as f:
 w=csv.DictWriter(f,fieldnames=['sku','graceSku','family','capacityMl','glass','applicator','status','defects','fixes','remaining','beforeImage','afterRenders','workingFiles']);w.writeheader()
 for a in rows:w.writerow({**{k:a.get(k) for k in ['sku','graceSku','family','capacityMl','glass','applicator','status','beforeImage']},'defects':' | '.join(x.get('code','')+': '+x.get('detail','') for x in a['defects']),'fixes':' | '.join(x['code']+': '+x['detail'] for x in a['fixes']),'remaining':' | '.join(a['remaining']),'afterRenders':' | '.join(x['path'] for x in a['renders']),'workingFiles':' | '.join(a['workingFiles'])})
summary={'catalogRecords':len(rows),'editableActiveSources':len(q),'nativeScenes':sum(a['kind']=='blend' for a in q),'legacyGlbs':sum(a['kind']=='glb' for a in q),'statuses':dict(collections.Counter(a['status'] for a in rows)),'catalogPictures':sum(bool(a['beforeImage']) for a in rows),'skuVariants':len(vqueue),'renderedSkuVariants':sum((r/'renders/final/sku-variants'/x/'after.png').exists() for x in vqueue),'fittedDropperAssemblies':len(droppers),'selectedWorkingCopies':len(read(r/'sources/selected-working-models.json',[])),'originalHashVerification':read(r/'audit/originals-verification.json',[]),'notPublished':True}
(r/'reports/summary.json').write_text(json.dumps(summary,indent=2));print(json.dumps({k:v for k,v in summary.items() if k!='originalHashVerification'},indent=2))
# Inline data allows the review to open from disk without a server.
template=(r/'scripts/review-template.html').read_text() if (r/'scripts/review-template.html').exists() else None
if template:(r/'reports/index.html').write_text(template.replace('__DATA__',json.dumps(rows).replace('</','<\\/')).replace('__SUMMARY__',json.dumps({k:v for k,v in summary.items() if k!='originalHashVerification'})).replace('__MODELS__',json.dumps(list(models.values())).replace('</','<\\/')))
