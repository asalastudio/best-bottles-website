"""A blob count must not be allowed to assert that a cap was removed."""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "scripts" / "paperdoll"))
from dedupe import demote_lone_blob_guess


def stem(states):
    return {"stems": ["x"], "states": states, "role": "bottle"}


def rec(evidence, chosen="a" * 64):
    return {"chosen": chosen, "chosenPath": "p.psd", "chosenLibrary": "master", "stateEvidence": evidence}


def test_lone_blob_guess_becomes_unknown():
    """An atomizer photographs as three objects. Nothing was taken off it."""
    entry = stem({"off": rec("blob-count:3")})
    assert demote_lone_blob_guess(entry) is True
    assert "off" not in entry["states"]
    assert entry["states"]["unknown"]["stateEvidence"] == "unknown-from-blob-count:3"
    assert entry["states"]["unknown"]["demotedFrom"] == "off"


def test_explicit_evidence_is_never_demoted():
    """A filename or curated folder outranks a guess and keeps its meaning."""
    entry = stem({"off": rec("explicit")})
    assert demote_lone_blob_guess(entry) is False
    assert set(entry["states"]) == {"off"}


def test_a_real_capped_source_leaves_the_guess_alone():
    """With a capped source present the 'off' label is harmless and still useful."""
    entry = stem({"off": rec("blob-count:2", "b" * 64), "on": rec("explicit")})
    assert demote_lone_blob_guess(entry) is False
    assert set(entry["states"]) == {"off", "on"}


def test_unchosen_states_do_not_count():
    """A state with nothing chosen is not a source."""
    entry = stem({"off": rec("blob-count:4"), "on": {"chosen": None, "stateEvidence": "explicit"}})
    assert demote_lone_blob_guess(entry) is True
    assert set(entry["states"]) == {"unknown", "on"}


def test_idempotent():
    entry = stem({"off": rec("blob-count:5")})
    assert demote_lone_blob_guess(entry) is True
    assert demote_lone_blob_guess(entry) is False
