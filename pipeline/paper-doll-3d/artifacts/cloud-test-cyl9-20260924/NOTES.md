# Cloud VM Blender test — Cylinder 9 ml (`Cyl-round-17-415-70x20`)

Date: 2026-09-24  
Host: default Cursor-managed Linux VM (no private Blender worker)  
Body: Cylinder 9 ml, Ø20 × 70, 17-415 — **CLEAR only this pass**  
SKU example (matrix): `GBCyl9MtlRollBlkDot`  
Authoritative pack: `17-415-NECK-THREAD-MATRIX-2026-09-23.pdf` (source check 23 Sep 2026)

This folder is a **capability test**, not a catalog/media promotion. Do not
merge these GLBs into `public/models/`.

---

## (a) Blender version + install method

| Item | Result |
|---|---|
| Preinstalled? | **No.** `which blender` empty; `blender: command not found` |
| apt | Ubuntu 24.04 has `blender` **4.0.2+dfsg-1ubuntu8** (universe). Not installed. |
| snap | Not present |
| blender.org official CDN | `https://download.blender.org/release/` → **HTTP 403** (Cloudflare challenge) |
| Working install | Official **Blender 5.2.0 LTS** tarball from the Berkeley mirror |

```
HEAD 200  384441228 bytes
https://mirrors.ocf.berkeley.edu/blender/release/Blender5.2/blender-5.2.0-linux-x64.tar.xz
extract -> ~/blender-official/blender-5.2.0-linux-x64/blender
```

`blender --version`:

```
Blender 5.2.0 LTS
build date: 2026-07-14
build hash: fbe6228777e7
build branch: blender-v5.2-release
build platform: Linux
```

Matches the lane’s documented `/opt/homebrew/bin/blender` (5.2.0 LTS).

### Machine

- CPU: 4× Intel Xeon (KVM), AVX-512, **no GPU** (`nvidia-smi` absent)
- RAM: 16 GiB (no swap)
- Disk: 255 G, plenty free
- `sudo` nopasswd works; install did **not** need sudo (user-local tarball)
- Cycles: `CUEW initialization failed` (no CUDA). CPU only.

---

## (b) Exact commands

```bash
# 0. install (see /tmp/install_blender.py)
python3 /tmp/install_blender.py
# BIN /home/ubuntu/blender-official/blender-5.2.0-linux-x64/blender

# 1. PSD silhouette cache is NOT on this VM (gitignored, ~529 MB).
#    Fallback: inward-scan cutout from public/references/9ml/clear.jpg
#    written to silhouettes/LBCylAmb9LtnBlk.png
#    (group_bodies.py already done in-repo; bodies.csv row is this body)

cd pipeline/paper-doll-3d
BLENDER=~/blender-official/blender-5.2.0-linux-x64/blender

# 2. paper-doll lathe + --splice-finish (skill loop)
$BLENDER --background --python scripts/bottle_bodies.py -- \
  --ledger bodies.csv --cutouts silhouettes \
  --out artifacts/cloud-test-cyl9-20260924/glb \
  --sku LBCylAmb9LtnBlk --splice-finish

# 3. verify gates + Workbench PNG
$BLENDER --background --python scripts/verify_glb.py -- \
  --glb artifacts/cloud-test-cyl9-20260924/glb/Cyl-round-17-415-70x20.glb \
  --out artifacts/cloud-test-cyl9-20260924/verify

# 3b. same verify on the shipped catalog GLB
$BLENDER --background --python scripts/verify_glb.py -- \
  --glb /workspace/public/models/bodies/Cyl-round-17-415-70x20.glb \
  --out artifacts/cloud-test-cyl9-20260924/verify-shipped

# 4. clay thread macro (Cycles CPU, 96 samples)
$BLENDER --background --python scripts/thread_macro.py -- \
  --glb artifacts/cloud-test-cyl9-20260924/glb/Cyl-round-17-415-70x20.glb \
  --finish-h 13.76 \
  --out artifacts/cloud-test-cyl9-20260924/thread-macro

# 5. extra: drawing-spec 009 hollow shell (no silhouette needed)
$BLENDER --background --python scripts/export_web_body.py -- \
  --spec 009 --body-id Cyl-round-17-415-70x20 \
  --out artifacts/cloud-test-cyl9-20260924/glb-drawing
$BLENDER --background --python scripts/verify_glb.py -- \
  --glb artifacts/cloud-test-cyl9-20260924/glb-drawing/Cyl-round-17-415-70x20.glb \
  --out artifacts/cloud-test-cyl9-20260924/verify-drawing
```

`--sku` on `bottle_bodies.py` filters `grace_sku`. In `bodies.csv` that is
`LBCylAmb9LtnBlk`, not `GBCyl9MtlRollMattSl`. Both map to
`Cyl-round-17-415-70x20` in `sku-to-body.csv`.

---

## (c) Verify gates

### Paper-doll rebuild (`bottle_bodies.py --splice-finish`) — PASS

| Gate | Result |
|---|---|
| Dimension vs catalogue (0.5%) | **PASS** `height_mm=70.0 diameter_mm=20.0` |
| Thread audit 17-415 | **PASS** (all seven rows inside sheet tol) |
| `verify_glb` non-manifold | **0 CLOSED SOLID** |
| Datums | `BB_ATTACH_NECK@70.00mm`, `BB_REF_SHOULDER@56.24mm` |
| Faces | 78,304 (export) / 160,186 tris after glTF import |

Splice note: traced neck 17.63 mm → drawing 13.76 mm; r@datum 6.86 → 7.40 mm;
blend 1.2 mm.

**Visual caveat:** the barrel is **wavy**. PSD sources and the silhouette
cache are not on this VM. The cutout was scanned from
`public/references/9ml/clear.jpg` (clear glass on beige). That is the skill’s
documented failure mode for a global/photo mask on glass. Bounding-box and
thread gates still pass — this is exactly why `verify_glb` exists as an
eyeball step. **Do not ship this GLB.**

### Shipped catalog GLB (`public/models/bodies/…`) — PASS

| Gate | Result |
|---|---|
| Dims | 20.0 × 20.0 × 70.0 mm |
| non-manifold | **0 CLOSED SOLID** |
| Datums | `BB_ATTACH_NECK@70.00mm`, `BB_REF_SHOULDER@59.42mm` |
| Faces | 13,442 / 26,880 |

This is the straight cylinder the paper-doll rebuild should have matched.

### Drawing-spec `009` (`export_web_body.py`) — generated, hollow (not the solid gate)

| Item | Result |
|---|---|
| Height / max r | 72.00 mm / 9.85 mm (Ø19.7) — drawing convention, not the 70×Ø20 solid ledger |
| Finish | 13.76 mm (009 spec) |
| non-manifold | **1536 NOT WATERTIGHT** — expected: this path exports a **hollow vessel wall** |
| Visual | Straight cylinder + helix. Looks like the 9 ml body. |

---

## (d) Artifact paths

Workspace (this folder):

| File | What |
|---|---|
| `glb/Cyl-round-17-415-70x20.glb` | Paper-doll rebuild (wavy barrel; gates pass) |
| `glb/body_report.csv` | `PASS` row |
| `verify/Cyl-round-17-415-70x20.png` | Workbench of the rebuild |
| `verify-shipped/Cyl-round-17-415-70x20.png` | Workbench of catalog GLB |
| `verify-drawing/Cyl-round-17-415-70x20.png` | Workbench of drawing-spec 009 |
| `glb-drawing/Cyl-round-17-415-70x20.glb` | Drawing-spec hollow GLB |
| `thread-macro/Cyl-round-17-415-70x20--front.png` | Clay front of spliced 17-415 |
| `thread-macro/Cyl-round-17-415-70x20--threequarter.png` | Clay ¾ |

Cursor walkthrough copies (same bytes):

- `/opt/cursor/artifacts/cyl9_drawing_verify.png`
- `/opt/cursor/artifacts/cyl9_paperdoll_rebuild_verify.png`
- `/opt/cursor/artifacts/cyl9_shipped_verify.png`
- `/opt/cursor/artifacts/cyl9_thread_macro_front.png`
- `/opt/cursor/artifacts/cyl9_thread_macro_threequarter.png`
- `/opt/cursor/artifacts/Cyl-round-17-415-70x20.paperdoll.glb`
- `/opt/cursor/artifacts/Cyl-round-17-415-70x20.drawing.glb`

---

## (e) Is the default cloud VM viable for ongoing Blender work?

**Yes for single-body headless geometry + Workbench verify**, after a ~25 s
tarball install (384 MB). `bottle_bodies.py`, `verify_glb.py`,
`export_web_body.py`, and CPU Cycles `thread_macro.py` all ran to completion
on this VM.

**No as a substitute for a private worker** if the job is production
paper-doll rebuilds:

1. **PSD library + silhouette cache are missing** (`~/Projects/Clients/…/
   Best-Bottles-Original-Photoshop-Sources` and `silhouettes/`, ~529 MB).
   Without them, `bottle_bodies.py --cutouts silhouettes` cannot reproduce
   the catalog outline. Photo fallback from `clear.jpg` is not good enough.
2. **Blender is not preinstalled** and `download.blender.org` is
   Cloudflare-blocked. Each cold VM must fetch a mirror tarball (or apt 4.0.2).
3. **No GPU.** Workbench verify is ~2 s. Cycles clay (96 samples, 1400²) is
   ~45 s/frame. A 47-body batch with macros would be slow.
4. Install does **not** persist unless snapshotted into the Cloud environment.

Recommendation: keep a **private worker with Blender 5.2 + PSD sources +
silhouette cache** for catalog rebuilds. Use the default cloud VM for
**verify-only** (existing GLBs) or drawing-spec scripts that need no PSD.
