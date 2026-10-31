import bpy,json,hashlib
from pathlib import Path
b=Path(__file__).resolve().parents[1]
def signature(p):
 bpy.ops.wm.open_mainfile(filepath=str(p));s=bpy.context.scene;body=bpy.data.objects['BB_BTL_Cylinder5_measured_envelope']
 def material(m):
  return [(n.name,n.type,[(i.name,list(i.default_value) if hasattr(i.default_value,'__len__') else i.default_value) for i in n.inputs if hasattr(i,'default_value')]) for n in m.node_tree.nodes] if m and m.use_nodes else []
 studio=[]
 for o in s.objects:
  if o.hide_render or o==body or o.type not in ['LIGHT','MESH']:continue
  row={'name':o.name,'matrix':[list(r) for r in o.matrix_world],'visibility':[o.visible_glossy,o.visible_transmission,o.visible_camera],'materials':[material(m) for m in o.data.materials] if o.type=='MESH' else [],'light':[o.data.energy,list(o.data.color)] if o.type=='LIGHT' else None}
  studio.append(row)
 return {'bodyMaterial':[material(m) for m in body.data.materials],'studio':studio,'world':material(s.world),'camera':[list(r) for r in s.camera.matrix_world],'crop':[s.render.border_min_x,s.render.border_min_y,s.render.border_max_x,s.render.border_max_y],'view':[s.view_settings.view_transform,s.view_settings.look,s.view_settings.exposure,s.view_settings.gamma]}
rows=[]
for glass,version in [('clear',16),('cobalt',9)]:
 before=signature(b/f'renders/glass-5-{glass}-measured-v{version}.blend');after=signature(b/f'renders/glass-5-{glass}-measured-v19.blend');checks={k:before[k]==after[k] for k in before};print(glass,checks,flush=True);assert all(checks.values());rows.append({'glass':glass,'approvedSourceVersion':version,'currentVersion':19,'checks':checks})
(b/'five-approved-appearance-verification.json').write_text(json.dumps(rows,indent=2))
