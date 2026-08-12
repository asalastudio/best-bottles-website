"""Integrity checks required before a paper-doll artifact may be protected."""

from __future__ import annotations

from dataclasses import replace
from datetime import datetime
import hashlib
import os
from pathlib import Path
import re
import stat as stat_module
from urllib.parse import unquote_to_bytes, urlsplit

from .models import (
    APPROVAL_SCOPES,
    ARTIFACT_STATUSES,
    SCHEMA_VERSION,
    ArtifactRecord,
)


CHUNK_SIZE = 1024 * 1024
_SHA256 = re.compile(r"[0-9a-f]{64}\Z")
_INVALID_PERCENT_ESCAPE = re.compile(r"%(?![0-9a-fA-F]{2})")
_RAW_URI_PATH = re.compile(r"/[A-Za-z0-9._~!$&'()*+,;=:@/%-]*\Z")


def _sha256(value: object, field_name: str) -> str:
    if not isinstance(value, str) or _SHA256.fullmatch(value) is None:
        raise ValueError(f"{field_name} must be a lowercase SHA-256 hex digest")
    return value


def _aware_timestamp(value: object, field_name: str) -> str:
    if not isinstance(value, str) or not value:
        raise ValueError(f"{field_name} must be a timezone-aware ISO-8601 timestamp")
    normalized = value[:-1] + "+00:00" if value.endswith("Z") else value
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError as error:
        raise ValueError(
            f"{field_name} must be a timezone-aware ISO-8601 timestamp"
        ) from error
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise ValueError(f"{field_name} must include a timezone offset")
    return value


def _file_path(uri: object) -> Path:
    """Parse an absolute local file URI without accepting ambiguous forms."""
    if (
        not isinstance(uri, str)
        or not uri
        or uri != uri.strip()
        or any(character.isspace() for character in uri)
    ):
        raise ValueError("artifact URI must be a non-empty, whitespace-free file URI")
    if _INVALID_PERCENT_ESCAPE.search(uri):
        raise ValueError("artifact URI has an invalid percent escape")

    parsed = urlsplit(uri)
    if (
        parsed.scheme != "file"
        or parsed.netloc
        or parsed.query
        or parsed.fragment
        or not parsed.path
    ):
        raise ValueError("only absolute file:// artifact URIs are supported")

    if _RAW_URI_PATH.fullmatch(parsed.path) is None:
        raise ValueError("artifact URI path contains raw illegal characters")
    try:
        decoded_path = unquote_to_bytes(parsed.path).decode("utf-8", errors="strict")
    except UnicodeDecodeError as error:
        raise ValueError("artifact URI path must be valid UTF-8") from error
    if "\x00" in decoded_path:
        raise ValueError("artifact URI must not contain a null byte")
    path = Path(decoded_path)
    if not path.is_absolute():
        raise ValueError("artifact file URI path must be absolute")
    return path


class FileArtifactBackend:
    """Local filesystem adapter with the future backend ``open``/``stat`` surface."""

    def resolve(self, uri: str) -> Path:
        return _file_path(uri).resolve(strict=True)

    def open(self, uri: str):
        return self.resolve(uri).open("rb")

    def stat(self, uri: str):
        return self.resolve(uri).stat()


def _stream_copy(uri: str, backend: object) -> tuple[int, str] | None:
    """Return independently observed byte count and digest, or ``None`` on failure."""
    try:
        _file_path(uri)
        metadata = backend.stat(uri)
        size = getattr(metadata, "st_size")
        mode = getattr(metadata, "st_mode")
        if type(size) is not int or size < 0 or not stat_module.S_ISREG(mode):
            return None

        digest = hashlib.sha256()
        streamed_size = 0
        with backend.open(uri) as handle:
            while True:
                chunk = handle.read(CHUNK_SIZE)
                if chunk == b"":
                    break
                if not isinstance(chunk, bytes):
                    return None
                digest.update(chunk)
                streamed_size += len(chunk)
        if streamed_size != size:
            return None
        return streamed_size, digest.hexdigest()
    except Exception:
        return None


def verify_artifact_copy(uri: str, expected_sha256: str, backend: object) -> bool:
    """Return whether one local copy is a regular file with the expected digest."""
    try:
        expected_sha256 = _sha256(expected_sha256, "expected_sha256")
    except ValueError:
        return False
    observed = _stream_copy(uri, backend)
    return observed is not None and observed[1] == expected_sha256


def _validate_record(record: object) -> ArtifactRecord:
    if not isinstance(record, ArtifactRecord):
        raise ValueError("record must be an ArtifactRecord")
    if not isinstance(record.id, str) or not record.id.strip():
        raise ValueError("artifact id must be a non-empty string")
    _sha256(record.sha256, "artifact sha256")
    if type(record.size_bytes) is not int or record.size_bytes < 0:
        raise ValueError("artifact size_bytes must be a non-negative integer")
    if not isinstance(record.primary_uri, str) or not isinstance(record.mirror_uri, str):
        raise ValueError("artifact URIs must be strings")
    if record.status not in ARTIFACT_STATUSES:
        raise ValueError(f"unknown artifact status: {record.status!r}")
    if not isinstance(record.kind, str) or not record.kind.strip():
        raise ValueError("artifact kind must be a non-empty string")
    if not isinstance(record.approved_scopes, tuple):
        raise ValueError("artifact approved_scopes must be a tuple")
    if any(scope not in APPROVAL_SCOPES for scope in record.approved_scopes):
        raise ValueError("artifact has an unknown approval scope")
    if not isinstance(record.evidence_note, str) or not isinstance(record.reviewer_source, str):
        raise ValueError("artifact evidence metadata must be strings")
    if record.last_integrity_check is not None:
        _aware_timestamp(record.last_integrity_check, "last_integrity_check")
    if type(record.schema_version) is not int or record.schema_version != SCHEMA_VERSION:
        raise ValueError("artifact has an unsupported schema version")
    return record


def _resolved_path(backend: object, uri: str) -> Path:
    if not isinstance(backend, FileArtifactBackend):
        raise ValueError("only FileArtifactBackend is supported for artifact protection")
    try:
        resolved = backend.resolve(uri)
        if not resolved.is_file():
            raise ValueError("artifact URI must resolve to a regular file")
    except (OSError, TypeError, ValueError) as error:
        raise ValueError("artifact URI must resolve to an available regular file") from error
    return resolved


def protect_artifact(record: ArtifactRecord, backend: object, clock) -> ArtifactRecord:
    """Return a new protected record only after two independent copies verify."""
    record = _validate_record(record)
    try:
        checked_at = _aware_timestamp(clock(), "clock result")
    except (TypeError, ValueError) as error:
        raise ValueError("clock must return a timezone-aware ISO-8601 timestamp") from error

    primary_path = _resolved_path(backend, record.primary_uri)
    mirror_path = _resolved_path(backend, record.mirror_uri)
    try:
        same_file = os.path.samefile(primary_path, mirror_path)
    except OSError as error:
        raise ValueError("artifact copies must remain available for identity checking") from error
    if same_file:
        raise ValueError("artifact primary and mirror must be different filesystem files")

    for uri in (record.primary_uri, record.mirror_uri):
        observed = _stream_copy(uri, backend)
        if (
            observed is None
            or observed[0] != record.size_bytes
            or observed[1] != record.sha256
        ):
            raise ValueError("artifact copy does not match the recorded size and SHA-256")

    return replace(record, status="protected", last_integrity_check=checked_at)
