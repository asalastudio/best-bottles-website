"""Conservative, source-backed inventory of pre-foundation Blender scenes."""

from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat as stat_module
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


@dataclass(frozen=True)
class _ScenePath:
    relative_path: str
    identity: tuple[int, int, int, int, int]


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
        if status == "approved" and not scopes:
            raise ValueError("approved legacy status requires at least one approved scope")
        if status in {"imported_unverified", "experimental", "extrapolated"} and scopes:
            raise ValueError(f"{status} legacy status cannot contain approved scopes")
        rules.append(_StatusRule(
            selector=selector,
            value=selector_value,
            status=status,
            approved_scopes=tuple(scopes),
            evidence_note=_required_string(value["evidence_note"], "evidence_note"),
            reviewer_source=_required_string(value["reviewer_source"], "reviewer_source"),
        ))
    return tuple(rules)


def _identity(metadata: os.stat_result) -> tuple[int, int, int, int, int]:
    return (
        metadata.st_dev,
        metadata.st_ino,
        metadata.st_size,
        metadata.st_mtime_ns,
        metadata.st_ctime_ns,
    )


def _scene_paths(master_root: Path) -> tuple[_ScenePath, ...]:
    if master_root.is_symlink():
        raise ValueError("master_root must be a real directory")
    if not master_root.exists():
        return ()
    if not master_root.is_dir():
        raise ValueError("master_root must be a real directory")
    root = master_root
    scenes = []

    def traversal_error(error: OSError) -> None:
        raise ValueError("unable to traverse legacy master") from error

    try:
        walker = os.walk(
            root, followlinks=False, onerror=traversal_error,
        )
        for directory, directory_names, file_names in walker:
            directory_names.sort()
            file_names.sort()
            current = Path(directory)
            for directory_name in tuple(directory_names):
                child = current / directory_name
                metadata = child.lstat()
                if stat_module.S_ISLNK(metadata.st_mode):
                    raise ValueError("legacy scene directory must not be a symlink")
                if not stat_module.S_ISDIR(metadata.st_mode):
                    raise ValueError("legacy scene directory must be a real directory")
            for file_name in file_names:
                candidate = current / file_name
                if candidate.suffix.lower() != ".blend":
                    continue
                metadata = candidate.lstat()
                if stat_module.S_ISLNK(metadata.st_mode):
                    raise ValueError("legacy scene path must not be a symlink")
                if not stat_module.S_ISREG(metadata.st_mode):
                    raise ValueError("legacy scene path must be a regular file")
                scenes.append(_ScenePath(
                    relative_path=candidate.relative_to(root).as_posix(),
                    identity=_identity(metadata),
                ))
    except ValueError:
        raise
    except OSError as error:
        raise ValueError("unable to traverse legacy master") from error
    return tuple(sorted(scenes, key=lambda scene: scene.relative_path))


def _open_flags(*, directory: bool) -> int:
    if not hasattr(os, "O_NOFOLLOW") or (directory and not hasattr(os, "O_DIRECTORY")):
        raise ValueError("platform lacks required no-follow file opening support")
    flags = os.O_RDONLY | os.O_NOFOLLOW
    flags |= getattr(os, "O_CLOEXEC", 0)
    flags |= getattr(os, "O_NONBLOCK", 0)
    if directory:
        flags |= os.O_DIRECTORY
    return flags


def _relative_scene_parts(relative_path: str) -> tuple[str, ...]:
    normalized = _relative_path(relative_path)
    parts = PurePosixPath(normalized).parts
    if not parts:
        raise ValueError("legacy scene path must name a file")
    return parts


def _open_scene_parent(
    root_descriptor: int, parent_parts: tuple[str, ...], opener,
) -> tuple[int, bool]:
    """Open a relative parent chain without following any component symlink."""
    descriptor = root_descriptor
    owned = False
    try:
        for component in parent_parts:
            child_descriptor = opener(
                component, _open_flags(directory=True), dir_fd=descriptor,
            )
            try:
                metadata = os.fstat(child_descriptor)
                if not stat_module.S_ISDIR(metadata.st_mode):
                    raise ValueError("legacy scene parent must be a directory")
            except BaseException:
                os.close(child_descriptor)
                raise
            if owned:
                os.close(descriptor)
            descriptor = child_descriptor
            owned = True
        return descriptor, owned
    except BaseException:
        if owned:
            os.close(descriptor)
        raise


def _anchored_scene_metadata(
    root_descriptor: int, parts: tuple[str, ...], opener,
) -> os.stat_result:
    parent_descriptor, owned = _open_scene_parent(
        root_descriptor, parts[:-1], opener,
    )
    try:
        return os.stat(
            parts[-1], dir_fd=parent_descriptor, follow_symlinks=False,
        )
    finally:
        if owned:
            os.close(parent_descriptor)


def _fingerprint_scene(
    root: Path, root_descriptor: int, scene: _ScenePath, opener,
) -> tuple[str, int, Path]:
    """Hash one root-anchored descriptor and reject component/pathname races."""
    try:
        parts = _relative_scene_parts(scene.relative_path)
        parent_descriptor, owned_parent = _open_scene_parent(
            root_descriptor, parts[:-1], opener,
        )
        descriptor = -1
        try:
            descriptor = opener(
                parts[-1], _open_flags(directory=False), dir_fd=parent_descriptor,
            )
            before = os.fstat(descriptor)
            if (
                not stat_module.S_ISREG(before.st_mode)
                or _identity(before) != scene.identity
            ):
                raise ValueError("legacy scene changed during inventory")
            digest = hashlib.sha256()
            streamed_size = 0
            with os.fdopen(descriptor, "rb", closefd=True) as handle:
                descriptor = -1
                for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                    digest.update(chunk)
                    streamed_size += len(chunk)
                after = os.fstat(handle.fileno())
            final_metadata = os.stat(
                parts[-1], dir_fd=parent_descriptor, follow_symlinks=False,
            )
        finally:
            if descriptor >= 0:
                os.close(descriptor)
            if owned_parent:
                os.close(parent_descriptor)

        anchored_metadata = _anchored_scene_metadata(root_descriptor, parts, opener)
        if (
            _identity(after) != scene.identity
            or _identity(final_metadata) != scene.identity
            or _identity(anchored_metadata) != scene.identity
            or not stat_module.S_ISREG(final_metadata.st_mode)
            or not stat_module.S_ISREG(anchored_metadata.st_mode)
            or streamed_size != after.st_size
        ):
            raise ValueError("legacy scene changed during inventory")
        return digest.hexdigest(), streamed_size, root.joinpath(*parts)
    except (OSError, ValueError) as error:
        raise ValueError(
            f"legacy scene changed during inventory: {scene.relative_path}"
        ) from error


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
    master_root: Path, status_rules: dict, opener=os.open,
) -> tuple[ArtifactRecord, ...]:
    """Inventory Blender scenes without deriving authority from their filenames."""
    rules = _parse_rules(status_rules)
    configured_root = Path(master_root).absolute()
    try:
        root_path_metadata = configured_root.lstat()
    except FileNotFoundError:
        return ()
    except OSError as error:
        raise ValueError("unable to inspect legacy master root") from error
    if (
        stat_module.S_ISLNK(root_path_metadata.st_mode)
        or not stat_module.S_ISDIR(root_path_metadata.st_mode)
    ):
        raise ValueError("master_root must be a real directory")

    root_descriptor = -1
    try:
        root_descriptor = opener(
            configured_root, _open_flags(directory=True), dir_fd=None,
        )
        root_metadata = os.fstat(root_descriptor)
        if (
            not stat_module.S_ISDIR(root_metadata.st_mode)
            or (root_metadata.st_dev, root_metadata.st_ino)
            != (root_path_metadata.st_dev, root_path_metadata.st_ino)
        ):
            raise ValueError("legacy master root changed during inventory")
        root = configured_root.resolve(strict=True)
        resolved_metadata = root.lstat()
        if (
            not stat_module.S_ISDIR(resolved_metadata.st_mode)
            or (resolved_metadata.st_dev, resolved_metadata.st_ino)
            != (root_metadata.st_dev, root_metadata.st_ino)
        ):
            raise ValueError("legacy master root changed during inventory")

        records = []
        for scene in _scene_paths(root):
            relative_path = scene.relative_path
            digest, size_bytes, scene_path = _fingerprint_scene(
                root, root_descriptor, scene, opener,
            )
            rule = _matching_rule(relative_path, digest, rules)
            is_working = PurePosixPath(relative_path).parts[0] == "working"
            if is_working:
                if rule is not None and (
                    rule.status != "experimental" or rule.approved_scopes
                ):
                    raise ValueError(
                        "working scenes must remain experimental and unapproved"
                    )
                status = "experimental"
                scopes: tuple[str, ...] = ()
                note = (
                    rule.evidence_note
                    if rule else "Working scene; experimental by location."
                )
                source = (
                    rule.reviewer_source
                    if rule else "legacy inventory path policy"
                )
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
                size_bytes=size_bytes,
                primary_uri=scene_path.as_uri(),
                mirror_uri="",
                status=status,
                kind="legacy_scene",
                approved_scopes=scopes,
                evidence_note=note,
                reviewer_source=source,
            ))

        final_root_metadata = configured_root.lstat()
        if (
            stat_module.S_ISLNK(final_root_metadata.st_mode)
            or (final_root_metadata.st_dev, final_root_metadata.st_ino)
            != (root_metadata.st_dev, root_metadata.st_ino)
        ):
            raise ValueError("legacy master root changed during inventory")
        return tuple(records)
    except (OSError, ValueError) as error:
        if isinstance(error, ValueError):
            raise
        raise ValueError("legacy master root changed during inventory") from error
    finally:
        if root_descriptor >= 0:
            os.close(root_descriptor)


def _artifact_records(root: Path) -> tuple[tuple[Path, ArtifactRecord], ...]:
    artifact_directory = resolve_descendant(
        root, root / "artifacts/records", "artifact record directory",
    )
    if not artifact_directory.exists():
        return ()
    if artifact_directory.is_symlink() or not artifact_directory.is_dir():
        raise ValueError("artifact record directory must be a real directory")

    records = []
    for candidate in sorted(artifact_directory.glob("*.json")):
        try:
            if candidate.is_symlink():
                raise ValueError("artifact record path must not be a symlink")
            path = resolve_descendant(
                artifact_directory, candidate, "artifact record path",
            )
            with path.open(encoding="utf-8") as handle:
                record = ArtifactRecord.from_dict(json.load(handle))
        except (OSError, TypeError, ValueError, json.JSONDecodeError) as error:
            raise ValueError("invalid artifact record during legacy reconciliation") from error
        if path.name != f"{record.id}.json":
            raise ValueError("artifact record filename does not match its ID")
        records.append((path, record))
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
    master_root = root / "master"
    complete_scan = False
    try:
        before_scan = master_root.lstat()
    except FileNotFoundError:
        before_scan = None
    records = inventory_legacy_assets(master_root, status_rules)
    try:
        after_scan = master_root.lstat()
    except FileNotFoundError:
        after_scan = None
    if before_scan is not None and after_scan is not None:
        complete_scan = (
            stat_module.S_ISDIR(before_scan.st_mode)
            and stat_module.S_ISDIR(after_scan.st_mode)
            and (before_scan.st_dev, before_scan.st_ino)
            == (after_scan.st_dev, after_scan.st_ino)
        )
    prior_records = _artifact_records(root)
    current_ids = {record.id for record in records}
    for _, prior in prior_records:
        if prior.id in current_ids and prior.kind != "legacy_scene":
            raise ValueError(
                f"legacy inventory ID collides with non-legacy artifact: {prior.id}"
            )
    for record in records:
        write_record(root, "artifacts", record)
    if complete_scan:
        for path, record in prior_records:
            if record.kind == "legacy_scene" and record.id not in current_ids:
                path.unlink()

    counts: dict[str, int] = {}
    for record in records:
        counts[record.status] = counts.get(record.status, 0) + 1
    return LegacyReport(
        discovered=len(records),
        written=len(records),
        status_counts=tuple(sorted(counts.items())),
        artifact_records=records,
    )
