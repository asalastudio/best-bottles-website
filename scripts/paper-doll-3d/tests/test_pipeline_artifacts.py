import hashlib
import sys
import tempfile
import unittest
from dataclasses import replace
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "scripts/paper-doll-3d"))

from pipeline_lib.artifacts import (  # noqa: E402
    FileArtifactBackend,
    protect_artifact,
    verify_artifact_copy,
)
from pipeline_lib.models import ArtifactRecord  # noqa: E402


class PipelineArtifactTests(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary_directory.name)
        self.backend = FileArtifactBackend()
        self.clock = lambda: "2026-08-11T00:00:00Z"

    def tearDown(self):
        self.temporary_directory.cleanup()

    def _write(self, name, content):
        path = self.root / name
        path.write_bytes(content)
        return path

    def _record(self, primary, mirror, content, **changes):
        values = {
            "id": "artifact_1",
            "sha256": hashlib.sha256(content).hexdigest(),
            "size_bytes": len(content),
            "primary_uri": primary.as_uri(),
            "mirror_uri": mirror.as_uri(),
            "status": "candidate",
            "kind": "scene",
            "approved_scopes": ("body_geometry",),
            "evidence_note": "Verified export from Blender.",
            "reviewer_source": "Jordan Richter",
        }
        return ArtifactRecord(**(values | changes))

    def test_protects_two_independent_copies_matching_the_record(self):
        content = b"verified Blender artifact"
        record = self._record(
            self._write("primary.blend", content),
            self._write("mirror.blend", content),
            content,
        )

        protected = protect_artifact(record, self.backend, self.clock)

        self.assertIsNot(protected, record)
        self.assertEqual(protected.status, "protected")
        self.assertEqual(protected.last_integrity_check, "2026-08-11T00:00:00Z")
        self.assertEqual(record.status, "candidate")
        self.assertIsNone(record.last_integrity_check)

    def test_rejects_a_single_copy_even_when_its_filename_says_locked(self):
        content = b"only one copy"
        locked = self._write("master_LOCKED.blend", content)
        record = self._record(locked, locked, content)

        with self.assertRaises(ValueError):
            protect_artifact(record, self.backend, self.clock)

        self.assertEqual(record.status, "candidate")

    def test_rejects_a_mirror_with_different_bytes(self):
        content = b"expected primary bytes"
        record = self._record(
            self._write("primary.blend", content),
            self._write("mirror.blend", b"different mirror bytes"),
            content,
        )

        with self.assertRaises(ValueError):
            protect_artifact(record, self.backend, self.clock)

    def test_rejects_a_symlinked_mirror_of_the_primary_copy(self):
        content = b"same file through another filename"
        primary = self._write("primary.blend", content)
        mirror = self.root / "mirror.blend"
        mirror.symlink_to(primary)
        record = self._record(primary, mirror, content)

        with self.assertRaises(ValueError):
            protect_artifact(record, self.backend, self.clock)

    def test_rejects_wrong_byte_size_even_when_both_hashes_match(self):
        content = b"same complete bytes"
        record = self._record(
            self._write("primary.blend", content),
            self._write("mirror.blend", content),
            content,
            size_bytes=len(content) - 1,
        )

        with self.assertRaises(ValueError):
            protect_artifact(record, self.backend, self.clock)

    def test_verify_artifact_copy_rejects_non_file_uris_and_bad_expected_hashes(self):
        content = b"valid file contents"
        path = self._write("primary.blend", content)

        self.assertTrue(verify_artifact_copy(
            path.as_uri(), hashlib.sha256(content).hexdigest(), self.backend,
        ))
        self.assertFalse(verify_artifact_copy(
            "https://example.test/primary.blend", hashlib.sha256(content).hexdigest(),
            self.backend,
        ))
        self.assertFalse(verify_artifact_copy(path.as_uri(), "not-a-sha256", self.backend))

    def test_rejects_malformed_record_metadata_and_naive_clock_values(self):
        content = b"well formed copies"
        record = self._record(
            self._write("primary.blend", content),
            self._write("mirror.blend", content),
            content,
        )

        with self.assertRaises(ValueError):
            protect_artifact(replace(record, sha256="A" * 64), self.backend, self.clock)
        with self.assertRaises(ValueError):
            protect_artifact(
                replace(record, last_integrity_check="2026-08-11T00:00:00"),
                self.backend,
                self.clock,
            )
        with self.assertRaises(ValueError):
            protect_artifact(record, self.backend, lambda: "2026-08-11T00:00:00")


if __name__ == "__main__":
    unittest.main()
