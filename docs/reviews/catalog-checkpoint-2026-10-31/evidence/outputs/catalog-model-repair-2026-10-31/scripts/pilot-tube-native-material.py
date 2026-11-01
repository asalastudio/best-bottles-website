import bpy,json,sys
from pathlib import Path
r=Path(sys.argv[sys.argv.index('--')+1]).resolve();src=r/'renders/final/sku-variants/priority-sleek5--spray-matte-black/review-scene.blend';bpy.ops.wm.open_mainfile(filepath=str(src),load_ui=False,use_scripts=False);s=bpy.context.scene;changes=[]
for o in s.objects:
 if o.type!='MESH' or 'dip tube' not in o.name.lower() or 'barb' in o.name.lower():continue

 for v in o.data.vertices:
  rad=(v.co.x*v.co.x+v.co.y*v.co.y)**.5
  if rad>.0005:v.co.x*=.000525/rad;v.co.y*=.000525/rad
 o.data.update()
 old=o.data.materials[0]
 source=r/'renders/final/native-approved-studio/native-dispenser-finishes-17415-v27__scenes__mist-black-clear/review-scene.blend'
 with bpy.data.libraries.load(str(source),link=False) as (a,b):b.materials=[n for n in a.materials if n.startswith('v15 fine-mist dip tube')][:1]
 m=b.materials[0];o.data.materials[0]=m
 changes.append({'object':o.name,'sourceMaterial':old.name,'newMaterial':m.name,'outsideDiameterMm':1.05,'boreMm':.6365,'qualification':'photo-matched visual refinement, not caliper measurement'})
d=r/'renders/pilots/tube-native-material';d.mkdir(parents=True,exist_ok=True);s.render.filepath=str(d/'sleek5-transparent.png');s.cycles.samples=96;prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='METAL';prefs.kernel_optimization_level='OFF';prefs.get_devices()
for dvc in prefs.devices:dvc.use=dvc.type=='METAL'
s.cycles.device='GPU';bpy.ops.wm.save_as_mainfile(filepath=str(r/'working/pilots/sleek5-tube-native-material.blend'),compress=True);bpy.ops.render.render(write_still=True);(d/'pilot.json').write_text(json.dumps(changes,indent=2));print('TUBE_PILOT_COMPLETE',flush=True)
