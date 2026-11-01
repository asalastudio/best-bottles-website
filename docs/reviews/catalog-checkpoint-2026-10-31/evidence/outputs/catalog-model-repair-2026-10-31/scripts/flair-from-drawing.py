import bpy,bmesh,math,json,sys,hashlib,numpy as np
from pathlib import Path
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
r=Path(sys.argv[sys.argv.index('--')+1]).resolve();d=r/'working/priority-assemblies/flair';q=json.loads((r/'sources/audit-queue.json').read_text());src=next(r/'working/native'/a['id']/'model-v2.blend' for a in q if 'clear_STUDIO-v1.5' in a['id']);bpy.ops.wm.open_mainfile(filepath=str(src),load_ui=False,use_scripts=False);s=bpy.context.scene;original=next(o for o in s.objects if o.name.startswith('Bottle |'));glass=original.data.materials[0];repo=r.parents[1];sys.path.insert(0,str(repo/'pipeline/paper-doll-3d/scripts'));from bottle_bodies import _rounded_rect_ring
H=64.1;SH=52.2;RIM_DELTA=(H-53.12)/1000

def clean(o):
 bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-7);bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=1e-8);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));check={'nonManifoldEdges':sum(not e.is_manifold for e in bm.edges),'degenerateFaces':sum(f.calc_area()<1e-16 for f in bm.faces),'glassMaterialVolumeMl':bm.calc_volume(signed=True)*1e6};bm.to_mesh(o.data);bm.free();return check

def boolean(o,c,operation):
 bpy.context.view_layer.objects.active=o;m=o.modifiers.new('Applied drawing reconstruction','BOOLEAN');m.operation=operation;m.solver='EXACT';m.object=c;bpy.ops.object.modifier_apply(modifier=m.name);bpy.data.objects.remove(c,do_unlink=True)
def box(z0,z1):
 bpy.ops.mesh.primitive_cube_add(size=1,location=(0,0,(z0+z1)/2));c=bpy.context.object;c.dimensions=(.5,.5,z1-z0);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return c

def loft(name,rings):
 n=len(rings[0]);vs=sum(rings,[]);fs=[]
 for k in range(len(rings)-1):
  for j in range(n):l=(j+1)%n;fs.append((k*n+j,k*n+l,(k+1)*n+l,(k+1)*n+j))
 fs.extend([tuple(range(n-1,-1,-1)),tuple((len(rings)-1)*n+j for j in range(n))]);me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update();o=bpy.data.objects.new(name,me);s.collection.objects.link(o);clean(o);return o
finish=original.copy();finish.data=original.data.copy();s.collection.objects.link(finish);boolean(finish,box(.04212,.2),'INTERSECT');finish.location.z+=RIM_DELTA;bpy.context.view_layer.objects.active=finish;bpy.ops.object.select_all(action='DESELECT');finish.select_set(True);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
# 2020-06-10 manufacturer drawing: 64.1 H, 42 ±0.5 W, 20.5 ±0.5 D, base 24.5 ×18, 11.9 mm shoulder-to-rim.
profile=[(0,12.25,9),(1.0,12.45,9.15),(8,13.85,9.4),(18,16.0,9.7),(29,19.2,10.0),(35.5,21,10.25),(37.5,20.9,10.25),(40,19.8,10.2),(43.5,17.1,10.15),(46.2,14.6,10.1),(49,11.5,9.9),(50.8,9.0,9.45),(52.2,5.6,5.6),(53.35,5.6,5.6)]
def interp(z,col):
 for i in range(len(profile)-1):
  if z<=profile[i+1][0]:
   a,b=profile[i],profile[i+1];t=max(0,min(1,(z-a[0])/(b[0]-a[0])));a0=profile[max(0,i-1)];b1=profile[min(len(profile)-1,i+2)];m0=(b[col]-a0[col])/(b[0]-a0[0]);m1=(b1[col]-a[col])/(b1[0]-a[0]);dt=b[0]-a[0];return (2*t**3-3*t**2+1)*a[col]+(t**3-2*t*t+t)*dt*m0+(-2*t**3+3*t*t)*b[col]+(t**3-t*t)*dt*m1
 return profile[-1][col]
rings=[]
for k in range(301):
 z=53.35*k/300;hw=interp(z,1);hd=interp(z,2);blend=max(0,min(1,(z-49)/3.2));rad=3.4*(1-blend)+min(hw,hd)*blend;ring=[]
 for x,y in _rounded_rect_ring(hw,hd,rad,256):
  u=abs(x)/hw;face=max(0,min(1,(abs(y)/hd-.45)/.45));fade=min(1,max(0,(z-.7)/2));groove=0
  for center,width,depth,top in [(.56,.045,.8,49.8),(.80,.036,.6,44.0)]:groove+=depth*math.exp(-((u-center)/width)**2)*max(0,min(1,(top-z)/2))
  y-=math.copysign(groove*face*fade,y);ring.append((x/1000,y/1000,z/1000))
 rings.append(ring)
body=loft('Bottle | Flair 15 ml manufacturer-drawing review',rings);boolean(body,finish,'UNION');clean(body);bvh=BVHTree.FromPolygons([v.co for v in body.data.vertices],[p.vertices[:] for p in body.data.polygons]);zs=np.linspace(.003,H/1000,241);angles=np.arange(128)*math.tau/128;outer=[]
for z in zs:
 ring=[]
 for a in angles:
  v=Vector((math.cos(a),math.sin(a),0));hit,n,idx,dist=bvh.ray_cast(Vector((0,0,min(z,.05215))),v,.1);ring.append(dist if hit else .006)
 outer.append(ring)
outer=np.array(outer)
def cavity(wall):
 rr=np.maximum(.003725,outer-wall)
 for i,z in enumerate(zs):
  blend=max(0,min(1,(z-.0492)/.003));rr[i]=rr[i]*(1-blend)+.003725*blend
 area=.5*np.sin(math.tau/128)*np.sum(rr*np.roll(rr,-1,axis=1),axis=1);vol=np.sum((area[1:]+area[:-1])/2*np.diff(zs))*1e6;return rr,float(vol)
lo,hi=.0008,.008
for _ in range(40):
 mid=(lo+hi)/2;rr,vol=cavity(mid)
 if vol>15:lo=mid
 else:hi=mid
wall=(lo+hi)/2;rr,vol=cavity(wall);inside=[[(float(rad*math.cos(a)),float(rad*math.sin(a)),float(z)) for rad,a in zip(radrow,angles)] for z,radrow in zip(zs,rr)];inside.append([(.003725*math.cos(a),.003725*math.sin(a),(H+2)/1000) for a in angles]);cut=loft('Inferred cavity matched to 15 ml overflow',inside);boolean(body,cut,'DIFFERENCE');check=clean(body);body.data.materials.clear();body.data.materials.append(glass)
for poly in body.data.polygons:poly.material_index=0;poly.use_smooth=True
for c in original.users_collection:
 if body.name not in c.objects:c.objects.link(body)
for o in s.objects:
 if o is original or o is body:continue
 if any(c.name.startswith('Sheet |') for c in o.users_collection):o.location.z+=RIM_DELTA
original.name='REFERENCE ONLY | measured Cylinder source body';original.hide_render=True;original.hide_set(True)
tube=next(o for o in s.objects if 'dip tube' in o.name.lower() and 'barb' not in o.name.lower());top=max((tube.matrix_world@v.co).z for v in tube.data.vertices);n=128;vs=[]
for z,rad in [(.0035,.00071825),(top,.00071825),(.0035,.00031825),(top,.00031825)]:vs.extend((rad*math.cos(math.tau*j/n),rad*math.sin(math.tau*j/n),z) for j in range(n))
fs=[]
for j in range(n):k=(j+1)%n;fs.extend([(j,k,n+k,n+j),(2*n+j,3*n+j,3*n+k,2*n+k),(j,2*n+j,2*n+k,k),(n+j,n+k,3*n+k,3*n+j)])
me=bpy.data.meshes.new('Flair straight fitted tube');me.from_pydata(vs,[],fs);me.update()
for m in tube.data.materials:me.materials.append(m)
tube.data=me;tube.matrix_world=Matrix.Identity(4);clean(tube)
for c in bpy.data.collections:
 if c.name.startswith('Sheet | '):c.hide_render=c.name not in ['Sheet | internals','Sheet | spray-matte-black']
s.render.use_border=False;s.render.use_crop_to_border=False;s.camera.data.clip_start=.00001;s.camera.data.clip_end=100;bpy.context.view_layer.update();bounds=[body.matrix_world@Vector(v) for v in body.bound_box];dims=[(max(v[i] for v in bounds)-min(v[i] for v in bounds))*1000 for i in range(3)];source=repo/'pipeline/paper-doll-3d/specs/Flair 15ml.pdf';a={'id':'priority-flair','family':'flair','workingCopy':str(d/'model-drawing-v4.blend'),'acceptanceClass':'manufacturer-dimension constrained visual reconstruction','sourceDrawing':str(source),'drawingSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'drawingDimensionsMm':{'height':64.1,'width':42,'depth':20.5,'baseWidth':24.5,'baseDepth':18,'shoulderToRim':11.9,'bore':7.6},'dimensionsMm':dims,'shoulderMm':SH,'targetPct':3.5314*H**.5868,'checks':check,'tube':{'outsideDiameterMm':1.4365,'boreMm':.6365,'floorGapMm':.5,'topMm':top*1000},'interior':{'floorMm':3,'solvedInsetMm':wall*1000,'targetOverflowMl':15,'modeledOverflowMl':vol,'qualification':'Floor and inset distribution inferred; overflow capacity constrained to drawing. Not a measured wall-thickness model.'},'changes':[{'code':'DRAWING-DIMENSIONS','detail':'Replaced 56 ×41 ×20 catalog estimate with manufacturer drawing: 64.1 H ×42 W ×20.5 D mm; base 24.5 ×18 mm'},{'code':'CAPACITY','detail':'Constrained the inferred cavity to the drawing’s 15 ml overflow capacity'},{'code':'TUBE-AXIS','detail':'Rebuilt straight fitted tube to 0.5 mm above the revised cavity floor'}],'remaining':['Flute cross sections and glass thickness distribution still inferred','Manufacturer confirmation of drawing/listing conflict','Exact closure contact and visual review']};bpy.ops.wm.save_as_mainfile(filepath=a['workingCopy'],compress=True);(d/'repair-report-v4.json').write_text(json.dumps(a,indent=2));print('FLAIR_DRAWING_FIXED',json.dumps(a),flush=True)
