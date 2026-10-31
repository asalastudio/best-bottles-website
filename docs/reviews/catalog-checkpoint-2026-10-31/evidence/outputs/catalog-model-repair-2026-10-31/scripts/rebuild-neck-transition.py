import bpy,bmesh,json,sys,math,traceback
from pathlib import Path
from mathutils import Vector
r=Path(sys.argv[sys.argv.index('--')+1]).resolve();master=r/'working/empire-assemblies/empire-100-mist/model.blend'
def section(obj,z,above):
 bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.transform(bm,matrix=obj.matrix_world,verts=list(bm.verts));bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=1e-8,plane_co=(0,0,z),plane_no=(0,0,1),clear_outer=above,clear_inner=not above);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-7);bm.verts.ensure_lookup_table();bm.verts.index_update();vv=[v.co.copy() for v in bm.verts];ff=[[v.index for v in f.verts] for f in bm.faces];edges=[e for e in bm.edges if e.is_boundary];unseen=set(v for e in edges for v in e.verts);loops=[]
 while unseen:
  todo=[unseen.pop()];loop=[]
  while todo:
   v=todo.pop();loop.append(v.index)
   for e in v.link_edges:
    if not e.is_boundary:continue
    w=e.other_vert(v)
    if w in unseen:unseen.remove(w);todo.append(w)
  loops.append(loop)
 bm.free();loops.sort(key=lambda l:sum(math.hypot(vv[i].x,vv[i].y) for i in l)/len(l));return vv,ff,loops

def bridge(vs,aa,bb):
 aa=sorted(aa,key=lambda i:math.atan2(vs[i].y,vs[i].x));bb=sorted(bb,key=lambda i:math.atan2(vs[i].y,vs[i].x));av=[math.atan2(vs[i].y,vs[i].x) for i in aa];bv=[math.atan2(vs[i].y,vs[i].x) for i in bb];i=j=0;faces=[]
 while i<len(aa) or j<len(bb):
  na=av[(i+1)%len(aa)]+(math.tau if i+1>=len(aa) else 0) if i<len(aa) else 1e9;nb=bv[(j+1)%len(bb)]+(math.tau if j+1>=len(bb) else 0) if j<len(bb) else 1e9
  a=aa[i%len(aa)];b=bb[j%len(bb)]
  if abs(na-nb)<1e-8:faces.append((a,aa[(i+1)%len(aa)],bb[(j+1)%len(bb)],b));i+=1;j+=1
  elif na<nb:faces.append((a,aa[(i+1)%len(aa)],b));i+=1
  else:faces.append((a,bb[(j+1)%len(bb)],b));j+=1
 return faces
for f in sorted((r/'working/legacy').glob('*/repair-report-v3.json')):
 a=json.loads(f.read_text());d=f.parent;ident=a['id']
 if not ident.startswith('glb-bodies__') or '18-415' not in ident or 'Slm-boxy-18-415-121' in ident or not (d/'repair-report-v4.json').exists():continue
 try:
  bpy.ops.wm.open_mainfile(filepath=a['workingCopy'],load_ui=False,use_scripts=False);s=bpy.context.scene;o=next(x for x in s.objects if x.type=='MESH');height=max((o.matrix_world@v.co).z for v in o.data.vertices);shoulder=height-.0158
  v1,f1,l1=section(o,shoulder-.0005,True)
  with bpy.data.libraries.load(str(master),link=False) as (data,dst):dst.objects=[n for n in data.objects if n.lower().startswith(('bottle','bb_btl'))][:1]
  neck=dst.objects[0];s.collection.objects.link(neck);v2,f2,l2=section(neck,.09182,False);bpy.data.objects.remove(neck,do_unlink=True)
  if len(l1)!=2 or len(l2)!=2:raise ValueError('Expected inner and outer loops: '+str([len(l1),len(l2)]))
  off=len(v1);v2=[v+Vector((0,0,height-.10712)) for v in v2];vs=v1+v2;faces=f1+[[i+off for i in f] for f in f2]
  for la,lb in zip(l1,l2):faces+=bridge(vs,la,[i+off for i in lb])
  me=bpy.data.meshes.new('Body with native finish and fitted transition');me.from_pydata(vs,[],faces);me.update();o.data=me;o.matrix_world.identity();bm=bmesh.new();bm.from_mesh(me);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-7);bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=1e-8);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));check={'nonManifoldEdges':sum(not e.is_manifold for e in bm.edges),'degenerateFaces':sum(f.calc_area()<1e-16 for f in bm.faces),'signedVolumeMm3':bm.calc_volume(signed=True)*1e9};bm.to_mesh(me);bm.free()
  for p in me.polygons:p.use_smooth=abs(p.normal.z)<.99999
  bpy.context.view_layer.update();ev=o.evaluated_get(bpy.context.evaluated_depsgraph_get());hit,pt,_,_=ev.ray_cast(Vector((0,0,height+.01)),Vector((0,0,-1)));check['axialOpeningClear']=hit and pt.z<height*.3
  a['workingCopy']=str(d/'model-neck-v11.blend');a['changes'] += [{'code':'NECK-OVERHANG','detail':'Removed the donor shoulder plate. Joined the original body wall and cavity directly to the unchanged native 18-415 neck using closed inner and outer transition surfaces.'}];a['inferred'].append('The 1 mm neck-to-shoulder transition is reconstructed; native upper finish retained 1:1.');a['checks']=[check];a['disposition']='visual-production candidate; manufacturer qualification pending' if check['nonManifoldEdges']==check['degenerateFaces']==0 and check['axialOpeningClear'] else 'rejected refinement';bpy.ops.wm.save_as_mainfile(filepath=a['workingCopy'],compress=True);bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.ops.export_scene.gltf(filepath=str(d/'model-neck-v11.glb'),export_format='GLB',use_selection=True,export_materials='NONE');(d/'repair-report-v11.json').write_text(json.dumps(a,indent=2));print('TRANSITION',ident,check,a['disposition'],flush=True)
 except Exception as e:print('TRANSITION_ERROR',ident,str(e),traceback.format_exc(),flush=True)
print('TRANSITIONS_COMPLETE',flush=True)
