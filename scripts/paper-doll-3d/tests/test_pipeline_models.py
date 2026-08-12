import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "scripts/paper-doll-3d"))

from pipeline_lib.ids import canonical_json, stable_id
from pipeline_lib.models import (
    APPROVAL_SCOPES,
    ApprovalRecord,
    ArtifactRecord,
    ContractRecord,
    DependencyRecord,
    DocumentRecord,
    IssueRecord,
)


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

    def test_other_records_round_trip(self):
        records = (
            ContractRecord(
                id="contract_1", contract_type="bottle", document_ids=("doc_1",),
                sold_product_key="cylinder-9ml", source_capacity_label="10ml",
                sold_capacity_label="9ml", geometry_authority=True,
                dimensions=({"field": "height", "value": 72.0},), status="draft",
            ),
            ApprovalRecord(
                id="approval_1", entity_type="geometry", entity_id="geo_1",
                scope="body_geometry", artifact_hash="a" * 64,
                reviewer="Jordan Richter", decided_at="2026-08-11T00:00:00Z",
                decision="approved", notes="body only",
            ),
            DependencyRecord(
                id="dependency_1", source_id="contract_1", target_id="geo_1",
                edge_type="derived_from", source_hash="a" * 64,
            ),
            IssueRecord(
                id="issue_1", entity_id="contract_1", severity="blocked",
                message="Fitment drawing missing", status="open", code="MISSING_FITMENT",
            ),
            ArtifactRecord(
                id="artifact_1", sha256="a" * 64, size_bytes=42,
                primary_uri="assets/primary.blend", mirror_uri="assets/mirror.blend",
                status="candidate", approved_scopes=("body_geometry",),
            ),
        )
        for record in records:
            with self.subTest(record=record.id):
                self.assertEqual(type(record).from_dict(record.to_dict()), record)

    def test_from_dict_rejects_unknown_fields_schema_versions_and_values(self):
        document = DocumentRecord("doc_1", "abc", "documents/a.pdf", ("a.pdf",), "archived")
        invalid_field = document.to_dict() | {"unexpected": True}
        invalid_schema = document.to_dict() | {"schema_version": 2}
        invalid_status = document.to_dict() | {"status": "unknown"}
        for payload in (invalid_field, invalid_schema, invalid_status):
            with self.subTest(payload=payload):
                with self.assertRaises(ValueError):
                    DocumentRecord.from_dict(payload)

        approval = ApprovalRecord(
            "approval_1", "geometry", "geo_1", "body_geometry", "a" * 64,
            "Jordan Richter", "2026-08-11T00:00:00Z", "approved", "body only",
        )
        with self.assertRaises(ValueError):
            ApprovalRecord.from_dict(approval.to_dict() | {"scope": "unknown_scope"})

    def test_schema_version_requires_an_integer(self):
        document = DocumentRecord("doc_1", "abc", "documents/a.pdf", ("a.pdf",), "archived")
        self.assertEqual(DocumentRecord.from_dict(document.to_dict()), document)
        for schema_version in (True, 1.0):
            with self.subTest(schema_version=schema_version):
                with self.assertRaises(ValueError):
                    DocumentRecord.from_dict(
                        document.to_dict() | {"schema_version": schema_version}
                    )


if __name__ == "__main__":
    unittest.main()
