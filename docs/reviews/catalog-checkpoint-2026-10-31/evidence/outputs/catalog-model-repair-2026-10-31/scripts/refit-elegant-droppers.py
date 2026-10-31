import bpy,json,sys
from pathlib import Path
r=Path(sys.argv[sys.argv.index('--')+1]).resolve();env={};exec((r/'scripts/final-mating-repairs.py').read_text().split('\njobs=[]')[0],env)
for f in (r/'working/dropper-assemblies').glob('elegant*/repair-report-v11.json'):
 a=json.loads(f.read_text());d=f.parent;bpy.ops.wm.open_mainfile(filepath=a['workingCopy'],load_ui=False,use_scripts=False);s=bpy.context.scene;body=next(o for o in s.objects if o.type=='MESH' and o.name.startswith('BB_BTL') and not o.hide_render);tree,vs=env['bvh'](body);detail=env['repair_shell'](s.objects['dropper | collar'],tree,max(v.z for v in vs));a['changes'].append({'code':'CLOSURE-CLEARANCE','detail':detail});a['workingCopy']=str(d/'model-fit-v12.blend');bpy.ops.wm.save_as_mainfile(filepath=a['workingCopy'],compress=True);(d/'repair-report-v12.json').write_text(json.dumps(a,indent=2));print('ELEGANT_REFIT',a['id'],detail,flush=True)
