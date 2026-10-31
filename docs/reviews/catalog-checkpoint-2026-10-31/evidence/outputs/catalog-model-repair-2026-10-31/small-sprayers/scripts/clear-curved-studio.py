from pathlib import Path
import bpy,sys,json
OUT=Path(__file__).resolve().parents[1]
SRC=Path('/Users/jordanrichter/Documents/Codex/2026-09-24/the-image-is-clearly-the-target/outputs/cyl9-17415-studio-2026-09-30/export.py')
sys.argv=['blender','--','review'];ns={'__file__':str(SRC),'__name__':'review'};exec(compile(SRC.read_text(),str(SRC),'exec'),ns);ns['RAW']=OUT/'renders'
bpy.ops.wm.open_mainfile(filepath=str(OUT/'renders/glass-5-clear-measured-v12.blend'));s=bpy.context.scene;body=bpy.data.objects['BB_BTL_Cylinder5_measured_envelope'];geo=ns['geo'](body)
# Broad graduated source wraps across the cylinder instead of two short rectangular strips.
for name in ['Variant | left strip','Variant | right strip']:s.objects[name].hide_render=True
s.objects['Wide graduated left diffuser'].visible_glossy=True
meta=json.loads((OUT/'renders/glass-5-clear-measured-v9.json').read_text());meta.update({'sourceScene':'glass-5-clear-measured-v12.blend','geometrySha256':geo,'appearanceChanges':['Restored feathered neutral-grey side reflection cards','Replaced short rectangular strip reflections with the original broad graduated studio diffuser','Clear glass material unchanged: IOR 1.52, transmission 1, roughness 0. Cobalt unchanged.','Light path limits 32 for GPU retry'],'status':'Local cylindrical-lighting review candidate'})
assert ns['geo'](body)==geo
stem='glass-5-clear-measured-v13';ns['gpu'](s,128);bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'renders'/f'{stem}.blend'));ns['render'](s,stem,128,meta)
