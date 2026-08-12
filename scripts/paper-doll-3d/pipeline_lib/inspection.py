"""Visual inspection evidence for archived manufacturer drawings."""

from __future__ import annotations

import hashlib
import re
import subprocess
from dataclasses import dataclass, replace
from pathlib import Path
from typing import Callable

from .measurements import extract_measurement_candidates
from .models import DocumentRecord
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
    if source != root and root not in source.parents:
        raise ValueError("document canonical_path escapes pipeline root")
    if not source.is_file():
        raise FileNotFoundError(source)
    return source


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


def inspect_document(
    document: DocumentRecord, pipeline_root: Path, runner: Runner = run_command,
) -> dict:
    """Generate reproducible visual and text evidence for one archived PDF."""
    source = _canonical_source(document, pipeline_root)
    evidence_directory = pipeline_root / "evidence" / document.id
    evidence_directory.mkdir(parents=True, exist_ok=True)
    extracted_text = evidence_directory / "extracted.txt"
    commands: list[tuple[str, ...]] = []

    versions = _poppler_versions(runner, commands)
    info_command = ("pdfinfo", str(source))
    commands.append(info_command)
    page_count = _page_count(_output(_run(runner, info_command)))

    text_command = ("pdftotext", str(source), str(extracted_text))
    commands.append(text_command)
    _run(runner, text_command)
    if not extracted_text.is_file():
        raise RuntimeError("pdftotext did not create extracted text evidence")
    text = extracted_text.read_text(encoding="utf-8", errors="replace")

    page_paths: list[str] = []
    for page_number in range(1, page_count + 1):
        page_name = f"page-{page_number:03d}.png"
        output_stem = evidence_directory / page_name.removesuffix(".png")
        render_command = (
            "pdftoppm", "-png", "-r", "240", "-f", str(page_number),
            "-l", str(page_number), "-singlefile", str(source), str(output_stem),
        )
        commands.append(render_command)
        _run(runner, render_command)
        output_path = output_stem.with_suffix(".png")
        if not output_path.is_file():
            raise RuntimeError(f"pdftoppm did not create {page_name}")
        page_paths.append(page_name)

    rendered_pages = sorted(evidence_directory.glob("page-*.png"))
    if len(rendered_pages) != page_count:
        raise RuntimeError(
            f"rendered page count {len(rendered_pages)} does not match pdfinfo {page_count}",
        )

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
        "document_id": document.id,
        "source_path": document.canonical_path,
        "source_sha256": _sha256_file(source),
        "text_sha256": _sha256_file(extracted_text),
        "poppler_versions": versions,
        "commands": [list(command) for command in commands],
        "page_count": page_count,
        "page_paths": page_paths,
        "pages": pages,
        "candidates": candidates,
        "visual_review_required": len(text.strip()) < MINIMUM_TEXT_CHARACTERS,
    }
    atomic_write_json(evidence_directory / "inspection.json", inspection)
    return inspection


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
