import bpy,bmesh,math,json,sys
from pathlib import Path
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
r=Path(sys.argv[sys.argv.index('--')+1]).resolve();repo=r.parents[1];sys.path.insert(0,str(repo/'pipeline/paper-doll-3d/scripts'));from bottle_bodies import _rounded_rect_ring
q=json.loads((r/'sources/audit-queue.json').read_text());base=next(a for a in q if 'clear_STUDIO-v1.5' in a['id']);basepath=r/'working/native'/base['id']/'model.blend';out=r/'working/priority-assemblies';out.mkdir(exist_ok=True)
def boolean(o,c,operation):
 bpy.context.view_layer.objects.active=o;m=o.modifiers.new('Applied repair','BOOLEAN');m.operation=operation;m.solver='EXACT';m.object=c;bpy.ops.object.modifier_apply(modifier=m.name);bpy.data.objects.remove(c,do_unlink=True)
def box(lo,hi):
 bpy.ops.mesh.primitive_cube_add(size=1,location=(Vector(lo)+Vector(hi))/2);o=bpy.context.object;o.dimensions=Vector(hi)-Vector(lo);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return o
def loft(name,rings):
 n=len(rings[0]);vs=sum(rings,[]);fs=[]
 for k in range(len(rings)-1):
  for j in range(n):l=(j+1)%n;fs.append((k*n+j,k*n+l,(k+1)*n+l,(k+1)*n+j))
 fs.extend([tuple(range(n-1,-1,-1)),tuple((len(rings)-1)*n+j for j in range(n))]);me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update();o=bpy.data.objects.new(name,me);bpy.context.scene.collection.objects.link(o);return o
def clean(o):
 bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-7);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));nm=sum(not e.is_manifold for e in bm.edges);vol=bm.calc_volume(signed=True)*1e6;bm.to_mesh(o.data);bm.free()
 for p in o.data.polygons:p.use_smooth=True
 return nm,vol
def lerp(z,pts,col=1):
 for a,b in zip(pts,pts[1:]):
  if z<=b[0]:
   t=max(0,min(1,(z-a[0])/(b[0]-a[0])));t=t*t*(3-2*t);return a[col]*(1-t)+b[col]*t
 return pts[-1][col]
for family in ['flair','sleek5','tulip5']:
 dest=out/family;dest.mkdir(exist_ok=True);height=56 if family=='flair' else 45;floor=3 if family=='flair' else 4
 if family=='flair':
  bpy.ops.wm.open_mainfile(filepath=str(r/'working/flair-15ml-13-415/Flair-15ml-13-415-v2.blend'),load_ui=False,use_scripts=False);s=bpy.context.scene;body=next(o for o in s.objects if o.name.startswith('Bottle | Flair'));notes=['Exterior cross sections and flute depth inferred from exact-SKU photos','1.6 mm wall and 3 mm floor are not measured'];delta=0
 else:
  bpy.ops.wm.open_mainfile(filepath=str(basepath),load_ui=False,use_scripts=False);s=bpy.context.scene;original=next(o for o in s.objects if o.name.startswith('Bottle |'));glass=original.data.materials[0];delta=(height-53.12)/1000
  finish=original.copy();finish.data=original.data.copy();s.collection.objects.link(finish);boolean(finish,box((-.1,-.1,.04212),(.1,.1,.1)),'INTERSECT');finish.location.z+=delta;bpy.context.view_layer.objects.active=finish;bpy.ops.object.select_all(action='DESELECT');finish.select_set(True);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
  rings=[]
  for k in range(241):
   z=34.25*k/240
   if family=='sleek5':
    hw=lerp(z,[(0,7.3),(1.5,8.25),(3,8.5),(30.5,8.5),(32,8.25),(34,5.6),(34.25,5.6)]);rad=lerp(z,[(0,2.3),(30.5,2.6),(34,5.6)]);coords=_rounded_rect_ring(hw,hw,min(hw,rad),192)
   else:
    hw=lerp(z,[(0,9.7),(1.5,10.7),(3.5,11.25),(15,11.5),(29.5,11.5),(31.3,11.0),(33,8),(34,5.6),(34.25,5.6)]);coords=[(hw*math.cos(math.tau*j/192),hw*math.sin(math.tau*j/192)) for j in range(192)]
   rings.append([(x/1000,y/1000,z/1000) for x,y in coords])
  body=loft('Bottle | '+family+' 5 ml review reconstruction',rings);boolean(body,finish,'UNION');clean(body)
  bvh=BVHTree.FromPolygons([v.co for v in body.data.vertices],[p.vertices[:] for p in body.data.polygons]);inside=[]
  for k in range(161):
   z=floor/1000+(.047-floor/1000)*k/160;ring=[]
   for j in range(128):
    a=math.tau*j/128;d=Vector((math.cos(a),math.sin(a),0));hit,n,idx,dist=bvh.ray_cast(Vector((0,0,min(z,.0339))),d,.1);rr=max(.003725,(dist if hit else .006)-.0016)
    if z>.031:blend=min(1,(z-.031)/.003);rr=rr*(1-blend)+.003725*blend
    ring.append((rr*d.x,rr*d.y,z))
   inside.append(ring)
  cavity=loft('Inferred 5 ml interior',inside);clean(cavity);bm=bmesh.new();bm.from_mesh(cavity.data);cavityml=abs(bm.calc_volume())*1e6;bm.free();boolean(body,cavity,'DIFFERENCE');body.data.materials.append(glass)
  if family=='tulip5':
   amb=next(a for a in q if a['id']=='native-dispenser-finishes-17415-v27__scenes__mist-black-amber')
   with bpy.data.libraries.load(amb['path'],link=False) as (data,dst):dst.materials=[x for x in data.materials if 'AMBER' in x.upper() and 'OPTICAL' in x.upper()][:1]
   if dst.materials and dst.materials[0]:body.data.materials[0]=dst.materials[0]
  for o in s.objects:
   if o is original or o is body:continue
   if any(c.name.startswith('Sheet |') for c in o.users_collection):o.location.z+=delta
  original.name='REFERENCE ONLY | measured Cylinder 5 ml source body';original.hide_render=True;original.hide_set(True)
  notes=['Published 45 mm height; '+('17 x 17 mm square' if family=='sleek5' else '23 mm diameter'),'Shoulder/base profile reconstructed from exact SKU image, not caliper-qualified','1.6 mm wall / 4 mm base inferred','Unmodified native measured 13-415 finish and compatible closure modules','Estimated brim cavity '+str(round(cavityml,3))+' ml (not a volume qualification)']
 # Rebuild the straight tube to the local cavity floor; keep exact native OD/ID and upper connection.
 tube=next(o for o in s.objects if 'dip tube' in o.name.lower() and 'barb' not in o.name.lower());top=max((tube.matrix_world@v.co).z for v in tube.data.vertices);lo=floor/1000+.0005;n=128;ro=.00071825;ri=.00031825;vs=[]
 for z,rad in [(lo,ro),(top,ro),(lo,ri),(top,ri)]:vs.extend((rad*math.cos(math.tau*j/n),rad*math.sin(math.tau*j/n),z) for j in range(n))
 fs=[]
 for j in range(n):l=(j+1)%n;fs.extend([(j,l,n+l,n+j),(2*n+j,3*n+j,3*n+l,2*n+l),(j,2*n+j,2*n+l,l),(n+j,n+l,3*n+l,3*n+j)])
 me=bpy.data.meshes.new('Straight local tube');me.from_pydata(vs,[],fs);me.update()
 for m in tube.data.materials:me.materials.append(m)
 tube.data=me;tube.matrix_world=Matrix.Identity(4);clean(tube);nm,vol=clean(body)
 for c in bpy.data.collections:
  if c.name.startswith('Sheet | '):c.hide_render=c.name not in ['Sheet | internals','Sheet | spray-matte-black']
 s.render.use_border=False;s.render.use_crop_to_border=False;s.camera.data.clip_start=.00001;s.camera.data.clip_end=100
 bpy.ops.wm.save_as_mainfile(filepath=str(dest/'model.blend'),compress=True)
 report={'id':'priority-'+family,'acceptanceClass':'visual-production reconstruction; review only','family':family,'sourceTemplate':str(basepath),'nonManifoldEdges':nm,'glassMaterialVolumeMl':vol,'tube':{'outerDiameterMm':1.4365,'boreMm':.6365,'floorClearanceMm':.5,'topMm':top*1000,'straight':True,'centered':True},'notes':notes,'workingCopy':str(dest/'model.blend'),'remaining':['Manufacturer cavity/profile qualification','Exact per-SKU closure finish and assembly review','Final visual approval']};(dest/'repair-report.json').write_text(json.dumps(report,indent=2));print('PRIORITY_ASSEMBLY',family,nm,flush=True)
print('PRIORITY_ASSEMBLIES_COMPLETE',flush=True)
