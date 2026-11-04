"""Seat every Diva closure and draw its dip tube: the Circle treatment (scripts/circle-boston/seat-and-tubes.py) with
Diva's paths and SKU patterns. Tubes are fitted to the register tube's place (TUBE_ANCHOR "register").
Run after build-kits.mts, diva-ring-kits.py and diva-tubes.py.
Usage: python3 scripts/diva-vial/seat-and-tubes.py
"""
import importlib.util, re

spec = importlib.util.spec_from_file_location("circle_seat", "scripts/circle-boston/seat-and-tubes.py")
C = importlib.util.module_from_spec(spec); spec.loader.exec_module(C)

C.KITS = "public/local-kits/diva-masters-2026-11-03/kits.json"
C.TUBES = "public/local-kits/diva-masters-2026-11-03/tubes/tubes.json"
C.FROST_DIR = "public/local-kits/diva-masters-2026-11-03/droppers"
C.DROPPER = re.compile(r"GBDiva(?:Frst)?46Drp(Cu|Gl|Sl)$")
C.BULB = re.compile(r"GBDiva(?:Frst)?(?:30|46|100)(AnSpTsl|AnSp)(\w+?)(?:Rng)?$")
C.TUBE_ANCHOR = "register"
C.tube_key = lambda kit: kit["register"]["bodyId"].removesuffix("-18-415").replace("ml", "").replace("-", "")   # diva46

if __name__ == "__main__":
    C.main()
