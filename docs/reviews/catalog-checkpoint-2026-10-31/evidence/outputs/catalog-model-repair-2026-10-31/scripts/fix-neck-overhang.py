import bpy,bmesh,json,math,sys,re,traceback
from pathlib import Path
from mathutils import Vector
r=Path(sys.argv[sys.argv.index('--')+1]).resolve();q=json.loads((r/'sources/audit-queue.json').read_text())
masters={
 '13-415':(next(r/'working/native'/a['id']/'model-v2.blend' for a in q if 'clear_STUDIO-v1.5' in a['id']),.05312,.04212),
 '17-415':(next(r/'working/native'/a['id']/'model.blend' for a in q if 'mist-black-clear' in a['id']),.07131,.05914),
 '18-415':(r/'working/empire-assemblies/empire-100-mist/model.blend',.10712,.09132)}
def clean(o):
 bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-6);bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=1e-7);bmesh.ops.holes_fill(bm,edges=[e for e in bm.edges if e.is_boundary],sides=4);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);check={'nonManifoldEdges':sum(not e.is_manifold for e in bm.edges),'degenerateFaces':sum(f.calc_area()<1e-16 for f in bm.faces),'signedVolumeMm3':bm.calc_volume(signed=True)*1e9};bm.free();return check
def box(zlo,zhi):
 bpy.ops.mesh.primitive_cube_add(size=1,location=(0,0,(zlo+zhi)/2));c=bpy.context.object;c.dimensions=(.5,.5,zhi-zlo);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return c
def boolop(o,c,op):
 bpy.context.view_layer.objects.active=o;m=o.modifiers.new('Applied finish repair','BOOLEAN');m.solver='EXACT';m.operation=op;m.object=c;bpy.ops.object.modifier_apply(modifier=m.name);bpy.data.objects.remove(c,do_unlink=True)
for f in sorted((r/'working/legacy').glob('*/repair-report-v3.json')):
 a=json.loads(f.read_text());ident=a['id'];d=f.parent;finish=next((k for k in masters if k in ident),None)
 if not ident.startswith('glb-bodies__') or finish!='18-415' or any(k in ident for k in ['53x17','70x20','TallCyl','Flair','Rect-boxy-13-415-50','Slm-boxy-18-415-121','Tulip']):continue
 try:
  bpy.ops.wm.open_mainfile(filepath=a['workingCopy'],load_ui=False,use_scripts=False);s=bpy.context.scene;o=next(x for x in s.objects if x.type=='MESH');pts=[o.matrix_world@v.co for v in o.data.vertices];height=max(v.z for v in pts);floor=min(v.z for v in pts);src,srcH,srcSh=masters[finish];shoulder=height-(srcH-srcSh)
  # Remove high-frequency traced silhouette ripples with a strict 0.15 mm displacement bound.
  bm=bmesh.new();bm.from_mesh(o.data);original={v:v.co.copy() for v in bm.verts};vs=[v for v in bm.verts if floor+.003<v.co.z<shoulder-.001]
  for it in range(12):bmesh.ops.smooth_vert(bm,verts=vs,factor=.45,use_axis_x=True,use_axis_y=True,use_axis_z=False)
  for v in vs:
   delta=v.co-original[v]
   if delta.length>.00015:v.co=original[v]+delta.normalized()*.00015
  bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
  with bpy.data.libraries.load(str(src),link=False) as (data,dst):dst.objects=[n for n in data.objects if n.lower().startswith(('bottle','bb_btl'))][:1]
  neck=dst.objects[0];s.collection.objects.link(neck);neck.hide_render=False;neck.hide_set(False);boolop(neck,box(srcSh+.00001,srcH+.01),'INTERSECT');neck.location.z+=height-srcH;bpy.context.view_layer.objects.active=neck;bpy.ops.object.select_all(action='DESELECT');neck.select_set(True);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
  boolop(o,box(-.1,shoulder+.0002),'INTERSECT');boolop(o,neck,'UNION');check=clean(o)
  inv=o.matrix_world.inverted();ev=o.evaluated_get(bpy.context.evaluated_depsgraph_get());hit,point,n,idx=ev.ray_cast(inv@Vector((0,0,height+.01)),inv.to_3x3()@Vector((0,0,-1)));fz=(o.matrix_world@point).z if hit else height;check['axialOpeningClear']=hit and fz<floor+(height-floor)*.3
  a['changes'].extend([{'code':'NECK-OVERHANG','detail':'Excluded the donor bottle shoulder from the 18-415 neck extraction; retained the native neck at unchanged dimensions and the recipient body silhouette.'},{'code':'PROFILE-SMOOTH','detail':'Reduced traced contour ripples below the shoulder, preserving Z coordinates and limiting vertex displacement to 0.15 mm'},{'code':'FINISH-MASTER','detail':'Replaced traced neck with same-size native '+finish+' finish at 1:1 scale; retained nominal overall height','source':str(src)}]);a['checks']=[{'object':o.name,**check}];a['inferred'].append('Body contour smoothing limited to 0.15 mm; master finish alignment follows the nominal finish height, without per-bottle neck drawings');a['unresolved']=['Exact body profile, capacity, and finish-to-shoulder drawing qualification remain unavailable'];a['workingCopy']=str(d/'model-finish-v10.blend');a['disposition']='visual-production candidate; manufacturer qualification pending'
  if check['nonManifoldEdges'] or check['degenerateFaces'] or not check['axialOpeningClear']:a['unresolved'].append('v10 geometry check failed; retain prior working candidate');a['disposition']='rejected refinement'
  for poly in o.data.polygons:poly.use_smooth=abs(poly.normal.z)<.99999
  bpy.ops.wm.save_as_mainfile(filepath=a['workingCopy'],compress=True);bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.ops.export_scene.gltf(filepath=str(d/'model-finish-v10.glb'),export_format='GLB',use_selection=True,export_materials='NONE');(d/'repair-report-v10.json').write_text(json.dumps(a,indent=2))
  print('NECK_REPAIRED',ident,check,flush=True)
 except Exception as e:print('REFINE_ERROR',ident,str(e),traceback.format_exc(),flush=True)
print('NECK_REPAIR_COMPLETE',flush=True)
