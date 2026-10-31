import bpy,sys,math,json,bmesh
from pathlib import Path
from mathutils import Vector
OUT=Path(__file__).resolve().parents[1];(OUT/'renders').mkdir(exist_ok=True)
SRC=Path('/Users/jordanrichter/Documents/Codex/2026-09-24/the-image-is-clearly-the-target/outputs/cyl9-17415-studio-2026-09-30/export.py')
sys.argv=['blender','--','review'];ns={'__file__':str(SRC),'__name__':'review'};exec(compile(SRC.read_text(),str(SRC),'exec'),ns);ns['RAW']=OUT/'renders'
def lathe(name,profile,material):
 dense=[]
 for j,(r,z) in enumerate(profile):
  rr,zz=profile[(j+1)%len(profile)];count=max(1,math.ceil(math.hypot(rr-r,zz-z)/.65))
  for k in range(count):t=k/count;dense.append((r+(rr-r)*t,z+(zz-z)*t))
 profile=dense
 n=192;verts=[];faces=[]
 for r,z in profile:
  for i in range(n):a=i*2*math.pi/n;verts.append((r*math.cos(a)/1000,r*math.sin(a)/1000,z/1000))
 for j in range(len(profile)):
  k=(j+1)%len(profile)
  for i in range(n):ni=(i+1)%n;faces.append((j*n+i,j*n+ni,k*n+ni,k*n+i))
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new(name,mesh);bpy.context.scene.collection.objects.link(o);o.data.materials.append(material)
 bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-8);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(mesh);bm.free()
 for p in mesh.polygons:p.use_smooth=True
 return o
for h,label in [(37,'3.3'),(49,'4')]:
 bpy.ops.wm.open_mainfile(filepath=str(ns['LOT']));s=bpy.context.scene;ns['restudio'](s,'Clear');old=next(o for o in s.objects if o.name.startswith('BB_BTL'));mat=old.material_slots[0].material.copy()
 # Manufacturer envelope: 14 mm diameter, 37/49 mm bare height. Hidden finish,
 # 1 mm wall and 2 mm heel inferred for presentation, not a machining drawing.
 profile=[(0,0),(5.9,0),(6.55,.15),(6.9,.6),(7,1.4),(7,h-6.7),(6.94,h-6.1),(6.6,h-5.6),(5.4,h-4.5),(5.3,h-2.0),(5.9,h-1.8),(6,h-1.4),(6,h-.5),(5.8,h),(4.35,h),(4.15,h-.5),(4.15,h-4.7),(5.7,h-6.8),(5.9,h-7.3),(5.9,3.3),(5.6,2.8),(0,2.8)]
 o=lathe('BB_BTL_small_'+label,profile,mat);ns['only'](s,{o.name});ns['backdrop_bone'](s,ns['BONE']);ns['card_top'](s,h)
 s.camera.data.clip_start=.001;s.camera.data.clip_end=100
 crop=ns['set_crop'](s,ns['projected_box'](s,[o],15));meta={'dimensionsMm':[14,14,h],'inferred':['neck profile','wall 1.1 mm','base thickness 2 mm'],'crop':crop,'axis':ns['px'](s,(0,0,0))[0],'baseline':ns['px'](s,(0,0,0))[1],'shoulder':ns['px'](s,(0,0,(h-6)/1000))[1],'sourcePxPerMm':25}
 ns['gpu'](s,96);bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'renders'/f'glass-{label}-v3.blend'));ns['render'](s,'glass-'+label+'-v3',96,meta)
