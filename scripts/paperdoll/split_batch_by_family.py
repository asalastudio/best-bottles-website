#!/usr/bin/env python3
"""Split one assembled batch into per-family batches for part mapping.

family_part_map.py learns the shape of the glass from the batch it is given: a
median aspect and a set of body dimensions taken across every master in it. That
is sound for one family, where the same glass photograph recurs across its SKUs,
and meaningless across a hundred — a Sleek body and a Cream Jar body have
nothing to say about each other.

The plates and their registration stay where they are; each family batch points
at them, so nothing is copied and no hash can drift.

    python3 scripts/paperdoll/split_batch_by_family.py --batch BATCH --out-root BATCH/families
"""
import argparse, json, os, re
from collections import defaultdict
from pathlib import Path

ap = argparse.ArgumentParser(description=__doc__)
ap.add_argument('--batch', type=Path, required=True)
ap.add_argument('--out-root', type=Path)
args = ap.parse_args()

batch = args.batch.resolve()
out_root = (args.out_root or batch / 'families').resolve()
manifest = json.loads((batch / 'plates/manifest.json').read_text())
snapshot = json.loads((batch / 'input/convex-snapshot.json').read_text())
xref = json.loads((batch / 'input/xref.json').read_text())
products = {p['websiteSku']: p for p in snapshot['products']}
xrows = {x['websiteSku']: x for x in xref['products']}

# the family is the familyId up to its capacity: "sleek-30ml-clear-18-415" → "sleek",
# "cream-jar-60ml-frosted-58mm" → "cream-jar", "boston-round-30ml-..." → "boston-round"
def family_of(family_id: str) -> str:
    head = re.split(r'-\d', family_id, maxsplit=1)[0]
    return head or family_id

groups = defaultdict(list)
for row in manifest['rows']:
    groups[family_of(row['familyId'])].append(row)

out_root.mkdir(parents=True, exist_ok=True)
for family, rows in sorted(groups.items()):
    d = out_root / family
    (d / 'input').mkdir(parents=True, exist_ok=True)
    # The family batch needs its own manifest but must read the same plate
    # bytes and the same registration the solver proved, so each familyId
    # folder is linked rather than copied.
    plates = d / 'plates'
    plates.mkdir(exist_ok=True)
    for family_id in sorted({r['familyId'] for r in rows}):
        link = plates / family_id
        if link.is_symlink():
            link.unlink()
        elif link.exists():
            raise SystemExit(f"{link} exists and is not the link this writes")
        link.symlink_to(os.path.relpath(batch / 'plates' / family_id, plates))
    (plates / 'manifest.json').write_text(json.dumps({'builder': 'split_batch_by_family.py', 'rows': rows}, indent=1))
    (d / 'input/convex-snapshot.json').write_text(json.dumps(
        {'products': [products[r['websiteSku']] for r in rows if r['websiteSku'] in products]}, indent=1))
    (d / 'input/xref.json').write_text(json.dumps(
        {'products': [xrows[r['websiteSku']] for r in rows if r['websiteSku'] in xrows]}, indent=1))
    print(f"{family:24s} {len(rows):5d}")
print(f"\n{len(groups)} families -> {out_root}")
