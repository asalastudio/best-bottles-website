import bpy,json,sys
from pathlib import Path
r=Path(sys.argv[sys.argv.index('--')+1]).resolve()
code=(r/'scripts/render-native-approved.py').read_text().split('\ndone=0')[0]
# The same verified renderer; use the priority family's own shoulder datum and approved family scale.
code=code.replace("shoulder=42.12 if 'cyl5' in row['id'] else", "shoulder=row['shoulderMm'] if 'shoulderMm' in row else 42.12 if 'cyl5' in row['id'] else")
code=code.replace('targetpct=3.5314*h**.5868/100',"targetpct=row.get('targetPct',3.5314*h**.5868)/100")
code=code.replace("c.hide_render=c.name not in ['Sheet | internals','Sheet | spray-matte-black']", "c.hide_render=c.name not in row.get('groups',['Sheet | internals','Sheet | spray-matte-black'])")
code=code.replace("if 'Sheet | spray-matte-black' not in available:","if row.get('view','spray')=='spray' and 'Sheet | spray-matte-black' not in available:")
code=code.replace("out=r/'renders/final/native-approved-studio'","out=r/'renders/final/sku-variants'")
code=code.replace('radius=width*1.6','radius=width*.8').replace("default_value=.008;ao.samples=32","default_value=.005;ao.samples=32")
code=code.replace("prefs.get_devices()","prefs.kernel_optimization_level='OFF';prefs.get_devices()")
code=code.replace("s.cycles.samples=128","s.cycles.samples=96").replace("'samples':128","'samples':96")
code=code.replace("and o.name.lower().startswith(('bottle','bb_btl','roller','cap_','sprayer','pump','sheet |','internals |'))","and (o.name.lower().startswith(('bottle','bb_btl','roller','cap_','sprayer','pump','sheet |','internals |')) or any(c.name.startswith('Sheet | ') for c in o.users_collection))")
code=code.replace("if phase=='after':bpy.ops.wm.save_as_mainfile","if phase=='after' and row.get('saveScene',True):bpy.ops.wm.save_as_mainfile")
env={};exec(code,env)

import traceback
queue=json.loads((r/'sources/variant-render-queue.json').read_text())[1::2]
for i,row in enumerate(queue):
 row['saveScene']=False
 dest=env['out']/row['id']
 if (dest/'after.json').exists():continue
 try:
  import time
  while not Path(row['workingCopy']).exists():time.sleep(5)
  env['render'](row,row['workingCopy'],'after')
  (dest/'variant.json').write_text(json.dumps(row,indent=2))
  print('VARIANT_PROGRESS',i+1,len(queue),row['id'],flush=True)
 except Exception as e:print('VARIANT_ERROR',row['id'],str(e),traceback.format_exc(),flush=True)
print('VARIANT_RENDER_COMPLETE',flush=True)
