import bpy,json,sys,math,time,traceback,hashlib
from pathlib import Path
from mathutils import Vector,Matrix
from bpy_extras.object_utils import world_to_camera_view
r=Path(sys.argv[sys.argv.index('--')+1]).resolve();out=r/'reports/glass-body-overview';jobs=json.loads((out/'body-queue.json').read_text());dst=out/'renders';dst.mkdir(exist_ok=True)
base=r/'renders/final/native-approved-studio/native-dispenser-finishes-17415-v27__scenes__mist-black-clear/review-scene.blend'
for i,a in enumerate(jobs):
 try:
  file=dst/(a['bodyId']+'.png');meta=file.with_suffix('.json')
  if meta.exists() and json.loads(meta.read_text()).get('source')==a['source']:continue
  bpy.ops.wm.open_mainfile(filepath=str(base),load_ui=False,use_scripts=False);s=bpy.context.scene;old=next(o for o in s.objects if o.type=='MESH' and o.name.lower().startswith(('bottle','bb_btl')) and not o.hide_render);glass=old.data.materials[0]
  for o in s.objects:
   if o.type=='MESH' and (o.name.lower().startswith(('bottle','bb_btl','cap_','roller','sprayer','pump','dropper','internals |','sheet |')) or any(c.name.startswith('Sheet | ') for c in o.users_collection)):o.hide_render=True
  with bpy.data.libraries.load(a['source'],link=False) as (src,data):
   names=[n for n in src.objects if n.lower().startswith(('bottle','bb_btl'))];data.objects=names[:1]
  if not data.objects:raise ValueError('No body object found')
  body=data.objects[0];s.collection.objects.link(body);body.hide_render=False;body.hide_viewport=False;body.hide_set(False);bpy.context.view_layer.update();ev=body.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=bpy.data.meshes.new_from_object(ev);pts=[body.matrix_world@v.co for v in mesh.vertices];lo=Vector(tuple(min(p[k] for p in pts) for k in range(3)));hi=Vector(tuple(max(p[k] for p in pts) for k in range(3)));dim=hi-lo;center=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z));scale=min(.07131/dim.z,.064/max(dim.x,dim.y))
  for v,p in zip(mesh.vertices,pts):v.co=(p-center)*scale
  body.data=mesh;body.matrix_world=Matrix.Identity(4);mesh.materials.clear();mesh.materials.append(glass)
  for p in mesh.polygons:p.material_index=0
  for mod in list(body.modifiers):body.modifiers.remove(mod)
  s.camera.data.ortho_scale=.085;s.camera.rotation_euler=(math.radians(87),0,0);s.camera.location=(0,-1.4954692,0);s.render.resolution_x=620;s.render.resolution_y=682;s.render.resolution_percentage=100;s.render.use_border=False;s.render.use_crop_to_border=False;vertical=.085/(620/682);bpy.context.view_layer.update();foot=world_to_camera_view(s,s.camera,Vector((0,0,0)));s.camera.location+=s.camera.rotation_euler.to_matrix()@Vector((0,(foot.y-.12)*vertical,0));s.camera.data.clip_start=.00001;s.camera.data.clip_end=100
  floor=next((o for o in s.objects if o.name=='Review only | contact shadow catcher'),None)
  if floor:floor.location.z=-.00001
  s.render.engine='CYCLES';s.cycles.samples=48;s.cycles.use_adaptive_sampling=True;s.cycles.adaptive_threshold=.025;s.cycles.use_denoising=True;s.cycles.max_bounces=32;s.cycles.transmission_bounces=24;s.cycles.glossy_bounces=16
  prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='METAL';prefs.kernel_optimization_level='OFF';prefs.get_devices()
  for d in prefs.devices:d.use=d.type=='METAL'
  s.cycles.device='GPU';s.render.film_transparent=True;s.cycles.film_transparent_glass=False;s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGBA';s.render.filepath=str(file);bpy.context.view_layer.update();bounds=[world_to_camera_view(s,s.camera,body.matrix_world@Vector(v)) for v in body.bound_box];frame=all(.01<p.x<.99 and .01<p.y<.99 for p in bounds);assert frame,'Review frame clips geometry'
  bpy.ops.render.render(write_still=True);meta.write_text(json.dumps({**a,'sourceDimensionsMm':list(dim*1000),'displayScale':scale,'originalGeometryPreserved':True,'material':'Shared clear-glass material from existing Cylinder studio','view':'Bare body only, equalized display height for shape review; not a catalog sizing approval','samples':48,'resolution':[620,682],'framePass':frame},indent=2));print('BODY_RENDERED',i+1,len(jobs),a['bodyId'],flush=True)
 except Exception as e:print('BODY_RENDER_ERROR',a['bodyId'],str(e),traceback.format_exc(),flush=True)
print('BODY_OVERVIEW_COMPLETE',flush=True)
