from pathlib import Path
source=Path(__file__).with_name('correct-profiles.py')
exec(compile(source.read_text().split("for h,label in [(37,'3.3')")[0],str(source),'exec'))
def smooth_profile(x,points):
 xs=[a for a,b in points];ys=[b for a,b in points]
 slopes=[(ys[i+1]-ys[i])/(xs[i+1]-xs[i]) for i in range(len(xs)-1)]
 tangent=[slopes[0]]+[0 if slopes[i-1]*slopes[i]<=0 else 2/(1/slopes[i-1]+1/slopes[i]) for i in range(1,len(slopes))]+[slopes[-1]]
 for i in range(len(xs)-1):
  if x<=xs[i+1]:
   h=xs[i+1]-xs[i];t=max(0,min(1,(x-xs[i])/h))
   return (2*t**3-3*t*t+1)*ys[i]+(t**3-2*t*t+t)*h*tangent[i]+(-2*t**3+3*t*t)*ys[i+1]+(t**3-t*t)*h*tangent[i+1]
 return ys[-1]
source=OUT.parent/'renders/comparisons-v7/native-cyl5-13415-v7-review-2026-09-29__Cyl-5ml-13-415_clear_STUDIO-v1.5-body-v7e/review-scene.blend'
for glass in ['Clear','Cobalt Blue']:
 bpy.ops.wm.open_mainfile(filepath=str(ns['LOT']));s=bpy.context.scene;ns['restudio'](s,glass);ns['look'](s,glass);old=next(o for o in s.objects if o.name.startswith('BB_BTL'));mat=old.material_slots[0].material.copy()
 if glass=='Cobalt Blue':
  col,den=ns['ABSORB'][glass]
  for n in mat.node_tree.nodes:
   if n.type=='VOLUME_ABSORPTION':n.inputs['Color'].default_value=(*col,1);n.inputs['Density'].default_value=den
 with bpy.data.libraries.load(str(source),link=False) as (src,dst):dst.objects=[n for n in src.objects if n.startswith('Bottle | Cylinder 5 ml')]
 o=dst.objects[0];s.collection.objects.link(o);o.name='BB_BTL_Cylinder5_measured_envelope';o.data=o.data.copy();o.data.materials.clear();o.data.materials.append(mat)
 for p in o.data.polygons:p.material_index=0;p.use_smooth=True
 old_min=min(v.co.z for v in o.data.vertices)*1000;old_max=max(v.co.z for v in o.data.vertices)*1000
 # All numeric envelope values come from Jordan's caliper measurements.
 # Barrel bow amplitude is a visual interpolation around his selected 17.55 mm nominal.
 for v in o.data.vertices:
  x,y,z=[a*1000 for a in v.co];r=math.hypot(x,y)
  zz=lerp(z,[(old_min,0),(4.37,4.43),(37.8,38.2),(39.7,40.1),(43.8,43.8),(old_max,53.23)])
  rr=r
  if r>1e-6:
   if z<39.7:
    old_radius=lerp(z,[(0,8.727),(3,8.727),(37.5,8.83),(39.7,8.83)])
    new_radius=8.75+.025*math.sin(math.pi*max(0,min(1,(zz-2)/38.1)))
    # Keep the existing cavity profile; its centre floor is explicitly 4.43 mm.
    w=max(0,min(1,(r-7.0)/1.0));rr=r*(1-w+w*new_radius/old_radius)
   elif z<43.8:
    outside=lerp(z,[(39.7,8.83),(40,8.698),(41,8.184),(42,6.764),(43,5.954),(43.8,5.835)])
    target=smooth_profile(zz,[(40.1,8.75),(40.3,8.72),(40.5,8.55),(40.8,8.10),(41.3,7.05),(41.8,6.25),(42.2,6),(43.8,6)])
    rr=target if r>4.7 else r
   else:
    # Thread roots 12.00 mm, crests 12.64 mm. Preserve helical topology.
    if r<4.5:rr=r*(3.68/3.685)
    else:
     crest=max(0,min(1,(r-5.835)/.78));rr=6+.32*math.sin(crest*math.pi/2)
    # Plain rim OD is taken as 12 mm. A flared lip reconciles the measured
    # 1.80 mm rim wall with the 2.64 mm thread-crest wall (bore 8.40 -> 7.36).
    lip=max(0,min(1,(z-51.5)/.45));lip=lip*lip*(3-2*lip)
    lip_radius=4.2+(r-3.685)*(1.8/2.5)
    rr=rr*(1-lip)+lip_radius*lip
   # Keep a smooth cavity transition under the shorter photographed shoulder.
   if 36<z<43.8 and r<lerp(z,[(36,7.7),(38,7.5),(39,6.5),(40,6.0),(41,5.8),(42,5.2),(43.8,4.7)]):
    original_inner=lerp(z,[(36,6.824),(37,6.451),(38,6.022),(39,5.017),(40,4.097),(41,3.694),(42,3.685),(43.8,3.685)])
    target_inner=smooth_profile(zz,[(36,6.824),(38.6,6.824),(39.1,6.6),(39.6,6.15),(40.2,5.3),(40.8,4.35),(41.5,3.68),(43.8,3.68)])
    rr=target_inner
   v.co=(x*rr/r/1000,y*rr/r/1000,zz/1000)
  else:v.co.z=zz/1000
 o.data.update();bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(o.data);bm.free()
 render(o,'glass-5-'+('clear' if glass=='Clear' else 'cobalt')+'-measured-v9',53.23,40.10,['Subtle barrel bow interpolated around 17.55 mm nominal; shoulder curvature reconstructed from upright IMG_6841 and side-on IMG_6845/6846; measured shoulder datum 40.10 mm','Plain rim OD assumed equal to the measured 12.00 mm root OD; 1.80 mm rim wall gives an 8.40 mm lip bore, tapering to 7.36 mm under 12.64 mm thread crests'])
 print('MEASURED BODY COMPLETE: 53.23 x 17.55; shoulder 40.10; internal depth 48.80',flush=True)
