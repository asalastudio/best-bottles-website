"""Conservative numeric extraction from drawing text."""

from __future__ import annotations

import re


_MEASUREMENT = re.compile(
    r"(?P<diameter>[Ø⌀])?\s*"
    r"(?P<value>\d+(?:\.\d+)?)\s*±\s*"
    r"(?P<tolerance>\d+(?:\.\d+)?)"
    r"(?:\s*(?P<unit>mm|cm|in))?",
    re.IGNORECASE,
)


def extract_measurement_candidates(text: str, page: int) -> tuple[dict, ...]:
    """Extract explicit value/tolerance pairs without assigning their meanings."""
    if page < 1:
        raise ValueError("page must be positive")

    candidates = []
    for match in _MEASUREMENT.finditer(text):
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
