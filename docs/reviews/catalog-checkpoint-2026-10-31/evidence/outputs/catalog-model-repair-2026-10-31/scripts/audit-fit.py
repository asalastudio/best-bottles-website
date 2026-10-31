import bpy,json,sys,math,numpy as np
from pathlib import Path
from mathutils import Vector
root=Path(sys.argv[sys.argv.index('--')+1]);queue=json.loads((root/'sources/audit-queue.json').read_text());out=root/'audit/fit';out.mkdir(parents=True,exist_ok=True)
for row in queue:
 if row['kind']=='glb' and 'bodies' not in row['id'] and 'DIP_TUBE' not in row['id'] and 'PIPETTE' not in row['id'] and 'ROLL_' not in row['id']:continue
 target=out/(row['id']+'.json')
 if target.exists():continue
 if row['kind']=='blend':bpy.ops.wm.open_mainfile(filepath=row['path'],load_ui=False,use_scripts=False)
 else:bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=row['path'])
 s=bpy.context.scene;unit=s.unit_settings.scale_length or 1;mm=unit*1000;dg=bpy.context.evaluated_depsgraph_get();bodies=[];tubes=[]
 for o in s.objects:
  if o.type!='MESH':continue
  lower=o.name.lower()
  if lower.startswith(('bb_btl','bottle')):
   corners=[o.matrix_world@Vector(p) for p in o.bound_box];lo=Vector([min(p[i] for p in corners) for i in range(3)]);hi=Vector([max(p[i] for p in corners) for i in range(3)]);center=(lo+hi)/2
   origin=Vector((center.x,center.y,hi.z+.02/unit));direction=Vector((0,0,-1));inv=o.matrix_world.inverted();ev=o.evaluated_get(dg)
   hit,pos,normal,idx=ev.ray_cast(inv@origin,inv.to_3x3()@direction)
   z=(o.matrix_world@pos).z*mm if hit else None
   floorClearance=None if z is None else z-lo.z*mm
   bodies.append({'name':o.name,'axisMm':[center.x*mm,center.y*mm],'minZmm':lo.z*mm,'maxZmm':hi.z*mm,'firstAxialSurfaceZmm':z,'floorAboveBaseMm':floorClearance,'openingClear':hit and z < (lo.z+.8*(hi.z-lo.z))*mm})
  if ('dip tube' in lower or 'dip_tube' in lower or 'pipette' in lower) and not any(q in lower for q in ['barb','card','light']):
   xyz=np.empty(len(o.data.vertices)*3,dtype=np.float32);o.data.vertices.foreach_get('co',xyz);xyz=xyz.reshape(-1,3);mat=np.array(o.matrix_world);xyz=(xyz@mat[:3,:3].T+mat[:3,3])*mm
   z0,z1=xyz[:,2].min(),xyz[:,2].max();centers=[];widths=[]
   for z in np.linspace(z0,z1,40)[1:-1]:
    sec=xyz[np.abs(xyz[:,2]-z)<max((z1-z0)/75,.03)]
    if len(sec)>4:
     centers.append((sec[:,:2].min(0)+sec[:,:2].max(0))/2);widths.append(sec[:,:2].max(0)-sec[:,:2].min(0))
   centers=np.array(centers);widths=np.array(widths)
   tubes.append({'name':o.name,'boundsMm':[xyz.min(0).tolist(),xyz.max(0).tolist()],'centerlineSpreadMm':(np.ptp(centers,axis=0).tolist() if len(centers) else None),'axisOffsetMaxMm':float(np.linalg.norm(centers,axis=1).max()) if len(centers) else None,'medianDiameterXYMm':np.median(widths,axis=0).tolist() if len(widths) else None,'sourceMaterial':[m.name for m in o.data.materials if m]})
 if bodies:
  for t in tubes:t['clearanceAboveFirstAxialSurfaceMm']=t['boundsMm'][0][2]-bodies[0]['firstAxialSurfaceZmm'] if bodies[0]['firstAxialSurfaceZmm'] is not None else None
 target.write_text(json.dumps({'id':row['id'],'path':row['path'],'bodies':bodies,'tubes':tubes},indent=2));print('FIT',row['id'],flush=True)
print('FIT_COMPLETE',flush=True)
