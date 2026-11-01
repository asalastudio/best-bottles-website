import bpy,bmesh,json,sys,time
from pathlib import Path
r=Path(sys.argv[sys.argv.index('--')+1]).resolve();base=r/'working/dropper-assemblies'
while len(list(base.glob('*/repair-report-v2.json')))<24:time.sleep(3)
for f in base.glob('*/repair-report-v2.json'):
 a=json.loads(f.read_text());d=f.parent;bpy.ops.wm.open_mainfile(filepath=a['workingCopy'],load_ui=False,use_scripts=False);s=bpy.context.scene;collar=s.objects['dropper | collar'];washer=s.objects['dropper | seal washer'];cut=washer.copy();cut.data=washer.data.copy();s.collection.objects.link(cut);cut.scale.x=1.003;cut.scale.y=1.003;bpy.context.view_layer.objects.active=collar;m=collar.modifiers.new('Applied seal recess','BOOLEAN');m.operation='DIFFERENCE';m.solver='EXACT';m.object=cut;bpy.ops.object.modifier_apply(modifier=m.name);bpy.data.objects.remove(cut,do_unlink=True)
 bm=bmesh.new();bm.from_mesh(collar.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-6);bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=1e-7);edges=[e for e in bm.edges if e.is_boundary]
 if edges:bmesh.ops.holes_fill(bm,edges=edges,sides=4)
 bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));nm=sum(not e.is_manifold for e in bm.edges);deg=sum(f.calc_area()<1e-16 for f in bm.faces);bm.to_mesh(collar.data);bm.free();a['workingCopy']=str(d/'model-fit-v3.blend');a['collarNonManifoldEdges']=nm;a['collarDegenerateFaces']=deg;a['changes'].append({'code':'SEAL-RECESS','detail':'Cut the sealing-washer recess in the collar and closed small boolean seam holes'});a['disposition']='geometry candidate; physical qualification pending' if nm==deg==0 else 'rejected refinement';bpy.ops.wm.save_as_mainfile(filepath=a['workingCopy'],compress=True);(d/'repair-report-v3.json').write_text(json.dumps(a,indent=2));print('DROPPER_FINAL_FIT',a['id'],nm,deg,flush=True)
print('DROPPER_FINAL_FIT_COMPLETE',flush=True)
