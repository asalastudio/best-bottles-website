import bpy,json,sys
from pathlib import Path
r=Path(sys.argv[sys.argv.index('--')+1]).resolve()
code=(r/'scripts/render-native-approved.py').read_text().split('\ndone=0')[0]
# The same verified renderer; use the priority family's own shoulder datum and approved family scale.
code=code.replace("shoulder=42.12 if 'cyl5' in row['id'] else", "shoulder=row['shoulderMm'] if 'shoulderMm' in row else 42.12 if 'cyl5' in row['id'] else")
code=code.replace('targetpct=3.5314*h**.5868/100',"targetpct=row.get('targetPct',3.5314*h**.5868)/100")
code=code.replace("c.hide_render=c.name not in ['Sheet | internals','Sheet | spray-matte-black']", "c.hide_render=c.name not in row.get('groups',['Sheet | internals','Sheet | spray-matte-black'])")
code=code.replace("if 'Sheet | spray-matte-black' not in available:","if row.get('view','spray')=='spray' and 'Sheet | spray-matte-black' not in available:")
code=code.replace("out=r/'renders/final/native-approved-studio'","out=r/'renders/final/empire'")
code=code.replace('radius=width*1.6','radius=width*.8').replace("default_value=.008;ao.samples=32","default_value=.005;ao.samples=32")
code=code.replace("prefs.get_devices()","prefs.kernel_optimization_level='OFF';prefs.get_devices()")
code=code.replace("s.cycles.samples=128","s.cycles.samples=96").replace("'samples':128","'samples':96")
env={};exec(code,env)

for f in (r/'working/empire-assemblies').glob('*/repair-report.json'):
 import time
 while not (f.parent/'repair-report-v8.json').exists():time.sleep(5)
 chosen=f.parent/('repair-report-v9.json' if (f.parent/'repair-report-v9.json').exists() else 'repair-report-v8.json');a=json.loads(chosen.read_text());row={'id':a['id'],'shoulderMm':a['shoulderMm']}
 for phase,path in [('before',a['beforeCopy']),('after',a['workingCopy'])]:
  if not (env['out']/row['id']/(phase+'.json')).exists():env['render'](row,path,phase)
print('EMPIRE_RENDER_COMPLETE',flush=True)

print('BEGIN_REMAINING_NATIVE_FRAMES',flush=True)
exec((r/'scripts/render-all-native.py').read_text(),{})
