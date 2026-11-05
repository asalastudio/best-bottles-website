"""The Empire, Grace and Diamond dip tubes: the regenerated Round tubes of the same fitment type, as Diva's
(scripts/diva-vial/diva-tubes.py): 78 ml for Empire 50, Grace 55 and Diamond 60 ml, 128 ml for Empire 100 ml.
seat-and-tubes.py fits each to the register tube's place in the kit, so its length follows each glass.
Writes public/local-kits/egd-masters-2026-11-04/tubes/tubes.json.
Usage: python3 scripts/empire-grace-diamond/tubes.py
"""
import json, os

ROUND = json.load(open("public/local-kits/round-sleek-masters-2026-11-03/tubes/tubes.json"))
SOURCE = {"empire50": "round78", "empire100": "round128", "grace55": "round78", "diamond60": "round78"}
OUT = "public/local-kits/egd-masters-2026-11-04/tubes/tubes.json"

os.makedirs(os.path.dirname(OUT), exist_ok=True)
tubes = {f"{size}-{kind}": {**ROUND[f"{src}-{kind}"], "sharedFrom": f"{src}-{kind}"}
         for size, src in SOURCE.items() for kind in ("spray", "lotion", "atomizer")}
json.dump(tubes, open(OUT, "w"), indent=1)
print(len(tubes), "Empire/Grace/Diamond tube entries")
