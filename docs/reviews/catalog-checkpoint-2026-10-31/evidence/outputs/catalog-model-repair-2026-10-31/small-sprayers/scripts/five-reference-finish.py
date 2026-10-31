from pathlib import Path
import bpy,sys,json,math,hashlib,bmesh
OUT=Path(__file__).resolve().parents[1]
SRC=Path('/Users/jordanrichter/Documents/Codex/2026-09-24/the-image-is-clearly-the-target/outputs/cyl9-17415-studio-2026-09-30/export.py')
sys.argv=['blender','--','review'];ns={'__file__':str(SRC),'__name__':'review'};exec(compile(SRC.read_text(),str(SRC),'exec'),ns);ns['RAW']=OUT/'renders'
def smooth(x):
 t=max(0,min(1,x));return t*t*(3-2*t)
def lerp(x,points):
 for (a,b),(c,d) in zip(points,points[1:]):
  if x<=c:return b+(d-b)*max(0,min(1,(x-a)/(c-a)))
 return points[-1][1]
checks=[]
for glass,source_version in [('clear',16),('cobalt',9)]:
 source=OUT/'renders'/f'glass-5-{glass}-measured-v{source_version}.blend';bpy.ops.wm.open_mainfile(filepath=str(source));s=bpy.context.scene;o=bpy.data.objects['BB_BTL_Cylinder5_measured_envelope']
 # Only the newly measured diameters change. Height, datums, root OD, rim wall,
 # thread-crest wall and approved per-glass appearance remain intact.
 max_r=max(math.hypot(v.co.x,v.co.y)*1000 for v in o.data.vertices if .008<v.co.z<.038);delta=max_r-17.45/2
 for v in o.data.vertices:
  x,y,z=[c*1000 for c in v.co];r=math.hypot(x,y)
  if r<1e-7:continue
  rr=r
  if z<=40.10:rr-=delta*max(0,min(1,(r-7)/1))
  elif z<42.2:
   threshold=lerp(z,[(40.1,7),(40.8,6.2),(41.5,5),(42.2,4.85)])
   if r>threshold:rr-=delta*(1-smooth((z-40.1)/2.1))
  if z>=43.8 and r>5.5:rr=6+(r-6)*(.30/.32) if r>=6 else r
  if 40.8<z<51.95 and r<4.5:
   rr=r-.02*smooth((z-40.8)/.7)*(1-smooth((z-51.5)/.45))
  # Reconcile the measured walls with a constant 7.32 mm bore. The former
  # 12 mm plain rim / 8.40 mm flared opening was an unsupported assumption.
  # Plain rim and unthreaded lands become 10.92 mm OD; actual thread roots stay 12.
  if r>4.7:
   rr-=.54*smooth((z-41.3)/.9)*(1-smooth((z-43.45)/.45))
   rr-=.54*smooth((z-44.9)/.35)*(1-smooth((z-46.55)/.65))
  if z>51.5:rr-=.54*smooth((z-51.5)/.45)
  v.co=(x*rr/r/1000,y*rr/r/1000,z/1000)
 o.data.update();bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(o.data);bm.free();bpy.context.view_layer.update()
 meta=json.loads((OUT/'renders'/f'glass-5-{glass}-measured-v{source_version}.json').read_text());meta.update({'sourceScene':str(source),'dimensionsMm':[round(v*1000,4) for v in o.dimensions],'geometrySha256':ns['geo'](o),'finalDiameterUpdate':{'bodyMm':17.45,'outsideThreadMm':12.60,'rootMm':12,'threadBoreMm':7.32,'plainRimMm':10.92,'plainLandMm':10.92,'inference':'Uniform bore; rim OD derived from 1.80 mm wall, plain land matched to rim and clear reference; thread roots remain 12.00 mm','source':'Jordan revised caliper readings, 2026-10-31 after clear reference review'},'status':'Final diameter update on approved per-glass appearance; local review only'})
 stem=f'glass-5-{glass}-measured-v19';ns['gpu'](s,128);bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'renders'/f'{stem}.blend'));ns['render'](s,stem,128,meta)
 checks.append({'glass':glass,'geometrySha256':meta['geometrySha256']});print('FINAL DIAMETERS',glass,meta['dimensionsMm'],flush=True)
assert checks[0]['geometrySha256']==checks[1]['geometrySha256'],checks
(OUT/'five-final-diameter-shared-geometry.json').write_text(json.dumps(checks,indent=2))
