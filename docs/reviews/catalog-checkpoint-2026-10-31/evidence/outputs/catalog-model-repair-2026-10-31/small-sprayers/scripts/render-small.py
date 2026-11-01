import bpy,sys,math,json,bmesh
from pathlib import Path
from mathutils import Vector
OUT=Path(__file__).resolve().parents[1];(OUT/'renders').mkdir(exist_ok=True)
SRC=Path('/Users/jordanrichter/Documents/Codex/2026-09-24/the-image-is-clearly-the-target/outputs/cyl9-17415-studio-2026-09-30/export.py')
sys.argv=['blender','--','review'];ns={'__file__':str(SRC),'__name__':'review'};exec(compile(SRC.read_text(),str(SRC),'exec'),ns);ns['RAW']=OUT/'renders'
def lathe(name,profile,material):
 n=192;verts=[];faces=[]
 for r,z in profile:
  for i in range(n):a=i*2*math.pi/n;verts.append((r*math.cos(a)/1000,r*math.sin(a)/1000,z/1000))
 for j in range(len(profile)):
  k=(j+1)%len(profile)
  for i in range(n):ni=(i+1)%n;faces.append((j*n+i,j*n+ni,k*n+ni,k*n+i))
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new(name,mesh);bpy.context.scene.collection.objects.link(o);o.data.materials.append(material)
 bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(mesh);bm.free()
 for p in mesh.polygons:p.use_smooth=True
 return o
for h,label in [(37,'3.3'),(49,'4')]:
 bpy.ops.wm.open_mainfile(filepath=str(ns['LOT']));s=bpy.context.scene;ns['restudio'](s,'Clear');old=next(o for o in s.objects if o.name.startswith('BB_BTL'));mat=old.material_slots[0].material.copy()
 # Manufacturer envelope: 14 mm diameter, 37/49 mm bare height. Hidden finish,
 # 1 mm wall and 2 mm heel inferred for presentation, not a machining drawing.
 profile=[(.05,.8),(5.9,.8),(6.55,.95),(6.9,1.4),(7,2.2),(7,h-6.7),(6.94,h-6.1),(6.6,h-5.6),(5.4,h-4.5),(5.3,h-2.0),(5.9,h-1.8),(6,h-1.4),(6,h-.5),(5.8,h),(4.35,h),(4.15,h-.5),(4.15,h-4.7),(5.7,h-6.8),(5.9,h-7.3),(5.9,3.3),(5.6,2.8),(.05,2.8)]
 o=lathe('BB_BTL_small_'+label,profile,mat);ns['only'](s,{o.name});ns['backdrop_bone'](s,ns['BONE']);ns['card_top'](s,h)
 s.camera.data.clip_start=.001;s.camera.data.clip_end=100
 crop=ns['set_crop'](s,ns['projected_box'](s,[o],15));meta={'dimensionsMm':[14,14,h],'inferred':['neck profile','wall 1.1 mm','base thickness 2 mm'],'crop':crop,'axis':ns['px'](s,(0,0,0))[0],'baseline':ns['px'](s,(0,0,0))[1],'shoulder':ns['px'](s,(0,0,(h-6)/1000))[1],'sourcePxPerMm':25}
 ns['gpu'](s,96);bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'renders'/f'glass-{label}.blend'));ns['render'](s,'glass-'+label,96,meta)
# A working copy of the accepted transparent-shell treatment, sized to the
# photographed small-sprayer cover's 14 mm x 20.5 mm envelope.
bpy.ops.wm.open_mainfile(filepath=str(OUT.parent/'component-review-9ml/renders/empty-overcap-alpha-v6.blend'));s=bpy.context.scene;o=s.objects['pump — translucent overcap'];o.dimensions=(.014,.014,.0205);bpy.context.view_layer.update();bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
ns['card_top'](s,ns['top_of']([o]));crop=ns['set_crop'](s,ns['projected_box'](s,[o],12));ns['gpu'](s,96);bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'renders/overcap-12mm.blend'));ns['render'](s,'overcap-12mm',96,{'dimensionsMm':[14,14,20.5],'crop':crop,'source':'approved 9 ml alpha-shell material; small cap dimensions inferred from source photograph'})
# Preserve the original photographic hardware. Export just the above-neck
# sprayer head, with its existing alpha, so a long tube cannot change tile size.
for finish in ['black','white']:
 img=bpy.data.images.load(str(OUT/f'source-4-{finish}-sprayer.webp'));w,h=img.size;px=list(img.pixels);x0,x1,y0,y1=(390,610,80,464);cw=x1-x0;ch=y1-y0;buf=[]
 for y in range(h-y1,h-y0):buf.extend(px[(y*w+x0)*4:(y*w+x1)*4])
 dest=bpy.data.images.new('Head '+finish,width=cw,height=ch,alpha=True);dest.pixels=buf;dest.filepath_raw=str(OUT/'renders'/f'head-{finish}.png');dest.file_format='PNG';dest.save()
print('SMALL SPRAYER EXPORT COMPLETE',flush=True)
