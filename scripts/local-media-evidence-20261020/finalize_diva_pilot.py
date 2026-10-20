from pathlib import Path
import json,shutil,subprocess,zipfile,csv,re
R=Path('/private/tmp/best-bottles-empire-alpha-20261019');O=R/'output/diva46-two-bottle-pilot';D=Path('/Users/jordanrichter/.codex/visualizations/2026/10/19/01a15606-c4e4-7692-9d6e-773c45309fd7/empire-pilot');T=D/'diva46-pilot';Q=D/'readiness'
rows=json.loads((O/'after/results.json').read_text());sels=json.loads((O/'after/selector-results.json').read_text());builder=json.loads((O/'builder-export-results.json').read_text());catalog=json.loads((O/'catalog-results.json').read_text());native=json.loads((O/'native-delivery.json').read_text())
assert len(rows)==2 and all(not r.get('error') and not r['pageErrors'] and r['sku']==r['itemName'] and all(not v['broken'] and v['state']=='rendered' for v in r['views'].values()) for r in rows)
assert len(sels)==2 and sum(len(r['picks']) for r in sels)==12 and all(not r.get('error') and not r.get('pageErrors') and not r['phoneOverflow'] and len({json.dumps(p['bodyBox'],sort_keys=True) for p in r['picks']})==1 for r in sels)
assert len(builder)==2 and all(not r.get('error') and not r.get('pageErrors') for r in builder)
assert len(catalog['rows'])==2 and not catalog['pageErrors'] and all(not r.get('error') for r in catalog['rows']) and len(native)==2
verification={'scope':'Diva 46 ml clear and frosted Shiny Silver pilot only','visualAcceptance':'pending','published':False,'date':'2026-10-20','exactSkus':[r['sku'] for r in rows],'pdpViews':6,'selectorChecks':12,'phoneGroups':2,'builderExports':2,'matchingCatalogChecks':2,'nativeDeliveryChecks':2,'testsPassed':13,'typecheck':'passed','diffWhitespaceCheck':'passed','assemblyGeometry':'All twelve existing local Diva spray assemblies unchanged against fresh production and development before kits','tubeLimitation':'Existing intact native tube from the shared sprayer source, not exact Diva tube photography or measured physical fit','legacyMatching':'Exact-SKU legacy-page matching unresolved; exact-SKU PSDs and registered components verified','review':json.loads((T/'review-check.json').read_text())}
(T/'verification.json').write_text(json.dumps(verification,indent=2)+'\n')
report='''# Diva 46 ml two-bottle pilot, local review

Prepared GBDiva46SpryShnSl and GBDivaFrst46SpryShnSl for visual review across catalog, product page and Builder. The other ten standard spray finishes remain at their previous local state. Antique sprayers, rings and tassels were not part of this pilot.

## What changed

Two catalog images now come directly from the actual local Builder SVGs, with original layer bytes embedded. Each catalog swatch displays and links to its exact SKU. The new catalog entries are guarded to development with VERCEL unset.

The existing local Diva assemblies already seat their tube against the registered visible sprayer edge. This pass preserves their glass, hardware, tube image bytes, geometry, length, aspect ratio and clear/frosted attenuation. No reshaping, redrawing, alpha removal or new tube extraction was needed. Tests compare all twelve spray assemblies against freshly captured before kits in both production and development snapshots; they are unchanged. Empire and Round local catalog regressions also pass.

## Source and fit limits

Four exact-SKU capped and uncapped PSDs were inspected and hashed. Their photographed glass and closure assemblies are available in the comparison. Neither provides a separate complete tube layer. The existing local tube is the intact native layer from the shared Round 78 sprayer source, fitted uniformly to the previously recorded Diva endpoint. It is a visual reuse candidate, not exact Diva tube photography or a measured physical fit. Existing 0.65 clear and 0.22 frosted seated opacities are retained presentation settings. Physical tube length remains unverified.

The comparison gives both glass bodies the same registered rim-to-foot display height and baseline, with a uniform transform on each entire assembly. It is a relative scale comparison. No new physical dimensions are asserted, and the separate Empire reference is independently framed.

The frosted raw matrix row reports capColor Clear. Its exact register component, CMP-SPR-SHSL-18-415-06, native source and product-page selector identify Shiny Silver. The local export input retains sourceCapColor and uses the verified Shiny Silver finish. No backend metadata was changed.

Fresh exact-SKU web searches and the current legacy all-products listing did not resolve these two standard-spray product pages. That is unresolved legacy matching, not proof of retirement or absence. Exact-SKU native masters, fresh product groups and registered components support this bounded visual pilot; it is not a full commercial-data or legacy-catalog reconciliation. No pricing or availability claims were changed.

## Verification

Two exact-SKU product pages passed in cap-beside, cap-on and exploded states, six views total. Both finish selectors passed all twelve choices with a fixed glass body, correct selected SKU/context and URL, plus phone layout checks. Both Builder assemblies and catalog swatch images and links passed. Two normal-delivery product-page checks passed without image request overrides.

The review's six surfaces, source/assembly comparison controls, equal-scale geometry, decoded images and phone layout passed. Thirteen focused tests, TypeScript and git diff whitespace checks passed. Source hashes, catalog hashes, source-change guards, all-assembly preservation and production exclusion are covered. Initial export evidence retains the stale Clear label mismatch; the exporter was corrected to use the exact verified component identity and both configurations then passed.

The browser export uses original cached image bytes where necessary to avoid local optimizer transport issues. These checks verify the local review, not a deployed site.

## Review and preservation

Review: http://127.0.0.1:3008/diva46-pilot/ . App: http://localhost:3007 . Working checkout: /private/tmp/best-bottles-empire-alpha-20261019 . The original archive checkout remains untouched. No push, commit, deployment, backend mutation, order or checkout change was made.

The implementation bundle is cumulative from PR 369 base a892d9b0, including earlier authorized Empire, Round and selector work. Apply implementation.patch to the matching base, then overlay implementation/. The earlier review bundles remain unchanged. Snapshots, source hashes, catalog receipts and scripts are included. No environment files or credentials are included. Visual approval of this pair is required before extending the new catalog treatment to the other Diva finishes.
'''
(T/'REPORT.md').write_text(report)
for name in ['psd-sources.json','legacy-evidence.json','builder-export-results.json','catalog-results.json','native-delivery.json','image-cache-index.json','test-output.txt']:shutil.copy2(O/name,T/name)
shutil.copy2(O/'after/results.json',T/'pdp-results.json');shutil.copy2(O/'after/selector-results.json',T/'selector-results.json')
ledger=json.loads((Q/'sku-readiness.json').read_text());codes={r['sku'] for r in rows}
for r in ledger:
 if r['sku'] in codes:r['visual']='Diva Shiny Silver pilot: matching catalog, PDP and Builder; shared-source tube candidate; visual review pending'
 if r['family']=='Round' and 'perfumespray' in r['path']:r['visual']='Round spray consistency pass visually accepted locally; not published'
(Q/'sku-readiness.json').write_text(json.dumps(ledger,indent=2))
with (Q/'sku-readiness.csv').open('w') as f:
 w=csv.DictWriter(f,fieldnames=list(ledger[0]));w.writeheader();w.writerows(ledger)
for name,new,key in [('results.json',rows,'sku'),('selector-results.json',sels,'group')]:
 old=json.loads((Q/name).read_text());updates={r[key]:r for r in new};(Q/name).write_text(json.dumps([updates.get(r[key],r) for r in old],indent=2))
for p in (O/'after').glob('*.png'):shutil.copy2(p,Q/p.name)
h=(Q/'index.html').read_text();h=re.sub(r'const data=.*?;const esc=',lambda m:'const data='+json.dumps(ledger).replace('</','<\\/')+';const esc=',h,flags=re.S)
notice='<div class="note"><strong>Diva 46 ml Shiny Silver pilot.</strong> Clear and frosted are ready for <a href="../diva46-pilot/">local visual review</a>. Other Diva finishes retain their prior status.</div>'
if notice not in h:h=h.replace('<main>','<main>'+notice,1)
(Q/'index.html').write_text(h)
summary=json.loads((Q/'summary.json').read_text());summary['diva46Pilot']=verification;(Q/'summary.json').write_text(json.dumps(summary,indent=2))
I=T/'implementation';I.mkdir(exist_ok=True);files=subprocess.check_output(['git','diff','--name-only'],cwd=R,text=True).splitlines()+subprocess.check_output(['git','ls-files','--others','--exclude-standard','--','src','public','scripts','tests'],cwd=R,text=True).splitlines()
for name in sorted(set(files)):
 p=R/name
 if p.is_file():dest=I/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dest)
base=I/'output/local-media-baseline';base.mkdir(parents=True,exist_ok=True);shutil.copy2(R/'output/local-media-baseline/active.json',base/'active.json')
shutil.copytree(O,I/'output/diva46-two-bottle-pilot',dirs_exist_ok=True,ignore=shutil.ignore_patterns('*-error.png'))
(T/'implementation.patch').write_bytes(subprocess.check_output(['git','diff','--binary'],cwd=R))
E=T/'evidence-scripts';E.mkdir(exist_ok=True)
for name in ['inspect_diva_pilot_sources.py','diva_legacy_evidence.py','cache_diva_sources.py','export_diva_pilot.py','capture_diva_pilot_before.py','capture_diva_pilot.py','check_diva_selectors.py','check_diva_catalog.py','build_diva_review.py','check_diva_review.py','finalize_diva_pilot.py']:shutil.copy2(Path('/private/tmp/bb-empire-alpha-evidence')/name,E/name)
with zipfile.ZipFile(T/'implementation-bundle.zip','w',zipfile.ZIP_DEFLATED) as z:
 for directory in [I,E]:
  for p in directory.rglob('*'):
   if p.is_file():z.write(p,p.relative_to(T))
 for name in ['implementation.patch','REPORT.md','verification.json']:z.write(T/name,name)
print('Diva pilot preserved:',verification['exactSkus'],'; bundle bytes:',(T/'implementation-bundle.zip').stat().st_size)
