from pathlib import Path
import json,html
r=Path('/Users/jordanrichter/Projects/Asala/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/.claude/worktrees/branch-setup-localhost-c1fea9/outputs/catalog-model-repair-2026-10-31')
q=json.loads((r/'sources/audit-queue.json').read_text());d=r/'reports/geometry-comparisons';d.mkdir(exist_ok=True)
for page in range(0,len(q),8):
 cards=''
 for a in q[page:page+8]:
  before=r/'renders/before'/('geometry-native-v2' if a['kind']=='blend' else 'geometry')/(a['id']+'.png')
  after=r/'working/legacy'/a['id']/'geometry-after.png' if a['kind']=='glb' else r/'renders/after/geometry-native'/(a['id']+'.png')
  v2=r/'working/legacy'/a['id']/'geometry-after-v2.png'
  if v2.exists() and 'ANSP_BULB' not in a['id']:after=v2
  selected=r/'renders/after/geometry-selected'/(a['id']+'.png')
  if selected.exists():after=selected
  note='Working mesh. See numeric tube tests; opaque clay hides internals.' if a['kind']=='blend' else 'Before / repaired working copy'
  cards+=f'<article><div class="pair"><img src="{before.as_uri()}"><img src="{after.as_uri()}"></div><p>{html.escape(a["id"])}</p><small>{note}</small></article>'
 (d/f'geometry-{page//8+1:02}.html').write_text(f'<html><style>body{{margin:16px;background:#f5f3ef;font:12px system-ui}}h1{{font-size:20px}}section{{display:grid;grid-template-columns:repeat(2,520px);gap:12px}}article{{background:white;padding:5px}}.pair{{display:flex}}img{{width:250px;height:312px;object-fit:contain}}p{{overflow-wrap:anywhere;margin:3px}}small{{color:#666}}</style><h1>Geometry review {page//8+1} — before / after</h1><section>{cards}</section></html>')
print('Saved',len(list(d.glob('*.html'))),'comparison sheets')
