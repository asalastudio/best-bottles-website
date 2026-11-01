import bpy,json,sys
from pathlib import Path
r=Path(sys.argv[sys.argv.index('--')+1]).resolve();src=r/'renders/final/sku-variants/priority-sleek5--spray-matte-black/review-scene.blend';bpy.ops.wm.open_mainfile(filepath=str(src),load_ui=False,use_scripts=False);s=bpy.context.scene;changes=[]
for o in s.objects:
 if o.type!='MESH' or 'dip tube' not in o.name.lower() or 'barb' in o.name.lower():continue
 old=o.data.materials[0];m=old.copy();m.name='Review | translucent polyethylene tube';o.data.materials[0]=m
 for n in m.node_tree.nodes:
  if n.type=='BSDF_PRINCIPLED':n.inputs['Transmission Weight'].default_value=1;n.inputs['Roughness'].default_value=.12;n.inputs['Base Color'].default_value=(.98,.98,.98,1);n.inputs['IOR'].default_value=1.49
 changes.append({'object':o.name,'sourceMaterial':old.name,'newMaterial':m.name,'ODunchanged':True})

for o in s.objects:
 if o.type=='MESH' and o.name.lower().startswith(('bb_btl','bottle')) and not o.hide_render and hasattr(o.cycles,'is_caustics_caster'):o.cycles.is_caustics_caster=True;print('CASTER',o.name,flush=True)
 if o.type=='MESH' and 'dip tube' in o.name.lower() and 'barb' not in o.name.lower() and hasattr(o.cycles,'is_caustics_receiver'):o.cycles.is_caustics_receiver=True;print('RECEIVER',o.name,flush=True)
 if o.type=='LIGHT' and hasattr(o.data.cycles,'is_caustics_light'):o.data.cycles.is_caustics_light=True;print('CAUSTIC_LIGHT',o.name,flush=True)
s.cycles.caustics_refractive=True
d=r/'renders/pilots/tube-caustics';d.mkdir(parents=True,exist_ok=True);s.render.filepath=str(d/'sleek5-transparent.png');s.cycles.samples=96;prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='METAL';prefs.kernel_optimization_level='OFF';prefs.get_devices()
for dvc in prefs.devices:dvc.use=dvc.type=='METAL'
s.cycles.device='GPU';bpy.ops.wm.save_as_mainfile(filepath=str(r/'working/pilots/sleek5-tube-caustics.blend'),compress=True);bpy.ops.render.render(write_still=True);(d/'pilot.json').write_text(json.dumps(changes,indent=2));print('TUBE_PILOT_COMPLETE',flush=True)
