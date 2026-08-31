# Paper-Doll Intake and Contract Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the source-controlled, resumable foundation that fingerprints the 18 manufacturer PDFs, creates evidence and draft contracts, preserves scoped approvals, inventories legacy assets without promoting them, and reports blockers before any new Blender geometry is produced.

**Architecture:** A thin `pipeline.py` CLI dispatches focused standard-library modules under `pipeline_lib`. Canonical PDFs and one JSON record per entity are source-controlled; rendered pages and a SQLite query index are derived. Content hashes and dependency edges make every stage idempotent, while approvals and protected-artifact records remain immutable and scope-specific.

**Tech Stack:** Python 3 standard library (`argparse`, `dataclasses`, `hashlib`, `json`, `pathlib`, `shutil`, `sqlite3`, `subprocess`, `tempfile`, `unittest`), Poppler CLI (`pdfinfo`, `pdftotext`, `pdftoppm`), Git. Blender 5.2 LTS is reserved for later integration plans.

## Global Constraints

- Treat `/Users/jordanrichter/Desktop/Best Bottles/Demo-Abbas/Spec Sheets` as read-only intake.
- Intake 18 Desktop PDF files as 17 unique content hashes; the blue and amber 9 ml files are byte-identical.
- Reconcile the repository's nineteenth PDF filename as an exact duplicate alias of the tall-cylinder drawing.
- Printed manufacturer dimensions outrank photographs, filenames, generated images, and pixels.
- Automation creates candidates and blockers; it cannot approve dimensional truth or geometry.
- Do not modify existing `.blend` files, renders, bottle geometry, or thread geometry.
- A finish/thread approval cannot approve a body, material, studio, assembly, or asset.
- Do not write to live Convex, the website, Shopify, Madison Studio, or product catalogs.
- Store one JSON record per entity with `schema_version: 1`; SQLite is disposable.
- Use `unittest`; this repository does not include `pytest`.
- Make every write atomic and every rerun idempotent.
- Require two independently hash-verified artifact copies before `protected` status.

## Subproject Boundary

This plan implements only the document/contracts foundation. Later independent plans cover:

1. Blender geometry compilation and clay gates.
2. Studio calibration and protected presets.
3. Fitment/component assembly and compatibility evidence.
4. Asset jobs, rendering, QA, artifact publishing, and catalog handoff.

## File Structure

```text
scripts/paper-doll-3d/
├── pipeline.py
└── pipeline_lib/
    ├── __init__.py
    ├── models.py
    ├── ids.py
    ├── store.py
    ├── intake.py
    ├── inspection.py
    ├── measurements.py
    ├── reconciliation.py
    ├── approvals.py
    ├── dependencies.py
    ├── artifacts.py
    ├── index.py
    ├── review.py
    ├── legacy.py
    └── orchestrator.py

scripts/paper-doll-3d/tests/
├── test_pipeline_models.py
├── test_pipeline_store.py
├── test_pipeline_intake.py
├── test_pipeline_inspection.py
├── test_pipeline_reconciliation.py
├── test_pipeline_approvals.py
├── test_pipeline_artifacts.py
├── test_pipeline_index.py
├── test_pipeline_review_legacy.py
└── test_pipeline_cli_e2e.py
```

---

### Task 1: Stable IDs and Entity Models

**Files:**
- Create: `scripts/paper-doll-3d/pipeline_lib/__init__.py`
- Create: `scripts/paper-doll-3d/pipeline_lib/ids.py`
- Create: `scripts/paper-doll-3d/pipeline_lib/models.py`
- Test: `scripts/paper-doll-3d/tests/test_pipeline_models.py`

**Interfaces:**
- Produces: `canonical_json(value: object) -> str`
- Produces: `content_hash(value: object) -> str`
- Produces: `stable_id(prefix: str, value: object) -> str`
- Produces: `DocumentRecord`, `ContractRecord`, `ApprovalRecord`, `DependencyRecord`, `IssueRecord`, `ArtifactRecord`
- Produces: entity status constants and `APPROVAL_SCOPES`

- [ ] **Step 1: Write the failing model tests**

```python
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "scripts/paper-doll-3d"))

from pipeline_lib.ids import canonical_json, stable_id
from pipeline_lib.models import APPROVAL_SCOPES, ApprovalRecord, DocumentRecord


class PipelineModelTests(unittest.TestCase):
    def test_canonical_json_ignores_dict_insertion_order(self):
        self.assertEqual(canonical_json({"b": 2, "a": 1}), canonical_json({"a": 1, "b": 2}))

    def test_stable_id_changes_when_content_changes(self):
        self.assertEqual(stable_id("doc", {"sha256": "abc"}), stable_id("doc", {"sha256": "abc"}))
        self.assertNotEqual(stable_id("doc", {"sha256": "abc"}), stable_id("doc", {"sha256": "abd"}))

    def test_document_record_round_trips(self):
        record = DocumentRecord(
            id="doc_abc", sha256="abc", canonical_path="documents/originals/abc.pdf",
            observed_names=("drawing.pdf",), status="archived",
        )
        self.assertEqual(DocumentRecord.from_dict(record.to_dict()), record)

    def test_approval_scope_is_not_transferable(self):
        self.assertIn("finish_thread_geometry", APPROVAL_SCOPES)
        self.assertIn("body_geometry", APPROVAL_SCOPES)
        approval = ApprovalRecord(
            id="approval_1", entity_type="geometry", entity_id="geo_1",
            scope="finish_thread_geometry", artifact_hash="a" * 64,
            reviewer="Jordan Richter", decided_at="2026-08-11T00:00:00Z",
            decision="approved", notes="17-415 thread only",
        )
        self.assertNotEqual(approval.scope, "body_geometry")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run the test to verify failure**

Run:

```bash
python3 -m unittest scripts/paper-doll-3d/tests/test_pipeline_models.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'pipeline_lib'`.

- [ ] **Step 3: Implement stable IDs and frozen records**

In `ids.py`:

```python
import hashlib
import json


def canonical_json(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def content_hash(value):
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


def stable_id(prefix, value):
    return f"{prefix}_{content_hash(value)[:16]}"
```

In `models.py`, use frozen dataclasses, tuple fields, and `schema_version=1`. Define:

```python
APPROVAL_SCOPES = frozenset({
    "dimensional_truth", "body_geometry", "finish_thread_geometry",
    "fitment_geometry", "component_geometry", "assembly_visual_fit",
    "assembly_dimensional_fit", "studio_architecture", "studio_preset",
    "material_lookdev", "final_asset",
})
```

Every `from_dict` must reject unknown schema versions, statuses, scopes, and fields with `ValueError`.

- [ ] **Step 4: Run the model test**

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/paper-doll-3d/pipeline_lib scripts/paper-doll-3d/tests/test_pipeline_models.py
git commit -m "feat: define paper-doll pipeline records"
```

---

### Task 2: Atomic Record Store

**Files:**
- Create: `scripts/paper-doll-3d/pipeline_lib/store.py`
- Test: `scripts/paper-doll-3d/tests/test_pipeline_store.py`
- Create: `pipeline/paper-doll-3d/documents/records/.gitkeep`
- Create: `pipeline/paper-doll-3d/approvals/records/.gitkeep`
- Create: `pipeline/paper-doll-3d/dependencies/records/.gitkeep`
- Create: `pipeline/paper-doll-3d/issues/records/.gitkeep`
- Create: `pipeline/paper-doll-3d/artifacts/records/.gitkeep`
- Modify: `.gitignore:127-139`

**Interfaces:**
- Consumes: records exposing `.id` and `.to_dict()`
- Produces: `atomic_write_json(path: Path, value: dict) -> None`
- Produces: `write_record(root: Path, kind: str, record) -> Path`
- Produces: `read_record(path: Path, record_type)`
- Produces: `iter_record_dicts(root: Path, kind: str) -> Iterator[dict]`
- Produces: `iter_records(root: Path, kind: str, record_type) -> Iterator[object]`

- [ ] **Step 1: Write failing atomic/idempotency tests**

```python
class RecordStoreTests(unittest.TestCase):
    def test_write_record_is_idempotent_and_atomic(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            record = DocumentRecord("doc_abc", "abc", "documents/originals/abc.pdf", ("a.pdf",), "archived")
            first = write_record(root, "documents", record)
            before = first.read_bytes()
            second = write_record(root, "documents", record)
            self.assertEqual(first, second)
            self.assertEqual(second.read_bytes(), before)
            self.assertEqual(list(second.parent.glob("*.tmp")), [])
```

Also assert that `write_record(root, "../outside", record)` raises `ValueError`.

- [ ] **Step 2: Run the test to verify failure**

```bash
python3 -m unittest scripts/paper-doll-3d/tests/test_pipeline_store.py -v
```

Expected: FAIL because `pipeline_lib.store` is absent.

- [ ] **Step 3: Implement atomic persistence**

Use `NamedTemporaryFile` in the destination directory, `json.dump(sort_keys=True, indent=2)`, `flush`, `os.fsync`, and `os.replace`. Skip replacement when existing bytes match. Restrict `kind` to a hard-coded record-directory map.

Add to `.gitignore`:

```gitignore
/pipeline/paper-doll-3d/indexes/*.sqlite
/pipeline/paper-doll-3d/indexes/*.sqlite-*
```

- [ ] **Step 4: Run Tasks 1–2 tests**

```bash
python3 -m unittest \
  scripts/paper-doll-3d/tests/test_pipeline_models.py \
  scripts/paper-doll-3d/tests/test_pipeline_store.py -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .gitignore scripts/paper-doll-3d/pipeline_lib/store.py \
  scripts/paper-doll-3d/tests/test_pipeline_store.py \
  pipeline/paper-doll-3d/documents/records/.gitkeep \
  pipeline/paper-doll-3d/approvals/records/.gitkeep \
  pipeline/paper-doll-3d/dependencies/records/.gitkeep \
  pipeline/paper-doll-3d/issues/records/.gitkeep \
  pipeline/paper-doll-3d/artifacts/records/.gitkeep
git commit -m "feat: add atomic paper-doll record store"
```

---

### Task 3: Document Intake, Dedupe, and Canonical Archive

**Files:**
- Create: `scripts/paper-doll-3d/pipeline_lib/intake.py`
- Test: `scripts/paper-doll-3d/tests/test_pipeline_intake.py`
- Create: `pipeline/paper-doll-3d/documents/originals/.gitkeep`

**Interfaces:**
- Consumes: `stable_id`, `DocumentRecord`, `write_record`
- Produces: `sha256_file(path: Path) -> str`
- Produces: `discover_pdfs(source_dir: Path) -> tuple[Path, ...]`
- Produces: `intake_documents(source_dir: Path, pipeline_root: Path) -> IntakeReport`
- Produces: `audit_existing_mirror(existing_dir: Path, document_records) -> MirrorReport`

- [ ] **Step 1: Write failing intake tests**

Use a temporary source containing `Blue (4).pdf`, an identical `Blue.pdf`, and distinct `Amber.pdf` bytes:

```python
report = intake_documents(source, pipeline_root)
self.assertEqual(report.discovered, 3)
self.assertEqual(report.new, 2)
self.assertEqual(report.duplicate, 1)
self.assertEqual(len(list((pipeline_root / "documents/originals").glob("*.pdf"))), 2)
self.assertEqual(before_source_bytes, {p.name: p.read_bytes() for p in source.glob("*.pdf")})

rerun = intake_documents(source, pipeline_root)
self.assertEqual(rerun.new, 0)
self.assertEqual(rerun.duplicate, 3)
```

Assert deterministic discovery order and that a changed file under an observed filename creates a revision-conflict issue rather than replacing the first source.

Create a second temporary mirror containing two canonical hashes under three filenames. Assert `audit_existing_mirror` returns `matched_hashes=2`, `mirror_files=3`, `duplicate_file_instances=1`, and `unknown_hashes=0` while retaining every observed filename.

- [ ] **Step 2: Run the test to verify failure**

```bash
python3 -m unittest scripts/paper-doll-3d/tests/test_pipeline_intake.py -v
```

Expected: FAIL because `pipeline_lib.intake` is absent.

- [ ] **Step 3: Implement content-addressed intake**

Canonical files are `<full-sha256>.pdf`; document IDs are `doc_<first-16-hash-chars>`. Copy to a temporary file, verify its hash, and atomically replace into `documents/originals`. Never rename, chmod, delete, or write a source file. Merge observed names and paths in sorted order for identical content.

`audit_existing_mirror` hashes PDFs read-only and compares them to canonical document hashes. Duplicate filenames attach as observed aliases. Unknown content creates a `needs_reconciliation` issue and is not silently ingested as Desktop authority.

- [ ] **Step 4: Run the intake test twice**

Expected: both runs PASS and leave no artifacts outside temporary directories.

- [ ] **Step 5: Commit**

```bash
git add scripts/paper-doll-3d/pipeline_lib/intake.py \
  scripts/paper-doll-3d/tests/test_pipeline_intake.py \
  pipeline/paper-doll-3d/documents/originals/.gitkeep
git commit -m "feat: add content-addressed spec intake"
```

---

### Task 4: PDF Inspection and Conservative Measurement Candidates

**Files:**
- Create: `scripts/paper-doll-3d/pipeline_lib/inspection.py`
- Create: `scripts/paper-doll-3d/pipeline_lib/measurements.py`
- Test: `scripts/paper-doll-3d/tests/test_pipeline_inspection.py`
- Create: `pipeline/paper-doll-3d/evidence/.gitkeep`

**Interfaces:**
- Consumes: archived `DocumentRecord`
- Produces: `run_command(args: tuple[str, ...]) -> subprocess.CompletedProcess`
- Produces: `inspect_document(document, pipeline_root: Path, runner=run_command) -> dict`
- Produces: `inspect_pending_documents(pipeline_root: Path) -> InspectionReport`
- Produces: `extract_measurement_candidates(text: str, page: int) -> tuple[dict, ...]`

- [ ] **Step 1: Write failing Poppler and candidate tests**

Inject a fake runner and assert commands include `pdfinfo`, `pdftotext`, and `pdftoppm -png -r 240`. Add:

```python
text = "Ø16.3±0.3  Ø14.8 ± 0.3  72±0.8  neck 14.06±0.3"
candidates = extract_measurement_candidates(text, page=1)
self.assertEqual([item["value"] for item in candidates], [16.3, 14.8, 72.0, 14.06])
self.assertEqual([item["tolerance"] for item in candidates], [0.3, 0.3, 0.8, 0.3])
self.assertTrue(all(item["status"] == "candidate" for item in candidates))
self.assertTrue(all(item["semantic_field"] is None for item in candidates))
```

- [ ] **Step 2: Run the test to verify failure**

```bash
python3 -m unittest scripts/paper-doll-3d/tests/test_pipeline_inspection.py -v
```

Expected: FAIL because the inspection modules are absent.

- [ ] **Step 3: Implement inspection without semantic guessing**

For each source:

1. Parse the page count from `pdfinfo`.
2. Extract text with `pdftotext` to `evidence/<document-id>/extracted.txt`.
3. Render 240-DPI PNGs using `pdftoppm` and deterministic `page-001.png` names.
4. Require rendered-page count to match `pdfinfo`.
5. Write `inspection.json` with source/text hashes, Poppler versions, commands, page paths, and numeric candidates.
6. Mark very short text as `visual_review_required`; do not invoke external OCR in this phase.

The numeric parser may recognize values, tolerances, diameter marks, and units, but must leave semantic fields unset.

- [ ] **Step 4: Run unit and smoke checks**

```bash
python3 -m unittest scripts/paper-doll-3d/tests/test_pipeline_inspection.py -v
pdfinfo '/Users/jordanrichter/Desktop/Best Bottles/Demo-Abbas/Spec Sheets/GBCyl10mBlue (4).pdf' | rg '^Pages:'
```

Expected: tests PASS and smoke output is `Pages: 1`.

- [ ] **Step 5: Commit**

```bash
git add scripts/paper-doll-3d/pipeline_lib/inspection.py \
  scripts/paper-doll-3d/pipeline_lib/measurements.py \
  scripts/paper-doll-3d/tests/test_pipeline_inspection.py \
  pipeline/paper-doll-3d/evidence/.gitkeep
git commit -m "feat: inspect paper-doll source drawings"
```

---

### Task 5: Product Reconciliation and Draft Contracts

**Files:**
- Create: `scripts/paper-doll-3d/pipeline_lib/reconciliation.py`
- Test: `scripts/paper-doll-3d/tests/test_pipeline_reconciliation.py`
- Create: `pipeline/paper-doll-3d/reconciliation/identity-rules.json`
- Create: `pipeline/paper-doll-3d/contracts/bottles/.gitkeep`
- Create: `pipeline/paper-doll-3d/contracts/finishes/.gitkeep`
- Create: `pipeline/paper-doll-3d/contracts/fitments/.gitkeep`
- Create: `pipeline/paper-doll-3d/contracts/components/.gitkeep`
- Create: `pipeline/paper-doll-3d/contracts/closures/.gitkeep`
- Create: `pipeline/paper-doll-3d/contracts/assemblies/.gitkeep`

**Interfaces:**
- Consumes: document and inspection records
- Produces: `load_identity_rules(path: Path) -> tuple[IdentityRule, ...]`
- Produces: `suggest_identity(document, rules) -> ReconciliationResult`
- Produces: `draft_contract(document, inspection, result) -> ContractRecord`
- Produces: `reconcile_pending_documents(pipeline_root: Path) -> ReconciliationReport`

- [ ] **Step 1: Write failing reconciliation tests**

```python
self.assertEqual(suggest("GBCyl10mBlue (4).pdf").sold_product_key, "cylinder-9ml")
self.assertEqual(suggest("GBCyl10mlAmber (2).pdf").sold_product_key, "cylinder-9ml")
self.assertEqual(suggest("GBElegant15 Bottle - Nemat.pdf").sold_product_key, "elegant-15ml")
self.assertEqual(suggest("Slim 100ml screen printable Area (1).pdf").document_role, "print_area_only")
self.assertEqual(suggest("unknown.pdf").status, "needs_review")
```

Assert the cylinder draft preserves `source_capacity_label="10ml"` and `sold_capacity_label="9ml"`, retains source IDs, leaves dimensions unapproved, and creates blocked issues instead of invented fitment data.

- [ ] **Step 2: Run the test to verify failure**

```bash
python3 -m unittest scripts/paper-doll-3d/tests/test_pipeline_reconciliation.py -v
```

Expected: FAIL because `pipeline_lib.reconciliation` is absent.

- [ ] **Step 3: Implement explicit identity rules and drafts**

Seed `identity-rules.json` with all 18 current filename patterns. Each rule has `source_pattern`, `family`, `sold_product_key`, source/sold capacity labels, document role, and review status. Use `DRAWING-COVERAGE.md` to author and review the seed, but never parse that Markdown as runtime truth.

Use this exact seed inventory:

| Source pattern | Sold product key | Document role |
|---|---|---|
| `10ml Bottle dimensions and print area.pdf` | `cylinder-9ml` | `bottle_drawing` |
| `Cylinder 5ml bottle Screen Printing Area Nemat.pdf` | `cylinder-5ml` | `print_area_only` |
| `Flair 15ml.pdf` | `flair-15ml` | `bottle_drawing` |
| `GBCrcl30.pdf` | `circle-30ml` | `bottle_drawing` |
| `GBCrcl50 (3).pdf` | `circle-50ml` | `bottle_drawing` |
| `GBCyl10mBlue (4).pdf` | `cylinder-9ml` | `bottle_drawing` |
| `GBCyl10mlAmber (2).pdf` | `cylinder-9ml` | `bottle_drawing` |
| `GBCyl5mlBlue.pdf` | `cylinder-5ml` | `bottle_drawing` |
| `GBElegant15 Bottle - Nemat.pdf` | `elegant-15ml` | `bottle_drawing` |
| `GBElegant60 Bottle - Nemat (1).pdf` | `elegant-60ml` | `bottle_drawing` |
| `GBElg30 (1).pdf` | `elegant-30ml` | `bottle_drawing` |
| `GBEmpire100 (1).pdf` | `empire-100ml` | `bottle_drawing` |
| `GBEmpire50 (1).pdf` | `empire-50ml` | `bottle_drawing` |
| `GBSleek30 (1).pdf` | `sleek-30ml` | `bottle_drawing` |
| `GBSleek50 (1).pdf` | `sleek-50ml` | `bottle_drawing` |
| `GBTulip6 (1).pdf` | `tulip-6ml` | `bottle_drawing` |
| `Slim 100ml screen printable Area (1).pdf` | `slim-100ml` | `print_area_only` |
| `Tall cylinder 9ml bottle drawing Nemat (1).pdf` | `tall-cylinder-9ml` | `bottle_drawing` |

The two 9 ml blue/amber filename rules may resolve to the same document ID while preserving both observed names and finish context. The repository alias `tall-cylinder-9ml-drawing-nemat-2015.pdf` resolves to the same tall-cylinder document ID.

Print-area-only sources set `geometry_authority=false` and create a missing-drawing issue. Missing fitment/component sources create blocked placeholders without manufactured dimensions. Draft values remain candidates until a named `dimensional_truth` approval exists.

- [ ] **Step 4: Run all foundation tests**

```bash
python3 -m unittest discover -s scripts/paper-doll-3d/tests -p 'test_pipeline_*.py' -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/paper-doll-3d/pipeline_lib/reconciliation.py \
  scripts/paper-doll-3d/tests/test_pipeline_reconciliation.py \
  pipeline/paper-doll-3d/reconciliation/identity-rules.json \
  pipeline/paper-doll-3d/contracts/bottles/.gitkeep \
  pipeline/paper-doll-3d/contracts/finishes/.gitkeep \
  pipeline/paper-doll-3d/contracts/fitments/.gitkeep \
  pipeline/paper-doll-3d/contracts/components/.gitkeep \
  pipeline/paper-doll-3d/contracts/closures/.gitkeep \
  pipeline/paper-doll-3d/contracts/assemblies/.gitkeep
git commit -m "feat: reconcile drawings to draft contracts"
```

---

### Task 6: Scoped Approvals and Dependency Invalidation

**Files:**
- Create: `scripts/paper-doll-3d/pipeline_lib/approvals.py`
- Create: `scripts/paper-doll-3d/pipeline_lib/dependencies.py`
- Test: `scripts/paper-doll-3d/tests/test_pipeline_approvals.py`

**Interfaces:**
- Consumes: entity records, immutable input hashes, approval scopes
- Produces: `create_approval(entity_type, entity_id, scope, artifact_hash, reviewer, decision, notes, decided_at) -> ApprovalRecord`
- Produces: `has_valid_approval(approvals, entity_id, scope, artifact_hash) -> bool`
- Produces: `invalidate_dependents(changed_id, changed_hash, edges, records) -> tuple[str, ...]`

- [ ] **Step 1: Write failing scope and graph tests**

Cover these exact cases:

1. `finish_thread_geometry` does not satisfy `body_geometry`.
2. A hash mismatch invalidates an older approval.
3. A contract change invalidates dependent geometry, assemblies, and assets.
4. A studio-preset change invalidates dependent assets but not geometry.
5. Identical approval content produces the same stable ID; a changed hash produces another ID.

- [ ] **Step 2: Run the test to verify failure**

```bash
python3 -m unittest scripts/paper-doll-3d/tests/test_pipeline_approvals.py -v
```

Expected: FAIL because approval/dependency modules are absent.

- [ ] **Step 3: Implement immutable scoped approvals**

Reject empty reviewer names, unknown scopes/decisions, malformed SHA-256 strings, and timezone-naive timestamps. Define edge types `derived_from`, `uses_geometry`, `uses_finish`, `uses_assembly`, `uses_studio`, `uses_material`, and `renders_asset`. Traverse invalidation with a visited set and sorted output. Write new status/version records; never edit an old approval.

- [ ] **Step 4: Run all foundation tests**

```bash
python3 -m unittest discover -s scripts/paper-doll-3d/tests -p 'test_pipeline_*.py' -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/paper-doll-3d/pipeline_lib/approvals.py \
  scripts/paper-doll-3d/pipeline_lib/dependencies.py \
  scripts/paper-doll-3d/tests/test_pipeline_approvals.py
git commit -m "feat: add scoped paper-doll approvals"
```

---

### Task 7: Protected Artifact Integrity Gate

**Files:**
- Create: `scripts/paper-doll-3d/pipeline_lib/artifacts.py`
- Test: `scripts/paper-doll-3d/tests/test_pipeline_artifacts.py`

**Interfaces:**
- Consumes: `ArtifactRecord`, primary/mirror URIs, expected SHA-256
- Produces: `FileArtifactBackend`
- Produces: `verify_artifact_copy(uri: str, expected_sha256: str, backend) -> bool`
- Produces: `protect_artifact(record: ArtifactRecord, backend, clock) -> ArtifactRecord`

- [ ] **Step 1: Write failing two-copy tests**

```python
with self.assertRaises(ValueError):
    protect_artifact(one_copy_record, backend, clock)
with self.assertRaises(ValueError):
    protect_artifact(mismatched_record, backend, clock)
protected = protect_artifact(two_matching_copies_record, backend, clock)
self.assertEqual(protected.status, "protected")
self.assertEqual(protected.last_integrity_check, "2026-08-11T00:00:00Z")
```

Assert primary and mirror must resolve to different paths and a filename containing `LOCKED` has no effect on status.

- [ ] **Step 2: Run the test to verify failure**

```bash
python3 -m unittest scripts/paper-doll-3d/tests/test_pipeline_artifacts.py -v
```

Expected: FAIL because `pipeline_lib.artifacts` is absent.

- [ ] **Step 3: Implement the filesystem backend**

Support only `file://` URIs. Independently stream/hash primary and mirror, verify byte sizes, hashes, and different resolved paths, then return a new protected record. Preserve an adapter interface with `open(uri)` and `stat(uri)` for a later approved storage backend.

- [ ] **Step 4: Run artifact and full tests**

```bash
python3 -m unittest discover -s scripts/paper-doll-3d/tests -p 'test_pipeline_*.py' -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/paper-doll-3d/pipeline_lib/artifacts.py \
  scripts/paper-doll-3d/tests/test_pipeline_artifacts.py
git commit -m "feat: require verified paper-doll artifact backups"
```

---

### Task 8: Derived SQLite Index and Status Report

**Files:**
- Create: `scripts/paper-doll-3d/pipeline_lib/index.py`
- Test: `scripts/paper-doll-3d/tests/test_pipeline_index.py`
- Create: `pipeline/paper-doll-3d/indexes/.gitkeep`

**Interfaces:**
- Consumes: source-controlled JSON records
- Produces: `rebuild_index(pipeline_root: Path, db_path: Path) -> IndexSummary`
- Produces: `status_rows(db_path: Path) -> tuple[dict, ...]`
- Produces: `blocked_rows(db_path: Path) -> tuple[dict, ...]`

- [ ] **Step 1: Write failing rebuild/query tests**

Create temporary document, contract, approval, dependency, issue, and artifact records. Assert two rebuilds give the same counts, a deleted database can be regenerated, blocked issue text remains queryable, and approval scope is independent of entity status.

- [ ] **Step 2: Run the test to verify failure**

```bash
python3 -m unittest scripts/paper-doll-3d/tests/test_pipeline_index.py -v
```

Expected: FAIL because `pipeline_lib.index` is absent.

- [ ] **Step 3: Implement the disposable index**

Create these tables exactly:

```sql
CREATE TABLE entities (id TEXT PRIMARY KEY, kind TEXT NOT NULL, status TEXT NOT NULL, content_hash TEXT NOT NULL, json_path TEXT NOT NULL);
CREATE TABLE approvals (id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, scope TEXT NOT NULL, artifact_hash TEXT NOT NULL, decision TEXT NOT NULL);
CREATE TABLE dependencies (id TEXT PRIMARY KEY, source_id TEXT NOT NULL, target_id TEXT NOT NULL, edge_type TEXT NOT NULL);
CREATE TABLE issues (id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, severity TEXT NOT NULL, message TEXT NOT NULL, status TEXT NOT NULL);
CREATE TABLE artifacts (id TEXT PRIMARY KEY, status TEXT NOT NULL, sha256 TEXT NOT NULL, primary_uri TEXT, mirror_uri TEXT);
```

Build in a temporary SQLite file, commit, and atomically replace the old index. JSON remains authoritative.

- [ ] **Step 4: Run all foundation tests**

```bash
python3 -m unittest discover -s scripts/paper-doll-3d/tests -p 'test_pipeline_*.py' -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/paper-doll-3d/pipeline_lib/index.py \
  scripts/paper-doll-3d/tests/test_pipeline_index.py \
  pipeline/paper-doll-3d/indexes/.gitkeep
git commit -m "feat: index paper-doll production status"
```

---

### Task 9: Review Packets and Truthful Legacy Inventory

**Files:**
- Create: `scripts/paper-doll-3d/pipeline_lib/review.py`
- Create: `scripts/paper-doll-3d/pipeline_lib/legacy.py`
- Test: `scripts/paper-doll-3d/tests/test_pipeline_review_legacy.py`
- Create: `pipeline/paper-doll-3d/reconciliation/legacy-status.json`
- Create: `pipeline/paper-doll-3d/reviews/foundation/.gitkeep`

**Interfaces:**
- Consumes: records, evidence, approvals, issues, and current scene paths
- Produces: `write_foundation_review(pipeline_root: Path, output: Path) -> Path`
- Produces: `inventory_legacy_assets(master_root: Path, status_rules: dict) -> tuple[ArtifactRecord, ...]`
- Produces: `inventory_pending_legacy_assets(pipeline_root: Path) -> LegacyReport`

- [ ] **Step 1: Write failing review/migration tests**

Assert the review includes document, duplicate, spec-ready, blocked, and missing-component counts, approval scopes, and evidence links.

Assert legacy inventory:

- defaults unknown scenes to `imported_unverified`;
- retains an explicitly documented 17-415 finish/thread approval without adding body approval;
- keeps Circle 15 ml and Circle 100 ml `extrapolated`;
- defaults `working/` scenes to `experimental`;
- never infers approval from `LOCKED` in a filename.

- [ ] **Step 2: Run the test to verify failure**

```bash
python3 -m unittest scripts/paper-doll-3d/tests/test_pipeline_review_legacy.py -v
```

Expected: FAIL because review/legacy modules are absent.

- [ ] **Step 3: Implement explicit legacy status and the review packet**

`legacy-status.json` uses exact relative paths or artifact hashes. Every rule contains status, approved scopes, evidence note, and reviewer source. Unknown files remain unverified.

Write Markdown sections in this order:

1. Intake summary.
2. Documents and rendered pages.
3. Identity reconciliation.
4. Draft bottle/finish contracts.
5. Missing fitment/component/assembly evidence.
6. Conflicts and blockers.
7. Legacy scene inventory and scoped approvals.
8. Eligible next decisions.

- [ ] **Step 4: Run all foundation tests**

```bash
python3 -m unittest discover -s scripts/paper-doll-3d/tests -p 'test_pipeline_*.py' -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/paper-doll-3d/pipeline_lib/review.py \
  scripts/paper-doll-3d/pipeline_lib/legacy.py \
  scripts/paper-doll-3d/tests/test_pipeline_review_legacy.py \
  pipeline/paper-doll-3d/reconciliation/legacy-status.json \
  pipeline/paper-doll-3d/reviews/foundation/.gitkeep
git commit -m "feat: report paper-doll evidence and legacy status"
```

---

### Task 10: Thin CLI, Orchestration, and 18-Document Dry Run

**Files:**
- Create: `scripts/paper-doll-3d/pipeline.py`
- Create: `scripts/paper-doll-3d/pipeline_lib/orchestrator.py`
- Test: `scripts/paper-doll-3d/tests/test_pipeline_cli_e2e.py`
- Modify: `pipeline/paper-doll-3d/RIG-MANUAL.md`
- Produce: `pipeline/paper-doll-3d/reviews/foundation/document-contract-foundation.md`
- Produce: source-controlled document, contract, issue, dependency, approval, and artifact records

**Interfaces:**
- Consumes: all foundation modules
- Produces commands: `intake`, `inspect`, `reconcile`, `inventory-legacy`, `rebuild-index`, `review`, `status`, `run`
- Produces: `run_foundation(source_dir: Path, pipeline_root: Path) -> RunSummary`

- [ ] **Step 1: Write failing CLI/resume tests**

Call `pipeline.main(argv)` with temporary paths. Assert:

- `intake` exits 0 and prints a JSON summary;
- `run` advances only intake, inspection, reconciliation, legacy inventory, index, and review;
- `run` never invokes Blender or creates `.blend` files;
- blocked records remain visible;
- two identical runs produce identical source-controlled record hashes;
- `status --json` is machine-readable;
- unknown commands exit 2 through `argparse`.

- [ ] **Step 2: Run the test to verify failure**

```bash
python3 -m unittest scripts/paper-doll-3d/tests/test_pipeline_cli_e2e.py -v
```

Expected: FAIL because the CLI/orchestrator is absent.

- [ ] **Step 3: Implement the thin dispatcher**

`pipeline.py` defines arguments and dispatches only. Defaults resolve from the repository root; tests can inject `--source` and `--pipeline-root`.

Implement `run_foundation` with this exact stage order:

```python
intake_report = intake_documents(source_dir, pipeline_root)
inspection_report = inspect_pending_documents(pipeline_root)
mirror_report = audit_existing_mirror(
    pipeline_root / "specs",
    iter_records(pipeline_root, "documents", DocumentRecord),
)
reconciliation_report = reconcile_pending_documents(pipeline_root)
legacy_report = inventory_pending_legacy_assets(pipeline_root)
index_report = rebuild_index(pipeline_root, pipeline_root / "indexes/pipeline.sqlite")
review_path = write_foundation_review(
    pipeline_root, pipeline_root / "reviews/foundation/document-contract-foundation.md"
)
return RunSummary(
    intake=intake_report,
    inspection=inspection_report,
    mirror=mirror_report,
    reconciliation=reconciliation_report,
    legacy=legacy_report,
    index=index_report,
    review_path=str(review_path),
)
```

Do not add approval automation, Blender calls, promotion, rendering, or publishing.

- [ ] **Step 4: Capture the pre-run Blender hash manifest**

```bash
find pipeline/paper-doll-3d/master -type f -name '*.blend' -print0 \
  | sort -z | xargs -0 shasum -a 256 \
  > /tmp/paper-doll-existing-blends-before.sha256
```

Expected: command exits 0 and records every existing `.blend`.

- [ ] **Step 5: Run the full foundation unit suite**

```bash
python3 -m unittest discover -s scripts/paper-doll-3d/tests -p 'test_pipeline_*.py' -v
```

Expected: all tests PASS with zero failures and errors.

- [ ] **Step 6: Run the real 18-document pass**

```bash
python3 scripts/paper-doll-3d/pipeline.py run \
  --source '/Users/jordanrichter/Desktop/Best Bottles/Demo-Abbas/Spec Sheets' \
  --pipeline-root pipeline/paper-doll-3d
```

Expected:

- `discovered: 18`;
- first clean intake has 17 new content hashes and one duplicate observed file;
- existing repository specs report 17 matching hashes across 19 filenames, two duplicate file instances, and zero unknown hashes;
- every source has one canonical PDF/document record and inspection packet;
- semantic dimensions remain candidates;
- print-area-only sources and missing component evidence are blocked;
- no `.blend` file is created or modified;
- the review path is printed.

- [ ] **Step 7: Prove idempotency**

Create a manifest before the second run:

```bash
find pipeline/paper-doll-3d \
  \( -path '*/indexes/*' -o -path '*/evidence/*/*.png' \) -prune \
  -o -type f \( -name '*.json' -o -name '*.pdf' -o -name '*.md' \) -print0 \
  | sort -z | xargs -0 shasum -a 256 \
  > /tmp/paper-doll-foundation-before.sha256
```

Rerun `pipeline.py run`, create `/tmp/paper-doll-foundation-after.sha256` with the same `find` command, and run:

```bash
diff -u /tmp/paper-doll-foundation-before.sha256 /tmp/paper-doll-foundation-after.sha256
```

Expected: `diff` exits 0 with no output.

- [ ] **Step 8: Prove Blender binaries were untouched**

```bash
find pipeline/paper-doll-3d/master -type f -name '*.blend' -print0 \
  | sort -z | xargs -0 shasum -a 256 \
  > /tmp/paper-doll-existing-blends-after.sha256
diff -u /tmp/paper-doll-existing-blends-before.sha256 \
  /tmp/paper-doll-existing-blends-after.sha256
```

Expected: `diff` exits 0 with no output.

- [ ] **Step 9: Update the operator manual**

Add “Document and contract foundation” to `RIG-MANUAL.md` with the real command, candidate-versus-approved explanation, review-before-Blender rule, and generated foundation-review link. Preserve existing geometry/thread laws.

- [ ] **Step 10: Run final verification**

```bash
python3 -m unittest discover -s scripts/paper-doll-3d/tests -p 'test_pipeline_*.py' -v
git diff --check
python3 scripts/paper-doll-3d/pipeline.py status \
  --pipeline-root pipeline/paper-doll-3d --json
```

Expected: all tests PASS; `git diff --check` exits 0; status reports 18 intake documents and explicit blockers without new geometry approval.

- [ ] **Step 11: Commit the dry run**

Review scope before staging. Do not stage `.blend`, renders, SQLite, temporary, or unrelated dirty-worktree files.

```bash
git add scripts/paper-doll-3d/pipeline.py \
  scripts/paper-doll-3d/pipeline_lib/orchestrator.py \
  scripts/paper-doll-3d/tests/test_pipeline_cli_e2e.py \
  pipeline/paper-doll-3d/documents pipeline/paper-doll-3d/evidence \
  pipeline/paper-doll-3d/contracts \
  pipeline/paper-doll-3d/approvals pipeline/paper-doll-3d/dependencies \
  pipeline/paper-doll-3d/issues pipeline/paper-doll-3d/artifacts/records \
  pipeline/paper-doll-3d/reconciliation \
  pipeline/paper-doll-3d/reviews/foundation \
  pipeline/paper-doll-3d/RIG-MANUAL.md
git commit -m "feat: run paper-doll document foundation"
```

## Foundation Exit Gate

Do not begin Blender, studio, assembly, or asset-rendering work until:

- all 18 Desktop PDFs are archived by hash and visually inspectable;
- the repository's nineteenth filename is recorded as an exact duplicate tall-cylinder alias;
- source and sold capacities remain independent;
- no candidate dimension is approved automatically;
- missing drawings/components produce blockers;
- existing scene statuses and approval scopes remain exact;
- the second full run is idempotent;
- existing `.blend` hashes are unchanged;
- Jordan accepts the foundation review packet.
