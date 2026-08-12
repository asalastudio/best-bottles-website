import hashlib
import io
import json
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "scripts/paper-doll-3d"))

import pipeline
from pipeline_lib.models import ArtifactRecord, ContractRecord, DocumentRecord, IssueRecord
from pipeline_lib.store import iter_records


class PipelineCliE2ETests(unittest.TestCase):
    @staticmethod
    def _pdf_bytes(text: str = "Bottle drawing evidence") -> bytes:
        stream = f"BT /F1 12 Tf 72 720 Td ({text}) Tj ET".encode("ascii")
        objects = (
            b"<< /Type /Catalog /Pages 2 0 R >>",
            b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
            b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            b"/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
            b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica "
            b"/Encoding /WinAnsiEncoding >>",
            b"<< /Length " + str(len(stream)).encode("ascii") + b" >>\nstream\n"
            + stream + b"\nendstream",
        )
        content = bytearray(b"%PDF-1.4\n")
        offsets = [0]
        for number, value in enumerate(objects, start=1):
            offsets.append(len(content))
            content.extend(f"{number} 0 obj\n".encode("ascii"))
            content.extend(value)
            content.extend(b"\nendobj\n")
        xref_offset = len(content)
        content.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
        content.extend(b"0000000000 65535 f \n")
        for offset in offsets[1:]:
            content.extend(f"{offset:010d} 00000 n \n".encode("ascii"))
        content.extend(
            f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
            f"startxref\n{xref_offset}\n%%EOF\n".encode("ascii")
        )
        return bytes(content)

    @staticmethod
    def _write_registries(pipeline_root: Path) -> None:
        reconciliation = pipeline_root / "reconciliation"
        reconciliation.mkdir(parents=True)
        (reconciliation / "identity-rules.json").write_text(
            json.dumps({
                "schema_version": 1,
                "rules": [{
                    "source_pattern": "Cylinder 5ml bottle Screen Printing Area Nemat.pdf",
                    "family": "cylinder",
                    "sold_product_key": "cylinder-5ml",
                    "source_capacity_label": "5ml",
                    "sold_capacity_label": "5ml",
                    "document_role": "print_area_only",
                    "review_status": "matched",
                }],
            }, sort_keys=True, indent=2),
            encoding="utf-8",
        )
        (reconciliation / "legacy-status.json").write_text(
            json.dumps({"schema_version": 1, "rules": []}, sort_keys=True, indent=2),
            encoding="utf-8",
        )
        for relative in (
            "approvals/records", "artifacts/records", "dependencies/records",
            "documents/records", "issues/records",
        ):
            (pipeline_root / relative).mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _source_controlled_hashes(pipeline_root: Path) -> dict[str, str]:
        hashes = {}
        for path in sorted(pipeline_root.rglob("*")):
            if not path.is_file():
                continue
            relative = path.relative_to(pipeline_root)
            if relative.parts[0] == "indexes":
                continue
            if path.suffix.lower() == ".png":
                continue
            if path.suffix.lower() not in {".json", ".pdf", ".md"}:
                continue
            hashes[relative.as_posix()] = hashlib.sha256(path.read_bytes()).hexdigest()
        return hashes

    def test_intake_prints_a_json_summary_and_returns_zero(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source"
            source.mkdir()
            (source / "drawing.pdf").write_bytes(self._pdf_bytes())
            output = io.StringIO()

            with redirect_stdout(output):
                exit_code = pipeline.main([
                    "intake", "--source", str(source),
                    "--pipeline-root", str(root / "pipeline"),
                ])

            self.assertEqual(exit_code, 0)
            self.assertEqual(json.loads(output.getvalue()), {
                "command": "intake",
                "discovered": 1,
                "duplicate": 0,
                "new": 1,
                "revision_conflicts": 0,
            })

    def test_run_stops_at_review_preserves_blends_blockers_and_record_hashes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source"
            mirror = root / "read-only-mirror"
            external_master = root / "read-only-master"
            pipeline_root = root / "pipeline"
            source.mkdir()
            mirror.mkdir()
            external_master.mkdir()
            filename = "Cylinder 5ml bottle Screen Printing Area Nemat.pdf"
            pdf_bytes = self._pdf_bytes(
                r"Print area only manufacturer evidence 16.3 \261 0.3 mm",
            )
            (source / filename).write_bytes(pdf_bytes)
            (mirror / filename).write_bytes(pdf_bytes)
            blend = external_master / "existing.blend"
            blend.write_bytes(b"pre-existing Blender scene")
            blend_hash = hashlib.sha256(blend.read_bytes()).hexdigest()
            self._write_registries(pipeline_root)
            original_run = subprocess.run
            external_commands = []

            def reject_blender(args, *call_args, **call_kwargs):
                external_commands.append(tuple(args))
                self.assertNotIn("blender", Path(args[0]).name.casefold())
                return original_run(args, *call_args, **call_kwargs)

            arguments = [
                "run", "--source", str(source),
                "--pipeline-root", str(pipeline_root),
                "--mirror-dir", str(mirror),
                "--master-root", str(external_master),
            ]
            first_output = io.StringIO()
            with patch("pipeline_lib.inspection.subprocess.run", side_effect=reject_blender):
                with redirect_stdout(first_output):
                    first_exit = pipeline.main(arguments)

            first_summary = json.loads(first_output.getvalue())
            self.assertEqual(first_exit, 0)
            self.assertEqual(first_summary["stages"], [
                "intake", "inspection", "mirror", "reconciliation",
                "legacy", "index", "review",
            ])
            self.assertEqual(first_summary["intake"]["discovered"], 1)
            self.assertEqual(first_summary["inspection"]["inspected"], 1)
            self.assertEqual(first_summary["mirror"]["matched_hashes"], 1)
            self.assertEqual(first_summary["reconciliation"]["reconciled"], 1)
            self.assertEqual(first_summary["legacy"]["discovered"], 1)
            self.assertTrue(Path(first_summary["review_path"]).is_file())
            self.assertTrue(external_commands)
            self.assertEqual(hashlib.sha256(blend.read_bytes()).hexdigest(), blend_hash)
            self.assertEqual(list(pipeline_root.rglob("*.blend")), [])
            self.assertEqual(
                len(tuple(iter_records(pipeline_root, "documents", DocumentRecord))), 1,
            )
            contracts = tuple(
                ContractRecord.from_dict(json.loads(path.read_text(encoding="utf-8")))
                for path in sorted((pipeline_root / "contracts").rglob("*.json"))
            )
            self.assertEqual(len(contracts), 3)
            self.assertTrue(all(contract.status == "blocked" for contract in contracts))
            self.assertEqual(
                [dimension["value"] for contract in contracts
                 for dimension in contract.dimensions],
                [16.3],
            )
            self.assertTrue(all(
                dimension["status"] == "candidate"
                for contract in contracts for dimension in contract.dimensions
            ))
            issues = tuple(iter_records(pipeline_root, "issues", IssueRecord))
            self.assertEqual(len(issues), 3)
            self.assertTrue(all(issue.status == "open" for issue in issues))
            artifacts = tuple(iter_records(pipeline_root, "artifacts", ArtifactRecord))
            self.assertEqual(len(artifacts), 1)
            self.assertEqual(artifacts[0].status, "imported_unverified")
            before = self._source_controlled_hashes(pipeline_root)

            second_output = io.StringIO()
            with redirect_stdout(second_output):
                second_exit = pipeline.main(arguments)

            self.assertEqual(second_exit, 0)
            self.assertEqual(self._source_controlled_hashes(pipeline_root), before)
            self.assertEqual(hashlib.sha256(blend.read_bytes()).hexdigest(), blend_hash)

            status_output = io.StringIO()
            with redirect_stdout(status_output):
                status_exit = pipeline.main([
                    "status", "--pipeline-root", str(pipeline_root), "--json",
                ])
            status = json.loads(status_output.getvalue())
            self.assertEqual(status_exit, 0)
            self.assertEqual(status["intake_documents"], 1)
            self.assertEqual(status["document_records"], 1)
            self.assertEqual(len(status["blockers"]), 3)
            self.assertEqual(status["approved_candidate_dimensions"], 0)
            self.assertEqual(status["new_geometry_approvals"], 0)

    def test_unknown_command_exits_two_through_argparse(self):
        with redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit) as raised:
                pipeline.main(["not-a-foundation-command"])
        self.assertEqual(raised.exception.code, 2)


if __name__ == "__main__":
    unittest.main()
