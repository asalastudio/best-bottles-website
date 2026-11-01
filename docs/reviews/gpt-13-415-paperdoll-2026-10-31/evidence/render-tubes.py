import bpy,json,math,sys
from pathlib import Path
from mathutils import Vector
ROOT=Path.cwd(); OUT=ROOT/'outputs/catalog-model-repair-2026-10-31/13-415-gpt-paperdoll';(OUT/'renders').mkdir(exist_ok=True)
src=ROOT/'docs/reviews/dip-tube-followup-2026-10-31/evidence/render-tubes.py'
code=src.read_text()
code=code.replace("OUT=Path.cwd()/'outputs/catalog-model-repair-2026-10-31/dip-tube-followup'","OUT=Path.cwd()/'outputs/catalog-model-repair-2026-10-31/13-415-gpt-paperdoll'")
kits=json.loads((OUT/'kits-before.json').read_text()); specs={}
for k in kits.values():
 if not any(p['slot']=='sprayer' for p in k['parts']):continue
 b=next(p for p in k['parts'] if p['slot']=='body')
 h=(b['bounds']['bottom']-k['anchors']['seatY'])/k['anchors']['pxPerMm']
 specs[k['register']['bodyId']]=round(h,4)
jobs=[(h,id,1.1,.7,1.2 if h<70 else 1.6) for id,h in specs.items()]
(OUT/'tube-specs.json').write_text(json.dumps({'acceptance':'visual-production candidate','units':'mm','specs':specs,'outerDiameter':1.1,'innerDiameter':.7,'floorThickness':1.6,'tipHeight':3.5,'assumptions':'Pump internals, tube OD/bore, bend, floor and clearance are visual estimates. Length follows existing registered rim-to-foot span. No bottle geometry or source image changes.'},indent=2))
code=code.replace("[(66,'sleek-8',1.1,.7,1.5),(73,'round-78',1.5,1.0,2.0)]",repr(jobs))
code=code.replace("ns['gpu'](s,96)","ns['gpu'](s,48)").replace("ns['render'](s,f'mechanism-{label}-v1',96,meta)","ns['render'](s,f'mechanism-{label}-v1',48,meta)")
code=code.replace("bpy.ops.wm.save_as_mainfile", "bpy.ops.wm.save_as_mainfile")
exec(compile(code,str(src),'exec'))
