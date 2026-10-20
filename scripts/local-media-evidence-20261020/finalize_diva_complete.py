from pathlib import Path
import json,shutil,subprocess,zipfile,csv,re
R=Path('/private/tmp/best-bottles-empire-alpha-20261019');O=R/'output/diva46-spray-completion';D=Path('/Users/jordanrichter/.codex/visualizations/2026/10/19/01a15606-c4e4-7692-9d6e-773c45309fd7/empire-pilot');T=D/'diva46-complete';Q=D/'readiness'
def read(p):return json.loads(p.read_text())
rows=read(O/'after/results.json');sels=read(O/'after/selector-results.json');builder=read(O/'builder-export-results.json');catalog=read(O/'catalog-results.json');native=read(O/'native-delivery.json');sources=read(O/'psd-sources.json')
assert len(rows)==12 and all(not r.get('error') and not r['pageErrors'] and r['sku']==r['itemName'] and all(not v['broken'] and v['state']=='rendered' for v in r['views'].values()) for r in rows)
assert len(sels)==2 and sum(len(r['picks']) for r in sels)==12 and all(not r.get('error') and not r.get('pageErrors') and not r['phoneOverflow'] and len({json.dumps(p['bodyBox'],sort_keys=True) for p in r['picks']})==1 for r in sels)
assert len(builder)==12 and all(not r.get('error') and not r.get('pageErrors') and r['exactSku'] for r in builder)
assert len(catalog['rows'])==12 and not catalog['pageErrors'] and not catalog['phoneOverflow'] and all(not r.get('error') for r in catalog['rows']) and len(native)==3
assert len(sources)==12 and sum(len(r['masters']) for r in sources)==24
accepted={'GBDiva46SpryShnSl','GBDivaFrst46SpryShnSl'}
verification={'scope':'All twelve standard Diva 46 ml sprays; six finishes in clear and frosted','visualAcceptance':{'acceptedShinySilverPair':sorted(accepted),'additionalTen':'pending'},'published':False,'date':'2026-10-20','exactSkus':[r['sku'] for r in rows],'pdpViews':36,'selectorChecks':12,'phoneGroups':2,'builderExports':12,'matchingCatalogChecks':12,'nativeDeliveryChecks':3,'testsPassed':15,'typecheck':'passed','diffWhitespaceCheck':'passed','sourceMastersInspected':24,'assemblyGeometry':'All twelve existing local Diva spray assemblies unchanged against fresh production and development before kits','acceptedPairCatalogPixels':'SHA-256 unchanged from accepted pilot','tubeLimitation':'Existing intact native tube from the shared Round sprayer source, not exact Diva tube photography or measured physical fit','legacyMatching':'Exact-SKU legacy-page matching unresolved in pilot evidence; exact-SKU PSDs and registered components verified for all twelve','review':read(T/'review-check.json')}
(T/'verification.json').write_text(json.dumps(verification,indent=2)+'\n')
report='''# Diva 46 ml standard sprays, local comparison

All twelve standard spray variants are ready for review: clear and frosted glass with Shiny Silver, Matte Silver, Shiny Gold, Matte Gold, Shiny Black and Copper. The Shiny Silver pair was accepted by Jordan before this extension; the other ten await visual acceptance. Antique sprayers, rings, tassels and the next family were not changed.

## What changed

Ten additional catalog images now come directly from their actual local Builder SVGs, with original layer bytes embedded. Each catalog swatch displays and links to its exact SKU. The accepted Shiny Silver pair remains pixel-identical, verified by SHA-256. The entries are enabled only in development with VERCEL unset.

The existing twelve local Diva assemblies already use the reviewed source-tube placement. This pass preserves their glass, hardware, tube pixels, geometry, length, aspect ratio and clear/frosted attenuation. There was no new tube extraction, reshaping, redraw or alpha removal. Tests compare all twelve assemblies with freshly captured before kits in both production and development snapshots; they are unchanged. Earlier Empire and Round catalog regression checks also pass.

## Sources and limits

Twenty-four exact-SKU capped and uncapped PSDs were inspected and hashed for all twelve SKUs. Their native assembly previews are included. The sources do not provide a separate complete tube layer. The existing local tube is the intact native layer from the shared Round 78 sprayer source, fitted uniformly to the previously recorded Diva endpoint. It is not exact Diva tube photography or a measured physical fit. The seated opacity remains 0.65 for clear and 0.22 for frosted. Physical tube length remains unverified.

The clear and frosted comparison uses equal registered rim-to-foot display heights and aligned bases. Each whole assembly is scaled uniformly. This is a relative scale comparison; it does not assert new physical measurements. The Empire reference is independently framed.

The frosted raw matrix rows report capColor Clear. Each local export retains that value as sourceCapColor and derives its displayed finish from the exact registered sprayer component and image URL, matched to the approved Round source records. The product-page selectors agree. No backend metadata was changed.

Pilot exact-SKU searches and the current legacy all-products listing did not resolve the standard-spray legacy pages. That remains unresolved legacy matching, not evidence of retirement or absence. Exact-SKU native masters, fresh product groups and registered components support this visual comparison. This work does not claim full commercial-data reconciliation or change prices or availability.

## Verification

Twelve exact-SKU product pages passed cap-beside, cap-on and exploded views, 36 views total. Both finish selectors passed all twelve choices with fixed glass bodies and correct selected SKU/context and URL. Both phone layouts passed. Twelve Builder exports and twelve catalog swatch images and links passed. Three normal-delivery product-page checks passed without image request overrides.

The review's six finishes across six surfaces, both native-source comparisons, relative scale geometry, decoded images and phone layout passed. Fifteen focused tests, TypeScript and git diff whitespace checks passed. Tests cover source hashes, catalog hashes, production exclusion, accepted-pair pixel preservation and geometry preservation for all twelve assemblies.

The browser export uses original cached image bytes where necessary to avoid local optimizer transport issues. These checks verify the local review, not a deployed site.

## Review and preservation

Review: http://127.0.0.1:3008/diva46-complete/ . App: http://localhost:3007 . Working checkout: /private/tmp/best-bottles-empire-alpha-20261019 . The original archive checkout is untouched. No push, commit, deployment, backend mutation, order or checkout change was made.

The implementation bundle is cumulative from PR 369 base a892d9b0 and includes earlier authorized Empire, Round and selector work. Apply implementation.patch to the matching base, then overlay implementation/. Existing review bundles remain unchanged. This completion's snapshots, source previews and hashes, catalog receipts and scripts are included, along with the earlier Diva pilot and Round completion evidence used by regression checks. No environment files or credentials are included. Review this full set before starting another family.
'''
(T/'REPORT.md').write_text(report)
for name in ['psd-sources.json','builder-export-results.json','catalog-results.json','native-delivery.json','image-cache-index.json','test-output.txt']:shutil.copy2(O/name,T/name)
shutil.copy2(O/'after/results.json',T/'pdp-results.json');shutil.copy2(O/'after/selector-results.json',T/'selector-results.json')
ledger=read(Q/'sku-readiness.json');codes={r['sku'] for r in rows}
for r in ledger:
 if r['sku'] in codes:r['visual']='Diva spray: matching catalog, PDP and Builder; shared-source tube; '+('Shiny Silver pair accepted locally; not published' if r['sku'] in accepted else 'local visual review pending')
(Q/'sku-readiness.json').write_text(json.dumps(ledger,indent=2))
with (Q/'sku-readiness.csv').open('w') as f:
 w=csv.DictWriter(f,fieldnames=list(ledger[0]));w.writeheader();w.writerows(ledger)
for name,new,key in [('results.json',rows,'sku'),('selector-results.json',sels,'group')]:
 old=read(Q/name);updates={r[key]:r for r in new};(Q/name).write_text(json.dumps([updates.get(r[key],r) for r in old],indent=2))
for p in (O/'after').glob('*.png'):shutil.copy2(p,Q/p.name)
h=(Q/'index.html').read_text();h=re.sub(r'const data=.*?;const esc=',lambda m:'const data='+json.dumps(ledger).replace('</','<\\/')+';const esc=',h,flags=re.S)
h=re.sub(r'<div class="note"><strong>Diva 46 ml Shiny Silver pilot\.</strong>.*?</div>','',h,flags=re.S)
notice='<div class="note"><strong>Diva 46 ml standard sprays.</strong> All twelve are ready in the <a href="../diva46-complete/">full local comparison</a>. The Shiny Silver pair is accepted; the other ten await visual review. Shared-source tube fit remains unmeasured.</div>'
if notice not in h:h=h.replace('<main>','<main>'+notice,1)
(Q/'index.html').write_text(h)
summary=read(Q/'summary.json');summary['diva46Completion']=verification
if 'diva46Pilot' in summary:summary['diva46Pilot']['visualAcceptance']='accepted locally'
(Q/'summary.json').write_text(json.dumps(summary,indent=2))
I=T/'implementation';I.mkdir(exist_ok=True);files=subprocess.check_output(['git','diff','--name-only'],cwd=R,text=True).splitlines()+subprocess.check_output(['git','ls-files','--others','--exclude-standard','--','src','public','scripts','tests'],cwd=R,text=True).splitlines()
for name in sorted(set(files)):
 p=R/name
 assert not any(part.startswith('.env') or part in ['node_modules','.git'] for part in Path(name).parts)
 if p.is_file():dest=I/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dest)
base=I/'output/local-media-baseline';base.mkdir(parents=True,exist_ok=True);shutil.copy2(R/'output/local-media-baseline/active.json',base/'active.json')
for folder in ['diva46-spray-completion','diva46-two-bottle-pilot','round78-spray-completion']:
 shutil.copytree(R/'output'/folder,I/'output'/folder,dirs_exist_ok=True,ignore=shutil.ignore_patterns('*-error.png'))
(T/'implementation.patch').write_bytes(subprocess.check_output(['git','diff','--binary'],cwd=R))
E=T/'evidence-scripts';E.mkdir(exist_ok=True)
for name in ['inspect_diva_complete_sources.py','cache_diva_complete_sources.py','export_diva_complete.py','capture_diva_complete.py','check_diva_complete_selectors.py','check_diva_complete_catalog.py','build_diva_complete_review.py','check_diva_complete_review.py','finalize_diva_complete.py']:shutil.copy2(Path('/private/tmp/bb-empire-alpha-evidence')/name,E/name)
with zipfile.ZipFile(T/'implementation-bundle.zip','w',zipfile.ZIP_DEFLATED) as z:
 for directory in [I,E]:
  for p in directory.rglob('*'):
   if p.is_file():z.write(p,p.relative_to(T))
 for name in ['implementation.patch','REPORT.md','verification.json']:z.write(T/name,name)
print('Diva completion preserved:',len(rows),'SKUs; bundle bytes:',(T/'implementation-bundle.zip').stat().st_size)
