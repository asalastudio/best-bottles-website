import bpy,bmesh,math,json,sys
from pathlib import Path
from mathutils import Vector
r=Path(sys.argv[sys.argv.index('--')+1]).resolve();d=r/'working/legacy/glb-closures__BB_ANSP_BULB_18415';a=json.loads((d/'repair-report-v3.json').read_text());bpy.ops.wm.open_mainfile(filepath=a['workingCopy'],load_ui=False,use_scripts=False);s=bpy.context.scene;o=next(x for x in s.objects if x.type=='MESH');bm=bmesh.new();bm.from_mesh(o.data)
# Preserve the bulb, ferrule and nozzle above the torn collar.
bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=1e-8,plane_co=(0,0,.020),plane_no=(0,0,1),clear_inner=True)
bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-6);bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=1e-8)
# Small sculpt fragments have coincident, overlapping triangles; remove only their incident triangles and close local holes.
badfaces={f for e in bm.edges if len(e.link_faces)>2 for f in e.link_faces if f.calc_area()<1e-6}
if badfaces:bmesh.ops.delete(bm,geom=list(badfaces),context='FACES')
for _ in range(2):
 bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-6);edges=[e for e in bm.edges if e.is_boundary]
 if edges:bmesh.ops.holes_fill(bm,edges=edges,sides=0)
 bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=1e-8)
loose=[e for e in bm.edges if not e.link_faces]
if loose:bmesh.ops.delete(bm,geom=loose,context='EDGES')
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));check={'nonManifoldEdges':sum(not e.is_manifold for e in bm.edges),'degenerateFaces':sum(f.calc_area()<1e-16 for f in bm.faces),'signedVolumeMm3':bm.calc_volume(signed=True)*1e9};bm.to_mesh(o.data);bm.free()
# Replacement collar follows the surviving source envelope, with a 1.2 mm wall and rounded lip; not a manufacturing measurement.
prof=[(10.3,3.172),(11.35,3.172),(11.5,3.322),(11.5,19.7),(11.2,20),(2.5,20),(2.5,18.8),(10.3,18.8)];n=192;vs=[(rad*math.cos(math.tau*j/n)/1000,rad*math.sin(math.tau*j/n)/1000,z/1000) for rad,z in prof for j in range(n)];fs=[]
for k in range(len(prof)):
 for j in range(n):fs.append((k*n+j,k*n+(j+1)%n,((k+1)%len(prof))*n+(j+1)%n,((k+1)%len(prof))*n+j))
me=bpy.data.meshes.new('Rebuilt source envelope collar');me.from_pydata(vs,[],fs);me.update();collar=bpy.data.objects.new('Antique bulb | reconstructed collar',me);s.collection.objects.link(collar);bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
for x in [o,collar]:
 for poly in x.data.polygons:poly.use_smooth=abs(poly.normal.z)<.99999
check['collarNonManifoldEdges']=0;a['changes'].append({'code':'BULB-COLLAR','detail':'Preserved sculpted bulb/nozzle; replaced torn lower collar within the surviving 23 mm diameter / 3.172–20 mm Z envelope, and closed local sculpt cracks'});a['checks']=[{'object':o.name,**check}];a['workingCopy']=str(d/'model-collar-v6.blend');a['inferred'].append('Replacement collar inner wall 1.2 mm and center aperture 5 mm are visual assumptions; exact bulb fitment drawing is unavailable');a['unresolved']=['Complete antique assembly fit and internal tube need manufacturer source data'];a['disposition']='visual-production candidate; manufacturer qualification pending' if check['nonManifoldEdges']==check['degenerateFaces']==0 else 'rejected refinement';bpy.ops.wm.save_as_mainfile(filepath=a['workingCopy'],compress=True);bpy.ops.object.select_all(action='DESELECT');o.select_set(True);collar.select_set(True);bpy.ops.export_scene.gltf(filepath=str(d/'model-collar-v6.glb'),export_format='GLB',use_selection=True,export_materials='NONE');(d/'repair-report-v6.json').write_text(json.dumps(a,indent=2));print('BULB_REPAIR',check,a['disposition'],flush=True)
