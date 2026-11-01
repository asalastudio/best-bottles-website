import bpy,json,sys
from pathlib import Path
r=Path(sys.argv[sys.argv.index('--')+1]).resolve()
for family in ['flair','sleek5','tulip5']:
 d=r/'working/priority-assemblies'/family;a=json.loads((d/'repair-report-v2.json').read_text());bpy.ops.wm.open_mainfile(filepath=a['workingCopy'],load_ui=False,use_scripts=False);s=bpy.context.scene
 body=next(o for o in s.objects if o.type=='MESH' and o.name.startswith('Bottle |'));ref=next(o for o in s.objects if o.name.startswith('REFERENCE ONLY'))
 mat=ref.data.materials[0].copy();mat.name='Review glass | '+family
 if family=='tulip5':
  for n in mat.node_tree.nodes:
   if n.type=='VOLUME_ABSORPTION':n.inputs['Color'].default_value=(.5834,.2893,.0476,1);n.inputs['Density'].default_value=1887.8
 body.data.materials.clear();body.data.materials.append(mat)
 for p in body.data.polygons:p.material_index=0
 for c in ref.users_collection:
  if body.name not in c.objects:c.objects.link(body)
 for light in s.objects:
  if light.type=='LIGHT' and light.light_linking.receiver_collection:
   c=light.light_linking.receiver_collection
   if ref.name in c.objects and body.name not in c.objects:c.objects.link(body)
 a['changes'].append({'code':'MATERIAL-SLOT','detail':'Assigned optical glass to every rebuilt body polygon after boolean operations; copied native glass light-link memberships. Tulip uses approved v34 amber optical absorption.'});a['workingCopy']=str(d/'model-v3.blend');a['material']=mat.name;bpy.ops.wm.save_as_mainfile(filepath=a['workingCopy'],compress=True);(d/'repair-report-v3.json').write_text(json.dumps(a,indent=2));print('MATERIAL_REPAIRED',family,flush=True)
