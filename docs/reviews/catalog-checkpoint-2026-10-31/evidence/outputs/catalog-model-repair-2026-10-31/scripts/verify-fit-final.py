import bpy,json,sys,math,numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
r=Path(sys.argv[sys.argv.index('--')+1]).resolve();out=r/'audit/verified-fit-final';out.mkdir(exist_ok=True)
paths=[]
for kind in ['native','priority-assemblies','empire-assemblies','dropper-assemblies']:
 for f in (r/'working'/kind).glob('*/repair-report.json'):
  chosen=f
  for n in range(2,16):
   c=f.parent/f'repair-report-v{n}.json'
   if c.exists() and json.loads(c.read_text()).get('disposition')!='rejected refinement':chosen=c
  a=json.loads(chosen.read_text());paths.append((a['id'],a['workingCopy'],a.get('tubeFloorTargetMm',.5)))
for ident,path,targetgap in paths:
 dest=out/(ident+'.json')
 if dest.exists() and json.loads(dest.read_text()).get('workingCopy')==path and json.loads(dest.read_text()).get('algorithmVersion')==2:continue
 bpy.ops.wm.open_mainfile(filepath=path,load_ui=False,use_scripts=False);s=bpy.context.scene;body=next((o for o in s.objects if o.type=='MESH' and o.name.lower().startswith(('bottle','bb_btl')) and not o.hide_render),None);report={'algorithmVersion':2,'id':ident,'workingCopy':path,'rollers':[],'tubes':[],'scope':'Per-height outer tube radius is compared with the glass cavity in 16 directions at mesh-ring heights and 48 uniform heights. Measured geometry checks; does not substitute for exact-SKU cap-thread contact or manufacturer tolerance qualification.'}
 if not body:continue
 pts=[body.matrix_world@Vector(v) for v in body.bound_box];zlo=min(v.z for v in pts);zhi=max(v.z for v in pts);inv=body.matrix_world.inverted();ev=body.evaluated_get(bpy.context.evaluated_depsgraph_get());hit,point,n,idx=ev.ray_cast(inv@Vector((0,0,zhi+.03)),inv.to_3x3()@Vector((0,0,-1)));floor=(body.matrix_world@point).z if hit else None
 report['body']={'heightMm':(zhi-zlo)*1000,'rimZmm':zhi*1000,'floorZmm':floor*1000 if floor is not None else None,'openingClear':floor is not None and floor<zlo+(zhi-zlo)*.8}
 for o in s.objects:
  if o.type!='MESH':continue
  if o.hide_render and not any(c.name.startswith('Sheet | ') for c in o.users_collection):continue
  name=o.name.lower()
  if 'ball' in name and ('roller' in name or 'roll_' in name):
   xyz=np.array([list(o.matrix_world@v.co) for v in o.data.vertices]);lo=xyz.min(0);hi=xyz.max(0);center=(hi+lo)/2;rad=np.linalg.norm(xyz-center,axis=1);radius=(rad.max()+rad.min())/2;housing=next((x for x in s.objects if x.type=='MESH' and 'housing' in x.name.lower() and (('plastic' in name)==('plastic' in x.name.lower()))),None)
   if housing is None:housing=next((x for x in s.objects if x.type=='MESH' and 'housing' in x.name.lower()),None)
   hp=[housing.matrix_world@Vector(v) for v in housing.bound_box] if housing else [];ht=max(v.z for v in hp) if hp else None;hb=min(v.z for v in hp) if hp else None
   item={'name':o.name,'diameterMm':radius*2000,'radialDeviationMm':float(rad.max()-rad.min())*1000,'axisOffsetMm':float(np.linalg.norm(center[:2]))*1000,'centerZmm':float(center[2])*1000,'housing':housing.name if housing else None,'housingTopZmm':ht*1000 if ht is not None else None,'exposedBallHeightMm':(float(hi[2])-ht)*1000 if ht is not None else None,'round':float(rad.max()-rad.min())<.00005,'centerSeatedInsideHousing':bool(housing and hb<float(center[2])<ht),'notCutOff':len(xyz)>100 and float(rad.max()-rad.min())<.00005}
   report['rollers'].append(item)
  if ('dip tube' in name or 'pipette' in name) and 'barb' not in name:
   xyz=np.array([list(o.matrix_world@v.co) for v in o.data.vertices]);lo=xyz.min(0);hi=xyz.max(0);rads=np.linalg.norm(xyz[:,:2],axis=1);ro=rads.max();gaps=[];wall_samples=[]
   tev=o.evaluated_get(bpy.context.evaluated_depsgraph_get());tm=tev.to_mesh();tverts=[o.matrix_world@v.co for v in tm.vertices];tt=BVHTree.FromPolygons(tverts,[list(p.vertices) for p in tm.polygons]);tev.to_mesh_clear()
   for z in sorted(set(list(np.linspace(lo[2]+1e-8,hi[2]-1e-8,48))+[round(v.z,8) for v in tverts])):
    for k in range(16):
     v=Vector((math.cos(math.tau*k/16),math.sin(math.tau*k/16),0));pos=Vector((0,0,z));ok,pt,no,ix=ev.ray_cast(inv@pos,inv.to_3x3()@v)
     if ok:
      th=tt.ray_cast(pos+v*.1,-v)
      if th[0] is not None:
       local_radius=(th[0]-pos).length;gap=((body.matrix_world@pt)-pos).length-local_radius;gaps.append(gap);wall_samples.append((gap,z,local_radius))
   mate=next((x for x in s.objects if x.type=='MESH' and (('tailpiece (' in x.name.lower()) if 'internals |' in name else ('dropper | bulb'==x.name.lower()) if 'pipette' in name else ('pump body' in x.name.lower() or 'pump chamber' in x.name.lower())) and not x.hide_render),None)
   if mate is None and 'internals |' in name:mate=next((x for x in s.objects if 'tailpiece (' in x.name.lower()),None)
   if mate:
    mv=[mate.matrix_world@v.co for v in mate.data.vertices];matebottom=min(v.z for v in mv);matetop=max(v.z for v in mv);insertion=hi[2]-matebottom;connection=bool(.00005<insertion<(matetop-matebottom) and hi[2]<matetop)
   else:matebottom=None;insertion=None;connection=None
   report['tubes'].append({'upperMate':mate.name if mate else None,'insertionMm':float(insertion)*1000 if insertion is not None else None,'connectionPass':connection,'tubeTopMm':float(hi[2])*1000,'name':o.name,'floorGapMm':(lo[2]-floor)*1000 if floor is not None else None,'minWallGapMm':min(gaps)*1000 if gaps else None,'outsideDiameterMm':ro*2000,'axisCenterMm':((lo[:2]+hi[:2])/2*1000).tolist(),'floorTargetMm':targetgap,'minimumWallSample':{'zMm':min(wall_samples)[1]*1000,'localTubeRadiusMm':min(wall_samples)[2]*1000} if wall_samples else None,'floorPass':bool(floor is not None and abs((lo[2]-floor)*1000-targetgap)<.1),'wallPass':bool(gaps and min(gaps)>0)})
 dest.write_text(json.dumps(report,indent=2));print('FIT_VERIFIED',ident,flush=True)
print('FIT_VERIFICATION_COMPLETE',flush=True)
