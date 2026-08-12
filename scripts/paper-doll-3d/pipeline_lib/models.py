"""Immutable, versioned records for the paper-doll pipeline."""

from dataclasses import asdict, dataclass, fields
from typing import Any


SCHEMA_VERSION = 1

DOCUMENT_STATUSES = frozenset({
    "archived", "inspection_pending", "inspected", "needs_reconciliation", "failed",
})
CONTRACT_STATUSES = frozenset({"draft", "blocked", "approved", "invalidated"})
APPROVAL_DECISIONS = frozenset({"approved", "rejected"})
DEPENDENCY_STATUSES = frozenset({"active", "invalidated"})
ISSUE_SEVERITIES = frozenset({"info", "warning", "blocked", "error"})
ISSUE_STATUSES = frozenset({"open", "resolved"})
ARTIFACT_STATUSES = frozenset({
    "imported_unverified", "experimental", "extrapolated", "candidate", "approved",
    "protected", "invalidated",
})
APPROVAL_SCOPES = frozenset({
    "dimensional_truth", "body_geometry", "finish_thread_geometry",
    "fitment_geometry", "component_geometry", "assembly_visual_fit",
    "assembly_dimensional_fit", "studio_architecture", "studio_preset",
    "material_lookdev", "final_asset",
})


def _json_value(value: Any) -> Any:
    if isinstance(value, tuple):
        return [_json_value(item) for item in value]
    if isinstance(value, dict):
        return {key: _json_value(item) for key, item in value.items()}
    return value


def _record_dict(record: object) -> dict[str, Any]:
    return _json_value(asdict(record))


def _from_dict(
    record_type: type, value: dict[str, Any], tuple_fields: tuple[str, ...] = (),
) -> object:
    if not isinstance(value, dict):
        raise ValueError("record must be a dictionary")

    expected_fields = {field.name for field in fields(record_type)}
    supplied_fields = set(value)
    if supplied_fields != expected_fields:
        unknown = supplied_fields - expected_fields
        missing = expected_fields - supplied_fields
        details = []
        if unknown:
            details.append(f"unknown fields: {sorted(unknown)}")
        if missing:
            details.append(f"missing fields: {sorted(missing)}")
        raise ValueError("invalid record fields (" + "; ".join(details) + ")")
    if value["schema_version"] != SCHEMA_VERSION:
        raise ValueError(f"unsupported schema version: {value['schema_version']!r}")

    parsed = dict(value)
    for name in tuple_fields:
        tuple_value = parsed[name]
        if not isinstance(tuple_value, (list, tuple)):
            raise ValueError(f"{name} must be a list or tuple")
        parsed[name] = tuple(tuple_value)

    try:
        return record_type(**parsed)
    except (TypeError, ValueError) as error:
        raise ValueError(f"invalid {record_type.__name__}") from error


def _require_member(value: str, allowed: frozenset[str], field_name: str) -> None:
    if value not in allowed:
        raise ValueError(f"unknown {field_name}: {value!r}")


def _require_schema_version(schema_version: int) -> None:
    if schema_version != SCHEMA_VERSION:
        raise ValueError(f"unsupported schema version: {schema_version!r}")


@dataclass(frozen=True)
class DocumentRecord:
    id: str
    sha256: str
    canonical_path: str
    observed_names: tuple[str, ...]
    status: str
    observed_paths: tuple[str, ...] = ()
    schema_version: int = SCHEMA_VERSION

    def __post_init__(self) -> None:
        _require_member(self.status, DOCUMENT_STATUSES, "document status")
        _require_schema_version(self.schema_version)

    def to_dict(self) -> dict[str, Any]:
        return _record_dict(self)

    @classmethod
    def from_dict(cls, value: dict[str, Any]) -> "DocumentRecord":
        return _from_dict(cls, value, ("observed_names", "observed_paths"))


@dataclass(frozen=True)
class ContractRecord:
    id: str
    contract_type: str
    document_ids: tuple[str, ...]
    sold_product_key: str
    source_capacity_label: str
    sold_capacity_label: str
    geometry_authority: bool
    dimensions: tuple[dict[str, Any], ...]
    status: str
    schema_version: int = SCHEMA_VERSION

    def __post_init__(self) -> None:
        _require_member(self.status, CONTRACT_STATUSES, "contract status")
        _require_schema_version(self.schema_version)

    def to_dict(self) -> dict[str, Any]:
        return _record_dict(self)

    @classmethod
    def from_dict(cls, value: dict[str, Any]) -> "ContractRecord":
        return _from_dict(cls, value, ("document_ids", "dimensions"))


@dataclass(frozen=True)
class ApprovalRecord:
    id: str
    entity_type: str
    entity_id: str
    scope: str
    artifact_hash: str
    reviewer: str
    decided_at: str
    decision: str
    notes: str
    schema_version: int = SCHEMA_VERSION

    def __post_init__(self) -> None:
        _require_member(self.scope, APPROVAL_SCOPES, "approval scope")
        _require_member(self.decision, APPROVAL_DECISIONS, "approval decision")
        _require_schema_version(self.schema_version)

    def to_dict(self) -> dict[str, Any]:
        return _record_dict(self)

    @classmethod
    def from_dict(cls, value: dict[str, Any]) -> "ApprovalRecord":
        return _from_dict(cls, value)


@dataclass(frozen=True)
class DependencyRecord:
    id: str
    source_id: str
    target_id: str
    edge_type: str
    source_hash: str
    status: str = "active"
    schema_version: int = SCHEMA_VERSION

    def __post_init__(self) -> None:
        _require_member(self.status, DEPENDENCY_STATUSES, "dependency status")
        _require_schema_version(self.schema_version)

    def to_dict(self) -> dict[str, Any]:
        return _record_dict(self)

    @classmethod
    def from_dict(cls, value: dict[str, Any]) -> "DependencyRecord":
        return _from_dict(cls, value)


@dataclass(frozen=True)
class IssueRecord:
    id: str
    entity_id: str
    severity: str
    message: str
    status: str
    code: str = ""
    schema_version: int = SCHEMA_VERSION

    def __post_init__(self) -> None:
        _require_member(self.severity, ISSUE_SEVERITIES, "issue severity")
        _require_member(self.status, ISSUE_STATUSES, "issue status")
        _require_schema_version(self.schema_version)

    def to_dict(self) -> dict[str, Any]:
        return _record_dict(self)

    @classmethod
    def from_dict(cls, value: dict[str, Any]) -> "IssueRecord":
        return _from_dict(cls, value)


@dataclass(frozen=True)
class ArtifactRecord:
    id: str
    sha256: str
    size_bytes: int
    primary_uri: str
    mirror_uri: str
    status: str
    kind: str = "scene"
    approved_scopes: tuple[str, ...] = ()
    evidence_note: str = ""
    reviewer_source: str = ""
    last_integrity_check: str | None = None
    schema_version: int = SCHEMA_VERSION

    def __post_init__(self) -> None:
        _require_member(self.status, ARTIFACT_STATUSES, "artifact status")
        for scope in self.approved_scopes:
            _require_member(scope, APPROVAL_SCOPES, "approval scope")
        _require_schema_version(self.schema_version)

    def to_dict(self) -> dict[str, Any]:
        return _record_dict(self)

    @classmethod
    def from_dict(cls, value: dict[str, Any]) -> "ArtifactRecord":
        return _from_dict(cls, value, ("approved_scopes",))
