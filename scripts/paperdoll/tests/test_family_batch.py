import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from family_batch import checked_source, family_products, apply_catalog_policy
from build_plates import validate_front_source


class FamilyBatchTests(unittest.TestCase):
    def test_standalone_fliptop_keeps_route_and_missing_source_hold(self):
        row = {"websiteSku": "PbClear4ozFlpWh", "familyId": None,
               "blockReasons": ["familyId:missing:neck", "match:no-psd"]}
        product = {"capacityMl": 118, "neckThreadSize": None}
        apply_catalog_policy(row, product, {"slug": "cylinder-118ml-clear"},
                             {"standaloneAssemblies": ["PbClear4ozFlpWh"]})
        self.assertEqual(row["familyId"], "cylinder-118ml-clear")
        self.assertEqual(row["blockReasons"], ["match:no-psd"])
        self.assertEqual(row["kitApplicability"], "notApplicable")
        self.assertIsNone(product["neckThreadSize"])

    def test_capacity_conflict_is_held_without_rewriting_catalog(self):
        row = {"websiteSku": "GBCyl5WhtSht", "blockReasons": []}
        product = {"capacityMl": 5.5}
        apply_catalog_policy(row, product, {}, {"capacityConstraints": {"GBCyl5WhtSht": 5}})
        self.assertEqual(product["capacityMl"], 5.5)
        self.assertEqual(row["blockReasons"], ["confirmed_capacity_conflict:catalog=5.5,confirmed=5"])

    def test_other_products_do_not_lose_neck_requirement(self):
        row = {"websiteSku": "OtherBottle", "blockReasons": ["familyId:missing:neck"]}
        apply_catalog_policy(row, {}, {}, {"standaloneAssemblies": ["PbClear4ozFlpWh"]})
        self.assertEqual(row["blockReasons"], ["familyId:missing:neck"])
        self.assertEqual(row["kitApplicability"], "requiresLayerAudit")

    def test_scope_includes_product_or_group_family_without_dropping_disagreements(self):
        snapshot = {"groups": [{"_id": "c", "family": "Cylinder"}, {"_id": "d", "family": "Diva"}],
                    "products": [{"websiteSku": "a", "family": "Cylinder", "productGroupId": "d"},
                                 {"websiteSku": "b", "family": None, "productGroupId": "c"},
                                 {"websiteSku": "c", "family": "Diva", "productGroupId": "d"}]}
        self.assertEqual([p["websiteSku"] for p in family_products(snapshot, "Cylinder")], ["a", "b"])

    def test_master_source_rejects_physical_escape(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            master = base / "master"
            master.mkdir()
            outside = base / "outside.psd"
            outside.write_bytes(b"fixture")
            link = master / "inside.psd"
            link.symlink_to(outside)
            with self.assertRaises(ValueError):
                checked_source(link, master)
            with self.assertRaises(ValueError):
                checked_source(outside, master)

    def test_explicit_capped_child_of_mixed_parent_is_valid(self):
        validate_front_source({"relPath": "31. Capped & Uncapped/Capped/56. LBCyl100LtnCu.psd"}, "LBCyl100LtnCu")

    def test_uncapped_and_ambiguous_sources_still_fail(self):
        for folder in ["31. Capped & Uncapped/Uncapped", "31. Capped & Uncapped", "Uncapped"]:
            with self.subTest(folder=folder), self.assertRaises(RuntimeError):
                validate_front_source({"relPath": folder + "/56. LBCyl100LtnCu.psd"}, "LBCyl100LtnCu")

    def test_capped_child_does_not_allow_wrong_product(self):
        with self.assertRaises(RuntimeError):
            validate_front_source({"relPath": "Capped & Uncapped/Capped/56. LBCyl100LtnCu.psd"}, "LBCyl50LtnCu")


if __name__ == "__main__":
    unittest.main()
