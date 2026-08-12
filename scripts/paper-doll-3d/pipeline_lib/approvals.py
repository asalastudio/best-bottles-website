"""Immutable, scope- and hash-specific approval operations."""

from collections.abc import Iterable
from datetime import datetime
import re

from .ids import stable_id
from .models import APPROVAL_DECISIONS, APPROVAL_SCOPES, ApprovalRecord


_SHA256 = re.compile(r"[0-9a-f]{64}\Z")


def _required_string(value: object, field_name: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{field_name} must be a non-empty string")
    return value


def _artifact_hash(value: object) -> str:
    if not isinstance(value, str) or _SHA256.fullmatch(value) is None:
        raise ValueError("artifact_hash must be a lowercase SHA-256 hex digest")
    return value


def _approval_scope(value: object) -> str:
    if not isinstance(value, str) or value not in APPROVAL_SCOPES:
        raise ValueError(f"unknown approval scope: {value!r}")
    return value


def _decision(value: object) -> str:
    if not isinstance(value, str) or value not in APPROVAL_DECISIONS:
        raise ValueError(f"unknown approval decision: {value!r}")
    return value


def _aware_timestamp(value: object) -> datetime:
    if not isinstance(value, str) or not value:
        raise ValueError("decided_at must be a timezone-aware ISO-8601 timestamp")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError(
            "decided_at must be a timezone-aware ISO-8601 timestamp"
        ) from error
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise ValueError("decided_at must include a timezone offset")
    return parsed


def create_approval(
    entity_type: str,
    entity_id: str,
    scope: str,
    artifact_hash: str,
    reviewer: str,
    decision: str,
    notes: str,
    decided_at: str,
) -> ApprovalRecord:
    """Create a deterministic immutable approval for one artifact and scope."""
    entity_type = _required_string(entity_type, "entity_type")
    entity_id = _required_string(entity_id, "entity_id")
    scope = _approval_scope(scope)
    artifact_hash = _artifact_hash(artifact_hash)
    reviewer = _required_string(reviewer, "reviewer")
    decision = _decision(decision)
    if not isinstance(notes, str):
        raise ValueError("notes must be a string")
    _aware_timestamp(decided_at)

    content = {
        "entity_type": entity_type,
        "entity_id": entity_id,
        "scope": scope,
        "artifact_hash": artifact_hash,
        "reviewer": reviewer,
        "decided_at": decided_at,
        "decision": decision,
        "notes": notes,
    }
    return ApprovalRecord(id=stable_id("approval", content), **content)


def has_valid_approval(
    approvals: Iterable[ApprovalRecord],
    entity_id: str,
    scope: str,
    artifact_hash: str,
) -> bool:
    """Return whether the latest exact entity/scope/hash decision approves it."""
    entity_id = _required_string(entity_id, "entity_id")
    scope = _approval_scope(scope)
    artifact_hash = _artifact_hash(artifact_hash)

    matching: list[tuple[datetime, str, str]] = []
    for approval in approvals:
        if (
            approval.entity_id != entity_id
            or approval.scope != scope
            or approval.artifact_hash != artifact_hash
        ):
            continue
        try:
            timestamp = _aware_timestamp(approval.decided_at)
            _artifact_hash(approval.artifact_hash)
            decision = _decision(approval.decision)
        except ValueError:
            continue
        matching.append((timestamp, approval.id, decision))

    if not matching:
        return False
    return max(matching)[2] == "approved"
