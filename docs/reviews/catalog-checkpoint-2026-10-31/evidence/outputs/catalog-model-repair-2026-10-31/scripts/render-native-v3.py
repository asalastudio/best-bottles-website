"""Reproducible same-rig before/after renders, no writes to source models."""
import bpy,math,json,sys,traceback
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
r=Path(sys.argv[sys.argv.index('--')+1]).resolve();args=sys.argv[sys.argv.index('--')+2:];limit=int(args[0]) if args else 999
q=json.loads((r/'sources/audit-queue.json').read_text());q.sort(key=lambda a:(0 if 'clear_STUDIO-v1.5' in a['id'] else 1 if 'cyl5' in a['id'] else 2,a['id']))
out=r/'renders/comparisons-v3';out.mkdir(exist_ok=True)
def render(row,path,phase):
 bpy.ops.wm.open_mainfile(filepath=str(path),load_ui=False,use_scripts=False);s=bpy.context.scene;s.render.resolution_x=1560;s.render.resolution_y=1716;s.render.resolution_percentage=50
 sheet=[c for c in bpy.data.collections if c.name.startswith('Sheet | ')]
 if sheet:
  for c in sheet:c.hide_render=c.name not in ['Sheet | internals','Sheet | spray-matte-black']
  # Choose a sprayer view to expose the repaired tube; include complete sprayer and internals.
  available=[c.name for c in sheet]
  if 'Sheet | spray-matte-black' not in available:
   fallback=next((c for c in sheet if c.name.startswith('Sheet | spray-')),None)
   if fallback:fallback.hide_render=False
 body=next((o for o in s.objects if o.type=='MESH' and o.name.lower().startswith(('bottle','bb_btl'))),None)
 if body:body.hide_render=False
 products=[o for o in s.objects if o.type=='MESH' and o.name.lower().startswith(('bottle','bb_btl','roller','cap_','sprayer','pump','sheet |','internals |')) and not o.hide_render and not any(c.hide_render for c in o.users_collection)]
 points=[o.matrix_world@Vector(v) for o in products for v in o.bound_box]
 if not points:raise ValueError('No visible assembled product')
 bodypts=[body.matrix_world@Vector(v) for v in body.bound_box] if body else points
 z0=min(v.z for v in bodypts);z1=max(v.z for v in bodypts);h=(z1-z0)*1000
 # The approved shoulder rule: 3.5314 * bare height(mm)^0.5868 percent, with native measured shoulder datums.
 shoulder=42.12 if 'cyl5' in row['id'] else 94.49 if 'tall-9ml' in row['id'] else 71.7 if 'empire-50' in row['id'] else 91.32 if 'empire-100' in row['id'] else 59.14
 targetpct=3.5314*h**.5868/100
 aspect=1560/1716;rotation=(math.radians(87),0,0)
 cd=bpy.data.cameras.new('Catalog repair review camera');cd.type='ORTHO';cd.sensor_fit='HORIZONTAL';cd.clip_start=.00001;cd.clip_end=100
 cam=bpy.data.objects.new('Catalog repair review camera',cd);s.collection.objects.link(cam);s.camera=cam;cam.rotation_euler=rotation
 # projected shoulder height fixes the scale. Full product is checked before rendering.
 vertical=(shoulder/1000)*math.cos(math.radians(3))/targetpct;cd.ortho_scale=vertical*aspect
 cam.location=(0,-1.4954692,0);bpy.context.view_layer.update();axisfoot=world_to_camera_view(s,cam,Vector((0,0,z0)))
 # Camera's local up = (0,sin(3deg),cos(3deg)); moving it this distance fixes the foot at 91% from top.
 delta=(axisfoot.y-.09)*vertical;cam.location+=cam.rotation_euler.to_matrix()@Vector((0,delta,0))
 s.render.engine='CYCLES';s.cycles.samples=128;s.cycles.use_adaptive_sampling=True;s.cycles.adaptive_threshold=.008;s.cycles.use_denoising=True
 s.cycles.max_bounces=16;s.cycles.transmission_bounces=16;s.cycles.transparent_max_bounces=16;s.cycles.sample_clamp_indirect=10
 prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='METAL';prefs.get_devices()
 for d in prefs.devices:d.use=d.type=='METAL'
 s.cycles.device='GPU';s.render.resolution_x=1560;s.render.resolution_y=1716;s.render.resolution_percentage=50;s.render.use_border=False;s.render.use_crop_to_border=False
 # Studio-floor extension for the full catalog frame; preserve source materials and all reflection lighting.
 for studio in s.objects:
  if studio.type=='MESH' and studio not in products:
   if 'cyclorama' in studio.name.lower():
    inv=studio.matrix_world.inverted()
    for v in studio.data.vertices:
     w=studio.matrix_world@v.co
     if w.y<-.5:w.y-=5;v.co=inv@w
    studio.data.update()
   elif not studio.hide_render:studio.visible_shadow=False
 s.render.film_transparent=False;s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGB';s.render.image_settings.color_depth='8'
 bpy.context.view_layer.update();projected=[world_to_camera_view(s,cam,p) for p in points];bounds=[min(p.x for p in projected),min(p.y for p in projected),max(p.x for p in projected),max(p.y for p in projected)]
 if min(bounds[:2])<.015 or max(bounds[2:])>.985:
  # Deliberately exploded source studies need a wider frame; record this exception instead of cropping.
  factor=max((.5-bounds[0])/.48,(bounds[2]-.5)/.48,(bounds[3]-.09)/.88,1);cd.ortho_scale*=factor;vertical*=factor
  foot=world_to_camera_view(s,cam,Vector((0,0,z0)));delta=(foot.y-.09)*vertical;cam.location+=cam.rotation_euler.to_matrix()@Vector((0,delta,0));bpy.context.view_layer.update()
  projected=[world_to_camera_view(s,cam,p) for p in points];bounds=[min(p.x for p in projected),min(p.y for p in projected),max(p.x for p in projected),max(p.y for p in projected)]
 if min(bounds[:2])<0 or max(bounds[2:])>1:raise ValueError('Frame failed '+str(bounds))
 dest=out/row['id'];dest.mkdir(exist_ok=True);s.render.filepath=str(dest/(phase+'.png'));bpy.ops.render.render(write_still=True)
 meta={'source':str(path),'phase':phase,'resolution':[1560,1716],'samples':128,'denoise':True,'bounds01':bounds,'framePass':True,'camera':{'tiltDegDown':3,'orthographicWidthM':cd.ortho_scale,'footTargetPct':91,'shoulderRulePct':targetpct*100,'shoulderMm':shoulder},'studio':'original native studio lights/materials retained; full-canvas catalog framing','review':'visual review pending'}
 (dest/(phase+'.json')).write_text(json.dumps(meta,indent=2));print('RENDERED',row['id'],phase,flush=True)
 if phase=='after':bpy.ops.wm.save_as_mainfile(filepath=str(dest/'review-scene.blend'),compress=True)
done=0
for row in q:
 rp=r/'working/native'/row['id']/'repair-report.json'
 if not rp.exists():continue
 report=json.loads(rp.read_text())
 if not report['changes']:continue
 if done>=limit:break
 try:
  for phase,path in ([('before',row['path'])] if any(t in row['id'] for t in ['clear_STUDIO-v1.5','mist-black-clear','lotion-black-clear','Tall-9ml-13-415_clear']) else [])+[('after',report['workingCopy'])]:
   if not (out/row['id']/(phase+'.png')).exists():render(row,path,phase)
  done+=1
 except Exception as e:print('RENDER_ERROR',row['id'],str(e),traceback.format_exc(),flush=True)
print('NATIVE_RENDER_COMPLETE',done,flush=True)
