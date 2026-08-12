"""Visual inspection evidence for archived manufacturer drawings."""

from __future__ import annotations

import hashlib
import os
import re
import shutil
import subprocess
import tempfile
import uuid
from dataclasses import dataclass, replace
from pathlib import Path
from typing import Callable

from .measurements import extract_measurement_candidates
from .models import SCHEMA_VERSION, DocumentRecord
from .store import atomic_write_json, iter_records, write_record


MINIMUM_TEXT_CHARACTERS = 32
POPLER_PROGRAMS = ("pdfinfo", "pdftotext", "pdftoppm")
Runner = Callable[[tuple[str, ...]], subprocess.CompletedProcess]


@dataclass(frozen=True)
class InspectionReport:
    inspected: int
    skipped: int
    document_records: tuple[DocumentRecord, ...]
    inspections: tuple[dict, ...]


def run_command(args: tuple[str, ...]) -> subprocess.CompletedProcess:
    """Run a Poppler command as an explicit, shell-free argument tuple."""
    return subprocess.run(args, check=True, capture_output=True, text=True)


def _output(result: subprocess.CompletedProcess) -> str:
    stdout = result.stdout or ""
    stderr = result.stderr or ""
    if isinstance(stdout, bytes):
        stdout = stdout.decode("utf-8", errors="replace")
    if isinstance(stderr, bytes):
        stderr = stderr.decode("utf-8", errors="replace")
    return stdout + stderr


def _run(runner: Runner, args: tuple[str, ...]) -> subprocess.CompletedProcess:
    result = runner(args)
    if result.returncode:
        raise RuntimeError(f"command failed ({result.returncode}): {args!r}\n{_output(result)}")
    return result


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _canonical_source(document: DocumentRecord, pipeline_root: Path) -> Path:
    relative_path = Path(document.canonical_path)
    if relative_path.is_absolute():
        raise ValueError("document canonical_path must be relative")
    root = pipeline_root.resolve()
    source = (root / relative_path).resolve()
    if source == root or root not in source.parents:
        raise ValueError("document canonical_path escapes pipeline root")
    if not source.is_file():
        raise FileNotFoundError(source)
    return source


def _safe_document_id(document_id: object) -> str:
    if not isinstance(document_id, str) or not document_id or not document_id.isascii():
        raise ValueError(f"invalid document id: {document_id!r}")
    if not all(character.isalnum() or character in "_-" for character in document_id):
        raise ValueError(f"invalid document id: {document_id!r}")
    return document_id


def _evidence_destination(document: DocumentRecord, pipeline_root: Path) -> tuple[Path, Path]:
    document_id = _safe_document_id(document.id)
    root = pipeline_root.resolve()
    configured_root = root / "evidence"
    configured_root.mkdir(parents=True, exist_ok=True)
    evidence_root = configured_root.resolve()
    if evidence_root == root or root not in evidence_root.parents:
        raise ValueError("evidence root escapes pipeline root")

    destination = evidence_root / document_id
    if destination.is_symlink():
        raise ValueError("evidence destination must not be a symlink")
    if destination.exists() and not destination.is_dir():
        raise ValueError("evidence destination must be a directory")
    resolved_destination = destination.resolve()
    if resolved_destination == evidence_root or evidence_root not in resolved_destination.parents:
        raise ValueError("evidence destination escapes evidence root")
    return evidence_root, destination


def _page_count(pdfinfo: str) -> int:
    match = re.search(r"^Pages:\s*(\d+)\s*$", pdfinfo, flags=re.MULTILINE)
    if match is None or int(match.group(1)) < 1:
        raise ValueError("pdfinfo did not report a positive page count")
    return int(match.group(1))


def _poppler_versions(runner: Runner, commands: list[tuple[str, ...]]) -> dict[str, str]:
    versions = {}
    for program in POPLER_PROGRAMS:
        command = (program, "-v")
        commands.append(command)
        versions[program] = _output(_run(runner, command)).strip()
    return versions


def _requires_visual_review(text: str) -> bool:
    """Flag text-only evidence that is too sparse to review without the render."""
    return sum(not character.isspace() for character in text) < MINIMUM_TEXT_CHARACTERS


def _validate_packet(staging: Path, page_paths: list[str]) -> None:
    expected = {"extracted.txt", "inspection.json", *page_paths}
    contents = {path.name: path for path in staging.iterdir()}
    if set(contents) != expected:
        raise RuntimeError("staged evidence packet has an unexpected file set")
    for name, path in contents.items():
        if path.is_symlink() or not path.is_file():
            raise RuntimeError(f"staged evidence packet has invalid file: {name}")


def _promote_packet(staging: Path, destination: Path) -> None:
    """Swap a complete staged packet into place while retaining a recoverable backup."""
    backup: Path | None = None
    try:
        if destination.exists():
            backup = destination.parent / f".{destination.name}.backup-{uuid.uuid4().hex}"
            os.replace(destination, backup)
        os.replace(staging, destination)
    except Exception:
        if backup is not None and backup.exists() and not destination.exists():
            os.replace(backup, destination)
        raise
    else:
        if backup is not None:
            shutil.rmtree(backup)


def inspect_document(
    document: DocumentRecord, pipeline_root: Path, runner: Runner = run_command,
) -> dict:
    """Generate and atomically promote visual/text evidence for one archived PDF."""
    source = _canonical_source(document, pipeline_root)
    source_sha256 = _sha256_file(source)
    if source_sha256 != document.sha256:
        raise ValueError("document source hash does not match canonical record")
    evidence_root, destination = _evidence_destination(document, pipeline_root)
    staging = Path(tempfile.mkdtemp(prefix=f".{document.id}.staging-", dir=evidence_root))
    if staging.resolve().parent != evidence_root:
        shutil.rmtree(staging)
        raise RuntimeError("staging directory escapes evidence root")

    try:
        extracted_text = staging / "extracted.txt"
        commands: list[tuple[str, ...]] = []
        versions = _poppler_versions(runner, commands)
        info_command = ("pdfinfo", str(source))
        commands.append(info_command)
        page_count = _page_count(_output(_run(runner, info_command)))

        text_command = ("pdftotext", str(source), str(extracted_text))
        commands.append(text_command)
        _run(runner, text_command)
        if extracted_text.is_symlink() or not extracted_text.is_file():
            raise RuntimeError("pdftotext did not create extracted text evidence")
        text = extracted_text.read_text(encoding="utf-8", errors="replace")
        text_sha256 = _sha256_file(extracted_text)

        page_paths: list[str] = []
        for page_number in range(1, page_count + 1):
            page_name = f"page-{page_number:03d}.png"
            output_stem = staging / page_name.removesuffix(".png")
            render_command = (
                "pdftoppm", "-png", "-r", "240", "-f", str(page_number),
                "-l", str(page_number), "-singlefile", str(source), str(output_stem),
            )
            commands.append(render_command)
            _run(runner, render_command)
            output_path = output_stem.with_suffix(".png")
            if output_path.is_symlink() or not output_path.is_file():
                raise RuntimeError(f"pdftoppm did not create {page_name}")
            page_paths.append(page_name)

        expected_pages = set(page_paths)
        rendered_pages = {path.name for path in staging.glob("page-*.png")}
        if rendered_pages != expected_pages:
            raise RuntimeError("rendered page set does not match pdfinfo")

        page_texts = text.split("\f")
        if page_texts and not page_texts[-1]:
            page_texts.pop()
        pages = []
        candidates = []
        for page_number, page_name in enumerate(page_paths, start=1):
            page_candidates = extract_measurement_candidates(
                page_texts[page_number - 1] if page_number <= len(page_texts) else "",
                page_number,
            )
            pages.append({
                "number": page_number,
                "path": page_name,
                "candidate_count": len(page_candidates),
            })
            candidates.extend(page_candidates)

        inspection = {
            "schema_version": SCHEMA_VERSION,
            "document_id": document.id,
            "source_path": document.canonical_path,
            "source_sha256": source_sha256,
            "text_sha256": text_sha256,
            "poppler_versions": versions,
            "commands": [list(command) for command in commands],
            "page_count": page_count,
            "page_paths": page_paths,
            "pages": pages,
            "candidates": candidates,
            "visual_review_required": _requires_visual_review(text),
        }
        atomic_write_json(staging / "inspection.json", inspection)
        _validate_packet(staging, page_paths)
        _promote_packet(staging, destination)
        return inspection
    finally:
        if staging.exists():
            shutil.rmtree(staging)


def inspect_pending_documents(pipeline_root: Path) -> InspectionReport:
    """Inspect archived documents and atomically advance their record state."""
    records = tuple(iter_records(pipeline_root, "documents", DocumentRecord))
    inspected_records = []
    inspections = []
    skipped = 0
    for document in records:
        if document.status not in {"archived", "inspection_pending"}:
            skipped += 1
            continue
        inspection = inspect_document(document, pipeline_root)
        inspected = replace(document, status="inspected")
        write_record(pipeline_root, "documents", inspected)
        inspected_records.append(inspected)
        inspections.append(inspection)
    return InspectionReport(
        inspected=len(inspected_records),
        skipped=skipped,
        document_records=tuple(inspected_records),
        inspections=tuple(inspections),
    )
