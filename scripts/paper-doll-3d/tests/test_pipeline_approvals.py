import sys
import unittest
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "scripts/paper-doll-3d"))

from pipeline_lib.approvals import (
    HUMAN_APPROVAL_REVIEWERS,
    create_approval,
    has_valid_approval,
)
from pipeline_lib.dependencies import EDGE_TYPES, entity_kind, invalidate_dependents
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
        records = self._records(
            contract_1="contract", geometry_1="geometry", assembly_1="assembly",
            asset_1="asset", asset_2="asset",
        )

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
        records = self._records(
            studio_1="studio_preset", contract_1="contract", geometry_1="geometry",
            asset_1="asset", asset_2="asset",
        )

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

    def test_create_approval_allows_only_explicit_human_reviewers(self):
        self.assertEqual(HUMAN_APPROVAL_REVIEWERS, frozenset({"Jordan Richter"}))
        for reviewer in ("approval-bot", "Jordan Richter Bot", "jordan richter"):
            with self.subTest(reviewer=reviewer):
                with self.assertRaises(ValueError):
                    self._approval(reviewer=reviewer)

    def test_persisted_approval_with_unapproved_reviewer_fails_closed(self):
        valid = self._approval()

        for reviewer in ("", "   ", "approval-bot"):
            with self.subTest(reviewer=reviewer):
                persisted = replace(valid, reviewer=reviewer)
                self.assertFalse(has_valid_approval(
                    (persisted,), "geometry_1", "body_geometry", HASH_A,
                ))

    def test_partially_malformed_persisted_approval_fails_closed(self):
        missing_reviewer = SimpleNamespace(
            id="approval_malformed", entity_id="geometry_1",
            scope="body_geometry", artifact_hash=HASH_A,
            decision="approved", decided_at="2026-08-11T12:00:00Z",
        )

        self.assertFalse(has_valid_approval(
            (missing_reviewer,), "geometry_1", "body_geometry", HASH_A,
        ))

    def test_dependency_edges_are_strict_and_inputs_remain_immutable(self):
        self.assertEqual(EDGE_TYPES, frozenset({
            "derived_from", "uses_geometry", "uses_finish", "uses_assembly",
            "uses_studio", "uses_material", "renders_asset",
        }))
        edges = [self._edge("contract_1", "geometry_1", "derived_from", HASH_A)]
        before = tuple(edges)

        self.assertEqual(
            invalidate_dependents(
                "contract_1", HASH_B, edges,
                self._records(contract_1="contract", geometry_1="geometry"),
            ),
            ("geometry_1",),
        )
        self.assertEqual(tuple(edges), before)

        invalid_edge = DependencyRecord(
            id="dependency_invalid", source_id="contract_1", target_id="geometry_1",
            edge_type="approves_everything", source_hash=HASH_A,
        )
        with self.assertRaises(ValueError):
            invalidate_dependents(
                "contract_1", HASH_B, (invalid_edge,),
                self._records(contract_1="contract", geometry_1="geometry"),
            )

    def test_inactive_edges_do_not_propagate_invalidation(self):
        inactive = replace(
            self._edge("contract_1", "geometry_1", "derived_from", HASH_A),
            status="invalidated",
        )

        self.assertEqual(
            invalidate_dependents(
                "contract_1", HASH_B, (inactive,),
                self._records(contract_1="contract", geometry_1="geometry"),
            ),
            (),
        )

    def test_unchanged_first_hop_hash_does_not_invalidate_downstream(self):
        edges = (
            self._edge("contract_1", "geometry_1", "derived_from", HASH_A),
            self._edge("geometry_1", "asset_1", "renders_asset", HASH_B),
        )

        self.assertEqual(
            invalidate_dependents(
                "contract_1", HASH_A, edges,
                self._records(
                    contract_1="contract", geometry_1="geometry", asset_1="asset",
                ),
            ),
            (),
        )

    def test_dependency_cycles_terminate_with_unique_sorted_output(self):
        edges = (
            self._edge("contract_1", "geometry_1", "derived_from", HASH_A),
            self._edge("geometry_1", "assembly_1", "uses_geometry", HASH_A),
            self._edge("assembly_1", "geometry_1", "uses_assembly", HASH_A),
            self._edge("assembly_1", "asset_1", "renders_asset", HASH_A),
        )

        self.assertEqual(
            invalidate_dependents(
                "contract_1", HASH_B, edges,
                self._records(
                    contract_1="contract", geometry_1="geometry",
                    assembly_1="assembly", asset_1="asset",
                ),
            ),
            ("assembly_1", "asset_1", "geometry_1"),
        )

    def test_studio_edge_to_geometry_is_rejected_by_endpoint_policy(self):
        edge = self._edge("studio_1", "geometry_1", "uses_studio", HASH_A)

        with self.assertRaises(ValueError):
            invalidate_dependents(
                "studio_1", HASH_B, (edge,),
                self._records(studio_1="studio_preset", geometry_1="geometry"),
            )

    def test_explicit_geometry_cannot_masquerade_as_artifact(self):
        edge = self._edge("studio_1", "geometry_1", "uses_studio", HASH_A)
        records = self._records(studio_1="studio_preset")
        records["geometry_1"] = {
            "id": "geometry_1",
            "entity_type": "geometry",
            "sha256": HASH_A,
            "primary_uri": "assets/geometry.blend",
            "mirror_uri": "mirrors/geometry.blend",
            "status": "candidate",
        }

        with self.assertRaises(ValueError):
            entity_kind(records["geometry_1"])
        with self.assertRaises(ValueError):
            invalidate_dependents("studio_1", HASH_B, (edge,), records)

    def test_structurally_inferred_artifact_remains_a_valid_studio_target(self):
        edge = self._edge("studio_1", "artifact_1", "uses_studio", HASH_A)
        records = self._records(studio_1="studio_preset")
        records["artifact_1"] = {
            "id": "artifact_1",
            "sha256": HASH_A,
            "primary_uri": "assets/render.png",
            "mirror_uri": "mirrors/render.png",
            "status": "candidate",
        }

        self.assertEqual(
            invalidate_dependents("studio_1", HASH_B, (edge,), records),
            ("artifact_1",),
        )

    def test_studio_edge_with_unknown_endpoint_kind_fails_closed(self):
        edge = self._edge("studio_1", "mystery_1", "uses_studio", HASH_A)

        with self.assertRaises(ValueError):
            invalidate_dependents(
                "studio_1", HASH_B, (edge,),
                self._records(studio_1="studio_preset", mystery_1="unknown"),
            )

    def test_studio_invalidation_cannot_reach_geometry_transitively(self):
        edges = (
            self._edge("studio_1", "asset_1", "uses_studio", HASH_A),
            self._edge("asset_1", "geometry_1", "derived_from", HASH_A),
        )

        with self.assertRaises(ValueError):
            invalidate_dependents(
                "studio_1", HASH_B, edges,
                self._records(
                    studio_1="studio_preset", asset_1="asset",
                    geometry_1="geometry",
                ),
            )

    @staticmethod
    def _approval(reviewer="Jordan Richter"):
        return create_approval(
            "geometry", "geometry_1", "body_geometry", HASH_A, reviewer,
            "approved", "body approved", "2026-08-11T12:00:00Z",
        )

    @staticmethod
    def _records(**entity_types):
        return {
            record_id: {"id": record_id, "entity_type": entity_type}
            for record_id, entity_type in entity_types.items()
        }

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
