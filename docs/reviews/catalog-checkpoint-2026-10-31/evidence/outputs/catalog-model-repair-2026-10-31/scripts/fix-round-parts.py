import bpy,bmesh,json,sys,math,importlib.util
from pathlib import Path
from mathutils import Matrix,Vector
r=Path(sys.argv[sys.argv.index('--')+1]).resolve();project=r.parents[1];path=project/'scripts/paper-doll-3d/components_17415.py';spec=importlib.util.spec_from_file_location('c17',path);c17=importlib.util.module_from_spec(spec);spec.loader.exec_module(c17)
for d in (r/'working/legacy').glob('*'):
 if not any(x in d.name for x in ['PMP_SPOUT','SPR_NOZZLE','SPR_ACTUATOR']):continue
 a=json.loads((d/'repair-report-v3.json').read_text());bpy.ops.wm.open_mainfile(filepath=a['workingCopy'],load_ui=False,use_scripts=False);s=bpy.context.scene;o=next(x for x in s.objects if x.type=='MESH');points=[o.matrix_world@v.co for v in o.data.vertices];n=192;fs=[]
 if 'ACTUATOR' in d.name:
  hs=dict(getattr(c17,'ACTUATOR_'+('18415' if '18415' in d.name else '17415')));hs['body_top_z']=min(hs['body_top_z'],hs['top_z']-hs['top_edge_r']);prof=c17.actuator_profile(hs)
  if prof[0]==prof[-1]:prof=prof[:-1]
  vs=[(rad*math.cos(math.tau*j/n)/1000,rad*math.sin(math.tau*j/n)/1000,z/1000) for rad,z in prof for j in range(n)]
  for k in range(len(prof)):
   for j in range(n):fs.append((k*n+j,k*n+(j+1)%n,((k+1)%len(prof))*n+(j+1)%n,((k+1)%len(prof))*n+j))
  detail='Rebuilt the source actuator profile with clean quad rings and automatic normals; removed the 0.02 mm backward crown step on the 17-415 profile. Source external dimensions retained.'
 else:
  lo=Vector([min(p[k] for p in points) for k in range(3)]);hi=Vector([max(p[k] for p in points) for k in range(3)]);c=(lo+hi)/2;rad=(hi.x-lo.x)/2;vs=[(c.x+rad*math.cos(math.tau*j/n),y,c.z+rad*math.sin(math.tau*j/n)) for y in [lo.y,hi.y] for j in range(n)]
  for j in range(n):fs.append((j,(j+1)%n,n+(j+1)%n,n+j))
  fs.extend([tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]);detail='Replaced the faceted 24/32-sided circular insert with 192 sides at the same diameter, thickness, center and mating position.'
 me=bpy.data.meshes.new(o.name+' | clean curved surface');me.from_pydata(vs,[],fs);me.update();bm=bmesh.new();bm.from_mesh(me);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-8);bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=1e-9);bmesh.ops.delete(bm,geom=[e for e in bm.edges if not e.link_faces],context='EDGES');bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));checks={'nonManifoldEdges':sum(not e.is_manifold for e in bm.edges),'degenerateFaces':sum(f.calc_area()<1e-16 for f in bm.faces),'volumeMm3':bm.calc_volume()*1e9};bm.to_mesh(me);bm.free();o.data=me;o.matrix_world=Matrix.Identity(4)
 for f in me.polygons:f.use_smooth=(abs(f.normal.z)<.9999 if 'ACTUATOR' in d.name else abs(f.normal.y)<.9999)
 a['workingCopy']=str(d/'model-curves-v8.blend');a['changes'].append({'code':'CURVED-SURFACE','detail':detail});a['checks'].append(checks);a['disposition']='geometry candidate; exact assembly qualification pending' if checks['nonManifoldEdges']==checks['degenerateFaces']==0 else 'rejected refinement';bpy.ops.wm.save_as_mainfile(filepath=a['workingCopy'],compress=True);bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.ops.export_scene.gltf(filepath=str(d/'model-curves-v8.glb'),export_format='GLB',use_selection=True,export_materials='NONE');(d/'repair-report-v8.json').write_text(json.dumps(a,indent=2));print('ROUND_PART_FIXED',d.name,checks,flush=True)
