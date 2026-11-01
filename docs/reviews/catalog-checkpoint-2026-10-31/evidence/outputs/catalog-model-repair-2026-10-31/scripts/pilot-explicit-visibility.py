import bpy,json,sys
from pathlib import Path
r=Path(sys.argv[sys.argv.index('--')+1]).resolve();row=next(a for a in json.loads((r/'sources/variant-render-queue.json').read_text()) if a['id']=='cyl5-cobalt-blue--cap-shiny-silver');bpy.ops.wm.open_mainfile(filepath=row['workingCopy'],load_ui=False,use_scripts=False);s=bpy.context.scene
for o in s.objects:
 groups=[c.name for c in o.users_collection if c.name.startswith('Sheet | ')]
 if groups:o.hide_render=not any(g in row['groups'] for g in groups)
p=r/'working/pilots/cobalt-explicit-visibility.blend';bpy.ops.wm.save_as_mainfile(filepath=str(p),compress=True);code=(r/'scripts/render-variants.py').read_text().split('import traceback\nqueue=')[0];code=code.replace("out=r/'renders/final/sku-variants'","out=r/'renders/pilots/cap-explicit-visibility'");outer={};exec(code,outer);env=outer['env'];rendercode=outer['code'].replace('resolution_percentage=100','resolution_percentage=50').replace('s.cycles.samples=96','s.cycles.samples=32');exec(rendercode,env);row['saveScene']=True;env['render'](row,str(p),'after')
