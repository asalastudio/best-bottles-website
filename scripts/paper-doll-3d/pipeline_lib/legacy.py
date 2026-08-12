"""Conservative, source-backed inventory of pre-foundation Blender scenes."""

from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
from typing import Any

from .ids import stable_id
from .models import APPROVAL_SCOPES, ARTIFACT_STATUSES, SCHEMA_VERSION, ArtifactRecord
from .paths import resolve_descendant
from .store import write_record


_SHA256 = re.compile(r"[0-9a-f]{64}\Z")
_RULE_FIELDS = frozenset({
    "status", "approved_scopes", "evidence_note", "reviewer_source",
})
_SELECTORS = frozenset({"relative_path", "artifact_hash"})


@dataclass(frozen=True)
class LegacyReport:
    discovered: int
    written: int
    status_counts: tuple[tuple[str, int], ...]
    artifact_records: tuple[ArtifactRecord, ...]


@dataclass(frozen=True)
class _StatusRule:
    selector: str
    value: str
    status: str
    approved_scopes: tuple[str, ...]
    evidence_note: str
    reviewer_source: str


def _required_string(value: object, field_name: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{field_name} must be a non-empty string")
    return value


def _relative_path(value: object) -> str:
    value = _required_string(value, "relative_path")
    path = PurePosixPath(value)
    if (
        path.is_absolute()
        or "\\" in value
        or value != path.as_posix()
        or any(part in {"", ".", ".."} for part in path.parts)
    ):
        raise ValueError("relative_path must be a normalized relative POSIX path")
    return value


def _artifact_hash(value: object) -> str:
    if not isinstance(value, str) or _SHA256.fullmatch(value) is None:
        raise ValueError("artifact_hash must be a lowercase SHA-256 hex digest")
    return value


def _parse_rules(status_rules: dict[str, Any]) -> tuple[_StatusRule, ...]:
    if not isinstance(status_rules, dict) or set(status_rules) != {
        "schema_version", "rules",
    }:
        raise ValueError("legacy status registry must contain schema_version and rules")
    if (
        type(status_rules["schema_version"]) is not int
        or status_rules["schema_version"] != SCHEMA_VERSION
    ):
        raise ValueError(
            f"unsupported schema version: {status_rules['schema_version']!r}"
        )
    values = status_rules["rules"]
    if not isinstance(values, list):
        raise ValueError("legacy status rules must be a list")

    rules = []
    seen: set[tuple[str, str]] = set()
    for value in values:
        if not isinstance(value, dict):
            raise ValueError("legacy status rule must be a dictionary")
        selectors = set(value) & _SELECTORS
        expected = _RULE_FIELDS | selectors
        if len(selectors) != 1 or set(value) != expected:
            raise ValueError(
                "each legacy status rule must contain exactly one selector, status, "
                "approved_scopes, evidence_note, and reviewer_source"
            )
        selector = selectors.pop()
        selector_value = (
            _relative_path(value[selector])
            if selector == "relative_path"
            else _artifact_hash(value[selector])
        )
        key = (selector, selector_value)
        if key in seen:
            raise ValueError(f"duplicate legacy status rule: {selector_value!r}")
        seen.add(key)

        status = value["status"]
        if not isinstance(status, str) or status not in ARTIFACT_STATUSES:
            raise ValueError(f"unknown artifact status: {status!r}")
        if status == "protected":
            raise ValueError("legacy inventory cannot grant protected status")
        scopes = value["approved_scopes"]
        if not isinstance(scopes, list) or not all(
            isinstance(scope, str) and scope in APPROVAL_SCOPES for scope in scopes
        ):
            raise ValueError("approved_scopes must contain known approval scopes")
        if len(set(scopes)) != len(scopes):
            raise ValueError("approved_scopes must not contain duplicates")
        rules.append(_StatusRule(
            selector=selector,
            value=selector_value,
            status=status,
            approved_scopes=tuple(scopes),
            evidence_note=_required_string(value["evidence_note"], "evidence_note"),
            reviewer_source=_required_string(value["reviewer_source"], "reviewer_source"),
        ))
    return tuple(rules)


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _scene_paths(master_root: Path) -> tuple[tuple[str, Path], ...]:
    if master_root.is_symlink():
        raise ValueError("master_root must be a real directory")
    if not master_root.exists():
        return ()
    if not master_root.is_dir():
        raise ValueError("master_root must be a real directory")
    root = master_root.resolve(strict=True)
    scenes = []
    for directory, directory_names, file_names in os.walk(root, followlinks=False):
        directory_names.sort()
        file_names.sort()
        current = Path(directory)
        for directory_name in tuple(directory_names):
            child = current / directory_name
            if child.is_symlink():
                raise ValueError("legacy scene directory must not be a symlink")
        for file_name in file_names:
            candidate = current / file_name
            if candidate.suffix.lower() != ".blend":
                continue
            if candidate.is_symlink():
                raise ValueError("legacy scene path must not be a symlink")
            try:
                resolved = resolve_descendant(root, candidate, "legacy scene path")
            except (OSError, ValueError) as error:
                raise ValueError("legacy scene path escapes master_root") from error
            if not resolved.is_file():
                raise ValueError("legacy scene path must be a regular file")
            scenes.append((resolved.relative_to(root).as_posix(), resolved))
    return tuple(sorted(scenes))


def _matching_rule(
    relative_path: str, artifact_hash: str, rules: tuple[_StatusRule, ...],
) -> _StatusRule | None:
    matching = tuple(
        rule for rule in rules
        if (
            rule.selector == "relative_path" and rule.value == relative_path
        ) or (
            rule.selector == "artifact_hash" and rule.value == artifact_hash
        )
    )
    if len(matching) > 1:
        raise ValueError(f"multiple legacy status rules match {relative_path!r}")
    return matching[0] if matching else None


def inventory_legacy_assets(
    master_root: Path, status_rules: dict,
) -> tuple[ArtifactRecord, ...]:
    """Inventory Blender scenes without deriving authority from their filenames."""
    rules = _parse_rules(status_rules)
    records = []
    for relative_path, scene_path in _scene_paths(Path(master_root)):
        digest = _sha256_file(scene_path)
        rule = _matching_rule(relative_path, digest, rules)
        is_working = PurePosixPath(relative_path).parts[0] == "working"
        if is_working:
            if rule is not None and (
                rule.status != "experimental" or rule.approved_scopes
            ):
                raise ValueError("working scenes must remain experimental and unapproved")
            status = "experimental"
            scopes: tuple[str, ...] = ()
            note = rule.evidence_note if rule else "Working scene; experimental by location."
            source = rule.reviewer_source if rule else "legacy inventory path policy"
        elif rule is None:
            status = "imported_unverified"
            scopes = ()
            note = "No explicit legacy status rule; imported without approval."
            source = "legacy inventory default"
        else:
            status = rule.status
            scopes = rule.approved_scopes
            note = rule.evidence_note
            source = rule.reviewer_source

        records.append(ArtifactRecord(
            id=stable_id("artifact", {
                "relative_path": relative_path,
                "sha256": digest,
            }),
            sha256=digest,
            size_bytes=scene_path.stat().st_size,
            primary_uri=scene_path.as_uri(),
            mirror_uri="",
            status=status,
            kind="scene",
            approved_scopes=scopes,
            evidence_note=note,
            reviewer_source=source,
        ))
    return tuple(records)


def _load_status_rules(pipeline_root: Path) -> dict[str, Any]:
    root = pipeline_root.resolve()
    path = resolve_descendant(
        root, root / "reconciliation/legacy-status.json", "legacy status path",
    )
    try:
        with path.open(encoding="utf-8") as handle:
            value = json.load(handle)
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError("invalid legacy status registry") from error
    if not isinstance(value, dict):
        raise ValueError("legacy status registry must be a dictionary")
    return value


def inventory_pending_legacy_assets(pipeline_root: Path) -> LegacyReport:
    """Inventory ``master`` and atomically persist strict artifact records."""
    root = Path(pipeline_root).resolve()
    status_rules = _load_status_rules(root)
    artifact_directory = resolve_descendant(
        root, root / "artifacts/records", "artifact record directory",
    )
    if artifact_directory.exists() and not artifact_directory.is_dir():
        raise ValueError("artifact record directory must be a directory")
    records = inventory_legacy_assets(root / "master", status_rules)
    for record in records:
        write_record(root, "artifacts", record)

    counts: dict[str, int] = {}
    for record in records:
        counts[record.status] = counts.get(record.status, 0) + 1
    return LegacyReport(
        discovered=len(records),
        written=len(records),
        status_counts=tuple(sorted(counts.items())),
        artifact_records=records,
    )
