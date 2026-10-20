from pathlib import Path
import json,shutil,subprocess,csv,re,zipfile
R=Path('/private/tmp/best-bottles-empire-alpha-20261019');O=R/'output/round78-lotion-pilot';D=Path('/Users/jordanrichter/.codex/visualizations/2026/10/19/01a15606-c4e4-7692-9d6e-773c45309fd7/empire-pilot');T=D/'round78-lotion-pilot';Q=D/'readiness'
def read(p):return json.loads(p.read_text())
rows=read(O/'after/results.json');sels=read(O/'after/selector-results.json');builder=read(O/'builder-export-results.json');catalog=read(O/'catalog-results.json');native=read(O/'native-delivery.json');sources=read(O/'psd-sources.json');legacy=read(O/'legacy/receipts.json')
assert len(rows)==2 and all(not r.get('error') and not r['pageErrors'] and r['sku']==r['itemName'] and len(r['views'])==3 and all(not v['broken'] and v['state']=='rendered' for v in r['views'].values()) for r in rows)
assert len(sels)==2 and sum(len(r['picks']) for r in sels)==14 and all(not r.get('error') and not r['pageErrors'] and not r['phoneOverflow'] and len({json.dumps(p['bodyBox'],sort_keys=True) for p in r['picks']})==1 for r in sels)
assert len(builder)==2 and all(not r.get('error') and not r['pageErrors'] and r['exactSku'] for r in builder)
assert len(catalog['rows'])==2 and not catalog['pageErrors'] and not catalog['phoneOverflow'] and all(not r.get('error') for r in catalog['rows'])
assert len(native)==2 and len(sources)==4 and all(p['websiteSku'] in legacy['listing']['websiteSkus'] for p in legacy['pilot'])
verification={'scope':'Round 78 ml clear and frosted Shiny Silver lotion-pump pilot only','date':'2026-10-20','visualAcceptance':'pending','published':False,'exactSkus':[r['sku'] for r in rows],'pdpViews':6,'selectorChecks':14,'phoneGroups':2,'builderExports':2,'matchingCatalogChecks':2,'nativeDeliveryChecks':2,'testsPassed':15,'typecheck':'passed','diffWhitespaceCheck':'passed','sourceMastersInspected':4,'tubeMasterHash':'reverified against archived native Round 78 ml Matte Gold lotion PSD','assemblyGeometry':'All fourteen existing local lotion assemblies unchanged against fresh before kits in both production and development snapshots','legacyPilotIdentity':'Both exact SKUs, Shiny Silver finish, capacity, and 18/415 verified from fresh exact product pages','legacyScope':'Eight SKUs in lotion listing versus fourteen in current matrix. Remaining six require separate legacy membership investigation before extension/release.','physicalFit':'Existing uniform source fit retained; no new measurements or physical-fit verification','review':read(T/'review-check.json')}
(T/'verification.json').write_text(json.dumps(verification,indent=2)+'\n')
report='''# Round 78 ml lotion-pump pilot, local review

Prepared LBRnd78LtnShnSl and LBRndFrst78LtnShnSl for comparison across the catalog, product page and Builder. The full Diva standard-spray set was accepted locally before starting this pair. This pilot adds two catalog images; the other twelve Round lotion variants retain their previous local media state.

## Implementation

Both catalog images are direct exports of their actual local Builder SVGs with original image bytes embedded. The catalog swatches show and link to the exact SKUs. Entries are enabled only in development with VERCEL unset.

The existing Round lotion candidate already joins its native tube to the visible pump collar. No geometry or image pixels were edited in this pass. All fourteen existing local lotion assemblies compare equal to fresh before snapshots in both production and development. The approved Round spray, Diva and Empire media remain unchanged.

The comparison gives clear and frosted glass the same registered rim-to-foot display height and aligned bases, uniformly scaling each complete assembly. This is a relative comparison, not a new physical measurement. The separate approved Round spray reference is independently framed.

## Source evidence and unresolved data

Four capped and uncapped exact-SKU PSDs were inspected, hashed and previewed. Both legacy product pages identify the requested Shiny Silver assemblies and 78 ml capacity with 18/415 necks. Their directly linked original GIFs and HTML are preserved with hashes. The existing local tube comes from the Round 78 ml Matte Gold lotion master. Its original PSD hash was reverified against the archived native file, and the complete tube PNG hash and continuity pass. The tube is shared across finishes; it is not an exact Shiny Silver tube extraction. Its fit remains based on registered landmarks, without new physical measurements.

The frosted matrix row reports capColor Frosted. Its exact registered pump, CMP-LPM-SSLV-18-415, the legacy product page, and the product selector identify Shiny Silver. The local export retains sourceCapColor and uses that verified finish without changing backend records.

The legacy pages state height 96 mm and diameter 59 mm; the measurement basis is unspecified. The current drawing labels its glass body 73 mm tall. These are not assumed to measure the same object, and neither the glass nor its metadata was changed. Legacy weight is the malformed raw value 25786 and remains unresolved. The legacy nominal 2.65 oz and the UI's converted 2.64 oz are preserved as separate display facts. Prices were captured as source evidence, not reconciled or changed.

The current legacy lotion category lists eight Round 78 ml lotion SKUs, compared with fourteen in the current matrix. Both pilot SKUs occur in that listing. The six remaining matrix-only matches require further exact-page or option evidence before broader catalog reconciliation; omission does not establish retirement. This pilot does not claim complete family commercial reconciliation.

## Verification

Both exact-SKU product pages passed cap-beside, cap-on and exploded views, six views total. Both pump selectors passed seven choices each, fourteen checks, with stable glass bodies and correct SKU/context/URL. Both phone layouts passed. Both Builder exports and exact catalog selections passed. Two native image-delivery checks passed without request overrides. Browser export checks use original cached source bytes where needed.

The comparison's seven surfaces, both native-source comparisons, equal-scale geometry, decoded images and phone layout passed. Fifteen focused tests passed, including continuity/source hashes, geometry preservation, exact catalog mapping, production exclusion, and prior-family catalog regressions. TypeScript and git diff whitespace checks passed. One initial test assertion did not handle a missing nonpilot hero; the assertion was corrected and the full focused set reran clean. The initial log is retained.

## Review and preservation

Review: http://127.0.0.1:3008/round78-lotion-pilot/ . App: http://localhost:3007 . Working checkout: /private/tmp/best-bottles-empire-alpha-20261019 . Review this pair before extending the remaining finishes.

All changes are local. No push, commit, deployment, source-master modification, backend mutation, order or checkout change was made. The bundle is cumulative from PR 369 base a892d9b0. Apply implementation.patch to the matching base, then overlay implementation/. It includes cumulative changed code/assets, the Empire local baseline, this pilot's evidence, and prior Round/Diva snapshots needed for the regression tests. Prior review bundles remain intact. No environment files or credentials are included.
'''
(T/'REPORT.md').write_text(report)
for name in ['psd-sources.json','builder-export-results.json','catalog-results.json','native-delivery.json','image-cache-index.json','tube-master-verification.json','test-output.txt','test-output-initial.txt']:shutil.copy2(O/name,T/name)
shutil.copytree(O/'legacy',T/'legacy',dirs_exist_ok=True)
for name,out in [('results.json','pdp-results.json'),('selector-results.json','selector-results.json')]:shutil.copy2(O/'after'/name,T/out)
ledger=read(Q/'sku-readiness.json');codes=set(verification['exactSkus'])
for r in ledger:
 if r['sku'] in codes:r['visual']='Round lotion Shiny Silver pilot: matching catalog, PDP and Builder; local visual review pending'
(Q/'sku-readiness.json').write_text(json.dumps(ledger,indent=2))
with (Q/'sku-readiness.csv').open('w') as f:
 w=csv.DictWriter(f,fieldnames=list(ledger[0]));w.writeheader();w.writerows(ledger)
for name,new,key in [('results.json',rows,'sku'),('selector-results.json',sels,'group')]:
 old=read(Q/name);updates={r[key]:r for r in new};(Q/name).write_text(json.dumps([updates.get(r[key],r) for r in old],indent=2))
for p in (O/'after').glob('*.png'):shutil.copy2(p,Q/p.name)
h=(Q/'index.html').read_text();h=re.sub(r'const data=.*?;const esc=',lambda m:'const data='+json.dumps(ledger).replace('</','<\\/')+';const esc=',h,flags=re.S)
notice='<div class="note"><strong>Round 78 ml lotion-pump pilot.</strong> Clear and frosted Shiny Silver are ready for <a href="../round78-lotion-pilot/">local visual review</a>. The other twelve lotion variants retain their previous local media status.</div>'
if notice not in h:h=h.replace('<main>','<main>'+notice,1)
(Q/'index.html').write_text(h)
s=read(Q/'summary.json');s['round78LotionPilot']=verification;(Q/'summary.json').write_text(json.dumps(s,indent=2))
I=T/'implementation';I.mkdir(exist_ok=True)
files=subprocess.check_output(['git','diff','--name-only'],cwd=R,text=True).splitlines()+subprocess.check_output(['git','ls-files','--others','--exclude-standard','--','src','public','scripts','tests'],cwd=R,text=True).splitlines()
for name in sorted(set(files)):
 p=R/name
 assert not any(part.startswith('.env') or part in ['node_modules','.git'] for part in Path(name).parts)
 if p.is_file():dest=I/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dest)
base=I/'output/local-media-baseline';base.mkdir(parents=True,exist_ok=True);shutil.copy2(R/'output/local-media-baseline/active.json',base/'active.json')
shutil.copytree(O,I/'output/round78-lotion-pilot',dirs_exist_ok=True)
for folder in ['round78-spray-completion','diva46-spray-completion']:
 target=I/'output'/folder;target.mkdir(exist_ok=True)
 for p in (R/'output'/folder).glob('*.json'):shutil.copy2(p,target/p.name)
(T/'implementation.patch').write_bytes(subprocess.check_output(['git','diff','--binary'],cwd=R))
E=T/'evidence-scripts';E.mkdir(exist_ok=True)
for name in ['inspect_round_lotion_sources.py','cache_round_lotion_sources.py','export_round_lotion.py','capture_round_lotion.py','check_round_lotion_selectors.py','check_round_lotion_catalog.py','build_round_lotion_review.py','check_round_lotion_review.py','round_lotion_legacy_assets.py','finalize_round_lotion_pilot.py']:shutil.copy2(Path('/private/tmp/bb-empire-alpha-evidence')/name,E/name)
with zipfile.ZipFile(T/'implementation-bundle.zip','w',zipfile.ZIP_DEFLATED) as z:
 for directory in [I,E]:
  for p in directory.rglob('*'):
   if p.is_file():z.write(p,p.relative_to(T))
 for name in ['implementation.patch','REPORT.md','verification.json']:z.write(T/name,name)
with zipfile.ZipFile(T/'implementation-bundle.zip') as z:assert z.testzip() is None
print('Round lotion pilot preserved:',verification['exactSkus'],'; bundle bytes:',(T/'implementation-bundle.zip').stat().st_size)
