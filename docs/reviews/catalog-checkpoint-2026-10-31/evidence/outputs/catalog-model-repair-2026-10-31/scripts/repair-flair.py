import bpy,bmesh,math,json,sys,hashlib
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from bpy_extras.object_utils import world_to_camera_view
r=Path(sys.argv[sys.argv.index('--')+1]);out=r/'working/flair-15ml-13-415';out.mkdir(parents=True,exist_ok=True)
repo=r.parents[1]
source=Path('/Users/jordanrichter/Documents/Codex/2026-09-24/the-image-is-clearly-the-target/outputs/cyl5-13415-v7-review-2026-09-29/Cyl-5ml-13-415_clear_STUDIO-v1.5-body-v7e.blend')
glb=repo/'public/models/bodies/Flair-boxy-13-415-56x41x20.glb'
bpy.ops.wm.open_mainfile(filepath=str(source),load_ui=False,use_scripts=False);s=bpy.context.scene
original=next(o for o in s.objects if o.name.startswith('Bottle |'));glass=original.data.materials[0]
def boolean(o,cutter,operation):
 bpy.context.view_layer.objects.active=o;mod=o.modifiers.new('Local repair '+operation,'BOOLEAN');mod.operation=operation;mod.solver='EXACT';mod.object=cutter;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
def box(lo,hi,name):
 bpy.ops.mesh.primitive_cube_add(size=1,location=(Vector(lo)+Vector(hi))/2);o=bpy.context.object;o.name=name;o.dimensions=Vector(hi)-Vector(lo);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return o
# Keep the measured 13-415 finish geometry and its bore at its original physical size.
finish=original.copy();finish.data=original.data.copy();s.collection.objects.link(finish);finish.name='Finish | copied measured 13-415 module'
boolean(finish,box((-.1,-.1,.04212),(.1,.1,.1),'Finish isolation'),'INTERSECT');finish.location.z+=.00288
bpy.context.view_layer.objects.active=finish;finish.select_set(True);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
before=set(s.objects);bpy.ops.import_scene.gltf(filepath=str(glb));new=[o for o in s.objects if o not in before];body=next(o for o in new if o.type=='MESH');body.name='Bottle | Flair 15 ml repair candidate'
# Preserve the photographed external dimensions while adding the recessed front/back channels visible in the references.
zmin,zmax=min(v.co.z for v in body.data.vertices),max(v.co.z for v in body.data.vertices)
rings={}
for v in body.data.vertices:rings.setdefault(round(v.co.z,7),[]).append(v)
for z,vs in rings.items():
 hw=max(abs(v.co.x) for v in vs);hd=max(abs(v.co.y) for v in vs)
 if z<.003 or z>.044 or hw<.009 or hd<.004:continue
 fade=min(1,(z-.003)/.004,(.044-z)/.003)
 for v in vs:
  u=abs(v.co.x)/hw
  face=max(0,min(1,(abs(v.co.y)/hd-.55)/.35))
  groove=.00065*fade*face*(math.exp(-((u-.58)/.055)**2)+.7*math.exp(-((u-.80)/.045)**2))
  v.co.y-=math.copysign(groove,v.co.y)
boolean(body,box((-.1,-.1,-.01),(.1,.1,.0452),'Keep Flair body below finish'),'INTERSECT')
boolean(body,finish,'UNION')
# Infer only the undocumented interior: 1.6 mm wall, 3 mm floor; retain the measured 7.45 mm neck bore.
bm=bmesh.new();bm.from_mesh(body.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-7);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(body.data);bm.free()
bvh=BVHTree.FromPolygons([v.co for v in body.data.vertices],[p.vertices[:] for p in body.data.polygons])
zs=[.003+i*(.042-.003)/100 for i in range(101)]+[.043,.044,.045,.046,.056,.058];seg=128;verts=[]
for z in zs:
 for j in range(seg):
  a=2*math.pi*j/seg;d=Vector((math.cos(a),math.sin(a),0))
  if z>=.044:rinner=.003725
  else:
   hit,n,idx,dist=bvh.ray_cast(Vector((0,0,z)),d,.1)
   radius=dist if hit else .006
   rinner=max(.003725,radius-.0016)
   if z>.041:rinner=(rinner*(1-(z-.041)/.003)+.003725*(z-.041)/.003)
  verts.append((rinner*d.x,rinner*d.y,z))
faces=[]
for k in range(len(zs)-1):
 for j in range(seg):q=(j+1)%seg;faces.append((k*seg+j,k*seg+q,(k+1)*seg+q,(k+1)*seg+j))
faces += [tuple(range(seg-1,-1,-1)),tuple((len(zs)-1)*seg+j for j in range(seg))]
me=bpy.data.meshes.new('Inferred Flair cavity');me.from_pydata(verts,[],faces);me.update();cut=bpy.data.objects.new('Inferred Flair cavity',me);s.collection.objects.link(cut)
boolean(body,cut,'DIFFERENCE')
bm=bmesh.new();bm.from_mesh(body.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-7);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));nm=sum(not e.is_manifold for e in bm.edges);bm.to_mesh(body.data);bm.free()
body.data.materials.clear();body.data.materials.append(glass)
for p in body.data.polygons:p.use_smooth=True
# All source parts stay separate; translate the complete 13-415 assembly to the new 56 mm rim.
for o in s.objects:
 if o is original or o is body:continue
 if any(c.name.startswith('Sheet |') for c in o.users_collection):o.location.z+=.00288
original.hide_render=True;original.hide_set(True);original.name='REFERENCE ONLY | original measured Cylinder 5 ml (unchanged mesh)'
# Save a native working copy before producing geometry-only evidence.
body['evidence']='Flair exact-SKU front/depth photos; 56 x 41 x 20 mm; finish reused at 1:1 from measured Cylinder 5 ml 13-415.'
body['inferred']='Flute depths and interior wall/floor are visual-production estimates, not caliper-qualified.'
bpy.context.view_layer.update();bounds=[body.matrix_world@Vector(v) for v in body.bound_box];dims=[(max(v[i] for v in bounds)-min(v[i] for v in bounds))*1000 for i in range(3)]
report={'sourceBody':str(glb),'finishSource':str(source),'acceptanceClass':'visual-production candidate','dimensionsMm':dims,'nonManifoldEdges':nm,'interior':{'wallMm':1.6,'floorMm':3,'boreMm':7.45,'qualification':'wall/floor inferred; bore copied from measured finish'},'operatorDisposition':'review pending','remaining':['Inspect shoulder and flute depth against source photos','Qualify cavity volume and tube clearance','Render every Flair closure variant after geometry validation']}
(out/'repair-report.json').write_text(json.dumps(report,indent=2));bpy.ops.wm.save_as_mainfile(filepath=str(out/'Flair-15ml-13-415-candidate.blend'))
# Source-preserving diagnostic render; final studio render follows the geometry review.
for o in s.objects:
 if o.type=='MESH':o.hide_render=o is not body
s.render.engine='BLENDER_WORKBENCH';s.render.resolution_x=520;s.render.resolution_y=650;s.render.resolution_percentage=100
s.display.shading.color_type='SINGLE';s.display.shading.single_color=(.64,.69,.72);s.display.shading.show_cavity=True;s.display.shading.cavity_type='BOTH'
cam=s.camera;cam.data.type='ORTHO';cam.data.ortho_scale=.078;target=Vector((0,0,.028));cam.location=target+Vector((.16,-.4,.09));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.clip_start=.00001;cam.data.clip_end=10
s.render.filepath=str(out/'geometry-after.png');bpy.ops.render.render(write_still=True);print('FLAIR_CANDIDATE',json.dumps(report),flush=True)
