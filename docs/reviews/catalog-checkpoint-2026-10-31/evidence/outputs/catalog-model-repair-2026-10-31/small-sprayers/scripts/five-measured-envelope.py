from pathlib import Path
source=Path(__file__).with_name('correct-profiles.py')
exec(compile(source.read_text().split("for h,label in [(37,'3.3')")[0],str(source),'exec'))
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
    target=lerp(z,[(39.7,8.75),(40,8.65),(41,8.15),(42,6.90),(43,6.10),(43.8,6)])
    w=max(0,min(1,(r-4.5)/1.0));rr=r*(1-w+w*target/outside)
   else:
    # Thread roots 12.00 mm, crests 12.64 mm. Preserve helical topology.
    w=max(0,min(1,(r-4.5)/1.0));rr=r*(1-w)+w*(6+(r-5.835)*(.32/.78))
   v.co=(x*rr/r/1000,y*rr/r/1000,zz/1000)
  else:v.co.z=zz/1000
 o.data.update();bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(o.data);bm.free()
 render(o,'glass-5-'+('clear' if glass=='Clear' else 'cobalt')+'-measured-envelope-v5',53.23,40.10,['Subtle barrel bow interpolated around 17.55 mm nominal','Rim 1.80 / 2.64 mm meaning pending; existing throat retained in this envelope draft'])
 print('MEASURED ENVELOPE DRAFT: not staged until rim clarification',flush=True)
