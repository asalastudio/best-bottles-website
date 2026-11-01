import bpy,json,sys
from pathlib import Path
r=Path(sys.argv[sys.argv.index('--')+1]).resolve()
for f in (r/'working/dropper-assemblies').glob('*/repair-report-v8.json'):
 a=json.loads(f.read_text());d=f.parent;src=Path(a['bodySource']).parent/'repair-report-v11.json'
 if not src.exists():continue
 b=json.loads(src.read_text());assert b['disposition']!='rejected refinement';bpy.ops.wm.open_mainfile(filepath=a['workingCopy'],load_ui=False,use_scripts=False);o=next(o for o in bpy.context.scene.objects if o.type=='MESH' and o.name.startswith('BB_BTL') and not o.hide_render);mats=list(o.data.materials)
 with bpy.data.libraries.load(b['workingCopy'],link=False) as (data,dst):dst.objects=[n for n in data.objects if n.lower().startswith(('bottle','bb_btl'))][:1]
 n=dst.objects[0];o.data=n.data.copy();o.matrix_world=n.matrix_world.copy();o.data.materials.clear()
 for m in mats:o.data.materials.append(m)
 for p in o.data.polygons:p.material_index=0
 bpy.data.objects.remove(n,do_unlink=True);a['bodySource']=b['workingCopy'];a['workingCopy']=str(d/'model-neck-v11.blend');a['changes'].append({'code':'NECK-OVERHANG','detail':'Updated the body to the closed native-finish transition; removed the donor shoulder overhang while retaining pipette and closure positions.'});bpy.ops.wm.save_as_mainfile(filepath=a['workingCopy'],compress=True);(d/'repair-report-v11.json').write_text(json.dumps(a,indent=2));print('DEPENDENT_REPAIRED',a['id'],flush=True)
for h in ['117x32','154x35']:
 d=r/'working/legacy'/('glb-bodies-thickness__Cyl-round-18-415-'+h);src=r/'working/legacy'/('glb-bodies__Cyl-round-18-415-'+h)/'repair-report-v11.json';a=json.loads((d/'repair-report-v3.json').read_text());b=json.loads(src.read_text());bpy.ops.wm.open_mainfile(filepath=b['workingCopy'],load_ui=False,use_scripts=False);a['workingCopy']=str(d/'model-neck-v11.blend');a['changes'].append({'code':'BROKEN-JOIN-FINISH','detail':'Replaced the earlier traced-neck fallback with the repaired matching exterior and continuous native 18-415 finish.'});a['checks']=b['checks'];a['inferred']+=b['inferred'];a['disposition']=b['disposition'];bpy.ops.wm.save_as_mainfile(filepath=a['workingCopy'],compress=True);bpy.ops.object.select_all(action='DESELECT');o=next(o for o in bpy.context.scene.objects if o.type=='MESH');o.select_set(True);bpy.ops.export_scene.gltf(filepath=str(d/'model-neck-v11.glb'),export_format='GLB',use_selection=True,export_materials='NONE');(d/'repair-report-v11.json').write_text(json.dumps(a,indent=2));print('THICKNESS_REPAIRED',a['id'],flush=True)
print('DEPENDENTS_COMPLETE',flush=True)
