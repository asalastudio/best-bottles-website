import bpy,json,sys,math,numpy as np
from pathlib import Path
from mathutils import Vector
r=Path(sys.argv[sys.argv.index('--')+1]).resolve();out=r/'audit/verified-fit';out.mkdir(exist_ok=True)
paths=[(f.parent.name,json.loads(f.read_text())['workingCopy']) for f in (r/'working/native').glob('*/repair-report.json')]+[(json.loads(f.read_text())['id'],json.loads(f.read_text())['workingCopy']) for f in (r/'working/priority-assemblies').glob('*/repair-report.json')]
for ident,path in paths:
 dest=out/(ident+'.json')
 if dest.exists():continue
 bpy.ops.wm.open_mainfile(filepath=path,load_ui=False,use_scripts=False);s=bpy.context.scene;body=next((o for o in s.objects if o.type=='MESH' and o.name.lower().startswith(('bottle','bb_btl'))),None);report={'id':ident,'workingCopy':path,'rollers':[],'tubes':[],'scope':'Measured geometry checks; does not substitute for exact-SKU cap-thread contact or manufacturer tolerance qualification.'}
 if not body:continue
 pts=[body.matrix_world@Vector(v) for v in body.bound_box];zlo=min(v.z for v in pts);zhi=max(v.z for v in pts);inv=body.matrix_world.inverted();ev=body.evaluated_get(bpy.context.evaluated_depsgraph_get());hit,point,n,idx=ev.ray_cast(inv@Vector((0,0,zhi+.03)),inv.to_3x3()@Vector((0,0,-1)));floor=(body.matrix_world@point).z if hit else None
 report['body']={'heightMm':(zhi-zlo)*1000,'rimZmm':zhi*1000,'floorZmm':floor*1000 if floor is not None else None,'openingClear':floor is not None and floor<zlo+(zhi-zlo)*.8}
 for o in s.objects:
  if o.type!='MESH':continue
  name=o.name.lower()
  if 'ball' in name and ('roller' in name or 'roll_' in name):
   xyz=np.array([list(o.matrix_world@v.co) for v in o.data.vertices]);lo=xyz.min(0);hi=xyz.max(0);center=(hi+lo)/2;rad=np.linalg.norm(xyz-center,axis=1);radius=(rad.max()+rad.min())/2;housing=next((x for x in s.objects if x.type=='MESH' and 'housing' in x.name.lower() and (('plastic' in name)==('plastic' in x.name.lower()))),None)
   if housing is None:housing=next((x for x in s.objects if x.type=='MESH' and 'housing' in x.name.lower()),None)
   hp=[housing.matrix_world@Vector(v) for v in housing.bound_box] if housing else [];ht=max(v.z for v in hp) if hp else None;hb=min(v.z for v in hp) if hp else None
   item={'name':o.name,'diameterMm':radius*2000,'radialDeviationMm':float(rad.max()-rad.min())*1000,'axisOffsetMm':float(np.linalg.norm(center[:2]))*1000,'centerZmm':float(center[2])*1000,'housing':housing.name if housing else None,'housingTopZmm':ht*1000 if ht is not None else None,'exposedBallHeightMm':(float(hi[2])-ht)*1000 if ht is not None else None,'round':float(rad.max()-rad.min())<.00005,'centerSeatedInsideHousing':bool(housing and hb<float(center[2])<ht),'notCutOff':len(xyz)>100 and float(rad.max()-rad.min())<.00005}
   report['rollers'].append(item)
  if ('dip tube' in name or 'pipette' in name) and 'barb' not in name:
   xyz=np.array([list(o.matrix_world@v.co) for v in o.data.vertices]);lo=xyz.min(0);hi=xyz.max(0);rads=np.linalg.norm(xyz[:,:2],axis=1);ro=rads.max();gaps=[]
   for z in np.linspace(lo[2],hi[2],48):
    for k in range(16):
     v=Vector((math.cos(math.tau*k/16),math.sin(math.tau*k/16),0));pos=Vector((0,0,z));ok,pt,no,ix=ev.ray_cast(inv@pos,inv.to_3x3()@v)
     if ok:gaps.append(((body.matrix_world@pt)-pos).length-ro)
   report['tubes'].append({'name':o.name,'floorGapMm':(lo[2]-floor)*1000 if floor is not None else None,'minWallGapMm':min(gaps)*1000 if gaps else None,'outsideDiameterMm':ro*2000,'axisCenterMm':((lo[:2]+hi[:2])/2*1000).tolist(),'floorPass':bool(floor is not None and .0004<lo[2]-floor<.0006),'wallPass':bool(gaps and min(gaps)>0)})
 dest.write_text(json.dumps(report,indent=2));print('FIT_VERIFIED',ident,flush=True)
print('FIT_VERIFICATION_COMPLETE',flush=True)
