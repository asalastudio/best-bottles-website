# Task 9 Report — Review Packets and Truthful Legacy Inventory

## RED evidence

Focused command after adding the review/legacy tests and before creating the
production modules:

```bash
python3 -m unittest scripts/paper-doll-3d/tests/test_pipeline_review_legacy.py -v
```

Output summary:

```text
ModuleNotFoundError: No module named 'pipeline_lib.legacy'

Ran 1 test in 0.000s
FAILED (errors=1)
```

The import failed on the absent production module, as required. After the
initial implementation, a macOS `/var` to `/private/var` test-fixture alias was
corrected before its assertions evaluated; it did not require a production
change.

## GREEN evidence

Focused command:

```bash
python3 -m unittest scripts/paper-doll-3d/tests/test_pipeline_review_legacy.py -v
```

Output summary:

```text
Ran 7 tests in 0.049s
OK
```

Foundation command:

```bash
python3 -m unittest discover -s scripts/paper-doll-3d/tests \
  -p 'test_pipeline_*.py' -v
```

Output summary:

```text
Ran 75 tests in 0.141s
OK
```

## Self-review RED/GREEN

Self-review found that a symlinked scene directory was safely skipped but
could make the inventory count incomplete. A regression was added before the
fix:

```text
test_inventory_rejects_symlinked_scene_directories_instead_of_omitting_them ... FAIL
AssertionError: ValueError not raised

Ran 8 tests in 0.059s
FAILED (failures=1)
```

The inventory now rejects both scene-file and scene-directory symlinks. The
focused rerun passed:

```text
Ran 8 tests in 0.043s
OK
```

Fresh pre-commit verification with resource warnings promoted to errors:

```bash
python3 -W error::ResourceWarning -m unittest discover \
  -s scripts/paper-doll-3d/tests -p 'test_pipeline_*.py' -v
```

Output summary:

```text
Ran 76 tests in 0.161s
OK
```

Syntax, registry parsing, and whitespace checks also exited `0`:

```bash
python3 -m py_compile scripts/paper-doll-3d/pipeline_lib/legacy.py \
  scripts/paper-doll-3d/pipeline_lib/review.py \
  scripts/paper-doll-3d/tests/test_pipeline_review_legacy.py
python3 -m json.tool pipeline/paper-doll-3d/reconciliation/legacy-status.json >/dev/null
git diff --check
```

## Real-root read-only audit

The checked-in rule registry was applied read-only to the current master root;
no artifact records or Blender files were written:

```text
scenes 60
statuses {'approved': 6, 'experimental': 35, 'extrapolated': 2, 'imported_unverified': 17}
scope_sets {('finish_thread_geometry',): 6, (): 54}
```

## Files changed

- `scripts/paper-doll-3d/pipeline_lib/review.py`
- `scripts/paper-doll-3d/pipeline_lib/legacy.py`
- `scripts/paper-doll-3d/tests/test_pipeline_review_legacy.py`
- `pipeline/paper-doll-3d/reconciliation/legacy-status.json`
- `pipeline/paper-doll-3d/reviews/foundation/.gitkeep`
- `.superpowers/sdd/2026-08-11-paper-doll-intake-contract-foundation/task-9-report.md`

## Self-review

- Unknown filenames, including names containing `LOCKED` or `APPROVED`, stay
  `imported_unverified`. Only an exact relative-path or SHA-256 rule can change
  a non-working scene's status.
- Every `working/**` scene remains `experimental` with no approved scopes.
  Conflicting working-scene rules fail closed.
- Circle 15 ml and Circle 100 ml are exact-path `extrapolated` exceptions with
  no approved scopes and explicit provenance.
- The baseline and five locked variants retain only
  `finish_thread_geometry`; they receive no body, material, studio, assembly,
  final-asset, or protected status.
- Legacy inventory cannot grant `protected`; that remains exclusively behind
  the independent two-copy integrity gate.
- Scene and evidence reads are resolved beneath their configured roots.
  Symlinked scene files/directories and evidence escapes fail closed.
- Artifact records use stable path-plus-hash IDs and the existing strict model;
  persistence uses the atomic/idempotent record store. Review Markdown is also
  staged, fsynced, compared, and atomically replaced.
- The report contains the required eight sections in exact order, including
  source counts, duplicate observations, rendered-page links, spec-ready
  contracts, missing-evidence counts, blockers, explicit scopes, and eligible
  human decisions. It never performs approval automation or invokes Blender.
