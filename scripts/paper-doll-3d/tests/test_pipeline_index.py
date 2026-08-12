import json
import sqlite3
import sys
import tempfile
import unittest
from contextlib import closing
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "scripts/paper-doll-3d"))

from pipeline_lib.ids import content_hash
from pipeline_lib.index import blocked_rows, rebuild_index, status_rows
from pipeline_lib.models import (
    ApprovalRecord,
    ArtifactRecord,
    ContractRecord,
    DependencyRecord,
    DocumentRecord,
    IssueRecord,
)
from pipeline_lib.store import atomic_write_json, write_record


class PipelineIndexTests(unittest.TestCase):
    def _records(self, pipeline_root: Path) -> dict[str, object]:
        records = {
            "document": DocumentRecord(
                id="doc_1", sha256="d" * 64,
                canonical_path="documents/originals/doc_1.pdf",
                observed_names=("drawing.pdf",), status="archived",
            ),
            "contract": ContractRecord(
                id="contract_1", contract_type="bottle", document_ids=("doc_1",),
                sold_product_key="cylinder-9ml", source_capacity_label="10ml",
                sold_capacity_label="9ml", geometry_authority=True,
                dimensions=({"field": "height", "value": 72.0},), status="draft",
            ),
            "approval": ApprovalRecord(
                id="approval_1", entity_type="contract", entity_id="contract_1",
                scope="finish_thread_geometry", artifact_hash="a" * 64,
                reviewer="Jordan Richter", decided_at="2026-08-11T00:00:00Z",
                decision="approved", notes="17-415 thread only",
            ),
            "dependency": DependencyRecord(
                id="dependency_1", source_id="doc_1", target_id="contract_1",
                edge_type="derived_from", source_hash="d" * 64,
            ),
            "issue": IssueRecord(
                id="issue_1", entity_id="contract_1", severity="blocked",
                message="Fitment drawing missing", status="open",
                code="MISSING_FITMENT",
            ),
            "artifact": ArtifactRecord(
                id="artifact_1", sha256="f" * 64, size_bytes=42,
                primary_uri="file:///primary.blend",
                mirror_uri="file:///mirror.blend", status="candidate",
            ),
        }
        write_record(pipeline_root, "documents", records["document"])
        atomic_write_json(
            pipeline_root / "contracts/bottles/contract_1.json",
            records["contract"].to_dict(),
        )
        record_kinds = {
            "approval": "approvals",
            "dependency": "dependencies",
            "issue": "issues",
            "artifact": "artifacts",
        }
        for kind, store_kind in record_kinds.items():
            write_record(pipeline_root, store_kind, records[kind])
        return records

    def test_rebuild_is_repeatable_regenerable_and_keeps_json_authoritative(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            pipeline_root = root / "pipeline"
            records = self._records(pipeline_root)
            db_path = root / "derived/indexes/pipeline.sqlite"
            json_before = {
                path.relative_to(pipeline_root).as_posix(): path.read_bytes()
                for path in pipeline_root.rglob("*.json")
            }

            first = rebuild_index(pipeline_root, db_path)
            second = rebuild_index(pipeline_root, db_path)

            self.assertEqual(first, second)
            self.assertEqual(
                first,
                type(first)(
                    entities=3, approvals=1, dependencies=1, issues=1, artifacts=1,
                ),
            )
            self.assertEqual(status_rows(db_path), (
                {
                    "id": "artifact_1", "kind": "artifact", "status": "candidate",
                    "content_hash": content_hash(records["artifact"].to_dict()),
                    "json_path": "artifacts/records/artifact_1.json",
                },
                {
                    "id": "contract_1", "kind": "contract", "status": "draft",
                    "content_hash": content_hash(records["contract"].to_dict()),
                    "json_path": "contracts/bottles/contract_1.json",
                },
                {
                    "id": "doc_1", "kind": "document", "status": "archived",
                    "content_hash": content_hash(records["document"].to_dict()),
                    "json_path": "documents/records/doc_1.json",
                },
            ))
            self.assertEqual(blocked_rows(db_path), ({
                "id": "issue_1", "entity_id": "contract_1", "severity": "blocked",
                "message": "Fitment drawing missing", "status": "open",
            },))

            with closing(sqlite3.connect(db_path)) as connection:
                contract_status = connection.execute(
                    "SELECT status FROM entities WHERE id = 'contract_1'"
                ).fetchone()[0]
                approval = connection.execute(
                    "SELECT scope, decision FROM approvals WHERE id = 'approval_1'"
                ).fetchone()
            self.assertEqual(contract_status, "draft")
            self.assertEqual(approval, ("finish_thread_geometry", "approved"))
            self.assertEqual(
                {
                    path.relative_to(pipeline_root).as_posix(): path.read_bytes()
                    for path in pipeline_root.rglob("*.json")
                },
                json_before,
            )

            db_path.unlink()
            regenerated = rebuild_index(pipeline_root, db_path)
            self.assertEqual(regenerated, first)
            self.assertEqual(blocked_rows(db_path)[0]["message"], "Fitment drawing missing")

    def test_rebuild_creates_only_the_exact_disposable_tables(self):
        expected_columns = {
            "entities": ("id", "kind", "status", "content_hash", "json_path"),
            "approvals": (
                "id", "entity_id", "scope", "artifact_hash", "decision",
            ),
            "dependencies": ("id", "source_id", "target_id", "edge_type"),
            "issues": ("id", "entity_id", "severity", "message", "status"),
            "artifacts": (
                "id", "status", "sha256", "primary_uri", "mirror_uri",
            ),
        }
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            pipeline_root = root / "pipeline"
            self._records(pipeline_root)
            db_path = root / "pipeline.sqlite"

            rebuild_index(pipeline_root, db_path)

            with closing(sqlite3.connect(db_path)) as connection:
                tables = tuple(
                    row[0] for row in connection.execute(
                        "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
                    )
                )
                columns = {
                    table: tuple(
                        row[1] for row in connection.execute(f"PRAGMA table_info({table})")
                    )
                    for table in expected_columns
                }
            self.assertEqual(tables, tuple(sorted(expected_columns)))
            self.assertEqual(columns, expected_columns)

    def test_malformed_or_duplicate_authority_fails_without_replacing_last_good_index(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            pipeline_root = root / "pipeline"
            records = self._records(pipeline_root)
            db_path = root / "indexes/pipeline.sqlite"
            rebuild_index(pipeline_root, db_path)
            good_database = db_path.read_bytes()

            malformed = pipeline_root / "issues/records/malformed.json"
            malformed.write_text(json.dumps({"id": "malformed"}), encoding="utf-8")
            with self.assertRaises(ValueError):
                rebuild_index(pipeline_root, db_path)
            self.assertEqual(db_path.read_bytes(), good_database)
            self.assertEqual(list(db_path.parent.glob("*.tmp")), [])

            malformed.unlink()
            atomic_write_json(
                pipeline_root / "contracts/components/duplicate.json",
                records["contract"].to_dict(),
            )
            with self.assertRaisesRegex(ValueError, "duplicate entity id"):
                rebuild_index(pipeline_root, db_path)
            self.assertEqual(db_path.read_bytes(), good_database)
            self.assertEqual(list(db_path.parent.glob("*.tmp")), [])

    def test_rebuild_rejects_a_json_authority_path_as_the_database_target(self):
        with tempfile.TemporaryDirectory() as directory:
            pipeline_root = Path(directory) / "pipeline"
            self._records(pipeline_root)
            authority_path = pipeline_root / "documents/records/doc_1.json"
            authority_before = authority_path.read_bytes()

            with self.assertRaisesRegex(ValueError, "JSON authority"):
                rebuild_index(pipeline_root, authority_path)

            self.assertEqual(authority_path.read_bytes(), authority_before)


if __name__ == "__main__":
    unittest.main()
