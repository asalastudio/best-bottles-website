import bpy,json,sys
from pathlib import Path
r=Path(sys.argv[sys.argv.index('--')+1]).resolve()
code=(r/'scripts/render-native-approved.py').read_text().split('\ndone=0')[0]
# The same verified renderer; use the priority family's own shoulder datum and approved family scale.
code=code.replace("shoulder=42.12 if 'cyl5' in row['id'] else", "shoulder=row['shoulderMm'] if 'shoulderMm' in row else 42.12 if 'cyl5' in row['id'] else")
code=code.replace('targetpct=3.5314*h**.5868/100',"targetpct=row.get('targetPct',3.5314*h**.5868)/100")
code=code.replace("c.hide_render=c.name not in ['Sheet | internals','Sheet | spray-matte-black']", "c.hide_render=c.name not in row.get('groups',['Sheet | internals','Sheet | spray-matte-black'])")
code=code.replace("if 'Sheet | spray-matte-black' not in available:","if row.get('view','spray')=='spray' and 'Sheet | spray-matte-black' not in available:")
code=code.replace("out=r/'renders/final/native-approved-studio'","out=r/'renders/final/priority'")
env={};exec(code,env)
for family in ['flair','sleek5','tulip5']:
 d=r/'working/priority-assemblies'/family;rp=d/'repair-report-v2.json';a=json.loads(rp.read_text());path=a['workingCopy']
 for view,groups in [('spray',['Sheet | internals','Sheet | spray-matte-black']),('roller',['Sheet | roller-metal']),('capped',['Sheet | liner-shiny-black'])]:
  ident='priority-'+family+'-'+view
  target=env['out']/ident/'after-transparent.png'
  if target.exists():continue
  row={'id':ident,'groups':groups,'view':view,'shoulderMm':45 if family=='flair' else 34,'targetPct':37.48 if family=='flair' else 30 if family=='sleek5' else 32.97}
  env['render'](row,path,'after')
print('PRIORITY_RENDERS_COMPLETE',flush=True)
