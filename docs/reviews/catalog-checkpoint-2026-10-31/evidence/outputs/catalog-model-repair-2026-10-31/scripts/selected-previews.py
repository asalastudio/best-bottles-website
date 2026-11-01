import bpy,math,json,sys,traceback
from pathlib import Path
from mathutils import Vector
r=Path(sys.argv[sys.argv.index('--')+1]).resolve();out=r/'renders/after/geometry-selected';out.mkdir(parents=True,exist_ok=True);jobs=[]
for kind in ['legacy','native','priority-assemblies','empire-assemblies','dropper-assemblies']:
 for f in (r/'working'/kind).glob('*/repair-report.json'):
  chosen=f
  for n in range(2,16):
   x=f.parent/f'repair-report-v{n}.json'
   if x.exists() and json.loads(x.read_text()).get('disposition')!='rejected refinement' and not(n==2 and 'ANSP_BULB' in str(x)):chosen=x
  a=json.loads(chosen.read_text());jobs.append((kind,a))
if len(sys.argv)>sys.argv.index('--')+2:jobs=[x for x in jobs if x[0]==sys.argv[-1]]
for kind,a in jobs:
 dest=out/(a['id']+'.png');meta=dest.with_suffix('.json')
 if meta.exists() and json.loads(meta.read_text()).get('source')==a['workingCopy']:continue
 try:
  bpy.ops.wm.open_mainfile(filepath=a['workingCopy'],load_ui=False,use_scripts=False);s=bpy.context.scene;print('OPENED',a['id'],flush=True)
  meshes=[o for o in s.objects if o.type=='MESH' and (kind=='legacy' or o.name.lower().startswith(('bottle','bb_btl','roller','cap_','sprayer','pump','dropper','sheet |','internals |')) or any(c.name.startswith('Sheet | ') for c in o.users_collection)) and not o.hide_render and not any(c.hide_render for c in o.users_collection)]
  points=[o.matrix_world@Vector(v) for o in meshes for v in o.bound_box];lo=Vector([min(p[i] for p in points) for i in range(3)]);hi=Vector([max(p[i] for p in points) for i in range(3)]);c=(lo+hi)/2;span=hi-lo
  for o in s.objects:
   if o.type=='MESH' and o not in meshes:o.hide_render=True
  s.render.use_compositing=False;s.render.use_sequencer=False;s.render.use_border=False;s.render.use_crop_to_border=False;s.render.engine='BLENDER_WORKBENCH';s.render.resolution_x=520;s.render.resolution_y=650;s.render.resolution_percentage=100;s.render.film_transparent=False
  sh=s.display.shading;sh.light='STUDIO';sh.color_type='SINGLE';sh.single_color=(.64,.69,.72);sh.show_cavity=True;sh.cavity_type='BOTH';sh.show_shadows=True;sh.background_type='WORLD';s.world=bpy.data.worlds.new('Review background');s.world.color=(.8,.79,.76)
  cd=bpy.data.cameras.new('Audit camera');cd.type='ORTHO';cd.clip_start=.00001;cd.clip_end=100;cd.ortho_scale=max(span.z,span.x*1.25,span.y*1.25)*1.38;cam=bpy.data.objects.new('Audit camera',cd);s.collection.objects.link(cam);cam.location=c+Vector((.16 if kind=='legacy' else .06,-.4,.09 if kind=='legacy' else .04));cam.rotation_euler=(c-cam.location).to_track_quat('-Z','Y').to_euler();s.camera=cam;s.render.image_settings.file_format='PNG';s.render.filepath=str(dest);print('RENDERING',a['id'],flush=True);bpy.ops.render.render(write_still=True);meta.write_text(json.dumps({'source':a['workingCopy'],'id':a['id'],'kind':kind,'dimensionsMm':list(span*1000)}));print('FINAL_PREVIEW',a['id'],flush=True)
 except Exception as e:print('FINAL_PREVIEW_ERROR',a['id'],str(e),traceback.format_exc(),flush=True)
print('FINAL_PREVIEWS_COMPLETE',len(jobs),flush=True)
