import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "scripts/paper-doll-3d"))

from pipeline_lib.models import DocumentRecord
from pipeline_lib.store import write_record


class SerializedRecord:
    def __init__(self, record_id, value):
        self.id = record_id
        self.value = value

    def to_dict(self):
        return self.value


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
            self.assertEqual(first, root / "documents/records/doc_abc.json")
            self.assertEqual(second.read_bytes(), before)
            self.assertEqual(list(second.parent.glob("*.tmp")), [])

    def test_write_record_rejects_path_traversal_kind(self):
        with tempfile.TemporaryDirectory() as directory:
            record = DocumentRecord(
                "doc_abc", "abc", "documents/originals/abc.pdf", ("a.pdf",), "archived",
            )

            with self.assertRaises(ValueError):
                write_record(Path(directory), "../outside", record)

    def test_write_record_rejects_path_traversal_record_id_without_escaping_root(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            outside = root.parent / f"{root.name}-escaped.json"
            record = DocumentRecord(
                f"../../../../../{outside.stem}",
                "abc",
                "documents/originals/abc.pdf",
                ("a.pdf",),
                "archived",
            )
            try:
                with self.assertRaises(ValueError):
                    write_record(root, "documents", record)
                self.assertFalse(outside.exists())
            finally:
                outside.unlink(missing_ok=True)

    def test_write_record_rejects_invalid_serialized_schema_version(self):
        invalid_values = {
            "missing": {},
            "wrong": {"schema_version": 2},
            "boolean": {"schema_version": True},
            "float": {"schema_version": 1.0},
            "not_a_dictionary": [],
        }
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name, value in invalid_values.items():
                with self.subTest(name=name):
                    record = SerializedRecord("doc_invalid", value)
                    with self.assertRaises(ValueError):
                        write_record(root, "documents", record)


if __name__ == "__main__":
    unittest.main()
