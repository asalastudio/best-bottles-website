import json
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "scripts/paper-doll-3d"))

from pipeline_lib.models import ContractRecord, DocumentRecord, IssueRecord
from pipeline_lib.reconciliation import (
    draft_contract,
    load_identity_rules,
    reconcile_pending_documents,
    suggest_identity,
)
from pipeline_lib.store import iter_records, write_record


RULES_PATH = ROOT / "pipeline/paper-doll-3d/reconciliation/identity-rules.json"


class PipelineReconciliationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rules = load_identity_rules(RULES_PATH)

    @staticmethod
    def _document(*names, status="inspected"):
        return DocumentRecord(
            id="doc_1234567890abcdef",
            sha256="a" * 64,
            canonical_path="documents/originals/source.pdf",
            observed_names=tuple(names),
            observed_paths=tuple(f"/manufacturer/{name}" for name in names),
            status=status,
        )

    def test_explicit_rules_reconcile_the_exact_eighteen_source_patterns(self):
        self.assertEqual(len(self.rules), 18)
        expected = {
            "10ml Bottle dimensions and print area.pdf": ("cylinder-9ml", "bottle_drawing"),
            "Cylinder 5ml bottle Screen Printing Area Nemat.pdf": ("cylinder-5ml", "print_area_only"),
            "Flair 15ml.pdf": ("flair-15ml", "bottle_drawing"),
            "GBCrcl30.pdf": ("circle-30ml", "bottle_drawing"),
            "GBCrcl50 (3).pdf": ("circle-50ml", "bottle_drawing"),
            "GBCyl10mBlue (4).pdf": ("cylinder-9ml", "bottle_drawing"),
            "GBCyl10mlAmber (2).pdf": ("cylinder-9ml", "bottle_drawing"),
            "GBCyl5mlBlue.pdf": ("cylinder-5ml", "bottle_drawing"),
            "GBElegant15 Bottle - Nemat.pdf": ("elegant-15ml", "bottle_drawing"),
            "GBElegant60 Bottle - Nemat (1).pdf": ("elegant-60ml", "bottle_drawing"),
            "GBElg30 (1).pdf": ("elegant-30ml", "bottle_drawing"),
            "GBEmpire100 (1).pdf": ("empire-100ml", "bottle_drawing"),
            "GBEmpire50 (1).pdf": ("empire-50ml", "bottle_drawing"),
            "GBSleek30 (1).pdf": ("sleek-30ml", "bottle_drawing"),
            "GBSleek50 (1).pdf": ("sleek-50ml", "bottle_drawing"),
            "GBTulip6 (1).pdf": ("tulip-6ml", "bottle_drawing"),
            "Slim 100ml screen printable Area (1).pdf": ("slim-100ml", "print_area_only"),
            "Tall cylinder 9ml bottle drawing Nemat (1).pdf": ("tall-cylinder-9ml", "bottle_drawing"),
        }

        actual = {
            rule.source_pattern: (rule.sold_product_key, rule.document_role)
            for rule in self.rules
        }

        self.assertEqual(actual, expected)
        self.assertEqual(
            suggest_identity(self._document("GBCyl10mBlue (4).pdf"), self.rules).sold_product_key,
            "cylinder-9ml",
        )
        self.assertEqual(
            suggest_identity(self._document("GBCyl10mlAmber (2).pdf"), self.rules).sold_product_key,
            "cylinder-9ml",
        )
        self.assertEqual(
            suggest_identity(self._document("GBElegant15 Bottle - Nemat.pdf"), self.rules).sold_product_key,
            "elegant-15ml",
        )
        self.assertEqual(
            suggest_identity(
                self._document("Slim 100ml screen printable Area (1).pdf"), self.rules,
            ).document_role,
            "print_area_only",
        )

    def test_duplicate_names_and_tall_alias_preserve_one_document_identity(self):
        duplicate = self._document("GBCyl10mBlue (4).pdf", "GBCyl10mlAmber (2).pdf")

        result = suggest_identity(duplicate, self.rules)

        self.assertEqual(result.sold_product_key, "cylinder-9ml")
        self.assertEqual(result.matched_observed_names, duplicate.observed_names)
        self.assertEqual(result.finish_contexts, ("amber", "blue"))
        self.assertEqual(result.document_ids, (duplicate.id,))

        alias = self._document("tall-cylinder-9ml-drawing-nemat-2015.pdf")
        alias_result = suggest_identity(alias, self.rules)
        self.assertEqual(alias_result.sold_product_key, "tall-cylinder-9ml")
        self.assertEqual(alias_result.document_ids, (alias.id,))

    def test_unknown_filename_remains_for_review(self):
        result = suggest_identity(self._document("unknown.pdf"), self.rules)

        self.assertEqual(result.status, "needs_review")
        self.assertEqual(result.sold_product_key, "")
        self.assertEqual(result.matched_observed_names, ())

    def test_draft_preserves_capacity_provenance_and_never_approves_candidates(self):
        document = self._document("GBCyl10mBlue (4).pdf", "GBCyl10mlAmber (2).pdf")
        inspection = {
            "schema_version": 1,
            "document_id": document.id,
            "source_sha256": document.sha256,
            "candidates": [{
                "page": 1,
                "raw_text": "72±0.8",
                "value": 72.0,
                "tolerance": 0.8,
                "unit": "mm",
                "diameter_mark": False,
                "semantic_field": None,
                "status": "approved",
            }],
        }

        contract = draft_contract(document, inspection, suggest_identity(document, self.rules))

        self.assertEqual(contract.contract_type, "bottle")
        self.assertEqual(contract.document_ids, (document.id,))
        self.assertEqual(contract.source_capacity_label, "10ml")
        self.assertEqual(contract.sold_capacity_label, "9ml")
        self.assertTrue(contract.geometry_authority)
        self.assertEqual(contract.status, "draft")
        self.assertEqual(contract.dimensions[0]["status"], "candidate")
        self.assertEqual(contract.dimensions[0]["source_document_id"], document.id)
        self.assertEqual(contract.dimensions[0]["source_sha256"], document.sha256)

    def test_reconcile_writes_blocked_placeholders_without_invented_fitment_data(self):
        with tempfile.TemporaryDirectory() as directory:
            pipeline_root = Path(directory)
            rules_path = pipeline_root / "reconciliation/identity-rules.json"
            rules_path.parent.mkdir(parents=True)
            rules_path.write_bytes(RULES_PATH.read_bytes())
            document = self._document("GBCyl10mBlue (4).pdf", "GBCyl10mlAmber (2).pdf")
            write_record(pipeline_root, "documents", document)
            evidence_path = pipeline_root / "evidence" / document.id / "inspection.json"
            evidence_path.parent.mkdir(parents=True)
            evidence_path.write_text(json.dumps({
                "schema_version": 1,
                "document_id": document.id,
                "source_sha256": document.sha256,
                "candidates": [{"value": 72.0, "status": "candidate"}],
            }), encoding="utf-8")

            first = reconcile_pending_documents(pipeline_root)
            second = reconcile_pending_documents(pipeline_root)

            self.assertEqual(first.reconciled, 1)
            self.assertEqual(first.needs_review, 0)
            self.assertEqual({record.contract_type for record in first.contract_records}, {
                "bottle", "fitment", "component",
            })
            placeholders = [
                record for record in first.contract_records
                if record.contract_type in {"fitment", "component"}
            ]
            self.assertTrue(all(record.status == "blocked" for record in placeholders))
            self.assertTrue(all(record.dimensions == () for record in placeholders))
            self.assertEqual({issue.code for issue in first.issues}, {
                "MISSING_FITMENT_DRAWING", "MISSING_COMPONENT_DRAWING",
            })
            self.assertEqual(second, first)

            bottle_path = next((pipeline_root / "contracts/bottles").glob("*.json"))
            bottle = ContractRecord.from_dict(json.loads(bottle_path.read_text(encoding="utf-8")))
            self.assertEqual(bottle.document_ids, (document.id,))
            self.assertEqual(bottle.dimensions[0]["status"], "candidate")
            issues = tuple(iter_records(pipeline_root, "issues", IssueRecord))
            self.assertEqual({issue.code for issue in issues}, {
                "MISSING_FITMENT_DRAWING", "MISSING_COMPONENT_DRAWING",
            })

    def test_print_area_only_blocks_geometry_and_records_missing_drawing(self):
        document = self._document("Slim 100ml screen printable Area (1).pdf")
        inspection = {
            "schema_version": 1,
            "document_id": document.id,
            "source_sha256": document.sha256,
            "candidates": ({"value": 42.0, "status": "candidate"},),
        }

        contract = draft_contract(document, inspection, suggest_identity(document, self.rules))

        self.assertFalse(contract.geometry_authority)
        self.assertEqual(contract.status, "blocked")

        with tempfile.TemporaryDirectory() as directory:
            pipeline_root = Path(directory)
            rules_path = pipeline_root / "reconciliation/identity-rules.json"
            rules_path.parent.mkdir(parents=True)
            rules_path.write_bytes(RULES_PATH.read_bytes())
            write_record(pipeline_root, "documents", document)
            evidence_path = pipeline_root / "evidence" / document.id / "inspection.json"
            evidence_path.parent.mkdir(parents=True)
            evidence_path.write_text(json.dumps(inspection), encoding="utf-8")

            report = reconcile_pending_documents(pipeline_root)

            self.assertIn("MISSING_BOTTLE_DRAWING", {issue.code for issue in report.issues})


if __name__ == "__main__":
    unittest.main()
