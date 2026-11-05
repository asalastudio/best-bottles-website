"""Seat every Empire, Grace and Diamond closure and its dip tube: the Circle treatment (scripts/circle-boston/
seat-and-tubes.py) with these families' paths and SKU patterns, set the way Diva's were approved (3-4 Nov 2026):
- reducers take the Elegant 60 ml reviewed 18-415 insert and plug, so their pages offer cap off and exploded;
- the 50 ml Empire droppers lift the complete 18-415 dropper in EXPLODED, no glass pipette seen inside the glass;
- the dip tube shows only lifted out in EXPLODED (as Diva: these PSDs carry no tube), fitted to the register tube's place.
Run after build-kits.mts and tubes.py.
Usage: python3 scripts/empire-grace-diamond/seat-and-tubes.py
"""
import importlib.util, re

spec = importlib.util.spec_from_file_location("circle_seat", "scripts/circle-boston/seat-and-tubes.py")
C = importlib.util.module_from_spec(spec); spec.loader.exec_module(C)
C.KITS = "public/local-kits/egd-masters-2026-11-04/kits.json"
C.TUBES = "public/local-kits/egd-masters-2026-11-04/tubes/tubes.json"
C.FROST_DIR = "public/local-kits/egd-masters-2026-11-04/droppers"
C.DROPPER = re.compile(r"GBEmp50Drp(Cu|Gl|Sl)$")
C.BULB = re.compile(r"GB(?:Emp(?:50|100)|Grce55|Dmnd2oz)(AnSpTsl|AnSp)(\w+?)$")
C.TUBE_ANCHOR = "register"
C.SEATED_PIPETTE = False
C.SEATED_TUBE = False
C.tube_key = lambda kit: kit["register"]["bodyId"].removesuffix("-18-415").replace("ml", "").replace("-", "")   # empire50

if __name__ == "__main__":
    C.main()
