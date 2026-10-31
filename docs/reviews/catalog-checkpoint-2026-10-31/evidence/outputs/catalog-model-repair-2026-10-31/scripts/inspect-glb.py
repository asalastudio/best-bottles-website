import bpy,bmesh,json,sys,collections
from pathlib import Path
r=Path(sys.argv[sys.argv.index('--')+1]).resolve();q=json.loads((r/'sources/audit-queue.json').read_text());res=[]
for row in q:
 if row['kind']!='glb':continue
 a=json.loads((r/'audit/models'/f"{row['id']}.json").read_text())
 if not any(o.get('nonManifoldEdges') or o.get('degenerateFaces') or o.get('signedVolumeMm3',1)<0 for o in a['objects']):continue
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=row['path'])
 for o in bpy.context.scene.objects:
  if o.type!='MESH':continue
  bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-7);bm.verts.ensure_lookup_table();bm.faces.ensure_lookup_table()
  seen=set();dupes=[]
  for f in bm.faces:
   k=tuple(sorted(v.index for v in f.verts))
   if k in seen:dupes.append(f)
   seen.add(k)
  before={'boundary':sum(e.is_boundary for e in bm.edges),'nonManifold':sum(not e.is_manifold for e in bm.edges),'edgeFaces':dict(collections.Counter(len(e.link_faces) for e in bm.edges)),'duplicateFaces':len(dupes),'volume':bm.calc_volume()*1e9}
  if dupes:bmesh.ops.delete(bm,geom=dupes,context='FACES_ONLY')
  bmesh.ops.dissolve_degenerate(bm,dist=1e-8,edges=list(bm.edges));bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
  after={'boundary':sum(e.is_boundary for e in bm.edges),'nonManifold':sum(not e.is_manifold for e in bm.edges),'edgeFaces':dict(collections.Counter(len(e.link_faces) for e in bm.edges)),'volume':bm.calc_volume()*1e9}
  res.append({'id':row['id'],'object':o.name,'before':before,'cleanup':after});bm.free()
(r/'audit/glb-cleanup-probe.json').write_text(json.dumps(res,indent=2));print('GLB_PROBE_COMPLETE',flush=True)
