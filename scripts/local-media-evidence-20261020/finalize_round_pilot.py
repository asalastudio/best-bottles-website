from pathlib import Path
import json,shutil,subprocess,zipfile,csv,re
R=Path('/private/tmp/best-bottles-empire-alpha-20261019');O=R/'output/round78-two-bottle-pilot';D=Path('/Users/jordanrichter/.codex/visualizations/2026/10/19/01a15606-c4e4-7692-9d6e-773c45309fd7/empire-pilot');T=D/'round78-pilot';Q=D/'readiness'
rows=json.loads((O/'after/results.json').read_text());sels=json.loads((O/'after/selector-results.json').read_text());builder=json.loads((O/'builder-export-results.json').read_text());catalog=json.loads((O/'catalog-results.json').read_text());native=json.loads((O/'native-delivery.json').read_text())
assert len(rows)==2 and all(not r.get('error') and not r['pageErrors'] and r['sku']==r['itemName'] and all(not v['broken'] for v in r['views'].values()) for r in rows)
assert len(sels)==2 and sum(len(r['picks']) for r in sels)==12 and all(not r.get('error') and not r.get('pageErrors') and not r['phoneOverflow'] for r in sels)
assert len(builder)==2 and all(not r.get('error') and not r.get('pageErrors') for r in builder)
assert len(catalog['rows'])==2 and not catalog['pageErrors'] and len(native)==2
verification={'scope':'Round 78 ml clear and frosted Shiny Silver only','visualAcceptance':'pending','published':False,'exactSkus':[r['sku'] for r in rows],'pdpViews':6,'selectorChecks':12,'phoneGroups':2,'builderExports':2,'matchingCatalogChecks':2,'nativeDeliveryChecks':2,'testsPassed':13,'typecheck':'passed','diffWhitespaceCheck':'passed','otherTenSprayAssemblies':'deep equality against before kits passed in fresh development and production snapshots','review':json.loads((T/'review-check.json').read_text())}
(T/'verification.json').write_text(json.dumps(verification,indent=2)+'\n')
report='''# Round 78 ml two-bottle pilot

Local review prepared for GBRnd78SpryShnSl and GBRndFrst78SpryShnSl. Visual acceptance is pending. The other ten Round spray variants retain their previous assemblies and catalog treatment.

## What changed

The native Round tube now meets the visible lower edge of the Shiny Silver sprayer. The previous join used the image canvas bottom, including six transparent source pixels. The pilot uses the registered solid bottom at 392 of 398 pixels, with the existing two-pixel overlap. Exact SKU, source URL, component, plate and bounds checks protect the substitution.

Both glass images already have transparent exteriors. Their pixels, dimensions and placement are unchanged. The tube is the exact RGBA Layer 25 from the clear bottle's original PSD, verified with topil() against the retained native PNG. It is not redrawn or rescaled differently in this pass. The frosted PSD has no separate tube layer; its original assembled photo largely conceals the tube. Existing seated tube opacities remain 0.65 for clear and 0.22 for frosted. These are retained presentation settings, not new measured material values. Both exploded views retain the complete shared mechanism.

Two catalog images were exported from the actual local Builder SVG with original layer bytes embedded. Catalog swatches display and link to the exact matching SKU. The same local-only guards used by Empire cover these exports. Empire visuals were not changed.

The comparison aligns the two Round glass baselines and gives both the same registered rim-to-foot height, using a uniform transform on each entire assembly. It is a relative scale comparison. The separate Empire reference is independently framed and is not a physical size comparison. No new physical measurement or bottle proportion correction is asserted.

## Verification

Two exact-SKU product pages passed in cap-beside, cap-on, and exploded views. All twelve finish selections across their two groups worked, with phone layout checks. Both Builder configurations and both catalog selections passed. Thirteen focused tests passed, including source preservation, exact-SKU catalog mapping, production exclusion and deep equality for the ten unchanged Round spray variants using fresh production and development snapshots. TypeScript and git diff whitespace checks passed.

The capture harness loads exact original public image bytes to bypass optimizer issues. Both product pages also passed separate normal-delivery checks without request overrides. Review tabs, before/after controls, equal-scale geometry and phone overflow checks passed. This validates the local candidate, not a deployed site.

## Source evidence

- [Clear exact-SKU source](https://www.bestbottles.com/product/round-design-78-ml-glass-bottle-shiny-silver-spray-and-cap), retrieved with its directly linked original images. The recorded 73 ± 1 mm bare height and 59 ± 1 mm diameter are source metadata, not newly measured dimensions.
- [Frosted exact-SKU source](https://nematinternational.com/product/Frosted-Glass-Perfume-Bottle-Round-Spray-Shiny-Silver-78ml/), discovered from the legacy classic spray bottle page and retrieved with its directly linked original image.
- Original PSD paths, hashes, layers and exact tube-byte verification are in psd-sources.json and native-source-check.json. Legacy image hashes and URLs are in legacy-image-receipts.json.

## Local boundaries and preservation

Review: http://127.0.0.1:3008/round78-pilot/ . App: http://localhost:3007 . Working checkout: /private/tmp/best-bottles-empire-alpha-20261019 . The original archive checkout remains untouched. No push, commit, deployment, backend mutation, order or checkout change was made.

The implementation bundle is cumulative from PR 369 base a892d9b0 and includes the earlier authorized Empire and selector work. It is preservation material, not a publication instruction. Apply implementation.patch to the matching base, then overlay implementation/. The separate Empire bundle remains unchanged. Evidence includes fresh Round source snapshots, before kits, verified original image cache, scripts and rendered comparisons. No environment files or credentials are included.
'''
(T/'REPORT.md').write_text(report)
for name in ['native-source-check.json','psd-sources.json','legacy-image-receipts.json','builder-export-results.json','catalog-results.json','native-delivery.json']:
 shutil.copy2(O/name,T/name)
# Append a scoped entry in the ledger without upgrading the full family.
ledger=json.loads((Q/'sku-readiness.json').read_text());codes={r['sku'] for r in rows}
for r in ledger:
 if r['sku'] in codes:r['visual']='Round two-bottle pilot: corrected native tube join and matching catalog export; visual review pending'
(Q/'sku-readiness.json').write_text(json.dumps(ledger,indent=2))
with (Q/'sku-readiness.csv').open('w') as f:
 w=csv.DictWriter(f,fieldnames=list(ledger[0]));w.writeheader();w.writerows(ledger)
h=(Q/'index.html').read_text();h=re.sub(r'const data=.*?;const esc=',lambda m:'const data='+json.dumps(ledger).replace('</','<\\/')+';const esc=',h,flags=re.S)
notice='<div class="note"><strong>Round 78 ml two-bottle pilot.</strong> Clear and frosted Shiny Silver are ready for <a href="../round78-pilot/">local visual review</a>. Other Round finishes retain their prior status.</div>'
if notice not in h:h=h.replace('<main>','<main>'+notice,1)
(Q/'index.html').write_text(h)
I=T/'implementation';I.mkdir(exist_ok=True)
files=subprocess.check_output(['git','diff','--name-only'],cwd=R,text=True).splitlines()+subprocess.check_output(['git','ls-files','--others','--exclude-standard','--','src','public','scripts','tests'],cwd=R,text=True).splitlines()
for name in sorted(set(files)):
 p=R/name
 if p.is_file():dst=I/name;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dst)
base=I/'output/local-media-baseline';base.mkdir(parents=True,exist_ok=True);shutil.copy2(R/'output/local-media-baseline/active.json',base/'active.json')
evidence=I/'output/round78-two-bottle-pilot'
shutil.copytree(O,evidence,dirs_exist_ok=True,ignore=shutil.ignore_patterns('*-error.png'))
(T/'implementation.patch').write_bytes(subprocess.check_output(['git','diff','--binary'],cwd=R))
E=T/'evidence-scripts';E.mkdir(exist_ok=True)
for name in ['export_round_pilot.py','capture_round_pilot.py','check_round_selectors.py','check_round_catalog.py','build_round_review.py','check_round_review.py','finalize_round_pilot.py']:
 shutil.copy2(Path('/private/tmp/bb-empire-alpha-evidence')/name,E/name)
with zipfile.ZipFile(T/'implementation-bundle.zip','w',zipfile.ZIP_DEFLATED) as z:
 for directory in [I,E]:
  for p in directory.rglob('*'):
   if p.is_file():z.write(p,p.relative_to(T))
 for name in ['implementation.patch','REPORT.md','verification.json']:z.write(T/name,name)
print(json.dumps(verification,indent=2));print('Bundle bytes:',(T/'implementation-bundle.zip').stat().st_size)
