import json
import tempfile
import unittest
from pathlib import Path

from scripts.paperdoll.kit_completion_ledger import (
    build_ledger,
    load_candidate_states,
    load_holds,
    load_source_readiness,
)


class KitCompletionLedgerTest(unittest.TestCase):
    def test_classifies_complete_candidate_hold_component_standalone_and_pending(self):
        products = [
            {"websiteSku": sku, "graceSku": "G-" + sku, "family": family,
             "category": category, "productGroupId": sku + "-group"}
            for sku, family, category in [
                ("LIVE", "Cylinder", "Glass Bottle"),
                ("CAND", "Elegant", "Glass Bottle"),
                ("HOLD", "Circle", "Glass Bottle"),
                ("PART", "Sprayer", "Component"),
                ("SOLO", "Cylinder", "Plastic Bottle"),
                ("TODO", "Diva", "Glass Bottle"),
                ("SOURCE", "Empire", "Glass Bottle"),
                ("NO-PLATE", "Round", "Glass Bottle"),
            ]
        ]
        plates = [{"websiteSku": sku, "familyId": sku + "-family", "front": {"sha256": sku + "-hash"}}
                  for sku in ("LIVE", "CAND", "HOLD", "PART", "SOLO", "TODO", "SOURCE")]
        kits = [{"websiteSku": "LIVE", "plateSha256": "LIVE-hash"}]
        candidates = {"CAND": {"websiteSku": "CAND", "plateSha256": "CAND-hash"}}
        holds = {"HOLD": ["source geometry mismatch"]}

        summary, rows, missing = build_ledger(
            products, plates, kits, candidates, holds, {"SOLO"}, {
                "SOURCE": {"websiteSku": "SOURCE", "publishable": "False", "blockReasons": "match:no-psd"},
            }
        )
        states = {row["websiteSku"]: row["state"] for row in rows}
        self.assertEqual(states, {
            "LIVE": "kit_complete",
            "CAND": "kit_candidate",
            "HOLD": "held_with_reason",
            "PART": "kit_not_applicable",
            "SOLO": "kit_not_applicable",
            "TODO": "pending_build",
            "SOURCE": "held_with_reason",
        })
        self.assertEqual(summary["productSkusWithoutExactPlate"], 1)
        self.assertEqual([row["websiteSku"] for row in missing], ["NO-PLATE"])

    def test_candidate_and_hold_manifests_remain_separate(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            candidate = root / "candidate.json"
            candidate.write_text(json.dumps({"rows": [
                {"websiteSku": "A", "status": "candidate", "plateSha256": "aaa"},
                {"websiteSku": "B", "status": "review", "reason": "alpha clipped"},
            ]}))
            hold = root / "hold.json"
            hold.write_text(json.dumps({"rows": [
                {"websiteSku": "C", "reason": "source hash drift"},
            ]}))
            candidates, first_holds = load_candidate_states([candidate])
            holds = load_holds([hold], first_holds)
            self.assertEqual(set(candidates), {"A"})
            self.assertEqual(holds, {"B": ["alpha clipped"], "C": ["source hash drift"]})

    def test_loads_source_readiness_csv(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "readiness.csv"
            path.write_text("websiteSku,publishable,blockReasons\nA,False,match:no-psd\n")
            self.assertEqual(load_source_readiness([path])["A"]["blockReasons"], "match:no-psd")


if __name__ == "__main__":
    unittest.main()
