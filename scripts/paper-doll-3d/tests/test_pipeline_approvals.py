import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "scripts/paper-doll-3d"))

from pipeline_lib.approvals import create_approval, has_valid_approval
from pipeline_lib.dependencies import EDGE_TYPES, invalidate_dependents
from pipeline_lib.models import DependencyRecord


HASH_A = "a" * 64
HASH_B = "b" * 64


class PipelineApprovalTests(unittest.TestCase):
    def test_finish_thread_approval_does_not_approve_body_geometry(self):
        approval = create_approval(
            "geometry", "geometry_1", "finish_thread_geometry", HASH_A,
            "Jordan Richter", "approved", "17-415 finish only",
            "2026-08-11T12:00:00-07:00",
        )

        self.assertTrue(has_valid_approval(
            (approval,), "geometry_1", "finish_thread_geometry", HASH_A,
        ))
        self.assertFalse(has_valid_approval(
            (approval,), "geometry_1", "body_geometry", HASH_A,
        ))

    def test_hash_mismatch_invalidates_an_older_approval(self):
        approval = create_approval(
            "geometry", "geometry_1", "body_geometry", HASH_A,
            "Jordan Richter", "approved", "body approved",
            "2026-08-11T12:00:00Z",
        )

        self.assertFalse(has_valid_approval(
            (approval,), "geometry_1", "body_geometry", HASH_B,
        ))

    def test_contract_change_invalidates_geometry_assemblies_and_assets(self):
        edges = (
            self._edge("contract_1", "geometry_1", "derived_from", HASH_A),
            self._edge("geometry_1", "assembly_1", "uses_geometry", "c" * 64),
            self._edge("assembly_1", "asset_1", "uses_assembly", "d" * 64),
            self._edge("contract_1", "asset_2", "renders_asset", HASH_A),
        )
        records = {"geometry_1", "assembly_1", "asset_1", "asset_2"}

        invalidated = invalidate_dependents("contract_1", HASH_B, edges, records)

        self.assertEqual(
            invalidated, ("assembly_1", "asset_1", "asset_2", "geometry_1"),
        )

    def test_studio_preset_change_invalidates_assets_but_not_geometry(self):
        edges = (
            self._edge("studio_1", "asset_1", "uses_studio", HASH_A),
            self._edge("contract_1", "geometry_1", "derived_from", "c" * 64),
            self._edge("geometry_1", "asset_2", "renders_asset", "d" * 64),
        )
        records = {"geometry_1", "asset_1", "asset_2"}

        invalidated = invalidate_dependents("studio_1", HASH_B, edges, records)

        self.assertEqual(invalidated, ("asset_1",))

    def test_approval_id_is_content_stable_and_hash_specific(self):
        values = (
            "geometry", "geometry_1", "body_geometry", HASH_A,
            "Jordan Richter", "approved", "body approved",
            "2026-08-11T12:00:00Z",
        )
        first = create_approval(*values)
        repeated = create_approval(*values)
        changed = create_approval(*(values[:3] + (HASH_B,) + values[4:]))

        self.assertEqual(first.id, repeated.id)
        self.assertNotEqual(first.id, changed.id)

    def test_create_approval_rejects_invalid_review_metadata(self):
        valid = {
            "entity_type": "geometry",
            "entity_id": "geometry_1",
            "scope": "body_geometry",
            "artifact_hash": HASH_A,
            "reviewer": "Jordan Richter",
            "decision": "approved",
            "notes": "body approved",
            "decided_at": "2026-08-11T12:00:00Z",
        }
        invalid_values = (
            ("reviewer", "   "),
            ("scope", "all_geometry"),
            ("decision", "pending"),
            ("artifact_hash", "not-a-sha256"),
            ("decided_at", "2026-08-11T12:00:00"),
        )
        for field, value in invalid_values:
            with self.subTest(field=field):
                with self.assertRaises(ValueError):
                    create_approval(**(valid | {field: value}))

    def test_dependency_edges_are_strict_and_inputs_remain_immutable(self):
        self.assertEqual(EDGE_TYPES, frozenset({
            "derived_from", "uses_geometry", "uses_finish", "uses_assembly",
            "uses_studio", "uses_material", "renders_asset",
        }))
        edges = [self._edge("contract_1", "geometry_1", "derived_from", HASH_A)]
        before = tuple(edges)

        self.assertEqual(
            invalidate_dependents("contract_1", HASH_B, edges, {"geometry_1"}),
            ("geometry_1",),
        )
        self.assertEqual(tuple(edges), before)

        invalid_edge = DependencyRecord(
            id="dependency_invalid", source_id="contract_1", target_id="geometry_1",
            edge_type="approves_everything", source_hash=HASH_A,
        )
        with self.assertRaises(ValueError):
            invalidate_dependents(
                "contract_1", HASH_B, (invalid_edge,), {"geometry_1"},
            )

    @staticmethod
    def _edge(source_id, target_id, edge_type, source_hash):
        return DependencyRecord(
            id=f"dependency_{source_id}_{target_id}",
            source_id=source_id,
            target_id=target_id,
            edge_type=edge_type,
            source_hash=source_hash,
        )


if __name__ == "__main__":
    unittest.main()
