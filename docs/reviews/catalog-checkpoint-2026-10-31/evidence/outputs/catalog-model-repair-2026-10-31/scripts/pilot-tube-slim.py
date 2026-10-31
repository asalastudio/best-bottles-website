import bpy,json,sys
from pathlib import Path
r=Path(sys.argv[sys.argv.index('--')+1]).resolve();src=r/'renders/final/sku-variants/priority-sleek5--spray-matte-black/review-scene.blend';bpy.ops.wm.open_mainfile(filepath=str(src),load_ui=False,use_scripts=False);s=bpy.context.scene;changes=[]
for o in s.objects:
 if o.type!='MESH' or 'dip tube' not in o.name.lower() or 'barb' in o.name.lower():continue

 for v in o.data.vertices:
  rad=(v.co.x*v.co.x+v.co.y*v.co.y)**.5
  if rad>.0005:v.co.x*=.000525/rad;v.co.y*=.000525/rad
 o.data.update()
 old=o.data.materials[0];m=old.copy();m.name='Review | translucent polyethylene tube';o.data.materials[0]=m
 for n in m.node_tree.nodes:
  if n.type=='BSDF_PRINCIPLED':n.inputs['Transmission Weight'].default_value=1;n.inputs['Roughness'].default_value=.12;n.inputs['Base Color'].default_value=(.98,.98,.98,1);n.inputs['IOR'].default_value=1.49
 changes.append({'object':o.name,'sourceMaterial':old.name,'newMaterial':m.name,'outsideDiameterMm':1.05,'boreMm':.6365,'qualification':'photo-matched visual refinement, not caliper measurement'})
d=r/'renders/pilots/tube-slim';d.mkdir(parents=True,exist_ok=True);s.render.filepath=str(d/'sleek5-transparent.png');s.cycles.samples=96;prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='METAL';prefs.kernel_optimization_level='OFF';prefs.get_devices()
for dvc in prefs.devices:dvc.use=dvc.type=='METAL'
s.cycles.device='GPU';bpy.ops.wm.save_as_mainfile(filepath=str(r/'working/pilots/sleek5-tube-slim.blend'),compress=True);bpy.ops.render.render(write_still=True);(d/'pilot.json').write_text(json.dumps(changes,indent=2));print('TUBE_PILOT_COMPLETE',flush=True)
