"""Conservative numeric extraction from drawing text."""

from __future__ import annotations

import re


_MEASUREMENT = re.compile(
    r"(?<![-−\d.])(?P<diameter>[Ø⌀])?\s*"
    r"(?P<value>\d+(?:\.\d+)?)\s*±\s*"
    r"(?P<tolerance>\d+(?:\.\d+)?)"
    r"(?!\s*(?:mm|cm|in)[\d.A-Za-z])"
    r"(?:\s*(?P<unit>mm|cm|in))?"
    r"(?![\d.A-Za-z])",
    re.IGNORECASE,
)


def _has_malformed_prefix(text: str, start: int) -> bool:
    """Reject a numeric suffix embedded in a malformed numeric token."""
    prefix = text[:start]
    if prefix and (
        (prefix[-1].isalnum() and prefix[-1] not in "Ø⌀")
        or prefix[-1] in ".-−"
    ):
        return True
    return bool(re.search(r"[-−]\s+$", prefix))


def extract_measurement_candidates(text: str, page: int) -> tuple[dict, ...]:
    """Extract explicit value/tolerance pairs without assigning their meanings."""
    if page < 1:
        raise ValueError("page must be positive")

    candidates = []
    for match in _MEASUREMENT.finditer(text):
        if _has_malformed_prefix(text, match.start("value")):
            continue
        candidates.append({
            "page": page,
            "raw_text": match.group(0),
            "value": float(match.group("value")),
            "tolerance": float(match.group("tolerance")),
            "unit": match.group("unit"),
            "diameter_mark": match.group("diameter") is not None,
            "semantic_field": None,
            "status": "candidate",
        })
    return tuple(candidates)
