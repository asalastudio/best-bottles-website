import bpy,bmesh,json,math,sys
from pathlib import Path
from mathutils import Vector
r=Path(sys.argv[sys.argv.index('--')+1]).resolve()
for f in (r/'working/legacy').glob('*/repair-report.json'):
 d=f.parent;a=json.loads((d/'repair-report-v2.json').read_text()) if (d/'repair-report-v2.json').exists() and 'ANSP_BULB' not in d.name else json.loads(f.read_text());bpy.ops.wm.open_mainfile(filepath=a['workingCopy'],load_ui=False,use_scripts=False);s=bpy.context.scene;meshes=[o for o in s.objects if o.type=='MESH'];checks=[]
 for o in meshes:
  bm=bmesh.new();bm.from_mesh(o.data)
  for e in bm.edges:
   e.smooth=not(e.is_manifold and e.calc_face_angle(0)>math.radians(40))
  for face in bm.faces:face.smooth=len(face.verts)<=4
  bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
  # Do not average normals across closed cap/annulus planes.
  for poly in o.data.polygons:
   if abs(poly.normal.z)>.99999:poly.use_smooth=False
  checks.append(o.name)
 a['changes'].append({'code':'SHADING','detail':'Preserved source geometry; separated sharp-edge normals at 40 degrees and kept planar cap/rim faces flat'});a['workingCopy']=str(d/'model-shading-v3.blend');a['disposition']='technical geometry candidate; exact-SKU fit and visual review required'
 bpy.ops.wm.save_as_mainfile(filepath=a['workingCopy'],compress=True);bpy.ops.object.select_all(action='DESELECT')
 for o in meshes:o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(d/'model-shading-v3.glb'),export_format='GLB',use_selection=True,export_materials='NONE');(d/'repair-report-v3.json').write_text(json.dumps(a,indent=2))
 pts=[o.matrix_world@Vector(v) for o in meshes for v in o.bound_box];lo=Vector([min(p[i] for p in pts) for i in range(3)]);hi=Vector([max(p[i] for p in pts) for i in range(3)]);c=(lo+hi)/2;span=hi-lo;s.render.engine='BLENDER_WORKBENCH';s.render.resolution_x=520;s.render.resolution_y=650;s.render.resolution_percentage=100;s.render.use_border=False;s.render.use_crop_to_border=False
 sh=s.display.shading;sh.color_type='SINGLE';sh.single_color=(.64,.69,.72);sh.show_cavity=True;sh.cavity_type='BOTH';sh.background_type='WORLD';s.world=bpy.data.worlds.new('Review background');s.world.color=(.8,.79,.76)
 cd=bpy.data.cameras.new('Review');cd.type='ORTHO';cd.ortho_scale=max(span.z,span.x*1.25,span.y*1.25)*1.38;cd.clip_start=.00001;cd.clip_end=100;cam=bpy.data.objects.new('Review',cd);s.collection.objects.link(cam);cam.location=c+Vector((.16,-.4,.09));cam.rotation_euler=(c-cam.location).to_track_quat('-Z','Y').to_euler();s.camera=cam;s.render.filepath=str(d/'geometry-after-v3.png');bpy.ops.render.render(write_still=True);print('SHADING_REPAIRED',d.name,flush=True)
print('SHADING_COMPLETE',flush=True)
