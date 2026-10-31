import bpy,bmesh,math,json,sys
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
r=Path(sys.argv[sys.argv.index('--')+1]).resolve();out=r/'working/flair-15ml-13-415';repo=r.parents[1]
src=Path('/Users/jordanrichter/Documents/Codex/2026-09-24/the-image-is-clearly-the-target/outputs/cyl5-13415-v7-review-2026-09-29/Cyl-5ml-13-415_clear_STUDIO-v1.5-body-v7e.blend')
bpy.ops.wm.open_mainfile(filepath=str(src),load_ui=False,use_scripts=False);s=bpy.context.scene;original=next(o for o in s.objects if o.name.startswith('Bottle |'));glass=original.data.materials[0]
def boolean(o,c,operation):
 bpy.context.view_layer.objects.active=o;m=o.modifiers.new('Applied repair boolean','BOOLEAN');m.operation=operation;m.solver='EXACT';m.object=c;bpy.ops.object.modifier_apply(modifier=m.name);bpy.data.objects.remove(c,do_unlink=True)
def box(lo,hi):
 bpy.ops.mesh.primitive_cube_add(size=1,location=(Vector(lo)+Vector(hi))/2);o=bpy.context.object;o.dimensions=Vector(hi)-Vector(lo);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return o
def mesh(name,verts,faces):
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new(name,me);s.collection.objects.link(o);return o
def closed_loft(name,rings):
 n=len(rings[0]);vs=sum(rings,[]);fs=[]
 for k in range(len(rings)-1):
  for j in range(n):l=(j+1)%n;fs.append((k*n+j,k*n+l,(k+1)*n+l,(k+1)*n+j))
 fs.extend([tuple(range(n-1,-1,-1)),tuple((len(rings)-1)*n+j for j in range(n))]);return mesh(name,vs,fs)
finish=original.copy();finish.data=original.data.copy();s.collection.objects.link(finish);finish.name='Measured 13-415 finish'
boolean(finish,box((-.1,-.1,.04212),(.1,.1,.1)),'INTERSECT');finish.location.z+=.00288
bpy.ops.object.select_all(action='DESELECT');finish.select_set(True);bpy.context.view_layer.objects.active=finish;bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
sys.path.insert(0,str(repo/'pipeline/paper-doll-3d/scripts'));from bottle_bodies import _rounded_rect_ring
# Photo-constrained exterior: front and depth views, manufacturer envelope 56 x 41 x 20 mm.
# The old solid sweep's abrupt circularisation created horizontal ledges. A continuous loft avoids that.
profile=[(0,11.6,6.6),(1,12.1,7.0),(3,12.5,7.25),(15,15.55,8.1),(28,18.9,9.5),(34,20.5,10),(35.2,20.4,9.95),(37.5,18.9,9.4),(39.3,17.3,8.9),(41,14.4,8.2),(43,11.0,7.3),(44.3,7.8,6.15),(45,5.6,5.6),(45.25,5.6,5.6)]
def interp(z,col):
 for i in range(len(profile)-1):
  if z<=profile[i+1][0]:
   a,b=profile[i],profile[i+1];t=(z-a[0])/(b[0]-a[0]);t=max(0,min(1,t));a0=profile[max(0,i-1)];b1=profile[min(len(profile)-1,i+2)]
   m0=(b[col]-a0[col])/(b[0]-a0[0]);m1=(b1[col]-a[col])/(b1[0]-a[0]);dt=b[0]-a[0]
   return (2*t**3-3*t**2+1)*a[col]+(t**3-2*t**2+t)*dt*m0+(-2*t**3+3*t**2)*b[col]+(t**3-t**2)*dt*m1
 return profile[-1][col]
rings=[]
for k in range(241):
 z=45.25*k/240;hw=interp(z,1);hd=interp(z,2);blend=max(0,min(1,(z-41)/4));rad=3.4*(1-blend)+min(hw,hd)*blend;ring=[]
 for x,y in _rounded_rect_ring(hw,hd,rad,256):
  u=abs(x)/hw;face=max(0,min(1,(abs(y)/hd-.45)/.45));fade=min(1,max(0,(z-1.4)/3))
  # Rounded channels terminate in arches, with the outer flute ending lower on the shoulder.
  groove=0
  for center,width,depth,top in [(.56,.045,.8,42),(.80,.036,.6,38.5)]:
   stop=max(0,min(1,(top-z)/2));groove+=depth*math.exp(-((u-center)/width)**2)*stop
  y-=math.copysign(groove*face*fade,y);ring.append((x/1000,y/1000,z/1000))
 rings.append(ring)
body=closed_loft('Bottle | Flair 15 ml review v2',rings);boolean(body,finish,'UNION')
bm=bmesh.new();bm.from_mesh(body.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-7);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(body.data);bm.free()
bvh=BVHTree.FromPolygons([v.co for v in body.data.vertices],[p.vertices[:] for p in body.data.polygons]);inside=[]
for k in range(201):
 z=.003+(.058-.003)*k/200;ring=[]
 for j in range(128):
  a=math.tau*j/128;d=Vector((math.cos(a),math.sin(a),0));hit,n,idx,dist=bvh.ray_cast(Vector((0,0,min(z,.0449))),d,.1)
  rr=max(.003725,(dist if hit else .006)-.0016)
  if z>.042:rr=rr*(1-min(1,(z-.042)/.003))+.003725*min(1,(z-.042)/.003)
  ring.append((rr*d.x,rr*d.y,z))
 inside.append(ring)
cut=closed_loft('Inferred interior | wall 1.6 mm floor 3 mm',inside);bm=bmesh.new();bm.from_mesh(cut.data);volume=abs(bm.calc_volume())*1e6;bm.free();boolean(body,cut,'DIFFERENCE')
bm=bmesh.new();bm.from_mesh(body.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-7);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));nm=sum(not e.is_manifold for e in bm.edges);bm.to_mesh(body.data);bm.free();body.data.materials.append(glass)
for p in body.data.polygons:p.use_smooth=True
for o in s.objects:
 if o is body or o is original:continue
 if any(c.name.startswith('Sheet |') for c in o.users_collection):o.location.z+=.00288
original.hide_render=True;original.hide_set(True);original.name='REFERENCE ONLY | Cylinder source body'
s.render.use_border=False;s.render.use_crop_to_border=False;s.camera.data.clip_start=.00001;s.camera.data.clip_end=100
bpy.context.view_layer.update();bounds=[body.matrix_world@Vector(v) for v in body.bound_box];dims=[(max(v[i] for v in bounds)-min(v[i] for v in bounds))*1000 for i in range(3)]
report={'acceptanceClass':'visual-production reconstruction, review only','dimensionsMm':dims,'nonManifoldEdges':nm,'estimatedCavityMl':volume,'reference':'exact SKU front/depth photos and published 56 x 41 x 20 mm','inferred':['flute depths','1.6 mm walls','3 mm base','continuous interpolated cross-sections'],'sourceFinish':'native measured 13-415, unchanged at 1:1','remaining':'Closure assemblies, straight tube, visual approval and manufacturer drawing validation'}
(out/'repair-report-v2.json').write_text(json.dumps(report,indent=2));bpy.ops.wm.save_as_mainfile(filepath=str(out/'Flair-15ml-13-415-v2.blend'),compress=True)
for o in s.objects:
 if o.type=='MESH':o.hide_render=o is not body
s.render.engine='BLENDER_WORKBENCH';s.render.resolution_x=520;s.render.resolution_y=650;s.render.resolution_percentage=100
sh=s.display.shading;sh.color_type='SINGLE';sh.single_color=(.64,.69,.72);sh.show_cavity=True;sh.cavity_type='BOTH';sh.background_type='WORLD';s.world=bpy.data.worlds.new('Geometry background');s.world.color=(.8,.79,.76)
cam=s.camera;cam.data.type='ORTHO';cam.data.ortho_scale=.078;target=Vector((0,0,.028));cam.location=target+Vector((.06,-.4,.04));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();s.render.filepath=str(out/'geometry-after-v2.png');bpy.ops.render.render(write_still=True);print('FLAIR_V2',report,flush=True)
