from pathlib import Path
import bpy,sys,json,hashlib
OUT=Path(__file__).resolve().parents[1]
SRC=Path('/Users/jordanrichter/Documents/Codex/2026-09-24/the-image-is-clearly-the-target/outputs/cyl9-17415-studio-2026-09-30/export.py')
sys.argv=['blender','--','review'];ns={'__file__':str(SRC),'__name__':'review'};exec(compile(SRC.read_text(),str(SRC),'exec'),ns);ns['RAW']=OUT/'renders'
source=OUT/'renders/glass-5-clear-measured-v9.blend'
for version in [10,11]:
 bpy.ops.wm.open_mainfile(filepath=str(source));s=bpy.context.scene;o=bpy.data.objects['BB_BTL_Cylinder5_measured_envelope'];geo=ns['geo'](o);meta=json.loads((OUT/'renders/glass-5-clear-measured-v9.json').read_text());changes=[]
 if version==10:
  for m in o.data.materials:
   for n in m.node_tree.nodes:
    if n.type=='BSDF_PRINCIPLED':n.inputs['Roughness'].default_value=.045
  changes=['Glass roughness 0 -> 0.045; IOR 1.52 and all geometry, lights, camera unchanged']
 else:
  # Remove only redundant narrow negative-fill cards; retain approved studio and backdrop.
  for name in ['Variant | side black card +1','Variant | side black card -1']:
   s.objects[name].hide_render=True
  changes=['Hide supplemental Variant side black cards; original studio flags remain; geometry, IOR, roughness and camera unchanged']
 stem=f'glass-5-clear-measured-v{version}'
 meta.update({'sourceScene':str(source),'geometrySha256':geo,'appearanceChanges':changes,'status':'optical review candidate; not staged'})
 assert ns['geo'](o)==geo
 ns['gpu'](s,128);bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'renders'/f'{stem}.blend'));ns['render'](s,stem,128,meta)
 print('DONE',stem,changes,flush=True)
