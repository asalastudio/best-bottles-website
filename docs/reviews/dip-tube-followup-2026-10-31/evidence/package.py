import json,shutil,hashlib
from pathlib import Path
root=Path.cwd(); out=root/'outputs/catalog-model-repair-2026-10-31/dip-tube-followup';pkg=root/'docs/reviews/dip-tube-followup-2026-10-31';pub=root/'public/reviews/dip-tube-followup-2026-10-31'
pkg.mkdir(parents=True,exist_ok=True)
verification={'date':'2026-10-31','scope':{'skus':28,'Tulip5':8,'Sleek8':8,'Round78clear':6,'Round78frosted':6},'automated':{'focusedTestsPassed':52,'typecheck':'passed','targetedLint':'passed','pdpBrowserStates':168,'builderKits':28,'builderBrowserHandoffs':4,'sharedStageRegressions':8,'pageErrors':0},'visualReview':'All 28 seated variants inspected on contact sheet; representative before/after, exploded, mobile and builder screenshots inspected. Owner approval pending.','preservation':'Body, head, cap, external hardware, kit anchors and glass sizing unchanged. Nontube part records compared byte-for-byte.','geometry':'Hollow tube mesh manifold and normals recalculated. Slim OD 1.1 mm Tulip/Sleek, 1.5 mm Round. Complete alpha rows and padded bounds.','limitations':['Tube and internal cartridge dimensions, assumed floor and tip clearance are inferred, not supplier measured.','Seated tube is a native Blender RGBA layer composited over existing glass; through-glass refraction is approximated, not a complete 3D bottle ray trace.','Full-catalog visual signoff remains unfinished.'],'release':'Local review only; no media published and no merge performed.','previousCommitCi':{'commit':'ac3f19a4f001d707d3575cef0360837cd1b8700c','runId':41248855001,'conclusion':'success; predates this dip-tube commit'}}
verification['restore']=json.loads((out/'restore-verification.json').read_text())
(pub/'verification.json').write_text(json.dumps(verification,indent=2));(out/'verification.json').write_text(json.dumps(verification,indent=2))
shutil.copy2(out/'all-28-contact-sheet.png',pub/'all-28-contact-sheet.png')
files=[]
def include(src,dest,restore=None):
 target=pkg/dest;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,target);files.append({'path':str(dest),'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'bytes':target.stat().st_size,**({'restoreTo':restore} if restore else {})})
for folder in [root/'public/local-kits/dip-tube-followup-2026-10-31',pub]:
 for src in sorted(folder.rglob('*')):
  if src.is_file():rel=src.relative_to(root);include(src,Path('runtime')/rel,str(rel))
for rel in ['public/local-kits/catalog-followups-2026-10-31/kits.json','public/reviews/meeting-audit-2026-10-31/index.html','public/reviews/meeting-audit-2026-10-31/product-page-audit.csv']:
 include(root/rel,Path('runtime')/rel,rel)
for name in ['brief.md','render-tubes.py','integrate.cjs','review.cjs','verify.cjs','handoffs.cjs','regression.cjs','package.py','register-live.json','kits-before.json','kits-after.json','defects-by-sku.json','browser-before.json','browser-after-pilot.json','browser-verification.json','builder-verification.json','builder-handoffs.json','shared-stage-regression.json','alpha-checks.json','verification.json','restore-verification.json','native-scenes.json']:
 include(out/name,Path('evidence')/name)
for src in (out/'renders').glob('*.json'):include(src,Path('evidence')/src.name)
include(root/'outputs/catalog-model-repair-2026-10-31/renders/mechanism-tulip-5-v3.json',Path('evidence')/'mechanism-tulip-5-v3.json')
shutil.copy2(root/'docs/reviews/catalog-followup-2026-10-31/restore.mjs',pkg/'restore.mjs')
(pkg/'manifest.json').write_text(json.dumps({'date':'2026-10-31','status':'local-review','files':files},indent=2))
(pkg/'README.md').write_text('''# Tulip, Sleek and Round dip tube repair

The selected sprayers had hidden or fragmented dip tubes. The PDP renderer passed fractional relative layer priorities into CSS z-index, which accepts integers only. Its sorted layers now receive positive integer stacking values. This preserves behind-glass ordering such as Swirl while allowing clear tube overlays to paint in their intended position.

Local kits for 28 SKUs replace broken tube cutouts with continuous hollow Blender-rendered tubes and translucent cartridges: Tulip 5 ml amber (8), Sleek 8 ml clear (8), Round 78 ml clear (6), and Round 78 ml frosted (6). The tube shares the sprayer component identity and movement. Existing glass, head, cap, component geometry, scale and anchors are unchanged. Builder uses the same assets and already draws SVG layers in sorted order.

Tulip reuses the existing native tube render. New working scenes produce the Sleek and Round tubes. OD/bore is 1.1/0.7 mm for Tulip/Sleek and 1.5/1.0 mm for Round. These dimensions, the cartridge, floor thickness and clearance are visualization estimates. The tube layer is composited onto existing glass imagery; through-glass refraction is approximated, not ray-traced through a complete bottle scene. Owner visual approval remains pending.

## Checks

- 52 focused tests; TypeScript; targeted lint; clean diff formatting.
- 168 PDP states: all 28 SKUs, three views, desktop and mobile. Complete image bounds, one tube, integer stacking, connected movement, above-base placement, no horizontal page overflow and stable cap-on/off glass frame.
- 28 builder kit parity checks; four actual product-page handoffs.
- Eight shared-stage regressions for 9 ml clear/Swirl and 5 ml clear/cobalt rollers.
- Every seated variant inspected on a contact sheet; representative exploded, mobile and builder screenshots inspected.

These checks do not constitute full-catalog approval. No backend records, live media, production domain or deployment were changed.

## Restore

Restore the original catalog checkpoint and catalog follow-up packages first, then this package:

```sh
node docs/reviews/dip-tube-followup-2026-10-31/restore.mjs
node docs/reviews/dip-tube-followup-2026-10-31/restore.mjs --apply
npm run dev -- --port 3010
```

The dry run verifies all hashes. Applying it backs up conflicting files before replacement. The local override loader refuses Vercel. Review/media files are excluded from deployment uploads.

Open `/reviews/dip-tube-followup-2026-10-31/index.html` on localhost for the before/after comparisons, all 28 product links, per-SKU CSV and screenshots. The meeting audit adds evidence to four affected product groups without setting reviewer decisions.

`evidence/` contains the scripts and checks. The working render script reuses the existing local studio export helper; its original absolute source paths are recorded in the script. Full native Blender scenes remain in the local working output and labeled Drive backup, not this Git package. Originals remain intact.
''')
print('Packaged',len(files),'files;',sum(f['bytes']for f in files),'bytes')
