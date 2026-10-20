exec(open('/private/tmp/bb-empire-alpha-evidence/build_review.py').read())
from PIL import Image,ImageChops
records=json.loads((dest/'after/results.json').read_text())
assert len(records)==5, 'Need all surfaces and both sizes'
assert not any(r.get('error') or r.get('errors') for r in records)
for size in [50,100]:
 p=next(r for r in records if r['surface']=='pdp' and r['size']==size)
 assert len(p['views'])==3
 for v in p['views'].values():
  assert all(i['w']>0 for i in v['images'])
  assert any(f'empire-{size}ml-empty-alpha.' in i['url'] for i in v['images'])
 b=next(r for r in records if r['surface']=='builder' and r['size']==size)
 assert any(f'empire-{size}ml-empty-alpha.' in i['url'] for i in b['images'])
 print('verified shared alpha source',size)
cat={}
for size in [50,100]:
 a=Image.open(dest/f'before/catalog-{size}.png').convert('RGB');b=Image.open(dest/f'after/catalog-{size}.png').convert('RGB')
 cat[size]=a.size==b.size and ImageChops.difference(a,b).getbbox() is None
print('Catalog screenshots pixel-identical:',cat)
report='''# Empire alpha-only pilot · 19 October 2026

Status: local review prepared. No merge, push, upload, deployment, or production data change.

## Result

50 ml and 100 ml exports have transparency outside the existing glass silhouette. Every source RGB pixel is identical, including pixels hidden by alpha. Both canvases remain 871 × 1806. Registration landmarks, aspect ratio, tube treatment, hardware, and source files are preserved. The interior glass remains opaque with its existing appearance. These are silhouette cutouts, not reconstructed optical transparency.

The actual product page and Builder use the same alpha file for each size after clearing the local Builder cache. Catalog cards still use the separate finished-product files. The comparison deliberately shows this remaining consistency gap.

## 100 ml proportion finding

Jordan's first reply described 107 mm cap-on height; after a specific bare-glass clarification, the latest reply was “107”. This pilot treats the latest answer as 107 mm bottom-to-threaded-rim, with 46 mm outside body width confirmed earlier. No cap identity was supplied.

Measured image silhouette: 1548 px high × 636 px wide, ratio 2.4340. Physical guide: 107 ÷ 46 = 2.3261. The image ratio is approximately 4.64% taller relative to width. At a 107 mm height it implies approximately 43.96 mm width. This is a two-dimensional silhouette comparison, not proof of a manufactured dimension or a reason to stretch the artwork automatically. No geometry correction was made. Visual approval remains false.

50 ml silhouette: 1606 × 669 px, about 0.93% from the existing 88 × 37 mm guide. That guide was not remeasured this session.

## Validation

- 13 tests across local-empire-bare-glass, empire-through-glass, and local-media-baseline.integration passed. These cover original RGB equality, alpha samples, registration, unchanged hardware, production exclusion, tube clipping and shared loaders. The pre-export alpha test correctly failed against RGB originals.
- TypeScript: `npx tsc --noEmit` passed. `git diff --check` passed.
- Browser: both sizes, three desktop PDP views, phone PDP stages, catalog cards, and Builder review dialogs. Final PDP sources and Builder sources verified against the new hashed alpha names. PDP images decoded with nonzero width. Builder SVG sources were decoded before screenshot.
- The local Next optimizer rejected some remote hardware URLs under DNS64. The final browser capture harness routes these optimizer requests to the exact original remote source bytes. This is a capture-only transport workaround; production image delivery and a fix for that optimizer issue are outside this pilot. Earlier broken and cached captures are excluded from this review.

## Sources and reproduction

Baseline: detached PR #369 head a892d9b0016a164918a373829490b255bf0fba62 in `/private/tmp/best-bottles-empire-alpha-20261019`. Existing archive and #369 worktree were preserved. Local app runs on port 3007 while this session remains active.

`alpha-exports.json` contains complete source/output hashes, sizes, mask method, and silhouette bounds. `implementation/` preserves edited files and both original and alpha image files. `implementation.patch` contains tracked changes relative to #369; new assets and script must also be copied from `implementation/`. No environment files or secrets are included.

To reproduce, use the same #369 checkout and local Empire baseline, apply the patch, and copy new files. Run `python3 scripts/prepare-empire-alpha-pilot.py` with Pillow, NumPy and SciPy available. The exporter checks source hashes and writes deterministic alpha files. Clear the isolated Next development fetch cache or change the local media cache version before recapturing Builder, because its cached kit payload can retain old master URLs. The capture script records exact displayed source URLs.

## Recommended consistency approach

Resolve the 100 ml silhouette, then approve one master for each physical glass profile, capacity and neck. Use those masters with exact approved hardware in the shared product-page/Builder assembly. Derive the catalog's finished-product image from the same approved combination. Maintain an asset register with source hash, dimensions, approval and consumers so generated, locally reviewed, and published assets remain distinguishable.

This pilot does not approve all 90 Empire assemblies visually. The existing guarded assembly coverage is exercised by tests; browser review is limited to the two Matte Gold spray combinations shown. The held white 100 ml pump fallback remains outside this pilot.
'''
(dest/'REPORT.md').write_text(report)
(dest/'validation.json').write_text(json.dumps({'pdpAndBuilderSharedAlpha':True,'catalogScreenshotPixelsIdentical':cat,'testCount':13,'typecheck':'passed','productionChanged':False,'captureTransportWorkaround':True},indent=2))
shutil.make_archive(str(dest/'implementation-bundle'),'zip',dest/'implementation')
