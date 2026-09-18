import importlib.util
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]


def load_module():
    spec = importlib.util.spec_from_file_location(
        "build_sibling_reuse_kits", HERE / "build_sibling_reuse_kits.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class SiblingReuseKitTests(unittest.TestCase):
    def setUp(self):
        self.mod = load_module()

    def test_recipes_cover_the_thirteen_leftovers_exactly_once(self):
        recipes = (HERE / "cylinder_leftover_kit_recipes.json").read_text()
        payload = __import__("json").loads(recipes)
        skus = [row["websiteSku"] for row in payload["recipes"]]
        self.assertEqual(len(skus), 13)
        self.assertEqual(len(set(skus)), 13)

    def test_selects_body_fitment_and_named_closure_only(self):
        body = {
            "parts": [
                {"slot": "body", "zOrder": 0, "image": {"url": "https://example/body"}},
                {"slot": "roller", "zOrder": 1, "image": {"url": "https://example/roller"}},
                {"slot": "cap", "zOrder": 2, "image": {"url": "https://example/wrong-cap"}},
            ]
        }
        closure = {
            "parts": [
                {"slot": "body", "zOrder": 0, "image": {"url": "https://example/other-body"}},
                {"slot": "cap", "zOrder": 2, "image": {"url": "https://example/right-cap"}},
            ]
        }
        parts = self.mod.selected_parts(body, closure, ["cap"])
        self.assertEqual([part["slot"] for part in parts], ["body", "roller", "cap"])
        self.assertEqual(parts[-1]["image"]["url"], "https://example/right-cap")
        self.assertEqual([part["zOrder"] for part in parts], [0, 1, 2])

    def test_content_addressed_plate_hash(self):
        url = "https://example/plates/x/5e404f965bfcf89991446aeb8ba185b3e796af4da21e9035c286a0cde52ce96e.front-on-1000x1100.webp"
        self.assertEqual(self.mod.sha256_from_url(url), "5e404f965bfcf89991446aeb8ba185b3e796af4da21e9035c286a0cde52ce96e")


if __name__ == "__main__":
    unittest.main()
