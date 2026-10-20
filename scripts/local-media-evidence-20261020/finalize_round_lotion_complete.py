from pathlib import Path
import json,shutil,subprocess,csv,re,zipfile
R=Path('/private/tmp/best-bottles-empire-alpha-20261019');O=R/'output/round78-lotion-completion';D=Path('/Users/jordanrichter/.codex/visualizations/2026/10/19/01a15606-c4e4-7692-9d6e-773c45309fd7/empire-pilot');T=D/'round78-lotion-complete';Q=D/'readiness'
def read(p):return json.loads(p.read_text())
rows=read(O/'after/results.json');sels=read(O/'after/selector-results.json');builder=read(O/'builder-export-results.json');catalog=read(O/'catalog-results.json');native=read(O/'native-delivery.json');sources=read(O/'psd-sources.json');legacy=read(O/'legacy/receipts.json')
assert len(rows)==14 and all(not r.get('error') and not r['pageErrors'] and r['sku']==r['itemName'] and len(r['views'])==3 and all(not v['broken'] and v['state']=='rendered' for v in r['views'].values()) for r in rows)
assert len(sels)==2 and sum(len(r['picks']) for r in sels)==14 and all(not r.get('error') and not r['pageErrors'] and not r['phoneOverflow'] and len({json.dumps(p['bodyBox'],sort_keys=True) for p in r['picks']})==1 for r in sels)
assert len(builder)==14 and all(not r.get('error') and not r['pageErrors'] and r['exactSku'] for r in builder)
assert len(catalog['rows'])==14 and not catalog['pageErrors'] and not catalog['phoneOverflow'] and all(not r.get('error') for r in catalog['rows'])
assert len(native)==3 and len(sources)==14 and sum(len(s['masters']) for s in sources)==28
assert len(legacy['assets'])==56 and all('error' not in a for a in legacy['assets'])
assert {p['websiteSku'] for p in legacy['products']}=={r['sku'] for r in rows}
accepted={'LBRnd78LtnShnSl','LBRndFrst78LtnShnSl'}
verification={'scope':'All fourteen Round 78 ml lotion-pump variants, seven options in clear and frosted','date':'2026-10-20','visualAcceptance':{'acceptedShinySilverPair':sorted(accepted),'additionalTwelve':'pending'},'published':False,'exactSkus':[r['sku'] for r in rows],'pdpViews':42,'selectorChecks':14,'phoneGroups':2,'builderExports':14,'matchingCatalogChecks':14,'nativeDeliveryChecks':3,'testsPassed':17,'typecheck':'passed','diffWhitespaceCheck':'passed','sourceMastersInspected':28,'legacyGalleryViewsRecovered':56,'assemblyGeometry':'All fourteen existing local lotion assemblies unchanged against fresh before kits in both production and development snapshots','acceptedPairPixels':'SHA-256 identical to approved pilot','legacyIdentity':'All fourteen exact SKUs verified on current Best Bottles product pages reached through category and option-selector links','legacyScope':'Previous six-SKU Nemat listing discrepancy resolved; Best Bottles selectors include all fourteen','physicalFit':'Existing uniform source fit retained; no new measurements or physical-fit verification','review':read(T/'review-check.json')}
(T/'verification.json').write_text(json.dumps(verification,indent=2)+'\n')
report='''# Round 78 ml lotion pumps, full local comparison

All fourteen variants are ready for comparison across catalog, product page and Builder: clear and frosted glass with Matte Gold, Shiny Gold, Shiny Black, Matte Silver, Shiny Silver, Copper, and a matte silver pump with clear overcap. The Shiny Silver pair was accepted locally before this extension. The additional twelve await visual review.

## What changed

Twelve additional catalog images are direct exports of their actual local Builder SVGs with original image bytes embedded. Each catalog swatch displays and links to its exact SKU. The accepted pair's catalog pixels remain identical by SHA-256. Local entries are enabled only in development with VERCEL unset.

All fourteen existing local lotion assemblies retain their glass, pump, cap, tube geometry and source pixels. No new geometry correction, image editing or tube extraction was needed. Both production and development snapshot comparisons match the before kits. The previous Round spray, Diva and Empire catalog regression checks pass.

Clear and frosted drawings share the same registered rim-to-foot display height and baseline, with a uniform transform on each complete assembly. The separately framed Round spray reference is not part of that scale comparison.

## Sources and resolved scope

All fourteen exact SKUs are present on current Best Bottles product pages, reached from observed category and option-selector links. Fresh pages, selectable tiers, original HTML, hashes and all 56 gallery views were preserved. The older Nemat listing covered eight of these products; it was incomplete for this scope. The six previously unresolved matches are now confirmed. No product was inferred retired or removed.

Twenty-eight exact-SKU capped and uncapped Photoshop masters were inspected and hashed from Achive. The clear Copper masters were in nested capped and uncapped folders missing from the archive checkout; their exact native files were recovered read-only from Achive. No master was changed. Native previews and original legacy gallery images remain available for review. A preliminary archive-only lookup failure was resolved by searching the full master drive.

The tube remains the original Round 78 ml Matte Gold lotion source, uniformly scaled by the existing local adapter and shared across finishes. Its native master hash was verified during the pilot; continuity and original PNG hash pass in this run. This is not an exact separate tube extraction for every finish, and physical fit has not been newly measured.

Frosted raw matrix rows label the cap color Frosted. Export inputs retain sourceCapColor and use the finish matched by exact registered pump identity and image URL to the clear variant, corroborated by exact legacy pages. No backend metadata was changed. The clear-overcap option retains its distinct matte silver pump and transparent overcap.

The current Best Bottles pages explicitly identify bare-glass height 73 ±1 mm and diameter 59 ±1 mm, supporting the current glass dimensions. With-cap height varies by assembly and is preserved separately in the evidence. The older Nemat height 96 mm and malformed weight 25786 are not adopted. Raw pricing tiers and descriptions are preserved for later release reconciliation; no commerce data was changed.

## Verification

Fourteen exact-SKU product pages passed cap-beside, cap-on and exploded states, 42 views total. Both selectors passed seven choices each with stable glass bodies, correct SKU/context/URL and decoded images. Both phone layouts passed. Fourteen Builder exports and fourteen catalog selections passed. Three normal-delivery page checks passed without request overrides, including Copper, Matte Gold and clear-overcap variants.

The review's seven options across seven surfaces, both native-source comparisons, equal-scale geometry and phone layout passed. Seventeen focused tests passed, covering tube continuity, source and catalog hashes, all-assembly preservation, accepted-pair pixel preservation, exact catalog mapping, previous-family regressions, and exclusion from production and Vercel. TypeScript and git diff whitespace checks passed.

Original cached source bytes were used by browser exports where needed. These results verify the local app and review, not a deployed site.

## Review and preservation

Review: http://127.0.0.1:3008/round78-lotion-complete/ . App: http://localhost:3007 . Working checkout: /private/tmp/best-bottles-empire-alpha-20261019 . Review the complete set before starting the next family.

All changes remain local. No push, commit, deployment, source-master modification, backend mutation, order or checkout change was made. The implementation bundle is cumulative from PR 369 base a892d9b0. Apply implementation.patch to the matching base, then overlay implementation/. It includes changed code/assets, the Empire local baseline, this batch's evidence, and prior snapshots used by regression tests. Earlier review bundles remain intact. No environment files or credentials are included.
'''
(T/'REPORT.md').write_text(report)
for name in ['psd-sources.json','builder-export-results.json','catalog-results.json','native-delivery.json','image-cache-index.json','test-output.txt']:shutil.copy2(O/name,T/name)
shutil.copytree(O/'legacy',T/'legacy',dirs_exist_ok=True)
for name,out in [('results.json','pdp-results.json'),('selector-results.json','selector-results.json')]:shutil.copy2(O/'after'/name,T/out)
ledger=read(Q/'sku-readiness.json');codes=set(verification['exactSkus'])
for r in ledger:
 if r['sku'] in codes:r['visual']='Round lotion: matching catalog, PDP and Builder; '+('Shiny Silver pair accepted locally; not published' if r['sku'] in accepted else 'local visual review pending')
(Q/'sku-readiness.json').write_text(json.dumps(ledger,indent=2))
with (Q/'sku-readiness.csv').open('w') as f:
 w=csv.DictWriter(f,fieldnames=list(ledger[0]));w.writeheader();w.writerows(ledger)
for name,new,key in [('results.json',rows,'sku'),('selector-results.json',sels,'group')]:
 old=read(Q/name);updates={r[key]:r for r in new};(Q/name).write_text(json.dumps([updates.get(r[key],r) for r in old],indent=2))
for p in (O/'after').glob('*.png'):shutil.copy2(p,Q/p.name)
h=(Q/'index.html').read_text();h=re.sub(r'const data=.*?;const esc=',lambda m:'const data='+json.dumps(ledger).replace('</','<\\/')+';const esc=',h,flags=re.S);h=re.sub(r'<div class="note"><strong>Round 78 ml lotion-pump pilot\.</strong>.*?</div>','',h,flags=re.S)
notice='<div class="note"><strong>Round 78 ml lotion pumps.</strong> All fourteen are ready in the <a href="../round78-lotion-complete/">full local comparison</a>. The Shiny Silver pair is accepted; twelve additional variants await visual review. All fourteen exact legacy matches are confirmed.</div>'
if notice not in h:h=h.replace('<main>','<main>'+notice,1)
(Q/'index.html').write_text(h)
s=read(Q/'summary.json');s['round78LotionCompletion']=verification;s['round78LotionPilot']['legacyScopeResolution']='All fourteen exact SKUs verified in the subsequent completion; see round78LotionCompletion';(Q/'summary.json').write_text(json.dumps(s,indent=2))
pilot=D/'round78-lotion-pilot/index.html';h=pilot.read_text();notice='<div class="note">Source update: all fourteen Round lotion SKUs have now been confirmed on current Best Bottles pages. See the <a href="../round78-lotion-complete/">full local comparison</a>.</div>'
if notice not in h:h=h.replace('<main>','<main>'+notice,1)
pilot.write_text(h)
I=T/'implementation';I.mkdir(exist_ok=True)
files=subprocess.check_output(['git','diff','--name-only'],cwd=R,text=True).splitlines()+subprocess.check_output(['git','ls-files','--others','--exclude-standard','--','src','public','scripts','tests'],cwd=R,text=True).splitlines()
for name in sorted(set(files)):
 p=R/name
 assert not any(part.startswith('.env') or part in ['node_modules','.git'] for part in Path(name).parts)
 if p.is_file():dest=I/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dest)
base=I/'output/local-media-baseline';base.mkdir(parents=True,exist_ok=True);shutil.copy2(R/'output/local-media-baseline/active.json',base/'active.json')
shutil.copytree(O,I/'output/round78-lotion-completion',dirs_exist_ok=True)
for folder in ['round78-lotion-pilot','round78-spray-completion','diva46-spray-completion']:
 target=I/'output'/folder;target.mkdir(exist_ok=True)
 for p in (R/'output'/folder).glob('*.json'):shutil.copy2(p,target/p.name)
(T/'implementation.patch').write_bytes(subprocess.check_output(['git','diff','--binary'],cwd=R))
E=T/'evidence-scripts';E.mkdir(exist_ok=True)
for name in ['inspect_round_lotion_complete_sources.py','cache_round_lotion_complete_sources.py','export_round_lotion_complete.py','capture_round_lotion_complete.py','check_round_lotion_complete_selectors.py','check_round_lotion_complete_catalog.py','build_round_lotion_complete_review.py','check_round_lotion_complete_review.py','round_lotion_complete_legacy_assets.py','round_lotion_source_contacts.py','finalize_round_lotion_complete.py']:shutil.copy2(Path('/private/tmp/bb-empire-alpha-evidence')/name,E/name)
with zipfile.ZipFile(T/'implementation-bundle.zip','w',zipfile.ZIP_DEFLATED) as z:
 for directory in [I,E]:
  for p in directory.rglob('*'):
   if p.is_file():z.write(p,p.relative_to(T))
 for name in ['implementation.patch','REPORT.md','verification.json']:z.write(T/name,name)
with zipfile.ZipFile(T/'implementation-bundle.zip') as z:assert z.testzip() is None
print('Round lotion full comparison preserved:',len(rows),'SKUs; bundle bytes:',(T/'implementation-bundle.zip').stat().st_size)
