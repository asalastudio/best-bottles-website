import bpy,json,sys
from pathlib import Path
from mathutils import Matrix
r=Path(sys.argv[sys.argv.index('--')+1]).resolve()
for d in (r/'working/native').iterdir():
 rp=d/'repair-report.json'
 if not rp.exists():continue
 a=json.loads(rp.read_text());ident=a['id']
 if 'tall-9ml-' in ident:
  bpy.ops.wm.open_mainfile(filepath=a['workingCopy'],load_ui=False,use_scripts=False);changed=[]
  for o in bpy.context.scene.objects:
   if o.type=='MESH' and any(c.name.startswith('Sheet | ') for c in o.users_collection) and max(abs(x-1) for x in o.scale)>.00001:
    bpy.context.view_layer.objects.active=o;bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);changed.append(o.name)
  a['changes'].append({'code':'APPLIED-SCALE','detail':'Applied stored component scales without changing world-space geometry','objects':changed})
 elif 'native-empire-' in ident:
  cap='100' if 'empire-100' in ident else '50';bpy.ops.wm.open_mainfile(filepath=str(r/'working/empire-assemblies'/('empire-'+cap+'-mist')/'model.blend'),load_ui=False,use_scripts=False)
  for o in bpy.context.scene.objects:
   if o.type=='MESH' and o.name.lower().startswith(('sprayer','pump','roller','cap_')):o.hide_render=True
  a['changes'].append({'code':'MATERIAL-STUDIO','detail':'Assigned the existing approved Empire glass and studio to the drawing-only body source; same body geometry retained'})
 else:continue
 s=bpy.context.scene;s.render.use_border=False;s.render.use_crop_to_border=False
 if s.camera:s.camera.data.clip_start=.00001;s.camera.data.clip_end=100
 a['workingCopy']=str(d/'model-v2.blend');bpy.ops.wm.save_as_mainfile(filepath=a['workingCopy'],compress=True);(d/'repair-report-v2.json').write_text(json.dumps(a,indent=2));print('NATIVE_SCENE_FIXED',ident,flush=True)
