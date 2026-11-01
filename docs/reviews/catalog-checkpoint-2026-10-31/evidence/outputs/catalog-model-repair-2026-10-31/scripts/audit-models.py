import bpy,bmesh,json,sys,math,hashlib,traceback
import numpy as np
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
args=sys.argv[sys.argv.index('--')+1:];root=Path(args[0]);queue=json.loads((root/'sources/audit-queue.json').read_text());kind=args[1] if len(args)>1 else 'all'
cache={};resultdir=root/'audit/models';resultdir.mkdir(parents=True,exist_ok=True)
PREFIX=('bottle','bb_btl','bb_cap','bb_roll','bb_spr','bb_drp','bb_dip','bb_pmp','bb_ansp','bb_reducer','roller','cap_','sprayer','pump','sheet |','internals |','liner |','overcap','dropper')
def product(o):return o.type=='MESH' and o.name.lower().startswith(PREFIX)
def shapecheck(me,unit):
 xyz=np.empty(len(me.vertices)*3,dtype=np.float32);me.vertices.foreach_get('co',xyz)
 faces=np.empty(len(me.loops),dtype=np.int32);me.loops.foreach_get('vertex_index',faces)
 sig=hashlib.sha256(xyz.tobytes()+faces.tobytes()).hexdigest()
 if sig in cache:return {**cache[sig],'geometrySha256':sig}
 bm=bmesh.new();bm.from_mesh(me);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-7/unit)
 data={'vertices':len(bm.verts),'faces':len(bm.faces),'boundaryEdges':sum(e.is_boundary for e in bm.edges),'nonManifoldEdges':sum(not e.is_manifold for e in bm.edges),'inconsistentNormalEdges':sum(e.is_manifold and not e.is_contiguous for e in bm.edges),'degenerateFaces':sum(f.calc_area()<1e-16/(unit*unit) for f in bm.faces),'signedVolumeMm3':bm.calc_volume(signed=True)*(unit*1000)**3,'uvLayers':len(me.uv_layers),'smoothFacePct':100*sum(p.use_smooth for p in me.polygons)/max(1,len(me.polygons))}
 bm.free();cache[sig]=data;return {**data,'geometrySha256':sig}
for n,row in enumerate(queue):
 if kind!='all' and row['kind']!=kind:continue
 dest=resultdir/(row['id']+'.json')
 if dest.exists():continue
 try:
  if row['kind']=='blend':bpy.ops.wm.open_mainfile(filepath=row['path'],load_ui=False,use_scripts=False)
  else:
   bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=row['path'])
  scene=bpy.context.scene;unit=scene.unit_settings.scale_length or 1;dg=bpy.context.evaluated_depsgraph_get()
  objs=[o for o in scene.objects if product(o)] if row['kind']=='blend' else [o for o in scene.objects if o.type=='MESH']
  results=[]
  for o in objs:
   ev=o.evaluated_get(dg);me=ev.to_mesh()
   try:data=shapecheck(me,unit)
   finally:ev.to_mesh_clear()
   bounds=[o.matrix_world@Vector(v) for v in o.bound_box]
   lo=[min(v[i] for v in bounds)*unit*1000 for i in range(3)];hi=[max(v[i] for v in bounds)*unit*1000 for i in range(3)]
   flags=[]
   if data['nonManifoldEdges']:flags.append('non-manifold topology: inspect intended openings versus defect')
   if data['inconsistentNormalEdges']:flags.append('inconsistent face orientation')
   if data['signedVolumeMm3'] < -1e-6:flags.append('negative signed volume')
   if data['degenerateFaces']:flags.append('zero-area faces')
   if max(abs(s-1) for s in o.scale)>1e-5:flags.append('unapplied object scale')
   if len(o.modifiers):flags.append('live modifiers: evaluate before applying in copy')
   if 'ball' in o.name.lower():
    dims=[hi[i]-lo[i] for i in range(3)]
    if max(dims)-min(dims)>.05:flags.append('roller ball not spherical in world dimensions')
   results.append({'name':o.name,'collections':[c.name for c in o.users_collection],'hiddenRender':o.hide_render,'hiddenCollections':[c.name for c in o.users_collection if c.hide_render],'boundsMm':{'min':lo,'max':hi},'scale':list(o.scale),'modifiers':[{'name':m.name,'type':m.type,'render':m.show_render} for m in o.modifiers],'materials':[m.name if m else None for m in o.data.materials],**data,'findings':flags})
  missing=[]
  for img in bpy.data.images:
   if img.source=='FILE' and not img.packed_file and img.filepath and not Path(bpy.path.abspath(img.filepath)).exists():missing.append({'image':img.name,'path':bpy.path.abspath(img.filepath)})
  camera=scene.camera
  settings={'engine':scene.render.engine,'resolution':[scene.render.resolution_x,scene.render.resolution_y,scene.render.resolution_percentage],'samples':scene.cycles.samples,'denoising':scene.cycles.use_denoising,'world':scene.world.name if scene.world else None,'lights':len([o for o in scene.objects if o.type=='LIGHT'])}
  cam={'name':camera.name,'type':camera.data.type,'clipStart':camera.data.clip_start,'clipEnd':camera.data.clip_end,'orthoScale':camera.data.ortho_scale,'matrix':[list(r) for r in camera.matrix_world]} if camera else None
  report={**row,'unitsMetersPerUnit':unit,'objects':results,'missingImages':missing,'camera':cam,'render':settings,'status':'audited-geometry-render-pending','scope':'active catalog source; source not saved or changed'}
  dest.write_text(json.dumps(report,indent=2));print('AUDITED',n+1,len(queue),row['id'],len(results),flush=True)
 except Exception as e:
  dest.write_text(json.dumps({**row,'error':str(e),'traceback':traceback.format_exc(),'status':'audit-error'},indent=2));print('AUDIT_ERROR',row['id'],str(e),flush=True)
(root/'audit/topology-cache.json').write_text(json.dumps(cache,indent=2))
print('AUDIT_COMPLETE',kind,flush=True)
