import bpy,json,sys
from pathlib import Path
r=Path(sys.argv[sys.argv.index('--')+1]).resolve()
code=(r/'scripts/render-native-approved.py').read_text().split('\ndone=0')[0]
# The same verified renderer; use the priority family's own shoulder datum and approved family scale.
code=code.replace("shoulder=42.12 if 'cyl5' in row['id'] else", "shoulder=row['shoulderMm'] if 'shoulderMm' in row else 42.12 if 'cyl5' in row['id'] else")
code=code.replace('targetpct=3.5314*h**.5868/100',"targetpct=row.get('targetPct',3.5314*h**.5868)/100")
code=code.replace("c.hide_render=c.name not in ['Sheet | internals','Sheet | spray-matte-black']", "c.hide_render=c.name not in row.get('groups',['Sheet | internals','Sheet | spray-matte-black'])")
code=code.replace("if 'Sheet | spray-matte-black' not in available:","if row.get('view','spray')=='spray' and 'Sheet | spray-matte-black' not in available:")
code=code.replace("out=r/'renders/final/native-approved-studio'","out=r/'renders/final/droppers'")
code=code.replace('radius=width*1.6','radius=width*.8').replace("default_value=.008;ao.samples=32","default_value=.005;ao.samples=32")
code=code.replace("prefs.get_devices()","prefs.kernel_optimization_level='OFF';prefs.get_devices()")
code=code.replace("s.cycles.samples=128","s.cycles.samples=96").replace("'samples':128","'samples':96")
code=code.replace("and o.name.lower().startswith(('bottle','bb_btl','roller','cap_','sprayer','pump','sheet |','internals |'))","and (o.name.lower().startswith(('bottle','bb_btl','roller','cap_','sprayer','pump','sheet |','internals |')) or any(c.name.startswith('Sheet | ') for c in o.users_collection))")
code=code.replace("if phase=='after':bpy.ops.wm.save_as_mainfile","if phase=='after' and row.get('saveScene',True):bpy.ops.wm.save_as_mainfile")
code=code.replace("'cap_','sprayer','pump','sheet |'","'cap_','sprayer','pump','dropper','sheet |'")
code=code.replace("and o.name.lower().startswith(('bottle','bb_btl'))),None)","and o.name.lower().startswith(('bottle','bb_btl')) and not o.hide_render),None)")
env={};exec(code,env)


import traceback
for f in sorted((r/'working/dropper-assemblies').glob('*/repair-report.json')):
 chosen=f
 for n in range(2,16):
  c=f.parent/f'repair-report-v{n}.json'
  if c.exists() and json.loads(c.read_text()).get('disposition')!='rejected refinement':chosen=c
 a=json.loads(chosen.read_text());row={'id':a['id'],'shoulderMm':a['shoulderMm'],'saveScene':True}
 try:
  for phase,path in ([('before',a['beforeCopy'])] if a['finish']=='gold' else [])+[('after',a['workingCopy'])]:
   meta=env['out']/row['id']/(phase+'.json')
   if phase=='after' and meta.exists() and json.loads(meta.read_text()).get('source')!=path:
    archive=r/'renders/superseded'/('dropper-'+Path(json.loads(meta.read_text())['source']).stem)/row['id'];archive.mkdir(parents=True,exist_ok=True)
    for old in meta.parent.glob('after*'):
     old.rename(archive/old.name)
    sc=meta.parent/'review-scene.blend'
    if sc.exists():sc.rename(archive/sc.name)
   if not meta.exists():env['render'](row,path,phase)
 except Exception as e:print('DROPPER_RENDER_ERROR',row['id'],str(e),traceback.format_exc(),flush=True)
print('DROPPER_RENDER_COMPLETE',flush=True)
