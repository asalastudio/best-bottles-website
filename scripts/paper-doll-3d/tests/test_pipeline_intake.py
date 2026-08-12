import hashlib
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "scripts/paper-doll-3d"))

from pipeline_lib.intake import (
    audit_existing_mirror,
    discover_pdfs,
    intake_documents,
    sha256_file,
)
from pipeline_lib.models import DocumentRecord
from pipeline_lib.store import iter_records


class PipelineIntakeTests(unittest.TestCase):
    def test_discovery_is_sorted_and_hashes_file_content(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory)
            (source / "zebra.PDF").write_bytes(b"zebra")
            (source / "Amber.pdf").write_bytes(b"amber")
            (source / "ignore.txt").write_text("not a pdf", encoding="utf-8")

            discovered = discover_pdfs(source)

            self.assertEqual([path.name for path in discovered], ["Amber.pdf", "zebra.PDF"])
            self.assertEqual(sha256_file(discovered[0]), hashlib.sha256(b"amber").hexdigest())

    def test_intake_archives_unique_content_preserves_sources_and_is_idempotent(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "manufacturer"
            pipeline_root = root / "pipeline-root"
            source.mkdir()
            (source / "Blue (4).pdf").write_bytes(b"blue drawing")
            (source / "Blue.pdf").write_bytes(b"blue drawing")
            (source / "Amber.pdf").write_bytes(b"amber drawing")
            before_source_bytes = {path.name: path.read_bytes() for path in source.glob("*.pdf")}

            report = intake_documents(source, pipeline_root)

            self.assertEqual(report.discovered, 3)
            self.assertEqual(report.new, 2)
            self.assertEqual(report.duplicate, 1)
            self.assertEqual(len(list((pipeline_root / "documents/originals").glob("*.pdf"))), 2)
            self.assertEqual(before_source_bytes, {path.name: path.read_bytes() for path in source.glob("*.pdf")})
            records = list(iter_records(pipeline_root, "documents", DocumentRecord))
            blue = next(record for record in records if record.sha256 == hashlib.sha256(b"blue drawing").hexdigest())
            self.assertEqual(blue.id, f"doc_{blue.sha256[:16]}")
            self.assertEqual(blue.observed_names, ("Blue (4).pdf", "Blue.pdf"))
            self.assertEqual(blue.observed_paths, tuple(sorted(str(path) for path in (
                source / "Blue (4).pdf", source / "Blue.pdf",
            ))))

            rerun = intake_documents(source, pipeline_root)

            self.assertEqual(rerun.new, 0)
            self.assertEqual(rerun.duplicate, 3)
            self.assertEqual(list((pipeline_root / "documents/originals").glob("*.tmp")), [])

    def test_changed_observed_filename_archives_a_revision_and_records_conflict(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "manufacturer"
            pipeline_root = root / "pipeline-root"
            source.mkdir()
            source_file = source / "Blue.pdf"
            source_file.write_bytes(b"first revision")
            first = intake_documents(source, pipeline_root)
            source_file.write_bytes(b"second revision")

            revision = intake_documents(source, pipeline_root)

            self.assertEqual(first.new, 1)
            self.assertEqual(revision.new, 1)
            self.assertEqual(revision.revision_conflicts, 1)
            records = list(iter_records(pipeline_root, "documents", DocumentRecord))
            self.assertEqual({record.sha256 for record in records}, {
                hashlib.sha256(b"first revision").hexdigest(),
                hashlib.sha256(b"second revision").hexdigest(),
            })
            issue_paths = list((pipeline_root / "pipeline/paper-doll-3d/issues/records").glob("*.json"))
            self.assertEqual(len(issue_paths), 1)
            self.assertIn("REVISION_CONFLICT", issue_paths[0].read_text(encoding="utf-8"))

    def test_mirror_audit_retains_aliases_and_reports_unknown_content(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            first = b"first canonical"
            second = b"second canonical"
            first_hash = hashlib.sha256(first).hexdigest()
            second_hash = hashlib.sha256(second).hexdigest()
            mirror = root / "desktop-mirror"
            mirror.mkdir()
            (mirror / "first-a.pdf").write_bytes(first)
            (mirror / "first-b.pdf").write_bytes(first)
            (mirror / "second.pdf").write_bytes(second)
            records = (
                DocumentRecord(
                    f"doc_{first_hash[:16]}", first_hash,
                    f"documents/originals/{first_hash}.pdf", ("drawing-a.pdf",), "archived",
                ),
                DocumentRecord(
                    f"doc_{second_hash[:16]}", second_hash,
                    f"documents/originals/{second_hash}.pdf", ("drawing-b.pdf",), "archived",
                ),
            )

            report = audit_existing_mirror(mirror, records)

            self.assertEqual(report.matched_hashes, 2)
            self.assertEqual(report.mirror_files, 3)
            self.assertEqual(report.duplicate_file_instances, 1)
            self.assertEqual(report.unknown_hashes, 0)
            audited_first = next(record for record in report.document_records if record.sha256 == first_hash)
            self.assertEqual(audited_first.observed_names, (
                "drawing-a.pdf", "first-a.pdf", "first-b.pdf",
            ))

            (mirror / "unknown.pdf").write_bytes(b"unrecognized")
            unknown = audit_existing_mirror(mirror, records)
            self.assertEqual(unknown.unknown_hashes, 1)
            self.assertEqual(len(unknown.issues), 1)
            self.assertEqual(unknown.issues[0].code, "UNKNOWN_MIRROR_CONTENT")
            self.assertEqual(unknown.issues[0].status, "open")


if __name__ == "__main__":
    unittest.main()
