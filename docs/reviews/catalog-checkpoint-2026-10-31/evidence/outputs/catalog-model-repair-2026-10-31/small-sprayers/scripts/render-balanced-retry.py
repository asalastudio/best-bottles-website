from pathlib import Path
import bpy,sys,json
OUT=Path(__file__).resolve().parents[1]
SRC=Path('/Users/jordanrichter/Documents/Codex/2026-09-24/the-image-is-clearly-the-target/outputs/cyl9-17415-studio-2026-09-30/export.py')
sys.argv=['blender','--','review'];ns={'__file__':str(SRC),'__name__':'review'};exec(compile(SRC.read_text(),str(SRC),'exec'),ns);ns['RAW']=OUT/'renders'
bpy.ops.wm.open_mainfile(filepath=str(OUT/'renders/glass-5-clear-measured-v12.blend'));s=bpy.context.scene
s.cycles.max_bounces=32;s.cycles.glossy_bounces=32;s.cycles.transmission_bounces=32;s.cycles.transparent_max_bounces=32
meta=json.loads((OUT/'renders/glass-5-clear-measured-v9.json').read_text());meta.update({'sourceScene':'glass-5-clear-measured-v9.blend','appearanceChanges':['Both black side cards replaced with feathered neutral-grey reflection cards','Glass shader, IOR 1.52, transmission 1 and roughness 0 unchanged','Path limits reduced from 128 to 32 after GPU abort; no mesh or camera changes'],'status':'Local optical review candidate'})
ns['gpu'](s,128);bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'renders/glass-5-clear-measured-v12.blend'));ns['render'](s,'glass-5-clear-measured-v12',128,meta)
