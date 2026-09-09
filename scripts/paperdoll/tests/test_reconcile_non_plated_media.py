import unittest

from scripts.paperdoll.reconcile_non_plated_media import reconcile


class ReconcileNonPlatedMediaTest(unittest.TestCase):
    def test_reconciles_each_non_plated_sku_with_live_status(self):
        ledger = [{"websiteSku": "A", "graceSku": "GA", "family": "Round"}]
        audit = [{
            "websiteSku": "A", "status": "remote_only_healthy", "priority": "P1",
            "shopify": {"variantState": "assigned", "imageUrl": "https://example.test/a.png"},
            "convex": {"imageUrl": "https://example.test/a.png"},
            "plate": {}, "localFallback": {}, "catalogHero": {}, "source": {}, "reasons": [],
        }]
        row = reconcile(ledger, audit)[0]
        self.assertEqual(row["reconciliationAction"], "remote_only_plate_needed")
        self.assertEqual(row["shopifyState"], "assigned")

    def test_refuses_incomplete_or_ambiguous_audit(self):
        with self.assertRaisesRegex(ValueError, "missing from live audit"):
            reconcile([{"websiteSku": "A"}], [])
        with self.assertRaisesRegex(ValueError, "duplicate website SKU"):
            reconcile([], [{"websiteSku": "A"}, {"websiteSku": "A"}])


if __name__ == "__main__":
    unittest.main()
