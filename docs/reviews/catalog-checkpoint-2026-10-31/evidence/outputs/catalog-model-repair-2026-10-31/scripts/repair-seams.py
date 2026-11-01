import bpy,bmesh,json,sys,math
from pathlib import Path
from mathutils import Vector
r=Path(sys.argv[sys.argv.index('--')+1]).resolve()
def loops(bm):
 remaining=set(e for e in bm.edges if e.is_boundary);out=[]
 while remaining:
  todo=[remaining.pop()];edges=[]
  while todo:
   e=todo.pop();edges.append(e)
   for v in e.verts:
    for q in v.link_edges:
     if q in remaining:remaining.remove(q);todo.append(q)
  out.append(edges)
 return out
for f in (r/'working/legacy').glob('*/repair-report.json'):
 a=json.loads(f.read_text())
 if not a['unresolved'] or 'DIP_TUBE' in a['id']:continue
 d=f.parent;bpy.ops.wm.open_mainfile(filepath=a['workingCopy'],load_ui=False,use_scripts=False);s=bpy.context.scene;o=next(x for x in s.objects if x.type=='MESH');bpy.context.view_layer.objects.active=o;o.select_set(True)
 if 'ANSP_BULB' in a['id']:
  original=[o.matrix_world@Vector(v) for v in o.bound_box];o.data.remesh_voxel_size=.0001;o.data.remesh_voxel_adaptivity=0;bpy.ops.object.voxel_remesh()
  sm=o.modifiers.new('Applied micro surface smoothing','SMOOTH');sm.factor=.12;sm.iterations=2;bpy.ops.object.modifier_apply(modifier=sm.name)
  detail={'code':'SCULPT-SEAMS','detail':'Reconstructed continuous bulb surface from original sculpt with 0.1 mm voxel remesh; no external shape substitute','toleranceMm':.1}
  a['inferred'].append('Sub-0.1 mm bulb surface reconstruction; source holes and overlapping fragments resolved by voxel remesh; visual review required')
 else:
  bm=bmesh.new();bm.from_mesh(o.data);bad=[e for e in bm.edges if e.is_boundary];z=sum(v.co.z for e in bad for v in e.verts)/(2*len(bad));eps=.00003
  for zz in [z-eps,z+eps]:bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=1e-9,plane_co=(0,0,zz),plane_no=(0,0,1))
  band=[face for face in bm.faces if z-eps+1e-9<face.calc_center_median().z<z+eps-1e-9]
  bmesh.ops.delete(bm,geom=band,context='FACES')
  loose=[e for e in bm.edges if not e.link_faces]
  if loose:bmesh.ops.delete(bm,geom=loose,context='EDGES')
  loosev=[v for v in bm.verts if not v.link_edges]
  if loosev:bmesh.ops.delete(bm,geom=loosev,context='VERTS')
  ls=loops(bm);ls.sort(key=lambda es:sum(math.hypot(v.co.x,v.co.y) for e in es for v in e.verts)/(2*len(es)))
  if len(ls)!=4:raise ValueError('Expected four clean boundary rings, found '+str([(len(x)) for x in ls]))
  for pair in [(ls[0],ls[1]),(ls[2],ls[3])]:bmesh.ops.bridge_loops(bm,edges=pair[0]+pair[1],use_pairs=True)
  bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free();detail={'code':'FINISH-JOIN','detail':'Replaced 0.06 mm corrupt seam band with bridged inner and outer rings; source profile, cavity and threaded finish retained','seamZmm':z*1000}
 bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-7);bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=1e-8);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));check={'nonManifoldEdges':sum(not e.is_manifold for e in bm.edges),'inconsistentNormalEdges':sum(e.is_manifold and not e.is_contiguous for e in bm.edges),'degenerateFaces':sum(f.calc_area()<1e-16 for f in bm.faces),'signedVolumeMm3':bm.calc_volume(signed=True)*1e9};bm.to_mesh(o.data);bm.free()
 for p in o.data.polygons:p.use_smooth=True
 a['changes'].append(detail);a['checks']=[{'object':o.name,**check}];a['unresolved']=[] if check['nonManifoldEdges']==check['inconsistentNormalEdges']==check['degenerateFaces']==0 else ['Remaining topology check failed'];a['workingCopy']=str(d/'model-v2.blend');a['disposition']='geometry repaired; visual review pending' if not a['unresolved'] else 'review hold'
 bpy.ops.wm.save_as_mainfile(filepath=str(d/'model-v2.blend'),compress=True);bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.ops.export_scene.gltf(filepath=str(d/'model-v2.glb'),export_format='GLB',use_selection=True,export_materials='NONE');(d/'repair-report-v2.json').write_text(json.dumps(a,indent=2))
 pts=[o.matrix_world@Vector(v) for v in o.bound_box];lo=Vector([min(p[i] for p in pts) for i in range(3)]);hi=Vector([max(p[i] for p in pts) for i in range(3)]);c=(lo+hi)/2;span=hi-lo
 s.render.engine='BLENDER_WORKBENCH';s.render.resolution_x=520;s.render.resolution_y=650;s.render.resolution_percentage=100;sh=s.display.shading;sh.color_type='SINGLE';sh.single_color=(.64,.69,.72);sh.show_cavity=True;sh.cavity_type='BOTH';sh.background_type='WORLD';s.world=bpy.data.worlds.new('Review background');s.world.color=(.8,.79,.76)
 cd=bpy.data.cameras.new('Review');cd.type='ORTHO';cd.ortho_scale=max(span.z,span.x*1.25,span.y*1.25)*1.38;cd.clip_start=.00001;cd.clip_end=100;cam=bpy.data.objects.new('Review',cd);s.collection.objects.link(cam);cam.location=c+Vector((.06,-.4,.04));cam.rotation_euler=(c-cam.location).to_track_quat('-Z','Y').to_euler();s.camera=cam;s.render.filepath=str(d/'geometry-after-v2.png');bpy.ops.render.render(write_still=True);print('SEAM_REPAIRED',a['id'],check,flush=True)
print('SEAM_REPAIR_COMPLETE',flush=True)
