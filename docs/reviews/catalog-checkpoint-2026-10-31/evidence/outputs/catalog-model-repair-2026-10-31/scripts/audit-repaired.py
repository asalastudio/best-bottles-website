import bpy,bmesh,json,sys,math,traceback
from pathlib import Path
from mathutils import Vector
r=Path(sys.argv[sys.argv.index('--')+1]).resolve();out=r/'audit/repaired-models';out.mkdir(exist_ok=True);queue=[]
for kind in ['native','legacy','priority-assemblies','empire-assemblies','dropper-assemblies']:
 for f in (r/'working'/kind).glob('*/repair-report.json'):
  chosen=f
  for n in range(2,16):
   c=f.parent/f'repair-report-v{n}.json'
   if c.exists() and not(n==2 and 'ANSP_BULB' in str(c)) and json.loads(c.read_text()).get('disposition')!='rejected refinement':chosen=c
  a=json.loads(chosen.read_text());queue.append({'id':a['id'],'kind':kind,'path':a['workingCopy'],'repairReport':str(chosen)})
(r/'sources/selected-working-models.json').write_text(json.dumps(queue,indent=2))
for a in queue:
 dest=out/(a['id']+'.json')
 if dest.exists() and json.loads(dest.read_text()).get('path')==a['path']:continue
 try:
  bpy.ops.wm.open_mainfile(filepath=a['path'],load_ui=False,use_scripts=False);s=bpy.context.scene;checks=[]
  objs=[o for o in s.objects if o.type=='MESH' and (a['kind']=='legacy' or o.name.lower().startswith(('bottle','bb_btl','roller','cap_','sprayer','pump','dropper','internals |')) or any(c.name.startswith('Sheet | ') for c in o.users_collection))]
  for o in objs:
   if o.hide_render and not any(c.name.startswith('Sheet | ') for c in o.users_collection) and a['kind']!='legacy':continue
   ev=o.evaluated_get(bpy.context.evaluated_depsgraph_get());me=ev.to_mesh();bm=bmesh.new();bm.from_mesh(me);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-7);bmesh.ops.recalc_face_normals(bm,faces=[])
   nm=sum(not e.is_manifold for e in bm.edges);ng=sum(e.is_manifold and not e.is_contiguous for e in bm.edges);deg=sum(f.calc_area()<1e-16 for f in bm.faces);vol=bm.calc_volume(signed=True)*1e9
   used={p.material_index for p in me.polygons};missing=[i for i in used if i>=len(me.materials) or me.materials[i] is None];sc=max(abs(x-1) for x in o.scale)
   # Connected mesh pieces are recorded, not all are defects (a nozzle insert can be a separate shell).
   unseen=set(bm.verts);cc=[]
   while unseen:
    todo=[unseen.pop()];n=0
    while todo:
     v=todo.pop();n+=1
     for e in v.link_edges:
      w=e.other_vert(v)
      if w in unseen:unseen.remove(w);todo.append(w)
    cc.append(n)
   checks.append({'object':o.name,'nonManifoldEdges':nm,'inconsistentNormalEdges':ng,'degenerateFaces':deg,'signedVolumeMm3':vol,'unusedScale':sc>.00001,'scale':list(o.scale),'connectedParts':len(cc),'componentVertexCounts':sorted(cc,reverse=True)[:20],'missingUsedMaterialSlots':missing,'materialsRequired':a['kind']!='legacy','modifiers':[m.type for m in o.modifiers],'geometryPass':nm==ng==deg==0 and vol>0,'materialPass':not missing or a['kind']=='legacy'})
   bm.free();ev.to_mesh_clear()
  report={**a,'objects':checks,'geometryPass':all(x['geometryPass'] for x in checks),'materialsPass':all(x['materialPass'] for x in checks),'unitScalePass':all(not x['unusedScale'] for x in checks),'scope':'Independent evaluated mesh topology/material/scale checks. Mesh component count and fit require interpretation.'};dest.write_text(json.dumps(report,indent=2));print('AUDITED_REPAIR',a['id'],report['geometryPass'],report['materialsPass'],report['unitScalePass'],flush=True)
 except Exception as e:print('AFTER_AUDIT_ERROR',a['id'],str(e),traceback.format_exc(),flush=True)
print('AFTER_AUDIT_COMPLETE',len(queue),flush=True)
