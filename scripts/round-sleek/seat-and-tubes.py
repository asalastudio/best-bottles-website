"""Seat every Round 78/128 ml and Sleek 30/50/100 ml closure and draw the PSD dip tubes: the Circle treatment
(scripts/circle-boston/seat-and-tubes.py) with this family's paths and SKU patterns.

The tubes are fitted to the register tube's place (TUBE_ANCHOR "register"): these PSDs' bottle layers cannot place
them (see psd-tubes.py). Run after build-kits.mts and psd-tubes.py.
Usage: python3 scripts/round-sleek/seat-and-tubes.py
"""
import importlib.util, re

spec = importlib.util.spec_from_file_location("circle_seat", "scripts/circle-boston/seat-and-tubes.py")
C = importlib.util.module_from_spec(spec); spec.loader.exec_module(C)

C.KITS = "public/local-kits/round-sleek-masters-2026-11-03/kits.json"
C.TUBES = "public/local-kits/round-sleek-masters-2026-11-03/tubes/tubes.json"
C.FROST_DIR = "public/local-kits/round-sleek-masters-2026-11-03/droppers"
C.DROPPER = re.compile(r"GB(?:Rnd|Slk)(?:Frst)?(?:128|30)Drp(Cu|Gl|Sl)$")
C.BULB = re.compile(r"GB(?:Rnd|Slk)(?:Frst)?(?:78|128|30|50|100)(AnSpTsl|AnSp)(\w+)$")
C.TUBE_ANCHOR = "register"
C.tube_key = lambda kit: kit["register"]["bodyId"].removesuffix("-18-415").replace("ml", "").replace("-", "")   # round78, sleek30

if __name__ == "__main__":
    C.main()
