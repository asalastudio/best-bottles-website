import bpy,bmesh,json,sys
from pathlib import Path
r=Path(sys.argv[sys.argv.index('--')+1]).resolve()
for f in (r/'working/legacy').glob('*/repair-report-v4.json'):
 a=json.loads(f.read_text())
 if a['disposition']!='rejected refinement':continue
 d=f.parent
 if (d/'repair-report-v5.json').exists():continue
 bpy.ops.wm.open_mainfile(filepath=a['workingCopy'],load_ui=False,use_scripts=False);o=next(x for x in bpy.context.scene.objects if x.type=='MESH');bm=bmesh.new();bm.from_mesh(o.data);bad=[e for e in bm.edges if not e.is_manifold]
 print('BAD',d.name,[(len(e.link_faces),e.calc_length()*1000,[list(v.co*1000) for v in e.verts]) for e in bad],flush=True)
 bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-6);bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=1e-7);edges=[e for e in bm.edges if e.is_boundary]
 if edges:bmesh.ops.holes_fill(bm,edges=edges,sides=4)
 bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));check={'nonManifoldEdges':sum(not e.is_manifold for e in bm.edges),'degenerateFaces':sum(f.calc_area()<1e-16 for f in bm.faces),'signedVolumeMm3':bm.calc_volume(signed=True)*1e9};bm.to_mesh(o.data);bm.free()
 a['checks']=[{'object':o.name,**check}];a['workingCopy']=str(d/'model-finish-v5.blend');a['changes'].append({'code':'MICRO-SEAM','detail':'Welded coincident vertices within 1 micron and closed triangular boolean seam holes'})
 if check['nonManifoldEdges']==check['degenerateFaces']==0:a['disposition']='visual-production candidate; manufacturer qualification pending';a['unresolved']=[x for x in a['unresolved'] if 'v4 geometry check' not in x]
 bpy.ops.wm.save_as_mainfile(filepath=a['workingCopy'],compress=True);bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.ops.export_scene.gltf(filepath=str(d/'model-finish-v5.glb'),export_format='GLB',use_selection=True,export_materials='NONE');(d/'repair-report-v5.json').write_text(json.dumps(a,indent=2));print('MICRO_REPAIR',d.name,check,flush=True)
