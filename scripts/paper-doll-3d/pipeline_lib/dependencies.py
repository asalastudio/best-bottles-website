"""Deterministic dependency invalidation for immutable pipeline records."""

from collections import defaultdict
from collections.abc import Iterable, Mapping
import re

from .models import ArtifactRecord, ContractRecord, DependencyRecord


EDGE_TYPES = frozenset({
    "derived_from",
    "uses_geometry",
    "uses_finish",
    "uses_assembly",
    "uses_studio",
    "uses_material",
    "renders_asset",
})
ENTITY_KINDS = frozenset({
    "contract",
    "geometry",
    "finish",
    "component",
    "fitment",
    "closure",
    "assembly",
    "studio",
    "studio_architecture",
    "studio_preset",
    "material",
    "asset",
    "artifact",
    "asset_job",
    "render_asset",
    "render",
    "scene",
})
ASSET_ENTITY_KINDS = frozenset({
    "asset", "artifact", "asset_job", "render_asset", "render", "scene",
})
STUDIO_ENTITY_KINDS = frozenset({
    "studio", "studio_architecture", "studio_preset",
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


def _record_index(records: object) -> dict[str, object]:
    if isinstance(records, Mapping):
        index: dict[str, object] = {}
        for record_id, record in records.items():
            record_id = _required_id(record_id, "record id")
            embedded_id = (
                record.get("id") if isinstance(record, Mapping)
                else getattr(record, "id", None)
            )
            if embedded_id is not None and embedded_id != record_id:
                raise ValueError(
                    f"record mapping key {record_id!r} does not match embedded id"
                )
            index[record_id] = record
        return index

    index = {}
    try:
        iterator = iter(records)
    except TypeError as error:
        raise ValueError("records must be a mapping or iterable") from error
    for record in iterator:
        if isinstance(record, str):
            record_id = record
        elif isinstance(record, Mapping):
            record_id = record.get("id")
        else:
            record_id = getattr(record, "id", None)
        index[_required_id(record_id, "record id")] = record
    return index


def entity_kind(record: object) -> str:
    """Extract and validate the dependency-policy kind of an entity record."""
    if isinstance(record, ArtifactRecord):
        return "artifact"
    if isinstance(record, ContractRecord):
        return "contract"

    if isinstance(record, str):
        kind = record
    elif isinstance(record, Mapping):
        if {
            "sha256", "primary_uri", "mirror_uri", "status",
        }.issubset(record):
            kind = "artifact"
        elif {"contract_type", "document_ids", "dimensions"}.issubset(record):
            kind = "contract"
        else:
            kind = record.get("entity_type", record.get("kind"))
    else:
        kind = getattr(record, "entity_type", getattr(record, "kind", None))

    if not isinstance(kind, str) or kind not in ENTITY_KINDS:
        raise ValueError(f"unknown dependency entity kind: {kind!r}")
    return kind


def validate_dependency_edge(
    edge: DependencyRecord, records: Mapping[str, object],
) -> None:
    """Fail closed when an edge has unknown endpoints or violates kind policy."""
    try:
        source = records[edge.source_id]
        target = records[edge.target_id]
    except KeyError as error:
        raise ValueError(f"dependency endpoint has no record: {error.args[0]!r}") from error

    source_kind = entity_kind(source)
    target_kind = entity_kind(target)
    if edge.edge_type == "uses_studio":
        if source_kind not in STUDIO_ENTITY_KINDS:
            raise ValueError(
                f"uses_studio source must be studio-like, not {source_kind!r}"
            )
        if target_kind not in ASSET_ENTITY_KINDS:
            raise ValueError(
                f"uses_studio target must be asset-like, not {target_kind!r}"
            )


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
    record_index = _record_index(records)
    try:
        changed_kind = entity_kind(record_index[changed_id])
    except KeyError as error:
        raise ValueError(f"changed entity has no record: {changed_id!r}") from error
    studio_origin = changed_kind in STUDIO_ENTITY_KINDS

    adjacency: dict[str, list[DependencyRecord]] = defaultdict(list)
    for edge in tuple(edges):
        if not isinstance(edge, DependencyRecord):
            raise ValueError("edges must contain DependencyRecord values")
        if edge.edge_type not in EDGE_TYPES:
            raise ValueError(f"unknown dependency edge type: {edge.edge_type!r}")
        _required_id(edge.source_id, "edge source_id")
        _required_id(edge.target_id, "edge target_id")
        _sha256(edge.source_hash, "edge source_hash")
        validate_dependency_edge(edge, record_index)
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
        if target_id in record_index:
            target_kind = entity_kind(record_index[target_id])
            if studio_origin and target_kind not in ASSET_ENTITY_KINDS:
                raise ValueError(
                    "studio invalidation cannot reach non-asset record "
                    f"{target_id!r} ({target_kind!r})"
                )
            invalidated.add(target_id)
        pending.extend(edge.target_id for edge in adjacency.get(target_id, ()))

    return tuple(sorted(invalidated))
