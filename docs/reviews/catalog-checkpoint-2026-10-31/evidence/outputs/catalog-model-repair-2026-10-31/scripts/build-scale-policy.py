import json,csv,pathlib,collections,datetime
ROOT=pathlib.Path(__file__).resolve().parents[3]
OUT=ROOT/'outputs/catalog-model-repair-2026-10-31/reports/catalog-scale';OUT.mkdir(exist_ok=True)
def read(f):return json.loads((ROOT/f).read_text())
SNAP=read('outputs/catalog-model-repair-2026-10-31/reports/glass-body-overview/register-snapshot.json')
bodies={r['body']['bodyId']:r['body'] for r in SNAP['register']}
assemblies=list(csv.DictReader((ROOT/'data/register/assemblies.csv').open()))
bySku={r['websiteSku']:r for r in assemblies};byGrace={r['graceSku']:r for r in assemblies}
products=read('outputs/catalog-model-repair-2026-10-31/sources/catalog-production.json')['rows']
for p in products:
 if p.get('websiteSku') not in bySku and p.get('graceSku') in byGrace:bySku[p['websiteSku']]=byGrace[p['graceSku']]
candidates=collections.defaultdict(list);unmapped=[]
def add(sku,pct,landmark,file,priority,mm=None,note=None):
 a=bySku.get(sku)
 if not a:unmapped.append({'sku':sku,'file':file,'pct':pct});return
 candidates[a['bodyId']].append(dict(sku=sku,glass=a['glass'],spanPct=pct,landmark=landmark,source=file,priority=priority,sourceHeightMm=mm,note=note))
# Newer family-wide approvals preserve deliberate exceptions to the fitted curve.
f='docs/hero-families/cylinder-2026-09-22/manifest.json'
for r in read(f)['rows']:
 l=r.get('lock',{});
 if l.get('shoulderPct') is not None:add(r['sku'],l['shoulderPct'],'shoulder',f,30)
f='docs/reviews/cylinder-family-final-manifest-2026-09-07.json'
for r in read(f)['rows']:
 t=r.get('targetHeightRequest',{})
 if t.get('heightPercent') is not None:add(r['sku'],t['heightPercent'],'shoulder',f,10)
f='docs/hero-families/circle-round-empire-2026-09-22/complete-family-approval.json'
for r in read(f)['rows']:add(r['sku'],r['targetSpanPct'],'shoulder' if r['landmark']=='shoulder' else 'closure-seat',f,30)
for family in ['elegant','boston-diva','sleek']:
 f=f'docs/hero-families/{family}-2026-09-23/approval.json'
 for r in read(f)['rows']:
  add(r['sku'],r.get('shoulderSpanPct',r.get('spanPct')),'closure-seat' if 'closure' in r.get('upperLandmark','') else 'shoulder',f,30)
for family in ['apothecary','remaining-42']:
 f=f'docs/hero-families/{family}-2026-09-24/approval.json'
 for r in read(f)['rows']:
  # These records call the targets shoulder spans. Enclosed atomizers are full-product exceptions.
  lm='full-product' if r['sku'].startswith('GBAtom') else 'shoulder'
  add(r['sku'],r['approvedFramingTarget']['spanPct'],lm,f,30)
for family in ['next-batch','batch3','batch6','vials']:
 f=f'docs/hero-families/{family}-2026-09-25/approval.json'
 for r in read(f)['rows']:
  s=r.get('sizing',{});full=s.get('glassHeightPct')
  pct=full if full is not None else s.get('targetPct')
  if pct is None:continue
  lm='full-glass' if full is not None else ('shoulder' if 'shoulder' in s.get('landmarkRule','') else 'closure-seat')
  add(r['sku'],pct,lm,f,40 if family=='vials' or s.get('override') else 20,s.get('glassMm'),s.get('override') or s.get('note'))
rows=[]
for bid,b in bodies.items():
 cs=candidates.get(bid,[]);rank=max((c['priority'] for c in cs),default=0);winners=[c for c in cs if c['priority']==rank]
 unique=sorted(set((c['spanPct'],c['landmark']) for c in winners))
 # Prefer the clear approved representative where color-specific stopper exceptions differ.
 winner=next((c for c in winners if c['glass']=='Clear'),winners[0] if winners else None)
 mm=b['dims'].get('heightBareMm');curve=round(3.5314*mm**.5868,4) if mm and mm>0 else None
 target=winner['spanPct'] if winner else curve
 landmark=winner['landmark'] if winner else ('closure-seat' if b['neck'].lower() in ['ground','plug','snap','snap-on','press-fit','no-neck'] else 'shoulder')
 issues=[]
 if len(unique)>1:issues.append('Conflicting approved targets at the same precedence; clear representative displayed for comparison only.')
 if not winner:issues.append('Curve derived from register height; no family-specific approval found.')
 if b['dims'].get('confidence') in ['low','convex-only']:issues.append('Physical height is not caliper-verified in this register snapshot.')
 if bid=='flair-15ml-13-415':issues.append('Approved 37.48% target used 56 mm. Repaired drawing-based model is 64.1 mm tall; retain the approved display target pending a dated amendment.')
 if b.get('status')=='retired':issues.append('Retired register identity; not a current catalog body.')
 if landmark=='full-product':issues.append('Enclosed atomizer exception measures the complete product, not a bare glass body.')
 laterDisagreement=[c for c in cs if c['priority']<rank and c['source'].endswith('/approval.json') and abs(c['spanPct']-target)>.5]
 if laterDisagreement:issues.append('Some other approved exact images use a different span; preserved in candidate history for reconciliation.')
 rows.append(dict(bodyId=bid,family=b['family'],capacityMl=b.get('capacityMl'),neck=b['neck'],category=b['category'],status=b['status'],heightBareMm=mm,heightSource=b['dims'],curvePct=curve,targetPct=target,baselinePct=91,landmark=landmark,basis='approved-family-exception' if winner and rank>=30 else 'approved-curve-release' if winner else 'catalog-curve',source=winner['source'] if winner else 'docs/hero-families/next-batch-2026-09-25/README.md',sourceSku=winner['sku'] if winner else None,lockedInputHeightMm=winner.get('sourceHeightMm') if winner else None,conflictingTargets=unique if len(unique)>1 else [],issues=issues,candidates=cs,skus=[a['websiteSku'] for a in assemblies if a['bodyId']==bid],representative=b.get('representative')))
policy={'confirmedAt':'2026-10-31','userDecision':'Later catalog-wide curve, with approved family exceptions','curve':{'coefficient':3.5314,'exponent':.5868,'input':'bare glass height in mm, foot to rim','output':'shoulder or closure-seat span as percent of 10:11 canvas','source':'docs/hero-families/next-batch-2026-09-25/README.md','calibrationBodies':['diva-100ml-18-415','elegant-100ml-18-415','cylinder-50ml-18-415','cylinder-5ml-13-415','elegant-15ml-13-415']},'baselinePct':91,'scope':'Local review only. Original image bytes and product assignments unchanged. Targets are separate from physical dimension and visual approval.','rows':rows,'unmappedApprovalSkus':unmapped}
(OUT/'scale-policy.json').write_text(json.dumps(policy,indent=2))
with (OUT/'body-scale-targets.csv').open('w') as f:
 keys=['bodyId','family','capacityMl','status','heightBareMm','curvePct','targetPct','baselinePct','landmark','basis','source','issues'];w=csv.DictWriter(f,fieldnames=keys);w.writeheader()
 for r in rows:w.writerow({k:('; '.join(r[k]) if isinstance(r[k],list) else r[k]) for k in keys})
print(json.dumps({'bodies':len(rows),'current':sum(r['status']=='current' for r in rows),'basis':dict(collections.Counter(r['basis'] for r in rows)),'conflicts':[(r['bodyId'],r['conflictingTargets']) for r in rows if r['conflictingTargets']],'unmappedApprovalSkus':unmapped},indent=2))
