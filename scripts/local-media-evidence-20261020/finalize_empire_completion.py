from pathlib import Path
import json,shutil,csv,re,subprocess,zipfile,hashlib
R=Path('/private/tmp/best-bottles-empire-alpha-20261019');O=R/'output/empire-completion-pilot';D=Path('/Users/jordanrichter/.codex/visualizations/2026/10/19/01a15606-c4e4-7692-9d6e-773c45309fd7/empire-pilot');T=D/'empire-complete';Q=D/'readiness'
rows=json.loads((O/'pdp/results.json').read_text());sels=json.loads((O/'pdp/selector-results.json').read_text());catalog=json.loads((O/'catalog-results.json').read_text());builder=json.loads((O/'builder-export-results.json').read_text())
assert len(rows)==91 and len({r['sku'] for r in rows})==91
assert all(not r.get('error') and not r.get('pageErrors') and r['sku']==r['itemName'] for r in rows)
assert all(not v.get('broken') and v['state']!='not-offered' for r in rows for v in r['views'].values())
assert len(sels)==11 and sum(len(r['picks']) for r in sels)==91
assert all(not r.get('error') and not r.get('pageErrors') and not r['phoneOverflow'] and len({json.dumps(p['bodyBox'],sort_keys=True) for p in r['picks']})==1 for r in sels)
assert len(catalog['rows'])==14 and not catalog['pageErrors'] and all(not r.get('error') for r in catalog['rows'])
assert len(builder)==14 and all(not r.get('error') and not r.get('pageErrors') for r in builder)
verification={'date':'2026-10-19','scope':'Local Empire media completion; owner visual acceptance pending','exactSkuChecks':91,'finishSelectorChecks':91,'phonePageGroups':11,'renderedPdpViews':sum(v['state']=='rendered' for r in rows for v in r['views'].values()),'disabledSidecar':sum(r['views']['sidecar']['state']=='disabled' for r in rows),'sharedGlassAssemblies':91,'nativeSprayAssemblies':12,'whitePumpAssemblies':2,'builderChecks':14,'matchingCatalogExports':14,'catalogSwatchChecks':14,'automatedTests':46,'typecheck':'passed','diffCheck':'passed','published':False,'nextFamilyStarted':False,'initialDevServerErrors':'Two page checks and one selector group encountered local HMR errors. Affected checks reran clean after recompilation. Initial evidence retained.'}
(T/'verification.json').write_text(json.dumps(verification,indent=2)+'\n')
for name in ['builder-export-results.json','catalog-results.json','source-recovery.json','sprayer-registration.json','psd-inventory.json','native-delivery.json']:
 if (O/name).exists():shutil.copy2(O/name,T/name)
shutil.copytree(O/'pdp',T/'pdp',dirs_exist_ok=True)
for code in [r['websiteSku'] for r in builder]:
 for v in ['capon','sidecar','exploded']:
  if (O/'pdp'/(code+'-'+v+'.png')).exists():shutil.copy2(O/'pdp'/(code+'-'+v+'.png'),T/'after'/(code+'-'+v+'.png'))
report='''# Empire completion, local review

Completed the ten remaining spray finishes, the 100 ml white pump, and matching catalog exports. Both white-pump sizes are included so the comparison is complete.

## What changed

- All 91 Empire register assemblies now use one shared glass master per size. The 100 ml glass retains the confirmed 107 × 46 mm proportions. The 50 ml comparison uses the existing 88 × 37 mm guide, not a new measurement.
- Twelve spray SKUs use continuous native Photoshop housing-and-tube crops. The ten additional crops preserve RGBA pixels and record their exact PSD path, hash, layer and crop. The visible lower edge of each registered sprayer determines the tube join; the images are not stretched.
- The 100 ml white pump now composes from the retained source-backed white 18-415 hardware, existing empty-cover candidate, its own native Empire tube, and the corrected shared glass. Exact SKU, unresolved-assembly and plate guards prevent replacement of a published or changed assembly.
- Fourteen catalog images are direct exports of the actual Builder sidecar SVG with original layer bytes embedded. Finish swatches show and link to the matching SKU.
- All overlays remain gated to development with VERCEL unset. No backend, remote media, publication, checkout, or orders changed.

## Verification

91 exact-SKU product pages, 91 finish selections, 147 available desktop views, and 11 phone page groups passed. The body stays fixed during finish changes. 63 configurations retain the existing disabled Sidecar policy. Fourteen Builder selections and fourteen catalog swatches passed. Catalog and comparison phone layouts have no horizontal overflow. Seven common-scale comparison boards preserve source image bytes and child transforms.

46 focused tests, TypeScript and git diff whitespace checks passed. Tests cover source integrity, continuous tube rows, shared body geometry across the entire family, the white-pump join, exact SKU catalog routing, changed-source guards and production exclusion. Initial HMR errors were retained and the affected checks reran clean after recompilation.

The broad capture harness routes remote hardware image requests to the exact original public source URLs to bypass local optimizer DNS trouble. Separate native-delivery spot checks are recorded when complete. Saved Empire production data supplies the local app; this is not deployed behavior verification.

## Review boundaries

Visual approval remains pending. The white pump uses the prior local empty-cover candidate. The common-scale boards retain the approximately 1.7% hardware-calibration difference between the existing 50 ml and 100 ml assemblies; hardware dimensions have not been remeasured. Other families have not been changed in this completion pass.

Open http://127.0.0.1:3008/empire-complete/ . The app remains at http://localhost:3007 . Implementation is in /private/tmp/best-bottles-empire-alpha-20261019 . Original archive checkout remains untouched.

## Reproduction and preservation

The implementation bundle is cumulative from PR 369's base checkout and includes earlier authorized local selector and Empire changes. Apply implementation.patch to the same base, then overlay the files in implementation/. It contains local source assets, manifests, scripts, tests and the saved baseline. The new prepare-empire-remaining-sources.py runs after the earlier pilot source scripts. export_empire_all.py reexports the matching catalog assemblies from the local Builder. Browser and review scripts are in evidence-scripts/. No environment secrets are included.
'''
(T/'REPORT.md').write_text(report)
# Refresh the existing all-family ledger with these verified Empire results.
ledger=json.loads((Q/'sku-readiness.json').read_text())
for r in ledger:
 if r['family']=='Empire':
  if 'Spry' in r['sku'] or 'WhtClOvr' in r['sku']:r['visual']='Completed local candidate: shared glass, native tube, matching catalog export; visual review pending'
  else:r['visual']='Shared glass applied; functional checks passed; visual acceptance remains separate'
(Q/'sku-readiness.json').write_text(json.dumps(ledger,indent=2))
with (Q/'sku-readiness.csv').open('w') as f:
 w=csv.DictWriter(f,fieldnames=list(ledger[0]));w.writeheader();w.writerows(ledger)
for name,new,key in [('results.json',rows,'sku'),('selector-results.json',sels,'group')]:
 old=json.loads((Q/name).read_text());updated={r[key]:r for r in new};merged=[updated.get(r[key],r) for r in old];(Q/name).write_text(json.dumps(merged,indent=2))
for p in (O/'pdp').glob('*.png'):shutil.copy2(p,Q/p.name)
h=(Q/'index.html').read_text();h=re.sub(r'const data=.*?;const esc=',lambda m:'const data='+json.dumps(ledger).replace('</','<\\/')+';const esc=',h,flags=re.S)
h=h.replace('90 of 91 combinations use the shared glass masters. The 100 ml white pump remains on its older complete kit. The ten other perfume-spray finishes still need the same native-tube treatment as the two Matte Gold pilots.','All 91 combinations use the shared glass masters. All twelve spray SKUs and both white pumps have completed local assemblies. <a href="../empire-complete/">Review the completed Empire comparison</a>.')
h=h.replace('The two Empire Matte Gold spray catalog images use their shared assemblies. That catalog-export pass has not been extended to every finish.','All twelve Empire spray finishes and both white pumps now use catalog images exported from their matching Builder assemblies. Other families retain their earlier status.')
h=h.replace('Empire spray follow-up','Empire completed media').replace("r.visual.includes('still needed')","r.visual.includes('Completed local candidate')")
h=h.replace('Fresh production catalog and register queries on 19 October, replayed through the current local renderer.','Historical checkpoint from before the Empire completion pass: production catalog and register queries on 19 October, replayed through that local renderer.')
h=h.replace('<h2>What still needs work</h2>','<h2>Current media status</h2>');(Q/'index.html').write_text(h)
summary=json.loads((Q/'summary.json').read_text());summary['empireCompletion']=verification;(Q/'summary.json').write_text(json.dumps(summary,indent=2))
# Visible route from the previous review without replacing it.
h=(D/'index.html').read_text();notice='<div class="note"><strong>Empire completion ready for review.</strong> All twelve spray finishes and both white pumps are together in the <a href="empire-complete/">updated comparison</a>.</div>'
if notice not in h:h=h.replace('<main>','<main>'+notice,1)
(D/'index.html').write_text(h)
# Durable implementation overlay, patch, baseline and reproducible evidence scripts.
I=T/'implementation';I.mkdir(exist_ok=True);files=subprocess.check_output(['git','diff','--name-only'],cwd=R,text=True).splitlines()+subprocess.check_output(['git','ls-files','--others','--exclude-standard','--','src','public','scripts','tests'],cwd=R,text=True).splitlines()
for name in sorted(set(files)):
 p=R/name
 if p.is_file():dest=I/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dest)
base=I/'output/local-media-baseline';base.mkdir(parents=True,exist_ok=True);shutil.copy2(R/'output/local-media-baseline/active.json',base/'active.json')
receipts=I/'output/empire-completion-pilot';receipts.mkdir(parents=True,exist_ok=True)
for name in ['source-register.json','sprayer-registration.json','psd-inventory.json','kits.json']:shutil.copy2(O/name,receipts/name)
(T/'implementation.patch').write_bytes(subprocess.check_output(['git','diff','--binary'],cwd=R))
E=T/'evidence-scripts';E.mkdir(exist_ok=True)
for name in ['export_empire_all.py','audit_empire_completion.py','audit_empire_selectors.py','check_empire_catalog.py','check_empire_native_delivery.py','build_empire_completion_review.py','check_empire_completion_review.py','finalize_empire_completion.py']:
 shutil.copy2(Path('/private/tmp/bb-empire-alpha-evidence')/name,E/name)
with zipfile.ZipFile(T/'implementation-bundle.zip','w',zipfile.ZIP_DEFLATED) as z:
 for directory in [I,E]:
  for p in directory.rglob('*'):
   if p.is_file():z.write(p,p.relative_to(T))
 for name in ['implementation.patch','REPORT.md','verification.json']:z.write(T/name,name)
print(json.dumps(verification,indent=2));print('Bundle bytes',(T/'implementation-bundle.zip').stat().st_size)
