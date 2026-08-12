import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "scripts/paper-doll-3d"))

from pipeline_lib.legacy import (  # noqa: E402
    inventory_legacy_assets,
    inventory_pending_legacy_assets,
)
from pipeline_lib.models import (  # noqa: E402
    ApprovalRecord,
    ArtifactRecord,
    ContractRecord,
    DocumentRecord,
    IssueRecord,
)
from pipeline_lib.review import write_foundation_review  # noqa: E402
from pipeline_lib.store import atomic_write_json, iter_records, write_record  # noqa: E402


LEGACY_RULES_PATH = ROOT / "pipeline/paper-doll-3d/reconciliation/legacy-status.json"


def _rule(relative_path, status, scopes=(), note="Documented evidence.", source="review.md"):
    return {
        "relative_path": relative_path,
        "status": status,
        "approved_scopes": list(scopes),
        "evidence_note": note,
        "reviewer_source": source,
    }


class LegacyInventoryTests(unittest.TestCase):
    def _write_scene(self, master_root: Path, relative_path: str, content: bytes) -> Path:
        path = master_root / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
        return path

    def test_exact_rules_preserve_only_documented_scope_and_conservative_defaults(self):
        with tempfile.TemporaryDirectory() as directory:
            master_root = Path(directory) / "master"
            self._write_scene(master_root, "builds/circle15--bare.blend", b"circle 15")
            self._write_scene(master_root, "builds/circle100--bare.blend", b"circle 100")
            self._write_scene(
                master_root,
                "locked/009--17-415-cobalt-APPROVED-BASELINE-2026-08-11.blend",
                b"approved thread baseline",
            )
            self._write_scene(master_root, "locked/unknown-LOCKED.blend", b"unknown locked")
            self._write_scene(master_root, "builds/unknown.blend", b"unknown build")
            self._write_scene(
                master_root, "working/body-APPROVED-LOCKED.blend", b"working scene",
            )
            rules = {
                "schema_version": 1,
                "rules": [
                    _rule("builds/circle15--bare.blend", "extrapolated"),
                    _rule("builds/circle100--bare.blend", "extrapolated"),
                    _rule(
                        "locked/009--17-415-cobalt-APPROVED-BASELINE-2026-08-11.blend",
                        "approved",
                        ("finish_thread_geometry",),
                        "Jordan-approved 17-415 finish/thread geometry only.",
                        "five-variant-design.md",
                    ),
                ],
            }

            records = inventory_legacy_assets(master_root, rules)
            by_path = {
                Path(record.primary_uri.removeprefix("file://")).relative_to(
                    master_root.resolve()
                ).as_posix(): record
                for record in records
            }

            self.assertEqual(len(records), 6)
            self.assertEqual(by_path["builds/circle15--bare.blend"].status, "extrapolated")
            self.assertEqual(by_path["builds/circle100--bare.blend"].status, "extrapolated")
            baseline = by_path[
                "locked/009--17-415-cobalt-APPROVED-BASELINE-2026-08-11.blend"
            ]
            self.assertEqual(baseline.status, "approved")
            self.assertEqual(baseline.approved_scopes, ("finish_thread_geometry",))
            self.assertNotIn("body_geometry", baseline.approved_scopes)
            self.assertEqual(by_path["builds/unknown.blend"].status, "imported_unverified")
            self.assertEqual(
                by_path["locked/unknown-LOCKED.blend"].status, "imported_unverified",
            )
            working = by_path["working/body-APPROVED-LOCKED.blend"]
            self.assertEqual(working.status, "experimental")
            self.assertEqual(working.approved_scopes, ())

    def test_hash_rule_is_exact_and_rule_registry_rejects_ambiguity_or_missing_provenance(self):
        with tempfile.TemporaryDirectory() as directory:
            master_root = Path(directory) / "master"
            content = b"hash-classified legacy scene"
            scene = self._write_scene(master_root, "builds/renamed.blend", content)
            digest = hashlib.sha256(content).hexdigest()
            rules = {
                "schema_version": 1,
                "rules": [{
                    "artifact_hash": digest,
                    "status": "candidate",
                    "approved_scopes": [],
                    "evidence_note": "Hash-specific review only.",
                    "reviewer_source": "review-log.json",
                }],
            }

            record = inventory_legacy_assets(master_root, rules)[0]

            self.assertEqual(record.sha256, digest)
            self.assertEqual(record.primary_uri, scene.resolve().as_uri())
            self.assertEqual(record.status, "candidate")
            self.assertEqual(record.approved_scopes, ())

            ambiguous = {
                "schema_version": 1,
                "rules": [rules["rules"][0], _rule("builds/renamed.blend", "extrapolated")],
            }
            with self.assertRaisesRegex(ValueError, "multiple legacy status rules"):
                inventory_legacy_assets(master_root, ambiguous)

            missing_source = {
                "schema_version": 1,
                "rules": [{
                    "relative_path": "builds/renamed.blend",
                    "status": "candidate",
                    "approved_scopes": [],
                    "evidence_note": "Not enough provenance.",
                    "reviewer_source": "",
                }],
            }
            with self.assertRaisesRegex(ValueError, "reviewer_source"):
                inventory_legacy_assets(master_root, missing_source)

    def test_inventory_rejects_scene_symlinks_without_reading_outside_master(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            master_root = root / "master"
            master_root.mkdir()
            outside = root / "outside.blend"
            outside.write_bytes(b"must not be read")
            (master_root / "escape.blend").symlink_to(outside)

            with self.assertRaisesRegex(ValueError, "scene path"):
                inventory_legacy_assets(master_root, {"schema_version": 1, "rules": []})

    def test_inventory_rejects_symlinked_scene_directories_instead_of_omitting_them(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            master_root = root / "master"
            master_root.mkdir()
            outside = root / "outside-scenes"
            outside.mkdir()
            (outside / "hidden.blend").write_bytes(b"must not be read or omitted")
            (master_root / "linked-scenes").symlink_to(outside, target_is_directory=True)

            with self.assertRaisesRegex(ValueError, "scene directory"):
                inventory_legacy_assets(master_root, {"schema_version": 1, "rules": []})

    def test_pending_inventory_persists_strict_records_idempotently(self):
        with tempfile.TemporaryDirectory() as directory:
            pipeline_root = Path(directory) / "pipeline"
            master_root = pipeline_root / "master"
            self._write_scene(master_root, "builds/unknown.blend", b"unknown")
            rules_path = pipeline_root / "reconciliation/legacy-status.json"
            atomic_write_json(rules_path, {"schema_version": 1, "rules": []})

            first = inventory_pending_legacy_assets(pipeline_root)
            record_paths = sorted((pipeline_root / "artifacts/records").glob("*.json"))
            bytes_before = {path.name: path.read_bytes() for path in record_paths}
            second = inventory_pending_legacy_assets(pipeline_root)

            self.assertEqual(first, second)
            self.assertEqual(first.discovered, 1)
            self.assertEqual(first.written, 1)
            self.assertEqual(first.status_counts, (("imported_unverified", 1),))
            self.assertEqual(len(record_paths), 1)
            self.assertEqual(
                tuple(iter_records(pipeline_root, "artifacts", ArtifactRecord)),
                first.artifact_records,
            )
            self.assertEqual(
                {path.name: path.read_bytes() for path in record_paths}, bytes_before,
            )
            self.assertEqual(list((pipeline_root / "artifacts/records").glob("*.tmp")), [])

    def test_checked_in_registry_names_only_exact_documented_exceptions(self):
        registry = json.loads(LEGACY_RULES_PATH.read_text(encoding="utf-8"))
        self.assertEqual(inventory_legacy_assets(ROOT / "absent-master", registry), ())
        rules = {rule["relative_path"]: rule for rule in registry["rules"]}
        circle_note = "No manufacturer drawing; extrapolated pending source evidence."

        for relative_path in (
            "builds/circle15--bare.blend",
            "builds/circle100--bare.blend",
        ):
            with self.subTest(relative_path=relative_path):
                self.assertEqual(rules[relative_path]["status"], "extrapolated")
                self.assertEqual(rules[relative_path]["approved_scopes"], [])
                self.assertEqual(rules[relative_path]["evidence_note"], circle_note)
                self.assertEqual(
                    rules[relative_path]["reviewer_source"],
                    "pipeline/paper-doll-3d/HANDOVER-2026-08-10.md",
                )

        approved_paths = {
            path for path, rule in rules.items() if rule["status"] == "approved"
        }
        self.assertEqual(len(approved_paths), 6)
        self.assertIn(
            "locked/009--17-415-cobalt-APPROVED-BASELINE-2026-08-11.blend",
            approved_paths,
        )
        self.assertTrue(all(
            rules[path]["approved_scopes"] == ["finish_thread_geometry"]
            for path in approved_paths
        ))
        self.assertFalse(any(path.startswith("working/") for path in rules))


class FoundationReviewTests(unittest.TestCase):
    def _seed_records(self, pipeline_root: Path) -> None:
        documents = (
            DocumentRecord(
                id="doc_1", sha256="a" * 64,
                canonical_path="documents/originals/a.pdf",
                observed_names=("drawing.pdf", "drawing-copy.pdf"),
                observed_paths=("/source/drawing.pdf", "/source/drawing-copy.pdf"),
                status="inspected",
            ),
            DocumentRecord(
                id="doc_2", sha256="b" * 64,
                canonical_path="documents/originals/b.pdf",
                observed_names=("unknown.pdf",), status="needs_reconciliation",
            ),
        )
        for document in documents:
            write_record(pipeline_root, "documents", document)
        atomic_write_json(
            pipeline_root / "evidence/doc_1/inspection.json",
            {
                "schema_version": 1,
                "document_id": "doc_1",
                "source_sha256": "a" * 64,
                "page_count": 2,
                "page_paths": ["page-001.png", "page-002.png"],
                "candidates": [{"value": 72.0, "status": "candidate"}],
            },
        )
        for page in ("page-001.png", "page-002.png"):
            (pipeline_root / "evidence/doc_1" / page).write_bytes(b"png")

        contracts = (
            ContractRecord(
                id="contract_bottle_1", contract_type="bottle", document_ids=("doc_1",),
                sold_product_key="cylinder-9ml", source_capacity_label="10ml",
                sold_capacity_label="9ml", geometry_authority=True,
                dimensions=({"value": 72.0, "status": "candidate"},), status="draft",
            ),
            ContractRecord(
                id="contract_finish_1", contract_type="finish", document_ids=("doc_1",),
                sold_product_key="cylinder-9ml", source_capacity_label="10ml",
                sold_capacity_label="9ml", geometry_authority=True,
                dimensions=({"value": 16.3, "status": "candidate"},), status="draft",
            ),
            ContractRecord(
                id="contract_fitment_1", contract_type="fitment", document_ids=("doc_1",),
                sold_product_key="cylinder-9ml", source_capacity_label="10ml",
                sold_capacity_label="9ml", geometry_authority=False,
                dimensions=(), status="blocked",
            ),
            ContractRecord(
                id="contract_component_1", contract_type="component", document_ids=("doc_1",),
                sold_product_key="cylinder-9ml", source_capacity_label="10ml",
                sold_capacity_label="9ml", geometry_authority=False,
                dimensions=(), status="blocked",
            ),
        )
        contract_directories = {
            "bottle": "bottles", "finish": "finishes", "fitment": "fitments",
            "component": "components",
        }
        for contract in contracts:
            atomic_write_json(
                pipeline_root / "contracts" / contract_directories[contract.contract_type]
                / f"{contract.id}.json",
                contract.to_dict(),
            )

        issues = (
            IssueRecord(
                "issue_fitment", "contract_fitment_1", "blocked",
                "Fitment drawing missing.", "open", "MISSING_FITMENT_DRAWING",
            ),
            IssueRecord(
                "issue_component", "contract_component_1", "blocked",
                "Component drawing missing.", "open", "MISSING_COMPONENT_DRAWING",
            ),
            IssueRecord(
                "issue_assembly", "contract_bottle_1", "blocked",
                "Assembly evidence missing.", "open", "MISSING_ASSEMBLY_EVIDENCE",
            ),
        )
        for issue in issues:
            write_record(pipeline_root, "issues", issue)

        write_record(
            pipeline_root,
            "approvals",
            ApprovalRecord(
                "approval_finish", "artifact", "artifact_baseline",
                "finish_thread_geometry", "c" * 64, "Jordan Richter",
                "2026-08-11T00:00:00Z", "approved", "17-415 finish only.",
            ),
        )
        write_record(
            pipeline_root,
            "artifacts",
            ArtifactRecord(
                "artifact_baseline", "c" * 64, 42, "file:///master/baseline.blend", "",
                "approved", approved_scopes=("finish_thread_geometry",),
                evidence_note="17-415 finish only.", reviewer_source="design.md",
            ),
        )

    def test_review_packet_has_exact_section_order_counts_scopes_links_and_decisions(self):
        headings = (
            "## 1. Intake summary",
            "## 2. Documents and rendered pages",
            "## 3. Identity reconciliation",
            "## 4. Draft bottle/finish contracts",
            "## 5. Missing fitment/component/assembly evidence",
            "## 6. Conflicts and blockers",
            "## 7. Legacy scene inventory and scoped approvals",
            "## 8. Eligible next decisions",
        )
        with tempfile.TemporaryDirectory() as directory:
            pipeline_root = Path(directory) / "pipeline"
            self._seed_records(pipeline_root)
            output = pipeline_root / "reviews/foundation/review.md"

            result = write_foundation_review(pipeline_root, output)
            first_bytes = output.read_bytes()
            second = write_foundation_review(pipeline_root, output)
            text = output.read_text(encoding="utf-8")

            self.assertEqual(result, output.resolve())
            self.assertEqual(second, result)
            self.assertEqual(output.read_bytes(), first_bytes)
            positions = [text.index(heading) for heading in headings]
            self.assertEqual(positions, sorted(positions))
            self.assertEqual(text.count("\n## "), 8)
            for expected in (
                "Documents: 2", "Duplicate observations: 1", "Rendered pages: 2",
                "Spec-ready contracts: 1", "Open blockers: 3", "Missing fitments: 1",
                "Missing components: 1", "Missing assemblies: 1",
                "`finish_thread_geometry`", "`contract_bottle_1`",
                "[page-001.png](../../evidence/doc_1/page-001.png)",
                "[page-002.png](../../evidence/doc_1/page-002.png)",
            ):
                with self.subTest(expected=expected):
                    self.assertIn(expected, text)
            self.assertNotIn("`body_geometry`", text)
            self.assertEqual(list(output.parent.glob("*.tmp")), [])

    def test_review_rejects_output_and_evidence_reads_outside_pipeline(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            pipeline_root = root / "pipeline"
            self._seed_records(pipeline_root)

            with self.assertRaisesRegex(ValueError, "review output"):
                write_foundation_review(pipeline_root, root / "outside.md")

            evidence = pipeline_root / "evidence/doc_1"
            for path in evidence.iterdir():
                path.unlink()
            evidence.rmdir()
            outside = root / "outside-evidence"
            outside.mkdir()
            atomic_write_json(
                outside / "inspection.json",
                {
                    "schema_version": 1, "document_id": "doc_1",
                    "source_sha256": "a" * 64, "page_count": 0,
                    "page_paths": [], "candidates": [],
                },
            )
            evidence.symlink_to(outside, target_is_directory=True)

            with self.assertRaisesRegex(ValueError, "evidence"):
                write_foundation_review(
                    pipeline_root, pipeline_root / "reviews/foundation/review.md",
                )


if __name__ == "__main__":
    unittest.main()
