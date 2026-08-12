"""Deterministic dependency invalidation for immutable pipeline records."""

from collections import defaultdict
from collections.abc import Iterable, Mapping
import re

from .models import DependencyRecord


EDGE_TYPES = frozenset({
    "derived_from",
    "uses_geometry",
    "uses_finish",
    "uses_assembly",
    "uses_studio",
    "uses_material",
    "renders_asset",
})

_SHA256 = re.compile(r"[0-9a-f]{64}\Z")


def _required_id(value: object, field_name: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{field_name} must be a non-empty string")
    return value


def _sha256(value: object, field_name: str) -> str:
    if not isinstance(value, str) or _SHA256.fullmatch(value) is None:
        raise ValueError(f"{field_name} must be a lowercase SHA-256 hex digest")
    return value


def _record_ids(records: object) -> frozenset[str]:
    if isinstance(records, Mapping):
        values = records.keys()
    else:
        values = records

    record_ids: set[str] = set()
    try:
        iterator = iter(values)
    except TypeError as error:
        raise ValueError("records must be a mapping or iterable") from error
    for record in iterator:
        if isinstance(record, str):
            record_id = record
        elif isinstance(record, Mapping):
            record_id = record.get("id")
        else:
            record_id = getattr(record, "id", None)
        record_ids.add(_required_id(record_id, "record id"))
    return frozenset(record_ids)


def invalidate_dependents(
    changed_id: str,
    changed_hash: str,
    edges: Iterable[DependencyRecord],
    records: object,
) -> tuple[str, ...]:
    """Return active records transitively invalidated by a source hash change.

    The source's direct edges are invalidated only when their recorded source
    hash differs from ``changed_hash``. Once a dependent becomes invalid, all
    active records downstream of it are invalid too. Inputs are never mutated;
    callers can use the returned IDs to create new invalidated record versions.
    """
    changed_id = _required_id(changed_id, "changed_id")
    changed_hash = _sha256(changed_hash, "changed_hash")
    known_record_ids = _record_ids(records)

    adjacency: dict[str, list[DependencyRecord]] = defaultdict(list)
    for edge in tuple(edges):
        if not isinstance(edge, DependencyRecord):
            raise ValueError("edges must contain DependencyRecord values")
        if edge.edge_type not in EDGE_TYPES:
            raise ValueError(f"unknown dependency edge type: {edge.edge_type!r}")
        _required_id(edge.source_id, "edge source_id")
        _required_id(edge.target_id, "edge target_id")
        _sha256(edge.source_hash, "edge source_hash")
        if edge.status == "active":
            adjacency[edge.source_id].append(edge)

    visited = {changed_id}
    pending = [
        edge.target_id
        for edge in adjacency.get(changed_id, ())
        if edge.source_hash != changed_hash
    ]
    invalidated: set[str] = set()

    while pending:
        target_id = pending.pop()
        if target_id in visited:
            continue
        visited.add(target_id)
        if target_id in known_record_ids:
            invalidated.add(target_id)
        pending.extend(edge.target_id for edge in adjacency.get(target_id, ()))

    return tuple(sorted(invalidated))
