"""Deterministic identifiers for paper-doll pipeline records."""

import hashlib
import json


def canonical_json(value: object) -> str:
    """Return the canonical JSON representation used for content identity."""
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def content_hash(value: object) -> str:
    """Return the SHA-256 digest of a value's canonical JSON."""
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


def stable_id(prefix: str, value: object) -> str:
    """Return a short, deterministic identifier namespaced by ``prefix``."""
    return f"{prefix}_{content_hash(value)[:16]}"
