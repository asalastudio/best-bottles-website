import bpy,sys,math,json,bmesh
from pathlib import Path
from mathutils import Vector
OUT=Path(__file__).resolve().parents[1]
SRC=Path('/Users/jordanrichter/Documents/Codex/2026-09-24/the-image-is-clearly-the-target/outputs/cyl9-17415-studio-2026-09-30/export.py')
sys.argv=['blender','--','review'];ns={'__file__':str(SRC),'__name__':'review'};exec(compile(SRC.read_text(),str(SRC),'exec'),ns);ns['RAW']=OUT/'renders'
# Import the closed lathe helper, without running its earlier candidate renders.
exec((OUT/'scripts/render-body-v3.py').read_text().split('for h,label in [(37')[0].split('def lathe',1)[1].join(['def lathe','']),globals())
def lerp(x,points):
 for (a,b),(c,d) in zip(points,points[1:]):
  if x<=c:return b+(d-b)*max(0,min(1,(x-a)/(c-a)))
 return points[-1][1]
def audit(o):
 bm=bmesh.new();bm.from_mesh(o.data)
 bmesh.ops.delete(bm,geom=[e for e in bm.edges if e.is_wire],context='EDGES');bm.to_mesh(o.data)
 r={'boundaryEdges':sum(e.is_boundary for e in bm.edges),'nonManifoldEdges':sum(not e.is_manifold for e in bm.edges),'inconsistentNormalEdges':sum(e.is_manifold and not e.is_contiguous for e in bm.edges),'degenerateFaces':sum(f.calc_area()<1e-15 for f in bm.faces),'volumeMm3':bm.calc_volume(signed=True)*1e9,'vertices':len(bm.verts),'faces':len(bm.faces)};bm.free();return r
def render(o,label,h,shoulder,inferred):
 s=bpy.context.scene;ns['only'](s,{o.name});ns['backdrop_bone'](s,ns['BONE']);ns['card_top'](s,h);bpy.context.view_layer.update()
 s.camera.data.clip_start=.001;s.camera.data.clip_end=100
 crop=ns['set_crop'](s,ns['projected_box'](s,[o],15));meta={'dimensionsMm':[round(v*1000,4) for v in o.dimensions],'inferred':inferred,'crop':crop,'axis':ns['px'](s,(0,0,0))[0],'baseline':ns['px'](s,(0,0,0))[1],'shoulder':ns['px'](s,(0,0,shoulder/1000))[1],'sourcePxPerMm':25,'geometry':audit(o),'sourceReference':'small-sprayers/source-review/sources.json','status':'local visual review candidate'}
 assert meta['geometry']['nonManifoldEdges']==0 and meta['geometry']['degenerateFaces']==0,meta
 ns['gpu'](s,128);bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'renders'/f'{label}.blend'));ns['render'](s,label,128,meta)
for h,label in [(37,'3.3'),(49,'4')]:
 if (OUT/'renders'/('glass-'+label+'-profile-v4.png')).exists():continue
 bpy.ops.wm.open_mainfile(filepath=str(ns['LOT']));s=bpy.context.scene;ns['restudio'](s,'Clear');old=next(o for o in s.objects if o.name.startswith('BB_BTL'));mat=old.material_slots[0].material.copy()
 # Source-photo straight barrel and gently rounded heel. Hidden 12 mm finish
 # remains a visual inference because every exact original has its head on.
 profile=[(0,0),(6.15,0),(6.5,.1),(6.78,.3),(6.94,.6),(7,1.0),(7,h-6.3),(6.99,h-6),(6.88,h-5.65),(6.6,h-5.3),(5.45,h-4.6),(5.3,h-4.2),(5.3,h-2),(5.8,h-1.8),(6,h-1.55),(6,h-.5),(5.9,h-.15),(5.7,h),(4.35,h),(4.2,h-.3),(4.2,h-4.5),(5.5,h-5.9),(5.9,h-6.4),(5.95,h-7),(5.95,2.3),(5.8,1.85),(5.5,1.6),(0,1.6)]
 o=lathe('BB_BTL_small_'+label,profile,mat);render(o,'glass-'+label+'-profile-v4',h,h-6,['12 mm concealed finish profile','1.05 mm nominal wall','1.6 mm heel; visual inference from source photo'])
# Reuse the existing 13-415 threaded finish on the five millilitre master.
source=OUT.parent/'renders/comparisons-v7/native-cyl5-13415-v7-review-2026-09-29__Cyl-5ml-13-415_clear_STUDIO-v1.5-body-v7e/review-scene.blend'
for glass in ['Clear','Cobalt Blue']:
 bpy.ops.wm.open_mainfile(filepath=str(ns['LOT']));s=bpy.context.scene;ns['restudio'](s,glass);ns['look'](s,glass);old=next(o for o in s.objects if o.name.startswith('BB_BTL'));mat=old.material_slots[0].material.copy()
 if glass=='Cobalt Blue':
  col,den=ns['ABSORB'][glass]
  for n in mat.node_tree.nodes:
   if n.type=='VOLUME_ABSORPTION':n.inputs['Color'].default_value=(*col,1);n.inputs['Density'].default_value=den
 with bpy.data.libraries.load(str(source),link=False) as (src,dst):dst.objects=[n for n in src.objects if n.startswith('Bottle | Cylinder 5 ml')]
 o=dst.objects[0];s.collection.objects.link(o);o.name='BB_BTL_Cylinder5_source_profile';o.data=o.data.copy();o.data.materials.clear();o.data.materials.append(mat)
 for p in o.data.polygons:p.material_index=0;p.use_smooth=True
 oldcoords=[tuple(v.co) for v in o.data.vertices]
 for v in o.data.vertices:
  x,y,z=[a*1000 for a in v.co];r=math.hypot(x,y)
  if z>=43.8 or r<1e-6:continue
  # Exterior mapping leaves the closure seat / threaded finish untouched.
  outside=lerp(z,[(0,8.727),(3,8.727),(37.5,8.83),(39,8.83),(40,8.698),(41,8.184),(42,6.764),(43,5.954),(43.8,5.84)])
  desired=lerp(z,[(0,8.5),(39,8.5),(40,8.37),(41,7.85),(42,6.55),(43,5.92),(43.8,5.84)])
  rr=r*desired/outside
  if 3.5<z<42 and r<7.5:
   wallfade=lerp(z,[(3.5,0),(4.0,1),(35.5,1),(42,0)])
   rr+=.43*wallfade*min(r/6.6,1)
   z-=1.6*lerp(z,[(3.5,0),(4,1),(5.5,1),(12,0),(42,0)])
  # Tighter outer heel; retain the level foot and closed interior base.
  elif z<8 and r>7.5:z=lerp(z,[(0,0),(3,1.95),(8,8)])
  v.co=(x*rr/r/1000,y*rr/r/1000,z/1000)
 o.data.update();bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(o.data);bm.free()
 # Record exact preservation of all vertices in the 13-415 finish.
 assert all(tuple(v.co)==co for v,co in zip(o.data.vertices,oldcoords) if co[2]>=.0438)
 render(o,'glass-5-'+('clear' if glass=='Clear' else 'cobalt')+'-profile-v4',53.12,42.4,['wall and heel thickness inferred from original PSD glass appearance; not manufacturing dimensions'])
print('PROFILE CORRECTIONS COMPLETE',flush=True)
