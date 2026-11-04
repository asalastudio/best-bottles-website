"""The Diva dip tubes: the regenerated Round tubes of the same fitment type.

No Diva PSD has a tube layer (30, 46 and 100 ml; spray, lotion and bulb files hold only the bottle, the head and the
cover). The Round tubes are the same 18-415 spray, lotion and bulb tubes, regenerated with Sunburst from the Round PSDs
(scripts/round-sleek/psd-tubes.py): 78 ml for Diva 30 and 46 ml, 128 ml for Diva 100 ml. seat-and-tubes.py fits each
to the register tube's place in the kit, so its length follows the Diva glass.
Writes public/local-kits/diva-masters-2026-11-03/tubes/tubes.json.
Usage: python3 scripts/diva-vial/diva-tubes.py
"""
import json, os

ROUND = json.load(open("public/local-kits/round-sleek-masters-2026-11-03/tubes/tubes.json"))
SOURCE = {"diva30": "round78", "diva46": "round78", "diva100": "round128"}
OUT = "public/local-kits/diva-masters-2026-11-03/tubes/tubes.json"

os.makedirs(os.path.dirname(OUT), exist_ok=True)
tubes = {f"{size}-{kind}": {**ROUND[f"{src}-{kind}"], "sharedFrom": f"{src}-{kind}"}
         for size, src in SOURCE.items() for kind in ("spray", "lotion", "atomizer")}
json.dump(tubes, open(OUT, "w"), indent=1)
print(len(tubes), "Diva tube entries")
