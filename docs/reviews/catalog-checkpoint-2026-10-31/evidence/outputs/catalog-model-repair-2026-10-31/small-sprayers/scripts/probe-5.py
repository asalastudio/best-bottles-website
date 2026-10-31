import bpy,json,math
from pathlib import Path
out=Path(__file__).resolve().parents[1]
p=out.parent/'renders/comparisons-v7/native-cyl5-13415-v7-review-2026-09-29__Cyl-5ml-13-415_clear_STUDIO-v1.5-body-v7e/review-scene.blend'
bpy.ops.wm.open_mainfile(filepath=str(p))
rows=[]
for o in bpy.context.scene.objects:
 if o.type=='MESH' and ('Bottle |' in o.name or 'body v7' in o.name):
  print('BODY',o.name,len(o.data.vertices),tuple(o.dimensions),[m.name if m else None for m in o.data.materials])
  pts=[]
  for v in o.data.vertices:
   x,y,z=o.matrix_world@v.co
   if abs(y)<.000015 and x>0:pts.append([round(x*1000,4),round(z*1000,4)])
  pts=sorted(pts,key=lambda p:p[1]);(out/'source-review/5ml-mesh-section.json').write_text(json.dumps(pts))
  for z in range(54):
   vv=[x for x,zz in pts if z<=zz<z+1]
   if vv:rows.append([z,round(min(vv),3),round(max(vv),3),len(vv)])
print(rows)
