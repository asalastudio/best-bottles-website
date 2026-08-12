"""Shared validation for record identifiers and pipeline-local paths."""

from pathlib import Path


def safe_record_id(value: object, field_name: str = "record id") -> str:
    """Return a filesystem-safe ASCII record ID or raise ``ValueError``."""
    if not isinstance(value, str) or not value or not value.isascii():
        raise ValueError(f"invalid {field_name}: {value!r}")
    if not all(character.isalnum() or character in "_-" for character in value):
        raise ValueError(f"invalid {field_name}: {value!r}")
    return value


def resolve_descendant(root: Path, candidate: Path, label: str) -> Path:
    """Resolve ``candidate`` and require it to remain strictly beneath ``root``."""
    resolved_root = root.resolve()
    resolved_candidate = candidate.resolve()
    if resolved_candidate == resolved_root or resolved_root not in resolved_candidate.parents:
        raise ValueError(f"{label} escapes its containing directory")
    return resolved_candidate
