# Preserved Boston Round and Cylinder asset work

This package preserves the September 12–13 work from the local review checkout:
the family workbench, source crosswalks, glass standards, exact-byte approvals,
render scripts, tests, comparison sheets, and released/prepared image bytes.
It does not grant publication approval or deploy a website.

## Verified state at preservation

- Boston Round plates: **123/123 complete** in development.
- Cylinder plates: **398/436 complete** in development. The final **38 pairs / 76
  views are approved and locked**, including explicit acceptance of the 27
  documented legacy source bases. These final 38 have not been indexed/published.
- Global plate plan: **686/2,305 complete**, 431 review, 677 reconcile, 511 missing.
- Boston's earlier 25-kit release and publication receipt are preserved.
  Further kit and hero work remains paused.

Cylinder approval was saved by Jordan at 2026-09-13T15:09:47.734Z.
The review packet is b26271bbda3fe698e4134e459b3ac6ede866843157f17de13e0f3a35ba3cc89b and the staged
manifest is d582ba68ec391fc044192936d6e4ff81a0175fffa5f20151ffc275123208ccf0. See
[the immutable approval lock](../../reviews/cylinder-final38-2026-09-13/approved-lock.json).
Source originals and previously recorded approval decisions remain intact.

## Restore ignored local outputs

[preservation.json](preservation.json) inventories 406 files in 372
content-addressed objects: four release output directories, the Boston 30 mL
final-image review card, and current workbench decision/source records.
Final images and source comparisons under public/ are versioned directly.

Verify every archived byte without network access:

~~~sh
python3 scripts/asset-ledger/restore-preserved-releases.py
~~~

Restore into a fresh checkout, or another empty directory:

~~~sh
python3 scripts/asset-ledger/restore-preserved-releases.py --restore-to /path/to/checkout
~~~

The restore tool verifies the whole archive first and refuses to replace changed
existing files. Restoring does not publish or run a database mutation. Revalidate
the frozen lock locally with:

~~~sh
node scripts/asset-ledger/lock-cylinder-final38.mjs
~~~

A changed packet or manifest cannot overwrite an existing lock.

Original PSDs remain in BB-PSD-Files-Master, outside Git. Environment files,
credentials, measurement download caches, .claude/launch.json, generated sitemaps,
and unrelated logo review scratch are excluded. Main already contains the logo
through PR #135. Main's current Navbar is preserved.

The workbench imports its Boston kit release snapshot from the versioned
data/asset-ledger/boston-kit-release.json, not an ignored dist file.
Refresh that snapshot deliberately when accepting a later kit release; do not
rerun an old builder over a frozen approval or publication record.

## Git and production boundaries

The earlier ledger foundation was merged in PR #134. The later Boston/Cylinder
work in this package had not been committed with it. This package is based on
4ff254ef (main after PR #135), with no old branch merged into it.

A PR merges website code and the recorded snapshot. It does **not** migrate
development Convex media into production. No production deployment, media
publication, or database migration was performed during preservation.

For the final 38, the next release needs Jordan's release-specific ship, exact
target-environment reconciliation, metadata-preserving indexing, hosted hash
verification, and ledger approval registration. Reuse the approved-image and
legacy-source decisions; new render bytes require new review. Apply the accepted
legacy exception only to these exact approved/indexed views, not the global
source rule. Historical source/size findings remain until indexed replacements
supersede them.

After that release, verify Cylinder moves from 398 to 436 complete and global
completion from 686 to 724. Production needs its own verified data state; do not
present this development ledger as production coverage.
