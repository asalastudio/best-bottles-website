from pathlib import Path
import bpy,sys,json
OUT=Path(__file__).resolve().parents[1]
SRC=Path('/Users/jordanrichter/Documents/Codex/2026-09-24/the-image-is-clearly-the-target/outputs/cyl9-17415-studio-2026-09-30/export.py')
sys.argv=['blender','--','review'];ns={'__file__':str(SRC),'__name__':'review'};exec(compile(SRC.read_text(),str(SRC),'exec'),ns);ns['RAW']=OUT/'renders'
bpy.ops.wm.open_mainfile(filepath=str(OUT/'renders/glass-5-clear-measured-v13.blend'));s=bpy.context.scene
changed=[]
for slot in s.objects['Neutral matte cyclorama'].material_slots:
 m=slot.material
 for n in m.node_tree.nodes:
  if n.type=='MIX_SHADER' and n.inputs[0].is_linked:
   link=n.inputs[0].links[0]
   if link.from_node.type=='LIGHT_PATH' and link.from_socket.name=='Is Transmission Ray':
    m.node_tree.links.remove(link);n.inputs[0].default_value=0;changed.append(m.name)
assert changed
meta=json.loads((OUT/'renders/glass-5-clear-measured-v9.json').read_text());meta.update({'sourceScene':'glass-5-clear-measured-v13.blend','appearanceChanges':['Graduated grey side cards and broad studio diffuser','Transmission sees the softly lit studio backdrop rather than constant-color emission; camera background remains transparent','Glass material, measured geometry, camera, crop and cobalt remain unchanged'],'status':'Local cylindrical-lighting review candidate'})
stem='glass-5-clear-measured-v14';ns['gpu'](s,128);bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'renders'/f'{stem}.blend'));ns['render'](s,stem,128,meta)
