"""Atomic JSON persistence for paper-doll pipeline records."""

import json
import os
import tempfile
from collections.abc import Iterator
from pathlib import Path
from typing import Any

from .models import SCHEMA_VERSION


RECORD_DIRECTORIES = {
    "documents": Path("documents/records"),
    "approvals": Path("approvals/records"),
    "dependencies": Path("dependencies/records"),
    "issues": Path("issues/records"),
    "artifacts": Path("artifacts/records"),
}


def _record_directory(root: Path, kind: str) -> Path:
    try:
        return root / RECORD_DIRECTORIES[kind]
    except KeyError as error:
        raise ValueError(f"unknown record kind: {kind!r}") from error


def _record_path(directory: Path, record_id: object) -> Path:
    if not isinstance(record_id, str) or not record_id or not record_id.isascii():
        raise ValueError(f"invalid record id: {record_id!r}")
    if not all(character.isalnum() or character in "_-" for character in record_id):
        raise ValueError(f"invalid record id: {record_id!r}")
    return directory / f"{record_id}.json"


def _record_value(record: object) -> dict[str, Any]:
    value = getattr(record, "to_dict")()
    if not isinstance(value, dict):
        raise ValueError("record must serialize to a dictionary")
    if type(value.get("schema_version")) is not int or value["schema_version"] != SCHEMA_VERSION:
        raise ValueError(f"unsupported schema version: {value.get('schema_version')!r}")
    return value


def atomic_write_json(path: Path, value: dict[str, Any]) -> None:
    """Write JSON to ``path`` atomically, avoiding unchanged replacements."""
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", dir=path.parent, suffix=".tmp", delete=False,
        ) as temporary:
            temporary_path = Path(temporary.name)
            json.dump(value, temporary, sort_keys=True, indent=2)
            temporary.flush()
            os.fsync(temporary.fileno())

        if path.exists() and path.read_bytes() == temporary_path.read_bytes():
            return
        os.replace(temporary_path, path)
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)


def write_record(root: Path, kind: str, record: object) -> Path:
    """Persist a record under its fixed kind directory and return its path."""
    directory = _record_directory(root, kind)
    path = _record_path(directory, getattr(record, "id"))
    atomic_write_json(path, _record_value(record))
    return path


def read_record(path: Path, record_type: type) -> object:
    """Read a record from JSON using its strict ``from_dict`` constructor."""
    with path.open(encoding="utf-8") as handle:
        value = json.load(handle)
    return record_type.from_dict(value)


def iter_record_dicts(root: Path, kind: str) -> Iterator[dict[str, Any]]:
    """Yield JSON record dictionaries for one fixed record kind, by filename."""
    directory = _record_directory(root, kind)
    if not directory.exists():
        return
    for path in sorted(directory.glob("*.json")):
        with path.open(encoding="utf-8") as handle:
            yield json.load(handle)


def iter_records(root: Path, kind: str, record_type: type) -> Iterator[object]:
    """Yield strict records for one fixed record kind, by filename."""
    for value in iter_record_dicts(root, kind):
        yield record_type.from_dict(value)
