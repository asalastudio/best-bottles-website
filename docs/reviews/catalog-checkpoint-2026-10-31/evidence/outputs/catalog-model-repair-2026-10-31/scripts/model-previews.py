import bpy,math,json,sys,traceback
from mathutils import Vector
from pathlib import Path
root=Path(sys.argv[sys.argv.index('--')+1]);rows=json.loads((root/'sources/audit-queue.json').read_text());out=root/'renders/before/geometry';out.mkdir(parents=True,exist_ok=True)
for row in rows:
 if row['kind']!='glb':continue
 dest=out/(row['id']+'.png')
 if dest.exists():continue
 try:
  bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=row['path']);s=bpy.context.scene
  meshes=[o for o in s.objects if o.type=='MESH'];points=[o.matrix_world@Vector(v) for o in meshes for v in o.bound_box]
  lo=Vector([min(p[i] for p in points) for i in range(3)]);hi=Vector([max(p[i] for p in points) for i in range(3)]);c=(lo+hi)/2;span=hi-lo
  s.render.engine='BLENDER_WORKBENCH';s.render.resolution_x=520;s.render.resolution_y=650;s.render.resolution_percentage=100
  sh=s.display.shading;sh.light='STUDIO';sh.color_type='SINGLE';sh.single_color=(.64,.69,.72);sh.show_cavity=True;sh.cavity_type='BOTH';sh.show_shadows=True;sh.background_type='WORLD';s.world=bpy.data.worlds.new('Review background');s.world.color=(.8,.79,.76)
  cd=bpy.data.cameras.new('Audit camera');cd.type='ORTHO';cd.clip_start=.00001;cd.clip_end=100;cd.ortho_scale=max(span.z,span.x*1.25,span.y*1.25)*1.38
  cam=bpy.data.objects.new('Audit camera',cd);s.collection.objects.link(cam);cam.location=c+Vector((.16,-.4,.09));cam.rotation_euler=(c-cam.location).to_track_quat('-Z','Y').to_euler();s.camera=cam
  s.render.image_settings.file_format='PNG';s.render.filepath=str(dest);bpy.ops.render.render(write_still=True)
  print('PREVIEW',row['id'],flush=True)
 except Exception as e:print('PREVIEW_ERROR',row['id'],str(e),flush=True)
print('PREVIEWS_COMPLETE',flush=True)
