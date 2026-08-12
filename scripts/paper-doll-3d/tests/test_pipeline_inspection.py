import hashlib
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "scripts/paper-doll-3d"))

from pipeline_lib.inspection import inspect_document
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


class PdfInspectionTests(unittest.TestCase):
    def test_inspection_uses_poppler_and_writes_deterministic_evidence(self):
        with tempfile.TemporaryDirectory() as directory:
            pipeline_root = Path(directory)
            source = pipeline_root / "documents/originals/source.pdf"
            source.parent.mkdir(parents=True)
            source.write_bytes(b"canonical pdf bytes")
            document = DocumentRecord(
                id="doc_1234567890abcdef",
                sha256="a" * 64,
                canonical_path="documents/originals/source.pdf",
                observed_names=("source.pdf",),
                status="archived",
            )
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
            self.assertTrue((pipeline_root / "evidence" / document.id / "inspection.json").exists())


if __name__ == "__main__":
    unittest.main()
