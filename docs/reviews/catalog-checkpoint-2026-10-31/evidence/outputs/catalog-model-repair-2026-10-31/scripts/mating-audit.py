import bpy,json,sys,math,numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
r=Path(sys.argv[sys.argv.index('--')+1]).resolve();out=r/'audit/mating-surfaces';out.mkdir(exist_ok=True);jobs=[]
for kind in ['native','priority-assemblies','empire-assemblies','dropper-assemblies']:
 for f in (r/'working'/kind).glob('*/repair-report.json'):
  d=f.parent;a=json.loads(f.read_text());ident=a['id']
  if kind=='native' and not(any(x in ident for x in ['clear_STUDIO-v1.5','Tall-9ml-13-415_clear','mist-black-clear','lotion-black-clear','shiny-gold-capped','white-capped','kit-71.31-v21__scenes__roller'])):continue
  chosen=f
  for n in range(2,16):
   z=d/f'repair-report-v{n}.json'
   if z.exists() and json.loads(z.read_text()).get('disposition')!='rejected refinement':chosen=z
  a=json.loads(chosen.read_text());jobs.append((a,kind))
def geometry(o):
 ev=o.evaluated_get(bpy.context.evaluated_depsgraph_get());me=ev.to_mesh();verts=[o.matrix_world@v.co for v in me.vertices];polys=[p.vertices[:] for p in me.polygons];ev.to_mesh_clear();return verts,polys
if len(sys.argv)>sys.argv.index('--')+2:jobs=[x for x in jobs if sys.argv[-1] in x[0]['id']]
def inside(tree,p):
 votes=0
 for direction in [(1,.372,.193),(-.241,1,.413),(.319,-.223,1)]:
  v=Vector(direction).normalized();pos=p+v*.0000001;hits=0
  for _ in range(80):
   point,normal,index,distance=tree.ray_cast(pos,v,1)
   if point is None:break
   hits+=1;pos=point+v*.0000001
  votes+=hits%2
 return votes>=2
for a,kind in jobs:
 dest=out/(a['id']+'.json')
 if dest.exists() and json.loads(dest.read_text()).get('workingCopy')==a['workingCopy'] and json.loads(dest.read_text()).get('algorithmVersion')==2:continue
 bpy.ops.wm.open_mainfile(filepath=a['workingCopy'],load_ui=False,use_scripts=False);s=bpy.context.scene;body=next((o for o in s.objects if o.type=='MESH' and o.name.lower().startswith(('bottle','bb_btl')) and not o.hide_render),None)
 if not body:continue
 bv,bp=geometry(body);rim=max(v.z for v in bv);samples=[p for p in bv if p.z>rim-.025];stride=max(1,math.ceil(len(samples)/18000));samples=samples[::stride];checks=[]
 for o in s.objects:
  if o.type!='MESH' or o==body:continue
  if o.hide_render and not any(c.name.startswith('Sheet | ') for c in o.users_collection):continue
  name=o.name.lower()
  if 'collar' not in name and not(name.startswith(('cap_','short-','liner-','cap-')) and ('jewel' not in name)) and ('housing' not in name or 'spring' in name):continue
  cv,cp=geometry(o)
  if not cv:continue
  low=min(v.z for v in cv);high=max(v.z for v in cv);tree=BVHTree.FromPolygons(cv,cp);hits=[];maxdepth=0
  for p in samples:
   if not low-.0001<p.z<high+.0001:continue
   loc,n,ix,dist=tree.find_nearest(p)
   if n and (p-loc).dot(n)<-.00005 and inside(tree,p):
    maxdepth=max(maxdepth,dist)
    if len(hits)<5:hits.append([round(float(x)*1000,4) for x in p])
  checks.append({'object':o.name,'against':body.name,'sampledBodyVertices':len(samples),'maxPenetrationMm':maxdepth*1000,'passAt0_05mm':maxdepth<=.00005,'exampleBodyPointsMm':hits,'interpretation':'A small press-fit housing interference may be intentional; hard cap or collar penetration requires correction.'})
  # A closed tall roller cap must also clear the whole ball.
  if name.startswith('cap-') or name.startswith('cap_') or 'housing' in name:
   ball=next((x for x in s.objects if x.type=='MESH' and 'ball' in x.name.lower() and 'roller' in x.name.lower()),None)
   if ball:
    vv,pp=geometry(ball);dep=0
    for p in vv[::max(1,len(vv)//5000)]:
     loc,n,ix,dist=tree.find_nearest(p)
     if n and (p-loc).dot(n)<-.00005 and inside(tree,p):dep=max(dep,dist)
    checks.append({'object':o.name,'against':ball.name,'maxPenetrationMm':dep*1000,'passAt0_05mm':dep<=.00005})
 report={'algorithmVersion':2,'id':a['id'],'workingCopy':a['workingCopy'],'checks':checks,'scope':'Sampled penetration with nearest-surface distance and majority ray-parity containment at 0.05 mm threshold; not a manufacturing tolerance certification.'};dest.write_text(json.dumps(report,indent=2));print('MATING',a['id'],[(x['object'],round(x['maxPenetrationMm'],4)) for x in checks if not x['passAt0_05mm']],flush=True)
print('MATING_COMPLETE',len(jobs),flush=True)
