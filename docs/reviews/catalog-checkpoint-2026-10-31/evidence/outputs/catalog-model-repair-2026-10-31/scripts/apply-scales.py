import bpy,json,sys
from pathlib import Path
r=Path(sys.argv[sys.argv.index('--')+1]).resolve()
paths=list((r/'working/native').glob('*/repair-report.json'))+list((r/'working/priority-assemblies').glob('*/repair-report.json'))
for f in paths:
 a=json.loads(f.read_text());ident=a['id']
 if not ('cyl5' in ident or ident.startswith('priority-')):continue
 bpy.ops.wm.open_mainfile(filepath=a['workingCopy'],load_ui=False,use_scripts=False);changed=[]
 for o in bpy.context.scene.objects:
  if o.type=='MESH' and any(c.name.startswith('Sheet |') for c in o.users_collection) and max(abs(v-1) for v in o.scale)>1e-6:
   bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;old=list(o.scale);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);changed.append({'object':o.name,'oldScale':old,'newScale':list(o.scale),'worldGeometry':'unchanged'})
 if changed:
  a.setdefault('changes',[]).append({'code':'APPLIED-SCALE','objects':changed});a['workingCopy']=str(f.parent/'model-v2.blend');bpy.ops.wm.save_as_mainfile(filepath=a['workingCopy'],compress=True);(f.parent/'repair-report-v2.json').write_text(json.dumps(a,indent=2));print('SCALE_APPLIED',ident,len(changed),flush=True)
print('SCALE_REPAIR_COMPLETE',flush=True)
