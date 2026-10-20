from pathlib import Path
import json,shutil,subprocess,zipfile,csv,re
R=Path('/private/tmp/best-bottles-empire-alpha-20261019');O=R/'output/round78-spray-completion';D=Path('/Users/jordanrichter/.codex/visualizations/2026/10/19/01a15606-c4e4-7692-9d6e-773c45309fd7/empire-pilot');T=D/'round78-complete';Q=D/'readiness'
rows=json.loads((O/'after/results.json').read_text());sels=json.loads((O/'after/selector-results.json').read_text());builder=json.loads((O/'builder-export-results.json').read_text());catalog=json.loads((O/'catalog-results.json').read_text());native=json.loads((O/'native-delivery.json').read_text())
assert len(rows)==12 and len({r['sku'] for r in rows})==12
assert all(not r.get('error') and not r['pageErrors'] and r['sku']==r['itemName'] and len(r['views'])==3 and all(not v['broken'] and v['state']=='rendered' for v in r['views'].values()) for r in rows)
assert len(sels)==2 and sum(len(r['picks']) for r in sels)==12 and all(not r.get('error') and not r.get('pageErrors') and not r['phoneOverflow'] and len({json.dumps(p['bodyBox'],sort_keys=True) for p in r['picks']})==1 for r in sels)
assert len(builder)==12 and all(not r.get('error') and not r.get('pageErrors') for r in builder)
assert len(catalog['rows'])==12 and not catalog['pageErrors'] and all(not r.get('error') for r in catalog['rows']) and len(native)==3
verification={'scope':'All twelve Round 78 ml spray variants: six finishes in clear and frosted glass','visualAcceptance':'Shiny Silver pair accepted; ten additional variants pending review','published':False,'nextFamilyStarted':False,'exactSkus':[r['sku'] for r in rows],'pdpViews':36,'selectorChecks':12,'phoneGroups':2,'builderExports':12,'matchingCatalogChecks':12,'nativeDeliveryChecks':3,'testsPassed':15,'typecheck':'passed','diffWhitespaceCheck':'passed','acceptedPair':'deep equality against before kits passed in fresh development and production snapshots; catalog hashes preserved','review':json.loads((T/'review-check.json').read_text())}
(T/'verification.json').write_text(json.dumps(verification,indent=2)+'\n')
report='''# Round 78 ml spray completion, local review

All twelve spray variants now use the approved clear/frosted Shiny Silver approach. The other ten variants add Copper, Matte Gold, Matte Silver, Shiny Gold and Shiny Black in both glass colors. The full comparison is awaiting visual acceptance; the original pair remains accepted and unchanged. No next family was started.

## Changes

Each of the five additional shared sprayers uses its recorded visible lower edge to place the native Round tube. Exact SKU, component, source URL, source dimensions, plate and registration guards remain active. The closure's existing transparent padding no longer determines the tube join. The assembly remains local to development with VERCEL unset.

Glass, hardware and tube image bytes, glass placement, hardware scale, tube length, tube width and seated clear/frosted attenuation are retained. The Round tube remains the verified intact native RGBA layer from the original clear Shiny Silver PSD. Existing clear and frosted opacities of 0.65 and 0.22 remain presentation settings, not new physical material measurements. The exploded tube moves with its own sprayer. Lotion pumps and other Round applicators were outside this request.

Ten additional catalog images were exported from their actual Builder SVGs with original image bytes embedded. All twelve were rechecked, including the accepted pair. The accepted Shiny Silver catalog hashes are preserved. Each catalog swatch shows and links to its exact SKU. Empire imagery and the approved pilot review remain available separately.

## Verification

All twelve exact-SKU product pages passed in cap-beside, cap-on and exploded views: 36 views. All twelve finish selections across the two product groups passed, with a fixed glass body during switching and clean phone layouts. All twelve Builder configurations and catalog swatch selections passed. Three additional product pages passed normal image delivery without request overrides.

Fifteen focused tests passed. They cover source integrity, continuous tube content, preserved glass and hardware, exact joins, movement with the sprayer, source-change guards, accepted-pair equality in refreshed production and development snapshots, catalog output hashes and production exclusion. TypeScript and git diff whitespace checks passed.

All six review finish controls, six surfaces, both before/after glass choices, and phone layout passed. Each relative-scale board gives both Round glass bodies the same 400-pixel registered rim-to-foot height and baseline, uniformly scaling the entire assembly. The Empire reference is independently framed, not a physical size comparison. No new measurement or geometry change is asserted.

The broad browser captures use exact original image URLs to bypass local optimizer transport issues. Normal-delivery spot checks are recorded separately. Initial hydration and Builder loading timeouts were retained. The local preview was restarted, and an export resume bookkeeping error was fixed. Affected checks were repeated successfully. Local checks do not establish deployed behavior.

## Sources and evidence

Fresh production and development records were read for the twelve spray SKUs, with environment and time labels. Original public image bytes were cached with hashes. All twelve exact-SKU PSD masters were located and hashed without modification. Native tube lineage and the original source comparison remain in the two-bottle pilot report.

Supplemental current legacy evidence includes eight directly linked Round 78 spray pages; seven identify an exact SKU in the retrieved HTML. This supplemental sample is not a full family catalog reconciliation or a new commercial-data audit. No product facts, pricing or catalog records were changed. The requested twelve-variant scope comes from the existing two spray groups and the user's approved extension.

## Local review and preservation

Review: http://127.0.0.1:3008/round78-complete/ . App: http://localhost:3007 . Working checkout: /private/tmp/best-bottles-empire-alpha-20261019 . The original archive checkout remains untouched. No push, commit, deployment, backend mutation, order or checkout change was made.

The implementation bundle is cumulative from PR 369 base a892d9b0 and includes earlier authorized Empire, selector and Round pilot work. Apply implementation.patch to the matching base, then overlay implementation/. Preserve source files and use the included snapshots and scripts for reproduction. The earlier review bundles remain unchanged. No environment files or credentials are included.
'''
(T/'REPORT.md').write_text(report)
for name in ['builder-export-results.json','catalog-results.json','native-delivery.json','master-inventory.json','image-cache-index.json']:
 shutil.copy2(O/name,T/name)
shutil.copy2(O/'after/results.json',T/'pdp-results.json');shutil.copy2(O/'after/selector-results.json',T/'selector-results.json')
ledger=json.loads((Q/'sku-readiness.json').read_text());codes={r['sku'] for r in rows}
for r in ledger:
 if r['sku'] in codes:r['visual']='Round spray completion: native tube join and matching catalog export; full comparison ready for local review'
(Q/'sku-readiness.json').write_text(json.dumps(ledger,indent=2))
with (Q/'sku-readiness.csv').open('w') as f:
 w=csv.DictWriter(f,fieldnames=list(ledger[0]));w.writeheader();w.writerows(ledger)
for name,new,key in [('results.json',rows,'sku'),('selector-results.json',sels,'group')]:
 old=json.loads((Q/name).read_text());updates={r[key]:r for r in new};(Q/name).write_text(json.dumps([updates.get(r[key],r) for r in old],indent=2))
for p in (O/'after').glob('*.png'):shutil.copy2(p,Q/p.name)
h=(Q/'index.html').read_text();h=re.sub(r'<div class="note"><strong>Round 78 ml two-bottle pilot\.</strong>.*?</div>','',h,flags=re.S);h=re.sub(r'const data=.*?;const esc=',lambda m:'const data='+json.dumps(ledger).replace('</','<\\/')+';const esc=',h,flags=re.S)
notice='<div class="note"><strong>Round 78 ml sprays completed locally.</strong> All twelve variants have matching assemblies and catalog images. <a href="../round78-complete/">Review all six finishes in clear and frosted glass</a>.</div>'
if notice not in h:h=h.replace('<main>','<main>'+notice,1)
(Q/'index.html').write_text(h)
summary=json.loads((Q/'summary.json').read_text());summary['round78SprayCompletion']=verification;(Q/'summary.json').write_text(json.dumps(summary,indent=2))
I=T/'implementation';I.mkdir(exist_ok=True);files=subprocess.check_output(['git','diff','--name-only'],cwd=R,text=True).splitlines()+subprocess.check_output(['git','ls-files','--others','--exclude-standard','--','src','public','scripts','tests'],cwd=R,text=True).splitlines()
for name in sorted(set(files)):
 p=R/name
 if p.is_file():dst=I/name;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dst)
base=I/'output/local-media-baseline';base.mkdir(parents=True,exist_ok=True);shutil.copy2(R/'output/local-media-baseline/active.json',base/'active.json')
for folder in ['round78-spray-completion','round78-two-bottle-pilot']:shutil.copytree(R/'output'/folder,I/'output'/folder,dirs_exist_ok=True,ignore=shutil.ignore_patterns('*-error.png'))
(T/'implementation.patch').write_bytes(subprocess.check_output(['git','diff','--binary'],cwd=R))
E=T/'evidence-scripts';E.mkdir(exist_ok=True)
for name in ['prepare_round_complete.py','round_legacy_evidence.py','export_round_complete.py','resume_round_complete_exports.py','capture_round_complete_before.py','capture_round_complete.py','check_round_complete_selectors.py','check_round_complete_catalog.py','build_round_complete_review.py','check_round_complete_review.py','finalize_round_complete.py']:
 shutil.copy2(Path('/private/tmp/bb-empire-alpha-evidence')/name,E/name)
with zipfile.ZipFile(T/'implementation-bundle.zip','w',zipfile.ZIP_DEFLATED) as z:
 for directory in [I,E]:
  for p in directory.rglob('*'):
   if p.is_file():z.write(p,p.relative_to(T))
 for name in ['implementation.patch','REPORT.md','verification.json']:z.write(T/name,name)
print(json.dumps(verification,indent=2));print('Bundle bytes:',(T/'implementation-bundle.zip').stat().st_size)
