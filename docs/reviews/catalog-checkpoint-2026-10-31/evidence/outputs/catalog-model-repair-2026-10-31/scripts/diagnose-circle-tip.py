import bpy,json,sys,math
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
r=Path(sys.argv[sys.argv.index('--')+1]);f=r/'working/dropper-assemblies/circle-50ml-18-415-clear-dropper-gold/repair-report-v14.json';a=json.loads(f.read_text());bpy.ops.wm.open_mainfile(filepath=a['workingCopy'],load_ui=False,use_scripts=False);s=bpy.context.scene;b=next(o for o in s.objects if o.type=='MESH' and o.name.startswith('BB_BTL') and not o.hide_render);t=s.objects['dropper | pipette']
def tree(o):
 ev=o.evaluated_get(bpy.context.evaluated_depsgraph_get());me=ev.to_mesh();v=[o.matrix_world@p.co for p in me.vertices];p=[list(x.vertices) for x in me.polygons];tr=BVHTree.FromPolygons(v,p);ev.to_mesh_clear();return tr,v
bt,bv=tree(b);tt,tv=tree(t);lo=min(v.z for v in tv);hi=max(v.z for v in tv);rows=[]
for dz in [0,.05,.1,.2,.5,1,2,3,4,5,6,8,10,20,30]:
 z=lo+dz/1000;gaps=[];br=[];tr=[]
 for k in range(16):
  v=Vector((math.cos(math.tau*k/16),math.sin(math.tau*k/16),0));p=Vector((0,0,z));bh=bt.ray_cast(p,v);th=tt.ray_cast(p+v*.1,-v)
  if bh[0] is not None and th[0] is not None:
   rb=(bh[0]-p).length;rt=(th[0]-p).length;br.append(rb*1000);tr.append(rt*1000);gaps.append((rb-rt)*1000)
 rows.append({'dz':dz,'z':z*1000,'bmin':min(br) if br else None,'rmax':max(tr) if tr else None,'gapmin':min(gaps) if gaps else None})
print('TIP_DIAGNOSTIC',json.dumps(rows),flush=True)
(r/'audit/circle-tip-diagnostic.json').write_text(json.dumps(rows,indent=2))
