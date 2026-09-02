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

if __name__ == "__main__":
    test_cases(); test_pua_dir_names(); test_case_fold_key(); print("naming tests: OK")
