import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "scripts/paper-doll-3d"))

from pipeline_lib.models import DocumentRecord
from pipeline_lib.store import write_record


class RecordStoreTests(unittest.TestCase):
    def test_write_record_is_idempotent_and_atomic(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            record = DocumentRecord(
                "doc_abc", "abc", "documents/originals/abc.pdf", ("a.pdf",), "archived",
            )
            first = write_record(root, "documents", record)
            before = first.read_bytes()
            second = write_record(root, "documents", record)

            self.assertEqual(first, second)
            self.assertEqual(second.read_bytes(), before)
            self.assertEqual(list(second.parent.glob("*.tmp")), [])

    def test_write_record_rejects_path_traversal_kind(self):
        with tempfile.TemporaryDirectory() as directory:
            record = DocumentRecord(
                "doc_abc", "abc", "documents/originals/abc.pdf", ("a.pdf",), "archived",
            )

            with self.assertRaises(ValueError):
                write_record(Path(directory), "../outside", record)


if __name__ == "__main__":
    unittest.main()
