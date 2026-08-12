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
- Evidence reads are resolved beneath their configured roots. Legacy scene
  content reads now use the root-anchored descriptor traversal documented in
  fix round 2 below; symlinked components and evidence escapes fail closed.
- Artifact records use stable path-plus-hash IDs and the existing strict model;
  persistence uses the atomic/idempotent record store. Review Markdown is also
  staged, fsynced, compared, and atomically replaced.
- The report contains the required eight sections in exact order, including
  source counts, duplicate observations, rendered-page links, spec-ready
  contracts, missing-evidence counts, blockers, explicit scopes, and eligible
  human decisions. It never performs approval automation or invokes Blender.

## Fix round 1 — inventory reconciliation and review truthfulness

### RED evidence

The first focused run after adding legacy ownership, reconciliation,
status/scope, descriptor, race, and provenance regressions reproduced every
legacy defect:

```bash
python3 -m unittest scripts/paper-doll-3d/tests/test_pipeline_review_legacy.py -v
```

```text
test_changed_scene_replaces_only_the_prior_legacy_inventory_record ... FAIL
test_deleted_scene_removes_its_stale_legacy_record ... FAIL
test_pending_inventory_persists_strict_records_idempotently ... FAIL
test_rule_status_and_scope_combinations_fail_closed ... FAIL (4 subtests)
test_scene_is_opened_once_and_size_comes_from_the_hashed_descriptor ... ERROR
test_scene_replacement_between_discovery_and_open_is_rejected ... ERROR
test_checked_in_registry_names_only_exact_documented_exceptions ... FAIL (2 subtests)

Ran 14 tests in 0.068s
FAILED (failures=9, errors=2)
```

After that slice was GREEN, review-root, current-decision, count, and hostile
Markdown regressions reproduced the report defects:

```text
test_dynamic_markdown_is_normalized_and_cannot_add_sections ... FAIL
test_review_packet_has_exact_section_order_counts_scopes_links_and_decisions ... FAIL
test_review_requires_existing_pipeline_and_required_source_directories ... FAIL
test_review_shows_only_latest_valid_hash_consistent_scoped_decisions ... FAIL

Ran 17 tests in 0.092s
FAILED (failures=5)
```

Self-review then identified the remaining non-legacy ID-collision overwrite
boundary before the commit:

```text
test_inventory_never_overwrites_a_nonlegacy_record_with_a_colliding_id ... FAIL
AssertionError: ValueError not raised

Ran 18 tests in 0.096s
FAILED (failures=1)
```

### GREEN evidence

Focused Task 9 command after all fixes:

```bash
python3 -m unittest scripts/paper-doll-3d/tests/test_pipeline_review_legacy.py -v
```

```text
Ran 18 tests in 0.103s
OK
```

An integration run with resource warnings promoted to errors passed before the
final collision regression was added:

```text
Ran 85 tests in 0.216s
OK
```

### Fix-round implementation review

- Inventory-owned records now use `kind: legacy_scene`. A complete successful
  scan writes the current snapshot and then removes only stale, strict
  `legacy_scene` record files whose exact IDs are absent. Changed and deleted
  scenes reconcile cleanly; missing/failed scans retain the last complete
  inventory; non-legacy records and ID collisions fail closed.
- Rule parsing rejects protected status, scope-less approvals, and any approved
  scope on imported-unverified, experimental, or extrapolated rules. One-scope
  finish/thread approvals remain valid without transferring body authority.
- Round 1 opened each scene once with no-follow, close-on-exec, and nonblocking
  flags and derived hash and size from that descriptor. Its pathname was still
  resolved and opened as an absolute path, so that round did not yet protect
  every parent component against a replacement race; fix round 2 below
  supersedes that incomplete boundary with root-anchored descriptor traversal.
- Review generation requires a real pipeline root plus the document, issue,
  and artifact authority directories before choosing or creating an output.
- Approval records are policy-validated for reviewer, scope, hash, decision,
  timestamp, IDs, entity type, and notes. They must resolve to an exact entity
  and current entity hash. The latest aware timestamp in each exact
  entity/scope/hash stream governs; rejected decisions supersede older
  approvals, and bots, malformed metadata, orphans, and hash mismatches are not
  presented as current.
- Dynamic code, prose, link labels, evidence notes, reviewer sources, product
  keys, names, and issue messages are line-normalized and context-escaped.
  Evidence link targets are re-resolved beneath the pipeline root. Hostile
  fixtures cannot create a ninth H2 section.
- Duplicate observations count recorded source-path instances. Missing
  fitment/component/assembly totals count unique affected entity IDs.
- Circle 15 ml and Circle 100 ml now cite the tracked production-loop spec that
  explicitly documents their extrapolated status.

### Fix-round real-root read-only audit

The hardened one-descriptor scanner was applied read-only to the current
master root:

```text
scenes 60
kinds {'legacy_scene': 60}
statuses {'approved': 6, 'experimental': 35, 'extrapolated': 2, 'imported_unverified': 17}
scope_sets {('finish_thread_geometry',): 6, (): 54}
```

### Fix-round final verification

Fresh complete Tasks 1–9 verification after the collision guard and report
append:

```bash
python3 -W error::ResourceWarning -m unittest discover \
  -s scripts/paper-doll-3d/tests -p 'test_pipeline_*.py' -v
```

```text
Ran 86 tests in 0.213s
OK
```

These checks also exited `0` with no output:

```bash
python3 -m py_compile scripts/paper-doll-3d/pipeline_lib/legacy.py \
  scripts/paper-doll-3d/pipeline_lib/review.py \
  scripts/paper-doll-3d/tests/test_pipeline_review_legacy.py
python3 -m json.tool pipeline/paper-doll-3d/reconciliation/legacy-status.json >/dev/null
git diff --check
```

## Fix round 2 — complete traversal and descriptor anchoring

### RED evidence

The focused Task 9 run after adding deterministic walker-error and parent
symlink-swap regressions exposed the absolute-path opening and incomplete-scan
behavior:

```bash
python3 -m unittest scripts/paper-doll-3d/tests/test_pipeline_review_legacy.py -v
```

```text
test_parent_symlink_swap_is_rejected_and_descriptors_are_closed ... FAIL
test_scene_is_opened_once_and_size_comes_from_the_hashed_descriptor ... FAIL
test_scene_replacement_between_discovery_and_open_is_rejected ... FAIL
test_walk_error_keeps_the_last_complete_legacy_inventory ... FAIL

Ran 20 tests in 0.092s
FAILED (failures=4)
```

The walk regression initially compared the macOS `/var` alias with its
`/private/var` canonical path. After changing that fixture-only assertion to
`samefile`, the behavioral regression remained RED for the intended reason:

```text
AssertionError: ValueError not raised

Ran 1 test in 0.010s
FAILED (failures=1)
```

### GREEN evidence

After the traversal and opening changes, the focused suite passed with
resource warnings promoted to errors:

```bash
python3 -W error::ResourceWarning -m unittest \
  scripts/paper-doll-3d/tests/test_pipeline_review_legacy.py -v
```

```text
Ran 20 tests in 0.108s
OK
```

### Fix-round implementation review

- `os.walk` now receives an `onerror` callback that turns traversal failures
  into a failed scan. The completion flag remains false until inventory
  traversal and every scene fingerprint have returned successfully, so failed
  traversal cannot reconcile away the last complete `legacy_scene` snapshot.
- The scanner opens the configured master directory first. Every relative
  parent component is then opened from its parent descriptor with
  `O_DIRECTORY | O_NOFOLLOW`; the final scene is opened from that descriptor
  with `O_NOFOLLOW`. Absolute paths, `..`, symlinked components, non-directory
  parents, and nonregular scenes fail closed.
- Hash, byte count, and before/after metadata come from one scene descriptor.
  The final file is checked relative to its still-open parent and the complete
  relative chain is reopened from the original root descriptor to reject path
  replacement. All owned descriptors close on successful and exceptional
  paths.

### Fix-round final verification

Fresh Tasks 1–9 verification after the focused GREEN run:

```bash
python3 -W error::ResourceWarning -m unittest discover \
  -s scripts/paper-doll-3d/tests -p 'test_pipeline_*.py' -v
```

```text
Ran 88 tests in 0.195s
OK
```
