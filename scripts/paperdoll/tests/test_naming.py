"""Table-driven cases, every one taken from a real file in the libraries (inventory 2026-09-01)."""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from pdlib.naming import normalise_stem, map_pua

PREFIXES = ("GB", "LB", "CP", "AnSp", "Drp", "CJ", "Alu", "PB", "GBV", "8-425", "18-415", "13-415", "Spry", "Ltn")

CASES = [
    # filename, expected stem, expected junk, expected view token
    ("11. GBCylBlk9RollMattSl.psd", "GBCylBlk9RollMattSl", None, None),
    ("GBSQSTGREEN...psd", "GBSQSTGREEN", None, None),
    ("2. GBCyl50RdcrShnBlkTall copy.psd", "GBCyl50RdcrShnBlkTall", None, None),
    ("GBhalfozApthBl. copy.psd", "GBhalfozApthBl", None, None),
    ("42. GBCyl100AnSpTslLvn..psd", "GBCyl100AnSpTslLvn", None, None),
    ("3. 8-425DrpShortBlack .psd", "8-425DrpShortBlack", None, None),
    ("3GBElg100Depthcopy(2).psd", "GBElg100Depth", None, "depth"),
    ("1GBSleek5Meaured.png", "GBSleek5Meaured", None, "measured"),
    ("1GBCyl50measured.psd", "GBCyl50measured", None, "measured"),
    ("1GBBST~1.PSD", "1GBBST~1", "DOS_83_NAME", None),
    ("DSC03954..psd", "DSC03954", "CAMERA_NAME", None),
    ("e.psd", "e", "SINGLE_LETTER", None),
    ("24 copy.psd", "24", "BARE_NUMBER", None),
    ("8.psd", "8", "BARE_NUMBER", None),
    ("Circle 100ml frst.psd", "Circle 100ml frst", "DESCRIPTIVE_NAME", None),
    ("Royal Side.psd", "Royal Side", "DESCRIPTIVE_NAME", "side"),
    ("Plastic funnel.psd", "Plastic funnel", "DESCRIPTIVE_NAME", None),
    ("CYL-UNK-9ML-MTL-ROLL-WHT_normalized.psd", "CYL-UNK-9ML-MTL-ROLL-WHT_normalized", "NO_SKU_PREFIX", None),
    ("48. GBDiva46AnSpTslBlk.psd", "GBDiva46AnSpTslBlk", None, None),
    ("GBDiva46AnSpTslBlkRng.psd", "GBDiva46AnSpTslBlkRng", None, None),
]

def test_cases():
    for filename, stem, junk, view in CASES:
        r = normalise_stem(filename, known_prefixes=PREFIXES)
        assert r.stem == stem, (filename, r)
        assert r.junk_reason == junk, (filename, r)
        assert r.view_token == view, (filename, r)

def test_pua_dir_names():
    assert map_pua("25. Diva (Clear) 46 ml") == "25. Diva (Clear) 46 ml "
    assert map_pua("1. Cylindrical 30ml") == "1. Cylindrical 30ml."
    assert map_pua("1. Amber Bottle (1 ounce30 ml) Roll on") == "1. Amber Bottle (1 ounce/30 ml) Roll on"

def test_case_fold_key():
    assert normalise_stem("GBCyl100RdcrShnBlkTall..psd").stem_key == "gbcyl100rdcrshnblktall"

PREFIXES_2 = PREFIXES + ("Cp", "18-400", "8-245")

CASES_2 = [
    # filename, kwargs, expected stem, expected junk, expected cap state, expected normalisation steps
    ("GBMtlCylGl (uncapped).psd", {}, "GBMtlCylGl", None, "off", ["copy-suffix", "cap-suffix:off"]),
    ("GBMtlMrblSmall )uncapped).psd", {}, "GBMtlMrblSmall", None, "off", ["copy-suffix", "cap-suffix:off"]),
    ("1. 1. GBCyl30.psd", {}, "GBCyl30", None, None, ["ordinal"]),
    ("49. GBDmnd 2ozAnSpTslMtSl.psd", {}, "GBDmnd2ozAnSpTslMtSl", None, None, ["ordinal", "internal-space"]),
    ("1. GBGrce55RdcrShnGl 2.psd", {}, "GBGrce55RdcrShnGl", None, None, ["copy-suffix", "ordinal"]),
    ("5. CpRoll17-415MattGl.psd", {}, "CpRoll17-415MattGl", None, None, ["ordinal"]),
    ("3. 18-400Drp15mlShnSlTrimBlkBulb.psd", {}, "18-400Drp15mlShnSlTrimBlkBulb", None, None, ["ordinal"]),
    ("IvoryRng.psd", {"is_component": True}, "IvoryRng", None, None, []),
    ("Plastic Roller Ball.psd", {"is_component": True}, "Plastic Roller Ball", None, None, []),
    ("29.psd", {"is_component": True}, "29", "BARE_NUMBER", None, []),
    ("Slim 30ml...psd", {}, "Slim 30ml", "DESCRIPTIVE_NAME", None, ["copy-suffix"]),
    ("Bell.psd", {}, "Bell", "NO_SKU_PREFIX", None, []),
]

def test_cases_2():
    for filename, kwargs, stem, junk, cap, steps in CASES_2:
        r = normalise_stem(filename, known_prefixes=PREFIXES_2, **kwargs)
        assert r.stem == stem, (filename, r)
        assert r.junk_reason == junk, (filename, r)
        assert r.cap_state == cap, (filename, r)
        assert r.normalisations == steps, (filename, r)

if __name__ == "__main__":
    test_cases(); test_cases_2(); test_pua_dir_names(); test_case_fold_key(); print("naming tests: OK")
