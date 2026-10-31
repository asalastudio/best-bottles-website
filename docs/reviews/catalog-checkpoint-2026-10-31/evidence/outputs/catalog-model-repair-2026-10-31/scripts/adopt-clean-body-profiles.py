import bpy,bmesh,json,sys,math,traceback
from pathlib import Path
from mathutils import Vector,Matrix
r=Path(sys.argv[sys.argv.index('--')+1]).resolve();env={};exec((r/'scripts/final-mating-repairs.py').read_text().split('\njobs=[]')[0],env)
def latest(d):
 f=d/'repair-report.json'
 for n in range(2,15):
  p=d/f'repair-report-v{n}.json'
  if p.exists() and json.loads(p.read_text()).get('disposition')!='rejected refinement':f=p
 return json.loads(f.read_text())
pairs={'glb-bodies__Cr-boxy-18-415-87x72x23':'glb-bodies-thickness__Circle-disc-18-415-88x73','glb-bodies__Cr-round-18-415-87x72x23':'glb-bodies-thickness__Circle-disc-18-415-88x73','glb-bodies__Elg-boxy-18-415-86x54x27':'glb-bodies-thickness__Elegant-oval-18-415-87x55','glb-bodies__Rnd-round-18-415-83x69':'glb-bodies-thickness__Round-sphere-18-415-83x69','glb-bodies__Rnd-round-18-415-73x59':'glb-bodies-thickness__Round-sphere-18-415-73x59'}
for ident,sourceid in pairs.items():
 d=r/'working/legacy'/ident;a=latest(d);src=latest(r/'working/legacy'/sourceid);bpy.ops.wm.open_mainfile(filepath=src['workingCopy'],load_ui=False,use_scripts=False);o=next(o for o in bpy.context.scene.objects if o.type=='MESH');pts=[o.matrix_world@v.co for v in o.data.vertices];z0=min(p.z for p in pts);vs=[p-Vector((0,0,z0)) for p in pts];o.data=o.data.copy()
 for v,p in zip(o.data.vertices,vs):v.co=p
 o.matrix_world=Matrix.Identity(4);o.data.update();a['workingCopy']=str(d/'model-profile-v14.blend');a['changes'].append({'code':'BODY-PROFILE-SOURCE','detail':'Replaced the coarse traced shoulder profile with the existing detailed hollow model for the matching family. Kept its geometry at 1:1 scale and aligned the foot to Z=0; dimensional differences and inferred interior remain disclosed.','sourceModelId':sourceid,'sourceCopy':src['workingCopy'],'dimensionsMm':[(max(p[i] for p in vs)-min(p[i] for p in vs))*1000 for i in range(3)]});a['inferred'].append('Detailed family-source envelope can differ from nominal catalog dimensions by up to 0.7 mm; interior and depth require supplier qualification.');a['disposition']='family-source profile improvement; manufacturer qualification pending';bpy.ops.wm.save_as_mainfile(filepath=a['workingCopy'],compress=True);bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.ops.export_scene.gltf(filepath=str(d/'model-profile-v14.glb'),export_format='GLB',use_selection=True,export_materials='NONE');(d/'repair-report-v14.json').write_text(json.dumps(a,indent=2));print('PROFILE_ADOPTED',ident,a['changes'][-1]['dimensionsMm'],flush=True)
for f in (r/'working/dropper-assemblies').glob('*/repair-report.json'):
 d=f.parent;a=latest(d);bid=a['bodyId'];sourceid={'circle-50ml-18-415':'glb-bodies__Cr-boxy-18-415-87x72x23','elegant-60ml-18-415':'glb-bodies__Elg-boxy-18-415-86x54x27','round-128ml-18-415':'glb-bodies__Rnd-round-18-415-83x69'}.get(bid)
 if not sourceid:continue
 try:
  src=latest(r/'working/legacy'/sourceid);bpy.ops.wm.open_mainfile(filepath=a['workingCopy'],load_ui=False,use_scripts=False);s=bpy.context.scene;body=next(o for o in s.objects if o.type=='MESH' and o.name.startswith('BB_BTL') and not o.hide_render);oldrim=max((body.matrix_world@v.co).z for v in body.data.vertices);mats=list(body.data.materials)
  with bpy.data.libraries.load(src['workingCopy'],link=False) as (data,dst):dst.objects=[n for n in data.objects if n.lower().startswith(('bottle','bb_btl'))][:1]
  fresh=dst.objects[0];body.data=fresh.data.copy();body.matrix_world=fresh.matrix_world.copy();body.data.materials.clear()
  for m in mats:body.data.materials.append(m)
  for p in body.data.polygons:p.material_index=0
  bpy.data.objects.remove(fresh,do_unlink=True);newrim=max((body.matrix_world@v.co).z for v in body.data.vertices);delta=newrim-oldrim
  for o in s.objects:
   if o.type=='MESH' and o.name.startswith('dropper | '):o.location.z+=delta
  bpy.context.view_layer.update();ev=body.evaluated_get(bpy.context.evaluated_depsgraph_get());hit,p,_,_=ev.ray_cast(Vector((0,0,newrim+.02)),Vector((0,0,-1)));assert hit and p.z<newrim*.3;floor=p.z;pipe=s.objects['dropper | pipette'];vv=[pipe.matrix_world@v.co for v in pipe.data.vertices];lo=min(p.z for p in vv);hi=max(p.z for p in vv);shift=floor+.0005-lo;threshold=lo+.006;inv=pipe.matrix_world.inverted()
  for v,p in zip(pipe.data.vertices,vv):p.z+=shift if p.z<=threshold else shift*(hi-p.z)/(hi-threshold);v.co=inv@p
  pipe.data.update();tree,_=env['bvh'](body);detail=env['repair_shell'](s.objects['dropper | collar'],tree,newrim);a['workingCopy']=str(d/'model-profile-v14.blend');a['bodySource']=src['workingCopy'];a['shoulderMm']=newrim*1000-15.8;a['changes'].extend([{'code':'BODY-PROFILE-SOURCE','detail':'Used the existing detailed hollow body for this family, removing the traced shoulder seam. Repositioned the closure to the rim and refitted the unchanged-bore pipette to 0.5 mm above the new cavity floor.','source':src['workingCopy']},{'code':'CLOSURE-CLEARANCE','detail':detail}]);a['qualification']+=' Detailed body source is kept at 1:1 scale; catalog/source envelope differences up to 0.7 mm remain for supplier qualification.';bpy.ops.wm.save_as_mainfile(filepath=a['workingCopy'],compress=True);(d/'repair-report-v14.json').write_text(json.dumps(a,indent=2));print('PROFILE_ASSEMBLY',a['id'],newrim*1000,floor*1000,flush=True)
 except Exception as e:print('PROFILE_ASSEMBLY_ERROR',a['id'],str(e),traceback.format_exc(),flush=True)
print('PROFILE_ADOPTION_COMPLETE',flush=True)
