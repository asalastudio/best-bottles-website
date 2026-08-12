"""Read-only PDF intake into the paper-doll canonical archive."""

from __future__ import annotations

import hashlib
import os
import tempfile
from dataclasses import dataclass
from pathlib import Path
from shutil import copyfileobj
from typing import Iterable

from .ids import stable_id
from .models import DocumentRecord, IssueRecord
from .store import iter_records, write_record


ARCHIVE_DIRECTORY = Path("documents/originals")
CHUNK_SIZE = 1024 * 1024


@dataclass(frozen=True)
class IntakeReport:
    discovered: int
    new: int
    duplicate: int
    revision_conflicts: int = 0
    document_records: tuple[DocumentRecord, ...] = ()
    issues: tuple[IssueRecord, ...] = ()


@dataclass(frozen=True)
class MirrorReport:
    matched_hashes: int
    mirror_files: int
    duplicate_file_instances: int
    unknown_hashes: int
    document_records: tuple[DocumentRecord, ...] = ()
    issues: tuple[IssueRecord, ...] = ()


def sha256_file(path: Path) -> str:
    """Return the SHA-256 digest of a file without modifying it."""
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(CHUNK_SIZE), b""):
            digest.update(chunk)
    return digest.hexdigest()


def discover_pdfs(source_dir: Path) -> tuple[Path, ...]:
    """Discover direct child PDFs in deterministic filename order."""
    return tuple(sorted(
        (path for path in source_dir.iterdir() if path.is_file() and path.suffix.lower() == ".pdf"),
        key=lambda path: (path.name.casefold(), path.name),
    ))


def _canonical_path(sha256: str) -> str:
    return str(ARCHIVE_DIRECTORY / f"{sha256}.pdf")


def _sorted_unique(values: Iterable[str]) -> tuple[str, ...]:
    return tuple(sorted(set(values)))


def _with_observation(record: DocumentRecord, path: Path) -> DocumentRecord:
    observed_path = str(path)
    return DocumentRecord(
        id=record.id,
        sha256=record.sha256,
        canonical_path=record.canonical_path,
        observed_names=_sorted_unique((*record.observed_names, path.name)),
        observed_paths=_sorted_unique((*record.observed_paths, observed_path)),
        status=record.status,
    )


def _archive_source(source: Path, destination: Path, expected_hash: str) -> None:
    """Copy a source into the archive, repairing missing or corrupt targets atomically."""
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists() and sha256_file(destination) == expected_hash:
        return

    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="wb", dir=destination.parent, suffix=".tmp", delete=False,
        ) as temporary:
            temporary_path = Path(temporary.name)
            with source.open("rb") as source_handle:
                copyfileobj(source_handle, temporary)
            temporary.flush()
            os.fsync(temporary.fileno())

        if sha256_file(temporary_path) != expected_hash:
            raise RuntimeError(f"source changed while archiving: {source}")
        os.replace(temporary_path, destination)
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)


def _revision_issue(previous: DocumentRecord, observed_name: str, new_hash: str) -> IssueRecord:
    payload = {
        "code": "REVISION_CONFLICT",
        "new_hash": new_hash,
        "observed_name": observed_name,
        "previous_hash": previous.sha256,
    }
    return IssueRecord(
        id=stable_id("issue", payload),
        entity_id=f"doc_{new_hash[:16]}",
        severity="warning",
        message=(
            f"Observed filename {observed_name!r} changed from {previous.sha256} "
            f"to {new_hash}; both revisions are retained."
        ),
        status="open",
        code="REVISION_CONFLICT",
    )


def intake_documents(source_dir: Path, pipeline_root: Path) -> IntakeReport:
    """Archive each source PDF by content hash while preserving all observations."""
    records = {
        record.sha256: record
        for record in iter_records(pipeline_root, "documents", DocumentRecord)
    }
    discovered = discover_pdfs(source_dir)
    new = 0
    duplicate = 0
    issues: list[IssueRecord] = []
    seen_issue_ids: set[str] = set()

    for source in discovered:
        sha256 = sha256_file(source)
        record = records.get(sha256)
        observed_path = str(source)
        conflicts = tuple(
            previous for previous in records.values()
            if previous.sha256 != sha256 and (
                source.name in previous.observed_names
                or observed_path in previous.observed_paths
            )
        )
        _archive_source(source, pipeline_root / _canonical_path(sha256), sha256)
        if record is None:
            record = DocumentRecord(
                id=f"doc_{sha256[:16]}",
                sha256=sha256,
                canonical_path=_canonical_path(sha256),
                observed_names=(),
                observed_paths=(),
                status="archived",
            )
            records[sha256] = record
            new += 1
        else:
            duplicate += 1

        for previous in conflicts:
            issue = _revision_issue(previous, source.name, sha256)
            if issue.id not in seen_issue_ids:
                issues.append(issue)
                seen_issue_ids.add(issue.id)
                write_record(pipeline_root, "issues", issue)

        observed = _with_observation(record, source)
        if observed != record:
            records[sha256] = observed
            write_record(pipeline_root, "documents", observed)

    return IntakeReport(
        discovered=len(discovered),
        new=new,
        duplicate=duplicate,
        revision_conflicts=len(issues),
        document_records=tuple(sorted(records.values(), key=lambda record: record.id)),
        issues=tuple(issues),
    )


def _unknown_mirror_issue(sha256: str, paths: tuple[Path, ...]) -> IssueRecord:
    payload = {
        "code": "UNKNOWN_MIRROR_CONTENT",
        "sha256": sha256,
        "paths": tuple(str(path) for path in paths),
    }
    return IssueRecord(
        id=stable_id("issue", payload),
        entity_id=f"doc_{sha256[:16]}",
        severity="warning",
        message=(
            f"Mirror content {sha256} is unknown and needs reconciliation; "
            "it was not ingested as canonical authority."
        ),
        status="open",
        code="UNKNOWN_MIRROR_CONTENT",
    )


def audit_existing_mirror(
    existing_dir: Path, document_records: Iterable[DocumentRecord],
) -> MirrorReport:
    """Read a legacy mirror, returning aliases and reconciliation issues only."""
    records = {record.sha256: record for record in document_records}
    files = discover_pdfs(existing_dir)
    paths_by_hash: dict[str, list[Path]] = {}
    for path in files:
        paths_by_hash.setdefault(sha256_file(path), []).append(path)

    issues: list[IssueRecord] = []
    for sha256, paths in paths_by_hash.items():
        record = records.get(sha256)
        if record is None:
            issues.append(_unknown_mirror_issue(sha256, tuple(paths)))
            continue
        for path in paths:
            record = _with_observation(record, path)
        records[sha256] = record

    matched_hashes = sum(sha256 in records for sha256 in paths_by_hash)
    unknown_hashes = sum(sha256 not in records for sha256 in paths_by_hash)
    duplicate_file_instances = sum(max(0, len(paths) - 1) for paths in paths_by_hash.values())
    return MirrorReport(
        matched_hashes=matched_hashes,
        mirror_files=len(files),
        duplicate_file_instances=duplicate_file_instances,
        unknown_hashes=unknown_hashes,
        document_records=tuple(sorted(records.values(), key=lambda record: record.id)),
        issues=tuple(issues),
    )
