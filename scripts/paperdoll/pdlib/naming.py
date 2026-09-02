"""
Stem normalisation and junk classification for the Photoshop libraries.

A "stem" is the part of a PSD filename that is (or should be) a website SKU:
`11. GBCylBlk9RollMattSl.psd` -> `GBCylBlk9RollMattSl`. The libraries were
named by hand over years, so every rule here was measured on the real files
before it was written, and every rule an inventory row went through is
recorded on the row so a match can be audited later.

Identity is never re-derived here: this module produces a candidate stem,
and the cross-reference decides whether it IS a catalogue SKU (exact or
alias-listed). Dialect drift (Sh/Shn, Mt/Matt, five spellings of ClOvrCap)
is a labelling concern for tokens.py, never a matching rewrite.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field

# SMB reserved-character mapping (macOS <-> Windows shares) leaves private-use
# characters in 51 directory names. They mean exactly one thing each.
PUA_MAP = {
    "\uf022": "/",   # slash
    "\uf028": ".",   # trailing dot
    "\uf029": " ",   # trailing space
}

VIEW_TOKENS = ("measured", "meaured", "side", "depth", "aerial")

JUNK_RULES: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("DOS_83_NAME", re.compile(r"~\d+$", re.I)),                 # 1GBBST~1
    ("CAMERA_NAME", re.compile(r"^DSC\d+", re.I)),               # DSC03954
    ("SINGLE_LETTER", re.compile(r"^[A-Za-z]$")),                # a, b, ... i
    ("BARE_NUMBER", re.compile(r"^\d+$")),                       # 8, 24
    ("PUA_SLASH", re.compile(r"/")),                             # a mapped U+F022 inside a stem
)

ORDINAL = re.compile(r"^\d+\.?\s+(?=[A-Za-z]|\d{1,2}-\d{3})")     # "11. " / "1 " only before a letter or a neck-finish prefix (8-425…)
VIEW_ORDINAL = re.compile(r"^\d(?=(GB|LB|BO)[A-Z])")             # 1GBCyl50measured, 3GBElg100Depth
COPY_SUFFIX = re.compile(r"\s*copy(\s*\d+)?$", re.I)
PAREN_SUFFIX = re.compile(r"\s*\(\d+\)$")
WHITESPACE = re.compile(r"\s+")


@dataclass
class StemResult:
    stem: str
    stem_key: str
    normalisations: list[str] = field(default_factory=list)
    junk_reason: str | None = None
    view_token: str | None = None


def map_pua(name: str) -> str:
    """Map the SMB private-use characters to what they stood for. Applied to directory and file names."""
    out = unicodedata.normalize("NFC", name)
    for pua, plain in PUA_MAP.items():
        out = out.replace(pua, plain)
    return out


def normalise_stem(filename: str, *, is_view_folder: bool = False, known_prefixes: tuple[str, ...] = ()) -> StemResult:
    """Turn a filename into a candidate stem, recording every step."""
    steps: list[str] = []
    base = filename
    for ext in (".psd", ".PSD", ".png", ".PNG", ".jpg", ".JPG"):
        if base.endswith(ext):
            base = base[: -len(ext)]
            break
    mapped = map_pua(base)
    if mapped != base:
        steps.append("pua")
    stem = mapped

    def strip_suffixes(value: str) -> str:
        # "copy", "copy 7", "(2)" and "copy(2)" stack in every order; strip until stable
        while True:
            stripped = PAREN_SUFFIX.sub("", COPY_SUFFIX.sub("", value)).rstrip(". ")
            if stripped == value:
                return value
            value = stripped

    # suffixes first, so "24 copy" is the bare number 24 and not an ordinal before "copy"
    before = stem
    stem = strip_suffixes(stem)
    if stem != before:
        steps.append("copy-suffix")

    if ORDINAL.match(stem):
        stem = ORDINAL.sub("", stem, count=1)
        steps.append("ordinal")

    view_token = None
    low = stem.lower()
    for token in VIEW_TOKENS:
        if low.endswith(token):
            view_token = "measured" if token == "meaured" else token
            break
    if (is_view_folder or view_token) and VIEW_ORDINAL.match(stem):
        stem = VIEW_ORDINAL.sub("", stem, count=1)
        steps.append("view-ordinal")

    before = stem
    stem = WHITESPACE.sub(" ", stem.rstrip(". ").strip())
    if stem != before:
        steps.append("trailing-punct")

    junk = classify_junk(stem, known_prefixes)
    return StemResult(stem=stem, stem_key=stem.casefold(), normalisations=steps, junk_reason=junk, view_token=view_token)


def classify_junk(stem: str, known_prefixes: tuple[str, ...] = ()) -> str | None:
    if not stem:
        return "EMPTY"
    for reason, pattern in JUNK_RULES:
        if pattern.search(stem):
            return reason
    if " " in stem:
        return "DESCRIPTIVE_NAME"                                  # "Circle 100ml frst", "Plastic funnel"
    if known_prefixes and not any(stem.startswith(prefix) for prefix in known_prefixes):
        return "NO_SKU_PREFIX"
    return None


def strip_ring(stem: str) -> str:
    """The decorative-ring modifier is a variant of the same photograph family; matching keeps it, labels strip it."""
    return re.sub(r"Rng$", "", stem)
