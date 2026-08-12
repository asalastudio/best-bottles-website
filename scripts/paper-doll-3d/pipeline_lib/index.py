"""Disposable SQLite status index derived from authoritative JSON records."""

from __future__ import annotations

import json
import os
import sqlite3
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterator

from .ids import content_hash
from .models import (
    ApprovalRecord,
    ArtifactRecord,
    ContractRecord,
    DependencyRecord,
    DocumentRecord,
    IssueRecord,
)
from .paths import resolve_descendant


_TABLE_STATEMENTS = (
    "CREATE TABLE entities (id TEXT PRIMARY KEY, kind TEXT NOT NULL, status TEXT NOT NULL, content_hash TEXT NOT NULL, json_path TEXT NOT NULL);",
    "CREATE TABLE approvals (id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, scope TEXT NOT NULL, artifact_hash TEXT NOT NULL, decision TEXT NOT NULL);",
    "CREATE TABLE dependencies (id TEXT PRIMARY KEY, source_id TEXT NOT NULL, target_id TEXT NOT NULL, edge_type TEXT NOT NULL);",
    "CREATE TABLE issues (id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, severity TEXT NOT NULL, message TEXT NOT NULL, status TEXT NOT NULL);",
    "CREATE TABLE artifacts (id TEXT PRIMARY KEY, status TEXT NOT NULL, sha256 TEXT NOT NULL, primary_uri TEXT, mirror_uri TEXT);",
)


@dataclass(frozen=True)
class IndexSummary:
    entities: int
    approvals: int
    dependencies: int
    issues: int
    artifacts: int


@dataclass(frozen=True)
class _SourceRecord:
    kind: str
    value: dict[str, Any]
    record: object
    json_path: str


def _record_paths(pipeline_root: Path, relative_pattern: str) -> Iterator[Path]:
    root = pipeline_root.resolve()
    for path in sorted(pipeline_root.glob(relative_pattern)):
        yield resolve_descendant(root, path, "record path")


def _source_records(
    pipeline_root: Path, kind: str, relative_pattern: str, record_type: type,
) -> Iterator[_SourceRecord]:
    root = pipeline_root.resolve()
    for path in _record_paths(pipeline_root, relative_pattern):
        relative_path = path.relative_to(root).as_posix()
        try:
            with path.open(encoding="utf-8") as handle:
                value = json.load(handle)
            record = record_type.from_dict(value)
        except (OSError, TypeError, ValueError) as error:
            raise ValueError(f"invalid {kind} record: {relative_path}") from error
        yield _SourceRecord(kind, value, record, relative_path)


def _all_source_records(pipeline_root: Path) -> tuple[_SourceRecord, ...]:
    families = (
        ("document", "documents/records/*.json", DocumentRecord),
        ("contract", "contracts/**/*.json", ContractRecord),
        ("approval", "approvals/records/*.json", ApprovalRecord),
        ("dependency", "dependencies/records/*.json", DependencyRecord),
        ("issue", "issues/records/*.json", IssueRecord),
        ("artifact", "artifacts/records/*.json", ArtifactRecord),
    )
    records = []
    for kind, pattern, record_type in families:
        records.extend(_source_records(pipeline_root, kind, pattern, record_type))
    return tuple(records)


def _require_unique_ids(records: tuple[_SourceRecord, ...]) -> None:
    table_for_kind = {
        "document": "entities",
        "contract": "entities",
        "artifact": "entities",
        "approval": "approvals",
        "dependency": "dependencies",
        "issue": "issues",
    }
    seen: dict[str, set[str]] = {}
    for source in records:
        table = table_for_kind[source.kind]
        ids = seen.setdefault(table, set())
        record_id = source.record.id
        if record_id in ids:
            label = "entity" if table == "entities" else source.kind
            raise ValueError(f"duplicate {label} id: {record_id!r}")
        ids.add(record_id)


def _require_disposable_target(
    pipeline_root: Path, db_path: Path, records: tuple[_SourceRecord, ...],
) -> None:
    root = pipeline_root.resolve()
    target = db_path.resolve()
    authority_paths = {
        (root / source.json_path).resolve()
        for source in records
    }
    if target in authority_paths:
        raise ValueError("database target must not replace JSON authority")


def _populate(connection: sqlite3.Connection, records: tuple[_SourceRecord, ...]) -> None:
    for source in records:
        record = source.record
        if source.kind in {"document", "contract", "artifact"}:
            connection.execute(
                "INSERT INTO entities VALUES (?, ?, ?, ?, ?)",
                (
                    record.id, source.kind, record.status,
                    content_hash(source.value), source.json_path,
                ),
            )
        if source.kind == "approval":
            connection.execute(
                "INSERT INTO approvals VALUES (?, ?, ?, ?, ?)",
                (
                    record.id, record.entity_id, record.scope,
                    record.artifact_hash, record.decision,
                ),
            )
        elif source.kind == "dependency":
            connection.execute(
                "INSERT INTO dependencies VALUES (?, ?, ?, ?)",
                (record.id, record.source_id, record.target_id, record.edge_type),
            )
        elif source.kind == "issue":
            connection.execute(
                "INSERT INTO issues VALUES (?, ?, ?, ?, ?)",
                (
                    record.id, record.entity_id, record.severity,
                    record.message, record.status,
                ),
            )
        elif source.kind == "artifact":
            connection.execute(
                "INSERT INTO artifacts VALUES (?, ?, ?, ?, ?)",
                (
                    record.id, record.status, record.sha256,
                    record.primary_uri or None, record.mirror_uri or None,
                ),
            )


def rebuild_index(pipeline_root: Path, db_path: Path) -> IndexSummary:
    """Atomically rebuild ``db_path`` solely from strict source JSON records."""
    pipeline_root = Path(pipeline_root)
    db_path = Path(db_path)
    records = _all_source_records(pipeline_root)
    _require_unique_ids(records)
    _require_disposable_target(pipeline_root, db_path, records)

    db_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path: Path | None = None
    connection: sqlite3.Connection | None = None
    try:
        with tempfile.NamedTemporaryFile(
            dir=db_path.parent, prefix=f".{db_path.name}.", suffix=".tmp", delete=False,
        ) as temporary:
            temporary_path = Path(temporary.name)

        connection = sqlite3.connect(temporary_path)
        for statement in _TABLE_STATEMENTS:
            connection.execute(statement)
        _populate(connection, records)
        connection.commit()
        connection.close()
        connection = None

        with temporary_path.open("rb") as database_file:
            os.fsync(database_file.fileno())
        os.replace(temporary_path, db_path)

        counts = {
            "entities": sum(
                source.kind in {"document", "contract", "artifact"}
                for source in records
            ),
            "approvals": sum(source.kind == "approval" for source in records),
            "dependencies": sum(source.kind == "dependency" for source in records),
            "issues": sum(source.kind == "issue" for source in records),
            "artifacts": sum(source.kind == "artifact" for source in records),
        }
        return IndexSummary(**counts)
    finally:
        if connection is not None:
            connection.close()
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)


def _query_rows(db_path: Path, query: str) -> tuple[dict[str, Any], ...]:
    path = Path(db_path).resolve(strict=True)
    connection = sqlite3.connect(f"{path.as_uri()}?mode=ro", uri=True)
    try:
        connection.row_factory = sqlite3.Row
        return tuple(dict(row) for row in connection.execute(query))
    finally:
        connection.close()


def status_rows(db_path: Path) -> tuple[dict, ...]:
    """Return deterministic entity status rows without deriving approval state."""
    return _query_rows(
        db_path,
        "SELECT id, kind, status, content_hash, json_path "
        "FROM entities ORDER BY kind, id",
    )


def blocked_rows(db_path: Path) -> tuple[dict, ...]:
    """Return deterministic unresolved blocker rows, including their messages."""
    return _query_rows(
        db_path,
        "SELECT id, entity_id, severity, message, status FROM issues "
        "WHERE severity = 'blocked' AND status = 'open' ORDER BY entity_id, id",
    )
