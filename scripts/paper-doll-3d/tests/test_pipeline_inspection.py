import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "scripts/paper-doll-3d"))

from pipeline_lib.inspection import MINIMUM_TEXT_CHARACTERS, _requires_visual_review, inspect_document
from pipeline_lib.measurements import extract_measurement_candidates
from pipeline_lib.models import DocumentRecord


class MeasurementCandidateTests(unittest.TestCase):
    def test_extracts_numeric_candidates_without_semantic_guessing(self):
        text = "Ø16.3±0.3  Ø14.8 ± 0.3  72±0.8  neck 14.06±0.3"

        candidates = extract_measurement_candidates(text, page=1)

        self.assertEqual([item["value"] for item in candidates], [16.3, 14.8, 72.0, 14.06])
        self.assertEqual([item["tolerance"] for item in candidates], [0.3, 0.3, 0.8, 0.3])
        self.assertTrue(all(item["status"] == "candidate" for item in candidates))
        self.assertTrue(all(item["semantic_field"] is None for item in candidates))

    def test_rejects_malformed_or_negative_measurements(self):
        text = "-16±0.3 −17±0.3 16.3±0.3.4 17±0.2mm2 18±0.2 mmx 19±0.2"

        candidates = extract_measurement_candidates(text, page=1)

        self.assertEqual([item["value"] for item in candidates], [19.0])

    def test_rejects_malformed_token_suffixes_without_over_rejecting_valid_values(self):
        malformed = "1e3±0.3 0x16±0.3 - 16±0.3 − 17±0.3"

        self.assertEqual(extract_measurement_candidates(malformed, page=1), ())
        valid = extract_measurement_candidates(
            "Ø16.3±0.3  Ø14.8 ± 0.3  72±0.8  neck 14.06±0.3", page=1,
        )
        self.assertEqual([item["value"] for item in valid], [16.3, 14.8, 72.0, 14.06])


class VisualReviewTests(unittest.TestCase):
    def test_short_text_counts_non_whitespace_characters(self):
        self.assertTrue(_requires_visual_review(""))
        self.assertTrue(_requires_visual_review(" \n\t " * 100))
        self.assertTrue(_requires_visual_review("x" * (MINIMUM_TEXT_CHARACTERS - 1)))
        self.assertFalse(_requires_visual_review("x" * MINIMUM_TEXT_CHARACTERS))
        self.assertTrue(_requires_visual_review("x" * 31 + " \n\t"))


class PdfInspectionTests(unittest.TestCase):
    def _document(self, source: Path, document_id: str = "doc_1234567890abcdef") -> DocumentRecord:
        return DocumentRecord(
            id=document_id,
            sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
            canonical_path="documents/originals/source.pdf",
            observed_names=("source.pdf",),
            status="archived",
        )

    @staticmethod
    def _runner(page_count: int, text: str, *, render: bool = True):
        def fake_runner(args):
            program = args[0]
            if args[1:] == ("-v",):
                return subprocess.CompletedProcess(args, 0, "poppler 24.02\n", "")
            if program == "pdfinfo":
                return subprocess.CompletedProcess(args, 0, f"Pages: {page_count}\n", "")
            if program == "pdftotext":
                Path(args[-1]).write_text(text, encoding="utf-8")
                return subprocess.CompletedProcess(args, 0, "", "")
            if program == "pdftoppm":
                if render:
                    Path(f"{args[-1]}.png").write_bytes(b"png")
                return subprocess.CompletedProcess(args, 0, "", "")
            raise AssertionError(f"unexpected command: {args}")
        return fake_runner

    def test_inspection_uses_poppler_and_writes_deterministic_evidence(self):
        with tempfile.TemporaryDirectory() as directory:
            pipeline_root = Path(directory)
            source = pipeline_root / "documents/originals/source.pdf"
            source.parent.mkdir(parents=True)
            source.write_bytes(b"canonical pdf bytes")
            document = self._document(source)
            commands = []

            def fake_runner(args):
                commands.append(args)
                program = args[0]
                if args[1:] == ("-v",):
                    return subprocess.CompletedProcess(args, 0, "poppler 24.02\n", "")
                if program == "pdfinfo":
                    return subprocess.CompletedProcess(args, 0, "Pages:          2\n", "")
                if program == "pdftotext":
                    Path(args[-1]).write_text("Ø16.3±0.3\f72±0.8", encoding="utf-8")
                    return subprocess.CompletedProcess(args, 0, "", "")
                if program == "pdftoppm":
                    Path(f"{args[-1]}.png").write_bytes(b"png")
                    return subprocess.CompletedProcess(args, 0, "", "")
                self.fail(f"unexpected command: {args}")

            inspection = inspect_document(document, pipeline_root, runner=fake_runner)

            self.assertTrue(any(command[0] == "pdfinfo" for command in commands))
            self.assertTrue(any(command[0] == "pdftotext" for command in commands))
            render_commands = [
                command for command in commands
                if command[0] == "pdftoppm" and command[1:] != ("-v",)
            ]
            self.assertEqual(len(render_commands), 2)
            self.assertTrue(all(command[1:4] == ("-png", "-r", "240") for command in render_commands))
            self.assertEqual(
                inspection["page_paths"],
                ["page-001.png", "page-002.png"],
            )
            self.assertEqual([item["value"] for item in inspection["candidates"]], [16.3, 72.0])
            self.assertEqual(
                inspection["source_sha256"],
                hashlib.sha256(source.read_bytes()).hexdigest(),
            )
            inspection_path = pipeline_root / "evidence" / document.id / "inspection.json"
            self.assertTrue(inspection_path.exists())
            self.assertEqual(inspection["schema_version"], 1)
            self.assertEqual(json.loads(inspection_path.read_text(encoding="utf-8"))["schema_version"], 1)

    def test_rejects_hash_mismatch_before_running_poppler(self):
        with tempfile.TemporaryDirectory() as directory:
            pipeline_root = Path(directory)
            source = pipeline_root / "documents/originals/source.pdf"
            source.parent.mkdir(parents=True)
            source.write_bytes(b"canonical pdf bytes")
            document = self._document(source)
            document = DocumentRecord(
                id=document.id, sha256="0" * 64, canonical_path=document.canonical_path,
                observed_names=document.observed_names, status=document.status,
            )
            commands = []

            def runner(args):
                commands.append(args)
                return subprocess.CompletedProcess(args, 0, "", "")

            with self.assertRaisesRegex(ValueError, "hash"):
                inspect_document(document, pipeline_root, runner=runner)
            self.assertEqual(commands, [])

    def test_rejects_unsafe_document_id_and_evidence_symlink_escape(self):
        with tempfile.TemporaryDirectory() as directory:
            pipeline_root = Path(directory)
            source = pipeline_root / "documents/originals/source.pdf"
            source.parent.mkdir(parents=True)
            source.write_bytes(b"canonical pdf bytes")
            unsafe = self._document(source, "../escape")
            with self.assertRaisesRegex(ValueError, "document id"):
                inspect_document(unsafe, pipeline_root, runner=self._runner(1, "x" * 32))

            outside = pipeline_root / "outside"
            outside.mkdir()
            evidence_link = pipeline_root / "evidence" / "doc_1234567890abcdef"
            evidence_link.parent.mkdir()
            evidence_link.symlink_to(outside, target_is_directory=True)
            with self.assertRaisesRegex(ValueError, "evidence destination"):
                inspect_document(self._document(source), pipeline_root, runner=self._runner(1, "x" * 32))

    def test_promotes_only_complete_fresh_evidence_packets(self):
        with tempfile.TemporaryDirectory() as directory:
            pipeline_root = Path(directory)
            source = pipeline_root / "documents/originals/source.pdf"
            source.parent.mkdir(parents=True)
            source.write_bytes(b"canonical pdf bytes")
            document = self._document(source)

            inspect_document(document, pipeline_root, runner=self._runner(2, "16±0.3\f17±0.2"))
            destination = pipeline_root / "evidence" / document.id
            first_inspection = (destination / "inspection.json").read_bytes()
            self.assertTrue((destination / "page-002.png").exists())

            inspect_document(document, pipeline_root, runner=self._runner(1, "18±0.1"))
            second_inspection = (destination / "inspection.json").read_bytes()
            self.assertEqual(sorted(path.name for path in destination.glob("page-*.png")), ["page-001.png"])

            with self.assertRaisesRegex(RuntimeError, "did not create"):
                inspect_document(document, pipeline_root, runner=self._runner(1, "19±0.1", render=False))
            self.assertNotEqual(second_inspection, first_inspection)
            self.assertEqual((destination / "inspection.json").read_bytes(), second_inspection)
            self.assertEqual(sorted(path.name for path in destination.glob("page-*.png")), ["page-001.png"])


if __name__ == "__main__":
    unittest.main()
