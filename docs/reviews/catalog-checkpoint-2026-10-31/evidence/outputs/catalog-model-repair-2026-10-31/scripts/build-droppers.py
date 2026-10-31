import bpy,bmesh,math,json,sys,traceback
from pathlib import Path
from mathutils import Vector,Matrix
r=Path(sys.argv[sys.argv.index('--')+1]).resolve();out=r/'working/dropper-assemblies';out.mkdir(exist_ok=True);q=json.loads((r/'sources/audit-queue.json').read_text());allsku=json.loads((r/'sources/catalog-production.json').read_text())['rows'];prior={a['sku']:a for a in json.loads((r/'reports/per-sku-defects.json').read_text())};cyl=next(r/'working/native'/a['id']/'model-v2.blend' for a in q if 'clear_STUDIO-v1.5' in a['id']);base=r/'working/empire-assemblies/empire-50-mist/model.blend'
def legacy(ident):
 d=r/'working/legacy'/ident;rp=d/'repair-report.json'
 for n in range(2,7):
  f=d/f'repair-report-v{n}.json'
  if f.exists() and json.loads(f.read_text()).get('disposition')!='rejected refinement':rp=f
 return Path(json.loads(rp.read_text())['workingCopy'])
bodies={'circle-50ml-18-415':legacy('glb-bodies__Cr-boxy-18-415-87x72x23'),'elegant-60ml-18-415':legacy('glb-bodies__Elg-boxy-18-415-86x54x27'),'round-128ml-18-415':legacy('glb-bodies__Rnd-round-18-415-83x69'),'slim-30ml-18-415':legacy('glb-bodies__Slm-boxy-18-415-87x30x30'),'empire-50ml-18-415':base}
def load_obj(path,selector):
 with bpy.data.libraries.load(str(path),link=False) as (data,dst):dst.objects=[n for n in data.objects if selector(n)][:1]
 o=dst.objects[0];return o

def clean(o):
 bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-7);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));nm=sum(not e.is_manifold for e in bm.edges);bm.to_mesh(o.data);bm.free();return nm

def loft(profile,name):
 n=192;vs=[(rad*math.cos(math.tau*j/n)/1000,rad*math.sin(math.tau*j/n)/1000,z/1000) for rad,z in profile for j in range(n)];fs=[]
 for k in range(len(profile)):
  for j in range(n):fs.append((k*n+j,k*n+(j+1)%n,((k+1)%len(profile))*n+(j+1)%n,((k+1)%len(profile))*n+j))
 me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update();o=bpy.data.objects.new(name,me);bpy.context.scene.collection.objects.link(o);clean(o);return o

def boolop(o,c):
 bpy.context.view_layer.objects.active=o;m=o.modifiers.new('Applied internal cavity','BOOLEAN');m.operation='DIFFERENCE';m.solver='EXACT';m.object=c;bpy.ops.object.modifier_apply(modifier=m.name);bpy.data.objects.remove(c,do_unlink=True);clean(o)
queue=[]
for sku in allsku:
 k=sku.get('websiteSku') or sku.get('graceSku');row=prior.get(k,{})
 if sku.get('applicator')!='Dropper' or row.get('bodyId') not in bodies:continue
 bid=row['bodyId'];glass=sku.get('color');finish='gold' if 'Gold' in (sku.get('capColor') or '') else 'matte-copper' if 'Copper' in (sku.get('capColor') or '') else 'shiny-silver';ident=bid+'-'+glass.lower()+'-dropper-'+finish;d=out/ident;d.mkdir(exist_ok=True)
 try:
  bpy.ops.wm.open_mainfile(filepath=str(base),load_ui=False,use_scripts=False);s=bpy.context.scene;original=next(o for o in s.objects if o.type=='MESH' and o.name.startswith('BB_BTL'));glassmat=original.data.materials[0].copy();colls=list(original.users_collection);oldhardware=[o for o in s.objects if o.type=='MESH' and o.name.lower().startswith(('sprayer','pump','roller','cap_'))];white=next((o.data.materials[0] for o in oldhardware if 'white actuator' in o.name and o.data.materials),None)
  receivers=set(c for o in oldhardware for c in o.users_collection);oldnames=[o.name for o in oldhardware]
  for o in oldhardware:o.hide_render=True
  if bid!='empire-50ml-18-415':
   body=load_obj(bodies[bid],lambda n:n.lower().startswith(('bottle','bb_btl')))
   for c in colls:c.objects.link(body)
   original.hide_render=True;original.name='REFERENCE ONLY | Empire source body'
  else:body=original
  body.hide_render=False;body.hide_set(False);body.name='BB_BTL | '+bid+' '+glass;body.data.materials.clear();body.data.materials.append(glassmat)
  for poly in body.data.polygons:poly.material_index=0
  if glass=='Frosted':
   for node in glassmat.node_tree.nodes:
    if node.type=='BSDF_PRINCIPLED':node.inputs['Roughness'].default_value=.23
    elif node.type=='BSDF_GLASS':node.inputs['Roughness'].default_value=.23
  rim=max((body.matrix_world@v.co).z for v in body.data.vertices);inv=body.matrix_world.inverted();ev=body.evaluated_get(bpy.context.evaluated_depsgraph_get());hit,pt,n,ix=ev.ray_cast(inv@Vector((0,0,rim+.03)),inv.to_3x3()@Vector((0,0,-1)));floor=(body.matrix_world@pt).z if hit else rim
  if not hit or floor>rim*.3:raise ValueError('Body interior is not a valid open vessel')
  fin=load_obj(cyl,lambda n:n=='Sheet | '+finish+' collar 13-415');metal=fin.data.materials[0];bpy.data.objects.remove(fin,do_unlink=True)
  parts={}
  for key in ['COLLAR','BULB','PIPETTE']:
   pp=legacy('glb-closures__BB_DRP_'+key+'_18415');o=load_obj(pp,lambda n:True);s.collection.objects.link(o)
   for c in receivers:
    if o.name not in c.objects:c.objects.link(o)
   o.name='dropper | '+key.lower();o.hide_render=False;o.hide_set(False);o.data.materials.clear();o.data.materials.append(metal if key=='COLLAR' else white if key=='BULB' else glassmat)
   for poly in o.data.polygons:poly.material_index=0
   o.location.z+=rim;parts[key]=o
  pipe=parts['PIPETTE'];bulb=parts['BULB'];beforetip=min((pipe.matrix_world@v.co).z for v in pipe.data.vertices)
  # Save the unfitted PSD-derived pipette for a faithful length comparison.
  bpy.ops.wm.save_as_mainfile(filepath=str(d/'before-unfitted.blend'),compress=True)
  zmin=min(v.co.z for v in pipe.data.vertices);zmax=max(v.co.z for v in pipe.data.vertices);delta=(floor+.0005)-(rim+zmin);taper=-.0445
  for v in pipe.data.vertices:
   if v.co.z<=taper:v.co.z+=delta
   else:
    t=(v.co.z-taper)/(zmax-taper);v.co.z+=delta*(1-t)+.0016*t
  pipe.data.update();clean(pipe)
  # Hollow the rubber without changing its measured exterior, and seat the pipette 0.6 mm into its neck.
  prof=[(.0,1.8),(3.40,1.8),(3.40,3.3),(4.10,5),(4.10,13.8),(3.95,15.4),(3.2,17),(2.1,18.4),(0,19.4)];cut=loft([(rad,z+rim*1000) for rad,z in prof],'Temporary bulb internal cavity');boolop(bulb,cut)
  for o in [body,*parts.values()]:
   for poly in o.data.polygons:poly.use_smooth=abs(poly.normal.z)<.99999
  checks={o.name:clean(o) for o in [body,*parts.values()]};s.render.use_border=False;s.render.use_crop_to_border=False;s.camera.data.clip_start=.00001;s.camera.data.clip_end=100;bpy.ops.wm.save_as_mainfile(filepath=str(d/'model.blend'),compress=True)
  rep={'id':ident,'sku':k,'workingCopy':str(d/'model.blend'),'beforeCopy':str(d/'before-unfitted.blend'),'bodySource':str(bodies[bid]),'sourceParts':'pipeline/paper-doll-3d/scripts/closures.py: PSD-derived 18-415 dropper, 2026-08-31','bodyId':bid,'glass':glass,'finish':finish,'shoulderMm':rim*1000-15.8,'changes':[{'code':'PIPETTE-LENGTH','detail':'Fitted the straight shaft to 0.5 mm above the interior floor; preserved 6.7 mm OD, 4.2 mm bore and the source tapered tip'},{'code':'BULB-CAVITY','detail':'Added inferred inner rubber cavity without changing the measured exterior; inserted pipette 0.6 mm into bulb neck'}],'checks':checks,'beforeFloorGapMm':(beforetip-floor)*1000,'afterFloorGapMm':.5,'qualification':'PSD-derived external dropper dimensions; body interior and rubber cavity inferred. Exact-SKU fit and physical accuracy need source qualification.'};(d/'repair-report.json').write_text(json.dumps(rep,indent=2));queue.append(rep);print('DROPPER_BUILT',ident,checks,flush=True)
 except Exception as e:print('DROPPER_ERROR',k,str(e),traceback.format_exc(),flush=True)
(r/'sources/dropper-assembly-queue.json').write_text(json.dumps(queue,indent=2));print('DROPPER_COMPLETE',len(queue),flush=True)
