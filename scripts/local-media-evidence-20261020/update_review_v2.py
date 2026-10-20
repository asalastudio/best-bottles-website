from pathlib import Path
import shutil,json,subprocess,re
from PIL import Image,ImageDraw,ImageFont
R=Path('/private/tmp/best-bottles-empire-alpha-20261019')
D=Path('/Users/jordanrichter/.codex/visualizations/2026/10/19/01a15606-c4e4-7692-9d6e-773c45309fd7/empire-pilot')
archive=D.parent/'empire-alpha-review-v1'
if not archive.exists():shutil.copytree(D,archive)
# The new comparison starts from the prior alpha pilot the user reviewed.
shutil.copytree(archive/'after',D/'before',dirs_exist_ok=True)
shutil.copytree(R/'output/empire-proportion-pilot/verified-after',D/'after',dirs_exist_ok=True)
final=R/'output/empire-proportion-pilot/final-100'
latest=json.loads((final/'results.json').read_text());assert len(latest)==3
assert all(not r.get('error') and not r.get('errors') for r in latest)
previous=json.loads((D/'after/results.json').read_text())
for r in latest:
 if r['surface']=='pdp':
  assert len(r['views'])==3
  for v in r['views'].values():
   assert all(i['w']>0 for i in v['images'])
   assert any('107x46.1abdf' in i['url'] for i in v['images'])
   assert any('native-spray-tube' in i['url'] for i in v['images'])
 elif r['surface']=='builder':
  assert any('107x46.1abdf' in i['url'] for i in r['images'])
  assert any('native-spray-tube' in i['url'] for i in r['images'])
 elif r['surface']=='catalog':
  assert any('f288887aedc8' in i['url'] for i in r['cards'][0]['images'])
  r['cards'].extend([c for c in next(x for x in previous if x['surface']=='catalog')['cards'] if c['size']==50])
latest.extend(r for r in previous if r.get('size')==50)
shutil.copytree(final,D/'after',dirs_exist_ok=True)
(D/'after/results.json').write_text(json.dumps(latest,indent=2))
for phase in ['before','after']:
 Image.open(D/phase/'pdp-100-exploded.png').crop((635,330,760,650)).save(D/f'tube-{phase}.png')
# Save a compact visual of the user-reported issue, using the actual page captures.
sheet=Image.new('RGB',(640,720),'#f5f3ef');draw=ImageDraw.Draw(sheet)
font=ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc',22)
for i,phase in enumerate(['before','after']):
 draw.text((32+i*320,22),'Before' if i==0 else 'After',font=font,fill='#23332e')
 crop=Image.open(D/f'tube-{phase}.png');crop=crop.resize((250,640),Image.Resampling.LANCZOS);sheet.paste(crop,(35+i*320,65))
sheet.save(D/'tube-comparison.png')
html=(archive/'index.html').read_text()
html=html.replace('Empire / Local media review','Empire / Corrected assembly review')
html=html.replace('Empire, with the backdrop removed.','Empire, one assembly across the site.')
html=html.replace('The same glass artwork, with transparency outside the bottle. Both exports preserve every original RGB pixel, the canvas dimensions, and the existing placement. Nothing has been published.','The 100 ml body now follows the 107 × 46 mm guide. Its native Photoshop tube replaces the broken extraction, and the catalog image comes directly from the same Builder assembly. Everything remains local.')
html=html.replace('Unchanged. This card still uses a separate finished-product image. It is the remaining source-consistency gap.','<span id="catalog-note">100 ml now uses an export of the same corrected assembly as the product page and Builder.</span>')
html=html.replace('The rectangular backdrop is removed. Exploded view makes the difference easiest to see.','The 100 ml silhouette is corrected and the source tube stays connected beneath the sprayer.')
html=html.replace('Expanded preview of the matching combination. Builder and the product page use the same new glass file.','Matching glass, tube, sprayer, and overcap. The catalog export uses these exact layer bytes and their placement.')
html=html.replace('<details><summary>Inspect the cutout edges and preserved glass</summary>', '<section id="tube-detail"><h2>The dip-tube correction</h2><p class="sub">The previous extraction carried background patches and discontinuities. The replacement is one continuous photographic housing and tube, seated against the sprayer’s visible edge.</p><div class="columns"><figure><figcaption>Before<span>Flattened-image cut</span></figcaption><div class="frame"><img src="tube-before.png" alt="Previous tube with patch and discontinuities"></div></figure><figure><figcaption>After<span>Continuous Photoshop source</span></figcaption><div class="frame"><img src="tube-after.png" alt="Native tube connected to the sprayer"></div></figure></div></section><details><summary>Original alpha-cutout review</summary>')
start=html.index('<details><summary>Verification and capture notes')
end=html.index('</footer>',start)+len('</footer>')
html=html[:start]+'''<details><summary>Verification and source notes</summary><p>21 focused tests passed. TypeScript and diff checks passed. The tests cover the measured silhouette, unchanged neck pixels, continuous source-tube rows, clean glass foot, exact catalog layer hashes, shared loaders, and production exclusion. Visual coverage includes both sizes, desktop product views, phone stages, catalog cards, and Builder previews.</p><p>Before is the previous alpha-only pilot. After is the corrected local assembly. The 50 ml is unchanged in this revision. The 100 ml geometric correction applies to its shared local glass master; source-tube recovery and the catalog export are scoped to Matte Gold spray SKU GBEmp100SpryMtGl.</p><p>Remote hardware requests in the capture harness use their original source bytes to bypass the local Next optimizer’s DNS64 issue. No production delivery claim is made. The body and tube come from local hashed assets.</p><p><a href="REPORT.md">Full handoff</a> · <a href="proportion-export.json">Proportion calculation</a> · <a href="catalog-export.json">Catalog layer provenance</a> · <a href="after/results.json">Displayed source records</a> · <a href="implementation-bundle.zip">Local implementation bundle</a></p></details><footer><h2>Ready for your local review</h2><p>Check the corrected 100 ml width and the complete tube in Exploded view. The catalog card, product page and Builder now show the same Matte Gold combination. The 50 ml remains available as the unchanged reference.</p><p class="fine">No production media, backend records, branches, or deployments were changed.</p></footer>'''+html[end:]
html=html.replace("'<strong>100 ml proportion check:</strong> Using your latest answer as a bare-glass height of 107 mm and outside width of 46 mm, the artwork is approximately 4.6% taller relative to its width. At 107 mm tall, its depicted width is about 44 mm. Geometry is unchanged in this pilot.'", "'<strong>100 ml corrected:</strong> Body width increased 4.64% to match the 107 × 46 mm ratio, with a smooth shoulder transition. Neck pixels, glass height, and hardware size are preserved. Raster-edge measurement is within 0.3% of the target ratio.'")
html=html.replace("'<strong>50 ml proportion check:</strong> The artwork’s silhouette ratio is within approximately 0.9% of the recorded 88 × 37 mm guide. This guide has not been physically remeasured in this session. Geometry is unchanged.'", "'<strong>50 ml unchanged reference:</strong> This revision changes the 100 ml only. The 50 ml retains its prior alpha cutout and separate catalog image.'")
html=html.replace("'Original local preview'", "'Previous alpha pilot'")
html=html.replace("s==='catalog'?'Same catalog image':'Alpha-only cutout'", "size==='50'?'Unchanged reference':s==='catalog'?'Exported shared assembly':'Corrected shared assembly'")
html=html.replace("document.querySelectorAll('[data-surface]').forEach", "document.querySelector('#catalog-note').textContent=size==='100'?'100 ml now uses an export of the same corrected assembly as the product page and Builder.':'50 ml retains its separate catalog image; this revision leaves it unchanged.';document.querySelector('#tube-detail').hidden=size!=='100';document.querySelectorAll('[data-surface]').forEach")
(D/'index.html').write_text(html)
for name in ['proportion-export.json','catalog-export.json','catalog-assembly.svg']:
 shutil.copy2(R/'output/empire-proportion-pilot'/name,D/name)
# Preserve every scoped changed file plus originals required to reproduce exports.
files=subprocess.check_output(['git','diff','--name-only'],cwd=R,text=True).splitlines()
files+=subprocess.check_output(['git','ls-files','--others','--exclude-standard'],cwd=R,text=True).splitlines()
files=[f for f in files if not f.startswith('output/')]
for f in files:
 target=D/'implementation'/f;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(R/f,target)
for name in ['export_catalog.py','capture_final.py','capture_final_100.py']:
 shutil.copy2(Path('/private/tmp/bb-empire-alpha-evidence')/name,D/name)
for name in ['proportion-final-tests.log','proportion-typecheck.log']:
 shutil.copy2(Path('/private/tmp/bb-empire-alpha-evidence')/name,D/name)
(D/'implementation.patch').write_text(subprocess.check_output(['git','diff'],cwd=R,text=True))
shutil.make_archive(str(D/'implementation-bundle'),'zip',D/'implementation')
print('Updated review and verified exact 100 ml sources across catalog, PDP and Builder.')
