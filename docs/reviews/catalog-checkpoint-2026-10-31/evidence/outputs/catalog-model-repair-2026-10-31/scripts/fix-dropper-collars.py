import bpy,bmesh,math,json,sys
from pathlib import Path
from mathutils import Vector
r=Path(sys.argv[sys.argv.index('--')+1]).resolve()
def boolean(o,c,op):
 bpy.context.view_layer.objects.active=o;m=o.modifiers.new('Applied mating geometry','BOOLEAN');m.operation=op;m.solver='EXACT';m.object=c;bpy.ops.object.modifier_apply(modifier=m.name);bpy.data.objects.remove(c,do_unlink=True)
def box(z0,z1):
 bpy.ops.mesh.primitive_cube_add(size=1,location=(0,0,(z0+z1)/2));o=bpy.context.object;o.dimensions=(.5,.5,z1-z0);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return o
for f in (r/'working/dropper-assemblies').glob('*/repair-report.json'):
 a=json.loads(f.read_text());d=f.parent;bpy.ops.wm.open_mainfile(filepath=a['workingCopy'],load_ui=False,use_scripts=False);s=bpy.context.scene;body=next(o for o in s.objects if o.name.startswith('BB_BTL'));collar=s.objects['dropper | collar'];bulb=s.objects['dropper | bulb'];rim=max((body.matrix_world@v.co).z for v in body.data.vertices);sh=rim-.0158
 negative=body.copy();negative.data=body.data.copy();s.collection.objects.link(negative);negative.name='Temporary male finish negative';boolean(negative,box(sh-.001,rim+.0002),'INTERSECT')
 # Fill the neck bore so the cutter represents the outer male thread envelope as a solid.
 bpy.ops.mesh.primitive_cylinder_add(vertices=192,radius=.006,depth=.018,location=(0,0,rim-.008));plug=bpy.context.object;boolean(negative,plug,'UNION');negative.scale.x*=1.015;negative.scale.y*=1.015;bpy.context.view_layer.objects.active=negative;bpy.ops.object.select_all(action='DESELECT');negative.select_set(True);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);boolean(collar,negative,'DIFFERENCE')
 bm=bmesh.new();bm.from_mesh(collar.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-6);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));nm=sum(not e.is_manifold for e in bm.edges);bm.to_mesh(collar.data);bm.free()
 # A compressed sealing washer fills the gap to the collar ceiling; outside surfaces remain unchanged.
 n=192;prof=[(.00340,rim),(.0082,rim),(.0082,rim+.0015),(.00340,rim+.0015)];vs=[(rad*math.cos(math.tau*j/n),rad*math.sin(math.tau*j/n),z) for rad,z in prof for j in range(n)];fs=[]
 for k in range(4):
  for j in range(n):fs.append((k*n+j,k*n+(j+1)%n,((k+1)%4)*n+(j+1)%n,((k+1)%4)*n+j))
 me=bpy.data.meshes.new('Inferred dropper seal washer');me.from_pydata(vs,[],fs);me.update();o=bpy.data.objects.new('dropper | seal washer',me);s.collection.objects.link(o);me.materials.append(bulb.data.materials[0]);bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
 a['workingCopy']=str(d/'model-fit-v2.blend');a['changes'].append({'code':'COLLAR-FIT','detail':'Removed neck penetration using the actual male finish envelope with 1.5% radial assembly clearance; added an inferred 1.5 mm sealing washer at the glass rim'});a['collarNonManifoldEdges']=nm;a['qualification']+=' Female thread clearance and sealing washer are visual engineering assumptions, not manufacturer tolerance data.';bpy.ops.wm.save_as_mainfile(filepath=a['workingCopy'],compress=True);(d/'repair-report-v2.json').write_text(json.dumps(a,indent=2));print('DROPPER_COLLAR_FIXED',a['id'],nm,flush=True)
print('DROPPER_COLLARS_COMPLETE',flush=True)
