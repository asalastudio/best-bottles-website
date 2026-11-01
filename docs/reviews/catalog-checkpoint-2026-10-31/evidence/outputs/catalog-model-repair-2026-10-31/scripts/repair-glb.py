"""Repair legacy geometry into isolated .blend/.glb copies; inferred cavities stay review-only."""
import bpy,bmesh,json,sys,math,traceback
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
r=Path(sys.argv[sys.argv.index('--')+1]).resolve();q=json.loads((r/'sources/audit-queue.json').read_text());out=r/'working/legacy';out.mkdir(exist_ok=True)
q.sort(key=lambda a:(0 if 'Flair' in a['id'] else 1 if any(t in a['id'] for t in ['Tulip','53x17','Atom','22x33']) else 2,a['id']))
native=r/'working/native';nq=[a for a in q if a['kind']=='blend']
def closed_loft(name,rings):
 n=len(rings[0]);vs=sum(rings,[]);fs=[]
 for k in range(len(rings)-1):
  for j in range(n):l=(j+1)%n;fs.append((k*n+j,k*n+l,(k+1)*n+l,(k+1)*n+j))
 fs += [tuple(range(n-1,-1,-1)),tuple((len(rings)-1)*n+j for j in range(n))]
 me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update();o=bpy.data.objects.new(name,me);bpy.context.scene.collection.objects.link(o);return o
def boolean(o,c,op):
 bpy.context.view_layer.objects.active=o;m=o.modifiers.new('Repair '+op,'BOOLEAN');m.solver='EXACT';m.operation=op;m.object=c;bpy.ops.object.modifier_apply(modifier=m.name);bpy.data.objects.remove(c,do_unlink=True)
def cleanup(o):
 bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-7);bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=1e-8);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
def geometry_report(o):
 bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-7);v={'nonManifoldEdges':sum(not e.is_manifold for e in bm.edges),'boundaryEdges':sum(e.is_boundary for e in bm.edges),'inconsistentNormalEdges':sum(e.is_manifold and not e.is_contiguous for e in bm.edges),'degenerateFaces':sum(f.calc_area()<1e-16 for f in bm.faces),'signedVolumeMm3':bm.calc_volume(signed=True)*1e9};bm.free();return v
for row in q:
 if row['kind']!='glb':continue
 d=out/row['id'];d.mkdir(exist_ok=True)
 if (d/'repair-report.json').exists():continue
 try:
  bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=row['path']);s=bpy.context.scene;changes=[];inferred=[];unresolved=[]
  meshes=[o for o in s.objects if o.type=='MESH'];isbody='glb-bodies' in row['id'];o=meshes[0]
  bpy.ops.object.select_all(action='DESELECT')
  for ob in meshes:ob.select_set(True)
  bpy.context.view_layer.objects.active=o;bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
  # Superseded silhouette aliases use the later caliper-qualified native body.
  replacement=None
  if any(t in row['id'] for t in ['Cyl-round-13-415-53x17']):replacement=next(a for a in nq if 'clear_STUDIO-v1.5' in a['id'])
  elif any(t in row['id'] for t in ['Cyl-round-17-415-70x20']):replacement=next(a for a in nq if 'mist-black-clear' in a['id'])
  elif 'TallCyl-round-13-415-106x18' in row['id']:replacement=next(a for a in nq if 'Tall-9ml-13-415_clear' in a['id'])
  if replacement:
   src=native/replacement['id']/'model.blend'
   with bpy.data.libraries.load(str(src),link=False) as (data,dst):dst.objects=[n for n in data.objects if n.lower().startswith(('bottle','bb_btl'))]
   new=dst.objects[0];s.collection.objects.link(new);new.hide_render=False;new.hide_set(False);bpy.data.objects.remove(o,do_unlink=True);o=new;meshes=[new];changes.append({'code':'MEASURED-BODY','detail':'Replaced superseded traced body with current native caliper-qualified body','source':str(src)})
  elif 'Flair-boxy' in row['id']:
   src=r/'working/flair-15ml-13-415/Flair-15ml-13-415-v2.blend'
   with bpy.data.libraries.load(str(src),link=False) as (data,dst):dst.objects=[n for n in data.objects if n.startswith('Bottle | Flair')]
   new=dst.objects[0];s.collection.objects.link(new);bpy.data.objects.remove(o,do_unlink=True);o=new;meshes=[new];changes.append({'code':'PROFILE-CAVITY','detail':'Flair continuous loft with source-locked measured 13-415 finish and open interior'});inferred.extend(['Flair flutes/cross-sections constrained by photographs','Flair interior thickness and floor; not a manufacturing model'])
  for ob in meshes:
   before=geometry_report(ob);cleanup(ob)
   if before['nonManifoldEdges'] or before['degenerateFaces'] or before['signedVolumeMm3']<0:changes.append({'code':'TOPOLOGY','object':ob.name,'before':before,'detail':'Weld split vertices, remove degenerates and consistently orient faces'})
  # Close missing annular seams in lathed legacy closures; keep their actual bores open.
  if not isbody and geometry_report(o)['boundaryEdges']:
   bm=bmesh.new();bm.from_mesh(o.data);edges=[e for e in bm.edges if e.is_boundary];remaining=set(edges);loops=[]
   while remaining:
    todo=[remaining.pop()];loop=[]
    while todo:
     e=todo.pop();loop.append(e)
     for v in e.verts:
      for e2 in v.link_edges:
       if e2 in remaining:remaining.remove(e2);todo.append(e2)
    loops.append(loop)
   if len(loops)==2 and len(loops[0])==len(loops[1]):
    bmesh.ops.bridge_loops(bm,edges=edges,use_pairs=True);changes.append({'code':'OPEN-SEAM','detail':'Bridged the missing annulus between matching inner/outer boundary rings; bore retained'})
   elif len(loops)==1 and 'DRP_BULB' in row['id']:
    bmesh.ops.holes_fill(bm,edges=edges,sides=0);changes.append({'code':'OPEN-SEAM','detail':'Closed the hidden lower end of the rubber dropper bulb'})
   else:unresolved.append('Irregular open/non-manifold sculpted component needs source-qualified surface reconstruction; not blindly filled.')
   bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
  if isbody and not replacement and 'Flair-boxy' not in row['id']:
   fitpath=r/'audit/fit'/f"{row['id']}.json";fit=json.loads(fitpath.read_text()) if fitpath.exists() else {};opening=bool(fit.get('bodies') and fit['bodies'][0]['openingClear'])
   if geometry_report(o)['nonManifoldEdges']:
    # Thickness variants contain broken joins. The corresponding clean exterior is the safer reconstruction source.
    stem=Path(row['path']).stem;aliases={'Circle-disc':'Cr-boxy','Round-sphere':'Rnd-round','Elegant-oval':'Elg-boxy'}
    possibles=[a for a in q if a['id'].startswith('glb-bodies__') and (Path(a['path']).stem==stem)]
    if not possibles:
     unresolved.append('Open source seams lack an exact clean exterior counterpart; topology kept as a review hold.')
    else:
     old=o;before=set(s.objects);bpy.ops.import_scene.gltf(filepath=possibles[0]['path']);o=next(x for x in s.objects if x not in before and x.type=='MESH');bpy.context.view_layer.objects.active=o;bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);bpy.data.objects.remove(old,do_unlink=True);cleanup(o);meshes=[o];opening=False;changes.append({'code':'BROKEN-JOIN','detail':'Rebuilt from exact matching clean exterior, preserving envelope','source':possibles[0]['path']})
   if not opening and geometry_report(o)['nonManifoldEdges']==0:
    bvh=BVHTree.FromPolygons([v.co for v in o.data.vertices],[p.vertices[:] for p in o.data.polygons]);pts=[o.matrix_world@Vector(v) for v in o.bound_box];z0=min(p.z for p in pts);z1=max(p.z for p in pts);width=max(max(p.x for p in pts)-min(p.x for p in pts),max(p.y for p in pts)-min(p.y for p in pts));height=z1-z0
    wall=.0012 if width<.03 else .0016;floor=min(.003,max(.0015,height*.055));rings=[];seg=128
    # An explicit 3D cavity; the rim/floor assumptions are listed rather than implied to be measured.
    for k in range(161):
     z=z0+floor+(height-floor+.002)*k/160;zr=min(z,z1-.00005);ring=[]
     for j in range(seg):
      a=math.tau*j/seg;direction=Vector((math.cos(a),math.sin(a),0));start=Vector((direction.x*width*2,direction.y*width*2,zr));hit,n,idx,dist=bvh.ray_cast(start,-direction,width*3)
      rr=max(.001,(hit.xy.length if hit else width*.15)-wall);ring.append((rr*direction.x,rr*direction.y,z))
     rings.append(ring)
    cutter=closed_loft('Inferred hollow interior',rings);boolean(o,cutter,'DIFFERENCE');cleanup(o);changes.append({'code':'CAVITY','detail':'Opened rim and added explicit inner glass surface','wallMm':wall*1000,'floorMm':floor*1000});inferred.append('Interior wall/floor inferred from envelope; capacity and neck bore require manufacturer measurements')
  # Both old generic dip tubes were solid bent rods. Preserve source envelope length, use measured mist OD/bore.
  if 'BB_DIP_TUBE' in row['id']:
   zs=[(o.matrix_world@v.co).z for v in o.data.vertices];bottom,top=min(zs),max(zs);ro=.000845;ri=.000445;n=128;vs=[]
   for z,rad in [(bottom,ro),(top,ro),(bottom,ri),(top,ri)]:vs.extend((rad*math.cos(math.tau*j/n),rad*math.sin(math.tau*j/n),z) for j in range(n))
   fs=[]
   for j in range(n):k=(j+1)%n;fs.extend([(j,k,n+k,n+j),(2*n+j,3*n+j,3*n+k,2*n+k),(j,2*n+j,2*n+k,k),(n+j,n+k,3*n+k,3*n+j)])
   me=bpy.data.meshes.new('Straight hollow mist tube');me.from_pydata(vs,[],fs);me.update();o.data=me;cleanup(o);changes.append({'code':'TUBE-AXIS','detail':'Straight hollow mist tube, native measured OD 1.69 / bore 0.89 mm'});unresolved.append('Standalone tube length must be fitted to each assembled bottle; generic asset has no associated cavity floor.')
  checks=[{'object':ob.name,**geometry_report(ob)} for ob in meshes]
  for c in checks:
   if c['nonManifoldEdges'] or c['inconsistentNormalEdges'] or c['degenerateFaces']:unresolved.append('Remaining topology hold: '+c['object'])
  for ob in meshes:
   for p in ob.data.polygons:p.use_smooth=True
  bpy.ops.wm.save_as_mainfile(filepath=str(d/'model.blend'),compress=True)
  bpy.ops.object.select_all(action='DESELECT')
  for ob in meshes:ob.select_set(True)
  bpy.ops.export_scene.gltf(filepath=str(d/'model.glb'),export_format='GLB',use_selection=True,export_materials='NONE',export_yup=True)
  report={'id':row['id'],'source':row['path'],'sourceSha256':row['sha256'],'changes':changes,'checks':checks,'inferred':inferred,'unresolved':unresolved,'disposition':'review hold' if unresolved else 'geometry repaired; visual review pending','workingCopy':str(d/'model.blend')};(d/'repair-report.json').write_text(json.dumps(report,indent=2))
  # Uniform technical screenshot; beauty renders are a separate step.
  pts=[ob.matrix_world@Vector(v) for ob in meshes for v in ob.bound_box];lo=Vector([min(p[i] for p in pts) for i in range(3)]);hi=Vector([max(p[i] for p in pts) for i in range(3)]);c=(lo+hi)/2;span=hi-lo
  s.render.engine='BLENDER_WORKBENCH';s.render.resolution_x=520;s.render.resolution_y=650;s.render.resolution_percentage=100;sh=s.display.shading;sh.color_type='SINGLE';sh.single_color=(.64,.69,.72);sh.show_cavity=True;sh.cavity_type='BOTH';sh.background_type='WORLD';s.world=bpy.data.worlds.new('Technical review background');s.world.color=(.8,.79,.76)
  cd=bpy.data.cameras.new('Review camera');cd.type='ORTHO';cd.ortho_scale=max(span.z,span.x*1.25,span.y*1.25)*1.38;cd.clip_start=.00001;cd.clip_end=100;cam=bpy.data.objects.new('Review camera',cd);s.collection.objects.link(cam);cam.location=c+Vector((.06,-.4,.04));cam.rotation_euler=(c-cam.location).to_track_quat('-Z','Y').to_euler();s.camera=cam;s.render.filepath=str(d/'geometry-after.png');bpy.ops.render.render(write_still=True)
  print('LEGACY_REPAIRED',row['id'],'changes',len(changes),'holds',len(unresolved),flush=True)
 except Exception as e:(d/'error.json').write_text(json.dumps({'error':str(e),'traceback':traceback.format_exc()},indent=2));print('LEGACY_ERROR',row['id'],str(e),flush=True)
print('LEGACY_REPAIR_COMPLETE',flush=True)
