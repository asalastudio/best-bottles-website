from pathlib import Path
import bpy,sys,json
OUT=Path(__file__).resolve().parents[1]
SRC=Path('/Users/jordanrichter/Documents/Codex/2026-09-24/the-image-is-clearly-the-target/outputs/cyl9-17415-studio-2026-09-30/export.py')
sys.argv=['blender','--','review'];ns={'__file__':str(SRC),'__name__':'review'};exec(compile(SRC.read_text(),str(SRC),'exec'),ns);ns['RAW']=OUT/'renders'
source=OUT/'renders/glass-5-clear-measured-v9.blend';bpy.ops.wm.open_mainfile(filepath=str(source));s=bpy.context.scene;body=bpy.data.objects['BB_BTL_Cylinder5_measured_envelope'];geo=ns['geo'](body)
# Restore reflection cards, using a feathered neutral-grey surface instead of flat black.
# The bottle shader, IOR, material transmission, mesh and framing are unchanged.
m=bpy.data.materials.new('Clear-only | graduated neutral reflection cards v12');m.use_nodes=True;nt=m.node_tree;nt.nodes.clear();N=nt.nodes;L=nt.links
tex=N.new('ShaderNodeTexCoord');split=N.new('ShaderNodeSeparateXYZ');L.new(tex.outputs['Generated'],split.inputs[0])
def math_node(op,a,b=None):
 n=N.new('ShaderNodeMath');n.operation=op
 for i,v in enumerate([a,b]):
  if v is None:continue
  if isinstance(v,(int,float)):n.inputs[i].default_value=v
  else:L.new(v,n.inputs[i])
 return n.outputs[0]
y=math_node('SUBTRACT',math_node('MULTIPLY',split.outputs['Y'],2),1)
fade=math_node('MULTIPLY',math_node('SUBTRACT',1,math_node('MULTIPLY',y,y)),.85)
transparent=N.new('ShaderNodeBsdfTransparent');grey=N.new('ShaderNodeEmission');grey.inputs['Color'].default_value=(.075,.075,.075,1);grey.inputs['Strength'].default_value=1
mix=N.new('ShaderNodeMixShader');L.new(fade,mix.inputs[0]);L.new(transparent.outputs[0],mix.inputs[1]);L.new(grey.outputs[0],mix.inputs[2]);output=N.new('ShaderNodeOutputMaterial');L.new(mix.outputs[0],output.inputs['Surface'])
for name in ['Variant | side black card +1','Variant | side black card -1']:
 o=s.objects[name];o.hide_render=False;o.data.materials.clear();o.data.materials.append(m)
meta=json.loads((OUT/'renders/glass-5-clear-measured-v9.json').read_text());meta.update({'sourceScene':str(source),'geometrySha256':geo,'appearanceChanges':['Restored both reflection cards with neutral-grey 0.075 linear emission, 0.85 maximum coverage and a parabolic edge feather','Bottle material remains fully transmissive, roughness 0, IOR 1.52; cobalt unchanged'],'status':'Local optical review candidate'})
assert ns['geo'](body)==geo
stem='glass-5-clear-measured-v12';ns['gpu'](s,128);bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'renders'/f'{stem}.blend'));ns['render'](s,stem,128,meta)
print('COMPLETE balanced clear reflections',flush=True)
