import bpy,bmesh,json,sys,math,time
from pathlib import Path
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
r=Path(sys.argv[sys.argv.index('--')+1]).resolve();args=sys.argv[sys.argv.index('--')+2:];limit=int(args[0]) if args else 999

def geo(o):
 ev=o.evaluated_get(bpy.context.evaluated_depsgraph_get());me=ev.to_mesh();vs=[o.matrix_world@v.co for v in me.vertices];fs=[list(p.vertices) for p in me.polygons];ev.to_mesh_clear();return vs,fs

def bvh(o):
 vs,fs=geo(o);return BVHTree.FromPolygons(vs,fs),vs

def repair_shell(o,bodytree,rim):
 tree,orig=bvh(o);lo=min(v.z for v in orig);hi=max(v.z for v in orig);radius=max(v.xy.length for v in orig);n=192
 # Keep the exterior angular ribbing; sample all major vertical levels with <=0.08 mm spacing.
 levels=sorted(set([round(v.z,7) for v in orig]+[z for z in [rim-.000001,rim+.00008,rim+.000081] if lo<z<hi]));levels=[z for i,z in enumerate(levels) if i==0 or z-levels[i-1]>.0000002]
 zs=[lo+.0000001]
 for z in levels[1:]:
  z=min(z,hi-.0000001);last=zs[-1]
  if z<=last:continue
  count=max(1,math.ceil((z-last)/.00008));zs.extend(last+(z-last)*k/count for k in range(1,count+1))
 vs=[];maxshift=0;minwall=1;errors=[]
 for z in zs:
  for j in range(n):
   angle=math.tau*j/n;v=Vector((math.cos(angle),math.sin(angle),0));axis=Vector((0,0,z));p,no,_,_=tree.ray_cast(axis+v*(radius+.002),-v,2*radius+.004)
   if p is None:raise ValueError('No exterior '+o.name+' '+str(z))
   outer=p.xy.length
   ip,ino,_,_=tree.ray_cast(axis,v,radius+.002)
   inner=ip.xy.length if ip is not None and ino.dot(v)<0 else 0
   required=0
   if z<=rim+.00008:
    neckaxis=Vector((0,0,min(z,rim-.000001)))
    bp,bn,_,_=bodytree.ray_cast(neckaxis+v*.03,-v,.03)
    if bp is not None:required=bp.xy.length+.000055
   if o.name=='dropper | collar' and rim<=z<rim+.00135:required=max(required,.0077)
   newinner=max(inner,required)
   if newinner>=outer-.00006:errors.append((z,outer,newinner))
   minwall=min(minwall,outer-newinner);maxshift=max(maxshift,newinner-inner)
   vs.append(tuple(axis+v*outer));vs.append(tuple(axis+v*newinner))
 if errors:raise ValueError('Insufficient wall '+o.name+' '+str(errors[:3]))
 fs=[]
 for k in range(len(zs)-1):
  for j in range(n):
   a=(k*n+j)*2;b=(k*n+(j+1)%n)*2;c=((k+1)*n+(j+1)%n)*2;d=((k+1)*n+j)*2
   fs.extend([(a,b,c,d),(a+1,d+1,c+1,b+1)])
 for j in range(n):
  a=j*2;b=((j+1)%n)*2;fs.append((a,a+1,b+1,b));a=((len(zs)-1)*n+j)*2;b=((len(zs)-1)*n+(j+1)%n)*2;fs.append((a,b,b+1,a+1))
 me=bpy.data.meshes.new(o.name+' | matched interior');me.from_pydata(vs,[],fs);me.update();bm=bmesh.new();bm.from_mesh(me);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-8);bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=1e-9);bmesh.ops.delete(bm,geom=[e for e in bm.edges if not e.link_faces],context='EDGES');bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_edges],context='VERTS');bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));nm=sum(not e.is_manifold for e in bm.edges);deg=sum(f.calc_area()<1e-17 for f in bm.faces);bm.to_mesh(me);bm.free()
 if nm or deg:raise ValueError('Invalid rebuilt shell '+o.name+' '+str((nm,deg)))
 materials=list(o.data.materials);o.data.use_fake_user=True;o.data=me;o.matrix_world=Matrix.Identity(4)
 for mat in materials:me.materials.append(mat)
 for p in me.polygons:p.use_smooth=abs(p.normal.z)<.99999
 return {'object':o.name,'maxInteriorReliefMm':maxshift*1000,'minWallMm':minwall*1000,'nonManifoldEdges':nm,'degenerateFaces':deg,'angularSamples':n,'verticalSlices':len(zs),'exterior':'Original exterior sampled without resizing; internal female cavity clears the actual male neck by 0.055 mm'}

jobs=[]
for kind in ['native','priority-assemblies','empire-assemblies','dropper-assemblies']:
 for f in (r/'working'/kind).glob('*/repair-report.json'):
  d=f.parent;a=json.loads(f.read_text());ident=a['id']
  if kind=='native' and not any(x in ident for x in ['cyl5-','tall-9ml-']):continue
  if (d/'repair-report-v8.json').exists():continue
  chosen=f
  for n in range(2,7):
   p=d/f'repair-report-v{n}.json'
   if p.exists() and json.loads(p.read_text()).get('disposition')!='rejected refinement':chosen=p
  # Rebuild droppers from original clean exterior to avoid prior boolean scars.
  if kind=='dropper-assemblies':chosen=f
  jobs.append((chosen,kind))
for f,kind in jobs[:limit]:
 a=json.loads(f.read_text());d=f.parent;bpy.ops.wm.open_mainfile(filepath=a['workingCopy'],load_ui=False,use_scripts=False);bpy.context.view_layer.update();s=bpy.context.scene;body=next(o for o in s.objects if o.type=='MESH' and o.name.lower().startswith(('bottle','bb_btl')) and not o.hide_render);fixes=[]
 if kind=='dropper-assemblies' and 'working/legacy/' in a['bodySource']:
  bd=Path(a['bodySource']).parent;bf=bd/'repair-report.json'
  for n in range(2,10):
   nf=bd/f'repair-report-v{n}.json'
   if nf.exists() and json.loads(nf.read_text()).get('disposition')!='rejected refinement':bf=nf
  newpath=json.loads(bf.read_text())['workingCopy']
  if newpath!=a['bodySource']:
   mats=list(body.data.materials);cols=list(body.users_collection);oldname=body.name
   with bpy.data.libraries.load(newpath,link=False) as (data,dst):dst.objects=[n for n in data.objects if n.lower().startswith(('bottle','bb_btl'))][:1]
   fresh=dst.objects[0]
   for c in cols:c.objects.link(fresh)
   body.hide_render=True;body.name='REFERENCE ONLY | superseded dropper body';body=fresh;body.name=oldname;body.hide_render=False;body.data.materials.clear()
   for m in mats:body.data.materials.append(m)
   for face in body.data.polygons:face.material_index=0
   a['bodySource']=newpath;fixes.append({'code':'BODY-FINISH','detail':'Used the repaired body with a matching unscaled 18-415 finish'})
   bpy.context.view_layer.update()
 tree,bv=bvh(body);rim=max(p.z for p in bv)
 if kind=='priority-assemblies':
  tube=next(o for o in s.objects if 'dip tube' in o.name.lower() and 'barb' not in o.name.lower());barb=next(o for o in s.objects if 'barb' in o.name.lower());top=max((barb.matrix_world@v.co).z for v in barb.data.vertices)+.00005;tv=[tube.matrix_world@v.co for v in tube.data.vertices];lo=min(v.z for v in tv);old=max(v.z for v in tv);inv=tube.matrix_world.inverted()
  for v,p in zip(tube.data.vertices,tv):p.z=lo+(p.z-lo)*(top-lo)/(old-lo);v.co=inv@p
  tube.data.update();a.setdefault('tube',{})['topMm']=top*1000;fixes.append({'code':'TUBE-CONNECTION','detail':'Connected straight tube to the translated pump barb with the source 1 mm sleeve insertion; bottom remains 0.5 mm above floor','oldTopMm':old*1000,'newTopMm':top*1000})
 candidates=[]
 for o in s.objects:
  if o.type!='MESH':continue
  name=o.name.lower()
  if kind in ['native','priority-assemblies'] and ('collar 13-415' in name or name.startswith(('short-','liner-'))):candidates.append(o)
  elif kind=='empire-assemblies' and 'phenolic collar' in name and not o.hide_render:candidates.append(o)
  elif kind=='dropper-assemblies' and name=='dropper | collar':candidates.append(o)
 for o in candidates:
  try:fixes.append({'code':'CLOSURE-CLEARANCE','detail':repair_shell(o,tree,rim)})
  except Exception as e:print('SHELL_ERROR',a['id'],str(e),flush=True);raise
 # Seal washer is fitted in the existing cavity, avoiding glass and collar intersections.
 if kind=='dropper-assemblies':
  collar=s.objects['dropper | collar'];sealmat=s.objects['dropper | bulb'].data.materials[0]
  n=192;profile=[(.0034,rim+.000025),(.00765,rim+.000025),(.00765,rim+.00125),(.0034,rim+.00125)];vs=[(rad*math.cos(math.tau*j/n),rad*math.sin(math.tau*j/n),z) for rad,z in profile for j in range(n)];fs=[(k*n+j,k*n+(j+1)%n,((k+1)%4)*n+(j+1)%n,((k+1)%4)*n+j) for k in range(4) for j in range(n)];me=bpy.data.meshes.new('Seal');me.from_pydata(vs,[],fs);me.update();o=bpy.data.objects.new('dropper | seal washer',me);s.collection.objects.link(o);me.materials.append(sealmat);bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()

 if kind=='empire-assemblies':
  for o in s.objects:
   if o.type=='MESH' and not o.hide_render:
    bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=1e-8);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
 a['workingCopy']=str(d/'model-fit-v8.blend');a['changes']=a.get('changes',[])+fixes;a['disposition']='review candidate; fit checks pending';bpy.ops.wm.save_as_mainfile(filepath=a['workingCopy'],compress=True);(d/'repair-report-v8.json').write_text(json.dumps(a,indent=2));print('FINAL_MATING_REPAIRED',a['id'],len(fixes),flush=True)
