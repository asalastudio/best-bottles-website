from pathlib import Path
import json,shutil,subprocess
R=Path('/private/tmp/best-bottles-empire-alpha-20261019')
D=Path('/Users/jordanrichter/.codex/visualizations/2026/10/19/01a15606-c4e4-7692-9d6e-773c45309fd7/empire-pilot')
O=R/'output/empire-both-sizes-pilot'
results=json.loads((O/'after/results.json').read_text())
assert len(results)==5 and all(not r.get('error') and not r.get('errors') for r in results)
for size in [50,100]:
 tube=json.loads((R/('src/lib/register/local-empire-100ml-spray-tube.json' if size==100 else 'src/lib/register/local-empire-additional-spray-tubes.json')).read_text());tube=tube if size==100 else tube[0]
 hero=json.loads((R/('src/lib/products/local-empire-catalog-hero.json' if size==100 else 'src/lib/products/local-empire-additional-catalog-heroes.json')).read_text());hero=hero if size==100 else hero[0]
 for row in results:
  if row.get('size')!=size:continue
  groups=[v['images'] for v in row['views'].values()] if row['surface']=='pdp' else [row['images']]
  if row['surface']=='pdp':assert len(groups)==3
  for images in groups:
   assert any(tube['url'].split('/')[-1] in i['url'] for i in images)
 card=next(c for r in results if r['surface']=='catalog' for c in r['cards'] if c['size']==size)
 assert any(hero['url'].split('/')[-1] in i['url'] for i in card['images'])
 shutil.copy2(R/'public'/hero['url'].lstrip('/'),D/f'assembly-{size}.png')
shutil.copytree(D.parent/'empire-100ml-review-v2/after',D/'previous',dirs_exist_ok=True)
shutil.copytree(O/'after',D/'after',dirs_exist_ok=True)
(D/'index.html').write_text('''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Empire / Both sizes</title><style>
:root{font-family:Arial,sans-serif;color:#26372e;background:#f5f3ef}*{box-sizing:border-box}body{margin:0}main{max-width:1200px;margin:auto;padding:36px 32px 60px}header{border-bottom:1px solid #cdd3c9;padding-bottom:20px}.eyebrow{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#617366}h1{font:42px/1.1 Georgia,serif;margin:14px 0}p{font-size:14px;line-height:1.6;color:#536459;max-width:950px}.columns{display:grid;grid-template-columns:1fr 1fr;gap:18px}section{margin:28px 0 38px}h2{font:26px Georgia,serif;margin:0 0 8px}.sub{font-size:12px;margin:0 0 16px}figure{margin:0;border:1px solid #d8ded5;background:#f5f3ef;min-width:0}figcaption{padding:12px 16px;font-size:13px;background:#fff;border-bottom:1px solid #e4e7df;display:flex;justify-content:space-between;gap:10px}figcaption span{color:#748076;font-size:11px}.frame{display:flex;align-items:center;justify-content:center;height:440px;padding:8px}img{max-width:100%;max-height:100%;object-fit:contain;display:block}.hero .frame{height:430px}.catalog .frame{height:320px}.bar{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:0 0 16px}.tabs{display:flex;gap:5px;flex-wrap:wrap}button{font:12px Arial;padding:9px 13px;background:transparent;border:1px solid #b8c5b9;border-radius:3px;color:#294132;cursor:pointer}button[aria-pressed=true]{background:#314c3d;color:#fff}.note{padding:14px 18px;background:#e7ece3;font-size:13px;line-height:1.6;border-left:3px solid #75886a}.note p{margin:3px 0;font-size:13px}details{border-top:1px solid #ccd4c9;padding:18px 0}summary{cursor:pointer;font-size:14px}a{color:inherit}.tube-window{height:290px;overflow:hidden;position:relative}.tube-window img{position:absolute;width:1392px;max-width:none;max-height:none;left:calc(50% - 696px);top:-402px}.fine{font-size:12px;color:#718073}footer{padding-top:20px;border-top:1px solid #ccd4c9}@media(max-width:650px){main{padding:24px 12px}h1{font-size:32px}.columns{gap:7px}.frame,.hero .frame{height:290px}.catalog .frame{height:230px}figcaption{padding:9px;font-size:11px}figcaption span{display:none}.bar{align-items:flex-start;flex-direction:column}.tube-window{height:260px}}
</style></head><body><main><header><div class="eyebrow">Best Bottles · Empire pilot · Local review · Revision 3</div><h1>Both sizes, consistent across the site.</h1><p>The 50 ml now uses its continuous Photoshop dip tube and a catalog image exported from the same assembly as the product page and Builder. The corrected 100 ml assembly is retained alongside it.</p></header>
<section class="hero" id="both-sizes"><div class="columns"><figure><figcaption>Empire 50 ml<span>Shared assembly · Matte Gold</span></figcaption><a class="frame" href="assembly-50.png" target="_blank"><img src="assembly-50.png" alt="Empire 50 ml shared catalog assembly"></a></figure><figure><figcaption>Empire 100 ml<span>Shared assembly · Matte Gold</span></figcaption><a class="frame" href="assembly-100.png" target="_blank"><img src="assembly-100.png" alt="Empire 100 ml shared catalog assembly"></a></figure></div><p class="fine">Each image is framed independently, as it is in the catalog. This is not a physical scale comparison.</p><div class="note"><p><strong>50 ml:</strong> Existing glass pixels and geometry preserved. Silhouette ratio is within about 0.9% of the recorded 88 × 37 mm guide; those dimensions have not been remeasured in this session.</p><p><strong>100 ml:</strong> Retains the 107 × 46 mm correction and native source tube from the prior review.</p></div></section>
<section class="catalog"><h2>01 / Catalog cards</h2><p class="sub">Both cards now use their own shared assembly, with matching glass, sprayer, tube, and overcap.</p><div class="columns" data-surface="catalog"></div></section>
<section><div class="bar"><div><h2>02 / Product pages</h2><p class="sub">Exploded view exposes the complete tube and its connection beneath the sprayer.</p></div><div class="tabs" id="views"><button data-view="exploded" aria-pressed="true">Exploded</button><button data-view="cap-on" aria-pressed="false">Cap on</button><button data-view="sidecar" aria-pressed="false">Sidecar</button><button data-view="phone" aria-pressed="false">Phone</button></div></div><div class="columns" data-surface="pdp"></div></section>
<section><h2>03 / Build Your Bottle</h2><p class="sub">The catalog exports use the exact image layers and placement from these Builder assemblies.</p><div class="columns" data-surface="builder"></div></section>
<section><h2>50 ml tube, before and after</h2><p class="sub">Detail from the actual exploded product view. The full housing and tube are recovered from the exact SKU’s Photoshop source.</p><div class="columns"><figure><figcaption>Before<span>Previous extraction</span></figcaption><div class="tube-window"><img src="previous/pdp-50-exploded.png" alt="Previous 50 ml tube detail"></div></figure><figure><figcaption>After<span>Continuous source layer</span></figcaption><div class="tube-window"><img src="after/pdp-50-exploded.png" alt="Updated 50 ml tube detail"></div></figure></div></section>
<details id="before-after"><summary>Compare the previous and updated 50 ml catalog images</summary><p>The previous card used a separate finished image. The updated card comes from the shared assembly.</p><div class="columns"><figure><figcaption>Before</figcaption><a class="frame" href="previous/catalog-50.png"><img src="previous/catalog-50.png" alt="50 ml catalog before"></a></figure><figure><figcaption>After</figcaption><a class="frame" href="after/catalog-50.png"><img src="after/catalog-50.png" alt="50 ml catalog after"></a></figure></div></details>
<details><summary>Verification and source records</summary><p>21 focused tests passed, along with TypeScript and diff checks. Coverage includes continuous tube pixels for both sizes, exact SKU and source guards, matching catalog layer hashes, shared loaders, and production exclusion. Both sizes were captured in desktop and phone product views, catalog cards, and Builder previews.</p><p>The browser capture harness serves remote hardware from its original source URL to bypass a local Next image optimizer DNS issue. These are local media checks, not production delivery verification.</p><p><a href="REPORT.md">Handoff notes</a> · <a href="after/results.json">Captured source records</a> · <a href="catalog-50-export.json">50 ml catalog provenance</a> · <a href="catalog-export.json">100 ml catalog provenance</a> · <a href="implementation-bundle.zip">Implementation bundle</a></p></details>
<footer><p>Local candidates for review. The tube and catalog changes cover the two Clear / Matte Gold spray SKUs. Nothing has been published or deployed.</p></footer></main><script>
let view='exploded';function render(){document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));document.querySelectorAll('[data-surface]').forEach(row=>{const s=row.dataset.surface;row.innerHTML=[50,100].map(size=>{const file=s==='pdp'?`pdp-${size}-${view}.png`:`${s}-${size}.png`;return `<figure><figcaption>Empire ${size} ml<span>Current local preview</span></figcaption><a class="frame" href="after/${file}" target="_blank"><img src="after/${file}" alt="Empire ${size} ml ${s} current"></a></figure>`}).join('')});}document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;render()});render();
</script></body></html>''')
for name in ['catalog-50-export.json','catalog-50-assembly.svg','tube-source-50.json','tests.log','typecheck.log']:
 shutil.copy2(O/name,D/name)
(D/'REPORT.md').write_text('''# Empire local consistency pilot, revision 3

The Clear / Matte Gold spray SKUs GBEmp50SpryMtGl and GBEmp100SpryMtGl each use one shared assembly across the local product page and Builder, with a catalog image exported directly from that assembly.

## Changes in this revision

- Recovered the continuous native RGBA housing and dip tube from Layer 18 of the exact 50 ml Photoshop source. Preserved its pixels and aspect ratio; excluded disconnected off-canvas scrap.
- Joined the tube to the visible lower edge of its exact sprayer. Seated views retain the glass-cavity clipping and appearance; exploded view shows the complete tube.
- Exported the 50 ml catalog image from the actual Builder SVG using its original layer bytes and placement. Source hashes are recorded in catalog-50-export.json.
- Preserved the 50 ml glass artwork and geometry. Its silhouette ratio is within about 0.9% of the recorded 88 × 37 mm guide, which was not physically remeasured this session.
- Retained the prior 100 ml 107 × 46 mm body correction, native tube, and catalog image unchanged.

## Verification

21 focused tests passed across five files. TypeScript and git diff checks passed. Browser captures cover both sizes, three desktop product views, phone product stages, both catalog cards, and both Builder previews. Source records verify that each surface uses its expected local glass/tube or exact catalog export.

Remote hardware image requests in the capture harness use exact original source bytes to bypass the local Next optimizer DNS64 problem. This does not verify production image delivery.

## Review and scope

The top two images are independently framed, not presented at a common physical scale. Previous 50 ml images are preserved in previous/ for before-and-after review. The previous complete 100 ml review is archived in the sibling empire-100ml-review-v2 folder.

The changes are in /private/tmp/best-bottles-empire-alpha-20261019, with a durable implementation bundle alongside this report. Local development guards and exact source/component/plate checks remain. No backend writes, uploads, commits, pushes, merges, or deployments were made. These are review candidates, not new visual approvals.
''')
files=subprocess.check_output(['git','diff','--name-only'],cwd=R,text=True).splitlines()+subprocess.check_output(['git','ls-files','--others','--exclude-standard'],cwd=R,text=True).splitlines()
for f in files:
 if f.startswith('output/'):continue
 target=D/'implementation'/f;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(R/f,target)
for name in ['export_catalog_50.py','capture_final.py','update_review_v3.py']:
 shutil.copy2(Path('/private/tmp/bb-empire-alpha-evidence')/name,D/name)
(D/'implementation.patch').write_text(subprocess.check_output(['git','diff'],cwd=R,text=True))
shutil.make_archive(str(D/'implementation-bundle'),'zip',D/'implementation')
(D/'validation.json').write_text(json.dumps({'revision':3,'sizes':[50,100],'focusedTestsPassed':21,'typecheck':'passed','diffCheck':'passed','sourceAssertions':'passed','localOnly':True},indent=2)+'\n')
print('Both-size source checks and review update passed.')
